/**
 * PECL (Pre-Enrollment Checklist) items — initial state for a new call.
 *
 * These are the five CMS-required items agents must cover during a
 * Medicare enrollment conversation. The `done` flags here are the v1
 * demo's default state; P2 replaces this with live state driven by
 * auto-scoring on the transcript (see plans/PRD.md § Phase 2).
 *
 * @typedef {"tpmo"|"lis"|"msp"|"medigap"|"soa"} PeclItemId
 *
 * @typedef {Object} PECLItem
 * @property {PeclItemId} id
 * @property {string}  label
 * @property {boolean} done
 * @property {"manual"|"auto-transcript"|"manual-override"} [coveredBy]
 *   How the item was marked done (or undone): "manual" = agent click,
 *   "auto-transcript" = engine auto-coverage, "manual-override" = the
 *   agent intentionally toggled an item against its automatic state.
 */

/** @type {PECLItem[]} */
export const DEFAULT_PECL_ITEMS = [
  { id: "tpmo",    label: "TPMO Disclaimer",      done: true  },
  { id: "lis",     label: "Low-Income Subsidy",   done: true  },
  { id: "msp",     label: "Medicare Savings",     done: false },
  { id: "medigap", label: "Medigap Rights",       done: false },
  { id: "soa",     label: "Scope of Appointment", done: true  },
];

/* ── PECL state derivation helpers ─────────────────────────────────── */

/**
 * Merge the demo PECL items with the engine's auto-coverage Set and the
 * agent's manual overrides. Precedence (highest first):
 *   1. manual override          (agent intentionally toggled the row)
 *   2. auto-transcript coverage (engine emitted pecl_update)
 *   3. baseline (DEFAULT_PECL_ITEMS)
 *
 * Manual override semantics:
 *   - "manual-done"   → force `done: true`  with coveredBy "manual"
 *   - "manual-undone" → force `done: false` with coveredBy "manual-override"
 *
 * @param {PECLItem[]} baseItems
 * @param {Set<string>|null|undefined} autoSet
 * @param {Map<PeclItemId, "manual-done"|"manual-undone">|null|undefined} [overrides]
 * @returns {PECLItem[]}
 */
export function mergePeclItems(baseItems, autoSet, overrides) {
  const auto = autoSet ?? new Set();
  const ov = overrides ?? new Map();
  return baseItems.map((it) => {
    const manual = ov.get(it.id);
    if (manual === "manual-done") {
      return { ...it, done: true, coveredBy: "manual" };
    }
    if (manual === "manual-undone") {
      // Agent explicitly un-covered the item — strip any auto/manual flag.
      return { ...it, done: false, coveredBy: "manual-override" };
    }
    if (!it.done && auto.has(it.id)) {
      return { ...it, done: true, coveredBy: "auto-transcript" };
    }
    return it;
  });
}

/**
 * Compute the next overrides Map after the agent clicks a PECL row.
 *
 * Click semantics (driven by the row's *current* effective state):
 *   - currently auto-done       → set "manual-undone" (disagree with engine)
 *   - currently manual-undone   → clear (back to whatever auto/base says)
 *   - currently undone (no auto)→ set "manual-done"
 *   - currently manual-done     → clear (back to undone)
 *   - currently base-done       → no-op (the demo seed cannot be un-done;
 *                                  agent has nothing to override here)
 *
 * The resulting Map omits keys equal to the default to keep it minimal.
 *
 * @param {Map<PeclItemId, "manual-done"|"manual-undone">|null|undefined} overrides
 * @param {PeclItemId} id
 * @param {{ baseDone: boolean, autoCovered: boolean }} ctx
 * @returns {Map<PeclItemId, "manual-done"|"manual-undone">}
 */
export function togglePeclOverride(overrides, id, ctx) {
  const next = new Map(overrides ?? []);
  const current = next.get(id);
  const { baseDone, autoCovered } = ctx;

  // Already manually toggled — unset and revert.
  if (current === "manual-done" || current === "manual-undone") {
    next.delete(id);
    return next;
  }
  // Engine auto-covered → click means "no, I haven't said it yet."
  if (autoCovered && !baseDone) {
    next.set(id, "manual-undone");
    return next;
  }
  // Not yet covered (and not in the seeded-done set) → click means "I'm
  // marking this covered manually."
  if (!baseDone && !autoCovered) {
    next.set(id, "manual-done");
    return next;
  }
  // Seeded-done items are immutable from the UI — no-op.
  return next;
}
