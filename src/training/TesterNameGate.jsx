import { useState } from "react";
import { useTraining } from "./TrainingContext.jsx";

const THEME = { primary: "#FF8A3D", dark: "#CC6B2E", light: "#FFB077" };

export function TesterNameGate({ onComplete }) {
  const { testerName, setTesterName } = useTraining();
  const [draft, setDraft] = useState(testerName);

  if (testerName) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setTesterName(name);
    onComplete?.(name);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#1a1a2e", border: `1px solid ${THEME.primary}`,
        borderRadius: 16, padding: 32, width: 380, maxWidth: "90vw",
        boxShadow: `0 0 40px rgba(255,138,61,0.2)`,
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            fontSize: 32, marginBottom: 8,
            background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.light})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
          }}>
            Training Mode
          </div>
          <div style={{
            fontFamily: "'Lora', serif", fontSize: 14, color: "rgba(255,255,255,0.6)",
          }}>
            Enter your name to begin a training session
          </div>
        </div>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your name"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 8,
            border: `1px solid rgba(255,138,61,0.3)`, background: "rgba(255,255,255,0.05)",
            color: "#fff", fontSize: 16, fontFamily: "'Lora', serif",
            outline: "none", boxSizing: "border-box",
          }}
        />
        <button type="submit" disabled={!draft.trim()} style={{
          width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 8,
          border: "none", cursor: draft.trim() ? "pointer" : "default",
          background: draft.trim() ? THEME.primary : "rgba(255,138,61,0.3)",
          color: "#fff", fontSize: 15, fontWeight: 700,
          fontFamily: "'Montserrat', sans-serif",
          transition: "background 0.2s",
        }}>
          Start Training
        </button>
      </form>
    </div>
  );
}
