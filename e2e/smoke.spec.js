import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("smoke", () => {
  test("baseURL loads with no console errors and primary controls are visible", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await installAllMocks(page);
    await page.goto("/");

    // Header branding: TriBe mark in the desktop menu bar or mobile header.
    await expect(page.getByText(/MediCopilot/i).first()).toBeVisible();

    // Start Call button appears somewhere in the UI (Five9 window on
    // desktop, call-info / context-bar on mobile). The overlay may mask
    // the Five9 window, so don't require visibility — just presence.
    await expect(page.getByRole("button", { name: /Start Call/i }).first()).toHaveCount(1);

    // Capture Lead CTA appears in the LeadContextPanel.
    await expect(page.getByRole("button", { name: /Capture Lead/i }).first()).toBeVisible();

    // Give the app a beat to settle so any async console errors surface.
    await page.waitForTimeout(500);

    expect(consoleErrors, `unexpected console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
  });

  test("every visible button is interactive (not dead)", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Collect all visible buttons in the default view.
    const buttons = page.locator("button:visible");
    const count = await buttons.count();
    expect(count, "should have at least a few visible buttons").toBeGreaterThan(2);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const isDisabled = await btn.isDisabled();
      if (isDisabled) continue;

      // Enabled buttons must have pointer cursor — catches "button renders
      // but has no onClick" where cursor defaults to text/default.
      const cursor = await btn.evaluate((el) => getComputedStyle(el).cursor);
      const label = await btn.textContent();
      expect(
        cursor,
        `button "${label?.trim().slice(0, 40)}" should have cursor:pointer, got ${cursor}`
      ).toBe("pointer");
    }
  });
});
