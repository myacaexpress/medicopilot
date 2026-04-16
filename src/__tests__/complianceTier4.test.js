/**
 * Tier 4 polish — pure-helper tests for the three click/timer behaviors.
 *
 *   1. Compliance script insertion (applyInsertedScripts)
 *   2. PECL state derivation under auto + manual override
 *   3. MSP inline header badge mode (hidden / info / amber)
 *
 * The React glue in src/MediCopilot_macOS_Mockup.jsx wires these helpers
 * to clicks and timers. Tests stay at the helper layer because that's
 * where the only non-trivial logic lives.
 */
import { describe, it, expect } from "vitest";
import {
  COMPLIANCE_SCRIPTS,
  applyInsertedScripts,
} from "../data/compliance/scripts.js";
import {
  DEFAULT_PECL_ITEMS,
  mergePeclItems,
  togglePeclOverride,
} from "../data/pecl.js";
import {
  mspBadgeMode,
  MSP_AMBER_THRESHOLD_MS,
} from "../data/compliance/mspBadge.js";

describe("compliance scripts catalog", () => {
  it("covers all five PECL items", () => {
    const ids = Object.keys(COMPLIANCE_SCRIPTS).sort();
    expect(ids).toEqual(["lis", "medigap", "msp", "soa", "tpmo"]);
  });

  it("each script has a non-empty sayThis", () => {
    for (const s of Object.values(COMPLIANCE_SCRIPTS)) {
      expect(s.sayThis.length).toBeGreaterThan(40);
      expect(s.label).toBeTruthy();
      expect(s.id).toBeTruthy();
    }
  });

  it("MSP script mentions both Medicare Savings Programs and Part B premium", () => {
    expect(COMPLIANCE_SCRIPTS.msp.sayThis).toMatch(/Medicare Savings Programs/);
    expect(COMPLIANCE_SCRIPTS.msp.sayThis).toMatch(/Part B/);
  });
});

describe("applyInsertedScripts", () => {
  it("returns the original sayThis when nothing has been inserted", () => {
    const r = applyInsertedScripts("Hello there", null);
    expect(r.sayThis).toBe("Hello there");
    expect(r.inserted).toEqual([]);
  });

  it("appends the MSP script after the original line, separated by a blank", () => {
    const r = applyInsertedScripts("Mrs. Garcia, I pulled up plans...", ["msp"]);
    expect(r.sayThis.startsWith("Mrs. Garcia, I pulled up plans...")).toBe(true);
    expect(r.sayThis).toContain(COMPLIANCE_SCRIPTS.msp.sayThis);
    expect(r.sayThis).toMatch(/\n\n/);
    expect(r.inserted).toEqual([
      { id: "msp", label: "Medicare Savings", sayThis: COMPLIANCE_SCRIPTS.msp.sayThis },
    ]);
  });

  it("appends multiple scripts in insertion order", () => {
    const r = applyInsertedScripts("Original.", ["msp", "lis"]);
    const mspIdx = r.sayThis.indexOf(COMPLIANCE_SCRIPTS.msp.sayThis);
    const lisIdx = r.sayThis.indexOf(COMPLIANCE_SCRIPTS.lis.sayThis);
    expect(mspIdx).toBeGreaterThan(0);
    expect(lisIdx).toBeGreaterThan(mspIdx);
    expect(r.inserted.map((s) => s.id)).toEqual(["msp", "lis"]);
  });

  it("silently drops unknown ids", () => {
    const r = applyInsertedScripts("Original.", ["msp", "bogus"]);
    expect(r.inserted.map((s) => s.id)).toEqual(["msp"]);
    expect(r.sayThis).toContain(COMPLIANCE_SCRIPTS.msp.sayThis);
  });

  it("handles empty/missing original copy", () => {
    const r = applyInsertedScripts("", ["tpmo"]);
    expect(r.sayThis).toBe(COMPLIANCE_SCRIPTS.tpmo.sayThis);
  });
});

describe("mergePeclItems with auto + overrides", () => {
  it("returns base items unchanged when no auto / overrides apply", () => {
    const merged = mergePeclItems(DEFAULT_PECL_ITEMS, null, null);
    expect(merged).toEqual(DEFAULT_PECL_ITEMS);
  });

  it("auto-set flips an undone item to done with auto-transcript tag", () => {
    const merged = mergePeclItems(DEFAULT_PECL_ITEMS, new Set(["msp"]));
    const msp = merged.find((i) => i.id === "msp");
    expect(msp.done).toBe(true);
    expect(msp.coveredBy).toBe("auto-transcript");
  });

  it("manual-undone overrides auto-coverage", () => {
    const overrides = new Map([["msp", "manual-undone"]]);
    const merged = mergePeclItems(DEFAULT_PECL_ITEMS, new Set(["msp"]), overrides);
    const msp = merged.find((i) => i.id === "msp");
    expect(msp.done).toBe(false);
    expect(msp.coveredBy).toBe("manual-override");
  });

  it("manual-done forces an undone item to done with manual tag", () => {
    const overrides = new Map([["medigap", "manual-done"]]);
    const merged = mergePeclItems(DEFAULT_PECL_ITEMS, null, overrides);
    const mg = merged.find((i) => i.id === "medigap");
    expect(mg.done).toBe(true);
    expect(mg.coveredBy).toBe("manual");
  });

  it("auto-set does not change an item that's already done in the seed", () => {
    const merged = mergePeclItems(DEFAULT_PECL_ITEMS, new Set(["tpmo"]));
    const tpmo = merged.find((i) => i.id === "tpmo");
    expect(tpmo.done).toBe(true);
    // Should NOT be tagged auto-transcript — it was already done.
    expect(tpmo.coveredBy).toBeUndefined();
  });
});

describe("togglePeclOverride", () => {
  it("auto-covered → manual-undone (agent disagrees with engine)", () => {
    const next = togglePeclOverride(null, "msp", { baseDone: false, autoCovered: true });
    expect(next.get("msp")).toBe("manual-undone");
  });

  it("manual-undone → cleared (revert to auto)", () => {
    const overrides = new Map([["msp", "manual-undone"]]);
    const next = togglePeclOverride(overrides, "msp", { baseDone: false, autoCovered: true });
    expect(next.has("msp")).toBe(false);
  });

  it("not-covered → manual-done (agent self-marks)", () => {
    const next = togglePeclOverride(null, "medigap", { baseDone: false, autoCovered: false });
    expect(next.get("medigap")).toBe("manual-done");
  });

  it("manual-done → cleared (revert to undone)", () => {
    const overrides = new Map([["medigap", "manual-done"]]);
    const next = togglePeclOverride(overrides, "medigap", { baseDone: false, autoCovered: false });
    expect(next.has("medigap")).toBe(false);
  });

  it("seeded-done items are immutable (no-op)", () => {
    const next = togglePeclOverride(null, "tpmo", { baseDone: true, autoCovered: false });
    expect(next.has("tpmo")).toBe(false);
    expect(next.size).toBe(0);
  });

  it("does not mutate the input map", () => {
    const original = new Map([["msp", "manual-undone"]]);
    togglePeclOverride(original, "medigap", { baseDone: false, autoCovered: false });
    expect(original.size).toBe(1);
    expect(original.get("msp")).toBe("manual-undone");
  });
});

describe("mspBadgeMode", () => {
  it("hidden once MSP is covered", () => {
    expect(mspBadgeMode({ elapsedMs: 0, mspCovered: true })).toBe("hidden");
    expect(mspBadgeMode({ elapsedMs: 30 * 60 * 1000, mspCovered: true })).toBe("hidden");
  });

  it("info during the first 10 minutes when MSP is uncovered", () => {
    expect(mspBadgeMode({ elapsedMs: 0, mspCovered: false })).toBe("info");
    expect(mspBadgeMode({ elapsedMs: 9 * 60 * 1000, mspCovered: false })).toBe("info");
  });

  it("amber once 10 minutes elapsed without MSP coverage", () => {
    expect(
      mspBadgeMode({ elapsedMs: MSP_AMBER_THRESHOLD_MS, mspCovered: false })
    ).toBe("amber");
    expect(
      mspBadgeMode({ elapsedMs: 30 * 60 * 1000, mspCovered: false })
    ).toBe("amber");
  });

  it("threshold is overridable for tests / future tuning", () => {
    expect(
      mspBadgeMode({ elapsedMs: 5_000, mspCovered: false, thresholdMs: 1_000 })
    ).toBe("amber");
  });
});
