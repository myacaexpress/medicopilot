/**
 * Parity test: server/src/redact.js MUST behave identically to
 * src/utils/redact.js (the canonical client-side copy).
 *
 * The Docker build context only includes `server/`, so we cannot
 * import the client-side module at runtime. Instead this test loads
 * the client-side source via a relative path at *test time only* and
 * compares output across a shared fixture set.
 *
 * If this test fails, you almost certainly edited one copy and not
 * the other. Diff them and re-run.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { redact as serverRedact } from "../src/redact.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_PATH = resolve(__dirname, "../../src/utils/redact.js");

const FIXTURES = [
  "Hi Maria, how are you today?",
  "",
  "My SSN is 123-45-6789 thanks",
  "It is 123 45 6789 actually",
  "Card 4111-1111-1111-1111 expires next year",
  "Number is 4111111111111111.",
  "Plan ID 1234567890123456 is the MAPD",
  "Call (954) 555-0142 today",
  "Call 954-555-0142 today",
  "Call 954.555.0142 today",
  "Call +1 954 555 0142 today",
  "Call 9545550142 today",
  "Maria, born 03/15/1952, takes Eliquis daily.",
  "SSN 123-45-6789, card 4111-1111-1111-1111, callback (954) 555-0142.",
  "Charge to 4111-1111-1111-1111 please",
];

test("server redactor matches client redactor across fixture set", async () => {
  // Dynamic import via file URL so this is robust to working directory.
  const clientMod = await import(`file://${CLIENT_PATH}`);
  const clientRedact = clientMod.redact;

  for (const input of FIXTURES) {
    const a = serverRedact(input);
    const b = clientRedact(input);
    assert.equal(a.redacted, b.redacted, `redacted text mismatch on input: ${JSON.stringify(input)}`);
    assert.deepEqual(a.counts, b.counts, `counts mismatch on input: ${JSON.stringify(input)}`);
  }
});
