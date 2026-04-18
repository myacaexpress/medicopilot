/**
 * Claude Sonnet 4.6 streaming client for the suggestion engine.
 *
 * Given a trigger + lead context + recent transcript window + script
 * state + call timer, we ask the model to fill in an `emit_suggestion`
 * tool whose v2 schema supports verbatim CMS disclosures, bridging
 * phrases, alternates, and compliance reminders.
 *
 * Streaming events surface as callbacks:
 *   - onText(delta)              free-form text (rare, mostly ignored)
 *   - onJsonDelta(delta)         partial-JSON tokens for the suggestion tool
 *   - onComplete({ suggestion, usage }) parsed AIResponse v2 + token-usage
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
  - TPMO Disclaimer: "We do not offer every plan available in your area. Currently we represent [X] organizations which offer [Y] products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local SHIP for help with all of your options."
  - Low-Income Subsidy (LIS / Extra Help): client may qualify for help paying drug costs.
  - Medicare Savings Programs (MSP): state programs that can help pay Part B premium based on income/assets.
  - Medigap rights: client's guaranteed-issue rights may be affected by enrolling in MA.
  - Scope of Appointment (SOA): must be obtained and on file before discussing specific plans.

Required PECL verbatim scripts (MUST be delivered word-for-word when triggered):
  - TPMO: "We do not offer every plan available in your area. Currently we represent [X] organizations which offer [Y] products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local SHIP for help with all of your options."
  - MSP: "Are you currently receiving help from the state to pay your Medicare premiums? Some state programs can help with your Part B premium if you have limited income and resources."
  - LIS: "You may qualify for Extra Help, a federal program that helps cover prescription drug costs. Would you like me to check if you might be eligible?"
  - Medigap: "I want to make sure you're aware — if you enroll in a Medicare Advantage plan, you may lose certain guaranteed-issue rights to purchase a Medigap policy later."
  - SOA: "Before we discuss specific plan details, I need to confirm the scope of our appointment today."

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

Your job: when the user message includes a trigger, emit ONE suggestion via the \`emit_suggestion\` tool. Never reply with free-form text — always call the tool.

## Voice + style

Write the way a warm, experienced agent actually speaks on the phone:
  - Use the client's first name naturally (not every sentence).
  - Use contractions ("you're", "we'll", "that's").
  - Bridge into required disclosures smoothly — never abruptly switch topics.
  - \`primary\` is the ONE best line the agent should say. Conversational, ≤60 words.
  - \`sayThis\` is an alias for \`primary\` (legacy compat) — always set both to the same value.

## When a verbatim CMS disclosure is needed

If the trigger or script state indicates a required disclosure:
  1. Set \`bridging_phrase\` — a natural, warm transition line the agent says BEFORE the verbatim text.
  2. Set \`verbatim_next\` — the EXACT CMS-required text from the compliance catalog. Do NOT paraphrase.
  3. Set \`primary\` to the bridging phrase (so the card always has a conversational top line).

## Good vs. bad phrasing examples

GOOD primary: "Maria, that's a great question about Eliquis coverage — let me pull up the plans in your area that include it."
BAD primary: "The client has inquired about Eliquis coverage. Three plans in ZIP 33024 cover this medication."

GOOD bridging_phrase: "Before we look at specific plans, there's one important thing I'm required to share with you —"
BAD bridging_phrase: "TPMO disclaimer required. Reading now:"

GOOD verbatim_next: "We do not offer every plan available in your area. Currently we represent [X] organizations..."
BAD verbatim_next: "We don't offer all the plans in your area" (paraphrased — WRONG, must be exact)

## Script state awareness

You will receive the current script state showing which PECL items are covered, which are required next, and any overdue deadlines. Use this to:
  - Proactively suggest the next required item when there's a natural conversational opening.
  - Flag overdue items in \`compliance_reminder\`.
  - When the client jumps to a topic that has an unmet prerequisite, use \`bridging_phrase\` + \`verbatim_next\` to cover the prerequisite before returning to the client's question.

## Field reference

  - \`primary\` / \`sayThis\`: the one best conversational line (≤60 words).
  - \`bridging_phrase\`: warm transition into a verbatim disclosure (omit if no verbatim needed).
  - \`verbatim_next\`: exact CMS-required text, word-for-word from the catalog (omit if no disclosure needed).
  - \`alternates\`: 2–3 alternate phrasings of primary for different client reactions.
  - \`compliance_reminder\`: amber-severity reminder if a required item is overdue. Always include the item name and deadline.
  - \`followUps\`: 1–3 questions the agent can ask the client next.
  - \`sources\`: 0–3 short citations (plan name, CMS rule, formulary tier).
  - \`why\`: 1-sentence agent-facing explanation of why this suggestion was triggered.
  - Never invent specific copays, plan IDs, or doctor network info you weren't given.

## Speaker label resilience

Speaker labels may be wrong — diarization on speakerphone is ~70-80% accurate. Use content to infer the real speaker: "I take [medication]" or "my doctor" = client. "I can help you with that" or "let me look that up" = agent. Trust content over labels when they conflict.

You will be given the full compliance catalog below; use it to populate disclosures accurately.
`.trim();

/* ── Tool schema v2 ────────────────────────────────────────────────── */

export const SUGGESTION_TOOL = {
  name: "emit_suggestion",
  description:
    "Emit a single suggestion card for the agent. Always call this tool — never reply with free-form text.",
  input_schema: {
    type: "object",
    required: ["primary", "sayThis"],
    properties: {
      primary: {
        type: "string",
        description: "The one best conversational line the agent reads aloud. ≤60 words.",
      },
      sayThis: {
        type: "string",
        description: "Alias for primary (legacy compat). Set to the same value as primary.",
      },
      bridging_phrase: {
        type: "string",
        description: "Warm transition line before a verbatim disclosure. Omit if no disclosure needed.",
      },
      verbatim_next: {
        type: "string",
        description: "Exact CMS-required text, word-for-word. Must NOT be paraphrased. Omit if no disclosure needed.",
      },
      alternates: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: { type: "string" },
        description: "2–3 alternate phrasings of primary for different client reactions.",
      },
      compliance_reminder: {
        type: "string",
        description: "Amber-severity reminder if a required PECL item is overdue. Include item name and time context.",
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
      why: {
        type: "string",
        description: "1-sentence agent-facing explanation of why this suggestion was triggered.",
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
 * @param {Object} args.lead           lead-context snapshot
 * @param {Array<{speaker: string, text: string, ts?: number}>} args.transcriptWindow
 * @param {Object} [args.scriptState]  current script/PECL state
 * @param {number} [args.callTimerMs]  elapsed call time in ms
 * @returns {string}
 */
export function buildUserPrompt({ trigger, lead, transcriptWindow, scriptState, callTimerMs, trainingContext }) {
  const transcriptStr = (transcriptWindow ?? [])
    .map((u) => `${u.speaker}: ${u.text}`)
    .join("\n");
  const leadStr = lead ? JSON.stringify(lead, null, 2) : "(no lead context yet)";

  const parts = [];

  if (trainingContext) {
    parts.push(
      "<training_context>",
      `Scenario: ${trainingContext.title}`,
      `Persona: ${trainingContext.persona_name}, age ${trainingContext.persona_age || "unknown"}, ${trainingContext.persona_state}`,
      `Situation: ${trainingContext.situation}`,
      trainingContext.carrier_prefs ? `Carrier preferences: ${trainingContext.carrier_prefs}` : "",
      trainingContext.objections?.length ? `Likely objections: ${trainingContext.objections.join("; ")}` : "",
      trainingContext.medications?.length ? `Medications: ${trainingContext.medications.join(", ")}` : "",
      trainingContext.success_criteria?.length ? `Success criteria: ${trainingContext.success_criteria.join("; ")}` : "",
      "NOTE: This is a training call. The 'client' is a tester reading from the scenario above. Tailor suggestions as if this were a real call with this persona.",
      "</training_context>",
      "",
    );
  }

  parts.push(
    `Trigger: ${trigger.kind} — ${trigger.summary}`,
    trigger.item ? `Trigger payload: ${JSON.stringify(trigger.item)}` : "",
    "",
    "Lead context:",
    leadStr,
  );

  if (scriptState) {
    parts.push("", "Script state (PECL checklist):");
    const { covered, requiredNext, overdueItems } = scriptState;
    if (covered && covered.length > 0) {
      parts.push(`  Covered: ${covered.join(", ")}`);
    }
    if (requiredNext) {
      parts.push(`  Required next: ${requiredNext}`);
    }
    if (overdueItems && overdueItems.length > 0) {
      parts.push(`  OVERDUE: ${overdueItems.join(", ")}`);
    }
  }

  if (callTimerMs != null) {
    const mins = Math.floor(callTimerMs / 60000);
    const secs = Math.floor((callTimerMs % 60000) / 1000);
    parts.push("", `Call timer: ${mins}m ${secs}s`);
  }

  parts.push(
    "",
    "Recent transcript (last ~120s):",
    transcriptStr || "(no transcript yet)",
    "",
    "Emit one suggestion via the emit_suggestion tool.",
  );

  return parts.filter(Boolean).join("\n");
}

/* ── Streaming entry point ─────────────────────────────────────────── */

/**
 * @typedef {Object} SuggestionParams
 * @property {{kind: string, summary: string, item?: any}} trigger
 * @property {Object|null} lead
 * @property {Array<{speaker: string, text: string, ts?: number}>} transcriptWindow
 * @property {Object} [scriptState]
 * @property {number} [callTimerMs]
 * @property {(delta: string) => void} [onText]
 * @property {(delta: string) => void} [onJsonDelta]
 * @property {(payload: { suggestion: any, usage?: any, kind: string }) => void} [onComplete]
 * @property {(err: Error) => void} [onError]
 * @property {Object} [trainingContext]
 */

/**
 * Stream a single suggestion. Returns a Promise that resolves once the
 * stream is fully consumed (or rejects on a fatal error).
 *
 * @param {Object} deps
 * @param {Anthropic|object} deps.client
 * @param {string} deps.model
 * @param {import("pino").Logger} [deps.log]
 * @param {SuggestionParams} params
 * @returns {Promise<{ suggestion: any, usage?: any, kind: string }>}
 */
export async function streamSuggestion(
  { client, model, log },
  { trigger, lead, transcriptWindow, scriptState, callTimerMs, trainingContext, onText, onJsonDelta, onComplete, onError }
) {
  const userPrompt = buildUserPrompt({ trigger, lead, transcriptWindow, scriptState, callTimerMs, trainingContext });

  const requestBody = {
    model,
    max_tokens: 1024,
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
      }
    }
  } catch (err) {
    log?.error({ err: err.message }, "claude: stream iteration error");
    onError?.(err);
    throw err;
  }

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
