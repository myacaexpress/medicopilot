/**
 * Per-session suggestion engine.
 *
 * Owns:
 *   - the rolling 120s transcript window
 *   - the lead-context snapshot (set by the client via lead_context msg)
 *   - the per-trigger-kind debouncer
 *   - the in-flight Claude stream (if any)
 *
 * Lifecycle:
 *   const engine = new SuggestionEngine({ ... });
 *   engine.setLead(lead);
 *   engine.ingestUtterance({ speaker, text, ts });
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
 * @typedef {Object} EngineDeps
 * @property {object} client                Anthropic client (or stub)
 * @property {string} model
 * @property {import("pino").Logger} [log]
 * @property {(event: EngineEvent) => void} emit
 * @property {() => Promise<boolean>} [haikuClassify]   optional Haiku question fallback
 * @property {Object} [opts]
 * @property {number} [opts.windowMs=120000]
 * @property {number} [opts.cooldownMs=8000]
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
    this.now = opts.now ?? (() => Date.now());

    /** @type {Array<{speaker: string, text: string, ts: number}>} */
    this.window = [];
    /** @type {Object|null} */
    this.lead = null;
    this.debouncer = new Debouncer({ cooldownMs: opts.cooldownMs ?? 8_000, now: this.now });
    /** @type {Set<string>} PECL ids already auto-marked this session. */
    this.peclMarked = new Set();
    this.disposed = false;
  }

  /** @param {Object|null} lead */
  setLead(lead) {
    this.lead = lead ?? null;
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

    // PECL auto-coverage runs on every utterance — independent of the
    // trigger debouncer, since the agent UI shows the live checklist.
    this._evaluatePECL(u.text);

    let trigger;
    try {
      trigger = await classifyUtterance(u.text, { haikuClassify: this.haikuClassify });
    } catch (err) {
      this.log?.warn({ err: err.message }, "engine: classify error");
      return;
    }
    if (!trigger) return;
    if (!this.debouncer.tryFire(trigger.kind)) {
      this.log?.debug({ kind: trigger.kind }, "engine: debounced");
      return;
    }

    await this._runSuggestion(trigger);
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

  dispose() {
    this.disposed = true;
    this.window.length = 0;
    this.peclMarked.clear();
    this.debouncer.reset();
  }
}
