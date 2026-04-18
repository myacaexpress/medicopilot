/**
 * Per-session suggestion engine.
 *
 * Owns:
 *   - the rolling 120s transcript window
 *   - the lead-context snapshot (set by the client via lead_context msg)
 *   - the script state (PECL checklist) snapshot
 *   - the call timer (elapsed ms since call start)
 *   - the per-trigger-kind debouncer
 *   - the in-flight Claude stream (if any)
 *   - proactive trigger evaluation (compliance deadlines, unanswered questions)
 *
 * Lifecycle:
 *   const engine = new SuggestionEngine({ ... });
 *   engine.setLead(lead);
 *   engine.setScriptState(state);
 *   engine.setCallTimer(ms);
 *   engine.ingestUtterance({ speaker, text, ts });
 *   engine.requestSuggestion();
 *   engine.dispose();
 *
 * Events surface via the `emit` callback as plain JS objects — the
 * stream route serializes them to the WSS client.
 */

import { classifyUtterance } from "./triggers.js";
import { matchPECL } from "./pecl.js";
import { Debouncer } from "./debouncer.js";
import { streamSuggestion } from "./claude.js";

/**
 * @typedef {Object} EngineEvent
 * @property {"suggestion_start"|"suggestion_delta"|"suggestion_done"|"suggestion_error"|"pecl_update"} type
 * @property {string} [id]
 * @property {string} [kind]
 * @property {string} [delta]
 * @property {any} [suggestion]
 * @property {string[]} [items]
 * @property {string} [code]
 * @property {string} [message]
 */

/**
 * @typedef {Object} ScriptState
 * @property {string[]} covered         PECL item ids already covered
 * @property {string|null} requiredNext next required PECL item id
 * @property {string[]} overdueItems    PECL items past their deadline
 */

/**
 * @typedef {Object} EngineDeps
 * @property {object} client                Anthropic client (or stub)
 * @property {string} model
 * @property {import("pino").Logger} [log]
 * @property {(event: EngineEvent) => void} emit
 * @property {() => Promise<boolean>} [haikuClassify]   optional Haiku question fallback
 * @property {Object} [opts]
 * @property {number} [opts.windowMs=120000]
 * @property {number} [opts.cooldownMs=8000]
 * @property {number} [opts.unansweredThresholdMs=90000]
 * @property {number} [opts.mspDeadlineMs=600000]
 * @property {() => number} [opts.now]
 */

let _idSeq = 0;
const nextId = () => `sug_${Date.now().toString(36)}_${(_idSeq++).toString(36)}`;

export class SuggestionEngine {
  /** @param {EngineDeps} deps */
  constructor(deps) {
    const { opts = {} } = deps;
    this.client = deps.client;
    this.model = deps.model;
    this.log = deps.log;
    this.emit = deps.emit;
    this.haikuClassify = deps.haikuClassify;
    this.windowMs = opts.windowMs ?? 120_000;
    this.unansweredThresholdMs = opts.unansweredThresholdMs ?? 90_000;
    this.mspDeadlineMs = opts.mspDeadlineMs ?? 600_000;
    this.now = opts.now ?? (() => Date.now());

    /** @type {Array<{speaker: string, text: string, ts: number}>} */
    this.window = [];
    /** @type {Object|null} */
    this.lead = null;
    /** @type {ScriptState|null} */
    this.scriptState = null;
    /** @type {number|null} */
    this.callTimerMs = null;
    this.debouncer = new Debouncer({ cooldownMs: opts.cooldownMs ?? 8_000, now: this.now });
    /** @type {Set<string>} PECL ids already auto-marked this session. */
    this.peclMarked = new Set();
    /** @type {number|null} last timestamp of a client (non-agent) question */
    this._lastClientQuestionTs = null;
    /** @type {boolean} whether we already fired for the current unanswered question */
    this._unansweredFired = false;
    /** @type {boolean} whether we already fired the MSP deadline warning */
    this._mspDeadlineFired = false;
    this.disposed = false;
  }

  /** @param {Object|null} lead */
  setLead(lead) {
    this.lead = lead ?? null;
  }

  /** @param {ScriptState|null} state */
  setScriptState(state) {
    this.scriptState = state ?? null;
  }

  /** @param {number} ms */
  setCallTimer(ms) {
    this.callTimerMs = ms;
    this._evaluateProactiveTriggers();
  }

  /** Drop entries older than windowMs from the head of the window. */
  _trimWindow() {
    const cutoff = this.now() - this.windowMs;
    while (this.window.length && this.window[0].ts < cutoff) this.window.shift();
  }

  /**
   * Push a finalised utterance into the rolling window and evaluate
   * triggers + PECL coverage. Fires (at most) one suggestion call.
   *
   * @param {{speaker: string, text: string, ts?: number}} u
   * @returns {Promise<void>}
   */
  async ingestUtterance(u) {
    if (this.disposed) return;
    const ts = u.ts ?? this.now();
    this.window.push({ speaker: u.speaker, text: u.text, ts });
    this._trimWindow();

    this._evaluatePECL(u.text);
    this._trackClientQuestions(u, ts);

    let trigger;
    try {
      trigger = await classifyUtterance(u.text, { haikuClassify: this.haikuClassify });
    } catch (err) {
      this.log?.warn({ err: err.message }, "engine: classify error");
      return;
    }

    if (trigger) {
      trigger = this._enrichTriggerWithScriptState(trigger);
    }

    if (!trigger) return;
    if (!this.debouncer.tryFire(trigger.kind)) {
      this.log?.debug({ kind: trigger.kind }, "engine: debounced");
      return;
    }

    await this._runSuggestion(trigger);
  }

  /**
   * Explicit "Ask AI" trigger from the agent — bypasses the utterance
   * classifier and debouncer so the user always gets a response.
   */
  async requestSuggestion() {
    if (this.disposed) return;
    if (this.window.length === 0) {
      this.emit({
        type: "suggestion_error",
        id: nextId(),
        kind: "manual",
        code: "no_transcript",
        message: "No transcript context yet — start speaking first",
      });
      return;
    }
    await this._runSuggestion({
      kind: "manual",
      summary: "Agent requested a suggestion via Ask AI",
    });
  }

  /**
   * Track client questions for the "unanswered question" proactive trigger.
   * @param {{speaker: string, text: string}} u
   * @param {number} ts
   */
  _trackClientQuestions(u, ts) {
    if (u.speaker === "agent") {
      this._lastClientQuestionTs = null;
      this._unansweredFired = false;
      return;
    }
    if (/[?]\s*$/.test(u.text.trim())) {
      this._lastClientQuestionTs = ts;
      this._unansweredFired = false;
    }
  }

  /**
   * Evaluate timer-based proactive triggers. Called on setCallTimer()
   * and could be called periodically.
   */
  _evaluateProactiveTriggers() {
    if (this.disposed) return;

    // Compliance deadline: MSP overdue at 10 minutes
    if (
      !this._mspDeadlineFired &&
      this.callTimerMs != null &&
      this.callTimerMs >= this.mspDeadlineMs &&
      this.scriptState &&
      !this.scriptState.covered?.includes("msp")
    ) {
      this._mspDeadlineFired = true;
      if (this.debouncer.tryFire("compliance_deadline")) {
        this._runSuggestion({
          kind: "compliance_deadline",
          summary: "MSP disclosure overdue — call passed 10 minutes without MSP coverage",
          item: { overdueItem: "msp", elapsedMs: this.callTimerMs },
        }).catch((err) =>
          this.log?.warn({ err: err.message }, "engine: compliance deadline suggestion failed")
        );
      }
    }

    // Unanswered client question (90s threshold)
    if (
      !this._unansweredFired &&
      this._lastClientQuestionTs != null
    ) {
      const elapsed = this.now() - this._lastClientQuestionTs;
      if (elapsed >= this.unansweredThresholdMs) {
        this._unansweredFired = true;
        const questionText = this._findLastClientQuestion();
        if (questionText && this.debouncer.tryFire("unanswered_question")) {
          this._runSuggestion({
            kind: "unanswered_question",
            summary: `Client question unanswered for ${Math.round(elapsed / 1000)}s`,
            item: { questionText, elapsedMs: elapsed },
          }).catch((err) =>
            this.log?.warn({ err: err.message }, "engine: unanswered question suggestion failed")
          );
        }
      }
    }
  }

  /** Find the last client question text from the transcript window. */
  _findLastClientQuestion() {
    for (let i = this.window.length - 1; i >= 0; i--) {
      const u = this.window[i];
      if (u.speaker !== "agent" && /[?]\s*$/.test(u.text.trim())) {
        return u.text;
      }
    }
    return null;
  }

  /**
   * Enrich a trigger with script-state context for out-of-order detection.
   * If the client asks about a topic but a prerequisite PECL item isn't
   * covered, upgrade the trigger to include the prerequisite.
   */
  _enrichTriggerWithScriptState(trigger) {
    if (!this.scriptState) return trigger;

    const { covered, requiredNext } = this.scriptState;
    if (!requiredNext || covered?.includes(requiredNext)) return trigger;

    // Out-of-order: client is asking about X but prerequisite Y isn't done
    if (trigger.kind === "medication" || trigger.kind === "provider" || trigger.kind === "question") {
      return {
        kind: "out_of_order",
        summary: `Client asks about ${trigger.kind} but prerequisite "${requiredNext}" not yet covered`,
        item: {
          originalTrigger: trigger,
          missingPrerequisite: requiredNext,
          coveredItems: covered || [],
        },
      };
    }
    return trigger;
  }

  /**
   * Mark any newly-covered PECL items and emit a `pecl_update`.
   * @param {string} text
   */
  _evaluatePECL(text) {
    const hits = matchPECL(text);
    if (!hits.length) return;
    const fresh = hits.map((h) => h.id).filter((id) => !this.peclMarked.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => this.peclMarked.add(id));
    this.emit({ type: "pecl_update", items: fresh });
  }

  /**
   * Open a Claude stream for a single trigger, fanning deltas out as
   * `suggestion_delta` events.
   * @param {{kind: string, summary: string, item?: any}} trigger
   */
  async _runSuggestion(trigger) {
    const id = nextId();
    this.emit({ type: "suggestion_start", id, kind: trigger.kind });
    try {
      await streamSuggestion(
        { client: this.client, model: this.model, log: this.log },
        {
          trigger,
          lead: this.lead,
          transcriptWindow: this.window.slice(),
          scriptState: this.scriptState,
          callTimerMs: this.callTimerMs,
          onJsonDelta: (delta) =>
            this.emit({ type: "suggestion_delta", id, kind: trigger.kind, delta }),
          onComplete: ({ suggestion }) =>
            this.emit({ type: "suggestion_done", id, kind: trigger.kind, suggestion }),
        }
      );
    } catch (err) {
      this.log?.error({ err: err.message, kind: trigger.kind }, "engine: suggestion stream failed");
      this.emit({
        type: "suggestion_error",
        id,
        kind: trigger.kind,
        code: "stream_failed",
        message: err.message,
      });
    }
  }

  dispose() {
    this.disposed = true;
    this.window.length = 0;
    this.peclMarked.clear();
    this.debouncer.reset();
  }
}
