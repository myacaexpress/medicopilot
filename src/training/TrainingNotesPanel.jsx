import { useState, useEffect, useRef, useCallback } from "react";
import { Flag, Clock, ChevronDown, ChevronUp, X, Mic, User, Lightbulb } from "lucide-react";
import { useTraining } from "./TrainingContext.jsx";
import { SoloToggle } from "./SoloToggle.jsx";

const TRAINING_ORANGE = "#FF8A3D";
const ONBOARDING_KEY = "trainingOnboardingDone";
const FEEDBACK_TYPES = [
  { value: "better_phrase", label: "Better phrase" },
  { value: "wrong_direction", label: "Wrong direction" },
  { value: "compliance_miss", label: "Compliance miss" },
  { value: "good_catch", label: "Good catch" },
  { value: "other", label: "Other" },
];

const ONBOARDING_STEPS = [
  { title: "Welcome to Training Mode", body: "Practice as both Agent and Client — solo, at your own pace." },
  { title: "Pick a Scenario", body: "Choose a pre-built Medicare persona, or do Free Practice with no script." },
  { title: "Switch Speakers", body: "Click Agent / Client buttons (or press Space) to switch who's speaking." },
  { title: "Flag Moments", body: "Click \"Flag this moment\" anytime the AI says something you'd tune — full context is captured for review." },
];

function formatTimer(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function TrainingNotesPanel({ onRoleChange, transcripts, suggestions, callActive }) {
  const { activeScenario, flags, addFlag, testerName, activeSession, sessionStartedAt } = useTraining();
  const [elapsed, setElapsed] = useState(0);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagType, setFlagType] = useState("other");
  const [flagText, setFlagText] = useState("");
  const [flagFix, setFlagFix] = useState("");
  const [showFlags, setShowFlags] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(-1);
  const timerRef = useRef(null);

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) setOnboardingStep(0);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!sessionStartedAt.current) return;
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - sessionStartedAt.current);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [sessionStartedAt.current]);

  const dismissOnboarding = useCallback(() => {
    setOnboardingStep(-1);
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* noop */ }
  }, []);

  const nextOnboarding = useCallback(() => {
    setOnboardingStep((s) => {
      if (s >= ONBOARDING_STEPS.length - 1) {
        try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* noop */ }
        return -1;
      }
      return s + 1;
    });
  }, []);

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

  // Onboarding overlay
  if (onboardingStep >= 0) {
    const step = ONBOARDING_STEPS[onboardingStep];
    return (
      <div data-testid="training-onboarding" style={{
        position: "fixed", top: 60, right: 12, width: 360, zIndex: 10000,
        background: "rgba(20,15,35,0.97)", borderRadius: 16,
        border: `2px solid ${TRAINING_ORANGE}`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 40px ${TRAINING_ORANGE}20`,
        fontFamily: "'Lora', serif", color: "#fff",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "20px 24px 16px",
          background: `linear-gradient(135deg, ${TRAINING_ORANGE}15, transparent)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${TRAINING_ORANGE}20`, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Lightbulb size={20} color={TRAINING_ORANGE} />
            </div>
            <div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 15, fontWeight: 800, color: TRAINING_ORANGE }}>
                {step.title}
              </div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                Step {onboardingStep + 1} of {ONBOARDING_STEPS.length}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.8)", margin: 0 }}>
            {step.body}
          </p>
        </div>
        <div style={{
          padding: "12px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {ONBOARDING_STEPS.map((_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i === onboardingStep ? TRAINING_ORANGE : "rgba(255,255,255,0.15)",
                transition: "background 0.2s",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={dismissOnboarding} style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600,
            }}>
              Skip
            </button>
            <button data-testid="onboarding-next" onClick={nextOnboarding} style={{
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: TRAINING_ORANGE, color: "#fff", cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700,
              boxShadow: `0 2px 12px ${TRAINING_ORANGE}40`,
            }}>
              {onboardingStep === ONBOARDING_STEPS.length - 1 ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (minimized) {
    return (
      <div
        data-testid="training-notes-minimized"
        onClick={() => setMinimized(false)}
        style={{
          position: "fixed", top: 60, right: 12, zIndex: 9999,
          background: `${TRAINING_ORANGE}25`, border: `2px solid ${TRAINING_ORANGE}60`,
          borderRadius: 12, padding: "10px 16px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: TRAINING_ORANGE,
          fontWeight: 700, boxShadow: `0 4px 20px ${TRAINING_ORANGE}20`,
        }}
      >
        <Flag size={14} /> {flags.length} flags
        {activeSession && <> | <Clock size={12} /> {formatTimer(elapsed)}</>}
      </div>
    );
  }

  const hasSession = !!activeSession;

  return (
    <div data-testid="training-notes-panel" style={{
      position: "fixed", top: 60, right: 12, width: 360, maxHeight: "calc(100vh - 72px)",
      zIndex: 9999, overflowY: "auto",
      background: "rgba(18,14,32,0.97)", borderRadius: 16,
      border: `2px solid ${TRAINING_ORANGE}50`,
      boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 30px ${TRAINING_ORANGE}12`,
      fontFamily: "'Lora', serif", color: "#fff",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${TRAINING_ORANGE}25`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: `linear-gradient(135deg, ${TRAINING_ORANGE}08, transparent)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: TRAINING_ORANGE,
            boxShadow: `0 0 8px ${TRAINING_ORANGE}80`,
            animation: hasSession ? "pulse 2s infinite" : "none",
          }} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 800, color: TRAINING_ORANGE }}>
            Training
          </span>
          {hasSession && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4,
            }}>
              <Clock size={11} /> {formatTimer(elapsed)}
            </span>
          )}
        </div>
        <button onClick={() => setMinimized(true)} style={{
          background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.4)",
          cursor: "pointer", padding: "4px 6px", borderRadius: 6,
        }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: "16px 18px" }}>
        {/* Tester name */}
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
          Tester: <strong style={{ color: "rgba(255,255,255,0.8)" }}>{testerName}</strong>
        </div>

        {/* Scenario persona card */}
        {activeScenario && (
          <div data-testid="scenario-persona-card" style={{
            marginBottom: 16, padding: "14px 16px", borderRadius: 12,
            background: `linear-gradient(135deg, ${TRAINING_ORANGE}12, ${TRAINING_ORANGE}05)`,
            border: `1px solid ${TRAINING_ORANGE}25`,
          }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 800,
              color: TRAINING_ORANGE, marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
            }}>
              <User size={14} /> {activeScenario.name}
            </div>
            <div data-testid="scenario-persona" style={{
              fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6,
            }}>
              {activeScenario.clientPersona}
            </div>
            {activeScenario.successCriteria && (
              <div style={{
                marginTop: 10, padding: "8px 10px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700,
                  color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
                }}>
                  Success criteria
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                  {activeScenario.successCriteria}
                </div>
              </div>
            )}
          </div>
        )}

        {!activeScenario && hasSession && (
          <div style={{
            marginBottom: 16, padding: "12px 16px", borderRadius: 12,
            background: `${TRAINING_ORANGE}08`, border: `1px solid ${TRAINING_ORANGE}15`,
            fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)",
          }}>
            Free Practice — no scenario loaded
          </div>
        )}

        {!hasSession && (
          <div style={{
            marginBottom: 16, padding: "14px 16px", borderRadius: 12,
            background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
            textAlign: "center", fontFamily: "'Montserrat', sans-serif", fontSize: 12,
            color: "rgba(255,255,255,0.35)", lineHeight: 1.6,
          }}>
            Click <strong style={{ color: TRAINING_ORANGE }}>Start Call</strong> to begin a training session
          </div>
        )}

        {/* Solo Toggle — only during active call */}
        {callActive && hasSession && (
          <div style={{ marginBottom: 16 }}>
            <SoloToggle onRoleChange={onRoleChange} />
          </div>
        )}

        {/* ===== FLAG THIS MOMENT — hero button ===== */}
        <button
          data-testid="flag-moment-btn"
          onClick={() => setShowFlagForm(!showFlagForm)}
          style={{
            width: "100%", padding: "14px 16px", borderRadius: 12,
            border: `2px solid ${TRAINING_ORANGE}`,
            background: showFlagForm ? `${TRAINING_ORANGE}30` : `linear-gradient(135deg, ${TRAINING_ORANGE}20, ${TRAINING_ORANGE}10)`,
            color: TRAINING_ORANGE, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 800,
            letterSpacing: "0.02em",
            boxShadow: `0 4px 20px ${TRAINING_ORANGE}25`,
            transition: "all 0.15s ease",
          }}
        >
          <Flag size={18} />
          Flag this moment
          {flags.length > 0 && (
            <span style={{
              background: TRAINING_ORANGE, color: "#fff", borderRadius: 20,
              padding: "2px 8px", fontSize: 11, fontWeight: 700, marginLeft: 4,
            }}>
              {flags.length}
            </span>
          )}
        </button>

        {/* Flag form */}
        {showFlagForm && (
          <div data-testid="flag-form" style={{
            marginTop: 10, padding: "14px 16px", borderRadius: 12,
            background: "rgba(255,255,255,0.04)", border: `1px solid ${TRAINING_ORANGE}20`,
          }}>
            <select
              data-testid="flag-type-select"
              value={flagType}
              onChange={(e) => setFlagType(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8, marginBottom: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 13, fontFamily: "'Lora', serif",
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
                width: "100%", padding: "8px 10px", borderRadius: 8, marginBottom: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 13, fontFamily: "'Lora', serif", resize: "vertical",
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
                width: "100%", padding: "8px 10px", borderRadius: 8, marginBottom: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 13, fontFamily: "'Lora', serif", resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <button
              data-testid="flag-submit-btn"
              onClick={submitFlag}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8,
                background: TRAINING_ORANGE, border: "none", color: "#fff",
                fontSize: 13, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
                boxShadow: `0 2px 10px ${TRAINING_ORANGE}30`,
              }}
            >
              Save Flag
            </button>
          </div>
        )}

        {/* Flags list */}
        {flags.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button onClick={() => setShowFlags(!showFlags)} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, padding: 0,
              fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700,
            }}>
              {showFlags ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Flags ({flags.length})
            </button>
            {showFlags && (
              <div data-testid="flags-list" style={{ marginTop: 8 }}>
                {flags.map((f, i) => (
                  <div key={i} style={{
                    padding: "8px 10px", marginBottom: 6, borderRadius: 8,
                    background: "rgba(255,255,255,0.03)", fontSize: 12,
                    borderLeft: `3px solid ${TRAINING_ORANGE}60`,
                  }}>
                    <span style={{ color: TRAINING_ORANGE, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", fontSize: 11 }}>
                      {f.feedbackType || "flag"}
                    </span>
                    {f.tsInCallSeconds != null && (
                      <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                        {Math.floor(f.tsInCallSeconds / 60)}:{(f.tsInCallSeconds % 60).toString().padStart(2, "0")}
                      </span>
                    )}
                    {f.feedbackText && (
                      <div style={{ color: "rgba(255,255,255,0.6)", marginTop: 3 }}>{f.feedbackText}</div>
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
