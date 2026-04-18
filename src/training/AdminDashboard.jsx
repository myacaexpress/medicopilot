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
    return (
      <div>
        <button onClick={() => setDetail(null)} style={{
          background: "none", border: "none", color: THEME.primary, cursor: "pointer",
          fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, marginBottom: 16,
        }}>
          &larr; Back to list
        </button>
        <div style={{
          background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 20,
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            {detail.scenario_title}
          </div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
            Tester: {detail.tester_name} · {fmtDate(detail.started_at)} · Duration: {fmtDuration(detail.duration_ms)}
            {detail.rating && ` · Rating: ${detail.rating}/5`}
          </div>
          {detail.situation && (
            <div style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
              Scenario: {detail.situation}
            </div>
          )}
          {detail.feedback_text && (
            <div style={{
              padding: 12, borderRadius: 8, background: "rgba(255,138,61,0.06)",
              border: "1px solid rgba(255,138,61,0.1)",
              fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16,
            }}>
              {detail.feedback_text}
            </div>
          )}
          {detail.success_criteria?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginBottom: 6 }}>
                SUCCESS CRITERIA
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                {detail.success_criteria.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {detail.flags?.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginBottom: 6 }}>
                FLAGS ({detail.flags.length})
              </div>
              {detail.flags.map((f, i) => (
                <div key={i} style={{
                  padding: "6px 10px", marginBottom: 4, borderRadius: 6,
                  background: "rgba(255,138,61,0.04)", border: "1px solid rgba(255,138,61,0.08)",
                  display: "flex", gap: 8, alignItems: "center",
                }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: THEME.primary }}>
                    {fmtDuration(f.timestamp_ms)}
                  </span>
                  <span style={{ fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    {f.note || f.flag_type}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              const md = [
                `## ${detail.scenario_title}`,
                `**Tester:** ${detail.tester_name}  `,
                `**Date:** ${fmtDate(detail.started_at)}  `,
                `**Duration:** ${fmtDuration(detail.duration_ms)}  `,
                `**Rating:** ${detail.rating || "—"}/5  `,
                "",
                detail.feedback_text ? `### Feedback\n${detail.feedback_text}\n` : "",
                detail.flags?.length ? `### Flags\n${detail.flags.map(f => `- **${fmtDuration(f.timestamp_ms)}** ${f.note || f.flag_type}`).join("\n")}\n` : "",
              ].filter(Boolean).join("\n");
              navigator.clipboard.writeText(md);
            }}
            style={{
              marginTop: 16, padding: "8px 16px", borderRadius: 8,
              border: `1px solid ${THEME.primary}`, background: "transparent",
              color: THEME.primary, fontSize: 12, fontWeight: 600,
              fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
            }}
          >
            Copy as Markdown
          </button>
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
