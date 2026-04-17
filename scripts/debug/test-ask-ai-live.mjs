/**
 * End-to-end regression test for the Ask AI pipeline.
 *
 * Launches Chromium with a fake mic (synthesized speech), opens
 * medicopilot.vercel.app, clicks Start Call, waits for transcription,
 * clicks Ask AI, and reports whether a suggestion card or error
 * toast appeared.
 *
 * Usage:
 *   node scripts/debug/test-ask-ai-live.mjs
 *
 * Prerequisites:
 *   - Playwright installed (npx playwright install chromium)
 *   - scripts/debug/sample.wav exists (generated via macOS `say`)
 *   - Fly server healthy (curl https://medicopilot-myacaexpress.fly.dev/health)
 */

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_WAV = resolve(__dirname, "sample.wav");
const OUT_DIR = resolve(__dirname, "screenshots");
const URL = "https://medicopilot.vercel.app";

// Generate sample.wav if missing
if (!existsSync(SAMPLE_WAV)) {
  console.log("Generating sample.wav via macOS say...");
  execSync(
    `say -o "${SAMPLE_WAV}" --data-format=LEF32@16000 "Hello, my name is Maria Garcia. I take Eliquis for blood thinning and I live in Pembroke Pines Florida."`,
  );
}

execSync(`mkdir -p "${OUT_DIR}"`);

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-audio-capture=${SAMPLE_WAV}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["microphone"],
});
const page = await context.newPage();

// ── Collectors ──────────────────────────────────────────────────
const consoleLogs = [];
const wsMessages = [];
const networkErrors = [];

page.on("console", (msg) => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on("pageerror", (err) => {
  consoleLogs.push(`[pageerror] ${err.message}`);
});

// Intercept WebSocket traffic
await page.addInitScript(() => {
  const OrigWS = window.WebSocket;
  window._wsLog = [];
  window.WebSocket = function (...args) {
    window._wsLog.push({ dir: "→", type: "create", url: args[0] });
    const ws = new OrigWS(...args);
    const origSend = ws.send.bind(ws);
    ws.send = function (data) {
      if (typeof data === "string") {
        window._wsLog.push({ dir: "→", data });
      } else {
        window._wsLog.push({
          dir: "→",
          type: "binary",
          size: data.byteLength || data.length,
        });
      }
      return origSend(data);
    };
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") {
        window._wsLog.push({ dir: "←", data: ev.data.substring(0, 500) });
      }
    });
    ws.addEventListener("close", (ev) => {
      window._wsLog.push({ dir: "←", type: "close", code: ev.code });
    });
    ws.addEventListener("error", () => {
      window._wsLog.push({ dir: "←", type: "error" });
    });
    return ws;
  };
  window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.OPEN = OrigWS.OPEN;
  window.WebSocket.CLOSING = OrigWS.CLOSING;
  window.WebSocket.CLOSED = OrigWS.CLOSED;
});

// Track failed network requests
page.on("response", (resp) => {
  if (resp.status() >= 400) {
    networkErrors.push(`${resp.status()} ${resp.url()}`);
  }
});

// ── Step 1: Load page ───────────────────────────────────────────
console.log("1. Loading", URL);
await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/01-loaded.png` });
console.log("   → Screenshot: 01-loaded.png");

// ── Step 2: Start Call ──────────────────────────────────────────
console.log("2. Clicking Start Call...");
await page.locator("button", { hasText: "START CALL" }).first().click();
console.log("   → Waiting 12s for fake mic audio + Deepgram transcription...");
await page.waitForTimeout(12000);
await page.screenshot({ path: `${OUT_DIR}/02-after-start-call.png` });
console.log("   → Screenshot: 02-after-start-call.png");

// ── Step 2b: Wait for utterances to arrive via WSS ──────────────
console.log("   → Polling for utterances in WSS log...");
let utteranceCount = 0;
for (let i = 0; i < 30; i++) {
  utteranceCount = await page.evaluate(
    () => (window._wsLog || []).filter((m) => m.dir === "←" && m.data && m.data.includes('"utterance"')).length,
  );
  if (utteranceCount >= 2) break;
  await page.waitForTimeout(1000);
}
console.log(`   → ${utteranceCount} utterances received before clicking Ask AI`);

// ── Step 3: Ask AI ──────────────────────────────────────────────
console.log("3. Clicking Ask AI...");
await page.locator("button", { hasText: "Ask AI" }).first().click();
console.log("   → Waiting 15s for suggestion response...");
await page.waitForTimeout(15000);
await page.screenshot({ path: `${OUT_DIR}/03-after-ask-ai.png` });
console.log("   → Screenshot: 03-after-ask-ai.png");

// ── Collect results ─────────────────────────────────────────────
const wsLog = await page.evaluate(() => window._wsLog || []);
const bodyText = await page.locator("body").innerText();

// Check for suggestion card
const sayThisMatches = bodyText.match(/SAY THIS:/g) || [];
const hasSuggestionCard = sayThisMatches.length > 1; // 1 is the demo card

// Check for toast
const toastText = bodyText.match(
  /Say something first|No transcript|Ask AI needs|Suggestion failed|unavailable/i,
);

// Check for new live suggestion content
const hasLiveContent = bodyText.includes("Live ·");

// Filter WSS messages
const wsSent = wsLog.filter((m) => m.dir === "→" && m.data);
const wsRecv = wsLog.filter((m) => m.dir === "←" && m.data);
const wsRecvParsed = wsRecv.map((m) => {
  try {
    return JSON.parse(m.data);
  } catch {
    return m.data;
  }
});

const utterances = wsRecvParsed.filter((m) => m.type === "utterance");
const suggestionFrames = wsRecvParsed.filter((m) =>
  typeof m.type === "string" && m.type.startsWith("suggestion_"),
);
const errors = wsRecvParsed.filter((m) => m.type === "error");

await browser.close();

// ── Report ──────────────────────────────────────────────────────
console.log("\n" + "═".repeat(60));
console.log("  ASK AI LIVE REGRESSION TEST — RESULTS");
console.log("═".repeat(60));

console.log("\n📸 Screenshots:");
console.log(`   ${OUT_DIR}/01-loaded.png`);
console.log(`   ${OUT_DIR}/02-after-start-call.png`);
console.log(`   ${OUT_DIR}/03-after-ask-ai.png`);

console.log("\n🎙️  Transcription:");
console.log(`   Utterances received: ${utterances.length}`);
for (const u of utterances.slice(0, 5)) {
  console.log(`     [${u.speaker}] "${u.text}"`);
}

console.log("\n🤖 Suggestion:");
if (suggestionFrames.length > 0) {
  const done = suggestionFrames.find((f) => f.type === "suggestion_done");
  const err = suggestionFrames.find((f) => f.type === "suggestion_error");
  if (done) {
    console.log("   ✅ YES — suggestion_done received");
    const say =
      done.suggestion?.primary ||
      done.suggestion?.sayThis ||
      JSON.stringify(done.suggestion).substring(0, 200);
    console.log(`   Text: "${say}"`);
  } else if (err) {
    console.log(`   ❌ NO — suggestion_error: ${err.code} — ${err.message}`);
  } else {
    console.log(
      `   ⏳ Streaming (${suggestionFrames.length} frames, no done/error yet)`,
    );
  }
} else {
  console.log("   ❌ NO — no suggestion frames received");
}

console.log("\n🍞 Toast:");
console.log(
  toastText
    ? `   YES — "${toastText[0]}"`
    : "   NO — no error toast visible",
);

console.log("\n📡 WSS Messages:");
console.log(`   Sent: ${wsSent.length} control messages`);
for (const m of wsSent) {
  try {
    console.log(`     → ${JSON.parse(m.data).type}`);
  } catch {
    console.log(`     → ${m.data.substring(0, 80)}`);
  }
}
console.log(`   Received: ${wsRecv.length} messages`);
for (const m of wsRecvParsed.slice(0, 15)) {
  const t = typeof m === "object" ? m.type : m;
  console.log(`     ← ${t}`);
}

console.log("\n🔴 Server errors via WSS:");
console.log(
  errors.length
    ? errors.map((e) => `   ${e.code}: ${e.message}`).join("\n")
    : "   (none)",
);

console.log("\n🔴 Network errors:");
console.log(
  networkErrors.length
    ? networkErrors.map((e) => `   ${e}`).join("\n")
    : "   (none)",
);

const consoleErrors = consoleLogs.filter(
  (l) =>
    l.startsWith("[error]") ||
    l.startsWith("[pageerror]"),
);
console.log("\n🔴 Console errors:");
console.log(
  consoleErrors.length
    ? consoleErrors.map((e) => `   ${e}`).join("\n")
    : "   (none)",
);

console.log("\n" + "═".repeat(60));
const pass =
  utterances.length > 0 &&
  suggestionFrames.some((f) => f.type === "suggestion_done");
console.log(pass ? "  ✅ PASS — Ask AI pipeline works end-to-end" : "  ❌ FAIL — see details above");
console.log("═".repeat(60) + "\n");

process.exit(pass ? 0 : 1);
