import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("training platform — tester flow", () => {
  test.beforeEach(async ({ page }) => {
    await installAllMocks(page);
    // Clear localStorage so name gate appears
    await page.addInitScript(() => {
      localStorage.removeItem("medicopilot_tester_name");
      sessionStorage.removeItem("medicopilot_training");
    });
  });

  test("name gate appears when training mode is activated", async ({ page }) => {
    await page.goto("/");

    // Activate training mode
    const toggle = page.getByTestId("training-toggle").first();
    await toggle.click();
    await expect(toggle).toContainText("TRAINING");

    // Name gate modal should appear
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
    await expect(page.getByText("Training Mode")).toBeVisible();
  });

  test("name gate accepts name and shows scenario picker", async ({ page }) => {
    // Mock the scenarios API
    await page.route("**/api/training/scenarios", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "b01-maria-mapd",
            title: "Maria — First MAPD Enrollment",
            difficulty: "beginner",
            persona_name: "Maria Gonzalez",
            persona_age: 65,
            persona_state: "FL",
            situation: "Just turned 65, wants MAPD options.",
            opening_lines: ["Hi, I just got my Medicare card."],
            medications: ["lisinopril"],
            success_criteria: ["Explain MAPD vs PDP"],
          },
          {
            id: "i01-betty-medications",
            title: "Betty — Complex Medication Review",
            difficulty: "intermediate",
            persona_name: "Betty Anderson",
            persona_age: 74,
            persona_state: "FL",
            situation: "Takes 8 meds including Humira.",
            opening_lines: ["My plan told me Humira costs $300!"],
            medications: ["adalimumab (Humira)", "methotrexate"],
            success_criteria: ["Run formulary comparison"],
          },
        ]),
      });
    });

    await page.goto("/");

    // Activate training mode
    await page.getByTestId("training-toggle").first().click();

    // Enter name
    await page.getByPlaceholder("Your name").fill("Test User");
    await page.getByRole("button", { name: "Start Training" }).click();

    // Scenario picker should appear
    await expect(page.getByText("Choose a Scenario")).toBeVisible();
    await expect(page.getByText("Maria Gonzalez")).toBeVisible();
    await expect(page.getByText("Betty Anderson")).toBeVisible();

    // Difficulty sections visible
    await expect(page.getByText("Beginner (1)")).toBeVisible();
    await expect(page.getByText("Intermediate (1)")).toBeVisible();
  });

  test("training notes panel has flag button during call", async ({ page }) => {
    // Set name in advance so we skip the gate
    await page.addInitScript(() => {
      localStorage.setItem("medicopilot_tester_name", "Test User");
      sessionStorage.setItem("medicopilot_training", "1");
    });

    // Mock training APIs
    await page.route("**/api/training/scenarios", async (route) => {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify([{
          id: "b01-test", title: "Test Scenario", difficulty: "beginner",
          persona_name: "Test Person", persona_age: 65, persona_state: "FL",
          situation: "Test situation", opening_lines: ["Hello"],
          medications: [], success_criteria: ["Test"],
        }]),
      });
    });
    await page.route("**/api/training/sessions", async (route) => {
      await route.fulfill({
        status: 201, contentType: "application/json",
        body: JSON.stringify({ id: 1, scenario_id: "b01-test", tester_name: "Test User" }),
      });
    });
    await page.route("**/api/training/flags", async (route) => {
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 1 }) });
    });

    await page.goto("/");

    // Scenario picker should appear — select the scenario
    await expect(page.getByText("Choose a Scenario")).toBeVisible();
    await page.getByText("Test Person").click();

    // Start call
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByRole("button", { name: /End Call/i }).first()).toBeVisible();

    // Training notes panel should be visible
    await expect(page.getByTestId("training-notes-panel")).toBeVisible();

    // Flag input and button should be visible
    await expect(page.getByTestId("training-note-input")).toBeVisible();
    await expect(page.getByTestId("training-flag-btn")).toBeVisible();

    // Add a flag
    await page.getByTestId("training-note-input").fill("Agent missed TPMO");
    await page.getByTestId("training-flag-btn").click();

    // Flag should appear in the list
    await expect(page.getByText("Agent missed TPMO")).toBeVisible();
  });
});

test.describe("training platform — admin panel", () => {
  test("admin panel shows error without key", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Admin key required")).toBeVisible();
  });

  test("admin panel loads with valid key", async ({ page }) => {
    // Mock admin sessions endpoint
    await page.route("**/api/training/admin/sessions**", async (route) => {
      if (route.request().headers()["x-admin-key"] === "test-key") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({ status: 401, body: JSON.stringify({ error: "Invalid" }) });
      }
    });

    await page.goto("/admin?key=test-key");
    await expect(page.getByText("Training Admin")).toBeVisible();
    await expect(page.getByText("No sessions yet")).toBeVisible();
  });

  test("admin tabs switch between Sessions, Scenarios, Stats", async ({ page }) => {
    await page.route("**/api/training/admin/stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total_sessions: 0, rated_sessions: 0, avg_rating: null,
          avg_duration_sec: null, unique_testers: 0,
          by_difficulty: [], top_scenarios: [], recent_flags: [],
        }),
      });
    });
    await page.route("**/api/training/admin/sessions**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route("**/api/training/scenarios", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/admin?key=test-key");
    await expect(page.getByText("Training Admin")).toBeVisible();

    // Sessions tab is default
    await expect(page.getByRole("button", { name: "Sessions" })).toBeVisible();

    // Switch to Stats
    await page.getByRole("button", { name: "Stats" }).click();
    await expect(page.getByText("TOTAL SESSIONS")).toBeVisible();
  });
});
