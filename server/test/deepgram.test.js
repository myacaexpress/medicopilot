/**
 * Pure unit tests for the Deepgram message interpreter and URL builder.
 * No network — these are fast tests of the parsing logic.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDeepgramUrl, handleDeepgramMessage } from "../src/deepgram.js";

test("buildDeepgramUrl includes the Tier 2 required params", () => {
  const url = buildDeepgramUrl();
  const u = new URL(url);
  assert.equal(u.host, "api.deepgram.com");
  assert.equal(u.pathname, "/v1/listen");
  assert.equal(u.searchParams.get("model"), "nova-3");
  assert.equal(u.searchParams.get("encoding"), "linear16");
  assert.equal(u.searchParams.get("sample_rate"), "16000");
  assert.equal(u.searchParams.get("channels"), "1");
  assert.equal(u.searchParams.get("diarize"), "true");
  assert.equal(u.searchParams.get("utterance_end_ms"), "1000");
  assert.equal(u.searchParams.get("interim_results"), "true");
  assert.equal(u.searchParams.get("smart_format"), "true");
});

test("buildDeepgramUrl honors a custom sample rate", () => {
  const url = buildDeepgramUrl({ sampleRate: 8000 });
  assert.equal(new URL(url).searchParams.get("sample_rate"), "8000");
});

test("handleDeepgramMessage forwards a finalised Results payload", () => {
  let captured = null;
  handleDeepgramMessage(
    {
      type: "Results",
      is_final: true,
      start: 1.5,
      channel: {
        alternatives: [
          {
            transcript: "Hello world",
            words: [
              { word: "Hello", start: 1.5, end: 1.8, speaker: 1 },
              { word: "world", start: 1.8, end: 2.1, speaker: 1 },
            ],
          },
        ],
      },
    },
    { onUtterance: (u) => (captured = u) }
  );
  assert.ok(captured);
  assert.equal(captured.text, "Hello world");
  assert.equal(captured.isFinal, true);
  assert.equal(captured.speaker, 1);
  assert.equal(captured.ts, 1.5);
  assert.equal(captured.words.length, 2);
});

test("handleDeepgramMessage drops interim results in Tier 2", () => {
  let captured = null;
  handleDeepgramMessage(
    {
      type: "Results",
      is_final: false,
      channel: { alternatives: [{ transcript: "interim", words: [] }] },
    },
    { onUtterance: (u) => (captured = u) }
  );
  assert.equal(captured, null);
});

test("handleDeepgramMessage drops empty transcripts", () => {
  let captured = null;
  handleDeepgramMessage(
    {
      type: "Results",
      is_final: true,
      channel: { alternatives: [{ transcript: "", words: [] }] },
    },
    { onUtterance: (u) => (captured = u) }
  );
  assert.equal(captured, null);
});

test("handleDeepgramMessage tolerates Metadata / UtteranceEnd / SpeechStarted frames", () => {
  let captured = null;
  for (const type of ["Metadata", "UtteranceEnd", "SpeechStarted"]) {
    handleDeepgramMessage({ type }, { onUtterance: (u) => (captured = u) });
  }
  assert.equal(captured, null);
});
