/**
 * Claude Sonnet 4.6 streaming client for the suggestion engine.
 *
 * Given a trigger + lead context + recent transcript window, we ask
 * the model to fill in an `emit_suggestion` tool whose schema mirrors
 * AIResponseCard (src/data/aiResponses.js). The structured-tool path
 * is more reliable than free-form JSON for downstream rendering.
 *
 * Streaming events surface as callbacks:
 *   - onText(delta)              free-form text (rare, mostly ignored)
 *   - onJsonDelta(delta)         partial-JSON tokens for the suggestion tool
 *   - onComplete({ suggestion, usage }) parsed AIResponse + token-usage
 *   - onError(err)
 *
 * Prompt-caching: the system prompt + compliance catalog are placed in
 * a `cache_control: { type: "ephemeral" }` block so repeated calls
 * within the same session hit Anthropic's prompt cache (5-minute TTL).
 */

import Anthropic from "@anthropic-ai/sdk";

/* ── Compliance catalog (cached) ───────────────────────────────────── */

export const COMPLIANCE_CATALOG = `
CMS PECL (Pre-Enrollment Checklist) — required disclosures during a Medicare sales call:
  - TPMO Disclaimer: "We do not offer every plan available in your area. Currently we represent X organizations which offer Y products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local SHIP for help with all of your options."
  - Low-Income Subsidy (LIS / Extra Help): client may qualify for help paying drug costs.
  - Medicare Savings Programs (MSP): state programs that can help pay Part B premium based on income/assets.
  - Medigap rights: client's guaranteed-issue rights may be affected by enrolling in MA.
  - Scope of Appointment (SOA): must be obtained and on file before discussing specific plans.

CMS marketing rules — never:
  - Describe a plan as "the best" or "the only option."
  - Compare to specific competitor plans by name in a misleading way.
  - Pressure the client to enroll on the spot.
  - Discuss benefits not on the agent's appointment list.
  - Quote a specific copay or premium without confirming via the formulary/plan PDF.
`.trim();

/* ── System prompt (cached) ────────────────────────────────────────── */

export const SYSTEM_PROMPT = `
You are MediCopilot, a real-time copilot whispering to a licensed Medicare insurance agent during a live sales call. The agent reads your guidance off-screen while talking to the client; there is no time for fluff or caveats.

Your job: when the user message includes a trigger from the live transcript, emit ONE concise suggestion via the \`emit_suggestion\` tool. Never reply with free-form text — always call the tool.

Voice + style:
  - Address the agent in second person ("Mrs. Garcia just asked...").
  - \`sayThis\` is the verbatim line the agent reads aloud — keep it natural, conversational, ≤60 words.
  - \`pressMore\` is 1–3 follow-on talking points if the client wants more detail.
  - \`followUps\` is 1–3 questions the agent can ask the client next.
  - \`compliance\` is a one-liner reminder if the trigger touches a CMS rule (PECL / TPMO / MSP / SOA / Medigap). Omit if not applicable.
  - \`sources\` is 0–3 short citations (plan name, CMS rule id, formulary tier).
  - Never invent specific copays, plan IDs, or doctor network info you weren't given. If the lead context doesn't include it, say so and suggest pulling up the plan PDF.

You will be given the full compliance catalog below; use it to populate the \`compliance\` field accurately.
`.trim();

/* ── Tool schema (mirrors AIResponseCard) ──────────────────────────── */

export const SUGGESTION_TOOL = {
  name: "emit_suggestion",
  description:
    "Emit a single suggestion card for the agent. Always call this tool — never reply with free-form text.",
  input_schema: {
    type: "object",
    required: ["sayThis"],
    properties: {
      sayThis: {
        type: "string",
        description: "Verbatim line the agent reads aloud. ≤60 words, conversational.",
      },
      pressMore: {
        type: "array",
        maxItems: 3,
        items: { type: "string" },
        description: "Follow-on talking points if the client wants more detail.",
      },
      followUps: {
        type: "array",
        maxItems: 3,
        items: { type: "string" },
        description: "Questions the agent can ask the client next.",
      },
      sources: {
        type: "array",
        maxItems: 3,
        items: { type: "string" },
        description: "Short citations: plan name, CMS rule, formulary tier.",
      },
      compliance: {
        type: "string",
        description: "One-line CMS reminder if the trigger touches a compliance rule. Omit if N/A.",
      },
    },
  },
};

/* ── Prompt assembly ───────────────────────────────────────────────── */

/**
 * Build the user-message text for a single suggestion request.
 *
 * @param {Object} args
 * @param {{kind: string, summary: string, item?: any}} args.trigger
 * @param {Object} args.lead     lead-context snapshot
 * @param {Array<{speaker: string, text: string, ts?: number}>} args.transcriptWindow
 * @returns {string}
 */
export function buildUserPrompt({ trigger, lead, transcriptWindow }) {
  const transcriptStr = (transcriptWindow ?? [])
    .map((u) => `${u.speaker}: ${u.text}`)
    .join("\n");
  const leadStr = lead ? JSON.stringify(lead, null, 2) : "(no lead context yet)";
  return [
    `Trigger: ${trigger.kind} — ${trigger.summary}`,
    trigger.item ? `Trigger payload: ${JSON.stringify(trigger.item)}` : "",
    "",
    "Lead context:",
    leadStr,
    "",
    "Recent transcript (last ~120s):",
    transcriptStr || "(no transcript yet)",
    "",
    "Emit one suggestion via the emit_suggestion tool.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ── Streaming entry point ─────────────────────────────────────────── */

/**
 * @typedef {Object} SuggestionParams
 * @property {{kind: string, summary: string, item?: any}} trigger
 * @property {Object|null} lead
 * @property {Array<{speaker: string, text: string, ts?: number}>} transcriptWindow
 * @property {(delta: string) => void} [onText]
 * @property {(delta: string) => void} [onJsonDelta]
 * @property {(payload: { suggestion: any, usage?: any, kind: string }) => void} [onComplete]
 * @property {(err: Error) => void} [onError]
 */

/**
 * Stream a single suggestion. Returns a Promise that resolves once the
 * stream is fully consumed (or rejects on a fatal error). The
 * `onJsonDelta` callback is the hot path — every partial-JSON token
 * for the tool input lands there.
 *
 * @param {Object} deps
 * @param {Anthropic|object} deps.client          injectable Anthropic client (tests pass a stub)
 * @param {string} deps.model                     e.g. "claude-sonnet-4-6"
 * @param {import("pino").Logger} [deps.log]
 * @param {SuggestionParams} params
 * @returns {Promise<{ suggestion: any, usage?: any, kind: string }>}
 */
export async function streamSuggestion(
  { client, model, log },
  { trigger, lead, transcriptWindow, onText, onJsonDelta, onComplete, onError }
) {
  const userPrompt = buildUserPrompt({ trigger, lead, transcriptWindow });

  const requestBody = {
    model,
    max_tokens: 1024,
    // System prompt + compliance catalog go in a cache_control block so
    // repeated suggestion calls in the same call session hit the cache.
    system: [
      {
        type: "text",
        text: `${SYSTEM_PROMPT}\n\nCompliance catalog:\n${COMPLIANCE_CATALOG}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUGGESTION_TOOL],
    tool_choice: { type: "tool", name: "emit_suggestion" },
    messages: [{ role: "user", content: userPrompt }],
  };

  let stream;
  try {
    stream = client.messages.stream(requestBody);
  } catch (err) {
    log?.error({ err: err.message }, "claude: stream() threw synchronously");
    onError?.(err);
    throw err;
  }

  let jsonBuffer = "";
  let textBuffer = "";
  let usage;

  try {
    for await (const event of stream) {
      switch (event.type) {
        case "content_block_delta": {
          const d = event.delta;
          if (!d) break;
          if (d.type === "text_delta" && d.text) {
            textBuffer += d.text;
            onText?.(d.text);
          } else if (d.type === "input_json_delta" && d.partial_json) {
            jsonBuffer += d.partial_json;
            onJsonDelta?.(d.partial_json);
          }
          break;
        }
        case "message_delta": {
          if (event.usage) usage = { ...usage, ...event.usage };
          break;
        }
        case "message_stop":
          break;
        // content_block_start / content_block_stop / message_start —
        // not interesting for our use case, ignore.
      }
    }
  } catch (err) {
    log?.error({ err: err.message }, "claude: stream iteration error");
    onError?.(err);
    throw err;
  }

  // Prefer the final-message accessor when the SDK exposes it — it
  // gives us a fully-parsed tool input even if our delta buffer
  // missed something at the boundaries.
  let suggestion;
  try {
    if (typeof stream.finalMessage === "function") {
      const final = await stream.finalMessage();
      const toolBlock = final?.content?.find?.((c) => c.type === "tool_use");
      if (toolBlock?.input) suggestion = toolBlock.input;
      if (final?.usage) usage = { ...usage, ...final.usage };
    }
  } catch (err) {
    log?.warn({ err: err.message }, "claude: finalMessage failed, falling back to delta buffer");
  }

  if (!suggestion) suggestion = safeParseJson(jsonBuffer);
  if (!suggestion && textBuffer) suggestion = safeParseJson(textBuffer);

  if (!suggestion) {
    const err = new Error("Claude returned no parseable suggestion");
    log?.error({ jsonBufferLen: jsonBuffer.length }, "claude: unparseable suggestion");
    onError?.(err);
    throw err;
  }

  const payload = { suggestion, usage, kind: trigger.kind };
  onComplete?.(payload);
  return payload;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function safeParseJson(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Construct the default Anthropic client; tests pass a stub directly. */
export function createAnthropicClient(apiKey) {
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}
