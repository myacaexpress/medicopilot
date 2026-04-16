/**
 * Helpers for the inline MSP header badge on the desktop expanded view.
 *
 * Behavior (per ui-final-spec §A2 and PRD § PECL escalation):
 *   - Hidden once MSP is covered — there is nothing left for the agent to act on.
 *   - "info" tone for the first 10 minutes of the call. The badge is
 *     present but quiet (default amber-tinted "MSP" pill).
 *   - "amber" (escalated) once 10 minutes have elapsed without MSP being
 *     covered — still amber but pulses to draw the agent's eye.
 *
 * The 10-minute threshold matches CMS guidance that the MSP/Medigap
 * disclosures should be raised before the meaningful plan-recommendation
 * phase of the call, and most agent flows reach that point well within
 * the first ten minutes.
 */

export const MSP_AMBER_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * @typedef {"hidden"|"info"|"amber"} MspBadgeMode
 *
 * @param {Object} opts
 * @param {number} opts.elapsedMs       Milliseconds since the call started
 * @param {boolean} opts.mspCovered     Whether the MSP PECL row is currently done
 * @param {number} [opts.thresholdMs]   Override (defaults to 10 minutes)
 * @returns {MspBadgeMode}
 */
export function mspBadgeMode({ elapsedMs, mspCovered, thresholdMs = MSP_AMBER_THRESHOLD_MS }) {
  if (mspCovered) return "hidden";
  if (elapsedMs >= thresholdMs) return "amber";
  return "info";
}
