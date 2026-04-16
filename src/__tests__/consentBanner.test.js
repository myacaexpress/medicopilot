/**
 * Tests for the consent banner hook logic.
 */
import { describe, it, expect } from "vitest";
import { consentPolicy } from "../data/compliance/states.js";

describe("consentPolicy", () => {
  it("returns two-party for known two-party states", () => {
    const twoParty = ["CA", "FL", "IL", "MD", "MA", "MT", "NH", "PA", "WA"];
    for (const st of twoParty) {
      expect(consentPolicy(st)).toBe("two-party");
    }
  });

  it("returns two-party for unknown states (safe default)", () => {
    expect(consentPolicy("TX")).toBe("two-party");
    expect(consentPolicy(undefined)).toBe("two-party");
    expect(consentPolicy(null)).toBe("two-party");
  });

  it("returns two-party for mixed consent states", () => {
    // OR is mixed — we treat as two-party
    expect(consentPolicy("OR")).toBe("two-party");
  });
});
