/**
 * WSS /stream Tier 3 tests — suggestion engine + PECL auto-update.
 *
 * Stubs both Deepgram and the suggestion engine so we can assert on
 * the wire-format frames without making any real upstream calls.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { build } from "../src/index.js";

function makeDeepgramStub() {
  const calls = { onUtteranceRefs: [], audioFrames: [], created: 0, closed: 0 };
  const factory = (opts) => {
    calls.created += 1;
    calls.onUtteranceRefs.push(opts.onUtterance);
    return {
      sendAudio: (b) => calls.audioFrames.push(b),
      close: () => (calls.closed += 1),
      isOpen: () => true,
      readyPromise: Promise.resolve(),
    };
  };
  return { factory, calls };
}

/**
 * Stub engine factory — records constructor opts, exposes the latest
 * instance so tests can fire engine events back through the socket.
 */
function makeEngineStub() {
  const calls = { instances: [], leadCalls: [], ingestCalls: [], disposed: 0 };
  const factory = (deps) => {
    const inst = {
      deps,
      setLead: (lead) => calls.leadCalls.push(lead),
      ingestUtterance: (u) => {
        calls.ingestCalls.push(u);
        return Promise.resolve();
      },
      dispose: () => {
        calls.disposed += 1;
      },
      // Test helpers — not part of the real interface
      _emit: (event) => deps.emit(event),
    };
    calls.instances.push(inst);
    return inst;
  };
  return { factory, calls };
}

function connect(url) {
  const ws = new WebSocket(url);
  const messages = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const parsed = JSON.parse(raw.toString());
    const next = waiters.shift();
    if (next) next(parsed);
    else messages.push(parsed);
  });
  const nextMessage = () =>
    new Promise((resolve) => {
      if (messages.length) resolve(messages.shift());
      else waiters.push(resolve);
    });
  const opened = new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return { ws, opened, nextMessage };
}

test("engine receives ingestions and lead_context; events fan out to client", async () => {
  const dg = makeDeepgramStub();
  const eng = makeEngineStub();
  const app = await build(
    {
      nodeEnv: "test",
      logLevel: "fatal",
      deepgramApiKey: "test-key",
      anthropicApiKey: "test-key",
    },
    {
      deepgramFactory: dg.factory,
      // Pretend we have a Claude client so the engine factory is invoked
      suggestionClientFactory: () => ({ messages: { stream: () => ({}) } }),
      suggestionEngineFactory: eng.factory,
    }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // hello
    ws.send(JSON.stringify({ type: "start" }));
    await nextMessage(); // ready

    // 1. lead_context propagates
    ws.send(JSON.stringify({ type: "lead_context", lead: { firstName: "Maria", state: "FL" } }));
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(eng.calls.leadCalls.length, 1);
    assert.deepEqual(eng.calls.leadCalls[0], { firstName: "Maria", state: "FL" });

    // 2. simulated Deepgram utterance reaches both broadcast AND engine
    const onUtt = dg.calls.onUtteranceRefs[0];
    onUtt({ text: "Do you cover Eliquis?", isFinal: true, speaker: 0, ts: 1, words: [] });
    await nextMessage(); // utterance frame
    assert.equal(eng.calls.ingestCalls.length, 1);
    assert.equal(eng.calls.ingestCalls[0].text, "Do you cover Eliquis?");

    // 3. engine-emitted events show up on the wire with the sessionId
    const inst = eng.calls.instances[0];
    inst._emit({ type: "suggestion_start", id: "sug_1", kind: "medication" });
    inst._emit({ type: "suggestion_delta", id: "sug_1", kind: "medication", delta: "{\"sayThis" });
    inst._emit({
      type: "suggestion_done",
      id: "sug_1",
      kind: "medication",
      suggestion: { sayThis: "Hi" },
    });
    inst._emit({ type: "pecl_update", items: ["msp"] });

    const start = await nextMessage();
    const delta = await nextMessage();
    const done = await nextMessage();
    const pecl = await nextMessage();

    assert.equal(start.type, "suggestion_start");
    assert.equal(start.kind, "medication");
    assert.ok(start.sessionId);
    assert.equal(delta.type, "suggestion_delta");
    assert.equal(delta.delta, "{\"sayThis");
    assert.equal(done.type, "suggestion_done");
    assert.deepEqual(done.suggestion, { sayThis: "Hi" });
    assert.equal(pecl.type, "pecl_update");
    assert.deepEqual(pecl.items, ["msp"]);
  } finally {
    ws.close();
    await app.close();
  }
});

test("engine.dispose runs on client disconnect", async () => {
  const dg = makeDeepgramStub();
  const eng = makeEngineStub();
  const app = await build(
    {
      nodeEnv: "test",
      logLevel: "fatal",
      deepgramApiKey: "test-key",
      anthropicApiKey: "test-key",
    },
    {
      deepgramFactory: dg.factory,
      suggestionClientFactory: () => ({ messages: { stream: () => ({}) } }),
      suggestionEngineFactory: eng.factory,
    }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();
  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  await opened;
  await nextMessage();
  ws.close();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(eng.calls.disposed, 1);
  await app.close();
});

test("missing ANTHROPIC_API_KEY → engine factory not called, no crash", async () => {
  const dg = makeDeepgramStub();
  const eng = makeEngineStub();
  const app = await build(
    {
      nodeEnv: "test",
      logLevel: "fatal",
      deepgramApiKey: "test-key",
      anthropicApiKey: null,
    },
    {
      deepgramFactory: dg.factory,
      // Default suggestionClientFactory will return null due to missing key
      suggestionEngineFactory: eng.factory,
    }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();
  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // hello
    ws.send(JSON.stringify({ type: "start" }));
    await nextMessage(); // ready

    // Send an utterance — engine is disabled, so no ingest call.
    const onUtt = dg.calls.onUtteranceRefs[0];
    onUtt({ text: "Hello", isFinal: true, speaker: 0, ts: 1, words: [] });
    await nextMessage(); // utterance still goes out
    assert.equal(eng.calls.instances.length, 0);
  } finally {
    ws.close();
    await app.close();
  }
});

test("engine integration: real engine emits PECL update for TPMO language", async () => {
  // Use the real engine but stub the Anthropic client (no Claude calls).
  const dg = makeDeepgramStub();
  const fakeAnthropic = {
    messages: {
      stream() {
        // Stop the engine from actually firing a request — return an
        // iterable that completes immediately with a message_stop and
        // a finalMessage that yields an empty tool input.
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
            content: [{ type: "tool_use", input: { sayThis: "stub" } }],
          }),
        };
      },
    },
  };
  const app = await build(
    {
      nodeEnv: "test",
      logLevel: "fatal",
      deepgramApiKey: "test-key",
      anthropicApiKey: "test-key",
    },
    {
      deepgramFactory: dg.factory,
      suggestionClientFactory: () => fakeAnthropic,
    }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();
  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // hello
    ws.send(JSON.stringify({ type: "start" }));
    await nextMessage(); // ready

    const onUtt = dg.calls.onUtteranceRefs[0];
    // Utterance covers TPMO + introduces a question — both PECL update
    // and a suggestion stream should fire.
    onUtt({
      text: "We do not offer every plan available in your area, please contact Medicare.gov.",
      isFinal: true,
      speaker: 0,
      ts: 1,
      words: [],
    });

    // Collect frames for ~80ms
    const seen = [];
    const start = Date.now();
    while (Date.now() - start < 150) {
      const m = await Promise.race([
        nextMessage(),
        new Promise((r) => setTimeout(() => r(null), 20)),
      ]);
      if (m) seen.push(m);
      else if (seen.find((x) => x.type === "suggestion_done" || x.type === "suggestion_error")) break;
    }
    const types = seen.map((s) => s.type);
    assert.ok(types.includes("utterance"), `expected utterance frame, got ${types}`);
    assert.ok(types.includes("pecl_update"), `expected pecl_update, got ${types}`);
    const peclFrame = seen.find((s) => s.type === "pecl_update");
    assert.ok(peclFrame.items.includes("tpmo"));
  } finally {
    ws.close();
    await app.close();
  }
});
