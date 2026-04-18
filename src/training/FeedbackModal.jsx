import { useState } from "react";

const THEME = { primary: "#FF8A3D", dark: "#CC6B2E", light: "#FFB077" };

export function FeedbackModal({ scenario, durationMs, onSubmit, onSkip }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");

  const fmtDuration = (ms) => {
    if (!ms) return "—";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#1a1a2e", border: `1px solid ${THEME.primary}`,
        borderRadius: 16, padding: 32, width: 420, maxWidth: "90vw",
        boxShadow: `0 0 40px rgba(255,138,61,0.2)`,
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            fontSize: 20, fontWeight: 800, fontFamily: "'Montserrat', sans-serif",
            color: "#fff", marginBottom: 4,
          }}>
            Call Complete
          </div>
          <div style={{
            fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(255,255,255,0.5)",
          }}>
            {scenario?.persona_name} — {fmtDuration(durationMs)}
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600,
            color: "rgba(255,255,255,0.5)", marginBottom: 8, letterSpacing: "0.04em",
          }}>
            How helpful were the AI suggestions?
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                style={{
                  width: 40, height: 40, borderRadius: 8, border: "none",
                  cursor: "pointer", fontSize: 18,
                  background: n <= (hoverRating || rating)
                    ? THEME.primary
                    : "rgba(255,255,255,0.08)",
                  color: n <= (hoverRating || rating) ? "#fff" : "rgba(255,255,255,0.3)",
                  transition: "all 0.15s",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {scenario?.success_criteria?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600,
              color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginBottom: 6,
            }}>
              SUCCESS CRITERIA
            </div>
            <ul style={{
              margin: 0, paddingLeft: 16,
              fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.5)",
              lineHeight: 1.6,
            }}>
              {scenario.success_criteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Notes on what went well or could improve..."
          rows={3}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
            color: "#fff", fontSize: 13, fontFamily: "'Lora', serif",
            outline: "none", resize: "vertical", boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onSkip} style={{
            flex: 1, padding: "10px 0", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
            color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600,
            fontFamily: "'Montserrat', sans-serif", cursor: "pointer",
          }}>
            Skip
          </button>
          <button
            onClick={() => onSubmit({ rating, feedbackText })}
            disabled={!rating}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 8, border: "none",
              cursor: rating ? "pointer" : "default",
              background: rating ? THEME.primary : "rgba(255,138,61,0.3)",
              color: "#fff", fontSize: 13, fontWeight: 700,
              fontFamily: "'Montserrat', sans-serif", transition: "background 0.2s",
            }}
          >
            Submit Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
