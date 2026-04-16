/**
 * PECL (Pre-Enrollment Checklist) keyword matcher. Decides which CMS-
 * required disclosure items a given utterance covers — the result feeds
 * both the suggestion-trigger pipeline and the auto-tick UI in
 * ComplianceHub.
 *
 * Items mirror src/data/pecl.js exactly. Each item carries a regex
 * (case-insensitive) plus a list of phrase tokens that humans actually
 * say on real calls — derived from the agent-script samples in
 * plans/PRD.md and the demo transcript at src/data/transcript.js.
 *
 * @typedef {"tpmo"|"lis"|"msp"|"medigap"|"soa"} PeclItemId
 *
 * @typedef {Object} PeclMatch
 * @property {PeclItemId} id
 * @property {string}     label
 */

const ITEMS = [
  {
    id: "tpmo",
    label: "TPMO Disclaimer",
    re: /(third[-\s]?party\s+marketing|TPMO|we do not offer every plan|don'?t offer every plan|please contact medicare\.gov)/i,
  },
  {
    id: "lis",
    label: "Low-Income Subsidy",
    re: /(low[-\s]?income\s+subsidy|extra\s+help|LIS\b|help\s+with\s+(?:drug|prescription)\s+costs)/i,
  },
  {
    id: "msp",
    label: "Medicare Savings",
    re: /(medicare\s+savings\s+programs?|MSP\b|state\s+(?:assistance|subsidy|program)|help\s+with\s+(?:your\s+)?part\s*B\s+premium)/i,
  },
  {
    id: "medigap",
    label: "Medigap Rights",
    re: /(medigap|medicare\s+supplement|gap\s+insurance|guaranteed[-\s]?issue)/i,
  },
  {
    id: "soa",
    label: "Scope of Appointment",
    re: /(scope\s+of\s+appointment|SOA\b|recorded\s+permission|recording\s+this\s+call)/i,
  },
];

/**
 * Return all PECL item ids the utterance covers (may be empty).
 * @param {string} text
 * @returns {PeclMatch[]}
 */
export function matchPECL(text) {
  const t = String(text || "");
  if (!t) return [];
  const hits = [];
  for (const item of ITEMS) {
    if (item.re.test(t)) hits.push({ id: item.id, label: item.label });
  }
  return hits;
}

/** Exposed for tests / docs. */
export const PECL_ITEM_DEFS = ITEMS.map(({ id, label }) => ({ id, label }));
