import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyUtterance, detectQuestion } from "../src/suggestions/triggers.js";
import { findMedicationMention, _resetMedicationCache } from "../src/suggestions/medications.js";

const BRANDS = ["Eliquis", "Jardiance", "Mounjaro", "Atorvastatin"];

test("medication trigger wins on brand-name mention", async () => {
  _resetMedicationCache();
  const t = await classifyUtterance("I take Eliquis daily for my heart.", {
    brands: BRANDS,
  });
  // classifyUtterance pulls from the live seed, but the seed includes Eliquis
  // so this works without an injected list. Belt-and-suspenders the call.
  assert.ok(t, "expected trigger");
  assert.equal(t.kind, "medication");
  assert.equal(t.item.brand, "Eliquis");
});

test("provider trigger fires on Dr. Patel form", async () => {
  const t = await classifyUtterance("Is Dr. Patel in network for this plan?");
  assert.ok(t);
  assert.equal(t.kind, "provider");
  assert.equal(t.item.name, "Patel");
});

test("PECL trigger fires on TPMO disclosure language", async () => {
  const t = await classifyUtterance(
    "I want to remind you we do not offer every plan in your area."
  );
  assert.ok(t);
  assert.equal(t.kind, "pecl");
  assert.ok(t.item.hits.some((h) => h.id === "tpmo"));
});

test("PECL trigger picks up MSP keyword", async () => {
  const t = await classifyUtterance(
    "There are Medicare Savings Programs that may help with your Part B premium."
  );
  assert.ok(t);
  assert.equal(t.kind, "pecl");
  assert.ok(t.item.hits.some((h) => h.id === "msp"));
});

test("question trigger fires on '?' suffix", async () => {
  const t = await classifyUtterance("Do you cover dental?");
  assert.ok(t);
  assert.equal(t.kind, "question");
});

test("question trigger fires on interrogative starter", async () => {
  const t = await classifyUtterance("How much would my premium be");
  assert.ok(t);
  assert.equal(t.kind, "question");
});

test("declarative statement returns no trigger", async () => {
  const t = await classifyUtterance("I really like that plan.");
  assert.equal(t, null);
});

test("medication trumps PECL when both match", async () => {
  // "Eliquis" + Medigap keyword in same utterance — medication has priority
  const t = await classifyUtterance("My Eliquis costs are huge — what about Medigap?");
  assert.ok(t);
  assert.equal(t.kind, "medication");
});

test("Haiku fallback is invoked only when rules are uncertain", async () => {
  let haikuCalled = 0;
  const haikuClassify = async () => {
    haikuCalled += 1;
    return true;
  };
  // "Maybe later" → not a question by rules, but ambiguous (no I/we/the/etc).
  const t = await classifyUtterance("Maybe later this afternoon", { haikuClassify });
  assert.equal(haikuCalled, 1);
  assert.ok(t);
  assert.equal(t.kind, "question");
});

test("Haiku is NOT invoked for clearly-declarative starters", async () => {
  let haikuCalled = 0;
  const haikuClassify = async () => {
    haikuCalled += 1;
    return true;
  };
  await classifyUtterance("I am thinking about it.", { haikuClassify });
  assert.equal(haikuCalled, 0);
});

test("detectQuestion handles edge cases", () => {
  assert.equal(detectQuestion("").isQuestion, false);
  assert.equal(detectQuestion("Why?").isQuestion, true);
  assert.equal(detectQuestion("when does enrollment end").isQuestion, true);
  assert.equal(detectQuestion("I take Eliquis.").isQuestion, false);
});

test("findMedicationMention returns word-boundary brand only", () => {
  const hit = findMedicationMention("She takes ELIQUIS every morning", BRANDS);
  assert.ok(hit);
  assert.equal(hit.brand, "Eliquis");
  // No match if the brand name is embedded in a longer word
  const miss = findMedicationMention("Eliquisly speaking it's expensive", BRANDS);
  assert.equal(miss, null);
});
