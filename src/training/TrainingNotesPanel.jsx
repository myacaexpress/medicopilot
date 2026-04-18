/**
 * Training Notes panel — rendered OUTSIDE the MediCopilot overlay
 * as a floating sidebar on the right side of the screen.
 *
 * Shows: scenario info, solo toggle, flags, session timer.
 */

import { useState, useEffect, useRef } from "react";
import { Flag, Clock, ChevronDown, ChevronUp, X } from "lucide-react";
import { useTraining } from "./TrainingContext.jsx";
import { SoloToggle } from "./SoloToggle.jsx";

const TRAINING_ORANGE = "#FF8A3D";
const FEEDBACK_TYPES = [
  { value: "better_phrase", label: "Better phrase" },
  { value: "wrong_direction", label: "Wrong direction" },
  { value: "compliance_miss", label: "Compliance miss" },
  { value: "good_catch", label: "Good catch" },
  { value: "other", label: "Other" },
];

function formatTimer(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function TrainingNotesPanel({ onRoleChange, transcripts, suggestions }) {
  const { activeScenario, flags, addFlag, testerName, activeSession, sessionStartedAt } = useTraining();
  const [elapsed, setElapsed] = useState(0);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagType, setFlagType] = useState("other");
  const [flagText, setFlagText] = useState("");
  const [flagFix, setFlagFix] = useState("");
  const [showFlags, setShowFlags] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!sessionStartedAt.current) return;
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - sessionStartedAt.current);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [sessionStartedAt.current]);

  const submitFlag = async () => {
    const recentTranscript = (transcripts || []).slice(-5);
    const recentSuggestion = (suggestions || []).slice(-1)[0] || null;
    await addFlag({
      feedbackType: flagType,
      feedbackText: flagText || null,
      suggestedFix: flagFix || null,
      transcriptContext: recentTranscript,
      aiSuggestionShown: recentSuggestion,
    });
    setShowFlagForm(false);
    setFlagText("");
    setFlagFix("");
  };

  if (minimized) {
    return (
      <div
        data-testid="training-notes-minimized"
        onClick={() => setMinimized(false)}
        style={{
          position: "fixed", top: 12, right: 12, zIndex: 9999,
          background: `${TRAINING_ORANGE}20`, border: `1px solid ${TRAINING_ORANGE}40`,
          borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: TRAINING_ORANGE,
        }}
      >
        <Flag size={12} /> {flags.length} flags | {formatTimer(elapsed)}
      </div>
    );
  }

  return (
    <div data-testid="training-notes-panel" style={{
      position: "fixed", top: 12, right: 12, width: 300, maxHeight: "calc(100vh - 24px)",
      zIndex: 9999, overflowY: "auto",
      background: "rgba(20,20,40,0.95)", borderRadius: 14,
      border: `1px solid ${TRAINING_ORANGE}30`,
      boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 20px ${TRAINING_ORANGE}10`,
      fontFamily: "'Lora', serif", color: "#fff",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${TRAINING_ORANGE}20`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 700, color: TRAINING_ORANGE }}>
            Training Notes
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 4,
          }}>
            <Clock size={10} /> {formatTimer(elapsed)}
          </span>
        </div>
        <button onClick={() => setMinimized(true)} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 2,
        }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: "12px 16px" }}>
        {/* Tester */}
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
          Tester: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{testerName}</strong>
        </div>

        {/* Scenario + Persona */}
        {activeScenario && (
          <div style={{
            marginBottom: 14, padding: "10px 12px", borderRadius: 8,
            background: `${TRAINING_ORANGE}08`, border: `1px solid ${TRAINING_ORANGE}15`,
          }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700, color: TRAINING_ORANGE, marginBottom: 6 }}>
              {activeScenario.name}
            </div>
            <div data-testid="scenario-persona" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
              {activeScenario.clientPersona}
            </div>
          </div>
        )}

        {/* Solo Toggle */}
        <div style={{ marginBottom: 14 }}>
          <SoloToggle onRoleChange={onRoleChange} />
        </div>

        {/* Flag button */}
        <button
          data-testid="flag-moment-btn"
          onClick={() => setShowFlagForm(!showFlagForm)}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 8,
            border: `1px solid ${TRAINING_ORANGE}40`, background: `${TRAINING_ORANGE}10`,
            color: TRAINING_ORANGE, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700,
          }}
        >
          <Flag size={14} /> Flag this moment ({flags.length})
        </button>

        {/* Flag form */}
        {showFlagForm && (
          <div data-testid="flag-form" style={{
            marginTop: 8, padding: "10px 12px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <select
              data-testid="flag-type-select"
              value={flagType}
              onChange={(e) => setFlagType(e.target.value)}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6, marginBottom: 6,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 12, fontFamily: "'Lora', serif",
              }}
            >
              {FEEDBACK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <textarea
              data-testid="flag-text-input"
              placeholder="What happened?"
              value={flagText}
              onChange={(e) => setFlagText(e.target.value)}
              rows={2}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6, marginBottom: 6,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 12, fontFamily: "'Lora', serif", resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <textarea
              data-testid="flag-fix-input"
              placeholder="Suggested fix (optional)"
              value={flagFix}
              onChange={(e) => setFlagFix(e.target.value)}
              rows={2}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6, marginBottom: 6,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 12, fontFamily: "'Lora', serif", resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <button
              data-testid="flag-submit-btn"
              onClick={submitFlag}
              style={{
                width: "100%", padding: "6px 0", borderRadius: 6,
                background: TRAINING_ORANGE, border: "none", color: "#fff",
                fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
              }}
            >
              Save Flag
            </button>
          </div>
        )}

        {/* Flags list */}
        {flags.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowFlags(!showFlags)} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, padding: 0,
              fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 700,
            }}>
              {showFlags ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Flags ({flags.length})
            </button>
            {showFlags && (
              <div data-testid="flags-list" style={{ marginTop: 6 }}>
                {flags.map((f, i) => (
                  <div key={i} style={{
                    padding: "6px 8px", marginBottom: 4, borderRadius: 6,
                    background: "rgba(255,255,255,0.03)", fontSize: 11,
                    borderLeft: `3px solid ${TRAINING_ORANGE}60`,
                  }}>
                    <span style={{ color: TRAINING_ORANGE, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", fontSize: 10 }}>
                      {f.feedbackType || "flag"}
                    </span>
                    {f.tsInCallSeconds != null && (
                      <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}>
                        {Math.floor(f.tsInCallSeconds / 60)}:{(f.tsInCallSeconds % 60).toString().padStart(2, "0")}
                      </span>
                    )}
                    {f.feedbackText && (
                      <div style={{ color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{f.feedbackText}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
