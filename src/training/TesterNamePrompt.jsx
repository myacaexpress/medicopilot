/**
 * Prompts for the tester's name on first visit with training mode ON.
 * Simple modal — no auth, just localStorage persistence.
 */

import { useState } from "react";
import { useTraining } from "./TrainingContext.jsx";

const TRAINING_ORANGE = "#FF8A3D";

export function TesterNamePrompt({ onDone }) {
  const { setTesterName } = useTraining();
  const [name, setName] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    setTesterName(name.trim());
    onDone?.();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
    }}>
      <div style={{
        background: "#1a1a2e", borderRadius: 16,
        border: `1px solid ${TRAINING_ORANGE}40`,
        padding: "32px 40px", maxWidth: 400, width: "90%",
        boxShadow: `0 0 40px ${TRAINING_ORANGE}20`,
      }}>
        <h2 style={{ margin: "0 0 8px", color: TRAINING_ORANGE, fontFamily: "'Montserrat', sans-serif", fontSize: 20 }}>
          Training Mode
        </h2>
        <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "'Lora', serif" }}>
          Enter your name to identify your practice sessions.
        </p>
        <input
          data-testid="tester-name-input"
          autoFocus
          type="text"
          placeholder="Your name (e.g. Michael)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 8,
            border: `1px solid ${TRAINING_ORANGE}40`, background: "rgba(255,255,255,0.05)",
            color: "#fff", fontSize: 16, fontFamily: "'Lora', serif",
            outline: "none", boxSizing: "border-box",
          }}
        />
        <button
          data-testid="tester-name-submit"
          onClick={submit}
          disabled={!name.trim()}
          style={{
            marginTop: 16, width: "100%", padding: "10px 0", borderRadius: 8,
            background: name.trim() ? TRAINING_ORANGE : "rgba(255,138,61,0.3)",
            border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
            fontFamily: "'Montserrat', sans-serif", cursor: name.trim() ? "pointer" : "default",
          }}
        >
          Start Training
        </button>
      </div>
    </div>
  );
}
