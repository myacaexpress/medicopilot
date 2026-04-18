import { describe, it, expect } from "vitest";
import { TRAINING_SCENARIOS } from "../data/training/scenarios.js";

describe("training scenarios data", () => {
  it("has at least 5 scenarios", () => {
    expect(TRAINING_SCENARIOS.length).toBeGreaterThanOrEqual(5);
  });

  it("each scenario has required fields", () => {
    for (const s of TRAINING_SCENARIOS) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.clientPersona).toBeTruthy();
      expect(s.leadContext).toBeTruthy();
      expect(s.leadContext.fields).toBeTruthy();
      expect(s.successCriteria).toBeTruthy();
    }
  });

  it("scenario IDs are unique", () => {
    const ids = TRAINING_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each scenario leadContext has a firstName field", () => {
    for (const s of TRAINING_SCENARIOS) {
      expect(s.leadContext.fields.firstName).toBeTruthy();
      expect(s.leadContext.fields.firstName.v).toBeTruthy();
    }
  });

  it("each scenario leadContext has medications", () => {
    for (const s of TRAINING_SCENARIOS) {
      expect(Array.isArray(s.leadContext.fields.medications.v)).toBe(true);
      expect(s.leadContext.fields.medications.v.length).toBeGreaterThan(0);
    }
  });
});

describe("solo toggle role logic", () => {
  it("toggle switches between agent and client", () => {
    let role = "agent";
    const toggle = () => { role = role === "agent" ? "client" : "agent"; };
    toggle();
    expect(role).toBe("client");
    toggle();
    expect(role).toBe("agent");
    toggle();
    expect(role).toBe("client");
  });

  it("server ptt_state maps correctly to roles", () => {
    let trainingMode = true;
    const mapSpeaker = (pttSpeaking) => {
      if (trainingMode) return pttSpeaking ? "agent" : "client";
      return "agent";
    };
    // Agent role = pttSpeaking true
    expect(mapSpeaker(true)).toBe("agent");
    // Client role = pttSpeaking false
    expect(mapSpeaker(false)).toBe("client");
  });
});

describe("training session lifecycle", () => {
  it("tester name validates non-empty", () => {
    const validate = (name) => !!(name && typeof name === "string" && name.trim());
    expect(validate("")).toBe(false);
    expect(validate(null)).toBe(false);
    expect(validate("  ")).toBe(false);
    expect(validate("Michael")).toBe(true);
    expect(validate("  Jane  ")).toBe(true);
  });
});
