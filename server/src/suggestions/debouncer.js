/**
 * Per-trigger-kind cooldown gate. We never want to spam the agent UI
 * with back-to-back suggestion cards of the same flavour, so each
 * trigger kind gets its own timer.
 *
 * The class is stateful per WSS session — instantiate one per
 * connection and dispose when the socket closes. `now` is injectable
 * so tests can drive a deterministic clock.
 */

export class Debouncer {
  /**
   * @param {Object}   [opts]
   * @param {number}   [opts.cooldownMs=8000]
   * @param {() => number} [opts.now]  defaults to Date.now
   */
  constructor({ cooldownMs = 8_000, now = () => Date.now() } = {}) {
    this.cooldownMs = cooldownMs;
    this.now = now;
    /** @type {Map<string, number>} kind → last-fire timestamp (ms). */
    this.lastFire = new Map();
  }

  /** @param {string} kind */
  canFire(kind) {
    const last = this.lastFire.get(kind);
    if (last === undefined) return true;
    return this.now() - last >= this.cooldownMs;
  }

  /** @param {string} kind */
  mark(kind) {
    this.lastFire.set(kind, this.now());
  }

  /** Convenience: check + mark in one shot. Returns true iff fired. */
  tryFire(kind) {
    if (!this.canFire(kind)) return false;
    this.mark(kind);
    return true;
  }

  reset() {
    this.lastFire.clear();
  }
}
