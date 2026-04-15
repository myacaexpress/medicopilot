/**
 * Barrel export for the extracted mock-data modules (P0 foundation).
 *
 * Import patterns:
 *   import { MOCK_LEADS, RECENT_LEADS } from "./data";
 *   import { aiResponses } from "./data";
 *   import { MockPlanProvider } from "./data";
 *
 * When P1/P2 replace these with live data, update this file to
 * re-export from the new source (context providers, API clients)
 * so component imports don't need to change.
 */

export { MOCK_LEADS, RECENT_LEADS } from "./leads.js";
export { transcriptLines } from "./transcript.js";
export { aiResponses } from "./aiResponses.js";
export { DEFAULT_PECL_ITEMS } from "./pecl.js";
export { MockPlanProvider, PLAN_SEED } from "./plans/index.js";
export { RECORDING_CONSENT, consentPolicy } from "./compliance/states.js";
