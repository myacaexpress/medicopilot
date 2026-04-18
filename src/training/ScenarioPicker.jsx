import { useState, useEffect } from "react";
import { fetchScenarios } from "./api.js";
import { useTraining } from "./TrainingContext.jsx";

const THEME = { primary: "#FF8A3D", dark: "#CC6B2E", light: "#FFB077" };

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"];
const DIFFICULTY_COLORS = {
  beginner: "#34C77B",
  intermediate: "#FFB077",
  advanced: "#F47C6E",
};
const DIFFICULTY_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function DifficultyBadge({ difficulty }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6,
      fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat', sans-serif",
      letterSpacing: "0.04em",
      background: `${DIFFICULTY_COLORS[difficulty]}22`,
      color: DIFFICULTY_COLORS[difficulty],
      border: `1px solid ${DIFFICULTY_COLORS[difficulty]}44`,
    }}>
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

function ScenarioCard({ scenario, onSelect }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => onSelect(scenario)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: "left", width: "100%", padding: 16, borderRadius: 12,
        border: `1px solid ${hover ? THEME.primary : "rgba(255,255,255,0.08)"}`,
        background: hover ? "rgba(255,138,61,0.08)" : "rgba(255,255,255,0.03)",
        cursor: "pointer", transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <DifficultyBadge difficulty={scenario.difficulty} />
        <span style={{
          fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 700,
          color: "#fff",
        }}>
          {scenario.persona_name}
        </span>
        {scenario.persona_age && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {scenario.persona_age}yo
          </span>
        )}
      </div>
      <div style={{
        fontFamily: "'Lora', serif", fontSize: 12, color: "rgba(255,255,255,0.6)",
        lineHeight: 1.5, marginBottom: 8,
      }}>
        {scenario.situation}
      </div>
      {scenario.opening_lines?.[0] && (
        <div style={{
          fontFamily: "'Lora', serif", fontSize: 11, color: THEME.light,
          fontStyle: "italic", padding: "6px 10px", borderRadius: 6,
          background: "rgba(255,138,61,0.06)", border: "1px solid rgba(255,138,61,0.1)",
        }}>
          "{scenario.opening_lines[0]}"
        </div>
      )}
      {scenario.medications?.length > 0 && (
        <div style={{
          marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: "rgba(255,255,255,0.4)",
        }}>
          Meds: {scenario.medications.join(", ")}
        </div>
      )}
    </button>
  );
}

export function ScenarioPicker({ onSelect }) {
  const { testerName } = useTraining();
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = DIFFICULTY_ORDER.map((d) => ({
    difficulty: d,
    items: scenarios.filter((s) => s.difficulty === d),
  })).filter((g) => g.items.length > 0);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "auto",
    }}>
      <div style={{
        background: "#1a1a2e", border: `1px solid ${THEME.primary}`,
        borderRadius: 16, padding: 32, width: 640, maxWidth: "95vw",
        maxHeight: "85vh", overflow: "auto",
        boxShadow: `0 0 40px rgba(255,138,61,0.2)`,
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            fontSize: 24, fontWeight: 800, fontFamily: "'Montserrat', sans-serif",
            background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.light})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 4,
          }}>
            Choose a Scenario
          </div>
          <div style={{
            fontFamily: "'Lora', serif", fontSize: 13, color: "rgba(255,255,255,0.5)",
          }}>
            Hi {testerName} — pick a persona to practice with
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", padding: 40, fontFamily: "'Lora', serif" }}>
            Loading scenarios...
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", color: "#F47C6E", padding: 40, fontFamily: "'Lora', serif" }}>
            Failed to load scenarios: {error}
          </div>
        )}

        {grouped.map(({ difficulty, items }) => (
          <div key={difficulty} style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700,
              color: DIFFICULTY_COLORS[difficulty], letterSpacing: "0.06em",
              marginBottom: 10, textTransform: "uppercase",
            }}>
              {DIFFICULTY_LABELS[difficulty]} ({items.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((s) => (
                <ScenarioCard key={s.id} scenario={s} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
