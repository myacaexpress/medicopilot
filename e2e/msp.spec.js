import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("MSP script insertion", () => {
  test("clicking + MSP inserts the Medicare Savings script into the active card", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Start the call so audio/WSS are live — matches the agent flow
    // where suggestion cards arrive after the call is active.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Demo AIResponseCard (Eliquis trigger) renders by default in the
    // Copilot tab, which includes the "+ MSP" quick-insert button.
    const mspButton = page.getByRole("button", { name: /^\+ MSP$/ });
    await expect(mspButton).toBeVisible();

    // Before click: no insertion attribution.
    await expect(page.getByText(/\+ Medicare Savings/i)).toHaveCount(0);

    await mspButton.click();

    // After click: script is appended to "Say this" and the attribution
    // badge renders in the card header.
    await expect(page.getByText(/\+ Medicare Savings/i).first()).toBeVisible();
    await expect(
      page.getByText(/state programs that can help pay your Part B premium/i)
    ).toBeVisible();

    // PECL flip: switch to the Call Info tab and manually mark MSP
    // covered — the row's tag swaps from "required" to "manual".
    await page.getByRole("button", { name: /Call Info/i }).click();

    const mspRow = page.getByRole("button", { name: /Medicare Savings/i }).first();
    await expect(mspRow).toBeVisible();
    await mspRow.click();

    await expect(mspRow.getByText(/manual/i)).toBeVisible();
  });
});
