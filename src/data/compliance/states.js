/**
 * US states with two-party (all-party) consent for call recording.
 *
 * When an agent's lead is in one of these states, the recording-consent
 * banner copy escalates ("All parties on this call must consent to
 * being recorded. Do you consent?") vs. the one-party default
 * ("This call may be recorded for quality assurance.").
 *
 * Source: commonly cited state statutes as of 2026 — worth a legal
 * review before external tenants onboard at P5.
 *
 * @typedef {Object} ConsentStateRule
 * @property {"one-party"|"two-party"|"mixed"} consent
 * @property {string} [note]  Additional nuance for edge cases
 */

/** @type {Record<string, ConsentStateRule>} */
export const RECORDING_CONSENT = {
  CA: { consent: "two-party" },
  CT: { consent: "two-party", note: "Civil two-party; criminal one-party" },
  DE: { consent: "two-party" },
  FL: { consent: "two-party" },
  IL: { consent: "two-party" },
  MD: { consent: "two-party" },
  MA: { consent: "two-party" },
  MI: { consent: "two-party", note: "Participant one-party; non-participant two-party" },
  MT: { consent: "two-party" },
  NV: { consent: "two-party", note: "State courts split; treat as two-party" },
  NH: { consent: "two-party" },
  OR: { consent: "mixed", note: "In-person two-party; electronic one-party" },
  PA: { consent: "two-party" },
  WA: { consent: "two-party" },
};

/**
 * Returns "two-party" if the state requires all-party consent,
 * otherwise "one-party". Unknown states default to "two-party" (safer).
 * @param {string} stateCode 2-letter USPS state code
 * @returns {"one-party"|"two-party"}
 */
export function consentPolicy(stateCode) {
  const rule = RECORDING_CONSENT[stateCode?.toUpperCase()];
  if (!rule) return "two-party";
  return rule.consent === "one-party" ? "one-party" : "two-party";
}
