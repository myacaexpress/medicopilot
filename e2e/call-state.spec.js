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
});
