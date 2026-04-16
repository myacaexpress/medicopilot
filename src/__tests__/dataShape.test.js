/**
 * Shape tests for extracted data modules (P0).
 * Ensures the mock data matches expected shapes.
 */
import { describe, it, expect } from "vitest";
import {
  MOCK_LEADS,
  RECENT_LEADS,
  transcriptLines,
  aiResponses,
  DEFAULT_PECL_ITEMS,
  RECORDING_CONSENT,
  consentPolicy,
} from "../data/index.js";

describe("MOCK_LEADS", () => {
  it("has at least one lead", () => {
    expect(Object.keys(MOCK_LEADS).length).toBeGreaterThan(0);
  });

  it("each lead has id, source, and fields array", () => {
    for (const [key, lead] of Object.entries(MOCK_LEADS)) {
      expect(lead.id).toBe(key);
      expect(typeof lead.source).toBe("string");
      expect(Array.isArray(lead.fields)).toBe(true);
      expect(lead.fields.length).toBeGreaterThan(0);
    }
  });

  it("each field has k, v, pill properties", () => {
    for (const lead of Object.values(MOCK_LEADS)) {
      for (const f of lead.fields) {
        expect(typeof f.k).toBe("string");
        expect(f).toHaveProperty("v");
        expect(["verified", "high", "medium", "low"]).toContain(f.pill);
      }
    }
  });
});

describe("RECENT_LEADS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(RECENT_LEADS)).toBe(true);
    expect(RECENT_LEADS.length).toBeGreaterThan(0);
  });

  it("each entry has id, name, sub, tag", () => {
    for (const rl of RECENT_LEADS) {
      expect(typeof rl.id).toBe("string");
      expect(typeof rl.name).toBe("string");
      expect(typeof rl.sub).toBe("string");
      expect(typeof rl.tag).toBe("string");
    }
  });
});

describe("transcriptLines", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(transcriptLines)).toBe(true);
    expect(transcriptLines.length).toBeGreaterThan(0);
  });
});

describe("aiResponses", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(aiResponses)).toBe(true);
    expect(aiResponses.length).toBeGreaterThan(0);
  });
});

describe("DEFAULT_PECL_ITEMS", () => {
  it("has 5 items", () => {
    expect(DEFAULT_PECL_ITEMS.length).toBe(5);
  });

  it("each item has id, label, done", () => {
    for (const item of DEFAULT_PECL_ITEMS) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.label).toBe("string");
      expect(typeof item.done).toBe("boolean");
    }
  });

  const expectedIds = ["tpmo", "lis", "msp", "medigap", "soa"];
  it("contains all CMS-required PECL items", () => {
    const ids = DEFAULT_PECL_ITEMS.map(i => i.id);
    for (const expected of expectedIds) {
      expect(ids).toContain(expected);
    }
  });
});

describe("RECORDING_CONSENT", () => {
  it("has FL as two-party", () => {
    expect(RECORDING_CONSENT.FL.consent).toBe("two-party");
  });

  it("consentPolicy returns two-party for FL", () => {
    expect(consentPolicy("FL")).toBe("two-party");
  });

  it("consentPolicy defaults to two-party for unknown states", () => {
    expect(consentPolicy("XX")).toBe("two-party");
  });

  it("consentPolicy is case-insensitive", () => {
    expect(consentPolicy("fl")).toBe("two-party");
    expect(consentPolicy("ca")).toBe("two-party");
  });
});
