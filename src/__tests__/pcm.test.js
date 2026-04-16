/**
 * Tests for the pure PCM helpers in src/audio/pcm.js. The AudioWorklet
 * (public/pcm-worklet.js) ships a copy of the same decimation/scaling
 * logic — keep this file and that file in sync.
 */
import { describe, it, expect } from "vitest";
import {
  TARGET_SAMPLE_RATE,
  FRAME_MS,
  SAMPLES_PER_FRAME,
  BYTES_PER_FRAME,
  floatToPCM16,
  decimateToInt16,
  validatePCMFrame,
} from "../audio/pcm.js";

describe("constants", () => {
  it("derive frame sizes from target rate × frame duration", () => {
    expect(TARGET_SAMPLE_RATE).toBe(16000);
    expect(FRAME_MS).toBe(200);
    expect(SAMPLES_PER_FRAME).toBe(3200);
    expect(BYTES_PER_FRAME).toBe(6400);
  });
});

describe("floatToPCM16", () => {
  it("maps 0 → 0", () => {
    expect(floatToPCM16(0)).toBe(0);
  });
  it("maps +1.0 → 0x7FFF", () => {
    expect(floatToPCM16(1)).toBe(0x7fff);
  });
  it("maps -1.0 → -0x8000 (full negative range)", () => {
    expect(floatToPCM16(-1)).toBe(-0x8000);
  });
  it("clamps values above +1", () => {
    expect(floatToPCM16(2.5)).toBe(0x7fff);
  });
  it("clamps values below -1", () => {
    expect(floatToPCM16(-2.5)).toBe(-0x8000);
  });
  it("scales mid-range values", () => {
    expect(floatToPCM16(0.5)).toBe(Math.round(0.5 * 0x7fff));
    expect(floatToPCM16(-0.5)).toBe(Math.round(-0.5 * 0x8000));
  });
});

describe("decimateToInt16", () => {
  it("downsamples 48kHz → 16kHz at 3:1 (input length determines output)", () => {
    // A constant signal — every output sample should equal the input value.
    const input = new Float32Array(48); // 48 samples @ 48k = 1ms
    input.fill(0.5);
    const { samples, state } = decimateToInt16(input, 48000, 16000);
    expect(samples.length).toBe(16); // 48 / 3
    samples.forEach((s) => expect(s).toBe(Math.round(0.5 * 0x7fff)));
    // After processing, position should be carried over (here 0).
    expect(state.position).toBeCloseTo(0, 5);
  });

  it("preserves cross-block alignment via carried position state", () => {
    // Two consecutive 7-sample blocks at 48k → 16k. Without state, the
    // second block would re-start from position 0 and miss alignment.
    const a = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
    const b = new Float32Array([0.8, 0.9, 1.0, 0.0, -0.1, -0.2, -0.3]);
    const r1 = decimateToInt16(a, 48000, 16000);
    const r2 = decimateToInt16(b, 48000, 16000, r1.state);
    // Total input = 14 samples → ~14/3 ≈ 4-5 outputs combined; the state
    // must have carried a fractional position so r2 doesn't start at idx=0.
    const combined = new Float32Array(14);
    combined.set(a, 0);
    combined.set(b, 7);
    const direct = decimateToInt16(combined, 48000, 16000);
    const stitched = new Int16Array(r1.samples.length + r2.samples.length);
    stitched.set(r1.samples, 0);
    stitched.set(r2.samples, r1.samples.length);
    expect(stitched).toEqual(direct.samples);
  });

  it("handles 1:1 (no decimation)", () => {
    const input = new Float32Array([0, 0.25, -0.25, 1, -1]);
    const { samples } = decimateToInt16(input, 16000, 16000);
    expect(samples.length).toBe(5);
    expect(samples[0]).toBe(0);
    expect(samples[3]).toBe(0x7fff);
    expect(samples[4]).toBe(-0x8000);
  });
});

describe("validatePCMFrame", () => {
  it("accepts an even-length ArrayBuffer", () => {
    const buf = new ArrayBuffer(BYTES_PER_FRAME);
    expect(validatePCMFrame(buf)).toEqual({ ok: true });
  });
  it("accepts an Int16Array view", () => {
    const view = new Int16Array(SAMPLES_PER_FRAME);
    expect(validatePCMFrame(view)).toEqual({ ok: true });
  });
  it("rejects empty buffers", () => {
    expect(validatePCMFrame(new ArrayBuffer(0)).ok).toBe(false);
  });
  it("rejects odd-length buffers", () => {
    const buf = new ArrayBuffer(7);
    const r = validatePCMFrame(buf);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/odd byte length/);
  });
});
