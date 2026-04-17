import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "fs";
import { resolve } from "path";

const OUT = "scripts/debug/screenshots";
mkdirSync(OUT, { recursive: true });

// Read and inline the mock fixtures
const mockWssCode = readFileSync(resolve("e2e/fixtures/mockWss.js"), "utf-8");
const mockMediaCode = readFileSync(resolve("e2e/fixtures/mockMediaDevices.js"), "utf-8");
const mockApiCode = readFileSync(resolve("e2e/fixtures/mockApi.js"), "utf-8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Install mocks before navigating (same as e2e fixtures)
// Extract and run the init script content from installWssMock
await page.addInitScript(() => {
  const OPEN = 1;
  const CLOSED = 3;
  class MockWebSocket extends EventTarget {
    constructor(url, protocols) {
      super();
      this.url = url;
      this.protocols = protocols;
      this.readyState = 0;
      this.binaryType = "blob";
      this.sent = [];
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      (window.__mockWsInstances ??= []).push(this);
      setTimeout(() => {
        this.readyState = OPEN;
        this._fire("open", new Event("open"));
        if (window.__mockWssAutoReady) {
          this._emitRaw({ type: "hello", sessionId: "mock-session", serverTime: Date.now() });
          this._emitRaw({ type: "ready", sessionId: "mock-session" });
        }
      }, 0);
    }
    _fire(name, event) {
      const handler = this["on" + name];
      if (typeof handler === "function") { try { handler.call(this, event); } catch {} }
      this.dispatchEvent(event);
    }
    _emitRaw(msg) {
      if (this.readyState !== OPEN) return false;
      const data = typeof msg === "string" ? msg : JSON.stringify(msg);
      this._fire("message", new MessageEvent("message", { data }));
      return true;
    }
    send(data) { this.sent.push(data); }
    close() { if (this.readyState === CLOSED) return; this.readyState = CLOSED; this._fire("close", new CloseEvent("close", { code: 1000 })); }
  }
  MockWebSocket.CONNECTING = 0; MockWebSocket.OPEN = 1; MockWebSocket.CLOSING = 2; MockWebSocket.CLOSED = 3;
  window.WebSocket = MockWebSocket;
  window.__mockWssAutoReady = true;
  window.__mockWssLatest = () => (window.__mockWsInstances || []).at(-1) || null;
  window.__mockWssEmit = (msg) => { const s = window.__mockWssLatest(); return s ? s._emitRaw(msg) : false; };
});

// Mock media devices
await page.addInitScript(() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator(); osc.frequency.value = 0; osc.start();
  const dest = ctx.createMediaStreamDestination();
  osc.connect(dest);
  const fakeStream = dest.stream;
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(fakeStream);
  navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(fakeStream);
});

await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Toggle training ON
await page.getByTestId("training-toggle").first().click();
await page.waitForTimeout(300);

// Start a call
await page.getByRole("button", { name: /Start Call/i }).first().click();
await page.waitForTimeout(1500);

// Inject utterances simulating a PTT-driven conversation
// Client speaking (PTT not held)
await page.evaluate(() => window.__mockWssEmit({
  type: "utterance", sessionId: "mock-session", final: true,
  speaker: "client", text: "Hi, I'm calling about my Medicare options.", ts: "2:01",
}));
await page.waitForTimeout(200);

// Agent speaking (PTT held)
await page.keyboard.down("Space");
await page.waitForTimeout(150);
await page.evaluate(() => window.__mockWssEmit({
  type: "utterance", sessionId: "mock-session", final: true,
  speaker: "agent", text: "Good afternoon! I'm James with Trifecta Benefits.", ts: "2:01",
}));
await page.waitForTimeout(200);
await page.keyboard.up("Space");
await page.waitForTimeout(150);

// Client again
await page.evaluate(() => window.__mockWssEmit({
  type: "utterance", sessionId: "mock-session", final: true,
  speaker: "client", text: "I need help understanding Part D coverage.", ts: "2:02",
}));
await page.waitForTimeout(200);

// Agent again
await page.keyboard.down("Space");
await page.waitForTimeout(150);
await page.evaluate(() => window.__mockWssEmit({
  type: "utterance", sessionId: "mock-session", final: true,
  speaker: "agent", text: "Absolutely, let me pull up plans in your area.", ts: "2:02",
}));
await page.waitForTimeout(200);
await page.keyboard.up("Space");
await page.waitForTimeout(200);

// Screenshot with alternating speakers
await page.screenshot({ path: `${OUT}/06-ptt-alternating-speakers.png` });
console.log("Saved 06-ptt-alternating-speakers.png");

// Screenshot with PTT held (agent speaking state)
await page.keyboard.down("Space");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/07-ptt-agent-speaking.png` });

const indicator = await page.getByTestId("ptt-indicator").first().textContent();
console.log("PTT indicator (held):", indicator);
await page.keyboard.up("Space");
await page.waitForTimeout(200);

const indicatorReleased = await page.getByTestId("ptt-indicator").first().textContent();
console.log("PTT indicator (released):", indicatorReleased);

// Verify the sent messages include ptt_state and set_training_mode
const sentMessages = await page.evaluate(() => {
  const sock = window.__mockWssLatest();
  if (!sock) return [];
  return sock.sent.filter(s => typeof s === "string").map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
});
const pttMessages = sentMessages.filter(m => m.type === "ptt_state");
const trainingMessages = sentMessages.filter(m => m.type === "set_training_mode");
console.log(`\nWSS messages sent by client:`);
console.log(`  set_training_mode: ${trainingMessages.length} (last: ${JSON.stringify(trainingMessages.at(-1))})`);
console.log(`  ptt_state: ${pttMessages.length} messages`);
pttMessages.forEach((m, i) => console.log(`    [${i}] speaking=${m.speaking}`));

await browser.close();
console.log("\nDone");
