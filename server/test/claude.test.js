import { test } from "node:test";
import assert from "node:assert/strict";
import {
  streamSuggestion,
  buildUserPrompt,
  SUGGESTION_TOOL,
  SYSTEM_PROMPT,
  COMPLIANCE_CATALOG,
} from "../src/suggestions/claude.js";

/**
 * Build a fake Anthropic client that records the request body and emits
 * a scripted sequence of stream events. The real SDK returns an
 * AsyncIterable + an awaited `finalMessage()` accessor — we mimic both.
 */
function makeFakeClient(scriptedEvents, finalToolInput) {
  const captured = { requests: [] };
  const client = {
    messages: {
      stream(body) {
        captured.requests.push(body);
        const events = [...scriptedEvents];
        const iter = {
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (events.length === 0) return { done: true, value: undefined };
                return { done: false, value: events.shift() };
              },
            };
          },
          finalMessage: async () => ({
            content: finalToolInput
              ? [{ type: "tool_use", name: "emit_suggestion", input: finalToolInput }]
              : [],
            usage: { input_tokens: 1234, output_tokens: 567, cache_read_input_tokens: 1100 },
          }),
        };
        return iter;
      },
    },
  };
  return { client, captured };
}

test("buildUserPrompt includes trigger, lead, and transcript", () => {
  const prompt = buildUserPrompt({
    trigger: { kind: "medication", summary: "Mentions: Eliquis", item: { brand: "Eliquis" } },
    lead: { firstName: "Maria", state: "FL" },
    transcriptWindow: [
      { speaker: "client", text: "I take Eliquis daily." },
      { speaker: "agent", text: "Got it, let me check coverage." },
    ],
  });
  assert.match(prompt, /Trigger: medication/);
  assert.match(prompt, /Eliquis/);
  assert.match(prompt, /Maria/);
  assert.match(prompt, /client: I take Eliquis daily\./);
});

test("SYSTEM_PROMPT and COMPLIANCE_CATALOG mention required PECL items", () => {
  for (const term of ["TPMO", "LIS", "MSP", "Medigap", "Scope of Appointment"]) {
    assert.ok(
      COMPLIANCE_CATALOG.includes(term) || SYSTEM_PROMPT.includes(term),
      `missing: ${term}`
    );
  }
});

test("streamSuggestion sends cache_control on the system block", async () => {
  const { client, captured } = makeFakeClient(
    [
      // Token-by-token JSON for the tool input
      { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{\"sayThis\":\"" } },
      { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "Mrs. Garcia, Eliquis is on the formulary.\"}" } },
      { type: "message_stop" },
    ],
    { sayThis: "Mrs. Garcia, Eliquis is on the formulary." }
  );

  await streamSuggestion(
    { client, model: "claude-sonnet-4-6" },
    {
      trigger: { kind: "medication", summary: "Mentions: Eliquis", item: { brand: "Eliquis" } },
      lead: null,
      transcriptWindow: [],
    }
  );

  assert.equal(captured.requests.length, 1);
  const body = captured.requests[0];

  // System must be a structured array with a cached text block.
  assert.ok(Array.isArray(body.system), "system should be an array of blocks");
  assert.equal(body.system[0].type, "text");
  assert.deepEqual(body.system[0].cache_control, { type: "ephemeral" });
  assert.ok(body.system[0].text.includes("MediCopilot"));
  assert.ok(body.system[0].text.includes("Compliance catalog"));

  // Tool wiring
  assert.equal(body.tools[0].name, SUGGESTION_TOOL.name);
  assert.deepEqual(body.tool_choice, { type: "tool", name: "emit_suggestion" });
  assert.equal(body.model, "claude-sonnet-4-6");
});

test("streamSuggestion fans deltas to onJsonDelta and resolves with parsed tool input", async () => {
  const { client } = makeFakeClient(
    [
      { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{\"sayThis\":\"" } },
      { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "Hello\",\"pressMore\":[]}" } },
      { type: "message_stop" },
    ],
    { sayThis: "Hello", pressMore: [] }
  );

  const deltas = [];
  let completed = null;
  const result = await streamSuggestion(
    { client, model: "claude-sonnet-4-6" },
    {
      trigger: { kind: "question", summary: "Question detected" },
      lead: null,
      transcriptWindow: [],
      onJsonDelta: (d) => deltas.push(d),
      onComplete: (p) => (completed = p),
    }
  );

  assert.equal(deltas.length, 2);
  assert.equal(deltas.join(""), "{\"sayThis\":\"Hello\",\"pressMore\":[]}");
  assert.deepEqual(result.suggestion, { sayThis: "Hello", pressMore: [] });
  assert.equal(result.kind, "question");
  assert.deepEqual(completed.suggestion, { sayThis: "Hello", pressMore: [] });
});

test("streamSuggestion falls back to delta buffer when finalMessage has no tool block", async () => {
  const { client } = makeFakeClient(
    [
      { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{\"sayThis\":\"X\"}" } },
      { type: "message_stop" },
    ],
    null // finalMessage returns no tool_use block
  );

  const result = await streamSuggestion(
    { client, model: "m" },
    {
      trigger: { kind: "question", summary: "q" },
      lead: null,
      transcriptWindow: [],
    }
  );
  assert.deepEqual(result.suggestion, { sayThis: "X" });
});

test("streamSuggestion rejects when no parseable suggestion is produced", async () => {
  const { client } = makeFakeClient([{ type: "message_stop" }], null);
  let captured;
  await assert.rejects(
    streamSuggestion(
      { client, model: "m" },
      {
        trigger: { kind: "question", summary: "q" },
        lead: null,
        transcriptWindow: [],
        onError: (e) => (captured = e),
      }
    ),
    /no parseable suggestion/i
  );
  assert.ok(captured instanceof Error);
});
