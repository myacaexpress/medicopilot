/**
 * Training Admin Dashboard — /training/admin
 *
 * Lists all training sessions across all testers. No auth for now.
 * TODO: gate by user role at P5.
 */

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Copy, Download, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || (import.meta.env.VITE_BACKEND_WSS_URL?.replace("wss://", "https://").replace("/stream", "") || "");
const TRAINING_ORANGE = "#FF8A3D";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function formatDuration(start, end) {
  if (!start) return "—";
  const ms = (end ? new Date(end) : new Date()) - new Date(start);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export function AdminDashboard() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ tester: "", scenario: "", from: "", to: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!API_BASE) { setError("No API URL configured"); setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.tester) params.set("tester", filters.tester);
      if (filters.scenario) params.set("scenario", filters.scenario);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const [sessRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/training/sessions?${params}`),
        fetch(`${API_BASE}/api/training/stats`),
      ]);
      setSessions(await sessRes.json());
      setStats(await statsRes.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const loadDetail = async (id) => {
    setSelectedId(id);
    try {
      const res = await fetch(`${API_BASE}/api/training/sessions/${id}`);
      setDetail(await res.json());
    } catch {
      setDetail(null);
    }
  };

  const copyMarkdown = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/training/sessions/${id}/markdown`);
      const md = await res.text();
      await navigator.clipboard.writeText(md);
      setCopyFeedback(id);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      // fallback: select text
    }
  };

  const inputStyle = {
    padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 12,
    fontFamily: "'Lora', serif", outline: "none",
  };

  // Detail view
  if (selectedId && detail) {
    const { session, flags } = detail;
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    const suggestions = Array.isArray(session.ai_suggestions) ? session.ai_suggestions : [];

    return (
      <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#fff", padding: 32 }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <button
            data-testid="admin-back-btn"
            onClick={() => { setSelectedId(null); setDetail(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 24,
              background: "none", border: "none", color: TRAINING_ORANGE, cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif", fontSize: 13,
            }}
          >
            <ArrowLeft size={14} /> Back to sessions
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontSize: 22, color: TRAINING_ORANGE }}>
              {session.tester_name}'s Session
            </h1>
            <button
              data-testid="copy-markdown-btn"
              onClick={() => copyMarkdown(session.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                borderRadius: 8, border: `1px solid ${TRAINING_ORANGE}40`,
                background: copyFeedback === session.id ? `${TRAINING_ORANGE}30` : `${TRAINING_ORANGE}10`,
                color: TRAINING_ORANGE, cursor: "pointer",
                fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700,
              }}
            >
              <Copy size={14} /> {copyFeedback === session.id ? "Copied!" : "Copy as Markdown"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            <span>Scenario: <strong>{session.scenario_id || "Free practice"}</strong></span>
            <span>Duration: <strong>{formatDuration(session.started_at, session.ended_at)}</strong></span>
            <span>Started: <strong>{formatDate(session.started_at)}</strong></span>
            <span>Flags: <strong style={{ color: TRAINING_ORANGE }}>{flags.length}</strong></span>
          </div>

          {session.summary && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20, fontSize: 13 }}>
              <strong>Notes:</strong> {session.summary}
            </div>
          )}

          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.8)", marginBottom: 12 }}>
            Transcript ({transcript.length} utterances)
          </h2>
          <div data-testid="admin-transcript" style={{ marginBottom: 24 }}>
            {transcript.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No transcript recorded.</p>}
            {transcript.map((u, i) => (
              <div key={i} style={{
                padding: "6px 10px", marginBottom: 2, borderRadius: 4,
                background: u.speaker === "agent" ? "rgba(0,123,127,0.1)" : "rgba(255,138,61,0.08)",
                borderLeft: `3px solid ${u.speaker === "agent" ? "#007B7F" : TRAINING_ORANGE}`,
              }}>
                <span style={{ fontWeight: 700, fontSize: 10, fontFamily: "'Montserrat', sans-serif", color: u.speaker === "agent" ? "#1A9EA2" : TRAINING_ORANGE }}>
                  {u.speaker === "agent" ? "Agent" : "Client"}
                </span>
                <span style={{ marginLeft: 8, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{u.text}</span>
              </div>
            ))}
          </div>

          {suggestions.length > 0 && (
            <>
              <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.8)", marginBottom: 12 }}>
                AI Suggestions ({suggestions.length})
              </h2>
              <div data-testid="admin-suggestions" style={{ marginBottom: 24 }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{
                    padding: "8px 12px", marginBottom: 6, borderRadius: 6,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 10, color: "#1A9EA2", fontFamily: "'Montserrat', sans-serif", marginBottom: 4 }}>
                      {s.kind || "suggestion"}
                    </div>
                    {s.suggestion?.sayThis && <div style={{ color: "rgba(255,255,255,0.7)" }}>{s.suggestion.sayThis}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {flags.length > 0 && (
            <>
              <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.8)", marginBottom: 12 }}>
                Flags ({flags.length})
              </h2>
              <div data-testid="admin-flags">
                {flags.map((f, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", marginBottom: 8, borderRadius: 8,
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${TRAINING_ORANGE}15`,
                    borderLeft: `3px solid ${TRAINING_ORANGE}60`,
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 11, color: TRAINING_ORANGE, fontFamily: "'Montserrat', sans-serif" }}>
                        {f.feedback_type || "flag"}
                      </span>
                      {f.ts_in_call_seconds != null && (
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
                          at {Math.floor(f.ts_in_call_seconds / 60)}:{(f.ts_in_call_seconds % 60).toString().padStart(2, "0")}
                        </span>
                      )}
                    </div>
                    {f.feedback_text && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{f.feedback_text}</div>}
                    {f.suggested_fix && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Fix: {f.suggested_fix}</div>}
                    {f.transcript_context && Array.isArray(f.transcript_context) && f.transcript_context.length > 0 && (
                      <div style={{ marginTop: 6, padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4, fontSize: 11 }}>
                        {f.transcript_context.map((u, j) => (
                          <div key={j} style={{ color: "rgba(255,255,255,0.4)" }}>
                            <strong>{u.speaker}:</strong> {u.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#fff", padding: 32 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontSize: 24, color: TRAINING_ORANGE }}>
            Training Dashboard
          </h1>
          <a href="/" style={{ color: TRAINING_ORANGE, fontSize: 13, fontFamily: "'Montserrat', sans-serif", textDecoration: "none" }}>
            Back to App
          </a>
        </div>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "0 0 20px", fontFamily: "'Lora', serif" }}>
          Review training sessions from all testers.
        </p>

        {/* Stats */}
        {stats && (
          <div data-testid="admin-stats" style={{
            display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap",
          }}>
            {[
              { label: "Total Sessions", value: stats.total_sessions },
              { label: "Total Flags", value: stats.total_flags },
              { label: "Flags / Session", value: stats.flags_per_session ?? "—" },
              { label: "Top Feedback", value: stats.top_feedback_types?.[0]?.feedback_type || "—" },
            ].map((s) => (
              <div key={s.label} style={{
                flex: "1 1 120px", padding: "12px 16px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat', sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: TRAINING_ORANGE, fontFamily: "'Montserrat', sans-serif", marginTop: 2 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowFilters(!showFilters)} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
            color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontSize: 12,
          }}>
            <Filter size={12} /> Filters {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showFilters && (
            <div data-testid="admin-filters" style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input
                data-testid="filter-tester"
                placeholder="Tester name"
                value={filters.tester}
                onChange={(e) => setFilters((f) => ({ ...f, tester: e.target.value }))}
                style={inputStyle}
              />
              <input
                data-testid="filter-scenario"
                placeholder="Scenario ID"
                value={filters.scenario}
                onChange={(e) => setFilters((f) => ({ ...f, scenario: e.target.value }))}
                style={inputStyle}
              />
              <input
                data-testid="filter-from"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                style={inputStyle}
              />
              <input
                data-testid="filter-to"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                style={inputStyle}
              />
              <button onClick={fetchSessions} style={{
                padding: "6px 12px", borderRadius: 6, border: `1px solid ${TRAINING_ORANGE}40`,
                background: `${TRAINING_ORANGE}10`, color: TRAINING_ORANGE, cursor: "pointer",
                fontFamily: "'Montserrat', sans-serif", fontSize: 12,
              }}>
                <Search size={12} /> Apply
              </button>
            </div>
          )}
        </div>

        {/* Sessions list */}
        {loading && <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading...</p>}
        {error && <p style={{ color: "#F47C6E" }}>Error: {error}</p>}
        {!loading && !error && sessions.length === 0 && (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No training sessions yet. Start a training session to see data here.</p>
        )}
        <div data-testid="admin-sessions-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              data-testid={`session-row-${s.id}`}
              onClick={() => loadDetail(s.id)}
              style={{
                padding: "12px 16px", marginBottom: 6, borderRadius: 10, cursor: "pointer",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Montserrat', sans-serif", color: "#fff" }}>
                    {s.tester_name}
                  </span>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: `${TRAINING_ORANGE}15`, color: TRAINING_ORANGE,
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                  }}>
                    {s.scenario_id || "free"}
                  </span>
                  {s.flag_count > 0 && (
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {s.flag_count} flags
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {formatDate(s.started_at)} · {formatDuration(s.started_at, s.ended_at)}
                  {s.ended_at ? "" : " (in progress)"}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); copyMarkdown(s.id); }}
                style={{
                  background: "none", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 6,
                  padding: "4px 8px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 10,
                  fontFamily: "'Montserrat', sans-serif", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Copy size={10} /> {copyFeedback === s.id ? "Copied!" : "Copy MD"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
