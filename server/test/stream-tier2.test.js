/**
 * WSS /stream Tier 2 tests.
 *
 * Goals:
 *   1. `{type:"start"}` opens a Deepgram session (stubbed) and the
 *      server emits `ready`.
 *   2. Binary audio frames reach the stub via `sendAudio`.
 *   3. Odd-length binary frames are rejected (Int16LE invariant).
 *   4. Without DEEPGRAM_API_KEY, `start` errors with `no_api_key`.
 *   5. **PII-redaction invariant**: when the Deepgram stub emits an
 *      utterance containing SSN / card / phone, the broadcast frame
 *      sent to the client has those redacted. This is the core
 *      compliance gate.
 *   6. `{type:"stop"}` closes the Deepgram session.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { build } from "../src/index.js";

/** Capture-and-control stub for the Deepgram factory. */
function makeDeepgramStub() {
  const calls = {
    created: 0,
    closed: 0,
    audioFrames: [],
    onUtteranceRefs: [],
  };
  const factory = (opts) => {
    calls.created += 1;
    calls.lastOpts = opts;
    calls.onUtteranceRefs.push(opts.onUtterance);
    let resolveReady;
    const readyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });
    // Resolve on the next tick so the route's `await dg.readyPromise`
    // completes and emits `ready` to the client.
    setImmediate(() => resolveReady());
    return {
      sendAudio: (bytes) => {
        const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
        calls.audioFrames.push(buf);
      },
      close: () => {
        calls.closed += 1;
      },
      isOpen: () => true,
      readyPromise,
    };
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

test("start → ready, audio frames forwarded, stop closes deepgram", async () => {
  const stub = makeDeepgramStub();
  const app = await build(
    { nodeEnv: "test", logLevel: "fatal", deepgramApiKey: "test-key" },
    { deepgramFactory: stub.factory }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // hello

    ws.send(JSON.stringify({ type: "start" }));
    const ready = await nextMessage();
    assert.equal(ready.type, "ready");
    assert.match(ready.sessionId, /^[0-9a-f-]{36}$/);
    assert.equal(stub.calls.created, 1);

    // Two 200ms PCM frames of zeros — 16000 * 0.2 * 2 = 6400 bytes
    const frame = Buffer.alloc(6400);
    ws.send(frame);
    ws.send(frame);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(stub.calls.audioFrames.length, 2);
    assert.equal(stub.calls.audioFrames[0].length, 6400);

    ws.send(JSON.stringify({ type: "stop" }));
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(stub.calls.closed, 1);
  } finally {
    ws.close();
    await app.close();
  }
});

test("rejects odd-length binary audio frames", async () => {
  const stub = makeDeepgramStub();
  const app = await build(
    { nodeEnv: "test", logLevel: "fatal", deepgramApiKey: "test-key" },
    { deepgramFactory: stub.factory }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // hello
    ws.send(JSON.stringify({ type: "start" }));
    await nextMessage(); // ready

    ws.send(Buffer.alloc(101)); // odd → should error
    const err = await nextMessage();
    assert.equal(err.type, "error");
    assert.equal(err.code, "bad_frame");
  } finally {
    ws.close();
    await app.close();
  }
});

test("start without DEEPGRAM_API_KEY emits no_api_key error", async () => {
  const stub = makeDeepgramStub();
  const app = await build(
    { nodeEnv: "test", logLevel: "fatal", deepgramApiKey: null },
    { deepgramFactory: stub.factory }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // hello
    ws.send(JSON.stringify({ type: "start" }));
    const err = await nextMessage();
    assert.equal(err.type, "error");
    assert.equal(err.code, "no_api_key");
    assert.equal(stub.calls.created, 0); // factory was NOT called
  } finally {
    ws.close();
    await app.close();
  }
});

test("INVARIANT: PII is redacted before utterance is broadcast", async () => {
  const stub = makeDeepgramStub();
  const app = await build(
    { nodeEnv: "test", logLevel: "fatal", deepgramApiKey: "test-key" },
    { deepgramFactory: stub.factory }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // hello
    ws.send(JSON.stringify({ type: "start" }));
    await nextMessage(); // ready

    // Simulate Deepgram emitting an utterance with PII payloads.
    const onUtt = stub.calls.onUtteranceRefs[0];
    onUtt({
      text:
        "My SSN is 123-45-6789, my card is 4111-1111-1111-1111, callback (954) 555-0142.",
      isFinal: true,
      speaker: 1,
      ts: 12.34,
      words: [],
    });

    const frame = await nextMessage();
    assert.equal(frame.type, "utterance");
    assert.equal(frame.final, true);
    assert.equal(frame.speaker, 1);
    assert.equal(frame.ts, 12.34);

    // The broadcast text MUST NOT contain any of the PII strings.
    assert.ok(!frame.text.includes("123-45-6789"), "SSN leaked");
    assert.ok(!frame.text.includes("4111-1111-1111-1111"), "card leaked");
    assert.ok(!frame.text.includes("(954) 555-0142"), "phone leaked");
    assert.ok(frame.text.includes("[REDACTED:SSN]"));
    assert.ok(frame.text.includes("[REDACTED:CC]"));
    assert.ok(frame.text.includes("[REDACTED:PHONE]"));

    assert.deepEqual(frame.redactionCounts, { ssn: 1, credit_card: 1, phone: 1 });
  } finally {
    ws.close();
    await app.close();
  }
});

test("clean utterance is broadcast unchanged with zero counts", async () => {
  const stub = makeDeepgramStub();
  const app = await build(
    { nodeEnv: "test", logLevel: "fatal", deepgramApiKey: "test-key" },
    { deepgramFactory: stub.factory }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // hello
    ws.send(JSON.stringify({ type: "start" }));
    await nextMessage(); // ready

    const onUtt = stub.calls.onUtteranceRefs[0];
    onUtt({
      text: "Maria, born 03/15/1952, takes Eliquis daily.",
      isFinal: true,
      speaker: 0,
      ts: 5,
      words: [],
    });

    const frame = await nextMessage();
    assert.equal(frame.text, "Maria, born 03/15/1952, takes Eliquis daily.");
    assert.deepEqual(frame.redactionCounts, { ssn: 0, credit_card: 0, phone: 0 });
  } finally {
    ws.close();
    await app.close();
  }
});

test("client disconnect closes Deepgram session", async () => {
  const stub = makeDeepgramStub();
  const app = await build(
    { nodeEnv: "test", logLevel: "fatal", deepgramApiKey: "test-key" },
    { deepgramFactory: stub.factory }
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  await opened;
  await nextMessage();
  ws.send(JSON.stringify({ type: "start" }));
  await nextMessage();
  ws.close();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(stub.calls.closed, 1);
  await app.close();
});
