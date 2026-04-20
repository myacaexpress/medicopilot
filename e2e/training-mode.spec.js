import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

async function setupTrainingMocks(page) {
  await page.addInitScript(() => {
    localStorage.setItem("medicopilot_tester_name", "Test Agent");
  });
  await page.route("**/api/training/scenarios", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify([{
        id: "b01-test", title: "Test Scenario", difficulty: "beginner",
        persona_name: "Test Person", persona_age: 65, persona_state: "FL",
        situation: "Test", opening_lines: ["Hi"], medications: [], success_criteria: [],
      }]),
    });
  });
  await page.route("**/api/training/sessions", async (route) => {
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 1 }) });
  });
  await page.route("**/api/training/flags", async (route) => {
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 1 }) });
  });
}

async function activateTrainingAndPickScenario(page) {
  await page.getByTestId("training-toggle").first().click();
  // Scenario picker appears — select a scenario
  await expect(page.getByText("Choose a Scenario")).toBeVisible();
  await page.getByText("Test Person").click();
}

test.describe("training mode", () => {
  test("training pill toggles in header", async ({ page }) => {
    await installAllMocks(page);
    await setupTrainingMocks(page);
    await page.goto("/");

    const toggle = page.getByTestId("training-toggle").first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("Training");

    // Start a call first so scenario picker doesn't block
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Toggle ON during call
    await toggle.click();
    await expect(toggle).toContainText("TRAINING");

    // Toggle OFF
    await toggle.click();
    await expect(toggle).toContainText("Training");
  });

  test("training pill visible during active call", async ({ page }) => {
    await installAllMocks(page);
    await setupTrainingMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    const toggle = page.getByTestId("training-toggle").first();
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(toggle).toContainText("TRAINING");
  });

  test("training mode persists across call end", async ({ page }) => {
    await installAllMocks(page);
    await setupTrainingMocks(page);
    await page.goto("/");

    await activateTrainingAndPickScenario(page);
    const toggle = page.getByTestId("training-toggle").first();
    await expect(toggle).toContainText("TRAINING");

    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByRole("button", { name: /End Call/i }).first()).toBeVisible();
    await page.getByRole("button", { name: /End Call/i }).first().click();
    await expect(page.getByRole("button", { name: /Start New|Start Call/i }).first()).toBeVisible();

    await expect(toggle).toContainText("TRAINING");
  });

  test("free practice shows empty lead context, not Maria Garcia", async ({ page }) => {
    await installAllMocks(page);
    await setupTrainingMocks(page);
    // Seed a captured lead in localStorage to test that training mode ignores it
    await page.addInitScript(() => {
      localStorage.setItem("medicopilot_active_lead", JSON.stringify({
        id: "stale", source: "vision",
        fields: { firstName: { v: "Maria", confidence: "high" }, lastName: { v: "Garcia", confidence: "high" } },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }));
    });
    await page.goto("/");

    // Activate training and pick free practice
    await page.getByTestId("training-toggle").first().click();
    await expect(page.getByText("Choose a Scenario")).toBeVisible();
    await page.getByText("No Lead Info").click();

    // Start call
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByRole("button", { name: /End Call/i }).first()).toBeVisible();

    // Lead context panel should show empty state
    await expect(page.getByText("No lead captured")).toBeVisible();

    // Maria Garcia demo data must NOT appear
    await expect(page.getByText("Maria Garcia")).not.toBeVisible();
  });

  test("scenario lead shows persona data, not Maria Garcia", async ({ page }) => {
    await installAllMocks(page);
    await setupTrainingMocks(page);
    await page.goto("/");

    await activateTrainingAndPickScenario(page);

    // Lead context should show scenario persona
    await expect(page.getByText("Test Person").first()).toBeVisible();
    await expect(page.getByText("Maria Garcia")).not.toBeVisible();
  });
});

test.describe("push-to-talk", () => {
  test("push-to-talk controls visible in training mode during call", async ({ page }) => {
    await installAllMocks(page);
    await setupTrainingMocks(page);
    await page.goto("/");

    await activateTrainingAndPickScenario(page);

    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByRole("button", { name: /End Call/i }).first()).toBeVisible();

    await expect(page.getByTestId("ptt-mic-button").first()).toBeVisible();
    await expect(page.getByTestId("ptt-hint").first()).toBeVisible();
    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Client speaking");
  });

  test("space bar toggles push-to-talk indicator", async ({ page }) => {
    await installAllMocks(page);
    await setupTrainingMocks(page);
    await page.goto("/");

    await activateTrainingAndPickScenario(page);

    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByRole("button", { name: /End Call/i }).first()).toBeVisible();

    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Client speaking");

    await page.keyboard.down("Space");
    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Agent speaking");

    await expect(page.getByTestId("ptt-hint")).not.toBeVisible();

    await page.keyboard.up("Space");
    await expect(page.getByTestId("ptt-indicator").first()).toContainText("Client speaking");
  });

  test("push-to-talk not visible without training mode", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    await expect(page.getByTestId("ptt-mic-button")).not.toBeVisible();
    await expect(page.getByTestId("ptt-indicator")).not.toBeVisible();
  });
});
