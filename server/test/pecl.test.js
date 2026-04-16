import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPECL, PECL_ITEM_DEFS } from "../src/suggestions/pecl.js";

test("PECL_ITEM_DEFS exposes the five canonical ids", () => {
  const ids = PECL_ITEM_DEFS.map((d) => d.id).sort();
  assert.deepEqual(ids, ["lis", "medigap", "msp", "soa", "tpmo"]);
});

test("TPMO disclaimer language is detected", () => {
  const hits = matchPECL(
    "We do not offer every plan available in your area, please contact Medicare.gov."
  );
  assert.ok(hits.some((h) => h.id === "tpmo"));
});

test("LIS / extra help is detected", () => {
  assert.ok(matchPECL("you may qualify for Extra Help with drug costs").some((h) => h.id === "lis"));
  assert.ok(matchPECL("low-income subsidy may apply").some((h) => h.id === "lis"));
});

test("MSP keyword variants are detected", () => {
  assert.ok(matchPECL("Medicare Savings Programs can pay your Part B premium").some((h) => h.id === "msp"));
  assert.ok(matchPECL("there is help with your Part B premium").some((h) => h.id === "msp"));
});

test("Medigap rights language is detected", () => {
  assert.ok(matchPECL("you have Medigap guaranteed-issue rights").some((h) => h.id === "medigap"));
  assert.ok(matchPECL("Medicare Supplement plans cover the gap").some((h) => h.id === "medigap"));
});

test("Scope of Appointment is detected", () => {
  assert.ok(matchPECL("Let's complete the Scope of Appointment first.").some((h) => h.id === "soa"));
  assert.ok(matchPECL("I need recorded permission to discuss plans.").some((h) => h.id === "soa"));
});

test("multiple PECL items can fire on a single utterance", () => {
  const hits = matchPECL(
    "I'd also note your Medigap rights and that you may qualify for Extra Help."
  );
  const ids = hits.map((h) => h.id).sort();
  assert.deepEqual(ids, ["lis", "medigap"]);
});

test("benign utterance returns no hits", () => {
  assert.deepEqual(matchPECL("Maria, how are you doing today?"), []);
});
