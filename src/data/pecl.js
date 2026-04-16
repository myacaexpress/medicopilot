/**
 * PECL (Pre-Enrollment Checklist) items — initial state for a new call.
 *
 * These are the five CMS-required items agents must cover during a
 * Medicare enrollment conversation. The `done` flags here are the v1
 * demo's default state; P2 replaces this with live state driven by
 * auto-scoring on the transcript (see plans/PRD.md § Phase 2).
 *
 * @typedef {Object} PECLItem
 * @property {"tpmo"|"lis"|"msp"|"medigap"|"soa"} id
 * @property {string}  label
 * @property {boolean} done
 * @property {"manual"|"auto-transcript"} [coveredBy]  P2+: how the item was marked done
 */

/** @type {PECLItem[]} */
export const DEFAULT_PECL_ITEMS = [
  { id: "tpmo",    label: "TPMO Disclaimer",      done: true  },
  { id: "lis",     label: "Low-Income Subsidy",   done: true  },
  { id: "msp",     label: "Medicare Savings",     done: false },
  { id: "medigap", label: "Medigap Rights",       done: false },
  { id: "soa",     label: "Scope of Appointment", done: true  },
];
