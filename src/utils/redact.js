/**
 * PII redactor for transcript text.
 *
 * Per PRD § Compliance + OQ #12: SSN / credit card / phone-number
 * patterns must be removed from any transcript line before it leaves
 * the server (broadcast over WSS, written to logs, or persisted). DOB,
 * first name, and medication names are allowed under the Anthropic BAA
 * and are NOT redacted here.
 *
 * Pure function; no I/O. The server runs this on every finalised
 * Deepgram utterance before broadcasting it to the browser. The same
 * rules will apply to LLM-prompt construction in Tier 3.
 *
 * NOTE: a verbatim copy of this file lives at `server/src/redact.js`
 * because the server's Docker context only includes `server/`. The
 * server test suite has a parity test (`server/test/redact-parity.test.js`)
 * that verifies the two implementations agree on a shared fixture
 * set. If you change one, change the other.
 *
 * @typedef {{ ssn: number, credit_card: number, phone: number }} RedactionCounts
 * @typedef {{ redacted: string, counts: RedactionCounts }} RedactionResult
 */

/** Luhn checksum — used to suppress false-positive credit-card matches. */
export function luhn(digits) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Order matters: credit cards (13–19 digits with optional separators)
// would otherwise swallow a bare 10-digit phone number embedded inside
// a longer run of digits. We run cards first so they consume their own
// digits before the phone pattern sees them.

const SSN_RE = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g;

// Phone: optional +1, optional area code in parens, 3-3-4 digit groups
// with -, ., space, or no separators between groups. The negative
// look-around bits exist because we don't want to match the middle of
// a longer digit run (those are caught by the credit-card pass).
const PHONE_RE =
  /(?<!\d)(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/g;

// Credit card: 13–19 digits with optional - or space separators.
// We Luhn-validate before redacting to keep false positives low (e.g.
// medical record numbers, plan IDs).
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;

/**
 * Redact SSN, credit-card, and phone-number patterns from `text`.
 *
 * @param {string} text  raw transcript text
 * @returns {RedactionResult}
 */
export function redact(text) {
  if (typeof text !== "string" || text.length === 0) {
    return { redacted: text ?? "", counts: { ssn: 0, credit_card: 0, phone: 0 } };
  }

  const counts = { ssn: 0, credit_card: 0, phone: 0 };
  let out = text;

  // 1) Credit cards first — Luhn-validated. Replace only the matched
  //    span with [REDACTED:CC]; preserve surrounding whitespace.
  out = out.replace(CARD_RE, (match) => {
    const digits = match.replace(/[^\d]/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    if (!luhn(digits)) return match;
    counts.credit_card += 1;
    return "[REDACTED:CC]";
  });

  // 2) SSN — strict 3-2-4 pattern with - or space separators.
  out = out.replace(SSN_RE, () => {
    counts.ssn += 1;
    return "[REDACTED:SSN]";
  });

  // 3) Phone numbers — runs last so a SSN-shaped 3-2-4 sequence isn't
  //    re-tagged as a phone via its 3-3-4 sibling pattern.
  out = out.replace(PHONE_RE, () => {
    counts.phone += 1;
    return "[REDACTED:PHONE]";
  });

  return { redacted: out, counts };
}

/**
 * Convenience: returns true if `redact(text).redacted !== text`.
 * Useful for tests + the redactor-before-broadcast invariant.
 */
export function containsPII(text) {
  const { counts } = redact(text);
  return counts.ssn + counts.credit_card + counts.phone > 0;
}
