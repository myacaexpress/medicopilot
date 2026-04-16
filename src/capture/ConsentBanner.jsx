/**
 * ConsentBanner — full-width strip below header per ui-final-spec.md § 6.
 *
 * Teal-tinted glass when one-party, amber when two-party consent state.
 * Dismissible via ×, state managed by useConsentBanner hook.
 */
import { X } from "lucide-react";

const T = {
  display: "'Montserrat', sans-serif",
  mono: "'JetBrains Mono', monospace",
  teal: "#007B7F",
};

/**
 * @param {{ isTwoParty: boolean, onDismiss: () => void }} props
 */
export function ConsentBanner({ isTwoParty, onDismiss }) {
  const bgColor = isTwoParty
    ? "rgba(245,166,35,0.12)"
    : "rgba(0,123,127,0.1)";
  const borderColor = isTwoParty
    ? "rgba(245,166,35,0.3)"
    : "rgba(0,123,127,0.25)";
  const textColor = isTwoParty
    ? "#F5A623"
    : "rgba(255,255,255,0.7)";

  const copy = isTwoParty
    ? "This lead is in a two-party consent state. All parties on this call must consent to being recorded before proceeding."
    : "MediCopilot is listening for agent suggestions. Remember to disclose recording per state requirements.";

  return (
    <div style={{
      width: "100%",
      padding: "8px 12px",
      background: bgColor,
      borderBottom: `1px solid ${borderColor}`,
      display: "flex",
      alignItems: "center",
      gap: 8,
      minHeight: 36,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: isTwoParty ? "#F5A623" : T.teal,
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: T.display,
        fontSize: 10,
        fontWeight: 600,
        color: textColor,
        flex: 1,
        lineHeight: 1.4,
      }}>
        {copy}
      </span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss consent banner"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 2,
          flexShrink: 0,
        }}
      >
        <X size={12} color="rgba(255,255,255,0.4)" />
      </button>
    </div>
  );
}
