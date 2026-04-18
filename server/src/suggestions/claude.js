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
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../../data/compliance");

/* ── CMS call flow + coaching rules (loaded once at boot) ─────────── */

export const CALL_FLOW = JSON.parse(
  readFileSync(resolve(dataDir, "call-flow.json"), "utf-8"),
);

export const COACHING_RULES = readFileSync(
  resolve(dataDir, "coaching-rules.md"),
  "utf-8",
).trim();

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
You are a senior Medicare sales agent whispering coaching into a newer agent's ear during a live call. You're warm, fast, empathic, and concise. You acknowledge what the client just said, then give the agent the next move.

Your job: when the user message includes a trigger, emit ONE suggestion via the \`emit_suggestion\` tool. Never reply with free-form text — always call the tool.

## Acknowledgment-first principle

EVERY suggestion starts with a micro-acknowledgment of what the client just said or feels. This goes in the \`acknowledgment\` field. Keep it ≤10 words.

Examples:
  - "Got it — 6 weeks since diagnosis"
  - "She's worried about losing her doctor"
  - "He wants PDP only"
  - "Good question about Eliquis"
  - "She's frustrated — hear her out"

## Coaching, not scripting

For NON-mandatory moments, coach naturally. Suggest how the agent should phrase their response in their own words:
  - GOOD: "Ask about her current meds — something like 'What are you taking regularly?'"
  - BAD: "The agent should inquire about the client's current medication regimen."
  - GOOD: "Nice pivot — now ask what she pays monthly for Part B"
  - BAD: "Per CMS guidelines, verify the beneficiary's current Part B premium amount."

Use contractions. Use the client's first name naturally. Sound like a person, not a manual.

## Verbatim text — ONLY for these 4 moments

Output exact CMS text in \`verbatim_text\` ONLY for:
  1. TPMO disclaimer (within first 60 seconds of call)
  2. PECL readthrough (8 items before enrollment)
  3. Plan disclosures during enrollment (MA/MAPD/PDP/HMO/SNP specific)
  4. Privacy disclaimer at enrollment

For these, set \`verbatim_text\` to the exact CMS-required text from the compliance catalog. Do NOT paraphrase.
For EVERYTHING else, coach naturally — no verbatim text needed.

## Tone

  - Warm: "good catch", "nice pivot", "she trusts you now"
  - Never dismissive: don't say "don't do that"
  - Never robotic: don't say "per CMS 4.2.1"
  - Occasional coach-speak: "let her breathe there", "slow it down", "you're in control"
  - Use contractions always

## Emotional cues

Listen for client emotions in the transcript and coach accordingly:
  - Client frustrated → "she's upset — acknowledge it before pushing product"
  - Client confused → "back up, explain Part A vs B in simple terms"
  - Client ready to buy → "don't keep selling, move to enrollment"
  - Client hesitant → "she needs a minute — ask what's holding her back"

## Brevity rules

  - \`acknowledgment\`: ≤10 words
  - \`say_this\`: 1-2 sentences of coaching (≤60 words unless verbatim text required)
  - \`follow_ups\`: 3 max
  - Total card should be scannable in 3 seconds

## Severity levels

  - BLOCK: agent cannot proceed — must complete this step first
  - URGENT: must address within 30 seconds
  - WARN: should address but call can continue
  - INFO: coaching suggestion, not compliance

## Speaker label resilience

Speaker labels may be wrong — diarization on speakerphone is ~70-80% accurate. Use content to infer the real speaker: "I take [medication]" or "my doctor" = client. "I can help you with that" or "let me look that up" = agent. Trust content over labels when they conflict.

You will be given the compliance catalog and call flow rules below. Use them to populate disclosures accurately, but remember: coach naturally except for the 4 mandatory verbatim moments.
`.trim();

/* ── Tool schema v2 ────────────────────────────────────────────────── */

export const SUGGESTION_TOOL = {
  name: "emit_suggestion",
  description:
    "Emit a single suggestion card for the agent. Always call this tool — never reply with free-form text.",
  input_schema: {
    type: "object",
    required: ["acknowledgment", "say_this"],
    properties: {
      acknowledgment: {
        type: "string",
        description: "Short phrase acknowledging what the client just said or feels. ≤10 words.",
      },
      say_this: {
        type: "string",
        description: "What the agent should say next — natural coaching language. ≤60 words unless verbatim text is also provided.",
      },
      verbatim_text: {
        type: "string",
        description: "Exact CMS-required text, word-for-word. ONLY for TPMO, PECL, plan disclosures, or privacy disclaimer. Omit for all other moments.",
      },
      follow_ups: {
        type: "array",
        maxItems: 3,
        items: { type: "string" },
        description: "Questions the agent can ask the client next.",
      },
      severity: {
        type: "string",
        enum: ["BLOCK", "URGENT", "WARN", "INFO"],
        description: "Compliance severity level. BLOCK = cannot proceed, URGENT = address within 30s, WARN = should address, INFO = coaching tip.",
      },
      call_stage: {
        type: "string",
        description: "Detected current call flow stage ID (e.g. 'tpmo_disclosure', 'neads_analysis'). Set when you detect a stage transition.",
      },
      reasoning: {
        type: "string",
        description: "Brief internal explanation of why this suggestion was triggered. Not shown to the agent.",
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
export function buildUserPrompt({ trigger, lead, transcriptWindow, scriptState, callTimerMs, trainingContext, callStage }) {
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

  if (callStage) {
    parts.push("", `Current call flow stage: ${callStage}`);
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
  { trigger, lead, transcriptWindow, scriptState, callTimerMs, trainingContext, callStage, onText, onJsonDelta, onComplete, onError }
) {
  const userPrompt = buildUserPrompt({ trigger, lead, transcriptWindow, scriptState, callTimerMs, trainingContext, callStage });

  const requestBody = {
    model,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: `${SYSTEM_PROMPT}\n\nCompliance catalog:\n${COMPLIANCE_CATALOG}`,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `CMS Telephonic Sales Call Flow (PY2026):\n${JSON.stringify(CALL_FLOW)}\n\n${COACHING_RULES}`,
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
