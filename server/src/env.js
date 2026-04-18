/**
 * Environment configuration for the MediCopilot server.
 *
 * Loads from process.env. In local dev, populate via a root-level .env
 * file consumed by the parent process (e.g. `dotenv-cli` or Fly secrets).
 * We deliberately do not pull in dotenv here — the server should run
 * with whatever env the host (Fly.io, Railway, Docker, local shell)
 * provides, keeping deployment-platform agnostic.
 */

const required = [];

/** @typedef {{
 *   nodeEnv: "development"|"production"|"test",
 *   port: number,
 *   host: string,
 *   logLevel: "fatal"|"error"|"warn"|"info"|"debug"|"trace",
 *   version: string,
 *   corsOrigin: string,
 *   deepgramApiKey: string|null,
 *   deepgramSampleRate: number,
 *   anthropicApiKey: string|null,
 *   suggestionModel: string,
 *   suggestionDebounceMs: number,
 *   suggestionWindowMs: number,
 *   databaseUrl: string|null,
 *   trainingAdminKey: string|null,
 *   pttTailMs: number,
 * }} Env */

/** @returns {Env} */
export function loadEnv() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const env = {
    nodeEnv,
    port: Number(process.env.PORT) || 8080,
    host: process.env.HOST || "0.0.0.0",
    logLevel: /** @type {Env["logLevel"]} */ (
      process.env.LOG_LEVEL || (nodeEnv === "production" ? "info" : "debug")
    ),
    version: process.env.APP_VERSION || "0.1.0-dev",
    corsOrigin: process.env.CORS_ORIGIN || "*",
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || null,
    deepgramSampleRate: Number(process.env.DEEPGRAM_SAMPLE_RATE) || 16000,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    suggestionModel: process.env.SUGGESTION_MODEL || "claude-haiku-4-5-20251001",
    suggestionDebounceMs: Number(process.env.SUGGESTION_DEBOUNCE_MS) || 4_000,
    suggestionWindowMs: Number(process.env.SUGGESTION_WINDOW_MS) || 120_000,
    databaseUrl: process.env.DATABASE_URL || null,
    trainingAdminKey: process.env.TRAINING_ADMIN_KEY || null,
    pttTailMs: Number(process.env.PTT_TAIL_MS) || 1500,
  };

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return env;
}
