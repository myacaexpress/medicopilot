/**
 * Plan Data Provider — MVP mock implementation.
 *
 * A thin abstraction the suggestion engine will call in P2 to look up
 * Medicare plans, drug coverage, and provider networks. MVP returns
 * from the hand-curated `seed.json`; a `CmsPlanProvider` swaps in at P2
 * to hit CMS Marketplace API + carrier machine-readable provider
 * directory JSONs (CY 2026 mandate). See plans/PRD.md § Phase 2.
 *
 * The interface is stable across implementations — the suggestion
 * engine should never reach past it to read raw JSON.
 *
 * @typedef {"MA"|"MAPD"|"MAPD-DSNP"|"PDP"|"MEDIGAP"|"ANCILLARY"} PlanType
 *
 * @typedef {Object} DrugCoverage
 * @property {string}  rxcui
 * @property {string}  name
 * @property {number}  tier
 * @property {number}  copay30
 * @property {boolean} priorAuth
 *
 * @typedef {Object} PlanSummary
 * @property {string}   id
 * @property {string}   carrier
 * @property {string}   name
 * @property {string}   contractPlan
 * @property {PlanType} type
 * @property {number}   premiumMonthly
 * @property {number}   [stars]
 * @property {Object}   [benefits]
 * @property {Object}   [formulary]
 *
 * @typedef {Object} PlanProvider
 * @property {(args: { zip: string, coverage?: PlanType, carriers?: string[] }) => Promise<PlanSummary[]>} lookupPlans
 * @property {(args: { planId: string, rxcui: string[] }) => Promise<DrugCoverage[]>}                      checkDrugCoverage
 * @property {(args: { planId: string, npi: string }) => Promise<{inNetwork: boolean, tier?: string}>}     checkProviderInNetwork
 * @property {(query: string) => Promise<{rxcui: string, name: string}[]>}                                 autocompleteDrug
 */

import seed from "./seed.json";

const zipToState = (zip) => {
  if (!zip || typeof zip !== "string") return null;
  // Crude state detection for MVP — real implementation needs USPS/CMS ZIP->state mapping
  const prefix = zip.slice(0, 3);
  if (["320","321","322","323","324","325","326","327","328","329","330","331","332","333","334","335","336","337","338","339","346","347","349"].includes(prefix)) return "FL";
  if (["750","751","752","753","754","755","756","757","758","759","760","761","762","763","764","765","766","767","768","769","770","771","772","773","774","775","776","777","778","779","780","781","782","783","784","785","786","787","788","789","790","791","792","793","794","795","796","797","798","799","885"].includes(prefix)) return "TX";
  if (["900","901","902","903","904","905","906","907","908","910","911","912","913","914","915","916","917","918","919","920","921","922","923","924","925","926","927","928","930","931","932","933","934","935","936","937","938","939","940","941","942","943","944","945","946","947","948","949","950","951","952","953","954","955","956","957","958","959","960","961"].includes(prefix)) return "CA";
  return null;
};

const allPlans = () => Object.entries(seed.states).flatMap(
  ([state, entry]) => entry.plans.map((p) => ({ ...p, _state: state }))
);

/** @type {PlanProvider} */
export const MockPlanProvider = {
  async lookupPlans({ zip, coverage, carriers }) {
    const state = zipToState(zip);
    let pool = state && seed.states[state] ? seed.states[state].plans : allPlans();
    if (coverage) pool = pool.filter((p) => p.type === coverage);
    if (carriers?.length) pool = pool.filter((p) => carriers.includes(p.carrier));
    return pool;
  },

  async checkDrugCoverage({ planId, rxcui }) {
    const plan = allPlans().find((p) => p.id === planId);
    if (!plan?.formulary?.drugs) return [];
    return plan.formulary.drugs.filter((d) => rxcui.includes(d.rxcui));
  },

  async checkProviderInNetwork({ planId, npi }) {
    const plan = allPlans().find((p) => p.id === planId);
    const match = plan?.networkSampleProviders?.find((pr) => pr.npi === npi);
    return match
      ? { inNetwork: true, tier: match.inNetworkTier }
      : { inNetwork: false };
  },

  async autocompleteDrug(query) {
    const q = query.toLowerCase();
    const seen = new Set();
    const hits = [];
    for (const plan of allPlans()) {
      for (const d of plan.formulary?.drugs || []) {
        if (seen.has(d.rxcui)) continue;
        if (d.name.toLowerCase().includes(q)) {
          seen.add(d.rxcui);
          hits.push({ rxcui: d.rxcui, name: d.name });
        }
      }
    }
    return hits;
  },
};

export { seed as PLAN_SEED };
