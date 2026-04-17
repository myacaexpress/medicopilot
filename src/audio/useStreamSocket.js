/**
 * React hook wrapper around StreamSocket.
 *
 * Owns the connection lifetime (open on mount when `url` is set,
 * close on unmount) and surfaces:
 *   - `state`: connection state ("disconnected"|"connecting"|"connected"|"reconnecting")
 *   - `serverReady`: whether the server has emitted `ready` (Deepgram up)
 *   - `transcripts`: ordered list of utterance frames received
 *   - `lastError`: latest stream-level error message from the server
 *   - imperative actions: `startAudio`, `stopAudio`, `sendFrame`
 *
 * The transcript list is the live source-of-truth that replaces the
 * static demo lines from src/data/transcript.js.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { StreamSocket } from "./streamSocket.js";

/**
 * @param {Object} opts
 * @param {string|null|undefined} opts.url
 * @param {boolean} [opts.enabled]
 */
/**
 * @typedef {Object} LiveSuggestion
 * @property {string} id
 * @property {string} kind
 * @property {"streaming"|"done"|"error"} status
 * @property {string} buffer                       accumulated JSON deltas
 * @property {object|null} suggestion              parsed AIResponse on done
 * @property {string|null} errorMessage
 * @property {number} updatedAt
 */

const MAX_LIVE_SUGGESTIONS = 20;

export function useStreamSocket({ url, enabled = true }) {
  const [state, setState] = useState("disconnected");
  const [serverReady, setServerReady] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [lastError, setLastError] = useState(null);
  /** @type {[LiveSuggestion[], Function]} */
  const [suggestions, setSuggestions] = useState([]);
  /** @type {[Set<string>, Function]} */
  const [autoPecl, setAutoPecl] = useState(() => new Set());
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !url) return undefined;
    let socket;
    try {
      socket = new StreamSocket({ url });
    } catch (err) {
      const errPayload = { code: "init_failed", message: err.message };
      queueMicrotask(() => setLastError(errPayload));
      return undefined;
    }
    socketRef.current = socket;

    const onState = (e) => setState(e.detail);
    const onReady = () => setServerReady(true);
    const onUtterance = (e) =>
      setTranscripts((prev) => [...prev, e.detail]);
    const onError = (e) => setLastError(e.detail);
    const onHello = () => setServerReady(false);

    const onSuggestion = (e) => {
      const msg = e.detail;
      setSuggestions((prev) => {
        const idx = prev.findIndex((s) => s.id === msg.id);
        const now = Date.now();
        const next = idx >= 0 ? [...prev] : [...prev];
        const base = idx >= 0
          ? next[idx]
          : {
              id: msg.id,
              kind: msg.kind,
              status: "streaming",
              buffer: "",
              suggestion: null,
              errorMessage: null,
              updatedAt: now,
            };
        let updated = base;
        if (msg.phase === "start") {
          updated = { ...base, status: "streaming", updatedAt: now };
        } else if (msg.phase === "delta") {
          updated = { ...base, buffer: base.buffer + (msg.delta ?? ""), updatedAt: now };
        } else if (msg.phase === "done") {
          updated = { ...base, status: "done", suggestion: msg.suggestion, updatedAt: now };
        } else if (msg.phase === "error") {
          updated = {
            ...base,
            status: "error",
            errorMessage: msg.message ?? "Suggestion failed",
            updatedAt: now,
          };
        }
        if (idx >= 0) next[idx] = updated;
        else next.push(updated);
        // Keep bounded — drop the oldest if we exceed the cap.
        return next.length > MAX_LIVE_SUGGESTIONS
          ? next.slice(next.length - MAX_LIVE_SUGGESTIONS)
          : next;
      });
    };

    const onPecl = (e) => {
      const items = Array.isArray(e.detail?.items) ? e.detail.items : [];
      if (!items.length) return;
      setAutoPecl((prev) => {
        const next = new Set(prev);
        items.forEach((id) => next.add(id));
        return next;
      });
    };

    socket.addEventListener("stateChange", onState);
    socket.addEventListener("ready", onReady);
    socket.addEventListener("utterance", onUtterance);
    socket.addEventListener("streamError", onError);
    socket.addEventListener("hello", onHello);
    socket.addEventListener("suggestion", onSuggestion);
    socket.addEventListener("peclUpdate", onPecl);

    socket.connect();

    return () => {
      socket.removeEventListener("stateChange", onState);
      socket.removeEventListener("ready", onReady);
      socket.removeEventListener("utterance", onUtterance);
      socket.removeEventListener("streamError", onError);
      socket.removeEventListener("hello", onHello);
      socket.removeEventListener("suggestion", onSuggestion);
      socket.removeEventListener("peclUpdate", onPecl);
      socket.disconnect();
      socketRef.current = null;
      setState("disconnected");
      setServerReady(false);
    };
  }, [url, enabled]);

  const startAudio = useCallback(() => socketRef.current?.startAudio(), []);
  const stopAudio = useCallback(() => socketRef.current?.stopAudio(), []);
  const sendFrame = useCallback(
    /** @param {ArrayBuffer|ArrayBufferView} buf */
    (buf) => socketRef.current?.sendFrame(buf),
    []
  );
  const setLeadContext = useCallback(
    (lead) => socketRef.current?.setLeadContext(lead),
    []
  );
  const requestSuggestion = useCallback(
    () => socketRef.current?.requestSuggestion(),
    []
  );
  const clearTranscripts = useCallback(() => setTranscripts([]), []);
  const clearSuggestions = useCallback(() => setSuggestions([]), []);

  return {
    state,
    serverReady,
    transcripts,
    lastError,
    suggestions,
    autoPecl,
    startAudio,
    stopAudio,
    sendFrame,
    setLeadContext,
    requestSuggestion,
    clearTranscripts,
    clearSuggestions,
  };
}
