/**
 * MediCopilot server entry point.
 *
 * Fastify 5 with @fastify/websocket. Deployed to Fly.io iad region
 * (see fly.toml). Single-process, single-region for MVP — horizontal
 * scale happens at P5 when multi-tenant makes it worth the coordination.
 */

import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { loadEnv } from "./env.js";
import { createLogger } from "./logger.js";
import healthRoutes from "./routes/health.js";
import streamRoutes from "./routes/stream.js";
import { preflight } from "./preflight.js";

/**
 * @param {Partial<import("./env.js").Env>} [envOverrides]
 * @param {{
 *   deepgramFactory?: import("./deepgram.js").createDeepgramSession,
 *   suggestionClientFactory?: () => object,
 *   suggestionEngineFactory?: (deps: object) => object,
 * }} [opts]
 *   `deepgramFactory`, `suggestionClientFactory`, and
 *   `suggestionEngineFactory` are injected by tests to stub the
 *   Deepgram WebSocket and Claude stream. In production, routes fall
 *   back to real implementations.
 */
export async function build(envOverrides = {}, opts = {}) {
  const env = { ...loadEnv(), ...envOverrides };
  const logger = createLogger(env);

  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: env.nodeEnv === "production" ? false : true,
    trustProxy: true, // Fly.io sits in front as a proxy
  });

  // Expose env on the app instance for routes to read
  app.decorate("env", env);

  if (opts.deepgramFactory) {
    app.decorate("deepgramFactory", opts.deepgramFactory);
  }
  if (opts.suggestionClientFactory) {
    app.decorate("suggestionClientFactory", opts.suggestionClientFactory);
  }
  if (opts.suggestionEngineFactory) {
    app.decorate("suggestionEngineFactory", opts.suggestionEngineFactory);
  }

  await app.register(websocket, {
    options: { maxPayload: 1024 * 1024 }, // 1 MiB — audio frames stay well below this
  });

  await app.register(healthRoutes);
  await app.register(streamRoutes);

  // Root — quick sanity check if someone curls the service
  app.get("/", async () => ({
    name: "medicopilot-server",
    version: env.version,
    docs: "https://github.com/myacaexpress/medicopilot",
  }));

  return app;
}

// Only start the server when invoked directly (not when imported by tests)
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const env = loadEnv();
  const app = await build();
  await preflight(env, app.log);
  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info({ port: env.port, host: env.host }, "server: listening");
  } catch (err) {
    app.log.fatal({ err }, "server: failed to start");
    process.exit(1);
  }

  // Graceful shutdown — Fly.io sends SIGINT on deploys
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, async () => {
      app.log.info({ sig }, "server: shutting down");
      try {
        await app.close();
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, "server: shutdown error");
        process.exit(1);
      }
    });
  }
}
