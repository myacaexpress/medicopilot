import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("training mode", () => {
  test("training pill toggles in header", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Toggle is always visible in the overlay header — no tab navigation needed.
    const toggle = page.getByTestId("training-toggle").first();
    await expect(toggle).toBeVisible();

    // Initially OFF — pill shows "Training" (lowercase).
    await expect(toggle).toContainText("Training");

    // Click toggle → ON — pill shows "TRAINING" (uppercase).
    await toggle.click();
    await expect(toggle).toContainText("TRAINING");

    // Click toggle → OFF again.
    await toggle.click();
    await expect(toggle).toContainText("Training");
  });

  test("training pill visible during active call", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Start a regular call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Toggle should still be visible and interactive in the header.
    const toggle = page.getByTestId("training-toggle").first();
    await expect(toggle).toBeVisible();

    // Can flip training ON mid-call.
    await toggle.click();
    await expect(toggle).toContainText("TRAINING");
  });

  test("training mode persists across call end", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Toggle training ON.
    const toggle = page.getByTestId("training-toggle").first();
    await toggle.click();
    await expect(toggle).toContainText("TRAINING");

    // Start and end a call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();
    await page.getByRole("button", { name: /End Call/i }).first().click();
    await expect(page.getByText(/CALL ENDED/i).first()).toBeVisible();

    // Training should still be ON — persists per-session, not per-call.
    await expect(toggle).toContainText("TRAINING");
  });
});

test.describe("push-to-talk", () => {
  test("push-to-talk controls visible in training mode during call", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Turn on training mode via header pill.
    await page.getByTestId("training-toggle").first().click();

    // Start a call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // PTT mic button and hint should be visible.
    await expect(page.getByTestId("ptt-mic-button").first()).toBeVisible();
    await expect(page.getByTestId("ptt-hint").first()).toBeVisible();

    // PTT indicator should show "Client speaking" (not held).
    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Client speaking");
  });

  test("space bar toggles push-to-talk indicator", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Turn on training mode via header pill.
    await page.getByTestId("training-toggle").first().click();

    // Start call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Default: "Client speaking".
    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Client speaking");

    // Hold space → "Agent speaking".
    await page.keyboard.down("Space");
    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Agent speaking");

    // Hint should disappear after first use.
    await expect(page.getByTestId("ptt-hint")).not.toBeVisible();

    // Release space → back to "Client speaking".
    await page.keyboard.up("Space");
    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Client speaking");
  });

  test("push-to-talk not visible without training mode", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Start a regular call (no training).
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // PTT controls should NOT be visible.
    await expect(page.getByTestId("ptt-mic-button")).not.toBeVisible();
    await expect(page.getByTestId("ptt-indicator")).not.toBeVisible();
  });
});
