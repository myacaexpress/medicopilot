/**
 * Pure PCM helpers shared by the AudioWorklet processor and the test
 * suite. The worklet itself (public/pcm-worklet.js) is a copy of the
 * decimation logic below — it has to be a self-contained file because
 * AudioWorkletGlobalScope cannot import normal modules. If you change
 * one, change the other (and the test suite covers both).
 *
 * Wire format Tier 2 ships to the server:
 *   - Linear16 (Int16, signed, little-endian)
 *   - 16 kHz
 *   - Mono
 *   - 200 ms frames → 3200 samples → 6400 bytes per frame
 */

export const TARGET_SAMPLE_RATE = 16000;
export const FRAME_MS = 200;
export const SAMPLES_PER_FRAME = (TARGET_SAMPLE_RATE * FRAME_MS) / 1000; // 3200
export const BYTES_PER_FRAME = SAMPLES_PER_FRAME * 2; // 6400

/**
 * Convert a single Float32 sample (-1.0..1.0) to a clamped Int16 PCM
 * value. Asymmetric scaling matches the int16 range exactly: positive
 * values scale by 32767 (0x7FFF), negative by 32768 (0x8000).
 *
 * @param {number} f
 * @returns {number}
 */
export function floatToPCM16(f) {
  const c = f < -1 ? -1 : f > 1 ? 1 : f;
  return c < 0 ? Math.round(c * 0x8000) : Math.round(c * 0x7fff);
}

/**
 * Decimate a Float32 buffer at `sourceRate` to `targetRate` Int16 PCM.
 * Nearest-neighbour resampling — adequate for speech at 16 kHz (Nyquist
 * = 8 kHz, well above the 4 kHz speech band) and avoids the latency of
 * a polyphase filter. State is carried between calls via the returned
 * `position` so cross-block alignment doesn't drift.
 *
 * @param {Float32Array} samples       input audio at sourceRate
 * @param {number} sourceRate          e.g. 48000 or 44100
 * @param {number} targetRate          e.g. 16000
 * @param {{ position?: number }} [state]
 * @returns {{ samples: Int16Array, state: { position: number } }}
 */
export function decimateToInt16(samples, sourceRate, targetRate, state) {
  const ratio = sourceRate / targetRate;
  const out = [];
  let pos = state?.position ?? 0;
  while (pos < samples.length) {
    const idx = Math.floor(pos);
    out.push(floatToPCM16(samples[idx]));
    pos += ratio;
  }
  pos -= samples.length;
  return { samples: new Int16Array(out), state: { position: pos } };
}

/**
 * Validate a binary frame destined for the server. Used by the
 * StreamSocket before sending and (via the matching server-side
 * check) by the route on receive.
 *
 * @param {ArrayBuffer|ArrayBufferView} frame
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validatePCMFrame(frame) {
  const byteLength = frame.byteLength ?? frame.length ?? 0;
  if (byteLength === 0) return { ok: false, reason: "empty" };
  if (byteLength % 2 !== 0) {
    return { ok: false, reason: `odd byte length ${byteLength} (Int16 must be even)` };
  }
  return { ok: true };
}
