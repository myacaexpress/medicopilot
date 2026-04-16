/**
 * Server PII redactor tests.
 *
 * Mirrored from src/__tests__/redact.test.js — golden cases must stay
 * in sync. The parity test (redact-parity.test.js) verifies the server
 * copy and the client copy produce identical output for these inputs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { redact, containsPII, luhn } from "../src/redact.js";

test("returns input unchanged when there is nothing to redact", () => {
  const r = redact("Hi Maria, how are you today?");
  assert.equal(r.redacted, "Hi Maria, how are you today?");
  assert.deepEqual(r.counts, { ssn: 0, credit_card: 0, phone: 0 });
});

test("handles empty / non-string input safely", () => {
  assert.equal(redact("").redacted, "");
  assert.equal(redact(null).redacted, "");
  assert.equal(redact(undefined).redacted, "");
});

test("redacts SSNs with dashes", () => {
  const r = redact("My SSN is 123-45-6789 thanks");
  assert.equal(r.redacted, "My SSN is [REDACTED:SSN] thanks");
  assert.equal(r.counts.ssn, 1);
});

test("redacts SSNs with spaces", () => {
  const r = redact("It is 123 45 6789 actually");
  assert.equal(r.redacted, "It is [REDACTED:SSN] actually");
  assert.equal(r.counts.ssn, 1);
});

test("redacts a Luhn-valid Visa", () => {
  const r = redact("Card 4111-1111-1111-1111 expires next year");
  assert.equal(r.redacted, "Card [REDACTED:CC] expires next year");
  assert.equal(r.counts.credit_card, 1);
});

test("redacts a Luhn-valid card with no separators", () => {
  const r = redact("Number is 4111111111111111.");
  assert.equal(r.redacted, "Number is [REDACTED:CC].");
  assert.equal(r.counts.credit_card, 1);
});

test("does NOT redact a 16-digit number that fails Luhn", () => {
  const r = redact("Plan ID 1234567890123456 is the MAPD");
  assert.equal(r.redacted, "Plan ID 1234567890123456 is the MAPD");
  assert.equal(r.counts.credit_card, 0);
});

test("redacts US phone numbers in common formats", () => {
  assert.equal(redact("Call (954) 555-0142 today").redacted, "Call [REDACTED:PHONE] today");
  assert.equal(redact("Call 954-555-0142 today").redacted, "Call [REDACTED:PHONE] today");
  assert.equal(redact("Call 954.555.0142 today").redacted, "Call [REDACTED:PHONE] today");
  assert.equal(redact("Call +1 954 555 0142 today").redacted, "Call [REDACTED:PHONE] today");
  assert.equal(redact("Call 9545550142 today").redacted, "Call [REDACTED:PHONE] today");
});

test("does NOT redact DOB, first name, or medication names (per OQ #12)", () => {
  const text = "Maria, born 03/15/1952, takes Eliquis daily.";
  const r = redact(text);
  assert.equal(r.redacted, text);
  assert.deepEqual(r.counts, { ssn: 0, credit_card: 0, phone: 0 });
});

test("redacts multiple kinds in one line and counts each", () => {
  const r = redact("SSN 123-45-6789, card 4111-1111-1111-1111, callback (954) 555-0142.");
  assert.equal(
    r.redacted,
    "SSN [REDACTED:SSN], card [REDACTED:CC], callback [REDACTED:PHONE]."
  );
  assert.deepEqual(r.counts, { ssn: 1, credit_card: 1, phone: 1 });
});

test("does not double-redact phone digits already inside a card match", () => {
  const r = redact("Charge to 4111-1111-1111-1111 please");
  assert.equal(r.redacted, "Charge to [REDACTED:CC] please");
  assert.equal(r.counts.phone, 0);
});

test("containsPII reflects redact()", () => {
  assert.equal(containsPII("Call (954) 555-0142"), true);
  assert.equal(containsPII("Hi Maria, how are you?"), false);
});

test("luhn validates a known-good Visa test card", () => {
  assert.equal(luhn("4111111111111111"), true);
  assert.equal(luhn("1234567890123456"), false);
  assert.equal(luhn("abcd"), false);
});
