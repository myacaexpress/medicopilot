import { useState, useEffect, useCallback } from "react";
import { fetchAdminSessions, fetchAdminSessionDetail, fetchAdminStats, fetchScenarios } from "./api.js";

const THEME = {
  bg: "#0a1628",
  surface: "rgba(255,255,255,0.03)",
  surfaceHover: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.08)",
  borderHover: "rgba(255,255,255,0.15)",
  primary: "#FF8A3D",
  dark: "#CC6B2E",
  light: "#FFB077",
  teal: "#007B7F",
  tealBg: "rgba(0,123,127,0.15)",
  tealBorder: "rgba(0,123,127,0.25)",
  red: "#F47C6E",
  green: "#34C77B",
  text: "#fff",
  textMuted: "rgba(255,255,255,0.5)",
  textDim: "rgba(255,255,255,0.3)",
  textFaint: "rgba(255,255,255,0.15)",
};

const FONT = {
  display: "'Montserrat', sans-serif",
  body: "'Lora', serif",
  mono: "'JetBrains Mono', monospace",
};

const TABS = ["Sessions", "Scenarios", "Stats"];

const DIFFICULTY_COLORS = {
  beginner: THEME.green,
  intermediate: THEME.light,
  advanced: THEME.red,
};

const SCROLLBAR_CSS = `
  .admin-scroll::-webkit-scrollbar { width: 8px; }
  .admin-scroll::-webkit-scrollbar-track { background: transparent; }
  .admin-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
  .admin-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
`;

function fmtDate(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString();
}

function fmtRelative(iso) {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtDuration(ms) {
  if (!ms) return "\u2014";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Skeleton({ width, height = 16 }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

function SkeletonRows({ count = 5 }) {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${THEME.border}` }}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="20%" height={14} />
          <div style={{ flex: 1 }} />
          <Skeleton width={50} height={14} />
          <Skeleton width={70} height={14} />
        </div>
      ))}
    </>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "60px 20px", color: THEME.textDim,
    }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, marginBottom: 6, color: THEME.textMuted }}>
        {title}
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 13, color: THEME.textDim }}>
        {subtitle}
      </div>
    </div>
  );
}

function FrostedCard({ children, style = {}, ...props }) {
  return (
    <div style={{
      background: THEME.surface,
      backdropFilter: "blur(8px)",
      border: `1px solid ${THEME.border}`,
      borderRadius: 12,
      ...style,
    }} {...props}>
      {children}
    </div>
  );
}

function RatingPill({ rating }) {
  if (!rating) return <span style={{ fontFamily: FONT.mono, fontSize: 11, color: THEME.textDim }}>\u2014</span>;
  const color = rating >= 4 ? THEME.green : rating >= 3 ? THEME.light : THEME.red;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      fontSize: 11, fontWeight: 700, fontFamily: FONT.mono,
      background: `${color}18`, color, border: `1px solid ${color}33`,
    }}>
      {rating}/5
    </span>
  );
}

function FlagBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", borderRadius: 10,
      fontSize: 10, fontWeight: 700, fontFamily: FONT.mono,
      background: "rgba(244,124,110,0.12)", color: THEME.red,
      border: "1px solid rgba(244,124,110,0.25)",
    }}>
      &#x1F6A9; {count}
    </span>
  );
}

function DifficultyBadge({ difficulty }) {
  const color = DIFFICULTY_COLORS[difficulty] || THEME.textMuted;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6,
      fontSize: 9, fontWeight: 700, fontFamily: FONT.display,
      letterSpacing: "0.05em", textTransform: "uppercase",
      background: `${color}18`, color, border: `1px solid ${color}33`,
    }}>
      {difficulty}
    </span>
  );
}

function buildTimeline(detail) {
  const events = [];
  for (const t of detail.transcripts || []) {
    events.push({ type: "transcript", speaker: t.speaker, text: t.text, ts: t.timestamp_ms });
  }
  for (const s of detail.ai_suggestions || []) {
    events.push({
      type: "suggestion",
      sayThis: s.say_this,
      callStage: s.call_stage,
      triggerInfo: s.trigger_info,
      followUps: s.follow_up_questions,
      ts: s.timestamp_ms,
    });
  }
  for (const f of detail.flags || []) {
    events.push({ type: "flag", note: f.note || f.flag_type, ts: f.timestamp_ms });
  }
  events.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  return events;
}

function TimelineEvent({ event }) {
  const ts = fmtDuration(event.ts);

  if (event.type === "transcript") {
    const isAgent = event.speaker === "agent";
    return (
      <div style={{
        display: "flex", gap: 10, marginBottom: 8,
        flexDirection: isAgent ? "row-reverse" : "row",
      }}>
        <span style={{
          fontFamily: FONT.mono, fontSize: 10, color: THEME.textFaint,
          minWidth: 40, textAlign: "right", paddingTop: 8, flexShrink: 0,
        }}>
          {ts}
        </span>
        <div style={{
          maxWidth: "70%", padding: "8px 12px", borderRadius: 12,
          background: isAgent ? THEME.tealBg : "rgba(255,255,255,0.05)",
          border: `1px solid ${isAgent ? THEME.tealBorder : THEME.border}`,
        }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
            color: isAgent ? THEME.teal : THEME.textDim, marginBottom: 3,
          }}>
            {isAgent ? "AGENT" : "CLIENT"}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
            {event.text}
          </div>
        </div>
      </div>
    );
  }

  if (event.type === "suggestion") {
    const kind = event.triggerInfo?.kind;
    return (
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <span style={{
          fontFamily: FONT.mono, fontSize: 10, color: THEME.textFaint,
          minWidth: 40, textAlign: "right", paddingTop: 10, flexShrink: 0,
        }}>
          {ts}
        </span>
        <div style={{
          flex: 1, padding: "10px 14px", borderRadius: 12,
          background: "rgba(255,138,61,0.06)",
          borderLeft: `4px solid ${THEME.primary}`,
          border: `1px solid rgba(255,138,61,0.15)`,
          borderLeftWidth: 4, borderLeftColor: THEME.primary,
        }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
            color: THEME.primary, marginBottom: 6, display: "flex", gap: 8, alignItems: "center",
          }}>
            <span>AI SUGGESTION</span>
            {event.callStage && (
              <span style={{
                padding: "1px 6px", borderRadius: 4, fontSize: 9,
                background: "rgba(255,138,61,0.12)", color: THEME.dark,
              }}>
                {event.callStage}
              </span>
            )}
            {kind && (
              <span style={{ color: "rgba(255,138,61,0.5)" }}>[{kind}]</span>
            )}
          </div>
          {event.sayThis && (
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
              {event.sayThis}
            </div>
          )}
          {Array.isArray(event.followUps) && event.followUps.length > 0 && (
            <div style={{ marginTop: 6, paddingLeft: 8 }}>
              {event.followUps.map((q, i) => (
                <div key={i} style={{ fontFamily: FONT.body, fontSize: 12, color: THEME.textMuted, lineHeight: 1.6 }}>
                  &bull; {q}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "flag") {
    return (
      <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
        <span style={{
          fontFamily: FONT.mono, fontSize: 10, color: THEME.textFaint,
          minWidth: 40, textAlign: "right", flexShrink: 0,
        }}>
          {ts}
        </span>
        <div style={{
          flex: 1, padding: "6px 12px", borderRadius: 8,
          background: "rgba(244,124,110,0.06)", border: "1px solid rgba(244,124,110,0.15)",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <span style={{ fontSize: 13, flexShrink: 0 }}>&#x1F6A9;</span>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: THEME.red, fontStyle: "italic" }}>
            {event.note}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function CopyMarkdownButton({ detail, timeline }) {
  const [copied, setCopied] = useState(false);

  const buildMarkdown = () => {
    const scenarioLabel = detail.scenario_title || "Free Practice";
    const lines = [
      `# Training Session \u2014 ${scenarioLabel}`,
      `- Tester: ${detail.tester_name}`,
      `- Date: ${fmtDate(detail.started_at)}`,
      `- Duration: ${fmtDuration(detail.duration_ms)}`,
      `- Rating: ${detail.rating || "\u2014"}/5`,
      detail.master_prompt_version ? `- Master prompt version: ${detail.master_prompt_version}` : null,
      "",
      "## Scenario",
      detail.persona_name ? `**Persona:** ${detail.persona_name}` : "**Mode:** Free Practice",
      detail.situation ? `**Situation:** ${detail.situation}` : null,
      detail.success_criteria?.length ? `**Success criteria:** ${detail.success_criteria.join("; ")}` : null,
      "",
      "## Timeline",
      "",
    ].filter((l) => l !== null);

    for (const ev of timeline) {
      const ts = fmtDuration(ev.ts);
      if (ev.type === "transcript") {
        lines.push(`[${ts}] ${ev.speaker === "agent" ? "AGENT" : "CLIENT"}: ${ev.text}`);
      } else if (ev.type === "suggestion") {
        const stage = ev.callStage ? ` [stage: ${ev.callStage}]` : "";
        lines.push(`[${ts}] \u{1F916} AI SUGGESTION${stage}:`);
        if (ev.sayThis) lines.push(`       Say this: "${ev.sayThis}"`);
        if (Array.isArray(ev.followUps)) {
          for (const q of ev.followUps) lines.push(`       \u2022 ${q}`);
        }
      } else if (ev.type === "flag") {
        lines.push(`[${ts}] \u{1F6A9} FLAG: ${ev.note}`);
      }
    }

    if (detail.feedback_text) {
      lines.push("", "## Tester Feedback", detail.feedback_text);
    }

    return lines.join("\n");
  };

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(buildMarkdown());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        padding: "10px 16px", borderRadius: 8, width: "100%",
        border: `1px solid ${copied ? THEME.green : THEME.primary}`,
        background: copied ? "rgba(52,199,123,0.12)" : "transparent",
        color: copied ? THEME.green : THEME.primary,
        fontSize: 12, fontWeight: 600,
        fontFamily: FONT.display, cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {copied ? "\u2713 Copied!" : "Copy as Markdown"}
    </button>
  );
}

function SessionDetail({ detail, onBack }) {
  const timeline = buildTimeline(detail);
  const scenarioLabel = detail.scenario_title || "Free Practice";

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  return (
    <div style={{
      display: "flex", gap: 0, flex: 1, minHeight: 0, overflow: "hidden",
    }}>
      {/* Timeline column */}
      <div style={{ flex: "1 1 auto", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* Sticky back button */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: THEME.bg, padding: "8px 0 12px",
          flexShrink: 0,
        }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.05)", border: `1px solid ${THEME.border}`,
            borderRadius: 8, color: THEME.primary, cursor: "pointer",
            fontFamily: FONT.display, fontSize: 12, fontWeight: 600,
            padding: "6px 14px", transition: "all 0.15s",
          }}>
            &larr; Back to list
          </button>
        </div>
        {/* Timeline content */}
        <div className="admin-scroll" style={{
          flex: 1, overflowY: "auto", minHeight: 0,
          padding: "16px 20px",
          background: "rgba(255,255,255,0.015)",
          borderRadius: 12, border: `1px solid ${THEME.border}`,
        }}>
          {timeline.length === 0 ? (
            <EmptyState
              icon="&#x1F4AC;"
              title="No timeline events"
              subtitle="No transcripts, suggestions, or flags were recorded for this session."
            />
          ) : timeline.map((ev, i) => (
            <TimelineEvent key={i} event={ev} />
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div className="admin-scroll" style={{
        width: 340, flexShrink: 0, overflowY: "auto", minHeight: 0,
        borderLeft: `1px solid ${THEME.border}`,
        padding: "20px 20px 20px 24px",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <FrostedCard style={{ padding: 16 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: THEME.text, marginBottom: 8 }}>
            {scenarioLabel}
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12, color: THEME.textMuted, lineHeight: 1.7 }}>
            <div>Tester: <span style={{ color: THEME.text }}>{detail.tester_name}</span></div>
            <div>Date: <span style={{ color: THEME.text }}>{fmtDate(detail.started_at)}</span></div>
            <div>Duration: <span style={{ color: THEME.text }}>{fmtDuration(detail.duration_ms)}</span></div>
            {detail.rating && <div>Rating: <RatingPill rating={detail.rating} /></div>}
            {detail.master_prompt_version && (
              <div>Prompt: <span style={{ fontFamily: FONT.mono, fontSize: 11, color: THEME.textDim }}>{detail.master_prompt_version}</span></div>
            )}
          </div>
        </FrostedCard>

        {detail.persona_name && (
          <FrostedCard style={{ padding: 16 }}>
            <div style={{ fontFamily: FONT.display, fontSize: 10, fontWeight: 700, color: THEME.textDim, letterSpacing: "0.06em", marginBottom: 8 }}>
              SCENARIO
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: THEME.textMuted, lineHeight: 1.7 }}>
              <strong style={{ color: "rgba(255,255,255,0.8)" }}>{detail.persona_name}</strong>
              {detail.persona_age && <span style={{ fontFamily: FONT.mono, fontSize: 11, color: THEME.textDim }}> {detail.persona_age}yo</span>}
              {detail.persona_state && <span style={{ fontFamily: FONT.mono, fontSize: 11, color: THEME.textDim }}> \u00B7 {detail.persona_state}</span>}
              {detail.situation && <div style={{ marginTop: 6 }}>{detail.situation}</div>}
            </div>
          </FrostedCard>
        )}

        {detail.what_to_test?.length > 0 && (
          <FrostedCard style={{ padding: 16 }}>
            <div style={{ fontFamily: FONT.display, fontSize: 10, fontWeight: 700, color: THEME.textDim, letterSpacing: "0.06em", marginBottom: 8 }}>
              WHAT TO TEST
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontFamily: FONT.body, fontSize: 12, color: THEME.textMuted, lineHeight: 1.7 }}>
              {detail.what_to_test.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </FrostedCard>
        )}

        {detail.success_criteria?.length > 0 && (
          <FrostedCard style={{ padding: 16 }}>
            <div style={{ fontFamily: FONT.display, fontSize: 10, fontWeight: 700, color: THEME.textDim, letterSpacing: "0.06em", marginBottom: 8 }}>
              SUCCESS CRITERIA
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontFamily: FONT.body, fontSize: 12, color: THEME.textMuted, lineHeight: 1.7 }}>
              {detail.success_criteria.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </FrostedCard>
        )}

        {detail.feedback_text && (
          <FrostedCard style={{ padding: 16, background: "rgba(255,138,61,0.04)", borderColor: "rgba(255,138,61,0.12)" }}>
            <div style={{ fontFamily: FONT.display, fontSize: 10, fontWeight: 700, color: THEME.textDim, letterSpacing: "0.06em", marginBottom: 8 }}>
              TESTER FEEDBACK
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
              {detail.feedback_text}
            </div>
          </FrostedCard>
        )}

        {/* Sticky copy button */}
        <div style={{ position: "sticky", bottom: 0, paddingTop: 8, paddingBottom: 4, background: THEME.bg }}>
          <CopyMarkdownButton detail={detail} timeline={timeline} />
        </div>
      </div>
    </div>
  );
}

function SessionsTab({ adminKey }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    fetchAdminSessions(adminKey, { limit: 50 })
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminKey]);

  const openDetail = useCallback(async (id) => {
    setLoadingDetail(true);
    try {
      const d = await fetchAdminSessionDetail(adminKey, id);
      setDetail(d);
    } catch {}
    setLoadingDetail(false);
  }, [adminKey]);

  if (detail) {
    return <SessionDetail detail={detail} onBack={() => setDetail(null)} />;
  }

  if (loading) return <SkeletonRows count={8} />;

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="&#x1F4CB;"
        title="No sessions yet"
        subtitle="Training sessions will appear here once testers start practicing."
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }} className="admin-scroll">
      {/* Table header */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 120px 70px 60px 60px 100px",
        gap: 12, padding: "8px 16px",
        position: "sticky", top: 0, zIndex: 5,
        background: THEME.bg,
        borderBottom: `1px solid ${THEME.border}`,
        fontFamily: FONT.display, fontSize: 10, fontWeight: 700,
        color: THEME.textDim, letterSpacing: "0.06em",
      }}>
        <span>SCENARIO</span>
        <span>TESTER</span>
        <span>DURATION</span>
        <span>RATING</span>
        <span>FLAGS</span>
        <span style={{ textAlign: "right" }}>DATE</span>
      </div>

      {loadingDetail && (
        <div style={{ padding: 16, textAlign: "center" }}>
          <SkeletonRows count={1} />
        </div>
      )}

      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => openDetail(s.id)}
          onMouseEnter={() => setHovered(s.id)}
          onMouseLeave={() => setHovered(null)}
          style={{
            display: "grid", gridTemplateColumns: "1fr 120px 70px 60px 60px 100px",
            gap: 12, padding: "12px 16px", width: "100%",
            textAlign: "left", cursor: "pointer",
            background: hovered === s.id ? THEME.surfaceHover : "transparent",
            border: "none", borderBottom: `1px solid ${THEME.border}`,
            transition: "all 0.15s",
            transform: hovered === s.id ? "translateY(-1px)" : "none",
            boxShadow: hovered === s.id ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
          }}
        >
          <span style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 600, color: THEME.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.scenario_title || "Free Practice"}
          </span>
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: THEME.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.tester_name}
          </span>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: THEME.textDim }}>
            {fmtDuration(s.duration_ms)}
          </span>
          <span><RatingPill rating={s.rating} /></span>
          <span><FlagBadge count={s.flag_count} /></span>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: THEME.textDim, textAlign: "right" }}>
            {fmtRelative(s.started_at)}
          </span>
        </button>
      ))}
    </div>
  );
}

function ScenariosTab() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ height: 240, borderRadius: 12, background: THEME.surface, border: `1px solid ${THEME.border}` }}>
            <div style={{ padding: 20 }}>
              <Skeleton width="40%" height={12} />
              <div style={{ height: 12 }} />
              <Skeleton width="70%" height={16} />
              <div style={{ height: 16 }} />
              <Skeleton width="100%" height={60} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <EmptyState
        icon="&#x1F3AD;"
        title="No scenarios"
        subtitle="Add training scenarios in the database to see them here."
      />
    );
  }

  return (
    <div className="admin-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {scenarios.map((s) => (
          <FrostedCard
            key={s.id}
            onMouseEnter={() => setHovered(s.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: 20, minHeight: 200,
              borderColor: hovered === s.id ? THEME.borderHover : THEME.border,
              transition: "border-color 0.15s, transform 0.15s",
              transform: hovered === s.id ? "translateY(-2px)" : "none",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <DifficultyBadge difficulty={s.difficulty} />
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: THEME.textDim }}>
                #{s.id}
              </span>
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: THEME.text, marginBottom: 4 }}>
              {s.persona_name}
            </div>
            {s.persona_age && (
              <div style={{ fontFamily: FONT.mono, fontSize: 11, color: THEME.textDim, marginBottom: 8 }}>
                {s.persona_age}yo{s.persona_state ? ` \u00B7 ${s.persona_state}` : ""}
              </div>
            )}
            <div style={{
              fontFamily: FONT.body, fontSize: 12, color: THEME.textMuted,
              lineHeight: 1.6, flex: 1,
            }}>
              {s.situation}
            </div>
            {s.medications?.length > 0 && (
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: THEME.textDim, marginTop: 10 }}>
                Meds: {s.medications.join(", ")}
              </div>
            )}
            {s.opening_lines?.[0] && (
              <div style={{
                fontFamily: FONT.body, fontSize: 11, fontStyle: "italic",
                color: THEME.light, marginTop: 10, padding: "6px 10px",
                borderRadius: 6, background: "rgba(255,138,61,0.05)",
                border: "1px solid rgba(255,138,61,0.1)",
              }}>
                &ldquo;{s.opening_lines[0]}&rdquo;
              </div>
            )}
          </FrostedCard>
        ))}

        {/* +New dashed card */}
        <div style={{
          minHeight: 200, borderRadius: 12,
          border: `2px dashed ${THEME.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 8,
          color: THEME.textDim,
        }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>+</span>
          <span style={{ fontFamily: FONT.display, fontSize: 12, fontWeight: 600 }}>
            Add via database
          </span>
        </div>
      </div>
    </div>
  );
}

function StatsTab({ adminKey }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats(adminKey)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminKey]);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <FrostedCard key={i} style={{ padding: 24, textAlign: "center" }}>
            <Skeleton width={60} height={32} />
            <div style={{ height: 8 }} />
            <Skeleton width={80} height={10} />
          </FrostedCard>
        ))}
      </div>
    );
  }

  if (!stats) {
    return <EmptyState icon="&#x1F4CA;" title="Failed to load stats" subtitle="Check that the admin key is valid and the server is reachable." />;
  }

  const statCards = [
    { label: "TOTAL SESSIONS", value: stats.total_sessions },
    { label: "AVG RATING", value: stats.avg_rating },
    { label: "AVG DURATION", value: stats.avg_duration_sec ? `${Math.round(stats.avg_duration_sec)}s` : "\u2014" },
    { label: "UNIQUE TESTERS", value: stats.unique_testers },
  ];

  return (
    <div className="admin-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        {statCards.map(({ label, value }) => (
          <FrostedCard key={label} style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 32, fontWeight: 700, color: THEME.primary }}>
              {value ?? "\u2014"}
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 10, fontWeight: 700, color: THEME.textDim, letterSpacing: "0.06em", marginTop: 6 }}>
              {label}
            </div>
          </FrostedCard>
        ))}
      </div>

      {/* By difficulty */}
      {stats.by_difficulty?.length > 0 && (
        <FrostedCard style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 11, fontWeight: 700, color: THEME.textDim, letterSpacing: "0.06em", marginBottom: 12 }}>
            BY DIFFICULTY
          </div>
          {stats.by_difficulty.map((d) => (
            <div key={d.difficulty} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0", borderBottom: `1px solid ${THEME.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <DifficultyBadge difficulty={d.difficulty} />
              </div>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, color: THEME.textMuted }}>
                {d.sessions} sessions &middot; {d.avg_rating ?? "\u2014"} avg
              </span>
            </div>
          ))}
        </FrostedCard>
      )}

      {/* Top scenarios */}
      {stats.top_scenarios?.length > 0 && (
        <FrostedCard style={{ padding: 20 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 11, fontWeight: 700, color: THEME.textDim, letterSpacing: "0.06em", marginBottom: 12 }}>
            TOP SCENARIOS
          </div>
          {stats.top_scenarios.map((s) => (
            <div key={s.scenario_id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0", borderBottom: `1px solid ${THEME.border}`,
            }}>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: THEME.text }}>
                {s.title}
              </span>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, color: THEME.textMuted }}>
                {s.sessions} sessions &middot; {s.avg_rating ?? "\u2014"} avg
              </span>
            </div>
          ))}
        </FrostedCard>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const params = new URLSearchParams(window.location.search);
  const adminKey = params.get("key") || "";
  const [activeTab, setActiveTab] = useState("Sessions");

  if (!adminKey) {
    return (
      <div style={{
        height: "100vh", background: THEME.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: FONT.display, color: THEME.red, fontSize: 16,
      }}>
        Admin key required. Use /admin?key=YOUR_KEY
      </div>
    );
  }

  return (
    <div style={{
      height: "100vh", background: THEME.bg,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <style>{SCROLLBAR_CSS}</style>

      {/* Fixed header */}
      <div style={{
        flexShrink: 0, padding: "20px 32px 0",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 800, fontFamily: FONT.display,
              background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.light})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Training Admin
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: THEME.textDim, marginTop: 2 }}>
              MediCopilot Training Platform
            </div>
          </div>
          <a href="/" style={{
            fontFamily: FONT.display, fontSize: 12, fontWeight: 600,
            color: THEME.primary, textDecoration: "none",
            padding: "6px 14px", borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            transition: "border-color 0.15s",
          }}>
            &larr; Back to app
          </a>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: FONT.display, fontSize: 12, fontWeight: 600,
                background: activeTab === tab ? THEME.primary : "rgba(255,255,255,0.05)",
                color: activeTab === tab ? "#fff" : THEME.textDim,
                transition: "all 0.15s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content area — flex: 1, overflow hidden, minHeight 0 */}
      <div style={{
        flex: 1, overflow: "hidden", minHeight: 0,
        padding: "20px 32px 32px",
        display: "flex", flexDirection: "column",
      }}>
        {activeTab === "Sessions" && <SessionsTab adminKey={adminKey} />}
        {activeTab === "Scenarios" && <ScenariosTab />}
        {activeTab === "Stats" && <StatsTab adminKey={adminKey} />}
      </div>
    </div>
  );
}
