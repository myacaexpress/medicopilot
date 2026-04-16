/**
 * useConsentBanner — determines whether to show the recording consent
 * banner based on lead state code and sessionStorage gate.
 *
 * Per ui-final-spec.md § 6:
 * - First-capture banner shows once per session (sessionStorage gate)
 * - Two-party-consent states get amber + stronger copy
 * - Dismissible via ×, stored in sessionStorage
 */
import { useState, useCallback } from "react";
import { consentPolicy } from "../data/compliance/states.js";

const DISMISSED_KEY = "medicopilot_consent_banner_dismissed";

/**
 * @param {{ leadStateCode?: string }} opts
 * @returns {{
 *   shouldShowBanner: boolean,
 *   isTwoParty: boolean,
 *   dismiss: () => void,
 * }}
 */
export function useConsentBanner({ leadStateCode } = {}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const policy = consentPolicy(leadStateCode);
  const isTwoParty = policy === "two-party";

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  return {
    shouldShowBanner: !dismissed,
    isTwoParty,
    dismiss,
  };
}
