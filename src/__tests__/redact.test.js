/**
 * PII redactor tests. Mirrored on the server side at
 * server/test/redact.test.js — keep golden cases in sync.
 */
import { describe, it, expect } from "vitest";
import { redact, containsPII, luhn } from "../utils/redact.js";

describe("redact()", () => {
  it("returns input unchanged when there is nothing to redact", () => {
    const r = redact("Hi Maria, how are you today?");
    expect(r.redacted).toBe("Hi Maria, how are you today?");
    expect(r.counts).toEqual({ ssn: 0, credit_card: 0, phone: 0 });
  });

  it("handles empty / non-string input safely", () => {
    expect(redact("").redacted).toBe("");
    expect(redact(null).redacted).toBe("");
    expect(redact(undefined).redacted).toBe("");
  });

  it("redacts SSNs with dashes", () => {
    const r = redact("My SSN is 123-45-6789 thanks");
    expect(r.redacted).toBe("My SSN is [REDACTED:SSN] thanks");
    expect(r.counts.ssn).toBe(1);
  });

  it("redacts SSNs with spaces", () => {
    const r = redact("It is 123 45 6789 actually");
    expect(r.redacted).toBe("It is [REDACTED:SSN] actually");
    expect(r.counts.ssn).toBe(1);
  });

  it("redacts a Luhn-valid Visa", () => {
    const r = redact("Card 4111-1111-1111-1111 expires next year");
    expect(r.redacted).toBe("Card [REDACTED:CC] expires next year");
    expect(r.counts.credit_card).toBe(1);
  });

  it("redacts a Luhn-valid card with no separators", () => {
    const r = redact("Number is 4111111111111111.");
    expect(r.redacted).toBe("Number is [REDACTED:CC].");
    expect(r.counts.credit_card).toBe(1);
  });

  it("does NOT redact a 16-digit number that fails Luhn", () => {
    const r = redact("Plan ID 1234567890123456 is the MAPD");
    expect(r.redacted).toBe("Plan ID 1234567890123456 is the MAPD");
    expect(r.counts.credit_card).toBe(0);
  });

  it("redacts US phone numbers in common formats", () => {
    expect(redact("Call (954) 555-0142 today").redacted).toBe(
      "Call [REDACTED:PHONE] today"
    );
    expect(redact("Call 954-555-0142 today").redacted).toBe(
      "Call [REDACTED:PHONE] today"
    );
    expect(redact("Call 954.555.0142 today").redacted).toBe(
      "Call [REDACTED:PHONE] today"
    );
    expect(redact("Call +1 954 555 0142 today").redacted).toBe(
      "Call [REDACTED:PHONE] today"
    );
    expect(redact("Call 9545550142 today").redacted).toBe(
      "Call [REDACTED:PHONE] today"
    );
  });

  it("does NOT redact DOB, first name, or medication names (per OQ #12)", () => {
    const text = "Maria, born 03/15/1952, takes Eliquis daily.";
    const r = redact(text);
    expect(r.redacted).toBe(text);
    expect(r.counts).toEqual({ ssn: 0, credit_card: 0, phone: 0 });
  });

  it("redacts multiple kinds in one line and counts each", () => {
    const r = redact(
      "SSN 123-45-6789, card 4111-1111-1111-1111, callback (954) 555-0142."
    );
    expect(r.redacted).toBe(
      "SSN [REDACTED:SSN], card [REDACTED:CC], callback [REDACTED:PHONE]."
    );
    expect(r.counts).toEqual({ ssn: 1, credit_card: 1, phone: 1 });
  });

  it("does not double-redact phone digits already inside a card match", () => {
    // 4111-1111-1111-1111 contains "111-1111" runs that look phone-shaped
    // but should be consumed by the card pass first.
    const r = redact("Charge to 4111-1111-1111-1111 please");
    expect(r.redacted).toBe("Charge to [REDACTED:CC] please");
    expect(r.counts.phone).toBe(0);
  });
});

describe("containsPII()", () => {
  it("returns true when any pattern matches", () => {
    expect(containsPII("Call (954) 555-0142")).toBe(true);
  });
  it("returns false on clean text", () => {
    expect(containsPII("Hi Maria, how are you?")).toBe(false);
  });
});

describe("luhn()", () => {
  it("validates a known-good Visa test card", () => {
    expect(luhn("4111111111111111")).toBe(true);
  });
  it("rejects a non-Luhn run of digits", () => {
    expect(luhn("1234567890123456")).toBe(false);
  });
  it("rejects non-digit input", () => {
    expect(luhn("abcd")).toBe(false);
  });
});
