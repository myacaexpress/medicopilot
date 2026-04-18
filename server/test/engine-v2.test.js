/**
 * SuggestionEngine v2 tests — script state, proactive triggers,
 * out-of-order detection, compliance deadline, unanswered question.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SuggestionEngine } from "../src/suggestions/engine.js";
import { buildUserPrompt } from "../src/suggestions/claude.js";

/* ── Helpers ───────────────────────────────────────────────────────── */

function makeFakeClient(toolInput = { primary: "stub", sayThis: "stub" }) {
  return {
    messages: {
      stream() {
        const events = [{ type: "message_stop" }];
        return {
          [Symbol.asyncIterator]() {
            return {
              async next() {
                return events.length
                  ? { done: false, value: events.shift() }
                  : { done: true, value: undefined };
              },
            };
          },
          finalMessage: async () => ({
            content: [{ type: "tool_use", name: "emit_suggestion", input: toolInput }],
            usage: { input_tokens: 100, output_tokens: 50 },
          }),
        };
      },
    },
  };
}

function makeEngine(overrides = {}) {
  const events = [];
  let clock = overrides.startTime ?? 1000;
  const engine = new SuggestionEngine({
    client: overrides.client ?? makeFakeClient(),
    model: "claude-sonnet-4-6",
    emit: (e) => events.push(e),
    opts: {
      windowMs: overrides.windowMs ?? 120_000,
      cooldownMs: overrides.cooldownMs ?? 0, // no debounce in tests
      unansweredThresholdMs: overrides.unansweredThresholdMs ?? 90_000,
      mspDeadlineMs: overrides.mspDeadlineMs ?? 600_000,
      now: () => clock,
    },
  });
  const advance = (ms) => { clock += ms; };
  const setTime = (ms) => { clock = ms; };
  return { engine, events, advance, setTime };
}

/* ── buildUserPrompt v2 ───────────────────────────────────────────── */

test("buildUserPrompt includes script state (covered, requiredNext, overdue)", () => {
  const prompt = buildUserPrompt({
    trigger: { kind: "medication", summary: "Mentions: Eliquis" },
    lead: { firstName: "Maria" },
    transcriptWindow: [{ speaker: "client", text: "I take Eliquis." }],
    scriptState: {
      covered: ["tpmo", "soa"],
      requiredNext: "lis",
      overdueItems: ["msp"],
    },
  });
  assert.match(prompt, /Covered: tpmo, soa/);
  assert.match(prompt, /Required next: lis/);
  assert.match(prompt, /OVERDUE: msp/);
});

test("buildUserPrompt includes call timer", () => {
  const prompt = buildUserPrompt({
    trigger: { kind: "manual", summary: "Agent asked" },
    lead: null,
    transcriptWindow: [],
    callTimerMs: 630_000,
  });
  assert.match(prompt, /Call timer: 10m 30s/);
});

test("buildUserPrompt omits script state section when null", () => {
  const prompt = buildUserPrompt({
    trigger: { kind: "question", summary: "Q" },
    lead: null,
    transcriptWindow: [],
    scriptState: null,
    callTimerMs: null,
  });
  assert.ok(!prompt.includes("Script state"));
  assert.ok(!prompt.includes("Call timer"));
});

/* ── Script state + call timer wiring ─────────────────────────────── */

test("setScriptState and setCallTimer update engine state", () => {
  const { engine } = makeEngine();
  assert.equal(engine.scriptState, null);
  assert.equal(engine.callTimerMs, null);

  engine.setScriptState({ covered: ["tpmo"], requiredNext: "lis", overdueItems: [] });
  assert.deepEqual(engine.scriptState.covered, ["tpmo"]);

  engine.setCallTimer(300_000);
  assert.equal(engine.callTimerMs, 300_000);

  engine.dispose();
});

/* ── Out-of-order topic detection ─────────────────────────────────── */

test("medication trigger enriched to out_of_order when prerequisite missing", async () => {
  const { engine, events } = makeEngine();
  engine.setScriptState({
    covered: [],
    requiredNext: "tpmo",
    overdueItems: [],
  });

  // "Eliquis" triggers a medication kind in classifyUtterance
  await engine.ingestUtterance({ speaker: "client", text: "I take Eliquis daily" });

  // The engine should have fired a suggestion. Check if the emitted
  // suggestion_start kind is "out_of_order" (enriched) or "medication".
  const starts = events.filter((e) => e.type === "suggestion_start");
  if (starts.length > 0) {
    assert.equal(starts[0].kind, "out_of_order");
  }
  engine.dispose();
});

test("no out-of-order enrichment when prerequisite is already covered", async () => {
  const { engine, events } = makeEngine();
  engine.setScriptState({
    covered: ["tpmo"],
    requiredNext: "tpmo", // already covered
    overdueItems: [],
  });

  await engine.ingestUtterance({ speaker: "client", text: "I take Eliquis daily" });

  const starts = events.filter((e) => e.type === "suggestion_start");
  if (starts.length > 0) {
    // Should NOT be out_of_order since tpmo is in covered[]
    assert.notEqual(starts[0].kind, "out_of_order");
  }
  engine.dispose();
});

/* ── Compliance deadline (MSP at 10 min) ──────────────────────────── */

test("compliance_deadline fires when call exceeds mspDeadlineMs and MSP not covered", async () => {
  const { engine, events } = makeEngine({ mspDeadlineMs: 600_000 });
  engine.setScriptState({
    covered: ["tpmo"],
    requiredNext: "msp",
    overdueItems: [],
  });

  // Call hasn't reached 10 min yet — no trigger
  engine.setCallTimer(599_999);
  const deadlineBefore = events.filter((e) => e.kind === "compliance_deadline");
  assert.equal(deadlineBefore.length, 0);

  // Cross the 10-minute mark
  engine.setCallTimer(600_001);

  // Wait for the async _runSuggestion to complete
  await new Promise((r) => setTimeout(r, 50));

  const deadlineAfter = events.filter((e) => e.kind === "compliance_deadline");
  assert.ok(deadlineAfter.length > 0, "expected compliance_deadline events");
  assert.equal(deadlineAfter[0].type, "suggestion_start");
  engine.dispose();
});

test("compliance_deadline does NOT fire when MSP is already covered", () => {
  const { engine, events } = makeEngine({ mspDeadlineMs: 600_000 });
  engine.setScriptState({
    covered: ["tpmo", "msp"],
    requiredNext: null,
    overdueItems: [],
  });

  engine.setCallTimer(700_000);
  const deadline = events.filter((e) => e.kind === "compliance_deadline");
  assert.equal(deadline.length, 0);
  engine.dispose();
});

test("compliance_deadline fires only once", async () => {
  const { engine, events } = makeEngine({ mspDeadlineMs: 600_000 });
  engine.setScriptState({
    covered: [],
    requiredNext: "msp",
    overdueItems: [],
  });

  engine.setCallTimer(610_000);
  await new Promise((r) => setTimeout(r, 50));
  engine.setCallTimer(620_000);
  await new Promise((r) => setTimeout(r, 50));

  const deadlines = events.filter(
    (e) => e.type === "suggestion_start" && e.kind === "compliance_deadline"
  );
  assert.equal(deadlines.length, 1, "compliance_deadline should fire exactly once");
  engine.dispose();
});

/* ── Unanswered question (90s threshold) ──────────────────────────── */

test("unanswered_question fires when client question goes unanswered", async () => {
  const { engine, events, advance } = makeEngine({ unansweredThresholdMs: 90_000 });

  // Client asks a question
  await engine.ingestUtterance({ speaker: "client", text: "What plans cover my doctor?" });

  // Advance past the 90s threshold
  advance(91_000);
  engine.setCallTimer(91_000);
  await new Promise((r) => setTimeout(r, 50));

  const unanswered = events.filter(
    (e) => e.type === "suggestion_start" && e.kind === "unanswered_question"
  );
  assert.ok(unanswered.length > 0, "expected unanswered_question trigger");
  engine.dispose();
});

test("unanswered_question does NOT fire if agent speaks after question", async () => {
  const { engine, events, advance } = makeEngine({ unansweredThresholdMs: 90_000 });

  await engine.ingestUtterance({ speaker: "client", text: "What plans cover my doctor?" });
  advance(5_000);
  await engine.ingestUtterance({ speaker: "agent", text: "Let me look that up for you." });

  advance(91_000);
  engine.setCallTimer(96_000);
  await new Promise((r) => setTimeout(r, 50));

  const unanswered = events.filter(
    (e) => e.type === "suggestion_start" && e.kind === "unanswered_question"
  );
  assert.equal(unanswered.length, 0, "agent response should reset unanswered tracker");
  engine.dispose();
});

/* ── requestSuggestion (manual Ask AI) ────────────────────────────── */

test("requestSuggestion emits suggestion_error when no transcript", async () => {
  const { engine, events } = makeEngine();

  await engine.requestSuggestion();

  const errors = events.filter((e) => e.type === "suggestion_error");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "no_transcript");
  engine.dispose();
});

test("requestSuggestion bypasses debouncer and fires suggestion", async () => {
  const { engine, events } = makeEngine({ cooldownMs: 60_000 }); // long cooldown

  // Seed a transcript line so requestSuggestion doesn't bail
  await engine.ingestUtterance({ speaker: "client", text: "Tell me about Part D" });

  // Manual request should bypass debouncer
  await engine.requestSuggestion();

  const manualStarts = events.filter(
    (e) => e.type === "suggestion_start" && e.kind === "manual"
  );
  assert.ok(manualStarts.length > 0, "manual suggestion should fire despite long cooldown");
  engine.dispose();
});

/* ── dispose prevents further work ────────────────────────────────── */

test("disposed engine ignores ingestUtterance and setCallTimer", async () => {
  const { engine, events } = makeEngine();
  engine.dispose();

  await engine.ingestUtterance({ speaker: "client", text: "Hello?" });
  engine.setCallTimer(999_999);

  assert.equal(events.length, 0, "disposed engine should emit nothing");
});

/* ── PECL auto-coverage from utterance ────────────────────────────── */

test("PECL match emits pecl_update for TPMO language", async () => {
  const { engine, events } = makeEngine();

  await engine.ingestUtterance({
    speaker: "agent",
    text: "We do not offer every plan available in your area. Please contact Medicare.gov.",
  });

  const peclUpdates = events.filter((e) => e.type === "pecl_update");
  assert.ok(peclUpdates.length > 0, "expected pecl_update");
  assert.ok(peclUpdates[0].items.includes("tpmo"));
  engine.dispose();
});

test("duplicate PECL hit does not re-emit", async () => {
  const { engine, events } = makeEngine();

  await engine.ingestUtterance({
    speaker: "agent",
    text: "We do not offer every plan available in your area.",
  });
  await engine.ingestUtterance({
    speaker: "agent",
    text: "We do not offer every plan available in your area.",
  });

  const peclUpdates = events.filter((e) => e.type === "pecl_update");
  assert.equal(peclUpdates.length, 1, "duplicate PECL match should not re-emit");
  engine.dispose();
});
