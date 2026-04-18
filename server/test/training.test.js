import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "../src/index.js";

let app;

// These tests run against the training REST endpoints.
// They work without DATABASE_URL (endpoints return 503).
// With DATABASE_URL set, they test the full flow.

before(async () => {
  app = await build(
    { nodeEnv: "test", logLevel: "silent" },
    { deepgramFactory: () => null }
  );
});

after(async () => {
  if (app) await app.close();
});

describe("training API without DB", () => {
  it("POST /api/training/tester validates name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/training/tester",
      payload: { name: "" },
    });
    assert.equal(res.statusCode, 400);

    const res2 = await app.inject({
      method: "POST",
      url: "/api/training/tester",
      payload: { name: "Michael" },
    });
    assert.equal(res2.statusCode, 200);
    const body = JSON.parse(res2.body);
    assert.equal(body.name, "Michael");
  });

  it("POST /api/training/session/start returns 503 without DB", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/training/session/start",
      payload: { testerName: "Michael" },
    });
    assert.equal(res.statusCode, 503);
  });

  it("GET /api/training/sessions returns 503 without DB", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/training/sessions",
    });
    assert.equal(res.statusCode, 503);
  });

  it("GET /api/training/stats returns 503 without DB", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/training/stats",
    });
    assert.equal(res.statusCode, 503);
  });

  it("POST /api/training/flag validates required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/training/flag",
      payload: {},
    });
    // Without DB it's 503; with DB it would be 400. Both are acceptable.
    assert.ok([400, 503].includes(res.statusCode));
  });
});
