/**
 * WSS /stream — long-lived WebSocket for the live-call pipeline.
 *
 * Tier 2 scope (current):
 *   - Browser opens a session and sends `{ type: "start" }`
 *   - Server opens a Deepgram Nova-3 streaming connection
 *   - Browser ships binary linear16 PCM frames (16 kHz mono, 200 ms each)
 *   - Server forwards them to Deepgram
 *   - Deepgram returns finalised utterances → server runs them through
 *     the PII redactor → broadcasts a `utterance` JSON frame back to the
 *     browser
 *   - Browser sends `{ type: "stop" }` (or disconnects) → Deepgram closes
 *
 * Wire format (UTF-8 JSON for control + binary for audio):
 *   server→client:
 *     { type: "hello", sessionId: string, serverTime: ISO }                 — on connect
 *     { type: "ready", sessionId: string }                                  — Deepgram is open
 *     { type: "utterance", sessionId, final: true, speaker, text,
 *         ts, redactionCounts: { ssn, credit_card, phone } }                — redacted final utterance
 *     { type: "suggestion_start", sessionId, id, kind }                     — Claude stream opened
 *     { type: "suggestion_delta", sessionId, id, kind, delta }              — partial JSON token
 *     { type: "suggestion_done",  sessionId, id, kind, suggestion }         — final AIResponse
 *     { type: "suggestion_error", sessionId, id, kind, code, message }      — stream failed
 *     { type: "pecl_update", sessionId, items: PeclItemId[] }               — newly auto-marked items
 *     { type: "speakers_recalibrated", sessionId, agentLabel: number }      — speaker mapping flipped
 *     { type: "pong", t: number }
 *     { type: "error", code: string, message: string }
 *   client→server:
 *     { type: "ping", t: number }
 *     { type: "start", sampleRate?: number }                                — open Deepgram
 *     { type: "stop" }                                                      — close Deepgram
 *     { type: "lead_context", lead: object|null }                           — snapshot for Claude prompt
 *     { type: "script_state", state: ScriptState|null }                     — PECL checklist state
 *     { type: "call_timer", ms: number }                                    — elapsed call time
 *     { type: "request_suggestion" }                                        — explicit "Ask AI" trigger
 *     { type: "recalibrate_speakers" }                                      — flip agent/client mapping
 *     { type: "bye" }                                                       — graceful socket close
 *     <binary>                                                              — Int16LE PCM frame
 */

import { randomUUID } from "node:crypto";
import { redact } from "../redact.js";
import { createDeepgramSession } from "../deepgram.js";
import { SuggestionEngine } from "../suggestions/engine.js";
import { createAnthropicClient } from "../suggestions/claude.js";
import { getScenarioById } from "./training.js";
import { query } from "../db.js";

/**
 * @param {import("fastify").FastifyInstance} app
 */
export default async function streamRoutes(app) {
  // The factory is decorated by build() — tests inject a stub. Default
  // is the real Deepgram WS client.
  const deepgramFactory = app.deepgramFactory ?? createDeepgramSession;
  const apiKey = app.env?.deepgramApiKey ?? null;
  const sampleRate = app.env?.deepgramSampleRate ?? 16000;

  // Suggestion engine deps. Tests can inject `app.suggestionClientFactory`
  // and `app.suggestionEngineFactory` to stub Claude. In prod we lazily
  // build a real Anthropic client per session (cheap; just an http agent).
  const suggestionClientFactory =
    app.suggestionClientFactory ??
    (() => createAnthropicClient(app.env?.anthropicApiKey ?? null));
  const suggestionEngineFactory =
    app.suggestionEngineFactory ??
    ((deps) => new SuggestionEngine(deps));
  const suggestionModel = app.env?.suggestionModel ?? "claude-sonnet-4-6";
  const suggestionWindowMs = app.env?.suggestionWindowMs ?? 120_000;
  const suggestionDebounceMs = app.env?.suggestionDebounceMs ?? 8_000;

  app.get("/stream", { websocket: true }, (socket, req) => {
    const sessionId = randomUUID();
    const log = app.log.child({ sessionId, remoteAddr: req.ip });
    log.info("stream: client connected");

    /** @type {ReturnType<typeof createDeepgramSession>|null} */
    let dg = null;
    let frameCount = 0;
    let byteCount = 0;

    // Speaker diarization mapping. The first speaker heard after Start
    // Call is tagged "agent" (agents speak first 95%+ of the time).
    // `recalibrate_speakers` flips the mapping if the heuristic is wrong.
    /** @type {number|null} Deepgram speaker label assigned to "agent" */
    let agentLabel = null;
    /** @type {boolean} */
    let speakerLocked = false;
    let trainingMode = false;
    let pttSpeaking = false;
    /** @type {number|null} Timestamp when PTT was last released (true→false). */
    let pttReleasedAt = null;
    const pttTailMs = app.env?.pttTailMs ?? 1500;
    /** @type {number|null} DB session ID — only set in training mode. */
    let trainingSessionId = null;
    let sessionStartedAt = null;

    const mapSpeaker = (dgSpeaker) => {
      if (trainingMode) {
        if (pttSpeaking) return "agent";
        if (pttReleasedAt && (Date.now() - pttReleasedAt) < pttTailMs) return "agent";
        return "client";
      }
      if (!speakerLocked) {
        agentLabel = dgSpeaker;
        speakerLocked = true;
        log.info({ agentLabel }, "stream: speaker mapping locked (first speaker = agent)");
      }
      return dgSpeaker === agentLabel ? "agent" : "client";
    };

    const send = (obj) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(obj));
      }
    };

    const sendError = (code, message) => send({ type: "error", code, message });

    // Build a per-session suggestion engine. If the Anthropic key is
    // missing we leave `engine` null — utterances still flow but no
    // suggestion frames go out. The agent UI falls back to demo cards.
    let engine = null;
    const sClient = suggestionClientFactory();
    if (sClient) {
      engine = suggestionEngineFactory({
        client: sClient,
        model: suggestionModel,
        log,
        emit: (event) => {
          send({ ...event, sessionId });
          // Persist completed suggestions in training mode
          if (
            event.type === "suggestion_done" &&
            trainingMode &&
            trainingSessionId &&
            sessionStartedAt &&
            event.suggestion
          ) {
            const tsMs = Date.now() - sessionStartedAt;
            const s = event.suggestion;
            query(
              `INSERT INTO training_ai_suggestions
                 (session_id, say_this, trigger_info, call_stage, follow_up_questions, timestamp_ms)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                trainingSessionId,
                s.primary || s.sayThis || null,
                event.kind ? JSON.stringify({ kind: event.kind }) : null,
                s.call_stage || null,
                s.followUps ? JSON.stringify(s.followUps) : null,
                tsMs,
              ]
            ).catch((err) =>
              log.warn({ err: err.message }, "stream: suggestion persist failed")
            );
          }
        },
        opts: {
          windowMs: suggestionWindowMs,
          cooldownMs: suggestionDebounceMs,
        },
      });
    } else {
      log.warn("stream: ANTHROPIC_API_KEY unset — suggestion engine disabled");
    }

    socket.send(
      JSON.stringify({
        type: "hello",
        sessionId,
        serverTime: new Date().toISOString(),
      })
    );

    /** Open a Deepgram session for this client. */
    const startDeepgram = async () => {
      if (dg) {
        sendError("already_started", "Deepgram session already open");
        return;
      }
      // Reset speaker mapping for new call
      agentLabel = null;
      speakerLocked = false;
      if (!apiKey) {
        log.warn("stream: start requested but DEEPGRAM_API_KEY is unset");
        sendError("no_api_key", "Server is missing DEEPGRAM_API_KEY");
        return;
      }
      try {
        dg = deepgramFactory({
          apiKey,
          sampleRate,
          log,
          onUtterance: (u) => {
            // Compliance gate: redact BEFORE the bytes leave the server
            // (broadcast or log). The test suite has an invariant that
            // verifies the broadcast frame is always post-redaction.
            const { redacted, counts } = redact(u.text);
            const role = mapSpeaker(u.speaker);
            log.debug(
              { redactionCounts: counts, len: redacted.length, speaker: role, dgSpeaker: u.speaker },
              "stream: utterance (redacted)"
            );
            send({
              type: "utterance",
              sessionId,
              final: true,
              speaker: role,
              text: redacted,
              ts: u.ts,
              redactionCounts: counts,
            });
            // Persist transcript in training mode (fire-and-forget)
            if (trainingMode && trainingSessionId && sessionStartedAt) {
              const tsMs = Date.now() - sessionStartedAt;
              query(
                `INSERT INTO training_transcripts (session_id, speaker, text, timestamp_ms)
                 VALUES ($1, $2, $3, $4)`,
                [trainingSessionId, role, redacted, tsMs]
              ).catch((err) =>
                log.warn({ err: err.message }, "stream: transcript persist failed")
              );
            }
            // Feed the (already-redacted) utterance into the engine.
            // Fire-and-forget — the engine emits its own events back
            // through `send`, and any failure is logged inside.
            if (engine) {
              Promise.resolve(
                engine.ingestUtterance({ speaker: role, text: redacted, ts: Date.now() })
              ).catch((err) =>
                log.warn({ err: err.message }, "stream: engine ingest failed")
              );
            }
          },
          onError: (err) => {
            log.error({ err: err.message }, "stream: deepgram error");
            sendError("deepgram_error", err.message);
          },
          onClose: () => {
            dg = null;
          },
        });
        await dg.readyPromise;
        log.info({ frameCount, byteCount }, "stream: deepgram ready");
        send({ type: "ready", sessionId });
      } catch (err) {
        log.error({ err: err.message }, "stream: failed to open deepgram");
        sendError("deepgram_unavailable", err.message);
        dg = null;
      }
    };

    /** Close the Deepgram session for this client. */
    const stopDeepgram = (reason = "client-stop") => {
      if (!dg) return;
      log.info({ reason, frameCount, byteCount }, "stream: closing deepgram");
      try {
        dg.close();
      } catch (err) {
        log.warn({ err: err.message }, "stream: error closing deepgram");
      }
      dg = null;
    };

    socket.on("message", (raw, isBinary) => {
      // Binary frame? Treat as PCM audio destined for Deepgram.
      if (isBinary) {
        if (!dg) {
          // The browser shipped audio before `start` succeeded. Drop it
          // silently — getting here once at session boundary is fine, a
          // sustained pattern is a bug worth tracing.
          return;
        }
        const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        if (buf.length === 0) return;
        if (buf.length % 2 !== 0) {
          // Int16LE samples — frames must be an even number of bytes.
          sendError("bad_frame", `audio frame length must be even, got ${buf.length}`);
          return;
        }
        frameCount += 1;
        byteCount += buf.length;
        dg.sendAudio(buf);
        return;
      }

      // Otherwise it's a JSON control message.
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendError("bad_json", "Expected JSON payload");
        return;
      }

      switch (msg.type) {
        case "ping":
          send({ type: "pong", t: msg.t ?? Date.now() });
          return;
        case "start":
          startDeepgram();
          return;
        case "stop":
          stopDeepgram("client-stop");
          return;
        case "lead_context":
          if (engine) engine.setLead(msg.lead ?? null);
          return;
        case "script_state":
          if (engine) engine.setScriptState(msg.state ?? null);
          return;
        case "call_timer":
          if (engine && typeof msg.ms === "number") engine.setCallTimer(msg.ms);
          return;
        case "request_suggestion":
          if (!engine) {
            sendError("no_engine", "Suggestion engine unavailable — ANTHROPIC_API_KEY may be unset");
            return;
          }
          Promise.resolve(engine.requestSuggestion()).catch((err) =>
            log.warn({ err: err.message }, "stream: manual suggestion failed")
          );
          return;
        case "recalibrate_speakers":
          if (agentLabel === null) {
            sendError("no_speakers", "No speaker mapping yet — start speaking first");
            return;
          }
          agentLabel = agentLabel === 0 ? 1 : 0;
          log.info({ agentLabel }, "stream: speaker mapping recalibrated");
          send({ type: "speakers_recalibrated", sessionId, agentLabel });
          return;
        case "set_training_mode":
          trainingMode = !!msg.enabled;
          if (trainingMode) {
            agentLabel = null;
            speakerLocked = false;
          }
          log.info({ trainingMode }, "stream: training mode toggled");
          return;
        case "set_training_scenario":
          if (msg.scenarioId && engine) {
            getScenarioById(msg.scenarioId)
              .then((scenario) => {
                if (scenario) {
                  engine.setTrainingContext(scenario);
                  log.info({ scenarioId: msg.scenarioId }, "stream: training scenario loaded");
                  send({ type: "training_scenario_loaded", sessionId, scenarioId: msg.scenarioId });
                } else {
                  sendError("scenario_not_found", `Scenario ${msg.scenarioId} not found`);
                }
              })
              .catch((err) => {
                log.warn({ err: err.message }, "stream: failed to load training scenario");
                sendError("scenario_load_failed", err.message);
              });
          }
          return;
        case "set_training_session":
          if (typeof msg.sessionId === "number") {
            trainingSessionId = msg.sessionId;
            sessionStartedAt = Date.now();
            log.info({ trainingSessionId }, "stream: training session ID set");
          }
          return;
        case "ptt_state": {
          const wasSpeaking = pttSpeaking;
          pttSpeaking = !!msg.speaking;
          if (wasSpeaking && !pttSpeaking) {
            pttReleasedAt = Date.now();
          }
          log.debug({ pttSpeaking, pttReleasedAt }, "stream: ptt state changed");
          return;
        }
        case "bye":
          log.info("stream: client sent bye");
          stopDeepgram("client-bye");
          socket.close(1000, "client-bye");
          return;
        default:
          sendError("unknown_type", `Unknown message type: ${msg.type}`);
      }
    });

    socket.on("close", (code, reason) => {
      stopDeepgram("socket-close");
      if (engine) engine.dispose();
      log.info(
        { code, reason: reason?.toString(), frameCount, byteCount },
        "stream: client disconnected"
      );
    });

    socket.on("error", (err) => {
      log.error({ err: err.message }, "stream: socket error");
    });
  });
}
