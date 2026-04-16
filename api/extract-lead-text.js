/**
 * Vercel Serverless Function — POST /api/extract-lead-text
 *
 * Accepts raw pasted text, sends it to Claude Haiku for cheap parsing,
 * and returns structured LeadContext fields.
 *
 * Request body: { text: string }
 * Response: { fields: Record<string, {v: string, confidence: string}> }
 *
 * ANTHROPIC_API_KEY must be set in Vercel environment variables.
 */

import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are MediCopilot's lead text parser. You extract structured lead information from unstructured text that Medicare insurance agents paste from CRMs, emails, or notes.

Extract these fields if present:
- firstName: First name
- lastName: Last name
- dob: Date of birth (format: YYYY-MM-DD if possible)
- phone: Phone number (E.164 preferred)
- address: Object with street, city, state (2-letter code), zip
- coverage: Current Medicare coverage type (one of: OM, MA, MAPD, PDP, DUAL, UNKNOWN)
- medications: Array of medication names if mentioned
- providers: Array of provider/doctor names if mentioned

For each field, assign confidence:
- "high" — explicit and clear
- "medium" — likely correct but inferred
- "low" — ambiguous

Return ONLY valid JSON:
{
  "fields": {
    "firstName": { "v": "Maria", "confidence": "high" },
    ...
  }
}

If no lead info found, return: { "fields": {} }
Do NOT invent fields not present in the text.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Missing text field" });
  }

  // Cap text at 10K characters
  const trimmed = text.trim().slice(0, 10_000);

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Extract lead information from this pasted text:\n\n${trimmed}`,
        },
      ],
    });

    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ fields: {} });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ fields: parsed.fields || {} });
  } catch (err) {
    if (err.status === 401) {
      return res.status(500).json({ error: "Invalid API key" });
    }
    return res.status(500).json({ error: "Text extraction failed" });
  }
}
