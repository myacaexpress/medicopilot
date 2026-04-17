/**
 * mockWss — replaces window.WebSocket with a controllable stub.
 *
 * Each constructed socket is pushed onto window.__mockWsInstances so
 * tests can grab the latest connection (the one the app's
 * StreamSocket just opened) and drive it with server-side messages.
 *
 * Helpers exposed on window for tests to evaluate:
 *   window.__mockWssLatest() → returns the most recent mock socket
 *   window.__mockWssEmit(msg) → dispatches a message to the latest socket
 *   window.__mockWssEmitHelloReady(sessionId?) → fires hello + ready
 *   window.__mockWssAutoHelloReady(true|false) → toggles auto hello+ready on open
 *
 * Call installWssMock(page) before the app navigates.
 */

export async function installWssMock(page) {
  await page.addInitScript(() => {
    const OPEN = 1;
    const CLOSED = 3;

    class MockWebSocket extends EventTarget {
      constructor(url, protocols) {
        super();
        this.url = url;
        this.protocols = protocols;
        this.readyState = 0;
        this.binaryType = "blob";
        this.sent = [];
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;

        (window.__mockWsInstances ??= []).push(this);

        setTimeout(() => {
          this.readyState = OPEN;
          this._fire("open", new Event("open"));
          if (window.__mockWssAutoReady) {
            this._emitRaw({ type: "hello", sessionId: "mock-session", serverTime: Date.now() });
            this._emitRaw({ type: "ready", sessionId: "mock-session" });
          }
        }, 0);
      }

      _fire(name, event) {
        const handler = this["on" + name];
        if (typeof handler === "function") {
          try { handler.call(this, event); } catch { /* ignore */ }
        }
        this.dispatchEvent(event);
      }

      _emitRaw(msg) {
        if (this.readyState !== OPEN) return false;
        const data = typeof msg === "string" ? msg : JSON.stringify(msg);
        this._fire("message", new MessageEvent("message", { data }));
        return true;
      }

      send(data) {
        this.sent.push(data);
      }

      close() {
        if (this.readyState === CLOSED) return;
        this.readyState = CLOSED;
        this._fire("close", new CloseEvent("close", { code: 1000, reason: "mock" }));
      }
    }
    MockWebSocket.CONNECTING = 0;
    MockWebSocket.OPEN = 1;
    MockWebSocket.CLOSING = 2;
    MockWebSocket.CLOSED = 3;

    window.WebSocket = MockWebSocket;
    window.__mockWssAutoReady = true;

    window.__mockWssLatest = () => {
      const all = window.__mockWsInstances || [];
      return all[all.length - 1] || null;
    };

    window.__mockWssEmit = (msg) => {
      const sock = window.__mockWssLatest();
      return sock ? sock._emitRaw(msg) : false;
    };

    window.__mockWssEmitHelloReady = (sessionId = "mock-session") => {
      window.__mockWssEmit({ type: "hello", sessionId, serverTime: Date.now() });
      window.__mockWssEmit({ type: "ready", sessionId });
    };

    window.__mockWssAutoHelloReady = (on) => {
      window.__mockWssAutoReady = Boolean(on);
    };
  });
}
