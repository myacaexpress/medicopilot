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
 *     { type: "pong", t: number }
 *     { type: "error", code: string, message: string }
 *   client→server:
 *     { type: "ping", t: number }
 *     { type: "start", sampleRate?: number }                                — open Deepgram
 *     { type: "stop" }                                                      — close Deepgram
 *     { type: "bye" }                                                       — graceful socket close
 *     <binary>                                                              — Int16LE PCM frame
 */

import { randomUUID } from "node:crypto";
import { redact } from "../redact.js";
import { createDeepgramSession } from "../deepgram.js";

/**
 * @param {import("fastify").FastifyInstance} app
 */
export default async function streamRoutes(app) {
  // The factory is decorated by build() — tests inject a stub. Default
  // is the real Deepgram WS client.
  const deepgramFactory = app.deepgramFactory ?? createDeepgramSession;
  const apiKey = app.env?.deepgramApiKey ?? null;
  const sampleRate = app.env?.deepgramSampleRate ?? 16000;

  app.get("/stream", { websocket: true }, (socket, req) => {
    const sessionId = randomUUID();
    const log = app.log.child({ sessionId, remoteAddr: req.ip });
    log.info("stream: client connected");

    /** @type {ReturnType<typeof createDeepgramSession>|null} */
    let dg = null;
    let frameCount = 0;
    let byteCount = 0;

    const send = (obj) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(obj));
      }
    };

    const sendError = (code, message) => send({ type: "error", code, message });

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
            log.debug(
              { redactionCounts: counts, len: redacted.length, speaker: u.speaker },
              "stream: utterance (redacted)"
            );
            send({
              type: "utterance",
              sessionId,
              final: true,
              speaker: u.speaker,
              text: redacted,
              ts: u.ts,
              redactionCounts: counts,
            });
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
