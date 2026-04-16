/**
 * Medication recognizer — derives a small drug-name set from the
 * Plan Provider seed file (src/data/plans/seed.json) so we can detect
 * mentions in the live transcript and trigger a "what plans cover X"
 * suggestion.
 *
 * Scope is intentionally narrow: only brand names that already appear
 * in the seed formulary. The full RxNorm crosswalk lives in the
 * (future) Plan Provider; this module just gives us a reasonable seed
 * for Tier 3 demos. Add brand names + common variants here as needed.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Path to the canonical seed file. Tests can pass a different path.
 * The seed lives in the frontend tree (src/data/plans/seed.json) — the
 * Docker build context already includes /src so this resolves at runtime.
 */
const DEFAULT_SEED_PATH = resolve(__dirname, "../../../src/data/plans/seed.json");

/**
 * Strip the dosage suffix to get a clean brand-name token.
 *  "Eliquis 5mg tab"      → "Eliquis"
 *  "Atorvastatin 20mg tab" → "Atorvastatin"
 *  "Mounjaro 5mg pen"     → "Mounjaro"
 */
function brandFromDrug(name) {
  return String(name)
    .replace(/\s+\d.*$/i, "") // drop "5mg tab", "20 mg pen", etc.
    .trim();
}

/**
 * Walk the seed JSON and collect a deduped, sorted list of brand names.
 * @param {object} seed
 * @returns {string[]}
 */
export function collectBrandsFromSeed(seed) {
  const brands = new Set();
  const states = seed?.states ?? {};
  for (const state of Object.values(states)) {
    for (const plan of state?.plans ?? []) {
      for (const drug of plan?.formulary?.drugs ?? []) {
        const brand = brandFromDrug(drug.name);
        if (brand) brands.add(brand);
      }
    }
  }
  return [...brands].sort();
}

let _cached;
/** Lazily load + cache the brand list from disk. */
export function loadMedicationBrands(seedPath = DEFAULT_SEED_PATH) {
  if (_cached) return _cached;
  try {
    const raw = readFileSync(seedPath, "utf8");
    _cached = collectBrandsFromSeed(JSON.parse(raw));
  } catch {
    _cached = []; // Don't fail boot if seed is missing — just no detections.
  }
  return _cached;
}

/** Test helper: clear the in-memory cache. */
export function _resetMedicationCache() {
  _cached = undefined;
}

/**
 * @typedef {{ kind: "medication", brand: string, span: [number, number] }} MedHit
 *
 * Find brand-name medication mentions in `text`. Case-insensitive,
 * word-boundary matched, returns first hit only (first hit wins —
 * the Claude suggestion generator looks at full context anyway).
 *
 * @param {string} text
 * @param {string[]} [brands]  injectable for tests
 * @returns {MedHit | null}
 */
export function findMedicationMention(text, brands = loadMedicationBrands()) {
  if (!text || typeof text !== "string") return null;
  for (const brand of brands) {
    const re = new RegExp(`\\b${escapeRe(brand)}\\b`, "i");
    const m = re.exec(text);
    if (m) {
      return { kind: "medication", brand, span: [m.index, m.index + m[0].length] };
    }
  }
  return null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
