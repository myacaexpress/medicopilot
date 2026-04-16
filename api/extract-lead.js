/**
 * Vercel Serverless Function — POST /api/extract-lead
 *
 * Accepts a base64-encoded image, sends it to Claude Sonnet with vision,
 * and returns structured LeadContext fields.
 *
 * Request body: { image: string } (base64 PNG, no data: prefix)
 * Response: { fields: Record<string, {v: string, confidence: string}> }
 *
 * ANTHROPIC_API_KEY must be set in Vercel environment variables.
 */

import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are MediCopilot's lead extraction engine. You analyze screenshots of CRM / dialer screens (typically Five9) and extract structured lead information for Medicare insurance agents.

Extract these fields if visible:
- firstName: First name
- lastName: Last name
- dob: Date of birth (format: YYYY-MM-DD if possible, otherwise as shown)
- phone: Phone number (E.164 preferred, e.g. +19545550142)
- address: Object with street, city, state (2-letter code), zip
- coverage: Current Medicare coverage type (one of: OM, MA, MAPD, PDP, DUAL, UNKNOWN)
- medications: Array of medication names if visible
- providers: Array of provider/doctor names if visible

For each field, assign a confidence level:
- "high" — clearly readable, unambiguous
- "medium" — readable but may need verbal confirmation
- "low" — partially obscured, guessed, or ambiguous

Return ONLY valid JSON matching this schema:
{
  "fields": {
    "firstName": { "v": "Maria", "confidence": "high" },
    "lastName": { "v": "Garcia", "confidence": "high" },
    ...
  }
}

If you cannot find ANY lead information in the image, return: { "fields": {} }
Do NOT hallucinate fields that are not visible in the image.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const { image } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: "Missing image field" });
  }

  // Cap image size at ~4MB base64 (~3MB decoded)
  if (image.length > 5_500_000) {
    return res.status(400).json({ error: "Image too large (max ~4MB)" });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6-20250414",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: image,
              },
            },
            {
              type: "text",
              text: "Extract lead information from this screenshot. Return JSON only.",
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ fields: {} });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ fields: parsed.fields || {} });
  } catch (err) {
    if (err.status === 401) {
      return res.status(500).json({ error: "Invalid API key" });
    }
    return res.status(500).json({ error: "Vision extraction failed" });
  }
}
