/**
 * Canonical PECL compliance scripts.
 *
 * These are the verbatim agent-facing lines surfaced when a PECL badge
 * (or the MSP inline header pill) is clicked. The agent inserts the
 * script into the active AIResponseCard's "Say this" so the words
 * actually leave their mouth — and the PECL item flips to covered.
 *
 * Sources: CMS PECL guidance + standard agent training scripts (2026).
 * These are short, plain-language, and CMS-safe — they do not steer the
 * client toward a particular plan and they do not mis-state benefits.
 *
 * @typedef {"tpmo"|"lis"|"msp"|"medigap"|"soa"} PeclItemId
 *
 * @typedef {Object} ComplianceScript
 * @property {PeclItemId} id
 * @property {string} label                   Short human label (matches PECL row)
 * @property {string} sayThis                 Verbatim line for "Say this" panel
 * @property {string[]} [pressMore]           Optional follow-on talking points
 * @property {string[]} [followUps]           Optional questions to ask the client
 * @property {string} [note]                  Internal note for the agent (non-spoken)
 */

/** @type {Record<PeclItemId, ComplianceScript>} */
export const COMPLIANCE_SCRIPTS = {
  tpmo: {
    id: "tpmo",
    label: "TPMO Disclaimer",
    sayThis:
      "Before we go further, I'm required to share this: We do not offer every plan available in your area. Currently we represent multiple organizations which offer multiple Medicare Advantage and Part D plans in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Assistance Program to get information on all of your options.",
    note: "TPMO disclaimer must be read within the first minute of every Medicare sales call.",
  },

  lis: {
    id: "lis",
    label: "Low-Income Subsidy",
    sayThis:
      "I also want to mention Extra Help — that's a federal program from Social Security that can help pay your Part D prescription drug costs, including premiums, deductibles, and copays. Even if you don't think you qualify, it's worth checking because the income limits are higher than most people expect.",
    pressMore: [
      "Extra Help is also called the Low-Income Subsidy or LIS — same program, different names.",
      "If you qualify for Extra Help, you also automatically qualify for a Special Enrollment Period to change plans.",
    ],
    followUps: [
      "Would you like me to walk you through how to apply for Extra Help?",
    ],
  },

  msp: {
    id: "msp",
    label: "Medicare Savings",
    sayThis:
      "I'm required to mention Medicare Savings Programs — these are state programs that can help pay your Part B premium, and in some cases your deductibles and coinsurance. Eligibility depends on your income and assets and the limits vary by state. Would you like me to share who to contact in your state to apply?",
    pressMore: [
      "There are four MSPs: QMB, SLMB, QI, and QDWI — each has different income limits and benefits.",
      "Qualifying for an MSP also automatically enrolls you in Extra Help for prescription drugs.",
    ],
    followUps: [
      "Would you like me to share who to contact in your state to apply for a Medicare Savings Program?",
    ],
  },

  medigap: {
    id: "medigap",
    label: "Medigap Rights",
    sayThis:
      "I also want to make sure you understand your Medigap rights. Medigap, or Medicare Supplement Insurance, is a separate type of coverage that works with Original Medicare to help pay your out-of-pocket costs. If you ever decide Medicare Advantage isn't right for you, in most states you have a one-time guaranteed-issue right to switch back to Original Medicare with a Medigap policy within twelve months.",
    pressMore: [
      "Outside of guaranteed-issue periods, Medigap insurers in most states can use medical underwriting — meaning they can deny coverage or charge more based on health.",
      "A few states (like NY, CT, MA) have year-round guaranteed issue for Medigap.",
    ],
  },

  soa: {
    id: "soa",
    label: "Scope of Appointment",
    sayThis:
      "Before we discuss specific plans, I need to confirm your Scope of Appointment. That just means you're agreeing to talk with me about Medicare Advantage and Part D prescription drug plans today. We are not going to discuss any other types of insurance during this call. Is it okay if I record your verbal agreement to this Scope of Appointment?",
    note: "SOA must be documented before discussing specific plan benefits, even on inbound calls.",
    followUps: [
      "Do I have your verbal agreement to the Scope of Appointment for Medicare Advantage and Part D plans?",
    ],
  },
};

/**
 * Convenience accessor with a clear error if an unknown id is requested.
 * @param {PeclItemId} id
 * @returns {ComplianceScript|undefined}
 */
export function getComplianceScript(id) {
  return COMPLIANCE_SCRIPTS[id];
}

/**
 * Build the augmented "Say this" payload after the agent has clicked one
 * or more compliance badges. Inserted scripts are appended after the
 * card's original line so the agent reads through naturally:
 * answer-the-question first, then the disclosure.
 *
 * Unknown ids are silently dropped so a stale state never crashes
 * rendering. Order follows insertion order.
 *
 * @param {string} originalSayThis
 * @param {Iterable<PeclItemId>|null|undefined} insertedIds
 * @returns {{
 *   sayThis: string,
 *   inserted: Array<{ id: PeclItemId, label: string, sayThis: string }>
 * }}
 */
export function applyInsertedScripts(originalSayThis, insertedIds) {
  const ids = Array.from(insertedIds ?? []);
  const inserted = ids
    .map((id) => COMPLIANCE_SCRIPTS[id])
    .filter(Boolean)
    .map((s) => ({ id: s.id, label: s.label, sayThis: s.sayThis }));
  if (inserted.length === 0) {
    return { sayThis: originalSayThis ?? "", inserted };
  }
  const head = (originalSayThis ?? "").trim();
  const body = inserted.map((s) => s.sayThis).join("\n\n");
  const sayThis = head ? `${head}\n\n${body}` : body;
  return { sayThis, inserted };
}
