/**
 * Seeded AI response cards keyed to detected questions in the transcript.
 *
 * This is the mock-data stand-in for the P2 suggestion engine. When P2
 * ships, the `PlanProvider` interface (src/data/plans/) + Claude Sonnet
 * streaming replace these canned responses. Keep the shape stable so
 * the `AIResponseCard` component doesn't change.
 *
 * @typedef {Object} PlanSummary
 * @property {string} name
 * @property {string} [copay]
 * @property {string} [tier]
 * @property {string} [pa]     "Yes" | "No"
 * @property {string} [stars]
 *
 * @typedef {Object} AIResponseCard
 * @property {string}   trigger                   Sub-string that fires this card
 * @property {{screen: string, audio: string}} context
 * @property {string}   [response]                Legacy mobile short copy
 * @property {string}   [detail]                  Legacy mobile detail copy
 * @property {string}   [trifecta]                Legacy mobile side-note
 * @property {string}   [compliance]              Compliance reminder
 * @property {string}   [script]                  Verbatim script for agent
 * @property {string}   sayThis                   Desktop Cluely-style primary copy
 * @property {string[]} [pressMore]               Follow-on talking points
 * @property {string[]} [followUps]               Questions to ask the client
 * @property {PlanSummary[]} [plans]              Optional plan comparison cards
 */

/** @type {AIResponseCard[]} */
export const aiResponses = [
  {
    trigger: "what plans would cover my Eliquis",
    context: { screen: "Five9: Maria Garcia, ZIP 33024, Original Medicare + PDP", audio: "Client asking about Eliquis coverage in Pembroke Pines" },
    response: "3 plans cover Eliquis in ZIP 33024:",
    plans: [
      { name: "Humana Preferred Rx Plan", copay: "$47/mo", tier: "T3", pa: "No", stars: "★★★★" },
      { name: "Aetna CVS Health Rx Saver", copay: "$42/mo", tier: "T3", pa: "No", stars: "★★★½" },
      { name: "WellCare Value Script", copay: "$89/mo", tier: "T4", pa: "Yes", stars: "★★★" },
    ],
    compliance: "Present all options. Do not describe any plan as \"the best\" — let Mrs. Garcia decide based on her needs.",
    sayThis: "Mrs. Garcia, I've pulled up Medicare prescription plans in the 33024 ZIP that cover Eliquis. The strongest option right now is the Humana Preferred Rx Plan — Eliquis is on Tier 3 at $47 a month, no prior authorization required, and it's rated 4 stars. I can walk you through two other options as well so you can compare.",
    pressMore: [
      "Aetna CVS Health Rx Saver also covers Eliquis at Tier 3 — $42 a month, no prior auth required. A bit lower monthly cost.",
      "WellCare Value Script covers it at Tier 4 for $89 a month — prior authorization is required, so a bit more friction when filling.",
    ],
    followUps: [
      "Which monthly copay range works best for your budget?",
      "Are there other prescriptions you'd like me to check coverage on while I have you?",
    ],
  },
  {
    trigger: "Dr. Patel at Baptist Health",
    context: { screen: "Five9: Maria Garcia, Humana S5884-065 under discussion", audio: "Client asking about provider network — Dr. Patel, Baptist Health" },
    response: "✅ Dr. Raj Patel, MD — Baptist Health South Florida",
    detail: "In-Network confirmed for Humana Preferred Rx Plan (S5884-065). Internal Medicine.",
    compliance: "Before enrollment: you still need to cover Medicare Savings Programs (PECL requirement).",
    script: "\"Mrs. Garcia, I'm required to mention Medicare Savings Programs — state programs that can help with your Part B premium. Would you like me to check if you might qualify?\"",
    sayThis: "Good news — Dr. Raj Patel at Baptist Health South Florida is in-network for the Humana Preferred Rx Plan we've been discussing. He's listed under Internal Medicine, so your primary care relationship stays intact. Before we go further, I do need to mention a couple of Medicare Savings Programs as part of my required disclosures.",
    pressMore: [
      "Medicare Savings Programs are state-run programs that can help cover your Part B premium — eligibility is based on income and assets.",
      "This is a PECL compliance requirement, so I want to make sure we cover it properly before moving to enrollment.",
    ],
    followUps: [
      "Would you like me to check if you might qualify for a Medicare Savings Program?",
      "Any other providers or specialists you'd like me to verify before we finalize?",
    ],
  },
  {
    trigger: "what about dental",
    context: { screen: "Five9: Maria Garcia, discussing MAPD plans", audio: "Client asking about dental coverage — current Medicare doesn't cover" },
    response: "Great question. Several MAPD plans in 33024 include dental benefits:",
    detail: "Humana Gold Plus (H1036-200) includes preventive and comprehensive dental. Aetna Medicare Eagle (H3312-067) includes preventive dental with $2,000 annual max.",
    trifecta: "This is the ancillary conversation — a natural bridge to the trifecta. If she needs dental + vision + hearing, an ancillary package alongside her MAPD strengthens retention.",
    compliance: "Only present dental benefits that are part of the MA plan or a separate ancillary product you're appointed to sell.",
    sayThis: "You're right that Original Medicare doesn't cover dental — but several Medicare Advantage plans in your ZIP do. The Humana Gold Plus plan includes both preventive and comprehensive dental care. The Aetna Medicare Eagle covers preventive dental with a $2,000 annual maximum. If you're thinking about major work like crowns or extractions, the Humana plan would give you more coverage.",
    pressMore: [
      "If dental is a real priority, we can also look at pairing a Medicare Advantage plan with a standalone ancillary dental policy — that can significantly raise your annual maximum.",
      "Some plans bundle dental with vision and hearing coverage, which tends to be a strong value for clients in this age range.",
    ],
    followUps: [
      "Have you had any major dental work planned recently — crowns, implants, or anything like that?",
      "Would you like me to put a couple of MAPD plans with dental side by side so you can compare the benefits?",
    ],
  },
];
