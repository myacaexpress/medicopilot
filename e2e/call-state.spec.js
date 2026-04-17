import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("call lifecycle", () => {
  test("Start Call → active → End Call → ended", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Desktop viewport: Five9 mock hosts the primary Start Call button.
    await expect(page.getByRole("button", { name: /Start Call/i }).first()).toBeVisible();

    await page.getByRole("button", { name: /Start Call/i }).first().click();

    // Active state surfaces "CONNECTED" in the Five9 header.
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /End Call/i }).first()).toBeVisible();

    await page.getByRole("button", { name: /End Call/i }).first().click();

    // Ended state: Five9 flips to "CALL ENDED" and surfaces Start New Call.
    await expect(page.getByText(/CALL ENDED/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Start New Call/i }).first()).toBeVisible();
  });

  test("Ask AI during active call triggers a suggestion card", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Start a call so the WSS connects and handleAskAI takes the live path.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Wait for mock WSS to be open and ready.
    await page.waitForFunction(() => {
      const all = window.__mockWsInstances || [];
      return all.length > 0 && all[all.length - 1].readyState === 1;
    });

    // Click Ask AI — the mock WSS auto-responds to request_suggestion
    // with a suggestion_done containing a "sayThis" field.
    await page.getByRole("button", { name: /Ask AI/i }).first().click();

    // A live suggestion card should appear within 5 seconds. The card
    // renders the suggestion's sayThis text.
    await expect(
      page.getByText(/recommend reviewing/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("Ask AI without active call shows a helpful toast", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Do NOT start a call. Click Ask AI directly.
    await page.getByRole("button", { name: /Ask AI/i }).first().click();

    // Should show a toast with "Start a call first" instead of silently
    // doing nothing.
    await expect(
      page.getByText(/start a call first/i).first()
    ).toBeVisible({ timeout: 3000 });
  });
});
