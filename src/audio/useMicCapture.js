/**
 * useMicCapture — open the browser mic and route it through:
 *
 *   getUserMedia → MediaStreamSource ─┬─ AnalyserNode (for AudioWave)
 *                                     └─ AudioWorkletNode → onFrame
 *
 * The AudioWorklet (public/pcm-worklet.js) is the producer; the hook
 * owns the AudioContext and tears everything down cleanly on unmount.
 *
 * `onFrame` is captured via a ref so changing the callback identity
 * doesn't tear down and re-open the mic (which would prompt the user
 * again on some browsers).
 */

import { useEffect, useRef, useState } from "react";
import { TARGET_SAMPLE_RATE, FRAME_MS } from "./pcm.js";

const WORKLET_URL = "/pcm-worklet.js";

/**
 * @param {Object} opts
 * @param {boolean} opts.active
 * @param {(frame: ArrayBuffer) => void} [opts.onFrame]
 * @param {number} [opts.targetRate]
 * @param {number} [opts.frameMs]
 */
export function useMicCapture({ active, onFrame, targetRate = TARGET_SAMPLE_RATE, frameMs = FRAME_MS }) {
  const [state, setState] = useState("idle"); // idle | starting | running | error
  const [error, setError] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!active) return undefined;
    // Guard: not in a browser environment (e.g. SSR / vitest jsdom).
    // Schedule via microtask so the state update happens after this
    // effect body returns (avoids react-hooks/set-state-in-effect).
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      queueMicrotask(() => {
        setError(new Error("getUserMedia not available"));
        setState("error");
      });
      return undefined;
    }

    let cancelled = false;
    let stream = null;
    let ctx = null;
    let src = null;
    let analyserNode = null;
    let workletNode = null;

    const teardown = () => {
      try { workletNode?.port?.close?.(); } catch { /* noop */ }
      try { workletNode?.disconnect(); } catch { /* noop */ }
      try { analyserNode?.disconnect(); } catch { /* noop */ }
      try { src?.disconnect(); } catch { /* noop */ }
      try { ctx?.close(); } catch { /* noop */ }
      try { stream?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    };

    (async () => {
      setState("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        if (cancelled) return;

        const Ctx = window.AudioContext || window.webkitAudioContext;
        ctx = new Ctx();
        await ctx.audioWorklet.addModule(WORKLET_URL);
        if (cancelled) return;

        src = ctx.createMediaStreamSource(stream);
        analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 128;
        analyserNode.smoothingTimeConstant = 0.6;

        workletNode = new AudioWorkletNode(ctx, "pcm-worklet", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          processorOptions: { targetRate, frameMs },
        });
        workletNode.port.onmessage = (ev) => {
          // ev.data is the transferred ArrayBuffer of Int16LE samples.
          const cb = onFrameRef.current;
          if (cb) cb(ev.data);
        };

        src.connect(analyserNode);
        src.connect(workletNode);
        // Don't connect workletNode to ctx.destination — we never want
        // to play the captured mic back to the agent's speakers.

        if (cancelled) return;
        setAnalyser(analyserNode);
        setState("running");
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setState("error");
        }
        teardown();
      }
    })();

    return () => {
      cancelled = true;
      teardown();
      setAnalyser(null);
      setState("idle");
    };
  }, [active, targetRate, frameMs]);

  return { state, error, analyser };
}
