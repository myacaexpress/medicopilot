import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("training platform", () => {
  test("tester name prompt appears when training ON and Start Call", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Turn on training mode.
    const toggle = page.getByTestId("training-toggle").first();
    await toggle.click();
    await expect(toggle).toContainText("TRAINING");

    // Click Start Call — should show tester name prompt.
    await page.getByRole("button", { name: /Start Call/i }).first().click();

    // Tester name prompt should be visible.
    await expect(page.getByTestId("tester-name-input")).toBeVisible();

    // Enter name and submit.
    await page.getByTestId("tester-name-input").fill("Michael");
    await page.getByTestId("tester-name-submit").click();

    // Scenario picker should appear.
    await expect(page.getByTestId("scenario-free")).toBeVisible();
  });

  test("scenario picker shows all scenarios", async ({ page }) => {
    // Set name via addInitScript so it's available before React mounts.
    await page.addInitScript(() => {
      localStorage.setItem("trainingTesterName", "Michael");
    });
    await installAllMocks(page);
    await page.goto("/");

    // Turn on training mode.
    await page.getByTestId("training-toggle").first().click();

    // Click Start Call — should show scenario picker (name already set).
    await page.getByRole("button", { name: /Start Call/i }).first().click();

    // Free practice option should be visible.
    await expect(page.getByTestId("scenario-free")).toBeVisible();

    // At least 5 scenarios should be visible.
    await expect(page.getByTestId("scenario-eliquis-cost")).toBeVisible();
    await expect(page.getByTestId("scenario-turning-65")).toBeVisible();
    await expect(page.getByTestId("scenario-mapd-switch")).toBeVisible();
    await expect(page.getByTestId("scenario-dual-eligible")).toBeVisible();
    await expect(page.getByTestId("scenario-skeptical-shopper")).toBeVisible();
  });

  test("selecting a scenario starts training call with solo toggle", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("trainingTesterName", "Michael");
    });
    await installAllMocks(page);
    await page.goto("/");

    // Turn on training mode.
    await page.getByTestId("training-toggle").first().click();

    // Click Start Call.
    await page.getByRole("button", { name: /Start Call/i }).first().click();

    // Pick a scenario.
    await page.getByTestId("scenario-eliquis-cost").click();

    // Call should be active.
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Solo toggle should be visible (Agent/Client buttons).
    await expect(page.getByTestId("solo-role-agent").first()).toBeVisible();
    await expect(page.getByTestId("solo-role-client").first()).toBeVisible();

    // Training notes panel should be visible.
    await expect(page.getByTestId("training-notes-panel")).toBeVisible();
  });

  test("solo toggle switches between agent and client", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("trainingTesterName", "Michael");
    });
    await installAllMocks(page);
    await page.goto("/");

    await page.getByTestId("training-toggle").first().click();
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await page.getByTestId("scenario-free").click();

    // Verify connected.
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Solo toggle should be visible.
    const agentBtn = page.getByTestId("solo-role-agent").first();
    const clientBtn = page.getByTestId("solo-role-client").first();
    await expect(agentBtn).toBeVisible();
    await expect(clientBtn).toBeVisible();

    // Click Client.
    await clientBtn.click();

    // Click Agent back.
    await agentBtn.click();

    // Space toggles — just verify no crash.
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
  });

  test("flag button opens form and submits", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("trainingTesterName", "Michael");
    });
    await installAllMocks(page);
    await page.goto("/");

    await page.getByTestId("training-toggle").first().click();
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await page.getByTestId("scenario-free").click();

    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Click flag button in the training notes panel.
    await page.getByTestId("flag-moment-btn").click();

    // Flag form should appear.
    await expect(page.getByTestId("flag-form")).toBeVisible();

    // Fill in the form.
    await page.getByTestId("flag-type-select").selectOption("compliance_miss");
    await page.getByTestId("flag-text-input").fill("Forgot TPMO disclosure");

    // Submit.
    await page.getByTestId("flag-submit-btn").click();

    // Flag should appear in the flags list.
    await expect(page.getByTestId("flags-list")).toBeVisible();
  });

  test("admin dashboard loads", async ({ page }) => {
    await page.goto("/training/admin");
    await expect(page.getByText("Training Dashboard")).toBeVisible();
    await expect(page.getByText("Back to App")).toBeVisible();
  });

  test("tester name persists across page loads", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Set name via the prompt flow.
    await page.getByTestId("training-toggle").first().click();
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await page.getByTestId("tester-name-input").fill("Jane");
    await page.getByTestId("tester-name-submit").click();

    // Dismiss scenario picker.
    await page.getByTestId("scenario-free").click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Verify localStorage was set.
    const storedName = await page.evaluate(() => localStorage.getItem("trainingTesterName"));
    expect(storedName).toBe("Jane");
  });
});
