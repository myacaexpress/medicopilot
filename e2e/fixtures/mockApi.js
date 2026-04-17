/**
 * mockApi — intercepts the two extraction endpoints and returns
 * deterministic canned responses. Call installApiMocks(page) from a
 * test.
 *
 * Responses mirror the shape consumed by extractLeadFromImage.js:
 *   { fields: { fieldName: { v, confidence } } }
 */

const DEFAULT_VISION_FIELDS = {
  firstName: { v: "Maria", confidence: "high" },
  lastName: { v: "Garcia", confidence: "high" },
  dob: { v: "03/15/1952", confidence: "high" },
  phone: { v: "(954) 555-0142", confidence: "medium" },
  address: { v: "Pembroke Pines, FL 33024", confidence: "medium" },
  coverage: { v: "Original Medicare + PDP", confidence: "medium" },
};

const DEFAULT_PASTE_FIELDS = {
  firstName: { v: "Maria", confidence: "verified" },
  lastName: { v: "Garcia", confidence: "verified" },
  dob: { v: "03/15/1952", confidence: "verified" },
  phone: { v: "(954) 555-0142", confidence: "verified" },
};

export async function installApiMocks(page, overrides = {}) {
  const visionFields = overrides.vision ?? DEFAULT_VISION_FIELDS;
  const pasteFields = overrides.paste ?? DEFAULT_PASTE_FIELDS;

  await page.route("**/api/extract-lead", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ fields: visionFields }),
    });
  });

  await page.route("**/api/extract-lead-text", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ fields: pasteFields }),
    });
  });
}
