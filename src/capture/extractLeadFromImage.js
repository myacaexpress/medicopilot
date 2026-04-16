/**
 * extractLeadFromImage — calls the /api/extract-lead edge function.
 *
 * Accepts a base64 data-URL (from cropToBase64) or raw base64 string,
 * POSTs it to the server, and returns structured lead fields.
 *
 * @typedef {"success"|"empty"|"denied"|"server"} ExtractionResultKind
 *
 * @typedef {Object} ExtractionResult
 * @property {ExtractionResultKind} kind
 * @property {Record<string, {v: string, confidence: string}>} [fields]
 * @property {string} [error]
 */

/**
 * @param {string} base64DataUrl  data:image/png;base64,... or raw base64
 * @returns {Promise<ExtractionResult>}
 */
export async function extractLeadFromImage(base64DataUrl) {
  // Strip the data URL prefix if present
  const base64 = base64DataUrl.includes(",")
    ? base64DataUrl.split(",")[1]
    : base64DataUrl;

  try {
    const res = await fetch("/api/extract-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
    });

    if (res.status === 403 || res.status === 401) {
      return { kind: "denied", error: "API access denied. Check server configuration." };
    }

    if (!res.ok) {
      return { kind: "server", error: `Server error (${res.status})` };
    }

    const data = await res.json();

    if (!data.fields || Object.keys(data.fields).length === 0) {
      return { kind: "empty", error: "No lead info found in the selected region." };
    }

    return { kind: "success", fields: data.fields };
  } catch (err) {
    return { kind: "server", error: err.message || "Network error" };
  }
}

/**
 * Extract lead from pasted text via the cheaper text endpoint.
 * @param {string} text
 * @returns {Promise<ExtractionResult>}
 */
export async function extractLeadFromText(text) {
  if (!text || !text.trim()) {
    return { kind: "empty", error: "No text provided." };
  }

  try {
    const res = await fetch("/api/extract-lead-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });

    if (!res.ok) {
      return { kind: "server", error: `Server error (${res.status})` };
    }

    const data = await res.json();

    if (!data.fields || Object.keys(data.fields).length === 0) {
      return { kind: "empty", error: "No lead info found in pasted text." };
    }

    return { kind: "success", fields: data.fields };
  } catch (err) {
    return { kind: "server", error: err.message || "Network error" };
  }
}
