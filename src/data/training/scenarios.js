/**
 * Pre-built practice scenarios for solo training mode.
 *
 * Each scenario defines a client persona the tester plays when toggled
 * to "Client", plus a pre-populated lead context for the panel.
 */

/** @type {Array<{
 *   id: string,
 *   name: string,
 *   description: string,
 *   clientPersona: string,
 *   leadContext: object,
 *   successCriteria: string,
 * }>} */
export const TRAINING_SCENARIOS = [
  {
    id: "eliquis-cost",
    name: "Concerned about drug costs",
    description: "Client on Original Medicare with a PDP is worried about rising Eliquis costs and wants to explore better plan options.",
    clientPersona: "You are Maria Garcia, 74, in Pembroke Pines FL on Original Medicare with a standalone PDP. You're worried about your Eliquis copay going from $47 to $95 next year. Your doctor is Dr. Patel at Baptist Health South Florida. You want to know if there's a better plan option — maybe an MAPD that covers your meds cheaper. You're not tech-savvy and need things explained simply.",
    leadContext: {
      id: "training_eliquis",
      source: "manual",
      fields: {
        firstName: { v: "Maria", confidence: "verified", source: "manual" },
        lastName: { v: "Garcia", confidence: "verified", source: "manual" },
        dob: { v: "1952-03-15", confidence: "medium", source: "manual" },
        phone: { v: "+15551234567", confidence: "verified", source: "manual" },
        address: { v: { city: "Pembroke Pines", state: "FL", zip: "33024" }, confidence: "medium", source: "manual" },
        coverage: { v: "OM", confidence: "medium", source: "manual" },
        medications: { v: ["Eliquis 5mg", "Lisinopril 10mg", "Metformin 500mg"], confidence: "medium", source: "manual" },
        providers: { v: ["Dr. Patel - Baptist Health"], confidence: "medium", source: "manual" },
      },
    },
    successCriteria: "Agent completes TPMO disclosure, screens for LIS/MSP eligibility, discusses PDP vs MAPD tradeoffs mentioning Eliquis formulary coverage, and completes PECL checklist.",
  },
  {
    id: "turning-65",
    name: "First-timer turning 65",
    description: "New-to-Medicare beneficiary who's overwhelmed and doesn't understand the alphabet soup of Parts A/B/C/D.",
    clientPersona: "You are Linda Thompson, 64 (turning 65 in 2 months), in Tampa FL. You've had employer insurance your whole life and you're completely lost about Medicare. You don't know the difference between Part A, B, C, or D. You take Atorvastatin and Amlodipine. Your doctor is Dr. Williams at Tampa General. You're anxious about losing your current coverage and making the wrong choice.",
    leadContext: {
      id: "training_turning65",
      source: "manual",
      fields: {
        firstName: { v: "Linda", confidence: "verified", source: "manual" },
        lastName: { v: "Thompson", confidence: "verified", source: "manual" },
        dob: { v: "1961-06-22", confidence: "medium", source: "manual" },
        phone: { v: "+15559876543", confidence: "verified", source: "manual" },
        address: { v: { city: "Tampa", state: "FL", zip: "33601" }, confidence: "medium", source: "manual" },
        coverage: { v: "UNKNOWN", confidence: "low", source: "manual" },
        medications: { v: ["Atorvastatin 20mg", "Amlodipine 5mg"], confidence: "medium", source: "manual" },
        providers: { v: ["Dr. Williams - Tampa General"], confidence: "medium", source: "manual" },
      },
    },
    successCriteria: "Agent explains Medicare basics (A/B/C/D) clearly, determines enrollment timeline, checks if providers are in-network for recommended plans, completes TPMO and SOA, screens for MSP/LIS.",
  },
  {
    id: "mapd-switch",
    name: "MAPD user considering switch",
    description: "Current Medicare Advantage member unhappy with their network who wants to explore other MAPD options during AEP.",
    clientPersona: "You are Roberto Diaz, 71, in Miami FL. You've had a Humana Gold Plus MAPD for 3 years but your cardiologist Dr. Fernandez just left the network. You're also frustrated because your Xarelto copay went up. You want to find a plan that has Dr. Fernandez in-network and better drug coverage. You're comfortable with Medicare but hate switching plans.",
    leadContext: {
      id: "training_mapd_switch",
      source: "manual",
      fields: {
        firstName: { v: "Roberto", confidence: "verified", source: "manual" },
        lastName: { v: "Diaz", confidence: "verified", source: "manual" },
        dob: { v: "1955-11-08", confidence: "medium", source: "manual" },
        phone: { v: "+15552345678", confidence: "verified", source: "manual" },
        address: { v: { city: "Miami", state: "FL", zip: "33125" }, confidence: "medium", source: "manual" },
        coverage: { v: "MAPD", confidence: "high", source: "manual" },
        medications: { v: ["Xarelto 20mg", "Metoprolol 50mg", "Losartan 100mg"], confidence: "medium", source: "manual" },
        providers: { v: ["Dr. Fernandez - Cardiology", "Dr. Lopez - Primary Care"], confidence: "medium", source: "manual" },
      },
    },
    successCriteria: "Agent validates current coverage, checks Dr. Fernandez network status in alternative plans, compares Xarelto formulary tiers, explains AEP switching rules, completes PECL including Medigap vs MA explanation.",
  },
  {
    id: "dual-eligible",
    name: "Dual-eligible beneficiary",
    description: "Client with both Medicare and Medicaid who qualifies for a D-SNP plan. Complex eligibility scenario.",
    clientPersona: "You are Maria Santos, 68, in Hialeah FL. You have both Medicare and full Medicaid. You're currently on Original Medicare with a standalone PDP. Your daughter told you about 'special plans for people with Medicaid' and you want to learn more. You take Metformin, Lisinopril, Omeprazole, and Gabapentin. You speak English but it's your second language — prefer simple, slow explanations.",
    leadContext: {
      id: "training_dual",
      source: "manual",
      fields: {
        firstName: { v: "Maria", confidence: "verified", source: "manual" },
        lastName: { v: "Santos", confidence: "verified", source: "manual" },
        dob: { v: "1958-02-14", confidence: "medium", source: "manual" },
        phone: { v: "+15553456789", confidence: "verified", source: "manual" },
        address: { v: { city: "Hialeah", state: "FL", zip: "33012" }, confidence: "medium", source: "manual" },
        coverage: { v: "DUAL", confidence: "high", source: "manual" },
        medications: { v: ["Metformin 1000mg", "Lisinopril 20mg", "Omeprazole 20mg", "Gabapentin 300mg"], confidence: "medium", source: "manual" },
        providers: { v: ["Dr. Perez - Primary Care"], confidence: "medium", source: "manual" },
      },
    },
    successCriteria: "Agent confirms dual eligibility, explains D-SNP benefits (zero premiums, extra benefits), checks provider network, verifies LIS/Extra Help status, completes full PECL with MSP screening.",
  },
  {
    id: "skeptical-shopper",
    name: "Skeptical shopper",
    description: "Client who's been burned by insurance before and thinks all plans are scams. Needs trust built before anything.",
    clientPersona: "You are James Wilson, 72, in Orlando FL. You've been on Original Medicare for 7 years and refuse to switch because 'Medicare Advantage is a scam.' Your neighbor got stuck with a huge bill after her MA plan denied a surgery. You take Amlodipine and a statin. You're calling because your Part D premium doubled and you want to complain. You're gruff but will warm up if the agent is honest and patient.",
    leadContext: {
      id: "training_skeptical",
      source: "manual",
      fields: {
        firstName: { v: "James", confidence: "verified", source: "manual" },
        lastName: { v: "Wilson", confidence: "verified", source: "manual" },
        dob: { v: "1954-09-30", confidence: "medium", source: "manual" },
        phone: { v: "+15554567890", confidence: "verified", source: "manual" },
        address: { v: { city: "Orlando", state: "FL", zip: "32801" }, confidence: "medium", source: "manual" },
        coverage: { v: "OM", confidence: "high", source: "manual" },
        medications: { v: ["Amlodipine 10mg", "Atorvastatin 40mg"], confidence: "medium", source: "manual" },
        providers: { v: ["Dr. Chen - Internal Medicine"], confidence: "medium", source: "manual" },
      },
    },
    successCriteria: "Agent acknowledges concerns without dismissing them, explains MA vs OM tradeoffs honestly including downsides, focuses on PDP options since client prefers OM, builds trust through transparency, completes PECL.",
  },
  {
    id: "msp-eligible",
    name: "MSP-eligible on fixed income",
    description: "Low-income beneficiary who likely qualifies for Medicare Savings Programs but doesn't know they exist.",
    clientPersona: "You are Dorothy Brown, 78, in Jacksonville FL. You live on Social Security ($1,100/month) and a small pension ($200/month). You're struggling to pay your Part B premium and your PDP copays. You don't know what MSP or Extra Help are. You're proud and don't like 'handouts' but you're getting desperate. You take Metoprolol, Warfarin, and Aricept (for early dementia — your daughter helps you manage meds).",
    leadContext: {
      id: "training_msp",
      source: "manual",
      fields: {
        firstName: { v: "Dorothy", confidence: "verified", source: "manual" },
        lastName: { v: "Brown", confidence: "verified", source: "manual" },
        dob: { v: "1948-04-12", confidence: "medium", source: "manual" },
        phone: { v: "+15555678901", confidence: "verified", source: "manual" },
        address: { v: { city: "Jacksonville", state: "FL", zip: "32202" }, confidence: "medium", source: "manual" },
        coverage: { v: "OM", confidence: "medium", source: "manual" },
        medications: { v: ["Metoprolol 25mg", "Warfarin 5mg", "Aricept 10mg"], confidence: "medium", source: "manual" },
        providers: { v: ["Dr. Adams - Primary Care", "Dr. Patel - Neurology"], confidence: "medium", source: "manual" },
      },
    },
    successCriteria: "Agent identifies MSP eligibility based on income, explains QMB/SLMB/QI programs sensitively, screens for LIS/Extra Help, discusses plan options that minimize out-of-pocket, completes full PECL.",
  },
  {
    id: "spouse-helping",
    name: "Spouse calling on behalf",
    description: "Wife calling to help her husband who had a stroke and can't manage the phone. SOA and consent complexities.",
    clientPersona: "You are Patricia Miller, calling on behalf of your husband George Miller, 76, in Fort Lauderdale FL. George had a mild stroke 3 months ago and has trouble speaking on the phone. He's sitting next to you and can confirm things. He's on a Humana MAPD but his rehab facility isn't covered and you're paying $400/week out of pocket. He takes Clopidogrel, Atorvastatin, Metformin, and now Eliquis post-stroke. You're frustrated and worried about costs.",
    leadContext: {
      id: "training_spouse",
      source: "manual",
      fields: {
        firstName: { v: "George", confidence: "verified", source: "manual" },
        lastName: { v: "Miller", confidence: "verified", source: "manual" },
        dob: { v: "1950-07-19", confidence: "medium", source: "manual" },
        phone: { v: "+15556789012", confidence: "verified", source: "manual" },
        address: { v: { city: "Fort Lauderdale", state: "FL", zip: "33301" }, confidence: "medium", source: "manual" },
        coverage: { v: "MAPD", confidence: "high", source: "manual" },
        medications: { v: ["Clopidogrel 75mg", "Atorvastatin 80mg", "Metformin 1000mg", "Eliquis 5mg"], confidence: "medium", source: "manual" },
        providers: { v: ["Dr. Kim - Neurology", "Encompass Rehab Center", "Dr. Green - Primary Care"], confidence: "medium", source: "manual" },
      },
    },
    successCriteria: "Agent properly handles third-party caller (SOA must be signed by George or authorized rep), verifies George can consent, checks rehab facility coverage in alternative plans, reviews formulary for all meds especially post-stroke, completes PECL with extra care on TPMO timing.",
  },
];
