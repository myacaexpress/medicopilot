/**
 * Tests for LeadContext reducer and helpers.
 */
import { describe, it, expect, vi } from "vitest";
import {
  leadReducer,
  makeField,
  buildLeadFromExtraction,
  commitLeadEdit,
} from "../lead/LeadContext.jsx";

describe("makeField", () => {
  it("creates a field with defaults", () => {
    const f = makeField("Maria", "high", "vision");
    expect(f.v).toBe("Maria");
    expect(f.confidence).toBe("high");
    expect(f.source).toBe("vision");
    expect(f.lastEditedAt).toBeTruthy();
  });

  it("uses default confidence and source", () => {
    const f = makeField("test");
    expect(f.confidence).toBe("medium");
    expect(f.source).toBe("vision");
  });
});

describe("buildLeadFromExtraction", () => {
  it("builds a LeadContext from raw extraction fields", () => {
    const raw = {
      firstName: { v: "Maria", confidence: "high" },
      lastName: { v: "Garcia", confidence: "high" },
      dob: { v: "1952-03-15", confidence: "medium" },
      phone: { v: "+19545550142" },
      address: { v: { street: "", city: "Pembroke Pines", state: "FL", zip: "33024" }, confidence: "high" },
    };
    const lead = buildLeadFromExtraction(raw, "vision");

    expect(lead.id).toMatch(/^captured_\d+$/);
    expect(lead.source).toBe("vision");
    expect(lead.fields.firstName.v).toBe("Maria");
    expect(lead.fields.firstName.confidence).toBe("high");
    expect(lead.fields.lastName.v).toBe("Garcia");
    expect(lead.fields.dob.v).toBe("1952-03-15");
    expect(lead.fields.phone.confidence).toBe("medium"); // default
    expect(lead.fields.address.v.zip).toBe("33024");
    expect(lead.createdAt).toBeTruthy();
  });

  it("splits a full name into firstName + lastName", () => {
    const raw = {
      name: { v: "Harold Weaver", confidence: "high" },
    };
    const lead = buildLeadFromExtraction(raw);
    expect(lead.fields.firstName.v).toBe("Harold");
    expect(lead.fields.lastName.v).toBe("Weaver");
  });

  it("handles zip shorthand", () => {
    const raw = {
      zip: { v: "33013", confidence: "medium" },
    };
    const lead = buildLeadFromExtraction(raw);
    expect(lead.fields.address.v.zip).toBe("33013");
  });
});

describe("leadReducer", () => {
  const sampleLead = {
    id: "captured_123",
    source: "vision",
    fields: {
      firstName: makeField("Maria", "high", "vision"),
      lastName: makeField("Garcia", "high", "vision"),
    },
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };

  it("CAPTURE sets a new lead", () => {
    const result = leadReducer(null, { type: "CAPTURE", payload: sampleLead });
    expect(result.id).toBe("captured_123");
    expect(result.fields.firstName.v).toBe("Maria");
  });

  it("UPDATE_FIELD updates a single field", () => {
    const result = leadReducer(sampleLead, {
      type: "UPDATE_FIELD",
      payload: { fieldName: "firstName", value: "Marie", confidence: "verified" },
    });
    expect(result.fields.firstName.v).toBe("Marie");
    expect(result.fields.firstName.confidence).toBe("verified");
    expect(result.fields.firstName.source).toBe("manual");
    // lastName unchanged
    expect(result.fields.lastName.v).toBe("Garcia");
  });

  it("UPDATE_FIELD on null state returns null", () => {
    const result = leadReducer(null, {
      type: "UPDATE_FIELD",
      payload: { fieldName: "firstName", value: "Test" },
    });
    expect(result).toBeNull();
  });

  it("CLEAR returns null", () => {
    const result = leadReducer(sampleLead, { type: "CLEAR" });
    expect(result).toBeNull();
  });

  it("SWITCH replaces the lead", () => {
    const other = { ...sampleLead, id: "other_456" };
    const result = leadReducer(sampleLead, { type: "SWITCH", payload: other });
    expect(result.id).toBe("other_456");
  });

  it("HYDRATE sets from persisted data", () => {
    const result = leadReducer(null, { type: "HYDRATE", payload: sampleLead });
    expect(result.id).toBe("captured_123");
  });

  it("unknown action returns state unchanged", () => {
    const result = leadReducer(sampleLead, { type: "UNKNOWN" });
    expect(result).toBe(sampleLead);
  });
});

describe("commitLeadEdit", () => {
  const baseLead = {
    id: "captured_123",
    source: "vision",
    fields: {
      firstName: makeField("Maria", "high", "vision"),
      lastName: makeField("Garcia", "high", "vision"),
      dob: makeField("1952-03-15", "medium", "vision"),
      address: makeField({ street: "", city: "Pembroke Pines", state: "FL", zip: "33024" }, "high", "vision"),
    },
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };

  it("splits a name into firstName + lastName", () => {
    const updateField = vi.fn();
    commitLeadEdit(baseLead, "name", "Marie Garcia", updateField);
    expect(updateField).toHaveBeenCalledWith("firstName", "Marie", "verified");
    // lastName unchanged, should not be called
    expect(updateField).not.toHaveBeenCalledWith("lastName", expect.anything(), expect.anything());
  });

  it("handles a single-word name (no lastName)", () => {
    const updateField = vi.fn();
    commitLeadEdit(baseLead, "name", "Marie", updateField);
    expect(updateField).toHaveBeenCalledWith("firstName", "Marie", "verified");
    expect(updateField).toHaveBeenCalledWith("lastName", "", "verified");
  });

  it("parses City, ST ZIP into structured address", () => {
    const updateField = vi.fn();
    commitLeadEdit(baseLead, "address", "Hialeah, FL 33013", updateField);
    expect(updateField).toHaveBeenCalledTimes(1);
    expect(updateField).toHaveBeenCalledWith(
      "address",
      expect.objectContaining({ city: "Hialeah", state: "FL", zip: "33013" }),
      "verified"
    );
  });

  it("parses Street, City, ST ZIP into structured address", () => {
    const updateField = vi.fn();
    commitLeadEdit(baseLead, "address", "123 Main St, Hialeah, FL 33013", updateField);
    expect(updateField).toHaveBeenCalledWith(
      "address",
      expect.objectContaining({ street: "123 Main St", city: "Hialeah", state: "FL", zip: "33013" }),
      "verified"
    );
  });

  it("uppercases state code", () => {
    const updateField = vi.fn();
    commitLeadEdit(baseLead, "address", "Miami, fl 33101", updateField);
    expect(updateField).toHaveBeenCalledWith(
      "address",
      expect.objectContaining({ state: "FL" }),
      "verified"
    );
  });

  it("falls back to raw string if address doesn't match pattern", () => {
    const updateField = vi.fn();
    commitLeadEdit(baseLead, "address", "just some free form text", updateField);
    expect(updateField).toHaveBeenCalledWith("address", "just some free form text", "verified");
  });

  it("updates simple fields (dob, phone, coverage) by name", () => {
    const updateField = vi.fn();
    commitLeadEdit(baseLead, "dob", "1952-04-01", updateField);
    expect(updateField).toHaveBeenCalledWith("dob", "1952-04-01", "verified");
  });
});
