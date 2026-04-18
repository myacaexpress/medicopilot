import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("training mode", () => {
  test("training pill toggles in header", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    const toggle = page.getByTestId("training-toggle").first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("Training");
    await toggle.click();
    await expect(toggle).toContainText("TRAINING");
    await toggle.click();
    await expect(toggle).toContainText("Training");
  });

  test("training pill visible during active call", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Start a regular (non-training) call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    const toggle = page.getByTestId("training-toggle").first();
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(toggle).toContainText("TRAINING");
  });

  test("training mode persists across call end", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("trainingTesterName", "Tester");
    });
    await installAllMocks(page);
    await page.goto("/");

    const toggle = page.getByTestId("training-toggle").first();
    await toggle.click();
    await expect(toggle).toContainText("TRAINING");

    // Start training call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await page.getByTestId("scenario-free").click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // End the call.
    await page.getByRole("button", { name: /End Call/i }).first().click();
    await expect(page.getByText(/CALL ENDED/i).first()).toBeVisible();

    // Training should still be ON.
    await expect(toggle).toContainText("TRAINING");
  });
});

test.describe("solo toggle (replaces push-to-talk)", () => {
  test("solo toggle visible in training mode during call", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("trainingTesterName", "Tester");
    });
    await installAllMocks(page);
    await page.goto("/");

    await page.getByTestId("training-toggle").first().click();
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await page.getByTestId("scenario-free").click();

    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Solo toggle buttons should be visible.
    await expect(page.getByTestId("solo-role-agent").first()).toBeVisible();
    await expect(page.getByTestId("solo-role-client").first()).toBeVisible();
    await expect(page.getByTestId("solo-toggle-hint").first()).toBeVisible();
  });

  test("space bar toggles between agent and client", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("trainingTesterName", "Tester");
    });
    await installAllMocks(page);
    await page.goto("/");

    await page.getByTestId("training-toggle").first().click();
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await page.getByTestId("scenario-free").click();

    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Solo toggle should be visible.
    await expect(page.getByTestId("solo-role-agent").first()).toBeVisible();

    // Press space to toggle to client.
    await page.keyboard.press("Space");

    // Press space again to toggle back to agent.
    await page.keyboard.press("Space");
  });

  test("solo toggle not visible without training mode", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Solo toggle should NOT be visible in regular call mode.
    await expect(page.getByTestId("solo-toggle")).not.toBeVisible();
  });
});
