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
export function useStreamSocket({ url, enabled = true }) {
  const [state, setState] = useState("disconnected");
  const [serverReady, setServerReady] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [lastError, setLastError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !url) return undefined;
    let socket;
    try {
      socket = new StreamSocket({ url });
    } catch (err) {
      // Synchronous failure — schedule the state update via the same
      // listener channel so it doesn't violate the
      // react-hooks/set-state-in-effect rule.
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

    socket.addEventListener("stateChange", onState);
    socket.addEventListener("ready", onReady);
    socket.addEventListener("utterance", onUtterance);
    socket.addEventListener("streamError", onError);
    socket.addEventListener("hello", onHello);

    socket.connect();

    return () => {
      socket.removeEventListener("stateChange", onState);
      socket.removeEventListener("ready", onReady);
      socket.removeEventListener("utterance", onUtterance);
      socket.removeEventListener("streamError", onError);
      socket.removeEventListener("hello", onHello);
      socket.disconnect();
      socketRef.current = null;
      // Cleanup-phase resets — necessary so toggling enabled=false (or
      // changing url) snaps the React-visible state back to defaults.
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
  const clearTranscripts = useCallback(() => setTranscripts([]), []);

  return {
    state,
    serverReady,
    transcripts,
    lastError,
    startAudio,
    stopAudio,
    sendFrame,
    clearTranscripts,
  };
}
