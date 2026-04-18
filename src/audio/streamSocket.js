/**
 * StreamSocket — WSS client for the live-call pipeline.
 *
 * Responsibilities:
 *   1. Maintain a WebSocket to /stream with exponential-backoff reconnect
 *   2. Send `start` / `stop` control messages on demand
 *   3. Buffer outgoing audio frames in a 30s ring buffer; drain to the
 *      socket as soon as the server emits `ready`
 *   4. On reconnect, automatically re-send `start` (if audio was active)
 *      and replay the buffer — so a flap doesn't lose audio context
 *
 * EventTarget surface:
 *   "stateChange"     { detail: "disconnected"|"connecting"|"connected"|"reconnecting" }
 *   "hello"           { detail: { type, sessionId, serverTime } }
 *   "ready"           { detail: { type, sessionId } }
 *   "utterance"       { detail: { type, final, speaker, text, ts, redactionCounts } }
 *   "suggestion"      { detail: { phase: "start"|"delta"|"done"|"error", id, kind, ... } }
 *   "peclUpdate"      { detail: { items: PeclItemId[] } }
 *   "streamError"     { detail: { type:"error", code, message } }
 *
 * The class is designed to be testable: the WebSocket constructor is
 * injectable via the `WebSocketImpl` option so tests can simulate
 * disconnects, message arrival, and reconnects without a real network.
 */

import { validatePCMFrame, FRAME_MS } from "./pcm.js";

export const DEFAULT_BUFFER_DURATION_MS = 30_000;
export const DEFAULT_MAX_BACKOFF_MS = 30_000;
export const DEFAULT_BASE_BACKOFF_MS = 1_000;

export class StreamSocket extends EventTarget {
  /**
   * @param {Object} opts
   * @param {string} opts.url
   * @param {number} [opts.frameMs]
   * @param {number} [opts.bufferDurationMs]
   * @param {number} [opts.baseBackoffMs]
   * @param {number} [opts.maxBackoffMs]
   * @param {typeof WebSocket} [opts.WebSocketImpl]
   * @param {(fn: () => void, ms: number) => any} [opts.setTimeoutImpl]
   * @param {(handle: any) => void}                [opts.clearTimeoutImpl]
   */
  constructor(opts) {
    super();
    if (!opts?.url) throw new Error("StreamSocket: url is required");
    this.url = opts.url;
    this.frameMs = opts.frameMs ?? FRAME_MS;
    this.bufferDurationMs = opts.bufferDurationMs ?? DEFAULT_BUFFER_DURATION_MS;
    this.baseBackoffMs = opts.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
    this.maxBackoffMs = opts.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.maxBufferFrames = Math.ceil(this.bufferDurationMs / this.frameMs);
    this.WebSocketImpl =
      opts.WebSocketImpl ??
      (typeof WebSocket !== "undefined" ? WebSocket : null);
    this.setTimeoutImpl = opts.setTimeoutImpl ?? setTimeout;
    this.clearTimeoutImpl = opts.clearTimeoutImpl ?? clearTimeout;

    if (!this.WebSocketImpl) {
      throw new Error("StreamSocket: no WebSocket implementation available");
    }

    /** @type {WebSocket|null} */
    this.ws = null;
    this.state = "disconnected";
    this.attempt = 0;
    this.reconnectHandle = null;
    this.shouldReconnect = false;
    this.audioActive = false;
    this.serverReady = false;
    this._startSent = false;
    /** @type {Array<ArrayBuffer>} ring buffer of outgoing frames */
    this.frameBuffer = [];
    this.lastSessionId = null;
    /** Latest lead snapshot — re-sent to the server on reconnect. */
    this.lastLead = null;
    /** Total frames dropped because the buffer was full (telemetry). */
    this.droppedFrames = 0;
  }

  // ─────────── public API ───────────

  /** Open the socket and keep it open until `disconnect()` is called. */
  connect() {
    this.shouldReconnect = true;
    if (this.state === "connected" || this.state === "connecting") return;
    this._open();
  }

  /** Close the socket. Cancels any pending reconnect. */
  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectHandle != null) {
      this.clearTimeoutImpl(this.reconnectHandle);
      this.reconnectHandle = null;
    }
    if (this.ws) {
      try {
        // Best-effort graceful signal — server logs it nicely.
        this.ws.send(JSON.stringify({ type: "bye" }));
      } catch {
        // ignore — the socket may already be closing
      }
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
    this.audioActive = false;
    this.serverReady = false;
    this._startSent = false;
    this.frameBuffer = [];
    this._setState("disconnected");
  }

  /** Tell the server to open a Deepgram session. Idempotent. */
  startAudio() {
    this.audioActive = true;
    if (this.state === "connected" && !this.serverReady && !this._startSent) {
      this._startSent = true;
      this._safeSend(JSON.stringify({ type: "start" }));
    }
  }

  /** Tell the server to close the Deepgram session. */
  stopAudio() {
    this.audioActive = false;
    this.serverReady = false;
    this._startSent = false;
    this.frameBuffer = [];
    if (this.state === "connected") {
      this._safeSend(JSON.stringify({ type: "stop" }));
    }
  }

  /**
   * Send the current lead snapshot to the server. The server uses it
   * as Claude prompt context. Caller is responsible for shape; we just
   * pass it through. Send `null` to clear.
   * @param {object|null} lead
   */
  setLeadContext(lead) {
    this.lastLead = lead ?? null;
    if (this.state === "connected") {
      this._safeSend(JSON.stringify({ type: "lead_context", lead: this.lastLead }));
    }
  }

  /** Explicitly request a suggestion from the server ("Ask AI"). */
  requestSuggestion() {
    if (this.state !== "connected") {
      this.dispatchEvent(
        new CustomEvent("streamError", {
          detail: {
            type: "error",
            code: "not_connected",
            message: "Not connected to server — try again in a moment",
          },
        })
      );
      return;
    }
    this._safeSend(JSON.stringify({ type: "request_suggestion" }));
  }

  /**
   * Tell the server to flip the agent/client speaker mapping.
   */
  recalibrateSpeakers() {
    if (this.state === "connected") {
      this._safeSend(JSON.stringify({ type: "recalibrate_speakers" }));
    }
  }

  setTrainingMode(enabled) {
    if (this.state === "connected") {
      this._safeSend(JSON.stringify({ type: "set_training_mode", enabled: !!enabled }));
    }
  }

  setPttState(speaking) {
    if (this.state === "connected") {
      this._safeSend(JSON.stringify({ type: "ptt_state", speaking: !!speaking }));
    }
  }

  setTrainingScenario(scenarioId) {
    if (this.state === "connected") {
      this._safeSend(JSON.stringify({ type: "set_training_scenario", scenarioId }));
    }
  }

  /**
   * Enqueue a PCM frame. Validates length, buffers if the socket isn't
   * ready yet, otherwise writes immediately.
   * @param {ArrayBuffer|ArrayBufferView} frame
   */
  sendFrame(frame) {
    const v = validatePCMFrame(frame);
    if (!v.ok) {
      this.dispatchEvent(
        new CustomEvent("streamError", {
          detail: { type: "error", code: "bad_frame", message: v.reason },
        })
      );
      return;
    }
    const buf = frame instanceof ArrayBuffer ? frame : frame.buffer.slice(0);
    if (this.frameBuffer.length >= this.maxBufferFrames) {
      // Drop the oldest frame; the 30s window slides forward.
      this.frameBuffer.shift();
      this.droppedFrames += 1;
    }
    this.frameBuffer.push(buf);
    this._flushFrames();
  }

  /** Number of frames currently buffered (visible for tests + telemetry). */
  bufferedFrameCount() {
    return this.frameBuffer.length;
  }

  // ─────────── internals ───────────

  _open() {
    this._setState("connecting");
    let ws;
    try {
      ws = new this.WebSocketImpl(this.url);
    } catch (err) {
      this._handleSocketDeath(err);
      return;
    }
    if ("binaryType" in ws) ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this._setState("connected");
      this.attempt = 0;
      // Re-issue start on reconnect if audio is still active.
      if (this.audioActive) {
        this._startSent = true;
        this._safeSend(JSON.stringify({ type: "start" }));
      }
      // Re-send the lead snapshot so a flap doesn't lose Claude context.
      if (this.lastLead) {
        this._safeSend(JSON.stringify({ type: "lead_context", lead: this.lastLead }));
      }
    };
    ws.onmessage = (ev) => this._onMessage(ev);
    ws.onclose = () => this._handleSocketDeath();
    ws.onerror = () => {
      // onclose follows; reconnect logic is centralised there.
    };
  }

  _onMessage(ev) {
    const data = ev.data;
    if (typeof data !== "string") return; // unexpected binary; ignore
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "hello":
        this.lastSessionId = msg.sessionId;
        this.dispatchEvent(new CustomEvent("hello", { detail: msg }));
        return;
      case "ready":
        this.serverReady = true;
        this.dispatchEvent(new CustomEvent("ready", { detail: msg }));
        this._flushFrames();
        return;
      case "utterance":
        this.dispatchEvent(new CustomEvent("utterance", { detail: msg }));
        return;
      case "suggestion_start":
        this.dispatchEvent(
          new CustomEvent("suggestion", { detail: { ...msg, phase: "start" } })
        );
        return;
      case "suggestion_delta":
        this.dispatchEvent(
          new CustomEvent("suggestion", { detail: { ...msg, phase: "delta" } })
        );
        return;
      case "suggestion_done":
        this.dispatchEvent(
          new CustomEvent("suggestion", { detail: { ...msg, phase: "done" } })
        );
        return;
      case "suggestion_error":
        this.dispatchEvent(
          new CustomEvent("suggestion", { detail: { ...msg, phase: "error" } })
        );
        return;
      case "pecl_update":
        this.dispatchEvent(new CustomEvent("peclUpdate", { detail: msg }));
        return;
      case "speakers_recalibrated":
        this.dispatchEvent(new CustomEvent("speakersRecalibrated", { detail: msg }));
        return;
      case "pong":
        return; // ignore
      case "error":
        this.dispatchEvent(new CustomEvent("streamError", { detail: msg }));
        return;
      default:
        // Unknown — surface for visibility; a newer server may send
        // newer types we don't yet model.
        this.dispatchEvent(new CustomEvent("message", { detail: msg }));
    }
  }

  _handleSocketDeath() {
    this.serverReady = false;
    this._startSent = false;
    this.ws = null;
    if (!this.shouldReconnect) {
      this._setState("disconnected");
      return;
    }
    this.attempt += 1;
    const delay = Math.min(
      this.maxBackoffMs,
      this.baseBackoffMs * 2 ** (this.attempt - 1)
    );
    this._setState("reconnecting");
    this.reconnectHandle = this.setTimeoutImpl(() => {
      this.reconnectHandle = null;
      this._open();
    }, delay);
  }

  _flushFrames() {
    if (this.state !== "connected" || !this.serverReady || !this.ws) return;
    while (this.frameBuffer.length > 0) {
      const buf = this.frameBuffer.shift();
      try {
        this.ws.send(buf);
      } catch {
        // Re-queue and bail out — socket likely just died.
        this.frameBuffer.unshift(buf);
        return;
      }
    }
  }

  _safeSend(payload) {
    if (!this.ws) return;
    try {
      this.ws.send(payload);
    } catch {
      // no-op — onclose will trigger reconnect
    }
  }

  _setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.dispatchEvent(new CustomEvent("stateChange", { detail: s }));
  }
}
