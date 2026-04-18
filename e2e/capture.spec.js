import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("capture lead", () => {
  test("clicking Capture Lead opens the modal with choose-source stage visible", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Capture Lead/i }).first().click();

    // Modal overlay must cover the viewport (position: fixed), not be
    // clipped inside the small LeadContextPanel.
    const modal = page.getByText(/choose source/i);
    await expect(modal).toBeVisible();

    // The "Screen capture" button inside the modal should be visible and
    // reasonably positioned (not clipped to a tiny panel). Verify its
    // bounding box Y is within the viewport, not at y ~0 inside an 80px
    // panel that clips overflow.
    const captureBtn = page.getByText(/Screen capture/i);
    await expect(captureBtn).toBeVisible();
    const box = await captureBtn.boundingBox();
    expect(box.height, "modal content should not be clipped").toBeGreaterThan(10);
    expect(box.y, "modal should be positioned in viewport").toBeGreaterThan(30);
  });

  test("modal contains Screen capture and Paste text action buttons", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Capture Lead/i }).first().click();
    await expect(page.getByText(/choose source/i)).toBeVisible();

    await expect(page.getByText(/Screen capture/i)).toBeVisible();
    await expect(page.getByText(/Paste text/i)).toBeVisible();
    await expect(page.getByText(/Manual/i)).toBeVisible();
  });

  test("clicking Screen capture triggers getDisplayMedia and advances to selecting stage", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Capture Lead/i }).first().click();
    await expect(page.getByText(/choose source/i)).toBeVisible();

    // Click the Screen capture button — the mock getDisplayMedia returns
    // a canvas track immediately, so the modal should advance.
    await page.getByText(/Screen capture/i).click();

    // Should move to "selecting" stage (drag-to-select prompt).
    await expect(page.getByText(/drag to select/i)).toBeVisible({ timeout: 5000 });
  });

  test("paste flow populates the Lead panel with mocked extraction", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Capture Lead/i }).first().click();

    // Modal opens on "choose source" stage.
    await expect(page.getByText(/choose source/i)).toBeVisible();

    // Paste is the deterministic path — no marquee drag needed.
    await page.getByText(/Paste text/i).click();
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
