/**
 * mockMediaDevices — installs deterministic stubs for
 * navigator.mediaDevices.getUserMedia (silent 16kHz mono) and
 * getDisplayMedia (a solid-color canvas capture stream).
 *
 * Runs in the browser via page.addInitScript before any app code.
 * Call installMediaMocks(page) from a test or fixture.
 */

export async function installMediaMocks(page) {
  await page.addInitScript(() => {
    const makeSilentAudioTrack = () => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      const oscillator = ctx.createOscillator();
      oscillator.frequency.value = 0;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const dest = ctx.createMediaStreamDestination();
      oscillator.connect(gain).connect(dest);
      oscillator.start();
      return dest.stream.getAudioTracks()[0];
    };

    const makeColorVideoTrack = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#1a9ea2";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px sans-serif";
      ctx.fillText("MOCK SCREEN", 20, 60);
      const stream = canvas.captureStream(10);
      return stream.getVideoTracks()[0];
    };

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        configurable: true,
      });
    }

    navigator.mediaDevices.getUserMedia = async () => {
      const stream = new MediaStream();
      stream.addTrack(makeSilentAudioTrack());
      return stream;
    };

    navigator.mediaDevices.getDisplayMedia = async () => {
      const stream = new MediaStream();
      stream.addTrack(makeColorVideoTrack());
      return stream;
    };

    // Force ImageCapture fallback path — the hook uses the
    // video-element fallback if ImageCapture is unavailable, which is
    // more reliable to drive from a canvas-backed track.
    try {
      delete window.ImageCapture;
    } catch {
      // ignore
    }
  });
}
