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
    // legacy mobile fields
    response: "3 plans cover Eliquis in ZIP 33024:",
    plans: [
      { name: "Humana Preferred Rx Plan", copay: "$47/mo", tier: "T3", pa: "No", stars: "★★★★" },
      { name: "Aetna CVS Health Rx Saver", copay: "$42/mo", tier: "T3", pa: "No", stars: "★★★½" },
      { name: "WellCare Value Script", copay: "$89/mo", tier: "T4", pa: "Yes", stars: "★★★" },
    ],
    compliance: "Present all options. Do not describe any plan as \"the best\" — let Mrs. Garcia decide based on her needs.",
    // desktop Cluely-style fields
    sayThis: "Mrs. Garcia, I've pulled up Medicare prescription plans in the 33024 ZIP that cover Eliquis. The strongest option right now is the Humana Preferred Rx Plan — Eliquis is on Tier 3 at $47 a month, no prior authorization required, and it's rated 4 stars. I can walk you through two other options as well so you can compare.",
    pressMore: [
      "Aetna CVS Health Rx Saver also covers Eliquis at Tier 3 — $42 a month, no prior auth required. A bit lower monthly cost.",
      "WellCare Value Script covers it at Tier 4 for $89 a month — prior authorization is required, so a bit more friction when filling.",
    ],
    followUps: [
      "Which monthly copay range works best for your budget?",
      "Are there other prescriptions you'd like me to check coverage on while I have you?",
    ],
  },
  {
    trigger: "Dr. Patel at Baptist Health",
    context: { screen: "Five9: Maria Garcia, Humana S5884-065 under discussion", audio: "Client asking about provider network — Dr. Patel, Baptist Health" },
    // legacy mobile fields
    response: "✅ Dr. Raj Patel, MD — Baptist Health South Florida",
    detail: "In-Network confirmed for Humana Preferred Rx Plan (S5884-065). Internal Medicine.",
    compliance: "Before enrollment: you still need to cover Medicare Savings Programs (PECL requirement).",
    script: "\"Mrs. Garcia, I'm required to mention Medicare Savings Programs — state programs that can help with your Part B premium. Would you like me to check if you might qualify?\"",
    // desktop Cluely-style fields
    sayThis: "Good news — Dr. Raj Patel at Baptist Health South Florida is in-network for the Humana Preferred Rx Plan we've been discussing. He's listed under Internal Medicine, so your primary care relationship stays intact. Before we go further, I do need to mention a couple of Medicare Savings Programs as part of my required disclosures.",
    pressMore: [
      "Medicare Savings Programs are state-run programs that can help cover your Part B premium — eligibility is based on income and assets.",
      "This is a PECL compliance requirement, so I want to make sure we cover it properly before moving to enrollment.",
    ],
    followUps: [
      "Would you like me to check if you might qualify for a Medicare Savings Program?",
      "Any other providers or specialists you'd like me to verify before we finalize?",
    ],
  },
  {
    trigger: "what about dental",
    context: { screen: "Five9: Maria Garcia, discussing MAPD plans", audio: "Client asking about dental coverage — current Medicare doesn't cover" },
    // legacy mobile fields
    response: "Great question. Several MAPD plans in 33024 include dental benefits:",
    detail: "Humana Gold Plus (H1036-200) includes preventive and comprehensive dental. Aetna Medicare Eagle (H3312-067) includes preventive dental with $2,000 annual max.",
    trifecta: "This is the ancillary conversation — a natural bridge to the trifecta. If she needs dental + vision + hearing, an ancillary package alongside her MAPD strengthens retention.",
    compliance: "Only present dental benefits that are part of the MA plan or a separate ancillary product you're appointed to sell.",
    // desktop Cluely-style fields
    sayThis: "You're right that Original Medicare doesn't cover dental — but several Medicare Advantage plans in your ZIP do. The Humana Gold Plus plan includes both preventive and comprehensive dental care. The Aetna Medicare Eagle covers preventive dental with a $2,000 annual maximum. If you're thinking about major work like crowns or extractions, the Humana plan would give you more coverage.",
    pressMore: [
      "If dental is a real priority, we can also look at pairing a Medicare Advantage plan with a standalone ancillary dental policy — that can significantly raise your annual maximum.",
      "Some plans bundle dental with vision and hearing coverage, which tends to be a strong value for clients in this age range.",
    ],
    followUps: [
      "Have you had any major dental work planned recently — crowns, implants, or anything like that?",
      "Would you like me to put a couple of MAPD plans with dental side by side so you can compare the benefits?",
    ],
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
  );

  const renderCopilot = () => (
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
      <div style={{ padding: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}>
        <div style={{ fontFamily: T.display, fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>PECL Checklist</div>
        {peclItems.map(item => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
            {item.done ? <CheckCircle size={11} color={T.teal} /> : <Circle size={11} color="rgba(255,255,255,0.15)" />}
            <span style={{ fontFamily: T.body, fontSize: 11, color: item.done ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}>{item.label}</span>
          </div>
        ))}
      </div>
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
    return (
      <div style={{ padding: "6px 14px" }}>
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

        {/* Response counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: "rgba(255,255,255,0.18)" }}>{shownResponses} / {aiResponses.length} responses</span>
          {shownResponses < aiResponses.length && (
            <span style={{ fontFamily: T.display, fontSize: 9, color: "rgba(255,255,255,0.18)" }}>· click Ask AI for next</span>
          )}
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
