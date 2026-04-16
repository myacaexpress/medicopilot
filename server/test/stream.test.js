/**
 * WSS /stream integration tests. Uses a real WebSocket client (ws)
 * against a locally-listening fastify instance on an ephemeral port.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { build } from "../src/index.js";

/** Open a ws connection and return a helper pair of promises. */
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
      if (messages.length) {
        resolve(messages.shift());
        return;
      }
      waiters.push(resolve);
    });
  const opened = new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return { ws, opened, nextMessage };
}

test("WSS /stream emits hello on connect and responds to ping", async () => {
  const app = await build({ nodeEnv: "test", logLevel: "fatal" });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;

    const hello = await nextMessage();
    assert.equal(hello.type, "hello");
    assert.match(hello.sessionId, /^[0-9a-f-]{36}$/);
    assert.ok(Date.parse(hello.serverTime));

    ws.send(JSON.stringify({ type: "ping", t: 123 }));
    const pong = await nextMessage();
    assert.equal(pong.type, "pong");
    assert.equal(pong.t, 123);

    ws.send(JSON.stringify({ type: "unknown" }));
    const err = await nextMessage();
    assert.equal(err.type, "error");
    assert.equal(err.code, "unknown_type");
  } finally {
    ws.close();
    await app.close();
  }
});

test("WSS /stream rejects non-JSON payloads", async () => {
  const app = await build({ nodeEnv: "test", logLevel: "fatal" });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address();

  const { ws, opened, nextMessage } = connect(`ws://127.0.0.1:${port}/stream`);
  try {
    await opened;
    await nextMessage(); // drain hello

    ws.send("not json");
    const err = await nextMessage();
    assert.equal(err.type, "error");
    assert.equal(err.code, "bad_json");
  } finally {
    ws.close();
    await app.close();
  }
});
