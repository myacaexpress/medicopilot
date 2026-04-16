/**
 * Deepgram Nova-3 streaming client.
 *
 * One Deepgram WebSocket per browser session. The session opens it
 * when the client sends `{ type: "start" }`, forwards each binary
 * audio frame via `sendAudio`, and closes it when the client sends
 * `{ type: "stop" }` or disconnects.
 *
 * Wire is linear16 PCM, mono, 16 kHz — matches what the browser
 * AudioWorklet ships. See public/pcm-worklet.js for the producer.
 *
 * Tier 2 only emits *finalised* utterances upstream — interim
 * results are enabled in Deepgram so it can stabilise its segmenter,
 * but we don't render them in the UI yet.
 */

import WebSocket from "ws";

const DEEPGRAM_BASE = "wss://api.deepgram.com/v1/listen";

/**
 * Construct the Deepgram listen-WS URL. Public to enable testing.
 *
 * @param {{ sampleRate?: number, language?: string }} [opts]
 */
export function buildDeepgramUrl(opts = {}) {
  const params = new URLSearchParams({
    model: "nova-3",
    encoding: "linear16",
    sample_rate: String(opts.sampleRate ?? 16000),
    channels: "1",
    diarize: "true",
    utterance_end_ms: "1000",
    interim_results: "true",
    smart_format: "true",
    language: opts.language ?? "en-US",
  });
  return `${DEEPGRAM_BASE}?${params.toString()}`;
}

/**
 * @typedef {Object} DeepgramSession
 * @property {(bytes: Buffer|ArrayBuffer|Uint8Array) => void} sendAudio
 * @property {() => void} close
 * @property {() => boolean} isOpen
 * @property {Promise<void>} readyPromise
 *
 * @typedef {Object} DeepgramFactoryOpts
 * @property {string} apiKey
 * @property {number} [sampleRate]
 * @property {import("pino").Logger} log
 * @property {(u: { text: string, isFinal: boolean, speaker: number, ts: number, words: Array<{word:string,start:number,end:number,speaker:number}> }) => void} onUtterance
 * @property {(err: Error) => void} [onError]
 * @property {(code: number, reason: string) => void} [onClose]
 */

/**
 * Default factory: opens a real Deepgram WS connection.
 *
 * @param {DeepgramFactoryOpts} opts
 * @returns {DeepgramSession}
 */
export function createDeepgramSession(opts) {
  const { apiKey, log, sampleRate, onUtterance, onError, onClose } = opts;
  if (!apiKey) {
    throw new Error("createDeepgramSession: apiKey is required");
  }

  const url = buildDeepgramUrl({ sampleRate });
  const ws = new WebSocket(url, {
    headers: { Authorization: `Token ${apiKey}` },
    perMessageDeflate: false,
  });

  let opened = false;
  const readyPromise = new Promise((resolve, reject) => {
    ws.once("open", () => {
      opened = true;
      log.info("deepgram: connected");
      resolve();
    });
    ws.once("error", (err) => {
      if (!opened) reject(err);
    });
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      log.warn({ err }, "deepgram: non-JSON message");
      return;
    }
    handleDeepgramMessage(msg, { onUtterance, log });
  });

  ws.on("error", (err) => {
    log.error({ err: err.message }, "deepgram: socket error");
    onError?.(err);
  });

  ws.on("close", (code, reason) => {
    log.info({ code, reason: reason?.toString() }, "deepgram: closed");
    onClose?.(code, reason?.toString() ?? "");
  });

  return {
    sendAudio(bytes) {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(bytes, { binary: true });
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "CloseStream" }));
        } catch {
          // ignore — closing anyway
        }
      }
      ws.close();
    },
    isOpen() {
      return ws.readyState === WebSocket.OPEN;
    },
    readyPromise,
  };
}

/**
 * Pure interpreter for Deepgram payloads. Public for testing — a unit
 * test can feed in a known JSON payload and assert that `onUtterance`
 * gets called with the expected shape.
 *
 * @param {any} msg                          one parsed Deepgram message
 * @param {{ onUtterance: Function, log?: { warn: Function } }} ctx
 */
export function handleDeepgramMessage(msg, { onUtterance, log }) {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "Results") {
    const alt = msg.channel?.alternatives?.[0];
    const transcript = alt?.transcript;
    if (!transcript) return;
    if (!msg.is_final) return; // Tier 2: only forward finalised utterances
    const words = Array.isArray(alt.words) ? alt.words : [];
    const speaker = words[0]?.speaker ?? 0;
    const ts = typeof msg.start === "number" ? msg.start : 0;
    onUtterance({
      text: transcript,
      isFinal: true,
      speaker,
      ts,
      words: words.map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        speaker: w.speaker ?? 0,
      })),
    });
    return;
  }
  if (msg.type === "Metadata" || msg.type === "UtteranceEnd" || msg.type === "SpeechStarted") {
    return; // ignored in Tier 2
  }
  if (msg.error || msg.type === "Error") {
    log?.warn?.({ msg }, "deepgram: error frame");
  }
}
