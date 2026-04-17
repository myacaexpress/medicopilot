/**
 * Startup key validation. Catches invalid/expired API keys at boot
 * instead of surfacing them as confusing user-facing errors later.
 *
 * Each check makes the cheapest possible authenticated request.
 * If either fails, the process crashes with a fatal log so the
 * error is immediately visible in Fly.io logs.
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * @param {{ anthropicApiKey: string|null, deepgramApiKey: string|null }} env
 * @param {import("pino").Logger} log
 */
export async function preflight(env, log) {
  const checks = [];

  if (env.anthropicApiKey) {
    checks.push(checkAnthropic(env.anthropicApiKey, log));
  } else {
    log.warn("preflight: ANTHROPIC_API_KEY not set — suggestion engine will be disabled");
  }

  if (env.deepgramApiKey) {
    checks.push(checkDeepgram(env.deepgramApiKey, log));
  } else {
    log.warn("preflight: DEEPGRAM_API_KEY not set — live transcription will be disabled");
  }

  await Promise.all(checks);
}

async function checkAnthropic(apiKey, log) {
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    log.info("preflight: ANTHROPIC_API_KEY valid");
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      log.fatal({ status: err.status }, "preflight: ANTHROPIC_API_KEY is invalid or expired");
      process.exit(1);
    }
    // Network errors or rate limits are transient — warn but don't crash
    log.warn({ err: err.message }, "preflight: Anthropic check inconclusive (transient error)");
  }
}

async function checkDeepgram(apiKey, log) {
  try {
    const res = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      log.fatal({ status: res.status }, "preflight: DEEPGRAM_API_KEY is invalid or expired");
      process.exit(1);
    }
    log.info("preflight: DEEPGRAM_API_KEY valid");
  } catch (err) {
    log.warn({ err: err.message }, "preflight: Deepgram check inconclusive (transient error)");
  }
}
