import { test, expect } from "@playwright/test";
import { installAllMocks } from "./fixtures/index.js";

test.describe("PECL auto-cover → manual-override", () => {
  test("auto-covered row flips to manual-override when the agent clicks it", async ({ page }) => {
    await installAllMocks(page);
    await page.goto("/");

    // Start Call wires up useLiveAudio, which connects the mocked WSS
    // and listens for pecl_update events.
    await page.getByRole("button", { name: /Start Call/i }).first().click();
    await expect(page.getByText(/CONNECTED/i).first()).toBeVisible();

    // Switch to the Call Info tab so the Compliance Hub renders.
    await page.getByRole("button", { name: /Call Info/i }).click();
    await expect(page.getByText(/Pre-Enrollment Checklist/i)).toBeVisible();

    // Ensure the socket has finished opening + the server has emitted
    // hello + ready (auto-fired by the WSS mock).
    await page.waitForFunction(() => {
      const all = window.__mockWsInstances || [];
      return all.length > 0 && all[all.length - 1].readyState === 1;
    });

    // Emit an engine-side auto-cover event for "medigap" (starts undone).
    await page.evaluate(() =>
      window.__mockWssEmit({ type: "pecl_update", items: ["medigap"] })
    );

    const medigapRow = page.getByRole("button", { name: /Medigap Rights/i }).first();
    await expect(medigapRow).toBeVisible();
    await expect(medigapRow.getByText(/^auto$/i)).toBeVisible();

    // Agent disagrees with the auto-coverage → clicks the row.
    await medigapRow.click();

    // Row now carries the "override" tag (coveredBy "manual-override").
    await expect(medigapRow.getByText(/^override$/i)).toBeVisible();
  });
});
