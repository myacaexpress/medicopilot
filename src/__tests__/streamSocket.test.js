/**
 * Tests for src/audio/streamSocket.js — the WSS client for the live-call
 * pipeline. Uses an in-memory FakeWebSocket + injectable timer functions
 * so reconnect/backoff/buffer-replay invariants can be verified
 * synchronously without any real network or sleep.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { StreamSocket } from "../audio/streamSocket.js";
import { BYTES_PER_FRAME } from "../audio/pcm.js";

// ─── Fake WebSocket + manual scheduler ───

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.binaryType = null;
    this.readyState = 0; // CONNECTING
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    FakeWebSocket.instances.push(this);
  }
  send(payload) {
    if (this.readyState !== 1) throw new Error("send on non-open socket");
    this.sent.push(payload);
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
  // ─── test helpers ───
  open() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }
  receiveJSON(obj) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
  }
  serverClose() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
  jsonSends() {
    return this.sent
      .filter((s) => typeof s === "string")
      .map((s) => JSON.parse(s));
  }
  binarySends() {
    return this.sent.filter((s) => typeof s !== "string");
  }
}
FakeWebSocket.instances = [];

class FakeScheduler {
  constructor() {
    this.tasks = [];
    this.now = 0;
    this.nextHandle = 1;
    // Match the standard setTimeout signature: (callback, ms).
    this.set = (fn, ms) => {
      const handle = this.nextHandle++;
      this.tasks.push({ handle, dueAt: this.now + ms, fn });
      this.tasks.sort((a, b) => a.dueAt - b.dueAt);
      return handle;
    };
    this.clear = (handle) => {
      this.tasks = this.tasks.filter((t) => t.handle !== handle);
    };
  }
  /** Advance time by `ms` and synchronously fire any due tasks. */
  advance(ms) {
    this.now += ms;
    while (this.tasks.length && this.tasks[0].dueAt <= this.now) {
      const { fn } = this.tasks.shift();
      fn();
    }
  }
  pending() {
    return this.tasks.length;
  }
}

function makeFrame(bytes = BYTES_PER_FRAME) {
  return new ArrayBuffer(bytes);
}

function makeSocket(opts = {}) {
  FakeWebSocket.instances = [];
  const scheduler = new FakeScheduler();
  const sock = new StreamSocket({
    url: "wss://test/stream",
    WebSocketImpl: FakeWebSocket,
    setTimeoutImpl: scheduler.set,
    clearTimeoutImpl: scheduler.clear,
    baseBackoffMs: 1000,
    maxBackoffMs: 30000,
    bufferDurationMs: 600, // small buffer for ring-overflow tests (3 frames @ 200ms)
    ...opts,
  });
  return { sock, scheduler };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
});

describe("connection lifecycle", () => {
  it("opens, transitions through connecting → connected, and tracks state events", () => {
    const { sock } = makeSocket();
    const states = [];
    sock.addEventListener("stateChange", (e) => states.push(e.detail));
    sock.connect();
    expect(states).toEqual(["connecting"]);
    FakeWebSocket.instances[0].open();
    expect(states).toEqual(["connecting", "connected"]);
    expect(sock.state).toBe("connected");
  });

  it("emits hello, ready, utterance from server messages", () => {
    const { sock } = makeSocket();
    const seen = { hello: null, ready: null, utterance: null };
    sock.addEventListener("hello", (e) => (seen.hello = e.detail));
    sock.addEventListener("ready", (e) => (seen.ready = e.detail));
    sock.addEventListener("utterance", (e) => (seen.utterance = e.detail));
    sock.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.receiveJSON({ type: "hello", sessionId: "abc", serverTime: "2026-04-16" });
    ws.receiveJSON({ type: "ready", sessionId: "abc" });
    ws.receiveJSON({ type: "utterance", final: true, speaker: 0, text: "hello world", ts: 1 });
    expect(seen.hello.sessionId).toBe("abc");
    expect(seen.ready.sessionId).toBe("abc");
    expect(seen.utterance.text).toBe("hello world");
  });

  it("disconnect() sends bye, closes, and clears state", () => {
    const { sock } = makeSocket();
    sock.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    sock.startAudio();
    sock.disconnect();
    const jsons = ws.jsonSends();
    expect(jsons.some((m) => m.type === "bye")).toBe(true);
    expect(sock.state).toBe("disconnected");
  });
});

describe("audio control + frame buffering", () => {
  it("startAudio sends a start frame once connected", () => {
    const { sock } = makeSocket();
    sock.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    sock.startAudio();
    expect(ws.jsonSends().some((m) => m.type === "start")).toBe(true);
  });

  it("buffers PCM frames until server is ready, then flushes them in order", () => {
    const { sock } = makeSocket();
    sock.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    sock.startAudio();

    const f1 = makeFrame();
    const f2 = makeFrame();
    sock.sendFrame(f1);
    sock.sendFrame(f2);
    expect(ws.binarySends()).toHaveLength(0);
    expect(sock.bufferedFrameCount()).toBe(2);

    ws.receiveJSON({ type: "ready", sessionId: "x" });
    expect(ws.binarySends()).toHaveLength(2);
    expect(sock.bufferedFrameCount()).toBe(0);
  });

  it("sendFrame rejects odd-length frames with a streamError event", () => {
    const { sock } = makeSocket();
    const errs = [];
    sock.addEventListener("streamError", (e) => errs.push(e.detail));
    sock.connect();
    FakeWebSocket.instances[0].open();
    sock.sendFrame(new ArrayBuffer(7));
    expect(errs).toHaveLength(1);
    expect(errs[0].code).toBe("bad_frame");
  });

  it("ring buffer drops the oldest frame when full and tracks the count", () => {
    // bufferDurationMs=600, frameMs=200 → maxBufferFrames=3
    const { sock } = makeSocket();
    sock.connect();
    FakeWebSocket.instances[0].open();
    sock.startAudio();
    // Send 5 frames before ready — only the last 3 should remain.
    for (let i = 0; i < 5; i++) sock.sendFrame(makeFrame());
    expect(sock.bufferedFrameCount()).toBe(3);
    expect(sock.droppedFrames).toBe(2);
  });
});

describe("reconnect-with-backoff + replay", () => {
  it("schedules reconnects with exponential backoff and re-sends start + buffered frames", () => {
    const { sock, scheduler } = makeSocket();
    const states = [];
    sock.addEventListener("stateChange", (e) => states.push(e.detail));
    sock.connect();
    let ws = FakeWebSocket.instances[0];
    ws.open();
    sock.startAudio();
    ws.receiveJSON({ type: "ready", sessionId: "s1" });

    // Buffer two frames AFTER ready (these flush immediately) and confirm.
    sock.sendFrame(makeFrame());
    sock.sendFrame(makeFrame());
    expect(ws.binarySends()).toHaveLength(2);

    // Server-side close. Ring buffer should be empty (everything was sent),
    // but we need to ensure new frames during the outage are buffered for
    // replay on reconnect.
    ws.serverClose();
    expect(states).toContain("reconnecting");
    expect(scheduler.pending()).toBe(1);

    // While disconnected, queue 2 more frames — they should be buffered.
    sock.sendFrame(makeFrame());
    sock.sendFrame(makeFrame());
    expect(sock.bufferedFrameCount()).toBe(2);

    // Backoff: attempt 1 → 1000ms.
    scheduler.advance(1000);
    let ws2 = FakeWebSocket.instances[1];
    expect(ws2).toBeDefined();
    ws2.open();

    // Reconnect should auto-re-send `start` because audioActive=true.
    expect(ws2.jsonSends().some((m) => m.type === "start")).toBe(true);

    // Once the new server flips us back to ready, the 2 queued frames flush.
    ws2.receiveJSON({ type: "ready", sessionId: "s2" });
    expect(ws2.binarySends()).toHaveLength(2);
  });

  it("backoff doubles on successive failures up to maxBackoffMs", () => {
    const { sock, scheduler } = makeSocket();
    sock.connect();

    // Helper: simulate the server rejecting the new socket before it
    // opens. (Calling open() first would reset attempt to 0, masking the
    // backoff growth we're trying to assert.)
    const failConnect = () => {
      const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
      ws.serverClose();
    };

    // Attempt 1: open → close → schedule 1000
    failConnect();
    expect(scheduler.tasks[0].dueAt - scheduler.now).toBe(1000);
    scheduler.advance(1000);

    // Attempt 2: open → close → schedule 2000
    failConnect();
    expect(scheduler.tasks[0].dueAt - scheduler.now).toBe(2000);
    scheduler.advance(2000);

    // Attempt 3 → 4000
    failConnect();
    expect(scheduler.tasks[0].dueAt - scheduler.now).toBe(4000);
    scheduler.advance(4000);

    // Attempt 4 → 8000
    failConnect();
    expect(scheduler.tasks[0].dueAt - scheduler.now).toBe(8000);
  });

  it("disconnect() cancels a pending reconnect", () => {
    const { sock, scheduler } = makeSocket();
    sock.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.serverClose();
    expect(scheduler.pending()).toBe(1);
    sock.disconnect();
    expect(scheduler.pending()).toBe(0);
    expect(sock.state).toBe("disconnected");
  });
});

describe("startAudio idempotency + stopAudio", () => {
  it("stopAudio sends stop and clears the buffer", () => {
    const { sock } = makeSocket();
    sock.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    sock.startAudio();
    sock.sendFrame(makeFrame());
    expect(sock.bufferedFrameCount()).toBe(1);
    sock.stopAudio();
    expect(ws.jsonSends().some((m) => m.type === "stop")).toBe(true);
    expect(sock.bufferedFrameCount()).toBe(0);
  });
});
