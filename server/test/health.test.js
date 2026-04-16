/**
 * Health-route tests using fastify.inject (no socket needed).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "../src/index.js";

test("GET /health returns ok with metadata", async () => {
  const app = await build({ nodeEnv: "test", logLevel: "fatal" });
  try {
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.env, "test");
    assert.ok(typeof body.uptime === "number");
    assert.ok(typeof body.version === "string");
    assert.ok(Date.parse(body.now));
  } finally {
    await app.close();
  }
});

test("GET / returns service metadata", async () => {
  const app = await build({ nodeEnv: "test", logLevel: "fatal" });
  try {
    const res = await app.inject({ method: "GET", url: "/" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.name, "medicopilot-server");
  } finally {
    await app.close();
  }
});
