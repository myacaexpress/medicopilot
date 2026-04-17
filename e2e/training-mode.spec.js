import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("training mode", () => {
  test("training toggle flips theme + badge", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Navigate to Call Info tab to find the training toggle.
    await page.getByText("Call Info").first().click();

    const toggle = page.getByTestId("training-toggle").first();
    await expect(toggle).toBeVisible();

    // Initially OFF — no TRAINING badge in the header.
    // The badge is a span with exact text "TRAINING" (not "Training Mode").
    await expect(page.getByText("TRAINING", { exact: true })).not.toBeVisible();

    // Click toggle → ON.
    await toggle.click();

    // Start a call in training mode (use Five9 Start Call button).
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // TRAINING badge should appear in the header.
    await expect(page.getByText("TRAINING", { exact: true }).first()).toBeVisible();

    // Title should say "MediCopilot — Training".
    await expect(page.getByText(/MediCopilot — Training/).first()).toBeVisible();
  });

  test("training toggle hidden during active call", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Start a regular call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Switch to Call Info — toggle should not be visible during active call.
    await page.getByText("Call Info").first().click();
    await expect(page.getByTestId("training-toggle")).not.toBeVisible();
  });

  test("training mode resets on call end", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Navigate to Call Info and toggle training ON.
    await page.getByText("Call Info").first().click();
    await page.getByTestId("training-toggle").first().click();

    // Start and end a call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();
    await page.getByRole("button", { name: /End Call/i }).first().click();
    await expect(page.getByText(/CALL ENDED/i).first()).toBeVisible();

    // Training badge should be gone — mode resets on call end.
    await expect(page.getByText("TRAINING", { exact: true })).not.toBeVisible();
  });
});

test.describe("push-to-talk", () => {
  test("push-to-talk controls visible in training mode during call", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Navigate to Call Info and turn on training mode.
    await page.getByText("Call Info").first().click();
    await page.getByTestId("training-toggle").first().click();

    // Start a call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Switch to Transcript panel to see PTT controls.
    await page.getByText("Transcript", { exact: true }).first().click();

    // PTT mic button and hint should be visible.
    await expect(page.getByTestId("ptt-mic-button").first()).toBeVisible();
    await expect(page.getByTestId("ptt-hint").first()).toBeVisible();

    // PTT indicator should show "Client speaking" (not held).
    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Client speaking");
  });

  test("space bar toggles push-to-talk indicator", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Navigate to Call Info and turn on training mode.
    await page.getByText("Call Info").first().click();
    await page.getByTestId("training-toggle").first().click();

    // Start call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Switch to Transcript panel.
    await page.getByText("Transcript", { exact: true }).first().click();

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
