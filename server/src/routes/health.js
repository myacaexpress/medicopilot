/**
 * GET /health — uptime + version probe for Fly.io and client-side
 * connectivity checks. Public, unauthenticated, cheap.
 */

/** @param {import("fastify").FastifyInstance} app */
export default async function healthRoutes(app) {
  app.get("/health", async () => ({
    status: "ok",
    uptime: Math.round(process.uptime()),
    version: app.env.version,
    env: app.env.nodeEnv,
    now: new Date().toISOString(),
  }));
}
