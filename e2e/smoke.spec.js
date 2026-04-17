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
});
