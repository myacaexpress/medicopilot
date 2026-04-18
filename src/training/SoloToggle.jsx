/**
 * Solo practice "Who's speaking?" toggle — replaces PTT hold-to-talk
 * when training mode is ON.
 *
 * Two big buttons: Agent / Client. Click to switch.
 * Spacebar also toggles (no hold — just press).
 */

import { useEffect, useCallback } from "react";
import { Mic, User } from "lucide-react";
import { useTraining } from "./TrainingContext.jsx";

const TRAINING_ORANGE = "#FF8A3D";

export function SoloToggle({ onRoleChange }) {
  const { speakerRole, toggleSpeakerRole } = useTraining();

  const handleToggle = useCallback(() => {
    toggleSpeakerRole();
  }, [toggleSpeakerRole]);

  // Notify parent when role changes
  useEffect(() => {
    onRoleChange?.(speakerRole);
  }, [speakerRole, onRoleChange]);

  // Spacebar shortcut
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Space") return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      e.preventDefault();
      handleToggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleToggle]);

  const isAgent = speakerRole === "agent";

  return (
    <div data-testid="solo-toggle" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
        color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat', sans-serif",
      }}>
        Who's speaking?
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          data-testid="solo-role-agent"
          onClick={() => { if (!isAgent) handleToggle(); }}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 12px", borderRadius: 10,
            border: isAgent ? `2px solid ${TRAINING_ORANGE}` : "2px solid rgba(255,255,255,0.1)",
            background: isAgent ? `${TRAINING_ORANGE}25` : "rgba(255,255,255,0.04)",
            color: isAgent ? TRAINING_ORANGE : "rgba(255,255,255,0.4)",
            cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
            fontSize: 13, fontWeight: 700, transition: "all 0.15s ease",
            boxShadow: isAgent ? `0 0 12px ${TRAINING_ORANGE}30` : "none",
          }}
        >
          <Mic size={16} /> Agent
        </button>
        <button
          data-testid="solo-role-client"
          onClick={() => { if (isAgent) handleToggle(); }}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 12px", borderRadius: 10,
            border: !isAgent ? `2px solid ${TRAINING_ORANGE}` : "2px solid rgba(255,255,255,0.1)",
            background: !isAgent ? `${TRAINING_ORANGE}25` : "rgba(255,255,255,0.04)",
            color: !isAgent ? TRAINING_ORANGE : "rgba(255,255,255,0.4)",
            cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
            fontSize: 13, fontWeight: 700, transition: "all 0.15s ease",
            boxShadow: !isAgent ? `0 0 12px ${TRAINING_ORANGE}30` : "none",
          }}
        >
          <User size={16} /> Client
        </button>
      </div>
      <div data-testid="solo-toggle-hint" style={{
        fontSize: 10, color: "rgba(255,255,255,0.3)",
        fontFamily: "'JetBrains Mono', monospace", textAlign: "center",
      }}>
        Press Space to switch
      </div>
    </div>
  );
}
