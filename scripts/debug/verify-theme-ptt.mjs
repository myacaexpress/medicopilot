import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "scripts/debug/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("pageerror", (err) => errors.push(err.message));

await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// 1 — Default state (training OFF)
await page.screenshot({ path: `${OUT}/01-default.png` });
console.log("1. Default state saved");

// 2 — Toggle training ON
const toggle = page.getByTestId("training-toggle").first();
await toggle.click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-training-on.png` });
console.log("2. Training ON saved");

// 3 — Assert primary button colors are orange
const askAiColor = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const askAi = btns.find(b => b.textContent.includes("Ask AI"));
  if (!askAi) return { error: "Ask AI button not found" };
  const cs = getComputedStyle(askAi);
  return { background: cs.background, backgroundColor: cs.backgroundColor };
});
console.log("3. Ask AI button:", JSON.stringify(askAiColor));

const sendBtnColor = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const send = btns.find(b => {
    const cs = getComputedStyle(b);
    return cs.backgroundColor.includes("255") && cs.backgroundColor.includes("138");
  });
  if (!send) {
    // Check for teal-colored send buttons that should be orange
    const tealSend = btns.find(b => {
      const cs = getComputedStyle(b);
      return cs.backgroundColor.includes("0, 123, 127") || cs.backgroundColor === "rgb(0, 123, 127)";
    });
    return { found: false, stillTeal: !!tealSend };
  }
  return { found: true, bg: getComputedStyle(send).backgroundColor };
});
console.log("4. Send button orange check:", JSON.stringify(sendBtnColor));

// Check all teal/green colors in the overlay — look for any remaining rgb(0,123,127) or rgb(52,199,123)
const tealCheck = await page.evaluate(() => {
  const overlay = document.querySelector('[data-testid="training-toggle"]')?.closest('[style]');
  if (!overlay) return { error: "overlay not found" };
  const all = overlay.querySelectorAll("*");
  const tealElements = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    const styles = [cs.color, cs.backgroundColor, cs.borderColor, cs.borderLeftColor];
    for (const s of styles) {
      if (s.includes("0, 123, 127") || s.includes("52, 199, 123")) {
        tealElements.push({
          tag: el.tagName,
          text: el.textContent?.substring(0, 30),
          style: s,
          prop: styles.indexOf(s) === 0 ? "color" : styles.indexOf(s) === 1 ? "bg" : "border",
        });
      }
    }
  }
  return { tealCount: tealElements.length, samples: tealElements.slice(0, 10) };
});
console.log("5. Remaining teal in overlay:", JSON.stringify(tealCheck, null, 2));

// 4 — Start a call
await page.getByRole("button", { name: /Start Call/i }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/03-training-call-active.png` });
console.log("6. Training + active call saved");

// 5 — Check PTT button visibility
const pttVisible = await page.getByTestId("ptt-mic-button").first().isVisible().catch(() => false);
console.log("7. PTT mic button visible:", pttVisible);

const pttHintVisible = await page.getByTestId("ptt-hint").first().isVisible().catch(() => false);
console.log("8. PTT hint visible:", pttHintVisible);

// 6 — Hold Space bar
await page.keyboard.down("Space");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/04-ptt-held.png` });

const pttIndicator = await page.getByTestId("ptt-indicator").first().textContent().catch(() => null);
console.log("9. PTT indicator text:", pttIndicator);

await page.keyboard.up("Space");
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/05-ptt-released.png` });

const pttIndicatorAfter = await page.getByTestId("ptt-indicator").first().textContent().catch(() => null);
console.log("10. PTT indicator after release:", pttIndicatorAfter);

// Summary
console.log("\n=== SUMMARY ===");
const askAiBgHasOrange = askAiColor.background?.includes("255") || askAiColor.background?.includes("138");
console.log(`Ask AI button orange: ${askAiBgHasOrange ? "YES" : "NO — still teal!"}`);
console.log(`PTT mic button visible: ${pttVisible ? "YES" : "NO"}`);
console.log(`PTT hint visible: ${pttHintVisible ? "YES" : "NO"}`);
console.log(`Space bar → Agent speaking: ${pttIndicator === "Agent speaking" ? "YES" : "NO — got: " + pttIndicator}`);
console.log(`Space release → Client speaking: ${pttIndicatorAfter === "Client speaking" ? "YES" : "NO — got: " + pttIndicatorAfter}`);
if (tealCheck.tealCount > 0) console.log(`WARNING: ${tealCheck.tealCount} elements still have teal colors`);
if (errors.length) console.log(`Console errors: ${errors.join("; ")}`);

await browser.close();
