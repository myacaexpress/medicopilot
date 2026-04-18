/**
 * Scenario picker shown when training mode is ON and a call is about
 * to start. Tester picks a practice scenario or "free practice."
 */

import { useState } from "react";
import { TRAINING_SCENARIOS } from "../data/training/scenarios.js";
import { useTraining } from "./TrainingContext.jsx";

const TRAINING_ORANGE = "#FF8A3D";

export function ScenarioPicker({ onSelect }) {
  const { testerName } = useTraining();
  const [selected, setSelected] = useState(null);

  const pick = (scenario) => {
    setSelected(scenario?.id || "free");
    onSelect(scenario);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99998,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
    }}>
      <div style={{
        background: "#1a1a2e", borderRadius: 16,
        border: `1px solid ${TRAINING_ORANGE}40`,
        padding: "28px 32px", maxWidth: 560, width: "92%",
        maxHeight: "80vh", overflowY: "auto",
        boxShadow: `0 0 40px ${TRAINING_ORANGE}20`,
      }}>
        <h2 style={{ margin: "0 0 4px", color: TRAINING_ORANGE, fontFamily: "'Montserrat', sans-serif", fontSize: 18 }}>
          Choose a Practice Scenario
        </h2>
        <p style={{ margin: "0 0 16px", color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "'Lora', serif" }}>
          Hi {testerName}! Pick a scenario to practice, or start a free session.
        </p>

        <button
          data-testid="scenario-free"
          onClick={() => pick(null)}
          style={{
            width: "100%", padding: "12px 16px", marginBottom: 8,
            borderRadius: 10, border: `1px solid rgba(255,255,255,0.1)`,
            background: "rgba(255,255,255,0.04)", color: "#fff",
            textAlign: "left", cursor: "pointer", fontFamily: "'Lora', serif",
          }}
        >
          <strong style={{ color: TRAINING_ORANGE, fontFamily: "'Montserrat', sans-serif", fontSize: 14 }}>
            Free Practice
          </strong>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            No scenario — practice with any lead or topic
          </div>
        </button>

        {TRAINING_SCENARIOS.map((s) => (
          <button
            key={s.id}
            data-testid={`scenario-${s.id}`}
            onClick={() => pick(s)}
            style={{
              width: "100%", padding: "12px 16px", marginBottom: 8,
              borderRadius: 10,
              border: `1px solid ${selected === s.id ? TRAINING_ORANGE : "rgba(255,255,255,0.1)"}`,
              background: selected === s.id ? `${TRAINING_ORANGE}15` : "rgba(255,255,255,0.04)",
              color: "#fff", textAlign: "left", cursor: "pointer",
              fontFamily: "'Lora', serif",
            }}
          >
            <strong style={{ color: TRAINING_ORANGE, fontFamily: "'Montserrat', sans-serif", fontSize: 14 }}>
              {s.name}
            </strong>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              {s.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
