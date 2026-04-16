/**
 * useScreenCapture — hook wrapping getDisplayMedia + OffscreenCanvas frame grab.
 *
 * Provides: requestCapture(), capturedFrame (data URL), cropToBase64(rect),
 * status ("idle"|"requesting"|"captured"|"denied"|"unsupported"), and reset().
 */
import { useState, useCallback, useRef } from "react";

/**
 * @typedef {"idle"|"requesting"|"captured"|"denied"|"unsupported"} CaptureStatus
 *
 * @returns {{
 *   status: CaptureStatus,
 *   capturedFrame: string|null,
 *   frameWidth: number,
 *   frameHeight: number,
 *   requestCapture: () => Promise<void>,
 *   cropToBase64: (rect: {x: number, y: number, w: number, h: number}) => string|null,
 *   reset: () => void,
 * }}
 */
export function useScreenCapture() {
  const [status, setStatus] = useState(/** @type {CaptureStatus} */ ("idle"));
  const [capturedFrame, setCapturedFrame] = useState(/** @type {string|null} */ (null));
  const [frameWidth, setFrameWidth] = useState(0);
  const [frameHeight, setFrameHeight] = useState(0);
  const canvasRef = useRef(/** @type {HTMLCanvasElement|null} */ (null));

  const requestCapture = useCallback(async () => {
    // Check for getDisplayMedia support (not available on iOS Safari, etc.)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const w = settings.width || 1920;
      const h = settings.height || 1080;

      // Grab a single frame via ImageCapture or video+canvas fallback
      let imageBitmap;
      if (typeof ImageCapture !== "undefined") {
        const capture = new ImageCapture(track);
        imageBitmap = await capture.grabFrame();
      } else {
        // Fallback: render into a hidden video element
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        // Wait one frame
        await new Promise((r) => requestAnimationFrame(r));
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || w;
        canvas.height = video.videoHeight || h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);
        video.pause();
        video.srcObject = null;
        // Use the canvas directly
        canvasRef.current = canvas;
        setFrameWidth(canvas.width);
        setFrameHeight(canvas.height);
        setCapturedFrame(canvas.toDataURL("image/png"));
        setStatus("captured");
        track.stop();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // ImageCapture path
      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imageBitmap, 0, 0);
      imageBitmap.close();

      canvasRef.current = canvas;
      setFrameWidth(canvas.width);
      setFrameHeight(canvas.height);
      setCapturedFrame(canvas.toDataURL("image/png"));
      setStatus("captured");

      // Stop the stream immediately — we only need one frame
      track.stop();
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "AbortError") {
        setStatus("denied");
      } else {
        setStatus("denied");
      }
    }
  }, []);

  /**
   * Crop a rectangle from the captured frame and return base64 PNG.
   * Coordinates are in the display-scaled space of the captured frame —
   * the caller must map from their UI coordinates to the full-resolution
   * frame coordinates before calling this.
   *
   * @param {{x: number, y: number, w: number, h: number}} rect
   * @returns {string|null} base64 data URL of the cropped region, or null
   */
  const cropToBase64 = useCallback((rect) => {
    const sourceCanvas = canvasRef.current;
    if (!sourceCanvas || rect.w <= 0 || rect.h <= 0) return null;

    const crop = document.createElement("canvas");
    crop.width = Math.round(rect.w);
    crop.height = Math.round(rect.h);
    const ctx = crop.getContext("2d");
    ctx.drawImage(
      sourceCanvas,
      Math.round(rect.x), Math.round(rect.y),
      Math.round(rect.w), Math.round(rect.h),
      0, 0,
      crop.width, crop.height
    );
    return crop.toDataURL("image/png");
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setCapturedFrame(null);
    setFrameWidth(0);
    setFrameHeight(0);
    canvasRef.current = null;
  }, []);

  return {
    status,
    capturedFrame,
    frameWidth,
    frameHeight,
    requestCapture,
    cropToBase64,
    reset,
  };
}
