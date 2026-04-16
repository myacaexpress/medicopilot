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
  };

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return env;
}
