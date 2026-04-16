import { test } from "node:test";
import assert from "node:assert/strict";
import { Debouncer } from "../src/suggestions/debouncer.js";

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test("first call always fires", () => {
  const d = new Debouncer({ cooldownMs: 8000, now: () => 0 });
  assert.equal(d.canFire("medication"), true);
});

test("second call within cooldown is blocked", () => {
  const clock = fakeClock();
  const d = new Debouncer({ cooldownMs: 8000, now: clock.now });
  assert.equal(d.tryFire("medication"), true);
  clock.advance(7999);
  assert.equal(d.canFire("medication"), false);
  assert.equal(d.tryFire("medication"), false);
});

test("call after cooldown fires again", () => {
  const clock = fakeClock();
  const d = new Debouncer({ cooldownMs: 8000, now: clock.now });
  d.mark("medication");
  clock.advance(8000);
  assert.equal(d.canFire("medication"), true);
  assert.equal(d.tryFire("medication"), true);
});

test("each kind has its own independent cooldown", () => {
  const clock = fakeClock();
  const d = new Debouncer({ cooldownMs: 8000, now: clock.now });
  assert.equal(d.tryFire("medication"), true);
  assert.equal(d.tryFire("provider"), true);
  assert.equal(d.tryFire("question"), true);
  // All blocked individually
  assert.equal(d.tryFire("medication"), false);
  assert.equal(d.tryFire("provider"), false);
});

test("reset clears all cooldowns", () => {
  const clock = fakeClock();
  const d = new Debouncer({ cooldownMs: 8000, now: clock.now });
  d.mark("medication");
  d.reset();
  assert.equal(d.canFire("medication"), true);
});
