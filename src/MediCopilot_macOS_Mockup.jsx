import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Coins, Sprout, Shield, CheckCircle, Circle, AlertTriangle, Send, ChevronRight, Eye, EyeOff, Maximize2, Minimize2, Phone, User, Bot, Mic, MicOff, Monitor, GripVertical, Zap, Volume2, GripHorizontal, Menu, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  MOCK_LEADS,
  RECENT_LEADS,
  transcriptLines,
  aiResponses,
  DEFAULT_PECL_ITEMS,
} from "./data/index.js";

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
function AudioWave({ active, color = T.teal, bars = 5 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 16 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          width: 2, borderRadius: 1,
          background: active ? color : "rgba(255,255,255,0.15)",
          height: active ? `${6 + Math.sin(Date.now() / 200 + i * 1.2) * 5}px` : 4,
          animation: active ? `wave${i} 0.6s ease-in-out ${i * 0.1}s infinite alternate` : "none",
          transition: "height 0.15s ease",
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
  const [stage, setStage] = useState("choose"); // choose | selecting | extracting | review
  const [source, setSource] = useState(null); // "region" | "screen" | "manual"
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState(null);
  const [marquee, setMarquee] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [marqueeDone, setMarqueeDone] = useState(false);

  // Animate the marquee drawing in the "selecting" stage (mock drag)
  useEffect(() => {
    if (stage !== "selecting") return;
    setMarqueeDone(false);
    const target = { x: 48, y: 80, w: 310, h: 150 };
    const startX = 78, startY = 120;
    setMarquee({ x: startX, y: startY, w: 0, h: 0 });
    let t = 0;
    const iv = setInterval(() => {
      t += 1;
      const p = Math.min(t / 18, 1);
      setMarquee({
        x: startX - (startX - target.x) * p,
        y: startY - (startY - target.y) * p,
        w: target.w * p,
        h: target.h * p,
      });
      if (p >= 1) {
        clearInterval(iv);
        setMarqueeDone(true);
      }
    }, 40);
    return () => clearInterval(iv);
  }, [stage]);

  useEffect(() => {
    if (stage !== "extracting") return;
    setProgress(0);
    const iv = setInterval(() => {
      setProgress(p => {
        const np = p + 12;
        if (np >= 100) {
          clearInterval(iv);
          setExtracted({
            Name: { v: "Harold Weaver", pill: "high" },
            DOB: { v: "Jul 09, 1955", pill: "medium" },
            Phone: { v: "(786) 555-0319", pill: "high" },
            "Address · ZIP": { v: "Hialeah, FL 33013", pill: "medium" },
            Coverage: { v: "Original Medicare (Part A only)", pill: "low" },
          });
          setStage("review");
          return 100;
        }
        return np;
      });
    }, 180);
    return () => clearInterval(iv);
  }, [stage]);

  const startExtract = (src) => {
    setSource(src);
    if (src === "manual") {
      setExtracted({
        Name: { v: "", pill: "low" },
        DOB: { v: "", pill: "low" },
        Phone: { v: "", pill: "low" },
        "Address · ZIP": { v: "", pill: "low" },
        Coverage: { v: "", pill: "low" },
      });
      setStage("review");
    } else if (src === "region") {
      setStage("selecting");
    } else {
      setStage("extracting");
    }
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
        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: T.teal }}>⊕ Capture lead</span>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
            {stage === "choose" && "· choose source"}
            {stage === "selecting" && "· drag to select a region"}
            {stage === "extracting" && `· extracting from ${source === "region" ? "region" : "screen"}`}
            {stage === "review" && "· review & commit"}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <X size={14} color="rgba(255,255,255,0.4)" />
          </button>
        </div>

        {stage === "choose" && (
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { k: "region", icon: "◩", title: "Select region", sub: "Drag a box around any fields on screen" },
              { k: "screen", icon: "🖥", title: "Full window", sub: "Grab the active Five9 / CRM window" },
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
        )}

        {stage === "selecting" && (
          <div style={{ padding: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
              Crosshair active · dim layer covering desktop · drag to draw a region around the fields you want captured.
            </div>
            {/* Mock "desktop" with a Five9 card underneath */}
            <div style={{
              position: "relative", height: 240, borderRadius: 10, overflow: "hidden",
              background: "linear-gradient(135deg, #1a2230, #0d1520)",
              border: "1px solid rgba(255,255,255,0.06)",
              cursor: "crosshair",
            }}>
              {/* Faux Five9 lead card */}
              <div style={{
                position: "absolute", left: 32, top: 64, width: 340, padding: "12px 14px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
              }}>
                <div style={{ fontFamily: T.mono, fontSize: 8, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Five9 · Inbound · 08:14</div>
                <div style={{ fontFamily: T.body, fontSize: 11, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>
                  <div><b>Caller:</b> Harold Weaver</div>
                  <div><b>DOB:</b> 07/09/1955 · Age 70</div>
                  <div><b>Phone:</b> (786) 555-0319</div>
                  <div><b>Address:</b> Hialeah, FL 33013</div>
                  <div><b>Coverage:</b> Medicare Part A only</div>
                </div>
              </div>
              {/* Dimming overlay with cut-out for marquee */}
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
              }} />
              {/* Marquee border */}
              {(marquee.w > 0 || marquee.h > 0) && (
                <div style={{
                  position: "absolute",
                  left: marquee.x, top: marquee.y,
                  width: marquee.w, height: marquee.h,
                  border: `1.5px dashed ${T.teal}`,
                  boxShadow: "0 0 0 1px rgba(0,123,127,0.3), 0 8px 24px rgba(0,123,127,0.25)",
                  background: "rgba(0,123,127,0.05)",
                  pointerEvents: "none",
                }}>
                  {marqueeDone && (
                    <div style={{
                      position: "absolute", top: -20, left: 0,
                      fontFamily: T.mono, fontSize: 9, color: T.teal,
                      padding: "2px 6px", background: "rgba(0,123,127,0.15)", borderRadius: 3,
                    }}>
                      {Math.round(marquee.w)} × {Math.round(marquee.h)} · region locked
                    </div>
                  )}
                </div>
              )}
              {/* Size label while drawing */}
              {!marqueeDone && marquee.w > 0 && (
                <div style={{
                  position: "absolute",
                  left: marquee.x + marquee.w + 6, top: marquee.y + marquee.h - 14,
                  fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.7)",
                  padding: "2px 6px", background: "rgba(0,0,0,0.6)", borderRadius: 3,
                }}>
                  {Math.round(marquee.w)} × {Math.round(marquee.h)}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setStage("choose")} style={{
                flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}>Back</button>
              <button disabled={!marqueeDone} onClick={() => setStage("extracting")} style={{
                flex: 2, padding: "9px 12px",
                background: marqueeDone ? "linear-gradient(135deg, #007B7F, #004D50)" : "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                fontFamily: T.display, fontWeight: 700, fontSize: 11,
                color: marqueeDone ? "#fff" : "rgba(255,255,255,0.3)",
                cursor: marqueeDone ? "pointer" : "not-allowed",
                letterSpacing: "0.04em", textTransform: "uppercase",
              }}>{marqueeDone ? "✓ Capture region" : "Drawing…"}</button>
            </div>
          </div>
        )}

        {stage === "extracting" && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
              Claude Vision · parsing {source === "region" ? "selected region" : "screen capture"}…
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${T.teal}, #34C77B)`, transition: "width 0.2s ease" }} />
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
              {progress < 30 && "Locating fields…"}
              {progress >= 30 && progress < 70 && "Extracting name, DOB, ZIP, coverage…"}
              {progress >= 70 && "Scoring confidence…"}
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
                  <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", width: 92 }}>{k}</div>
                  <input
                    value={f.v}
                    onChange={e => setExtracted(prev => ({ ...prev, [k]: { ...f, v: e.target.value, pill: e.target.value ? "verified" : "low" } }))}
                    placeholder="—"
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 6, padding: "5px 8px", color: "#fff", outline: "none",
                      fontFamily: T.body, fontSize: 12,
                    }}
                  />
                  <ConfidencePill level={f.pill} />
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

function LeadContextPanel({ scaledFont = (x) => x }) {
  const [activeId, setActiveId] = useState("maria");
  const [custom, setCustom] = useState(null); // a captured lead, replaces the catalog entry
  const [showSwitch, setShowSwitch] = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  const active = custom && custom.id === activeId ? custom : MOCK_LEADS[activeId];
  const fields = active.fields;
  const source = active.source;

  const handleCommitCapture = (extracted) => {
    const id = "captured_" + Date.now();
    const newLead = {
      id, source: "Captured · Claude Vision",
      fields: Object.entries(extracted).map(([k, f], i) => ({
        k, v: f.v || "—", pill: f.pill, wide: k === "Address · ZIP",
      })),
    };
    setCustom(newLead);
    setActiveId(id);
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
          <div key={i} style={{
            gridColumn: f.wide ? "span 2" : "span 1",
            background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 6, padding: "4px 7px",
          }}>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 8, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{f.k}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 16 }}>
              <span style={{ fontFamily: T.body, fontSize: scaledFont(11), color: "rgba(255,255,255,0.9)", flex: 1, lineHeight: 1.35 }}>{f.v || "—"}</span>
              <ConfidencePill level={f.pill} />
            </div>
          </div>
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
                }}>{item.done ? "done" : riskLabel[r] || "rec"}</span>
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
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
      {sources.map((s, i) => (
        <span key={i} style={{
          fontFamily: T.mono, fontSize: 8, letterSpacing: "0.04em", textTransform: "uppercase",
          padding: "1px 5px", borderRadius: 6,
          background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>{s}</span>
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

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 300);
    return () => clearInterval(iv);
  }, []);

  const peclItems = DEFAULT_PECL_ITEMS;
  const peclDone = peclItems.filter(i => i.done).length;

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
      {aiResponses.slice(0, shownResponses).map((resp, i) => (
        <AIResponseCard key={i} resp={resp} scaledFont={scaledFont} opacity={opacity} audioOn={audioOn} screenOn={screenOn} />
      ))}
      {shownResponses < aiResponses.length && (
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
        {screenOn && <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(0,123,127,0.6)", marginLeft: "auto" }}>Five9 — Maria Garcia</span>}
      </div>
      {transcriptLines.slice(0, visibleTranscript).map((line, i) => (
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
        <AudioWave active={audioOn} color="#34C77B" bars={4} />
        <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: audioOn ? "#34C77B" : "rgba(255,255,255,0.3)" }}>{audioOn ? "Listening" : "Muted"}</span>
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

  const peclItems = DEFAULT_PECL_ITEMS;
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
        {screenOn && <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(0,123,127,0.6)", marginLeft: "auto" }}>Five9 — Maria Garcia, 33024</span>}
      </div>
      {transcriptLines.slice(0, visibleTranscript).map((line, i) => (
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
    const resp = aiResponses[shownResponses - 1];
    const sourcesByTrigger = {
      "what plans would cover my Eliquis": ["ZIP 33024", "Rx: Eliquis", "Coverage: Original Medicare"],
      "Dr. Patel at Baptist Health": ["PCP: Dr. Patel", "Plan: Humana S5884-065"],
      "what about dental": ["ZIP 33024", "Coverage gap: dental"],
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
          {audioOn && <AudioWave active bars={3} />}
          <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>⌘⇧S</span>
        </button>
      </div>
    );
  }

  // ─── COLLAPSED ───
  if (mode === "collapsed") {
    const latestResp = aiResponses[shownResponses - 1];
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
            <AudioWave active={audioOn} color="#34C77B" bars={4} />
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
              "{transcriptLines[Math.min(visibleTranscript - 1, transcriptLines.length - 1)].text.slice(0, 65)}..."
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
            <AudioWave active={audioOn} color="#34C77B" bars={4} />
            <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: audioOn ? "#34C77B" : "rgba(255,255,255,0.3)" }}>{audioOn ? "Listening" : "Muted"}</span>
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
