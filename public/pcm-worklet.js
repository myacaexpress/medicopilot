/* global registerProcessor, sampleRate, AudioWorkletProcessor */
/**
 * AudioWorklet — downsample browser mic audio to 16 kHz mono Int16 PCM
 * and post 200 ms frames over the worklet's MessagePort.
 *
 * Mirrored from src/audio/pcm.js (decimateToInt16 / floatToPCM16). The
 * worklet has to be a self-contained file because AudioWorkletGlobalScope
 * can't `import` normal modules. If you change one, change the other.
 *
 * processorOptions:
 *   targetRate (number, default 16000)
 *   frameMs    (number, default 200)
 *
 * Each posted message is an ArrayBuffer of Int16LE samples that the
 * StreamSocket forwards to the server unchanged.
 */

class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    const o = (opts && opts.processorOptions) || {};
    this.targetRate = o.targetRate || 16000;
    this.frameMs = o.frameMs || 200;
    this.samplesPerFrame = Math.round((this.targetRate * this.frameMs) / 1000);
    this.buffer = new Int16Array(this.samplesPerFrame);
    this.bufferIndex = 0;
    this.position = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    const ratio = sampleRate / this.targetRate;
    while (this.position < channel.length) {
      const idx = Math.floor(this.position);
      const f = channel[idx];
      const c = f < -1 ? -1 : f > 1 ? 1 : f;
      this.buffer[this.bufferIndex++] =
        c < 0 ? Math.round(c * 0x8000) : Math.round(c * 0x7fff);
      if (this.bufferIndex >= this.samplesPerFrame) {
        const out = new Int16Array(this.buffer); // copy
        this.port.postMessage(out.buffer, [out.buffer]);
        this.bufferIndex = 0;
      }
      this.position += ratio;
    }
    this.position -= channel.length;
    return true;
  }
}

registerProcessor("pcm-worklet", PCMWorkletProcessor);
