/**
 * Mock lead data for the v1 demo.
 *
 * These shapes mirror the demo UI's expectations, NOT the canonical
 * `LeadContext` model in plans/PRD.md § Data models. When P1 lands
 * real OCR extraction, this file is replaced by:
 *   1. A backend-driven `LeadContext` produced by the vision edge fn
 *   2. A local fallback for offline / first-session states
 *
 * Keep the field keys ("Name", "DOB", etc.) consistent with the
 * existing rendering in MediCopilot_macOS_Mockup.jsx until the
 * migration to `LeadContext` is complete.
 *
 * @typedef {Object} MockLeadField
 * @property {string}  k       Field label shown in the UI
 * @property {string}  v       Field value
 * @property {"verified"|"high"|"medium"|"low"} pill  Confidence pill
 * @property {boolean} [wide]  Spans full row when true
 *
 * @typedef {Object} MockLead
 * @property {string} id
 * @property {string} source          Where the lead came from
 * @property {MockLeadField[]} fields
 *
 * @typedef {Object} RecentLeadSummary
 * @property {string} id
 * @property {string} name
 * @property {string} sub   Secondary line (phone · zip · coverage)
 * @property {string} tag   Status chip text
 */

/** @type {Record<string, MockLead>} */
export const MOCK_LEADS = {
  maria: {
    id: "maria",
    source: "Five9 screen-pop",
    fields: [
      { k: "Name", v: "Maria Garcia", pill: "high" },
      { k: "DOB", v: "Mar 15, 1952", pill: "verified" },
      { k: "Phone", v: "(954) 555-0142", pill: "high" },
      { k: "Address · ZIP", v: "Pembroke Pines, FL 33024", pill: "verified", wide: true },
      { k: "Coverage", v: "Original Medicare + PDP", pill: "high" },
    ],
  },
  roberto: {
    id: "roberto",
    source: "CRM · Spouse record",
    fields: [
      { k: "Name", v: "Roberto Garcia", pill: "verified" },
      { k: "DOB", v: "Aug 02, 1950", pill: "verified" },
      { k: "Phone", v: "(954) 555-0142", pill: "medium" },
      { k: "Address · ZIP", v: "Pembroke Pines, FL 33024", pill: "verified", wide: true },
      { k: "Coverage", v: "MA-PD (Humana H1036-206)", pill: "verified" },
    ],
  },
  linda: {
    id: "linda",
    source: "CRM · Prior callback",
    fields: [
      { k: "Name", v: "Linda Nguyen", pill: "verified" },
      { k: "DOB", v: "Nov 22, 1948", pill: "verified" },
      { k: "Phone", v: "(305) 555-0188", pill: "high" },
      { k: "Address · ZIP", v: "Miami, FL 33176", pill: "verified", wide: true },
      { k: "Coverage", v: "Turning 65 · no coverage yet", pill: "medium" },
    ],
  },
};

/** @type {RecentLeadSummary[]} */
export const RECENT_LEADS = [
  { id: "maria", name: "Maria Garcia", sub: "(954) 555-0142 · 33024 · Original+PDP", tag: "Active · Five9" },
  { id: "roberto", name: "Roberto Garcia", sub: "(954) 555-0142 · 33024 · MA-PD Humana", tag: "Spouse on line" },
  { id: "linda", name: "Linda Nguyen", sub: "(305) 555-0188 · 33176 · T65, no coverage", tag: "Callback · 3d ago" },
];
