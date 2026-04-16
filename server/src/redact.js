/**
 * PII redactor — server copy. Verbatim duplicate of
 * `src/utils/redact.js` in the repo root.
 *
 * The server's Docker build context only includes `server/`, so we
 * cannot `import` from `../../src/utils/redact.js` and ship the same
 * module. Instead we keep two copies and a parity test
 * (`server/test/redact-parity.test.js`) that verifies behavior is
 * identical. If you edit one, edit the other.
 *
 * Per PRD § Compliance + OQ #12: SSN / credit card / phone-number
 * patterns must be removed from any transcript line before it leaves
 * the server (broadcast over WSS, written to logs, or persisted). DOB,
 * first name, and medication names are allowed under the Anthropic BAA
 * and are NOT redacted here.
 *
 * @typedef {{ ssn: number, credit_card: number, phone: number }} RedactionCounts
 * @typedef {{ redacted: string, counts: RedactionCounts }} RedactionResult
 */

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

const SSN_RE = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g;
const PHONE_RE =
  /(?<!\d)(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/g;
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;

/**
 * @param {string} text
 * @returns {RedactionResult}
 */
export function redact(text) {
  if (typeof text !== "string" || text.length === 0) {
    return { redacted: text ?? "", counts: { ssn: 0, credit_card: 0, phone: 0 } };
  }

  const counts = { ssn: 0, credit_card: 0, phone: 0 };
  let out = text;

  out = out.replace(CARD_RE, (match) => {
    const digits = match.replace(/[^\d]/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    if (!luhn(digits)) return match;
    counts.credit_card += 1;
    return "[REDACTED:CC]";
  });

  out = out.replace(SSN_RE, () => {
    counts.ssn += 1;
    return "[REDACTED:SSN]";
  });

  out = out.replace(PHONE_RE, () => {
    counts.phone += 1;
    return "[REDACTED:PHONE]";
  });

  return { redacted: out, counts };
}

export function containsPII(text) {
  const { counts } = redact(text);
  return counts.ssn + counts.credit_card + counts.phone > 0;
}
