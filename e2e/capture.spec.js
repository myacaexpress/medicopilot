import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("capture lead", () => {
  test("paste flow populates the Lead panel with mocked extraction", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Capture Lead/i }).first().click();

    // Modal opens on "choose source" stage.
    await expect(page.getByText(/choose source/i)).toBeVisible();

    // Paste is the deterministic path — no marquee drag needed.
    await page.getByRole("button", { name: /Paste text/i }).click();
    await expect(page.getByPlaceholder(/paste lead information/i)).toBeVisible();

    await page.getByPlaceholder(/paste lead information/i).fill(
      "Maria Garcia, DOB 03/15/1952, (954) 555-0142, Pembroke Pines FL 33024"
    );
    await page.getByRole("button", { name: /Extract from text/i }).click();

    // Review stage shows the mocked fields from /api/extract-lead-text.
    await expect(page.getByText(/review & commit/i)).toBeVisible();
    await expect(page.locator("input[value='Maria']")).toBeVisible();
    await expect(page.locator("input[value='Garcia']")).toBeVisible();

    await page.getByRole("button", { name: /Commit as active lead/i }).click();

    // Lead panel should now show the captured lead's source + name.
    await expect(page.getByText(/captured/i).first()).toBeVisible();
    await expect(page.getByText("Maria").first()).toBeVisible();
  });
});
