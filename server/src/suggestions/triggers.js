/**
 * Trigger classifier — decides whether a finalised utterance should
 * fire a suggestion, and what kind. Pure / synchronous; the only async
 * fallback (Claude Haiku for ambiguous question detection) is opt-in.
 *
 * Trigger kinds (priority order):
 *   1. medication  — brand-name match against the formulary seed
 *   2. provider    — "Dr. <Name>" or "Doctor <Name>"
 *   3. pecl        — TPMO / LIS / MSP / Medigap / SOA keyword match
 *   4. question    — interrogative form (rule-based, then Haiku fallback)
 *
 * The first matching kind wins. Returning `null` means "no suggestion."
 *
 * @typedef {"medication"|"provider"|"pecl"|"question"} TriggerKind
 *
 * @typedef {Object} Trigger
 * @property {TriggerKind} kind
 * @property {string}      summary           human-readable trigger label
 * @property {Object}      [item]            kind-specific payload
 */

import { findMedicationMention } from "./medications.js";
import { matchPECL } from "./pecl.js";

const QUESTION_STARTERS = [
  "what", "where", "when", "why", "how",
  "who", "which", "whose",
  "can", "could", "do", "does", "did",
  "will", "would", "should",
  "is", "are", "am", "was", "were",
  "have", "has", "had",
];

const PROVIDER_RE =
  /\b(?:Dr\.?|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/;

/**
 * Pure-rule question detector. Matches:
 *   - explicit "?" at the end of the trimmed text
 *   - interrogative-starter words at the front of the sentence
 * Returns `false` for utterances that are clearly statements
 * (e.g., "I take Eliquis daily.") so callers can decide whether to
 * spend a Haiku call on the ambiguous middle.
 *
 * @param {string} text
 * @returns {{ certain: boolean, isQuestion: boolean }}
 */
export function detectQuestion(text) {
  const t = String(text || "").trim();
  if (!t) return { certain: true, isQuestion: false };
  if (/[?]\s*$/.test(t)) return { certain: true, isQuestion: true };
  // Take the first sentence-ish chunk for starter analysis.
  const head = t.split(/[.!?]\s/)[0].toLowerCase();
  const firstWord = head.replace(/^[^a-z]+/, "").split(/\s+/)[0];
  if (QUESTION_STARTERS.includes(firstWord)) {
    return { certain: true, isQuestion: true };
  }
  // Statements that look declarative ("I", "We", "My", "The") get a
  // confident "no" — no Haiku call needed.
  if (/^(?:i|we|my|our|the|that|this|it|he|she|they)\b/i.test(head)) {
    return { certain: true, isQuestion: false };
  }
  // Anything else is ambiguous — Haiku can decide if the caller wants.
  return { certain: false, isQuestion: false };
}

/**
 * Classify an utterance into at most one trigger, applying the kind
 * priority described above. The `haikuClassify` arg is an optional
 * async fallback for ambiguous questions; if omitted, we treat
 * "uncertain" as "not a question."
 *
 * @param {string} text
 * @param {Object} [opts]
 * @param {(text: string) => Promise<boolean>} [opts.haikuClassify]
 * @returns {Promise<Trigger | null>}
 */
export async function classifyUtterance(text, opts = {}) {
  const t = String(text || "").trim();
  if (!t) return null;

  // 1. medication
  const med = findMedicationMention(t);
  if (med) {
    return {
      kind: "medication",
      summary: `Mentions medication: ${med.brand}`,
      item: med,
    };
  }

  // 2. provider
  const provMatch = PROVIDER_RE.exec(t);
  if (provMatch) {
    return {
      kind: "provider",
      summary: `Mentions provider: ${provMatch[0]}`,
      item: { name: provMatch[1], full: provMatch[0] },
    };
  }

  // 3. PECL
  const peclHits = matchPECL(t);
  if (peclHits.length > 0) {
    return {
      kind: "pecl",
      summary: `Covers PECL item${peclHits.length > 1 ? "s" : ""}: ${peclHits.map((h) => h.label).join(", ")}`,
      item: { hits: peclHits },
    };
  }

  // 4. question
  const q = detectQuestion(t);
  if (q.isQuestion) {
    return { kind: "question", summary: "Question detected", item: { text: t } };
  }
  if (!q.certain && opts.haikuClassify) {
    try {
      const isQ = await opts.haikuClassify(t);
      if (isQ) {
        return { kind: "question", summary: "Question (Haiku)", item: { text: t } };
      }
    } catch {
      // Haiku failure is non-fatal — drop the trigger silently.
    }
  }

  return null;
}
