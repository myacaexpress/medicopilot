import { useState, useEffect } from "react";
import { fetchAdminSessions, fetchAdminSessionDetail, fetchAdminStats, fetchScenarios } from "./api.js";

const THEME = { primary: "#FF8A3D", dark: "#CC6B2E", light: "#FFB077" };
const TABS = ["Sessions", "Scenarios", "Stats"];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function fmtDuration(ms) {
  if (!ms) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const mono = { fontFamily: "'JetBrains Mono', monospace" };
  const serif = { fontFamily: "'Lora', serif" };

  if (event.type === "transcript") {
    const isAgent = event.speaker === "agent";
    return (
      <div style={{ display: "flex", gap: 8, marginBottom: 6, flexDirection: isAgent ? "row-reverse" : "row" }}>
        <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", minWidth: 36, textAlign: "right", paddingTop: 6, flexShrink: 0 }}>
          {ts}
        </span>
        <div style={{
          maxWidth: "70%", padding: "6px 10px", borderRadius: 10,
          background: isAgent ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.06)",
          border: isAgent ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ ...mono, fontSize: 9, color: isAgent ? "rgba(59,130,246,0.7)" : "rgba(255,255,255,0.35)", marginBottom: 2 }}>
            {isAgent ? "AGENT" : "CLIENT"}
          </div>
          <div style={{ ...serif, fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
            {event.text}
          </div>
        </div>
      </div>
    );
  }

  if (event.type === "suggestion") {
    const kind = event.triggerInfo?.kind;
    return (
      <div style={{ display: "flex", gap: 8, marginBottom: 8, justifyContent: "center" }}>
        <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", minWidth: 36, textAlign: "right", paddingTop: 8, flexShrink: 0 }}>
          {ts}
        </span>
        <div style={{
          maxWidth: "80%", padding: "8px 12px", borderRadius: 10,
          background: "rgba(255,138,61,0.06)", border: `1px solid rgba(255,138,61,0.2)`,
        }}>
          <div style={{ ...mono, fontSize: 9, color: THEME.primary, marginBottom: 4, display: "flex", gap: 8 }}>
            <span>AI SUGGESTION</span>
            {event.callStage && <span style={{ color: "rgba(255,138,61,0.6)" }}>[stage: {event.callStage}]</span>}
            {kind && <span style={{ color: "rgba(255,138,61,0.6)" }}>[{kind}]</span>}
          </div>
          {event.sayThis && (
            <div style={{ ...serif, fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
              &rarr; {event.sayThis}
            </div>
          )}
          {Array.isArray(event.followUps) && event.followUps.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {event.followUps.map((q, i) => (
                <div key={i} style={{ ...serif, fontSize: 11, color: "rgba(255,255,255,0.5)", paddingLeft: 12 }}>
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
      <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
        <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", minWidth: 36, textAlign: "right", flexShrink: 0 }}>
          {ts}
        </span>
        <div style={{
          flex: 1, padding: "4px 10px", borderRadius: 6,
          background: "rgba(244,124,110,0.08)", border: "1px solid rgba(244,124,110,0.2)",
          display: "flex", gap: 6, alignItems: "center",
        }}>
          <span style={{ fontSize: 12 }}>&#x1F6A9;</span>
          <span style={{ ...serif, fontSize: 12, color: "#F47C6E" }}>
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
    const lines = [
      `# Training Session — ${detail.scenario_title}`,
      `- Tester: ${detail.tester_name}`,
      `- Date: ${fmtDate(detail.started_at)}`,
      `- Duration: ${fmtDuration(detail.duration_ms)}`,
      `- Rating: ${detail.rating || "—"}/5`,
      detail.master_prompt_version ? `- Master prompt version: ${detail.master_prompt_version}` : null,
      "",
      "## Scenario",
      detail.persona_name ? `**Persona:** ${detail.persona_name}` : null,
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
        border: `1px solid ${THEME.primary}`, background: copied ? "rgba(255,138,61,0.15)" : "transparent",
        color: THEME.primary, fontSize: 12, fontWeight: 600,
        fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
        transition: "background 0.2s",
      }}
    >
      {copied ? "Copied!" : "Copy as Markdown"}
    </button>
  );
}

function SessionsTab({ adminKey }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetchAdminSessions(adminKey, { limit: 50 })
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminKey]);

  const openDetail = async (id) => {
    try {
      const d = await fetchAdminSessionDetail(adminKey, id);
      setDetail(d);
    } catch {}
  };

  if (detail) {
    const timeline = buildTimeline(detail);
    return (
      <div style={{ display: "flex", gap: 20, height: "calc(100vh - 160px)" }}>
        {/* Main timeline column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <button onClick={() => setDetail(null)} style={{
            background: "none", border: "none", color: THEME.primary, cursor: "pointer",
            fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, marginBottom: 12,
            alignSelf: "flex-start",
          }}>
            &larr; Back to list
          </button>
          <div style={{
            flex: 1, overflowY: "auto", background: "rgba(255,255,255,0.02)",
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: 16,
          }}>
            {timeline.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Lora', serif", fontSize: 13, textAlign: "center", padding: 40 }}>
                No timeline events recorded for this session.
              </div>
            ) : timeline.map((ev, i) => (
              <TimelineEvent key={i} event={ev} />
            ))}
          </div>
        </div>
        {/* Sidebar */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          <div style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16,
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              {detail.scenario_title}
            </div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              Tester: {detail.tester_name}<br/>
              Date: {fmtDate(detail.started_at)}<br/>
              Duration: {fmtDuration(detail.duration_ms)}<br/>
              {detail.rating && <>Rating: {detail.rating}/5<br/></>}
              {detail.master_prompt_version && <>Prompt: {detail.master_prompt_version}</>}
            </div>
          </div>
          {detail.persona_name && (
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16,
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginBottom: 6 }}>
                SCENARIO
              </div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                <strong style={{ color: "rgba(255,255,255,0.7)" }}>{detail.persona_name}</strong>
                {detail.situation && <><br/>{detail.situation}</>}
              </div>
            </div>
          )}
          {detail.success_criteria?.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16,
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginBottom: 6 }}>
                SUCCESS CRITERIA
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                {detail.success_criteria.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {detail.feedback_text && (
            <div style={{
              background: "rgba(255,138,61,0.06)", borderRadius: 12, padding: 16,
              border: "1px solid rgba(255,138,61,0.1)",
            }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginBottom: 6 }}>
                TESTER FEEDBACK
              </div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                {detail.feedback_text}
              </div>
            </div>
          )}
          <CopyMarkdownButton detail={detail} timeline={timeline} />
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", padding: 20 }}>Loading...</div>;

  return (
    <div>
      {sessions.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.5)", padding: 20, fontFamily: "'Lora', serif" }}>
          No sessions yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => openDetail(s.id)}
              style={{
                textAlign: "left", padding: 12, borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)",
                cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>
                  {s.scenario_title || s.scenario_id}
                </span>
                <span style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>
                  {s.tester_name}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {s.rating && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: THEME.primary }}>
                    {s.rating}/5
                  </span>
                )}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                  {fmtDuration(s.duration_ms)}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                  {fmtDate(s.started_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
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

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", padding: 20 }}>Loading...</div>;
  if (!stats) return <div style={{ color: "#F47C6E", padding: 20 }}>Failed to load stats</div>;

  const StatCard = ({ label, value }) => (
    <div style={{
      padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", flex: 1,
    }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: THEME.primary }}>
        {value ?? "—"}
      </div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <StatCard label="TOTAL SESSIONS" value={stats.total_sessions} />
        <StatCard label="AVG RATING" value={stats.avg_rating} />
        <StatCard label="AVG DURATION" value={stats.avg_duration_sec ? `${stats.avg_duration_sec}s` : "—"} />
        <StatCard label="UNIQUE TESTERS" value={stats.unique_testers} />
      </div>

      {stats.by_difficulty?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginBottom: 8 }}>
            BY DIFFICULTY
          </div>
          {stats.by_difficulty.map((d) => (
            <div key={d.difficulty} style={{
              display: "flex", justifyContent: "space-between", padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: "#fff", textTransform: "capitalize" }}>
                {d.difficulty}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {d.sessions} sessions · {d.avg_rating ?? "—"} avg
              </span>
            </div>
          ))}
        </div>
      )}

      {stats.top_scenarios?.length > 0 && (
        <div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginBottom: 8 }}>
            TOP SCENARIOS
          </div>
          {stats.top_scenarios.map((s) => (
            <div key={s.scenario_id} style={{
              display: "flex", justifyContent: "space-between", padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "#fff" }}>
                {s.title}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {s.sessions} sessions · {s.avg_rating ?? "—"} avg
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScenariosTab() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", padding: 20 }}>Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {scenarios.map((s) => (
        <div key={s.id} style={{
          padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span style={{
              display: "inline-block", padding: "1px 6px", borderRadius: 4,
              fontSize: 9, fontWeight: 700, fontFamily: "'Montserrat', sans-serif",
              color: s.difficulty === "beginner" ? "#34C77B" : s.difficulty === "intermediate" ? "#FFB077" : "#F47C6E",
              background: `${s.difficulty === "beginner" ? "#34C77B" : s.difficulty === "intermediate" ? "#FFB077" : "#F47C6E"}22`,
            }}>
              {s.difficulty}
            </span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>
              {s.persona_name}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              {s.id}
            </span>
          </div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            {s.situation}
          </div>
        </div>
      ))}
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
        minHeight: "100vh", background: "#0f0f1a", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Montserrat', sans-serif", color: "#F47C6E", fontSize: 16,
      }}>
        Admin key required. Use /admin?key=YOUR_KEY
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f0f1a", padding: 32,
      maxWidth: 960, margin: "0 auto",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div>
          <div style={{
            fontSize: 24, fontWeight: 800, fontFamily: "'Montserrat', sans-serif",
            background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.light})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Training Admin
          </div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            MediCopilot Training Platform
          </div>
        </div>
        <a href="/" style={{
          fontFamily: "'Montserrat', sans-serif", fontSize: 12,
          color: THEME.primary, textDecoration: "none",
        }}>
          &larr; Back to app
        </a>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600,
              background: activeTab === tab ? THEME.primary : "rgba(255,255,255,0.05)",
              color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
              transition: "all 0.2s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Sessions" && <SessionsTab adminKey={adminKey} />}
      {activeTab === "Scenarios" && <ScenariosTab />}
      {activeTab === "Stats" && <StatsTab adminKey={adminKey} />}
    </div>
  );
}
