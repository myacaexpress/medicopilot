/**
 * useLiveAudio — composes useStreamSocket + useMicCapture into the
 * one hook the UI needs:
 *
 *   const { active, transcripts, analyser, ... } = useLiveAudio({ url, enabled });
 *
 * When `enabled` is true:
 *   1. Open WSS
 *   2. Open mic
 *   3. Tell server to start a Deepgram session
 *   4. Frames flow mic → worklet → socket → server → Deepgram
 *   5. Utterances flow back, redacted, into `transcripts`
 *
 * When `enabled` flips false, mic + socket tear down cleanly and the
 * UI falls back to the demo transcript.
 */

import { useEffect } from "react";
import { useStreamSocket } from "./useStreamSocket.js";
import { useMicCapture } from "./useMicCapture.js";

/**
 * @param {Object} opts
 * @param {string|null|undefined} opts.url
 * @param {boolean} opts.enabled
 */
export function useLiveAudio({ url, enabled }) {
  const socket = useStreamSocket({ url, enabled });
  const mic = useMicCapture({
    active: enabled,
    onFrame: socket.sendFrame,
  });

  // Tell the server to open / close its Deepgram session whenever the
  // mic transitions in or out of "running". The socket itself handles
  // reconnect-and-replay; this hook only needs to signal start/stop.
  useEffect(() => {
    if (!enabled) {
      socket.stopAudio();
      return;
    }
    if (mic.state === "running") {
      socket.startAudio();
    }
    return () => {
      // No teardown action — the socket effect handles disconnect.
    };
  }, [enabled, mic.state, socket]);

  const live = enabled && mic.state === "running" && socket.serverReady;
  const noKeyError = socket.lastError?.code === "no_api_key";

  return {
    enabled,
    live,
    socketState: socket.state,
    serverReady: socket.serverReady,
    micState: mic.state,
    micError: mic.error,
    streamError: socket.lastError,
    noKeyError,
    analyser: mic.analyser,
    transcripts: socket.transcripts,
    suggestions: socket.suggestions,
    isAiThinking: socket.isAiThinking,
    autoPecl: socket.autoPecl,
    setLeadContext: socket.setLeadContext,
    requestSuggestion: socket.requestSuggestion,
    clearTranscripts: socket.clearTranscripts,
    clearSuggestions: socket.clearSuggestions,
    recalibrateSpeakers: socket.recalibrateSpeakers,
    setTrainingMode: socket.setTrainingMode,
    setTrainingSession: socket.setTrainingSession,
    setPttState: socket.setPttState,
    setTrainingScenario: socket.setTrainingScenario,
  };
}
