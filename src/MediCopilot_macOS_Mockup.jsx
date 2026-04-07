import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Coins, Sprout, Shield, CheckCircle, Circle, AlertTriangle, Send, ChevronRight, Eye, EyeOff, Maximize2, Minimize2, Phone, User, Bot, Mic, MicOff, Monitor, GripVertical, Zap, Volume2, GripHorizontal, Menu, X, ChevronDown, ChevronUp } from "lucide-react";

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
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
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
function useResizable(iw, ih, minW = 320, minH = 400, maxW = 700, maxH = 900) {
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
        w: Math.min(maxW, Math.max(minW, startSize.current.w + (e.clientX - startMouse.current.x))),
        h: Math.min(maxH, Math.max(minH, startSize.current.h + (e.clientY - startMouse.current.y))),
      });
    };
    const up = () => { resizing.current = false; };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [minW, minH, maxW, maxH]);
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

// ─── Simulated live transcript lines ───
const transcriptLines = [
  { speaker: "agent", text: "Good afternoon Mrs. Garcia, this is James with Trifecta Benefits. I'm required to let you know that I'm a licensed agent with a third-party marketing organization.", time: "2:01" },
  { speaker: "client", text: "Okay, that's fine.", time: "2:01" },
  { speaker: "agent", text: "Perfect. I see you're currently on Original Medicare with a standalone prescription drug plan. How has that been working for you?", time: "2:02" },
  { speaker: "client", text: "It's okay but my drug costs keep going up. I'm paying a lot for my Eliquis.", time: "2:03" },
  { speaker: "agent", text: "I understand. Let me look into that for you.", time: "2:03" },
  { speaker: "client", text: "Can you tell me what plans would cover my Eliquis? I'm in Pembroke Pines.", time: "2:03", isQuestion: true },
  { speaker: "agent", text: "Absolutely. Let me pull up plans in your area that cover Eliquis...", time: "2:04" },
  { speaker: "client", text: "Also, I really need to make sure Dr. Patel at Baptist Health is in the network. He's been my doctor for years.", time: "2:05", isQuestion: true },
  { speaker: "client", text: "And what about dental? My teeth have been bothering me and Original Medicare doesn't cover dental at all.", time: "2:06", isQuestion: true },
];

// ─── AI Responses keyed to detected questions ───
const aiResponses = [
  {
    trigger: "what plans would cover my Eliquis",
    context: { screen: "Five9: Maria Garcia, ZIP 33024, Original Medicare + PDP", audio: "Client asking about Eliquis coverage in Pembroke Pines" },
    response: "3 plans cover Eliquis in ZIP 33024:",
    plans: [
      { name: "Humana Preferred Rx Plan", copay: "$47/mo", tier: "T3", pa: "No", stars: "★★★★" },
      { name: "Aetna CVS Health Rx Saver", copay: "$42/mo", tier: "T3", pa: "No", stars: "★★★½" },
      { name: "WellCare Value Script", copay: "$89/mo", tier: "T4", pa: "Yes", stars: "★★★" },
    ],
    compliance: "Present all options. Do not describe any plan as \"the best\" — let Mrs. Garcia decide based on her needs.",
  },
  {
    trigger: "Dr. Patel at Baptist Health",
    context: { screen: "Five9: Maria Garcia, Humana S5884-065 under discussion", audio: "Client asking about provider network — Dr. Patel, Baptist Health" },
    response: "✅ Dr. Raj Patel, MD — Baptist Health South Florida",
    detail: "In-Network confirmed for Humana Preferred Rx Plan (S5884-065). Internal Medicine.",
    compliance: "Before enrollment: you still need to cover Medicare Savings Programs (PECL requirement).",
    script: "\"Mrs. Garcia, I'm required to mention Medicare Savings Programs — state programs that can help with your Part B premium. Would you like me to check if you might qualify?\"",
  },
  {
    trigger: "what about dental",
    context: { screen: "Five9: Maria Garcia, discussing MAPD plans", audio: "Client asking about dental coverage — current Medicare doesn't cover" },
    response: "Great question. Several MAPD plans in 33024 include dental benefits:",
    detail: "Humana Gold Plus (H1036-200) includes preventive and comprehensive dental. Aetna Medicare Eagle (H3312-067) includes preventive dental with $2,000 annual max.",
    trifecta: "This is the ancillary conversation — a natural bridge to the trifecta. If she needs dental + vision + hearing, an ancillary package alongside her MAPD strengthens retention.",
    compliance: "Only present dental benefits that are part of the MA plan or a separate ancillary product you're appointed to sell.",
  },
];

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
              <div>
                <div style={{ fontFamily: T.display, fontSize: scaledFont(11), fontWeight: 600, color: T.white }}>{p.name}</div>
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

  const peclItems = [
    { id: "tpmo", label: "TPMO Disclaimer", done: true },
    { id: "lis", label: "Low-Income Subsidy", done: true },
    { id: "msp", label: "Medicare Savings", done: false },
    { id: "medigap", label: "Medigap Rights", done: false },
    { id: "soa", label: "Scope of Appointment", done: true },
  ];
  const peclDone = peclItems.filter(i => i.done).length;

  const handleAskAI = () => {
    if (shownResponses < aiResponses.length) setShownResponses(s => s + 1);
    if (visibleTranscript < transcriptLines.length) setVisibleTranscript(v => Math.min(v + 2, transcriptLines.length));
  };

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "#0a1628", overflow: "hidden" }}>
      {/* ─── Mobile Header ─── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
        background: "rgba(0,40,42,0.95)", borderBottom: "1px solid rgba(0,123,127,0.2)",
        flexShrink: 0,
      }}>
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

      {/* ─── Tab Bar ─── */}
      <div style={{
        display: "flex", gap: 0, flexShrink: 0,
        background: "rgba(0,40,42,0.7)", borderBottom: "1px solid rgba(0,123,127,0.15)",
      }}>
        {[
          { key: "call", label: "Call Info", icon: Phone },
          { key: "copilot", label: "AI Copilot", icon: Zap },
          { key: "transcript", label: "Transcript", icon: Volume2 },
        ].map(({ key, label, icon: Ic }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 0", border: "none", cursor: "pointer",
            background: tab === key ? "rgba(0,123,127,0.15)" : "transparent",
            borderBottom: tab === key ? `2px solid ${T.teal}` : "2px solid transparent",
          }}>
            <Ic size={14} color={tab === key ? T.teal : "rgba(255,255,255,0.3)"} />
            <span style={{
              fontFamily: T.display, fontSize: 12, fontWeight: tab === key ? 700 : 400,
              color: tab === key ? T.teal : "rgba(255,255,255,0.3)",
            }}>{label}</span>
          </button>
        ))}
      </div>

      {/* ─── Context Bar (audio/screen toggles) ─── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
        background: "rgba(0,40,42,0.5)", borderBottom: "1px solid rgba(0,123,127,0.08)",
        flexShrink: 0, flexWrap: "wrap",
      }}>
        <button onClick={() => setAudioOn(!audioOn)} style={{
          display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
          background: audioOn ? "rgba(52,199,123,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${audioOn ? "rgba(52,199,123,0.25)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 6, cursor: "pointer",
        }}>
          {audioOn ? <Volume2 size={12} color="#34C77B" /> : <MicOff size={12} color="rgba(255,255,255,0.3)" />}
          <AudioWave active={audioOn} color="#34C77B" bars={4} />
          <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: audioOn ? "#34C77B" : "rgba(255,255,255,0.3)" }}>
            {audioOn ? "Listening" : "Muted"}
          </span>
        </button>
        <button onClick={() => setScreenOn(!screenOn)} style={{
          display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
          background: screenOn ? "rgba(0,123,127,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${screenOn ? "rgba(0,123,127,0.25)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 6, cursor: "pointer",
        }}>
          <Monitor size={12} color={screenOn ? T.teal : "rgba(255,255,255,0.3)"} />
          <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: screenOn ? T.teal : "rgba(255,255,255,0.3)" }}>
            {screenOn ? "Screen On" : "Screen Off"}
          </span>
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "rgba(245,166,35,0.08)", borderRadius: 6 }}>
          <AlertTriangle size={10} color="#F5A623" />
          <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: "#F5A623" }}>MSP</span>
        </div>
        {/* Trifecta pills */}
        <div style={{ display: "flex", gap: 3 }}>
          {[{ icon: Heart, label: "MAPD", on: true }, { icon: Coins, label: "Ancillary", on: shownResponses >= 3 }, { icon: Sprout, label: "Life", on: false }].map(({ icon: Ic, label, on }) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", gap: 3, padding: "3px 6px", borderRadius: 4,
              background: on ? "rgba(0,123,127,0.12)" : "transparent",
            }}>
              <Ic size={10} color={on ? T.teal : "rgba(255,255,255,0.12)"} />
              <span style={{ fontFamily: T.display, fontSize: 8, fontWeight: on ? 700 : 400, color: on ? T.teal : "rgba(255,255,255,0.15)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

        {/* CALL INFO TAB */}
        {tab === "call" && (
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
            {/* PECL Checklist */}
            <div style={{ marginTop: 20, padding: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
              <div style={{ fontFamily: T.display, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>PECL Checklist</div>
              {peclItems.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  {item.done ? <CheckCircle size={14} color={T.teal} /> : <Circle size={14} color="rgba(255,255,255,0.15)" />}
                  <span style={{ fontFamily: T.body, fontSize: 13, color: item.done ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COPILOT TAB */}
        {tab === "copilot" && (
          <div style={{ padding: 16 }}>
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
        )}

        {/* TRANSCRIPT TAB */}
        {tab === "transcript" && (
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Volume2 size={12} color="rgba(255,255,255,0.2)" />
              <span style={{ fontFamily: T.display, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Live Transcript</span>
              {screenOn && <>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(0,123,127,0.6)", marginLeft: "auto" }}>Five9 — Maria Garcia</span>
              </>}
            </div>
            {transcriptLines.slice(0, visibleTranscript).map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: "rgba(255,255,255,0.15)", minWidth: 32 }}>{line.time}</span>
                <span style={{
                  fontFamily: T.display, fontSize: 10, fontWeight: 600, minWidth: 40,
                  color: line.speaker === "client" ? T.coral : "rgba(255,255,255,0.3)",
                }}>
                  {line.speaker === "client" ? "Client" : "Agent"}
                </span>
                <span style={{
                  fontFamily: T.body, fontSize: 13, lineHeight: 1.5, flex: 1,
                  color: line.isQuestion ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
                  fontWeight: line.isQuestion ? 500 : 400,
                }}>
                  {line.text}
                  {line.isQuestion && (
                    <span style={{
                      marginLeft: 6, fontFamily: T.display, fontSize: 9, fontWeight: 700,
                      color: T.teal, background: "rgba(0,123,127,0.15)", padding: "2px 6px",
                      borderRadius: 3, verticalAlign: "middle",
                    }}>? DETECTED</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Mobile Input Bar (sticky bottom) ─── */}
      <div style={{
        padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        background: "rgba(0,40,42,0.95)", borderTop: "1px solid rgba(0,123,127,0.2)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "2px 2px 2px 12px",
          }}>
            <input placeholder="Ask MediCopilot..." value={inputVal} onChange={e => setInputVal(e.target.value)}
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: T.body, fontSize: 15, color: T.white, padding: "10px 0" }}
            />
            <button onClick={handleAskAI} style={{ background: T.teal, border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
              <Send size={16} color={T.white} />
            </button>
          </div>
          <button onClick={handleAskAI} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
            background: "linear-gradient(135deg, #007B7F, #004D50)", border: "none",
            borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>
            <Zap size={16} color={T.white} />
            <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, color: T.white }}>Ask AI</span>
          </button>
        </div>
      </div>
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
  const [splitPct, setSplitPct] = useState(35);
  const splitDrag = useRef(false);
  const splitContainerRef = useRef(null);
  const collapsed = useDraggable(620, 55);
  const expanded = useDraggable(560, 30);
  const hidden = useDraggable(820, 55);
  const { size: panelSize, onResizeStart } = useResizable(410, 600);
  const scaledFont = (base) => Math.round(base * textScale);
  const cycleTextSize = () => setTextScale(s => {
    const steps = [0.85, 1, 1.15, 1.3];
    return steps[(steps.indexOf(s) + 1) % steps.length];
  });

  const onDividerDown = useCallback((e) => { e.stopPropagation(); e.preventDefault(); splitDrag.current = true; }, []);
  useEffect(() => {
    const mv = (e) => {
      if (!splitDrag.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      setSplitPct(Math.min(75, Math.max(15, ((e.clientY - rect.top) / rect.height) * 100)));
    };
    const up = () => { splitDrag.current = false; };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 300);
    return () => clearInterval(iv);
  }, []);

  const peclItems = [
    { id: "tpmo", label: "TPMO Disclaimer", done: true },
    { id: "lis", label: "Low-Income Subsidy", done: true },
    { id: "msp", label: "Medicare Savings", done: false },
    { id: "medigap", label: "Medigap Rights", done: false },
    { id: "soa", label: "Scope of Appointment", done: true },
  ];
  const peclDone = peclItems.filter(i => i.done).length;
  const clearBg = (a) => `rgba(0, 40, 42, ${a})`;
  const clearBorder = (a) => `1px solid rgba(0, 123, 127, ${a})`;

  const handleAskAI = () => {
    if (shownResponses < aiResponses.length) setShownResponses(s => s + 1);
    if (visibleTranscript < transcriptLines.length) setVisibleTranscript(v => Math.min(v + 2, transcriptLines.length));
  };

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
        width: 390, zIndex: 100, background: clearBg(opacity), border: clearBorder(0.4),
        borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        cursor: "grab", userSelect: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
          <GripVertical size={14} color="rgba(255,255,255,0.25)" />
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 14 }}>
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
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.teal }}>{peclDone}/5</span>
          </div>
          <button data-no-drag="true" onClick={() => setMode("expanded")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <Maximize2 size={14} color="rgba(255,255,255,0.5)" />
          </button>
          <button data-no-drag="true" onClick={() => setMode("hidden")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <EyeOff size={14} color="rgba(255,255,255,0.5)" />
          </button>
        </div>
        <div style={{ padding: "0 12px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 6, borderLeft: "2px solid rgba(52,199,123,0.4)" }}>
            <Volume2 size={10} color="rgba(255,255,255,0.3)" />
            <span style={{ fontFamily: T.body, fontStyle: "italic", fontSize: 11, color: "rgba(255,255,255,0.5)", flex: 1 }}>
              "{transcriptLines[Math.min(visibleTranscript - 1, transcriptLines.length - 1)].text.slice(0, 60)}..."
            </span>
          </div>
        </div>
        <div style={{ padding: "0 12px 8px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px", borderLeft: `2px solid ${T.teal}` }}>
            <div style={{ fontFamily: T.body, fontSize: 12, color: `rgba(255,255,255,${Math.min(opacity+0.1,1)})`, lineHeight: 1.5 }}>{latestResp.response}</div>
            {latestResp.plans && <div style={{ fontFamily: T.mono, fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{latestResp.plans.map(p => p.name).join(" · ")}</div>}
            {latestResp.detail && <div style={{ fontFamily: T.body, fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{latestResp.detail}</div>}
          </div>
        </div>
        <div data-no-drag="true" style={{ padding: "0 12px 10px", display: "flex", gap: 6 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "2px 2px 2px 12px" }}>
            <input placeholder="Ask or press ⌘Enter..." value={inputVal} onChange={e => setInputVal(e.target.value)}
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: T.body, fontSize: 13, color: T.white, padding: "8px 0" }} />
            <button onClick={handleAskAI} style={{ background: T.teal, border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}><Send size={13} color={T.white} /></button>
          </div>
          <button onClick={handleAskAI} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "linear-gradient(135deg, #007B7F, #004D50)", border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
            <Zap size={14} color={T.white} />
            <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 11, color: T.white }}>Ask AI</span>
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "6px 12px", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
          {[["⌘ Enter","Ask AI"],["⌘ ⇧ H","Hide"],["⌘ ⇧ E","Expand"],["⌘ ⇧ M","Mic"]].map(([k,l]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", padding: "1px 5px", borderRadius: 3 }}>{k}</span>
              <span style={{ fontFamily: T.display, fontSize: 9, color: "rgba(255,255,255,0.12)" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── EXPANDED ───
  return (
    <div onMouseDown={expanded.onMouseDown} style={{
      position: "absolute", left: expanded.pos.x, top: expanded.pos.y,
      width: panelSize.w, height: panelSize.h, zIndex: 100, background: clearBg(opacity), border: clearBorder(0.35),
      borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 48px rgba(0,0,0,0.4)",
      display: "flex", flexDirection: "column", cursor: "grab", userSelect: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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

      <div data-no-drag="true" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
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

      <div ref={splitContainerRef} data-no-drag="true" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", cursor: "default", minHeight: 0 }}>
        <div style={{ height: `${splitPct}%`, overflowY: "auto", borderBottom: "none" }}>
          <div style={{ padding: "6px 14px 2px", display: "flex", alignItems: "center", gap: 6 }}>
            <Volume2 size={10} color="rgba(255,255,255,0.2)" />
            <span style={{ fontFamily: T.display, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Live Transcript</span>
            {screenOn && <>
              <span style={{ fontFamily: T.display, fontSize: 9, color: "rgba(255,255,255,0.15)", marginLeft: "auto" }}>Screen:</span>
              <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(0,123,127,0.6)" }}>Five9 — Maria Garcia, 33024</span>
            </>}
          </div>
          <div style={{ padding: "4px 14px 8px" }}>
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
        </div>

        <div onMouseDown={onDividerDown} style={{ height: 8, cursor: "row-resize", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, userSelect: "none" }}>
          <div style={{ width: 32, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.12)" }} />
        </div>

        <div style={{ display: "flex", gap: 4, padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          {[{ icon: Heart, label: "MAPD", on: true }, { icon: Coins, label: "Ancillary", on: shownResponses >= 3 }, { icon: Sprout, label: "Life", on: false }].map(({ icon: Ic, label, on }) => (
            <div key={label} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "4px 0", borderRadius: 6, background: on ? "rgba(0,123,127,0.12)" : "transparent" }}>
              <Ic size={11} color={on ? T.teal : "rgba(255,255,255,0.12)"} />
              <span style={{ fontFamily: T.display, fontSize: 9, fontWeight: on ? 700 : 400, color: on ? T.teal : "rgba(255,255,255,0.15)" }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px", minHeight: 0 }}>
          {aiResponses.slice(0, shownResponses).map((resp, i) => (
            <AIResponseCard key={i} resp={resp} scaledFont={scaledFont} opacity={opacity} audioOn={audioOn} screenOn={screenOn} />
          ))}
        </div>
      </div>

      <div data-no-drag="true" style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", cursor: "default" }}>
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
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 6 }}>
          {[["⌘↩","Ask AI"],["⌘⇧H","Hide"],["⌘⇧C","Collapse"],["⌘⇧M","Mic On/Off"]].map(([k,l]) => (
            <span key={k} style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.12)" }}>
              <span style={{ background: "rgba(255,255,255,0.02)", padding: "1px 4px", borderRadius: 3, marginRight: 3 }}>{k}</span>{l}
            </span>
          ))}
        </div>
      </div>

      <div data-no-drag="true" onMouseDown={onResizeStart} style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, cursor: "nwse-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
          <line x1="9" y1="1" x2="1" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9" y1="5" x2="5" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9" y1="8" x2="8" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
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
