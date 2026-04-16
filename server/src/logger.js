/**
 * Logger — pino with pretty output in dev, JSON in prod.
 *
 * At P2+ this will ship to Axiom via their pino transport; for now we
 * keep it local. Never log PII (names, DOB, phone, address, SSN) — the
 * redactor enforces this at call sites, not here.
 */
import pino from "pino";

/** @param {import("./env.js").Env} env */
export function createLogger(env) {
  const base = {
    level: env.logLevel,
    base: { app: "medicopilot-server", env: env.nodeEnv, version: env.version },
  };

  if (env.nodeEnv === "development") {
    return pino({
      ...base,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname,app,env,version" },
      },
    });
  }

  return pino(base);
}
