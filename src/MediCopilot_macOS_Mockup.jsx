import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Coins, Sprout, Shield, CheckCircle, Circle, AlertTriangle, Send, ChevronRight, Eye, EyeOff, Maximize2, Minimize2, Phone, User, Bot, Mic, MicOff, Monitor, GripVertical, Zap, Volume2, GripHorizontal, Menu, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  MOCK_LEADS,
  RECENT_LEADS,
  transcriptLines,
  aiResponses,
  DEFAULT_PECL_ITEMS,
} from "./data/index.js";
import { useLead, buildLeadFromExtraction, commitLeadEdit, makeField } from "./lead/LeadContext.jsx";
import { useScreenCapture } from "./capture/useScreenCapture.js";
import { extractLeadFromImage, extractLeadFromText } from "./capture/extractLeadFromImage.js";
import { useConsentBanner } from "./capture/useConsentBanner.js";
import { ConsentBanner } from "./capture/ConsentBanner.jsx";
import { useToast } from "./ui/Toast.jsx";
import { useLiveAudio } from "./audio/index.js";

const BACKEND_WSS_URL = import.meta.env.VITE_BACKEND_WSS_URL || null;

const T = {
  teal: "#007B7F", tealDark: "#004D50", tealLight: "#1A9EA2",
  coral: "#F47C6E", coralDark: "#D45A48",
  dusk: "#B0C4DE", white: "#fff",
  display: "'Montserrat', sans-serif",
  body: "'Lora', Georgia, serif",
  mono: "'JetBrains Mono', monospace",
};

// ─── Responsive hook ───
function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    // matchMedia is the most reliable cross-browser way to detect viewport size,
    // including in-app browsers and webviews where innerWidth can be unreliable.
    if (window.matchMedia) return window.matchMedia(query).matches;
    return window.innerWidth < breakpoint;
  });
  useEffect(() => {
    const mql = window.matchMedia(query);
    // Re-check on mount to handle any timing edge cases where the initial
    // render ran before the viewport meta tag was fully applied.
    setIsMobile(mql.matches);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return isMobile;
}

// ─── Draggable (desktop only) ───
function useDraggable(ix, iy) {
  const [pos, setPos] = useState({ x: ix, y: iy });
  const drag = useRef(false);
  const off = useRef({ x: 0, y: 0 });
  const onMouseDown = useCallback((e) => {
    if (e.target.closest("[data-no-drag]")) return;
    drag.current = true;
    off.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);
  useEffect(() => {
    const mv = (e) => { if (drag.current) setPos({ x: e.clientX - off.current.x, y: e.clientY - off.current.y }); };
    const up = () => { drag.current = false; };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, []);
  return { pos, setPos, onMouseDown };
}

// ─── Resizable (desktop only) ───
function useResizable(iw, ih, minW = 320, minH = 400) {
  const [size, setSize] = useState({ w: iw, h: ih });
  const resizing = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startSize = useRef({ w: iw, h: ih });
  const onResizeStart = useCallback((e) => {
    e.stopPropagation(); e.preventDefault();
    resizing.current = true;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...size };
  }, [size]);
  useEffect(() => {
    const mv = (e) => {
      if (!resizing.current) return;
      setSize({
        w: Math.max(minW, startSize.current.w + (e.clientX - startMouse.current.x)),
        h: Math.max(minH, startSize.current.h + (e.clientY - startMouse.current.y)),
      });
    };
    const up = () => { resizing.current = false; };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [minW, minH]);
  return { size, onResizeStart };
}

// ─── Audio waveform animation ───
// When `analyser` (an AnalyserNode) is provided, bar heights are driven by
// real-time frequency data via requestAnimationFrame. Otherwise the bars
// fall back to a CSS keyframe animation for the demo / muted state.
function AudioWave({ active, color = T.teal, bars = 5, analyser = null }) {
  const barRefs = useRef([]);

  useEffect(() => {
    if (!analyser || !active) return;
    const fftBins = analyser.frequencyBinCount;
    if (!fftBins) return;
    const data = new Uint8Array(fftBins);
    const span = Math.max(1, Math.floor(fftBins / bars));
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < span; j++) sum += data[i * span + j] || 0;
        const level = sum / span / 255; // 0..1
        const h = Math.max(2, Math.round(level * 14));
        const el = barRefs.current[i];
        if (el) {
          el.style.height = `${h}px`;
          el.style.animation = "none";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser, active, bars]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 16 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} ref={el => (barRefs.current[i] = el)} style={{
          width: 2, borderRadius: 1,
          background: active ? color : "rgba(255,255,255,0.15)",
          height: active ? `${6 + Math.sin(Date.now() / 200 + i * 1.2) * 5}px` : 4,
          animation: active ? `wave${i} 0.6s ease-in-out ${i * 0.1}s infinite alternate` : "none",
          transition: "height 0.08s ease",
        }} />
      ))}
      <style>{`
        ${Array.from({ length: bars }).map((_, i) => `
          @keyframes wave${i} {
            0% { height: ${4 + i}px; }
            100% { height: ${10 + (i % 3) * 3}px; }
          }
        `).join("")}
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════
//  NEW: Shared compliance + lead components
// ═══════════════════════════════════════

function ConfidencePill({ level }) {
  const map = {
    verified: { bg: "rgba(52,199,123,0.15)", bd: "rgba(52,199,123,0.3)", c: "#34C77B", label: "✓ verified" },
    high:     { bg: "rgba(0,123,127,0.18)",  bd: "rgba(0,123,127,0.35)", c: "#1A9EA2", label: "high" },
    medium:   { bg: "rgba(245,166,35,0.08)", bd: "rgba(245,166,35,0.35)", c: "#F5A623", label: "medium" },
    low:      { bg: "rgba(231,76,60,0.08)",  bd: "rgba(231,76,60,0.4)",   c: "#ff8a7b", label: "low" },
  };
  const s = map[level] || map.high;
  return (
    <span style={{
      fontFamily: T.mono, fontSize: 8, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "1px 5px", borderRadius: 8, lineHeight: 1.3,
      border: `1px solid ${s.bd}`, background: s.bg, color: s.c, whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

// ─── Live-transcript adapter ───
// Server emits `{ type, sessionId, final, speaker, text, ts, redactionCounts }`.
// Render code expects `{ time, speaker, text, isQuestion }` where speaker is
// "client" or "agent" (mockup convention). Diarization gives us a numeric
// speaker index — for the demo we map even → agent, odd → client. Refining
// this requires channel-split audio (P3) and isn't worth it now.
function mapLiveTranscripts(transcripts) {
  return transcripts.map((u, i) => {
    const ts = u.ts ? new Date(u.ts) : null;
    const time = ts && !Number.isNaN(ts.getTime())
      ? `${String(ts.getMinutes()).padStart(2, "0")}:${String(ts.getSeconds()).padStart(2, "0")}`
      : `${String(Math.floor(i / 6)).padStart(2, "0")}:${String((i * 10) % 60).padStart(2, "0")}`;
    const speakerNum = typeof u.speaker === "number" ? u.speaker : 0;
    const speaker = speakerNum % 2 === 0 ? "agent" : "client";
    const text = u.text || "";
    const isQuestion = /\?\s*$/.test(text);
    return { time, speaker, text, isQuestion };
  });
}

// Convert finished live suggestions into the shape AIResponseCard
// (mobile) and renderDesktopCopilot expect. Streaming suggestions are
// elided — we only swap in the live card once the structured tool
// input has fully arrived.
function liveSuggestionsToCards(suggestions) {
  return suggestions
    .filter((s) => s.status === "done" && s.suggestion)
    .map((s) => {
      const ai = s.suggestion;
      return {
        trigger: `Live · ${s.kind}`,
        context: { screen: "Live", audio: `Live trigger: ${s.kind}` },
        // Mobile card uses `response`; desktop renderer reads `sayThis`.
        response: ai.sayThis,
        sayThis: ai.sayThis,
        pressMore: ai.pressMore || [],
        followUps: ai.followUps || [],
        compliance: ai.compliance,
        sources: ai.sources,
      };
    });
}

// Merge the demo PECL items with the auto-marked id Set from the
// engine. An auto-marked item flips to done with a `coveredBy:
// "auto-transcript"` tag so the UI can render an `AUTO` badge instead
// of `DONE`. Items already done in the demo seed stay as-is.
function mergePeclItems(baseItems, autoSet) {
  if (!autoSet || autoSet.size === 0) return baseItems;
  return baseItems.map((it) =>
    !it.done && autoSet.has(it.id)
      ? { ...it, done: true, coveredBy: "auto-transcript" }
      : it
  );
}

// Push the lead snapshot to the server whenever the lead identity or
// the connection comes online. The server uses it as Claude prompt
// context; sending a sparse object is fine — the prompt handles "(no
// lead context yet)".
function useLeadContextPush(liveAudio, lead) {
  const lastSentRef = useRef(null);
  useEffect(() => {
    if (!liveAudio || !liveAudio.serverReady) return;
    const snapshot = lead
      ? {
          id: lead.id,
          state: lead.state ?? null,
          firstName: lead.fields?.firstName?.v ?? null,
          lastName: lead.fields?.lastName?.v ?? null,
          dob: lead.fields?.dob?.v ?? null,
          medications: lead.fields?.medications?.v ?? null,
          providers: lead.fields?.providers?.v ?? null,
          coverage: lead.fields?.coverage?.v ?? null,
        }
      : null;
    const serialized = JSON.stringify(snapshot);
    if (lastSentRef.current === serialized) return;
    lastSentRef.current = serialized;
    liveAudio.setLeadContext?.(snapshot);
  }, [liveAudio, lead]);
}

// Surface stream/mic errors via the toast system. Tracks the last shown
// error code so a single transient blip doesn't fire the same toast twice.
function useAudioErrorToasts({ noKeyError, micError, streamError }) {
  const toast = useToast();
  const lastShownRef = useRef({ key: null });
  useEffect(() => {
    if (noKeyError) {
      const key = "no_api_key";
      if (lastShownRef.current.key === key) return;
      lastShownRef.current.key = key;
      toast.show({
        kind: "error",
        title: "Live transcription unavailable",
        detail: "Server is missing DEEPGRAM_API_KEY. Falling back to demo transcript.",
      });
      return;
    }
    if (micError) {
      const key = "mic_error";
      if (lastShownRef.current.key === key) return;
      lastShownRef.current.key = key;
      toast.show({
        kind: "warn",
        title: "Mic unavailable",
        detail: micError.message || "Could not access microphone.",
      });
      return;
    }
    if (streamError && streamError.code !== "no_api_key") {
      const key = `stream_${streamError.code}`;
      if (lastShownRef.current.key === key) return;
      lastShownRef.current.key = key;
      toast.show({
        kind: "warn",
        title: "Live audio interrupted",
        detail: streamError.message || streamError.code,
      });
    }
  }, [noKeyError, micError, streamError, toast]);
}

function RecordingPill({ audioOn }) {
  if (!audioOn) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 8px", borderRadius: 999,
      background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)",
      fontFamily: T.display, fontWeight: 700, fontSize: 9, letterSpacing: "0.05em",
      color: "#ff8a7b", textTransform: "uppercase",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: "#E74C3C",
        animation: "recPulse 1s infinite",
      }} />
      Recording
      <style>{`@keyframes recPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
    </span>
  );
}

// MOCK_LEADS + RECENT_LEADS now live in src/data/leads.js (P0 extraction)

function SwitchLeadModal({ activeId, onPick, onClose }) {
  const [q, setQ] = useState("");
  const filtered = RECENT_LEADS.filter(l =>
    l.name.toLowerCase().includes(q.toLowerCase()) || l.sub.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div data-no-drag="true" style={{
      position: "absolute", inset: 0, zIndex: 200,
      background: "rgba(10,12,16,0.55)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60,
      cursor: "default",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(420px, 90%)", background: "rgba(20,26,32,0.96)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden",
      }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
          <User size={12} color={T.teal} />
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>Switch active lead</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
        </div>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone, or ZIP…" style={{
            width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "8px 10px", color: "#fff", outline: "none",
            fontFamily: T.body, fontSize: 12,
          }} />
        </div>
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", fontFamily: T.mono, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              No matches · try Capture Lead
            </div>
          )}
          {filtered.map(l => (
            <button key={l.id} onClick={() => onPick(l.id)} style={{
              width: "100%", display: "block", textAlign: "left", cursor: "pointer",
              padding: "10px 14px", background: l.id === activeId ? "rgba(0,123,127,0.1)" : "transparent",
              border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: "#fff" }}>{l.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{l.sub}</div>
                </div>
                <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: l.id === activeId ? T.teal : "rgba(255,255,255,0.35)" }}>
                  {l.id === activeId ? "● Active" : l.tag}
                </span>
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
          Switching re-anchors PECL, plans, and sources to the new lead.
        </div>
      </div>
    </div>
  );
}

function CaptureLeadModal({ onCommit, onClose }) {
  // choose | capturing | selecting | extracting | review | paste | error
  const [stage, setStage] = useState("choose");
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState(null);
  const [pasteText, setPasteText] = useState("");

  // Real screen capture hook
  const screen = useScreenCapture();

  // Consent banner (derive state from lead context if available)
  const { lead } = useLead();
  const leadState = lead?.fields?.address?.v?.state;
  const consent = useConsentBanner({ leadStateCode: leadState });
  const toast = useToast();

  // Centralized error surfacer: sets inline error stage AND emits a toast
  // (toast gives a glanceable notification above the modal; stage gives
  // recovery actions inside it).
  const surfaceError = useCallback((message, { toastKind = "error", toastTitle, toastDetail } = {}) => {
    setError(message);
    setStage("error");
    toast.show({
      kind: toastKind,
      title: toastTitle || (toastKind === "warn" ? "No lead info found" : "Extraction failed"),
      detail: toastDetail || message,
    });
  }, [toast]);

  // Marquee selection state (user drags on the captured frame)
  const [marquee, setMarquee] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const frameRef = useRef(null);

  const startExtract = async (src) => {
    setError(null);
    if (src === "manual") {
      setExtracted({
        firstName: { v: "", confidence: "low" },
        lastName: { v: "", confidence: "low" },
        dob: { v: "", confidence: "low" },
        phone: { v: "", confidence: "low" },
        address: { v: "", confidence: "low" },
        coverage: { v: "", confidence: "low" },
      });
      setStage("review");
    } else if (src === "paste") {
      setPasteText("");
      setStage("paste");
    } else if (src === "region" || src === "screen") {
      // Use real getDisplayMedia
      await screen.requestCapture();
    }
  };

  // When screen capture completes, move to selecting stage
  useEffect(() => {
    if (screen.status === "captured" && screen.capturedFrame) {
      setMarquee({ x: 0, y: 0, w: 0, h: 0 });
      setStage("selecting");
    } else if (screen.status === "denied") {
      surfaceError("Screen access denied. Enable in browser settings or enter manually.", {
        toastTitle: "Screen access denied",
      });
    } else if (screen.status === "unsupported") {
      surfaceError("Screen capture is not supported on this device. Use photo upload or paste instead.", {
        toastTitle: "Capture unavailable",
        toastKind: "warn",
      });
    }
  }, [screen.status, screen.capturedFrame, surfaceError]);

  // Mouse handlers for marquee drawing on the captured frame
  const handleFrameMouseDown = (e) => {
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStart({ x, y });
    setMarquee({ x, y, w: 0, h: 0 });
    setDragging(true);
  };
  const handleFrameMouseMove = (e) => {
    if (!dragging || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const cx = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const cy = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setMarquee({
      x: Math.min(dragStart.x, cx),
      y: Math.min(dragStart.y, cy),
      w: Math.abs(cx - dragStart.x),
      h: Math.abs(cy - dragStart.y),
    });
  };
  const handleFrameMouseUp = () => {
    setDragging(false);
  };

  // Per spec §2 error table: require both dimensions ≥ 20px before Extract
  // is eligible. Anything smaller is almost certainly a misclick.
  const MIN_MARQUEE = 20;
  const hasAnyMarquee = marquee.w > 0 && marquee.h > 0;
  const marqueeTooSmall = hasAnyMarquee && (marquee.w < MIN_MARQUEE || marquee.h < MIN_MARQUEE);
  const marqueeDone = !dragging && hasAnyMarquee && !marqueeTooSmall;

  // Run extraction on the cropped region
  const handleExtract = async () => {
    if (!marqueeDone) return;
    setStage("extracting");
    setError(null);

    // Map marquee coordinates from display space to full-resolution frame space
    const el = frameRef.current;
    if (!el) return;
    const displayW = el.clientWidth;
    const displayH = el.clientHeight;
    const scaleX = screen.frameWidth / displayW;
    const scaleY = screen.frameHeight / displayH;

    const cropRect = {
      x: marquee.x * scaleX,
      y: marquee.y * scaleY,
      w: marquee.w * scaleX,
      h: marquee.h * scaleY,
    };

    const base64 = screen.cropToBase64(cropRect);
    if (!base64) {
      surfaceError("Failed to crop region. Try again.", { toastTitle: "Crop failed" });
      return;
    }

    const result = await extractLeadFromImage(base64);
    if (result.kind === "success") {
      setExtracted(result.fields);
      setStage("review");
    } else if (result.kind === "empty") {
      surfaceError("No lead info found. Try again or paste manually.", {
        toastKind: "warn",
        toastTitle: "No lead info found",
      });
    } else if (result.kind === "denied") {
      surfaceError("API access denied. Check configuration.", { toastTitle: "API denied" });
    } else {
      surfaceError(result.error || "Extraction failed. Retry.");
    }
  };

  // Handle paste extraction
  const handlePasteExtract = async () => {
    if (!pasteText.trim()) return;
    setStage("extracting");
    const result = await extractLeadFromText(pasteText);
    if (result.kind === "success") {
      setExtracted(result.fields);
      setStage("review");
    } else {
      surfaceError(result.error || "No lead info found in pasted text.", {
        toastKind: result.kind === "empty" ? "warn" : "error",
        toastTitle: result.kind === "empty" ? "No lead info found" : "Paste parse failed",
      });
    }
  };

  // Handle photo upload (mobile fallback)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage("extracting");
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const result = await extractLeadFromImage(reader.result);
      if (result.kind === "success") {
        setExtracted(result.fields);
        setStage("review");
      } else {
        surfaceError(result.error || "No lead info found in photo.", {
          toastKind: result.kind === "empty" ? "warn" : "error",
          toastTitle: result.kind === "empty" ? "No lead info found" : "Photo parse failed",
        });
      }
    };
    reader.onerror = () => {
      surfaceError("Failed to read file.", { toastTitle: "File read failed" });
    };
    reader.readAsDataURL(file);
  };

  // Field labels for the review UI
  const fieldLabels = {
    firstName: "First Name", lastName: "Last Name", dob: "DOB",
    phone: "Phone", address: "Address", coverage: "Coverage",
    medications: "Medications", providers: "Providers",
  };

  return (
    <div data-no-drag="true" style={{
      position: "absolute", inset: 0, zIndex: 200,
      background: "rgba(10,12,16,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 48,
      cursor: "default",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(460px, 92%)", background: "rgba(20,26,32,0.96)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden",
      }}>
        {/* Consent banner */}
        {consent.shouldShowBanner && (
          <ConsentBanner isTwoParty={consent.isTwoParty} onDismiss={consent.dismiss} />
        )}

        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: T.teal }}>⊕ Capture lead</span>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
            {stage === "choose" && "· choose source"}
            {stage === "selecting" && "· drag to select a region"}
            {stage === "extracting" && "· extracting…"}
            {stage === "review" && "· review & commit"}
            {stage === "paste" && "· paste lead info"}
            {stage === "error" && "· error"}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
        </div>

        {stage === "choose" && (
          <div style={{ padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              {[
                { k: "region", icon: "◩", title: "Screen capture", sub: "Capture screen & drag a box around lead fields" },
                { k: "manual", icon: "⌨", title: "Manual", sub: "Type the fields yourself" },
              ].map(o => (
                <button key={o.k} onClick={() => startExtract(o.k)} style={{
                  padding: "14px 10px", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                  cursor: "pointer", textAlign: "left", color: "#fff",
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{o.icon}</div>
                  <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 12, color: "#fff" }}>{o.title}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3, lineHeight: 1.35 }}>{o.sub}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => startExtract("paste")} style={{
                padding: "10px 10px", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                cursor: "pointer", textAlign: "left", color: "#fff",
              }}>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.8)" }}>📋 Paste text</div>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Paste from CRM or notes</div>
              </button>
              <label style={{
                padding: "10px 10px", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
                cursor: "pointer", textAlign: "left", color: "#fff",
              }}>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.8)" }}>📷 Photo upload</div>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Snap a photo of the screen</div>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload}
                  style={{ display: "none" }} />
              </label>
            </div>
          </div>
        )}

        {stage === "selecting" && screen.capturedFrame && (
          <div style={{ padding: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
              Drag to draw a region around the fields you want captured.
            </div>
            <div
              ref={frameRef}
              onMouseDown={handleFrameMouseDown}
              onMouseMove={handleFrameMouseMove}
              onMouseUp={handleFrameMouseUp}
              onMouseLeave={handleFrameMouseUp}
              style={{
                position: "relative", height: 280, borderRadius: 10, overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.06)",
                cursor: "crosshair", userSelect: "none",
              }}
            >
              <img src={screen.capturedFrame} alt="Captured screen"
                style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
                draggable={false}
              />
              {/* Dimming overlay with cut-out for marquee */}
              {marquee.w > 0 && marquee.h > 0 && (
                <>
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.55)",
                    clipPath: `polygon(
                      0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                      ${marquee.x}px ${marquee.y}px,
                      ${marquee.x}px ${marquee.y + marquee.h}px,
                      ${marquee.x + marquee.w}px ${marquee.y + marquee.h}px,
                      ${marquee.x + marquee.w}px ${marquee.y}px,
                      ${marquee.x}px ${marquee.y}px
                    )`,
                    pointerEvents: "none",
                  }} />
                  <div style={{
                    position: "absolute",
                    left: marquee.x, top: marquee.y,
                    width: marquee.w, height: marquee.h,
                    border: `2px dashed ${T.tealLight}`,
                    boxShadow: "0 0 0 1px rgba(0,123,127,0.3), 0 8px 24px rgba(0,123,127,0.25)",
                    background: "rgba(0,123,127,0.05)",
                    pointerEvents: "none",
                  }}>
                    {!dragging && hasAnyMarquee && (
                      <div style={{
                        position: "absolute", top: -18, left: 0,
                        fontFamily: T.mono, fontSize: 9,
                        color: marqueeTooSmall ? "#F5A623" : T.teal,
                        padding: "1px 5px",
                        background: marqueeTooSmall ? "rgba(245,166,35,0.15)" : "rgba(0,123,127,0.15)",
                        borderRadius: 3,
                      }}>
                        {marqueeTooSmall
                          ? `Too small — need ≥${MIN_MARQUEE}×${MIN_MARQUEE}`
                          : `${Math.round(marquee.w)} × ${Math.round(marquee.h)}`}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => { screen.reset(); setStage("choose"); }} style={{
                flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}>Back</button>
              <button onClick={() => { setMarquee({ x: 0, y: 0, w: 0, h: 0 }); }} style={{
                padding: "9px 12px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}>Retry</button>
              <button
                disabled={!marqueeDone}
                onClick={handleExtract}
                title={
                  marqueeDone ? undefined :
                  marqueeTooSmall ? `Region is too small — drag at least ${MIN_MARQUEE}×${MIN_MARQUEE}px` :
                  "Drag a region on the captured image to select"
                }
                style={{
                  flex: 2, padding: "9px 12px",
                  background: marqueeDone ? "linear-gradient(135deg, #007B7F, #004D50)" : "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                  fontFamily: T.display, fontWeight: 700, fontSize: 11,
                  color: marqueeDone ? "#fff" : "rgba(255,255,255,0.3)",
                  cursor: marqueeDone ? "pointer" : "not-allowed",
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}
              >✦ Extract</button>
            </div>
          </div>
        )}

        {stage === "paste" && (
          <div style={{ padding: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
              Paste lead info from your CRM, email, or notes. AI will parse the fields.
            </div>
            <textarea
              autoFocus
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste lead information here…"
              rows={6}
              style={{
                width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "8px 10px", color: "#fff", outline: "none", resize: "vertical",
                fontFamily: T.body, fontSize: 12, lineHeight: 1.5,
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setStage("choose")} style={{
                flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}>Back</button>
              <button disabled={!pasteText.trim()} onClick={handlePasteExtract} style={{
                flex: 2, padding: "9px 12px",
                background: pasteText.trim() ? "linear-gradient(135deg, #007B7F, #004D50)" : "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11,
                color: pasteText.trim() ? "#fff" : "rgba(255,255,255,0.3)",
                cursor: pasteText.trim() ? "pointer" : "not-allowed",
                letterSpacing: "0.04em", textTransform: "uppercase",
              }}>✦ Extract from text</button>
            </div>
          </div>
        )}

        {stage === "extracting" && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
              Claude Vision · extracting lead fields…
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
              <div style={{
                height: "100%", width: "60%",
                background: `linear-gradient(90deg, ${T.teal}, #34C77B)`,
                animation: "extractPulse 1.5s ease-in-out infinite",
              }} />
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
              Sending to API…
            </div>
            <style>{`@keyframes extractPulse { 0%,100% { width: 30%; } 50% { width: 85%; } }`}</style>
          </div>
        )}

        {stage === "error" && (
          <div style={{ padding: 20, textAlign: "center" }}>
            <div style={{
              fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "#F5A623", marginBottom: 8,
            }}>
              {error}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => { screen.reset(); setStage("choose"); }} style={{
                padding: "9px 16px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}>Try again</button>
              <button onClick={() => startExtract("paste")} style={{
                padding: "9px 16px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}>Paste instead</button>
              <button onClick={() => startExtract("manual")} style={{
                padding: "9px 16px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}>Enter manually</button>
            </div>
          </div>
        )}

        {stage === "review" && extracted && (
          <div style={{ padding: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
              Review fields. Anything below "high" confidence should be verbally confirmed with the caller before committing.
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {Object.entries(extracted).map(([k, f]) => (
                <div key={k} style={{
                  background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8, padding: "8px 10px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", width: 92 }}>
                    {fieldLabels[k] || k}
                  </div>
                  <input
                    value={typeof f.v === "object" ? JSON.stringify(f.v) : (f.v || "")}
                    onChange={e => setExtracted(prev => ({
                      ...prev,
                      [k]: { ...f, v: e.target.value, confidence: e.target.value ? (f.confidence === "low" ? "medium" : f.confidence) : "low" }
                    }))}
                    placeholder="—"
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 6, padding: "5px 8px", color: "#fff", outline: "none",
                      fontFamily: T.body, fontSize: 12,
                    }}
                  />
                  <ConfidencePill level={f.confidence || f.pill || "medium"} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}>Cancel</button>
              <button onClick={() => onCommit(extracted)} style={{
                flex: 2, padding: "9px 12px",
                background: "linear-gradient(135deg, #007B7F, #004D50)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "#fff", cursor: "pointer",
                letterSpacing: "0.04em", textTransform: "uppercase",
              }}>Commit as active lead</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Editable cell (P1): click-to-edit a lead field in place ───
//
// `field.editKind` decides how the string is split/parsed back into
// individual LeadContext fields when the user commits:
//   - "name":     "First Last…" → firstName + lastName
//   - "address":  "City, ST 12345" → address.{city,state,zip}
//   - "dob" | "phone" | "coverage": single-field update
// Esc cancels; Enter or blur-outside commits.
function EditableLeadCell({ field, editable, highlighted, scaledFont, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const begin = () => {
    if (!editable) return;
    setDraft(field.v || "");
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = (draft || "").trim();
    const current = (field.v || "").toString().trim();
    if (trimmed && trimmed !== current) onCommit(trimmed);
  };

  const cancel = () => {
    setDraft("");
    setEditing(false);
  };

  return (
    <div
      style={{
        gridColumn: field.wide ? "span 2" : "span 1",
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${highlighted ? "rgba(26,158,162,0.85)" : "rgba(255,255,255,0.04)"}`,
        borderRadius: 6,
        padding: "4px 7px",
        cursor: editable && !editing ? "text" : "default",
        transition: "border-color 220ms ease, box-shadow 220ms ease",
        boxShadow: highlighted ? "0 0 0 2px rgba(26,158,162,0.35), 0 0 18px rgba(26,158,162,0.35)" : "none",
      }}
      onClick={() => { if (!editing) begin(); }}
      title={editable ? "Click to edit" : undefined}
    >
      <div style={{
        fontFamily: T.display, fontWeight: 600, fontSize: 8,
        letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
      }}>
        {field.k}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 16 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              else if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, minWidth: 0,
              background: "rgba(0,0,0,0.25)", border: "1px solid rgba(26,158,162,0.5)",
              borderRadius: 4, padding: "2px 5px", color: "#fff", outline: "none",
              fontFamily: T.body, fontSize: scaledFont(11), lineHeight: 1.35,
            }}
          />
        ) : (
          <span style={{
            fontFamily: T.body, fontSize: scaledFont(11),
            color: "rgba(255,255,255,0.9)", flex: 1, lineHeight: 1.35,
          }}>
            {field.v || "—"}
          </span>
        )}
        <ConfidencePill level={field.pill} />
      </div>
    </div>
  );
}

function LeadContextPanel({ scaledFont = (x) => x }) {
  const { lead: ctxLead, highlightedField, actions } = useLead();
  const [activeId, setActiveId] = useState("maria");
  const [showSwitch, setShowSwitch] = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  // If we have a real lead from context, display it; otherwise fall back to mock data
  const hasRealLead = ctxLead && ctxLead.fields;

  // Convert context lead fields to the display format the panel expects.
  // Each cell carries a `matches` array that lists the underlying fieldName(s)
  // it represents — used to decide whether the highlight ring should fire when
  // an AI source pill hovers a field name.
  const active = hasRealLead ? {
    id: ctxLead.id,
    source: `Captured · ${ctxLead.source}`,
    fields: [
      ctxLead.fields.firstName && {
        k: "Name",
        v: `${ctxLead.fields.firstName?.v || ""} ${ctxLead.fields.lastName?.v || ""}`.trim(),
        pill: ctxLead.fields.firstName?.confidence || "medium",
        matches: ["firstName", "lastName", "name"],
        editKind: "name",
      },
      ctxLead.fields.dob && {
        k: "DOB",
        v: ctxLead.fields.dob.v,
        pill: ctxLead.fields.dob.confidence,
        matches: ["dob"],
        editKind: "dob",
      },
      ctxLead.fields.phone && {
        k: "Phone",
        v: ctxLead.fields.phone.v,
        pill: ctxLead.fields.phone.confidence,
        matches: ["phone"],
        editKind: "phone",
      },
      ctxLead.fields.address && {
        k: "Address · ZIP",
        v: typeof ctxLead.fields.address.v === "object"
          ? `${ctxLead.fields.address.v.city || ""}, ${ctxLead.fields.address.v.state || ""} ${ctxLead.fields.address.v.zip || ""}`.trim()
          : ctxLead.fields.address.v,
        pill: ctxLead.fields.address.confidence,
        wide: true,
        matches: ["address", "zip", "state", "city"],
        editKind: "address",
      },
      ctxLead.fields.coverage && {
        k: "Coverage",
        v: ctxLead.fields.coverage.v,
        pill: ctxLead.fields.coverage.confidence,
        matches: ["coverage"],
        editKind: "coverage",
      },
    ].filter(Boolean),
  } : MOCK_LEADS[activeId];

  const fields = active.fields;
  const source = active.source;

  const handleCommitCapture = (extracted) => {
    // Build a real LeadContext from the extracted fields and dispatch to global state
    const newLead = buildLeadFromExtraction(extracted, "vision");
    actions.capture(newLead);
    setShowCapture(false);
  };

  return (
    <div style={{
      padding: "10px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "linear-gradient(180deg, rgba(0,123,127,0.06), transparent)",
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <User size={11} color={T.teal} />
        <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Lead context</span>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>· {source}</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontFamily: T.display, fontWeight: 600, fontSize: 9,
          color: "#34C77B", letterSpacing: "0.06em", textTransform: "uppercase", marginLeft: 6,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34C77B", boxShadow: "0 0 6px rgba(52,199,123,0.7)" }} />
          Ready
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button data-no-drag="true" onClick={() => setShowSwitch(true)} style={{
            fontFamily: T.display, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase",
            padding: "4px 8px", borderRadius: 6, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>Switch</button>
          <button data-no-drag="true" onClick={() => setShowCapture(true)} style={{
            fontFamily: T.display, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase",
            padding: "4px 8px", borderRadius: 6, cursor: "pointer",
            background: "linear-gradient(135deg, #007B7F, #004D50)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>⊕ Capture Lead</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 8px" }}>
        {fields.map((f, i) => (
          <EditableLeadCell
            key={i}
            field={f}
            editable={hasRealLead}
            highlighted={hasRealLead && f.matches && highlightedField && f.matches.includes(highlightedField)}
            scaledFont={scaledFont}
            onCommit={(nextValue) => {
              if (!hasRealLead) return;
              commitLeadEdit(ctxLead, f.editKind, nextValue, actions.updateField);
            }}
          />
        ))}
      </div>

      {showSwitch && (
        <SwitchLeadModal
          activeId={activeId}
          onClose={() => setShowSwitch(false)}
          onPick={(id) => { setActiveId(id); setShowSwitch(false); }}
        />
      )}
      {showCapture && (
        <CaptureLeadModal
          onClose={() => setShowCapture(false)}
          onCommit={handleCommitCapture}
        />
      )}
    </div>
  );
}

function ComplianceHub({ peclItems, compact = false }) {
  const peclDone = peclItems.filter(i => i.done).length;
  const mspRow = peclItems.find(i => i.id === "msp");
  const mspCovered = mspRow?.done;
  // mark required vs recommended
  const risk = {
    tpmo: "req", lis: "req", msp: "req", medigap: "rec", soa: "req",
  };
  const riskLabel = { req: "required", rec: "rec" };
  const dotColor = { req: "#E74C3C", rec: "#F5A623", done: "#34C77B" };
  return (
    <div style={{
      padding: compact ? "8px 10px" : "10px 12px",
      background: "linear-gradient(180deg, rgba(245,166,35,0.08), rgba(245,166,35,0.02))",
      borderBottom: "1px solid rgba(245,166,35,0.2)",
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: "linear-gradient(180deg, #F5A623, rgba(245,166,35,0))" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <AlertTriangle size={12} color="#F5A623" />
        <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: 10, letterSpacing: "0.12em", color: "#F5A623", textTransform: "uppercase" }}>Compliance Hub</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 3, fontFamily: T.mono, fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.85)" }}>
          <span style={{ color: peclDone === peclItems.length ? "#34C77B" : "#F5A623" }}>{peclDone}</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>/ {peclItems.length}</span>
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 10 }}>
        <div style={{
          height: "100%", width: `${(peclDone / peclItems.length) * 100}%`,
          background: "linear-gradient(90deg, #F5A623, #fbc76a)",
          boxShadow: "0 0 10px rgba(245,166,35,0.4)",
        }} />
      </div>

      {/* MSP dedicated card */}
      <div style={{
        background: mspCovered ? "rgba(0,123,127,0.1)" : "rgba(245,166,35,0.08)",
        border: `1px solid ${mspCovered ? "rgba(0,123,127,0.4)" : "rgba(245,166,35,0.35)"}`,
        borderRadius: 8, padding: "8px 10px", marginBottom: 10,
        animation: mspCovered ? "none" : "mspPulse 2.2s infinite",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 6px", borderRadius: 4,
            background: mspCovered ? "#34C77B" : "#F5A623",
            color: mspCovered ? "#013014" : "#1a1200",
            fontFamily: T.display, fontWeight: 800, fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>{mspCovered ? "✓ Covered" : "⚠ Action Required"}</span>
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 11, color: mspCovered ? "#a9e7d1" : "#ffd699", letterSpacing: "0.01em" }}>
            Medicare Savings Programs
          </span>
        </div>
        <div style={{ fontFamily: T.body, fontSize: 11, color: "rgba(255,255,255,0.72)", lineHeight: 1.5, marginBottom: 7 }}>
          {mspCovered
            ? "MSP disclosure recorded. Safe to proceed with plan recommendations."
            : "You must offer to screen for MSP eligibility before recommending any plan. Skipping may cause enrollment reversal."}
        </div>
        {!mspCovered && (
          <div style={{ display: "flex", gap: 5 }}>
            <button data-no-drag="true" style={{
              fontFamily: T.display, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase",
              padding: "5px 9px", borderRadius: 6, cursor: "pointer",
              background: "linear-gradient(135deg, #007B7F, #004D50)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(0,123,127,0.3)",
            }}>⊕ Insert MSP script</button>
            <button data-no-drag="true" style={{
              fontFamily: T.display, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase",
              padding: "5px 9px", borderRadius: 6, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>Mark covered</button>
          </div>
        )}
        <style>{`@keyframes mspPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(245,166,35,0.4); } 50% { box-shadow: 0 0 0 4px rgba(245,166,35,0); } }`}</style>
      </div>

      {/* PECL list */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>
            Pre-Enrollment Checklist
          </span>
          <span style={{ fontFamily: T.display, fontWeight: 500, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>(PECL)</span>
          <span title="CMS Pre-Enrollment Checklist — items required before Medicare plan enrollment. Skipping items can result in enrollment reversal." style={{
            width: 12, height: 12, borderRadius: "50%", background: "rgba(255,255,255,0.08)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: T.mono, fontSize: 8, color: "rgba(255,255,255,0.6)", cursor: "help",
          }}>i</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {peclItems.map(item => {
            const r = item.done ? "done" : risk[item.id] || "rec";
            const isPending = !item.done && r === "req";
            return (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "4px 7px", borderRadius: 5,
                background: item.done ? "rgba(52,199,123,0.04)" : (isPending ? "rgba(231,76,60,0.05)" : "transparent"),
                fontFamily: T.body, fontSize: 11,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: dotColor[r],
                  boxShadow: r === "req" ? "0 0 6px rgba(231,76,60,0.5)" : (r === "done" ? "0 0 6px rgba(52,199,123,0.5)" : "none"),
                }} />
                <span style={{
                  flex: 1,
                  color: item.done ? "rgba(255,255,255,0.55)" : (isPending ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)"),
                  textDecoration: item.done ? "line-through" : "none",
                  textDecorationColor: "rgba(52,199,123,0.4)",
                }}>{item.label}</span>
                <span style={{
                  fontFamily: T.display, fontWeight: 700, fontSize: 7, letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "1px 4px", borderRadius: 3,
                  background: item.done ? "rgba(52,199,123,0.12)" : (r === "req" ? "rgba(231,76,60,0.15)" : "rgba(245,166,35,0.12)"),
                  color: item.done ? "#34C77B" : (r === "req" ? "#ff8a7b" : "#F5A623"),
                }}>{item.done ? (item.coveredBy === "auto-transcript" ? "auto" : "done") : riskLabel[r] || "rec"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MspInlineBadge({ covered }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "1px 5px", borderRadius: 3, marginLeft: 4,
      background: covered ? "#34C77B" : "#F5A623",
      color: covered ? "#013014" : "#1a1200",
      fontFamily: T.display, fontWeight: 800, fontSize: 7, letterSpacing: "0.08em", textTransform: "uppercase",
      cursor: "pointer",
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: "50%",
        background: covered ? "#013014" : "#1a1200",
        color: covered ? "#34C77B" : "#F5A623",
        fontSize: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
      }}>{covered ? "✓" : "!"}</span>
      {covered ? "MSP covered" : "MSP"}
    </span>
  );
}

function SourcesRow({ sources }) {
  const { actions } = useLead();
  if (!sources || sources.length === 0) return null;

  // Normalize: accept plain strings (legacy) or { label, field } objects.
  const items = sources.map((s) =>
    typeof s === "string" ? { label: s, field: null } : s
  );

  return (
    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
      {items.map((s, i) => (
        <span
          key={i}
          onMouseEnter={() => { if (s.field) actions.highlightField(s.field); }}
          onMouseLeave={() => actions.highlightField(null)}
          style={{
            fontFamily: T.mono, fontSize: 8, letterSpacing: "0.04em", textTransform: "uppercase",
            padding: "1px 5px", borderRadius: 6,
            background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: s.field ? "pointer" : "default",
            transition: "background 160ms ease, color 160ms ease",
          }}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

// transcriptLines now lives in src/data/transcript.js (P0 extraction)

// aiResponses now lives in src/data/aiResponses.js (P0 extraction)

// ═══════════════════════════════════════
//  DESKTOP COMPONENTS (unchanged logic)
// ═══════════════════════════════════════

function MacMenuBar() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: 25, padding: "0 16px",
      background: "rgba(255,255,255,0.15)", backdropFilter: "blur(30px)",
      WebkitBackdropFilter: "blur(30px)",
      fontFamily: "-apple-system, sans-serif", fontSize: 13, color: "#fff",
    }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ fontWeight: 700 }}></span>
        <span style={{ fontWeight: 600 }}>Five9</span>
        <span>File</span><span>Edit</span><span>View</span><span>Help</span>
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span>🔋</span><span>📶</span><span>2:08 PM</span>
      </div>
    </div>
  );
}

function MacDock() {
  return (
    <div style={{
      position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
      display: "flex", gap: 4, padding: "4px 12px",
      background: "rgba(255,255,255,0.2)", backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.3)",
    }}>
      {["📁","🌐","📞","📹","📝","💬","📧","📅","⚙️"].map((i, idx) => (
        <div key={idx} style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer" }}>{i}</div>
      ))}
    </div>
  );
}

function Five9Window() {
  return (
    <div style={{ position: "absolute", top: 50, left: 40, width: 680, borderRadius: 8, background: "#1a1a2e", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", height: 28, padding: "0 10px", background: "#2D2D2D", borderBottom: "1px solid #3a3a3a", borderRadius: "8px 8px 0 0" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FF5F57" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FFBD2E" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#28C840" }} />
        </div>
        <div style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 500, color: "#aaa", fontFamily: "-apple-system, sans-serif" }}>Five9 Agent Desktop — Active Call</div>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#34C77B", boxShadow: "0 0 8px rgba(52,199,123,0.5)" }} />
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: "#34C77B" }}>CONNECTED</span>
          <span style={{ fontFamily: T.mono, fontSize: 14, color: T.dusk }}>08:12</span>
          <span style={{ fontFamily: T.mono, fontSize: 13, color: "#666", marginLeft: "auto" }}>Campaign: AEP_MAPD_FL</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[["Caller","Maria Garcia"],["Phone","(954) 555-0142"],["ZIP","33024 — Pembroke Pines, FL"],["DOB","03/15/1952 (Age 74)"],["Coverage","Original Medicare + PDP"],["Lead Source","AllCalls"]].map(([k,v]) => (
              <div key={k}>
                <div style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
                <div style={{ fontFamily: T.body, fontSize: 14, color: "#ddd", marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[["Mute","🎤"],["Hold","⏸️"],["Transfer","↗️"],["Disposition","📋"],["End Call","📕"]].map(([l,ic]) => (
            <button key={l} style={{ background: l==="End Call" ? "rgba(231,76,60,0.3)" : "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "10px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 18 }}>{ic}</span>
              <span style={{ fontFamily: T.display, fontSize: 10, color: "#999" }}>{l}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  SHARED: AI Response Card
// ═══════════════════════════════════════

function AIResponseCard({ resp, scaledFont, opacity, audioOn, screenOn }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Bot size={10} color={T.teal} />
        <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>MediCopilot</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4 }}>
          {audioOn && <span style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(52,199,123,0.5)", background: "rgba(52,199,123,0.06)", padding: "1px 4px", borderRadius: 3 }}>🎙 audio</span>}
          {screenOn && <span style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(0,123,127,0.5)", background: "rgba(0,123,127,0.06)", padding: "1px 4px", borderRadius: 3 }}>🖥 screen</span>}
        </div>
      </div>
      <div style={{ padding: "4px 8px", marginBottom: 6, background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.03)" }}>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.25)" }}>Context: {resp.context.audio}</span>
      </div>
      <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px 12px 12px 4px" }}>
        <div style={{ fontFamily: T.body, fontSize: scaledFont(13), color: `rgba(255,255,255,${Math.min(opacity+0.1,0.95)})`, lineHeight: 1.55 }}>{resp.response}</div>
        {resp.plans && <div style={{ marginTop: 8 }}>
          {resp.plans.map((p, j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", marginBottom: 3, background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: T.display, fontSize: scaledFont(11), fontWeight: 600, color: T.white }}>{p.name}</div>
                  <MspInlineBadge covered={p.mspCovered !== false} />
                </div>
                <div style={{ fontFamily: T.mono, fontSize: scaledFont(9), color: "rgba(255,255,255,0.3)" }}>{p.tier} · PA: {p.pa} · {p.stars}</div>
              </div>
              <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: scaledFont(13), color: "#34C77B" }}>{p.copay}</span>
            </div>
          ))}
        </div>}
        {resp.detail && <div style={{ fontFamily: T.body, fontSize: scaledFont(12), color: "rgba(255,255,255,0.6)", marginTop: 6, lineHeight: 1.5 }}>{resp.detail}</div>}
        {resp.trifecta && <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "6px 8px", background: "rgba(0,123,127,0.06)", border: "1px solid rgba(0,123,127,0.15)", borderRadius: 6 }}>
          <Heart size={11} color={T.teal} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontFamily: T.body, fontSize: scaledFont(11), color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>{resp.trifecta}</span>
        </div>}
        {resp.compliance && <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "6px 8px", background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.12)", borderRadius: 6 }}>
          <Shield size={11} color="#F5A623" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontFamily: T.body, fontSize: scaledFont(11), color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{resp.compliance}</span>
        </div>}
        {resp.script && <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(0,123,127,0.06)", borderLeft: `2px solid ${T.teal}`, borderRadius: "0 6px 6px 0" }}>
          <div style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: T.teal, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>Suggested Script</div>
          <div style={{ fontFamily: T.body, fontStyle: "italic", fontSize: scaledFont(11), color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{resp.script}</div>
        </div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  MOBILE LAYOUT
// ═══════════════════════════════════════

function MobileLayout() {
  const [tab, setTab] = useState("copilot"); // "call" | "copilot" | "transcript"
  const [viewMode, setViewMode] = useState("tabs"); // "tabs" | "split" | "full"
  const [splitPanels, setSplitPanels] = useState(["copilot", "transcript"]);
  const [fullPanel, setFullPanel] = useState(null); // null or panel key
  const [inputVal, setInputVal] = useState("");
  const [audioOn, setAudioOn] = useState(true);
  const [screenOn, setScreenOn] = useState(true);
  const [visibleTranscript, setVisibleTranscript] = useState(6);
  const [shownResponses, setShownResponses] = useState(1);
  const [tick, setTick] = useState(0);
  const opacity = 0.88;
  const scaledFont = (base) => base;

  // Live audio pipeline. When VITE_BACKEND_WSS_URL isn't set the hook is a
  // no-op and `transcripts` stays empty — renderers fall back to the demo.
  const liveAudio = useLiveAudio({ url: BACKEND_WSS_URL, enabled: audioOn });
  useAudioErrorToasts(liveAudio);
  const { lead: ctxLead } = useLead();
  useLeadContextPush(liveAudio, ctxLead);
  const liveLines = mapLiveTranscripts(liveAudio.transcripts);
  const usingLive = liveLines.length > 0;
  const renderedTranscript = usingLive
    ? liveLines
    : transcriptLines.slice(0, visibleTranscript);
  const liveCards = liveSuggestionsToCards(liveAudio.suggestions);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 300);
    return () => clearInterval(iv);
  }, []);

  const peclItems = mergePeclItems(DEFAULT_PECL_ITEMS, liveAudio.autoPecl);
  const peclDone = peclItems.filter(i => i.done).length;
  const displayResponses = liveCards.length > 0
    ? liveCards
    : aiResponses.slice(0, shownResponses);

  const handleAskAI = () => {
    if (shownResponses < aiResponses.length) setShownResponses(s => s + 1);
    if (visibleTranscript < transcriptLines.length) setVisibleTranscript(v => Math.min(v + 2, transcriptLines.length));
  };

  const panelDefs = [
    { key: "call", label: "Call Info", icon: Phone },
    { key: "copilot", label: "AI Copilot", icon: Zap },
    { key: "transcript", label: "Transcript", icon: Volume2 },
  ];

  // In split mode, clicking a panel that isn't selected replaces the first selected panel
  const toggleSplitPanel = (key) => {
    if (splitPanels.includes(key)) return;
    setSplitPanels(prev => [prev[1], key]);
  };

  // ─── Panel content renderers ───
  const renderCallInfo = () => (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: "#34C77B", boxShadow: "0 0 8px rgba(52,199,123,0.5)" }} />
        <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: "#34C77B" }}>CONNECTED</span>
        <span style={{ fontFamily: T.mono, fontSize: 14, color: T.dusk }}>08:12</span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: "#666", marginBottom: 16 }}>Campaign: AEP_MAPD_FL</div>
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[["Caller","Maria Garcia"],["Phone","(954) 555-0142"],["ZIP","33024 — Pembroke Pines, FL"],["DOB","03/15/1952 (Age 74)"],["Coverage","Original Medicare + PDP"],["Lead Source","AllCalls"]].map(([k,v]) => (
            <div key={k}>
              <div style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
              <div style={{ fontFamily: T.body, fontSize: 14, color: "#ddd", marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[["Mute","🎤"],["Hold","⏸️"],["Transfer","↗️"],["Disposition","📋"],["End Call","📕"]].map(([l,ic]) => (
          <button key={l} style={{
            background: l==="End Call" ? "rgba(231,76,60,0.3)" : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
            padding: "12px 8px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <span style={{ fontSize: 22 }}>{ic}</span>
            <span style={{ fontFamily: T.display, fontSize: 11, color: "#999" }}>{l}</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <ComplianceHub peclItems={peclItems} />
      </div>
    </div>
  );

  const renderCopilot = () => (
    <div style={{ padding: 16 }}>
      <LeadContextPanel />
      {displayResponses.map((resp, i) => (
        <AIResponseCard key={i} resp={resp} scaledFont={scaledFont} opacity={opacity} audioOn={audioOn} screenOn={screenOn} />
      ))}
      {liveCards.length === 0 && shownResponses < aiResponses.length && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <span style={{ fontFamily: T.display, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
            Tap "Ask AI" for next response...
          </span>
        </div>
      )}
    </div>
  );

  const renderTranscript = () => (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Volume2 size={12} color="rgba(255,255,255,0.2)" />
        <span style={{ fontFamily: T.display, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Live Transcript</span>
        {usingLive && <span style={{ fontFamily: T.mono, fontSize: 8, color: "#34C77B", background: "rgba(52,199,123,0.08)", padding: "1px 5px", borderRadius: 3 }}>● live</span>}
        {!usingLive && audioOn && BACKEND_WSS_URL && <span style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(255,255,255,0.3)" }}>connecting…</span>}
        {screenOn && <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(0,123,127,0.6)", marginLeft: "auto" }}>Five9 — Maria Garcia</span>}
      </div>
      {renderedTranscript.map((line, i) => (
        <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: "rgba(255,255,255,0.15)", minWidth: 32 }}>{line.time}</span>
          <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, minWidth: 40, color: line.speaker === "client" ? T.coral : "rgba(255,255,255,0.3)" }}>
            {line.speaker === "client" ? "Client" : "Agent"}
          </span>
          <span style={{ fontFamily: T.body, fontSize: 13, lineHeight: 1.5, flex: 1, color: line.isQuestion ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)", fontWeight: line.isQuestion ? 500 : 400 }}>
            {line.text}
            {line.isQuestion && (
              <span style={{ marginLeft: 6, fontFamily: T.display, fontSize: 9, fontWeight: 700, color: T.teal, background: "rgba(0,123,127,0.15)", padding: "2px 6px", borderRadius: 3, verticalAlign: "middle" }}>? DETECTED</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );

  const renderPanelContent = (key) => {
    if (key === "call") return renderCallInfo();
    if (key === "copilot") return renderCopilot();
    if (key === "transcript") return renderTranscript();
    return null;
  };

  // ─── Shared input bar ───
  const InputBar = () => (
    <div style={{ padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", background: "rgba(0,40,42,0.95)", borderTop: "1px solid rgba(0,123,127,0.2)", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "2px 2px 2px 12px" }}>
          <input placeholder="Ask MediCopilot..." value={inputVal} onChange={e => setInputVal(e.target.value)}
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: T.body, fontSize: 15, color: T.white, padding: "10px 0" }}
          />
          <button onClick={handleAskAI} style={{ background: T.teal, border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
            <Send size={16} color={T.white} />
          </button>
        </div>
        <button onClick={handleAskAI} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "linear-gradient(135deg, #007B7F, #004D50)", border: "none", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
          <Zap size={16} color={T.white} />
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, color: T.white }}>Ask AI</span>
        </button>
      </div>
    </div>
  );

  // ─── Fullscreen overlay (triggered from Full mode) ───
  if (fullPanel) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0a1628", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <button onClick={() => setFullPanel(null)} style={{
          position: "fixed", top: 16, right: 16, zIndex: 1001,
          background: "rgba(0,40,42,0.9)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "50%", width: 38, height: 38,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}>
          <X size={18} color={T.white} />
        </button>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {renderPanelContent(fullPanel)}
        </div>
        <InputBar />
      </div>
    );
  }

  // ─── Context bar (shown in tabs + split modes) ───
  const ContextBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(0,40,42,0.5)", borderBottom: "1px solid rgba(0,123,127,0.08)", flexShrink: 0, flexWrap: "wrap" }}>
      <button onClick={() => setAudioOn(!audioOn)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: audioOn ? "rgba(52,199,123,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${audioOn ? "rgba(52,199,123,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, cursor: "pointer" }}>
        {audioOn ? <Volume2 size={12} color="#34C77B" /> : <MicOff size={12} color="rgba(255,255,255,0.3)" />}
        <AudioWave active={audioOn} color="#34C77B" bars={4} analyser={liveAudio.analyser} />
        <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: audioOn ? "#34C77B" : "rgba(255,255,255,0.3)" }}>{audioOn ? (liveAudio.live ? "Listening" : audioOn && BACKEND_WSS_URL ? "Connecting" : "Listening") : "Muted"}</span>
      </button>
      <button onClick={() => setScreenOn(!screenOn)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: screenOn ? "rgba(0,123,127,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${screenOn ? "rgba(0,123,127,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, cursor: "pointer" }}>
        <Monitor size={12} color={screenOn ? T.teal : "rgba(255,255,255,0.3)"} />
        <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: screenOn ? T.teal : "rgba(255,255,255,0.3)" }}>{screenOn ? "Screen On" : "Screen Off"}</span>
      </button>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "rgba(245,166,35,0.08)", borderRadius: 6 }}>
        <AlertTriangle size={10} color="#F5A623" />
        <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: "#F5A623" }}>MSP</span>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {[{ icon: Heart, label: "MAPD", on: true }, { icon: Coins, label: "Ancillary", on: shownResponses >= 3 }, { icon: Sprout, label: "Life", on: false }].map(({ icon: Ic, label, on }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 6px", borderRadius: 4, background: on ? "rgba(0,123,127,0.12)" : "transparent" }}>
            <Ic size={10} color={on ? T.teal : "rgba(255,255,255,0.12)"} />
            <span style={{ fontFamily: T.display, fontSize: 8, fontWeight: on ? 700 : 400, color: on ? T.teal : "rgba(255,255,255,0.15)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "#0a1628", overflow: "hidden" }}>

      {/* ─── Mobile Header ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "rgba(0,40,42,0.95)", borderBottom: "1px solid rgba(0,123,127,0.2)", flexShrink: 0 }}>
        <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18 }}>
          <span style={{ color: T.white }}>Tri</span><span style={{ color: T.coral }}>B</span><span style={{ color: T.white }}>e</span>
        </span>
        <span style={{ fontFamily: T.display, fontWeight: 400, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>MediCopilot</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "rgba(52,199,123,0.1)", borderRadius: 6 }}>
          <Phone size={10} color="#34C77B" />
          <span style={{ fontFamily: T.mono, fontSize: 10, color: "#34C77B" }}>8:12</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 6 }}>
          <Shield size={10} color={T.teal} />
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal }}>{peclDone}/5</span>
        </div>
      </div>

      {/* ─── View Mode Toggle Bar ─── */}
      <div style={{ display: "flex", gap: 4, padding: "8px 16px", background: "rgba(0,40,42,0.85)", borderBottom: "1px solid rgba(0,123,127,0.15)", flexShrink: 0 }}>
        {[
          { key: "tabs", label: "Tabs", icon: Menu },
          { key: "split", label: "Split", icon: GripVertical },
          { key: "full", label: "Full", icon: Maximize2 },
        ].map(({ key, label, icon: Ic }) => (
          <button key={key} onClick={() => setViewMode(key)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            padding: "7px 0", border: "none", borderRadius: 8, cursor: "pointer",
            background: viewMode === key ? "rgba(0,123,127,0.25)" : "rgba(255,255,255,0.04)",
            outline: viewMode === key ? `1px solid rgba(0,123,127,0.5)` : "1px solid rgba(255,255,255,0.06)",
          }}>
            <Ic size={13} color={viewMode === key ? T.teal : "rgba(255,255,255,0.35)"} />
            <span style={{ fontFamily: T.display, fontSize: 11, fontWeight: viewMode === key ? 700 : 400, color: viewMode === key ? T.teal : "rgba(255,255,255,0.35)" }}>{label}</span>
          </button>
        ))}
      </div>

      {/* ─── TABS MODE ─── */}
      {viewMode === "tabs" && <>
        <div style={{ display: "flex", gap: 0, flexShrink: 0, background: "rgba(0,40,42,0.7)", borderBottom: "1px solid rgba(0,123,127,0.15)" }}>
          {panelDefs.map(({ key, label, icon: Ic }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0", border: "none", cursor: "pointer",
              background: tab === key ? "rgba(0,123,127,0.15)" : "transparent",
              borderBottom: tab === key ? `2px solid ${T.teal}` : "2px solid transparent",
            }}>
              <Ic size={14} color={tab === key ? T.teal : "rgba(255,255,255,0.3)"} />
              <span style={{ fontFamily: T.display, fontSize: 12, fontWeight: tab === key ? 700 : 400, color: tab === key ? T.teal : "rgba(255,255,255,0.3)" }}>{label}</span>
            </button>
          ))}
        </div>
        <ContextBar />
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {renderPanelContent(tab)}
        </div>
        <InputBar />
      </>}

      {/* ─── SPLIT MODE ─── */}
      {viewMode === "split" && <>
        {/* Panel picker — tap to swap which 2 panels are shown */}
        <div style={{ display: "flex", gap: 4, padding: "6px 16px", background: "rgba(0,40,42,0.65)", borderBottom: "1px solid rgba(0,123,127,0.1)", flexShrink: 0 }}>
          {panelDefs.map(({ key, label, icon: Ic }) => {
            const selected = splitPanels.includes(key);
            return (
              <button key={key} onClick={() => toggleSplitPanel(key)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "5px 0", border: "none", borderRadius: 6, cursor: "pointer",
                background: selected ? "rgba(0,123,127,0.2)" : "rgba(255,255,255,0.04)",
                outline: selected ? "1px solid rgba(0,123,127,0.4)" : "1px solid rgba(255,255,255,0.06)",
              }}>
                <Ic size={12} color={selected ? T.teal : "rgba(255,255,255,0.3)"} />
                <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: selected ? 700 : 400, color: selected ? T.teal : "rgba(255,255,255,0.3)" }}>{label}</span>
              </button>
            );
          })}
        </div>
        <ContextBar />
        {/* Two panels side by side */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {splitPanels.map((key, i) => (
            <div key={key} style={{ flex: 1, overflowY: "auto", borderRight: i === 0 ? "1px solid rgba(0,123,127,0.2)" : "none" }}>
              {renderPanelContent(key)}
            </div>
          ))}
        </div>
        <InputBar />
      </>}

      {/* ─── FULL MODE ─── */}
      {viewMode === "full" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", gap: 14 }}>
          <span style={{ fontFamily: T.display, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Tap a panel to expand
          </span>
          {panelDefs.map(({ key, label, icon: Ic }) => (
            <button key={key} onClick={() => setFullPanel(key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 16,
              padding: "18px 20px", border: "1px solid rgba(0,123,127,0.2)",
              borderRadius: 14, cursor: "pointer", background: "rgba(0,40,42,0.6)",
              textAlign: "left",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(0,123,127,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ic size={22} color={T.teal} />
              </div>
              <div>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: T.white }}>{label}</div>
                <div style={{ fontFamily: T.body, fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>Tap to expand fullscreen</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <Maximize2 size={18} color="rgba(255,255,255,0.2)" />
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

// ═══════════════════════════════════════
//  DESKTOP: MediCopilot Overlay (original)
// ═══════════════════════════════════════

function MediCopilotOverlay({ mode, setMode, opacity }) {
  const [inputVal, setInputVal] = useState("");
  const [audioOn, setAudioOn] = useState(true);
  const [screenOn, setScreenOn] = useState(true);
  const [visibleTranscript, setVisibleTranscript] = useState(6);
  const [shownResponses, setShownResponses] = useState(1);
  const [tick, setTick] = useState(0);
  const [textScale, setTextScale] = useState(1);
  const [viewMode, setViewMode] = useState("tabs"); // "tabs" | "split" | "full"
  const [activeTab, setActiveTab] = useState("copilot");
  const [splitPanels, setSplitPanels] = useState(["transcript", "copilot"]);
  const [fullPanel, setFullPanel] = useState(null);
  const [splitPct, setSplitPct] = useState(50);
  const splitContainerRef = useRef(null);
  const splitDragging = useRef(false);

  // Live audio pipeline (see MobileLayout for the matching wiring).
  const liveAudio = useLiveAudio({ url: BACKEND_WSS_URL, enabled: audioOn });
  useAudioErrorToasts(liveAudio);
  const { lead: ctxLead } = useLead();
  useLeadContextPush(liveAudio, ctxLead);
  const liveLines = mapLiveTranscripts(liveAudio.transcripts);
  const usingLive = liveLines.length > 0;
  const renderedTranscript = usingLive
    ? liveLines
    : transcriptLines.slice(0, visibleTranscript);
  const latestTranscriptText = usingLive
    ? liveLines[liveLines.length - 1].text
    : transcriptLines[Math.min(visibleTranscript - 1, transcriptLines.length - 1)].text;
  const liveCards = liveSuggestionsToCards(liveAudio.suggestions);
  const collapsed = useDraggable(620, 55);
  const expanded = useDraggable(560, 30);
  const hidden = useDraggable(820, 55);
  const { size: panelSize, onResizeStart } = useResizable(440, 600, 300, 200);
  const { size: collapsedSize, onResizeStart: onCollapsedResizeStart } = useResizable(390, 240, 300, 160);
  const scaledFont = (base) => Math.round(base * textScale);
  const cycleTextSize = () => setTextScale(s => {
    const steps = [0.85, 1, 1.15, 1.3];
    return steps[(steps.indexOf(s) + 1) % steps.length];
  });

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 300);
    return () => clearInterval(iv);
  }, []);

  const onSplitDividerDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    splitDragging.current = true;
  }, []);

  useEffect(() => {
    const mv = (e) => {
      if (!splitDragging.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      setSplitPct(Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100)));
    };
    const up = () => { splitDragging.current = false; };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, []);

  const peclItems = mergePeclItems(DEFAULT_PECL_ITEMS, liveAudio.autoPecl);
  const peclDone = peclItems.filter(i => i.done).length;
  const clearBg = (a) => `rgba(0, 40, 42, ${a})`;
  const clearBorder = (a) => `1px solid rgba(0, 123, 127, ${a})`;

  const handleAskAI = () => {
    if (shownResponses < aiResponses.length) setShownResponses(s => s + 1);
    if (visibleTranscript < transcriptLines.length) setVisibleTranscript(v => Math.min(v + 2, transcriptLines.length));
  };

  const panelDefs = [
    { key: "call", label: "Call Info", icon: Phone },
    { key: "copilot", label: "AI Copilot", icon: Zap },
    { key: "transcript", label: "Transcript", icon: Volume2 },
  ];

  const toggleSplitPanel = (key) => {
    if (splitPanels.includes(key)) return;
    setSplitPanels(prev => [prev[1], key]);
  };

  // ─── Desktop panel content renderers ───
  const renderDesktopCallInfo = () => (
    <div style={{ padding: "8px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "#34C77B", boxShadow: "0 0 6px rgba(52,199,123,0.4)" }} />
        <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 12, color: "#34C77B" }}>CONNECTED</span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dusk }}>08:12</span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: "#666", marginBottom: 10 }}>Campaign: AEP_MAPD_FL</div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[["Caller","Maria Garcia"],["Phone","(954) 555-0142"],["ZIP","33024 — Pembroke Pines, FL"],["DOB","03/15/1952 (Age 74)"],["Coverage","Original Medicare + PDP"],["Lead Source","AllCalls"]].map(([k,v]) => (
            <div key={k}>
              <div style={{ fontFamily: T.display, fontSize: 8, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
              <div style={{ fontFamily: T.body, fontSize: 11, color: "#ddd", marginTop: 1 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 10 }}>
        {[["Mute","🎤"],["Hold","⏸️"],["Transfer","↗️"],["Disposition","📋"],["End Call","📕"]].map(([l,ic]) => (
          <button key={l} style={{ background: l==="End Call" ? "rgba(231,76,60,0.3)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 16 }}>{ic}</span>
            <span style={{ fontFamily: T.display, fontSize: 9, color: "#999" }}>{l}</span>
          </button>
        ))}
      </div>
      <ComplianceHub peclItems={peclItems} compact />
    </div>
  );

  const renderDesktopTranscript = () => (
    <div style={{ padding: "6px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Volume2 size={10} color="rgba(255,255,255,0.2)" />
        <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Live Transcript</span>
        {usingLive && <span style={{ fontFamily: T.mono, fontSize: 8, color: "#34C77B", background: "rgba(52,199,123,0.08)", padding: "1px 5px", borderRadius: 3 }}>● live</span>}
        {!usingLive && audioOn && BACKEND_WSS_URL && <span style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(255,255,255,0.3)" }}>connecting…</span>}
        {screenOn && <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(0,123,127,0.6)", marginLeft: "auto" }}>Five9 — Maria Garcia, 33024</span>}
      </div>
      {renderedTranscript.map((line, i) => (
        <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", alignItems: "flex-start" }}>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.15)", minWidth: 28 }}>{line.time}</span>
          <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, minWidth: 40, color: line.speaker === "client" ? T.coral : "rgba(255,255,255,0.3)" }}>
            {line.speaker === "client" ? "Client" : "Agent"}
          </span>
          <span style={{ fontFamily: T.body, fontSize: scaledFont(12), lineHeight: 1.45, color: line.isQuestion ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)", fontWeight: line.isQuestion ? 500 : 400 }}>
            {line.text}
            {line.isQuestion && <span style={{ marginLeft: 6, fontFamily: T.display, fontSize: 8, fontWeight: 700, color: T.teal, background: "rgba(0,123,127,0.15)", padding: "1px 5px", borderRadius: 3, verticalAlign: "middle" }}>? DETECTED</span>}
          </span>
        </div>
      ))}
    </div>
  );

  const renderDesktopCopilot = () => {
    const resp = liveCards.length > 0
      ? liveCards[liveCards.length - 1]
      : aiResponses[shownResponses - 1];
    // Each pill carries a `field` identifier that maps back to a LeadContext
    // field name. Hovering the pill highlights the matching cell in
    // LeadContextPanel (spec §A3). When no underlying lead field applies
    // (e.g. a plan ID), field is null and the pill is a plain label.
    const sourcesByTrigger = {
      "what plans would cover my Eliquis": [
        { label: "ZIP 33024", field: "address" },
        { label: "Rx: Eliquis", field: "medications" },
        { label: "Coverage: Original Medicare", field: "coverage" },
      ],
      "Dr. Patel at Baptist Health": [
        { label: "PCP: Dr. Patel", field: "providers" },
        { label: "Plan: Humana S5884-065", field: null },
      ],
      "what about dental": [
        { label: "ZIP 33024", field: "address" },
        { label: "Coverage gap: dental", field: "coverage" },
      ],
    };
    const sources = sourcesByTrigger[resp.trigger];
    return (
      <div>
        <LeadContextPanel scaledFont={scaledFont} />
        <div style={{ padding: "8px 14px" }}>
        {/* Detected trigger + source chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(0,123,127,0.1)", border: "1px solid rgba(0,123,127,0.2)", borderRadius: 20 }}>
            <Bot size={9} color={T.teal} />
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.teal }}>"{resp.trigger}"</span>
          </div>
          <div style={{ flex: 1 }} />
          {audioOn && <span style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(52,199,123,0.5)", background: "rgba(52,199,123,0.06)", padding: "1px 5px", borderRadius: 3 }}>🎙 audio</span>}
          {screenOn && <span style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(0,123,127,0.5)", background: "rgba(0,123,127,0.06)", padding: "1px 5px", borderRadius: 3 }}>🖥 screen</span>}
        </div>

        {/* ── Say this: ── */}
        <div style={{ marginBottom: 10, background: "rgba(0,123,127,0.09)", border: "1px solid rgba(0,123,127,0.28)", borderLeft: `3px solid ${T.teal}`, borderRadius: "0 8px 8px 0", padding: "10px 12px" }}>
          <div style={{ fontFamily: T.display, fontSize: 9, fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Say this:</div>
          <div style={{ fontFamily: T.body, fontSize: scaledFont(13), lineHeight: 1.65, color: "rgba(255,255,255,0.92)" }}>{resp.sayThis}</div>
        </div>

        {/* ── If they press more: ── */}
        {resp.pressMore && (
          <div style={{ marginBottom: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ fontFamily: T.display, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>If they press more, add this:</div>
            {resp.pressMore.map((point, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0" }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.teal, flexShrink: 0, lineHeight: 1.45 }}>›</span>
                <span style={{ fontFamily: T.body, fontSize: scaledFont(12), color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{point}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Follow-up questions: ── */}
        {resp.followUps && (
          <div style={{ marginBottom: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ fontFamily: T.display, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>Follow-up questions:</div>
            {resp.followUps.map((q, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0" }}>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.coral, flexShrink: 0, lineHeight: 1.5 }}>?</span>
                <span style={{ fontFamily: T.body, fontStyle: "italic", fontSize: scaledFont(12), color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{q}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Compliance note ── */}
        {resp.compliance && (
          <div style={{ display: "flex", gap: 6, padding: "6px 8px", background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.14)", borderRadius: 6, marginBottom: 8 }}>
            <Shield size={10} color="#F5A623" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: T.body, fontSize: scaledFont(10), color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{resp.compliance}</span>
          </div>
        )}

        {/* Sources row */}
        <SourcesRow sources={sources} />

        {/* Response counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.18)" }}>{shownResponses} / {aiResponses.length} responses</span>
          {shownResponses < aiResponses.length && (
            <span style={{ fontFamily: T.display, fontSize: 9, color: "rgba(255,255,255,0.18)" }}>· click Ask AI for next</span>
          )}
        </div>
        </div>
      </div>
    );
  };

  const renderPanelContent = (key) => {
    if (key === "call") return renderDesktopCallInfo();
    if (key === "copilot") return renderDesktopCopilot();
    if (key === "transcript") return renderDesktopTranscript();
    return null;
  };

  // ─── Shared desktop input bar ───
  const DesktopInputBar = ({ style = {} }) => (
    <div data-no-drag="true" style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", cursor: "default", flexShrink: 0, ...style }}>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "2px 2px 2px 12px" }}>
          <input placeholder="Type or press ⌘Enter for AI response..." value={inputVal} onChange={e => setInputVal(e.target.value)}
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: T.body, fontSize: scaledFont(13), color: T.white, padding: "10px 0" }} />
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}><Mic size={15} color="rgba(255,255,255,0.2)" /></button>
          <button onClick={handleAskAI} style={{ background: T.teal, border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}><Send size={14} color={T.white} /></button>
        </div>
        <button onClick={handleAskAI} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 16px", background: "linear-gradient(135deg, #007B7F, #004D50)", border: "none", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Zap size={14} color={T.white} />
            <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 12, color: T.white }}>Ask AI</span>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(255,255,255,0.45)", letterSpacing: "0.02em" }}>⌘ Enter</span>
        </button>
      </div>
    </div>
  );

  // ─── HIDDEN ───
  if (mode === "hidden") {
    return (
      <div onMouseDown={hidden.onMouseDown} style={{ position: "absolute", left: hidden.pos.x, top: hidden.pos.y, cursor: "grab", userSelect: "none", zIndex: 100 }}>
        <button data-no-drag="true" onClick={() => setMode("collapsed")} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
          background: clearBg(opacity * 0.7), border: clearBorder(0.4), borderRadius: 20, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}>
          <Eye size={12} color={T.teal} />
          <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 10, color: T.teal }}>TriBe</span>
          {audioOn && <AudioWave active bars={3} analyser={liveAudio.analyser} />}
          <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>⌘⇧S</span>
        </button>
      </div>
    );
  }

  // ─── COLLAPSED ───
  if (mode === "collapsed") {
    const latestResp = liveCards.length > 0
      ? liveCards[liveCards.length - 1]
      : aiResponses[shownResponses - 1];
    return (
      <div onMouseDown={collapsed.onMouseDown} style={{
        position: "absolute", left: collapsed.pos.x, top: collapsed.pos.y,
        width: collapsedSize.w, height: collapsedSize.h,
        display: "flex", flexDirection: "column",
        zIndex: 100, background: clearBg(opacity), border: clearBorder(0.4),
        borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        cursor: "grab", userSelect: "none",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", flexShrink: 0 }}>
          <GripVertical size={14} color="rgba(255,255,255,0.25)" />
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: scaledFont(14) }}>
            <span style={{ color: T.white }}>Tri</span><span style={{ color: T.coral }}>B</span><span style={{ color: T.white }}>e</span>
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: audioOn ? "rgba(52,199,123,0.1)" : "rgba(255,255,255,0.04)", borderRadius: 6 }}>
            {audioOn ? <Volume2 size={11} color="#34C77B" /> : <MicOff size={11} color="rgba(255,255,255,0.3)" />}
            <AudioWave active={audioOn} color="#34C77B" bars={4} analyser={liveAudio.analyser} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: screenOn ? "rgba(0,123,127,0.1)" : "rgba(255,255,255,0.04)", borderRadius: 6 }}>
            <Monitor size={11} color={screenOn ? T.teal : "rgba(255,255,255,0.3)"} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 6 }}>
            <Shield size={11} color={T.teal} />
            <span style={{ fontFamily: T.mono, fontSize: scaledFont(10), color: T.teal }}>{peclDone}/5</span>
          </div>
          <button data-no-drag="true" onClick={cycleTextSize} title={`Text: ${Math.round(textScale * 100)}%`} style={{ display: "flex", alignItems: "center", gap: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, cursor: "pointer", padding: "2px 5px" }}>
            <span style={{ fontFamily: T.display, fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>A</span>
            <span style={{ fontFamily: T.display, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>A</span>
          </button>
          <button data-no-drag="true" onClick={() => setMode("expanded")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <Maximize2 size={14} color="rgba(255,255,255,0.5)" />
          </button>
          <button data-no-drag="true" onClick={() => setMode("hidden")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <EyeOff size={14} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        {/* Scrollable content */}
        <div data-no-drag="true" style={{ flex: 1, overflowY: "auto", padding: "0 12px 6px", cursor: "default" }}>
          {/* Transcript snippet */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", marginBottom: 6, background: "rgba(255,255,255,0.03)", borderRadius: 6, borderLeft: "2px solid rgba(52,199,123,0.4)" }}>
            <Volume2 size={10} color="rgba(255,255,255,0.3)" />
            <span style={{ fontFamily: T.body, fontStyle: "italic", fontSize: scaledFont(11), color: "rgba(255,255,255,0.5)", flex: 1 }}>
              "{latestTranscriptText.slice(0, 65)}{latestTranscriptText.length > 65 ? "..." : ""}"
            </span>
          </div>
          {/* Say this: preview */}
          <div style={{ background: "rgba(0,123,127,0.09)", border: "1px solid rgba(0,123,127,0.25)", borderLeft: `3px solid ${T.teal}`, borderRadius: "0 8px 8px 0", padding: "8px 10px" }}>
            <div style={{ fontFamily: T.display, fontSize: 8, fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Say this:</div>
            <div style={{ fontFamily: T.body, fontSize: scaledFont(12), color: `rgba(255,255,255,${Math.min(opacity + 0.1, 0.95)})`, lineHeight: 1.55 }}>{latestResp.sayThis}</div>
          </div>
        </div>

        {/* Input bar */}
        <div data-no-drag="true" style={{ padding: "6px 12px 8px", display: "flex", gap: 6, flexShrink: 0, cursor: "default" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "2px 2px 2px 10px" }}>
            <input placeholder="What should I say?" value={inputVal} onChange={e => setInputVal(e.target.value)}
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: T.body, fontSize: scaledFont(12), color: T.white, padding: "7px 0" }} />
            <button onClick={handleAskAI} style={{ background: T.teal, border: "none", borderRadius: 8, padding: "7px 10px", cursor: "pointer" }}><Send size={12} color={T.white} /></button>
          </div>
          <button onClick={handleAskAI} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "linear-gradient(135deg, #007B7F, #004D50)", border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
            <Zap size={13} color={T.white} />
            <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: scaledFont(11), color: T.white }}>Ask AI</span>
          </button>
        </div>

        {/* Hotkey hints */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "4px 12px 6px", borderTop: "1px solid rgba(255,255,255,0.03)", flexShrink: 0 }}>
          {[["⌘↩","Ask AI"],["⌘⇧H","Hide"],["⌘⇧E","Expand"],["⌘⇧M","Mic"]].map(([k,l]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", padding: "1px 4px", borderRadius: 3 }}>{k}</span>
              <span style={{ fontFamily: T.display, fontSize: 8, color: "rgba(255,255,255,0.1)" }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Resize handle */}
        <div data-no-drag="true" onMouseDown={onCollapsedResizeStart} style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, cursor: "nwse-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <svg width="9" height="9" viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
            <line x1="9" y1="1" x2="1" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="5" x2="5" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="8" x2="8" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  }

  // ─── EXPANDED ───
  return (
    <>
      {/* Fullscreen overlay (Full mode panel expansion) */}
      {fullPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0a1628", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <button onClick={() => setFullPanel(null)} style={{
            position: "fixed", top: 16, right: 16, zIndex: 201,
            background: "rgba(0,40,42,0.9)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "50%", width: 38, height: 38,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>
            <X size={18} color={T.white} />
          </button>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {renderPanelContent(fullPanel)}
          </div>
          <DesktopInputBar />
        </div>
      )}

      {/* Floating expanded card */}
      <div onMouseDown={expanded.onMouseDown} style={{
        position: "absolute", left: expanded.pos.x, top: expanded.pos.y,
        width: panelSize.w, height: panelSize.h, zIndex: 100, background: clearBg(opacity), border: clearBorder(0.35),
        borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 48px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column", cursor: "grab", userSelect: "none",
      }}>
        {/* ─── Title bar ─── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <GripVertical size={14} color="rgba(255,255,255,0.25)" />
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16 }}>
            <span style={{ color: T.white }}>Tri</span><span style={{ color: T.coral }}>B</span><span style={{ color: T.white }}>e</span>
          </span>
          <span style={{ fontFamily: T.display, fontWeight: 400, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>MediCopilot</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(52,199,123,0.1)", borderRadius: 6 }}>
            <Phone size={10} color="#34C77B" />
            <span style={{ fontFamily: T.mono, fontSize: 10, color: "#34C77B" }}>8:12</span>
          </div>
          <button data-no-drag="true" onClick={cycleTextSize} title={`Text: ${Math.round(textScale * 100)}%`} style={{ display: "flex", alignItems: "center", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, cursor: "pointer", padding: "2px 6px", marginRight: 2 }}>
            <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>A</span>
            <span style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>A</span>
          </button>
          <button data-no-drag="true" onClick={() => setMode("collapsed")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Minimize2 size={14} color="rgba(255,255,255,0.5)" /></button>
          <button data-no-drag="true" onClick={() => setMode("hidden")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><EyeOff size={14} color="rgba(255,255,255,0.5)" /></button>
        </div>

        {/* ─── View Mode Toggle Bar ─── */}
        <div data-no-drag="true" style={{ display: "flex", gap: 4, padding: "6px 14px", background: "rgba(0,0,0,0.12)", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          {[
            { key: "tabs", label: "Tabs", icon: Menu },
            { key: "split", label: "Split", icon: GripVertical },
            { key: "full", label: "Full", icon: Maximize2 },
          ].map(({ key, label, icon: Ic }) => (
            <button key={key} onClick={() => setViewMode(key)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "5px 0", border: "none", borderRadius: 6, cursor: "pointer",
              background: viewMode === key ? "rgba(0,123,127,0.2)" : "rgba(255,255,255,0.03)",
              outline: viewMode === key ? "1px solid rgba(0,123,127,0.4)" : "1px solid rgba(255,255,255,0.04)",
            }}>
              <Ic size={11} color={viewMode === key ? T.teal : "rgba(255,255,255,0.3)"} />
              <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: viewMode === key ? 700 : 400, color: viewMode === key ? T.teal : "rgba(255,255,255,0.3)" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* ─── Context bar ─── */}
        <div data-no-drag="true" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          <button onClick={() => setAudioOn(!audioOn)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: audioOn ? "rgba(52,199,123,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${audioOn ? "rgba(52,199,123,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, cursor: "pointer" }}>
            {audioOn ? <Volume2 size={11} color="#34C77B" /> : <MicOff size={11} color="rgba(255,255,255,0.3)" />}
            <AudioWave active={audioOn} color="#34C77B" bars={4} analyser={liveAudio.analyser} />
            <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: audioOn ? "#34C77B" : "rgba(255,255,255,0.3)" }}>{audioOn ? (liveAudio.live ? "Listening" : (BACKEND_WSS_URL ? "Connecting" : "Listening")) : "Muted"}</span>
          </button>
          <button onClick={() => setScreenOn(!screenOn)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: screenOn ? "rgba(0,123,127,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${screenOn ? "rgba(0,123,127,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, cursor: "pointer" }}>
            <Monitor size={11} color={screenOn ? T.teal : "rgba(255,255,255,0.3)"} />
            <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: screenOn ? T.teal : "rgba(255,255,255,0.3)" }}>{screenOn ? "Screen On" : "Screen Off"}</span>
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(245,166,35,0.08)", borderRadius: 6 }}>
            <AlertTriangle size={10} color="#F5A623" />
            <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: "#F5A623" }}>MSP</span>
          </div>
          <span style={{ fontFamily: T.display, fontSize: 9, color: "rgba(255,255,255,0.25)" }}>PECL</span>
          <div style={{ width: 40, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
            <div style={{ width: `${(peclDone/5)*100}%`, height: 3, background: T.teal, borderRadius: 2 }} />
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.teal }}>{peclDone}/5</span>
        </div>

        {/* ─── TABS mode ─── */}
        {viewMode === "tabs" && <>
          <div data-no-drag="true" style={{ display: "flex", gap: 0, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {panelDefs.map(({ key, label, icon: Ic }) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                padding: "8px 0", border: "none", cursor: "pointer",
                background: activeTab === key ? "rgba(0,123,127,0.12)" : "transparent",
                borderBottom: activeTab === key ? `2px solid ${T.teal}` : "2px solid transparent",
              }}>
                <Ic size={11} color={activeTab === key ? T.teal : "rgba(255,255,255,0.3)"} />
                <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: activeTab === key ? 700 : 400, color: activeTab === key ? T.teal : "rgba(255,255,255,0.3)" }}>{label}</span>
              </button>
            ))}
          </div>
          <div data-no-drag="true" style={{ flex: 1, overflowY: "auto", minHeight: 0, cursor: "default" }}>
            {renderPanelContent(activeTab)}
          </div>
        </>}

        {/* ─── SPLIT mode ─── */}
        {viewMode === "split" && <>
          <div data-no-drag="true" style={{ display: "flex", gap: 4, padding: "5px 14px", background: "rgba(0,0,0,0.08)", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            {panelDefs.map(({ key, label, icon: Ic }) => {
              const selected = splitPanels.includes(key);
              return (
                <button key={key} onClick={() => toggleSplitPanel(key)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                  padding: "4px 0", border: "none", borderRadius: 5, cursor: "pointer",
                  background: selected ? "rgba(0,123,127,0.18)" : "rgba(255,255,255,0.03)",
                  outline: selected ? "1px solid rgba(0,123,127,0.35)" : "1px solid rgba(255,255,255,0.04)",
                }}>
                  <Ic size={10} color={selected ? T.teal : "rgba(255,255,255,0.3)"} />
                  <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: selected ? 700 : 400, color: selected ? T.teal : "rgba(255,255,255,0.3)" }}>{label}</span>
                </button>
              );
            })}
          </div>
          <div ref={splitContainerRef} data-no-drag="true" style={{ flex: 1, display: "flex", minHeight: 0, cursor: "default", overflow: "hidden" }}>
            {/* Left panel */}
            <div style={{ width: `${splitPct}%`, overflowY: "auto", flexShrink: 0, minWidth: 0 }}>
              {renderPanelContent(splitPanels[0])}
            </div>
            {/* Draggable vertical divider */}
            <div
              onMouseDown={onSplitDividerDown}
              style={{
                width: 9, flexShrink: 0, cursor: "col-resize", userSelect: "none",
                background: "rgba(0,123,127,0.18)",
                borderLeft: "1px solid rgba(0,123,127,0.35)",
                borderRight: "1px solid rgba(0,123,127,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,123,127,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,123,127,0.18)"; }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3, pointerEvents: "none" }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: T.teal, opacity: 0.7 }} />
                ))}
              </div>
            </div>
            {/* Right panel */}
            <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
              {renderPanelContent(splitPanels[1])}
            </div>
          </div>
        </>}

        {/* ─── FULL mode ─── */}
        {viewMode === "full" && (
          <div data-no-drag="true" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 14px", gap: 10, cursor: "default" }}>
            <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Click a panel to expand fullscreen</span>
            {panelDefs.map(({ key, label, icon: Ic }) => (
              <button key={key} onClick={() => setFullPanel(key)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", border: "1px solid rgba(0,123,127,0.18)",
                borderRadius: 10, cursor: "pointer", background: "rgba(0,40,42,0.5)", textAlign: "left",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,123,127,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ic size={18} color={T.teal} />
                </div>
                <div>
                  <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, color: T.white }}>{label}</div>
                  <div style={{ fontFamily: T.body, fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Click to expand fullscreen</div>
                </div>
                <div style={{ marginLeft: "auto" }}><Maximize2 size={14} color="rgba(255,255,255,0.2)" /></div>
              </button>
            ))}
          </div>
        )}

        {/* ─── Input bar ─── */}
        <DesktopInputBar />

        {/* ─── Resize handle ─── */}
        <div data-no-drag="true" onMouseDown={onResizeStart} style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, cursor: "nwse-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
            <line x1="9" y1="1" x2="1" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="5" x2="5" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="8" x2="8" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════
//  MAIN — switches between mobile & desktop
// ═══════════════════════════════════════

export default function MacOSDesktopMockup() {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState("expanded");
  const [opacity, setOpacity] = useState(0.82);

  if (isMobile) return <MobileLayout />;

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1a1a3e 0%, #2d1b4e 25%, #0f3460 50%, #16213e 75%, #1a1a2e 100%)" }}>
        <div style={{ position: "absolute", top: "15%", left: "20%", width: 400, height: 400, borderRadius: "50%", background: "rgba(0,123,127,0.08)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: "20%", right: "30%", width: 300, height: 300, borderRadius: "50%", background: "rgba(244,124,110,0.06)", filter: "blur(60px)" }} />
      </div>
      <MacMenuBar />
      <Five9Window />
      <MediCopilotOverlay mode={mode} setMode={setMode} opacity={opacity} />
      <MacDock />
      <div style={{ position: "absolute", top: 32, left: "50%", transform: "translateX(-50%)", padding: "4px 12px", background: "rgba(0,0,0,0.5)", borderRadius: 8, fontFamily: T.display, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
        Drag MediCopilot anywhere · Click "Ask AI" or ⌘Enter to see next response
      </div>
      <div style={{ position: "absolute", bottom: 65, left: 16, display: "flex", gap: 6, padding: "8px 12px", alignItems: "center", background: "rgba(0,0,0,0.6)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }}>
        <span style={{ fontFamily: T.display, fontSize: 10, color: "rgba(255,255,255,0.5)", marginRight: 4 }}>Demo:</span>
        {["collapsed", "expanded", "hidden"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
            fontFamily: T.display, fontSize: 10, fontWeight: mode === m ? 700 : 400,
            background: mode === m ? T.teal : "rgba(255,255,255,0.08)",
            color: mode === m ? T.white : "rgba(255,255,255,0.4)",
          }}>{m}</button>
        ))}
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
        <span style={{ fontFamily: T.display, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Opacity:</span>
        <input type="range" min="0.15" max="0.95" step="0.01" value={opacity}
          onChange={e => setOpacity(parseFloat(e.target.value))}
          style={{ width: 80, accentColor: T.teal }} />
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal }}>{Math.round(opacity * 100)}%</span>
      </div>
    </div>
  );
}
