# e2e — Playwright smoke suite

Browser-level tests that exercise the real app through Vite, with a
small layer of deterministic mocks sitting in front of the things we
don't want to hit during CI (mic, screen picker, OCR endpoints, live
transcription WSS).

## Run locally

```
npm run e2e              # headless, full suite
npm run e2e:ui           # Playwright UI runner (step-through debugging)
npm run e2e:report       # open the last HTML report
```

By default the config boots `npm run dev` on port 5173 with
`VITE_BACKEND_WSS_URL=ws://mock.test/stream` so the live-audio pipeline
attaches and the browser-side WebSocket stub can drive its messages.
If a dev server is already running the suite reuses it.

To point at an existing deployment instead:

```
PLAYWRIGHT_BASE_URL=https://medicopilot-xyz.vercel.app npm run e2e
```

## Test layout

```
e2e/
├── fixtures/
│   ├── index.js               — installAllMocks(page) barrel
│   ├── mockMediaDevices.js    — getUserMedia (silent) + getDisplayMedia (canvas)
│   ├── mockApi.js             — /api/extract-lead + /api/extract-lead-text
│   └── mockWss.js             — window.WebSocket stub + message helpers
├── smoke.spec.js              — baseURL renders, no console errors, primary CTAs present
├── capture.spec.js            — Capture Lead → paste flow → Lead panel populated
├── call-state.spec.js         — Start Call → CONNECTED → End Call → CALL ENDED
├── msp.spec.js                — + MSP button inserts script + PECL manual flip
└── pecl.spec.js               — engine pecl_update → "auto" tag → click → "override"
```

## Adding a test

1. Create `e2e/<area>.spec.js`.
2. Import `installAllMocks` from `./fixtures/index.js` and call it
   before `page.goto("/")`. This guarantees the mic, screen picker,
   OCR API, and WebSocket are all stubbed before any app code runs.
3. Prefer role- and placeholder-based locators over CSS selectors — the
   inline-style scheme in the monolith means class names are rare and
   brittle.
4. If your test needs the WSS to emit a message, first wait for the
   socket to open, then call the helper inside `page.evaluate`:

   ```js
   await page.waitForFunction(() => {
     const all = window.__mockWsInstances || [];
     return all.length > 0 && all[all.length - 1].readyState === 1;
   });
   await page.evaluate(() =>
     window.__mockWssEmit({ type: "pecl_update", items: ["medigap"] })
   );
   ```

## Mocks explained

### `mockMediaDevices.js`

Replaces `navigator.mediaDevices.getUserMedia` with a 16 kHz silent
audio stream (for `useMicCapture`) and `getDisplayMedia` with a 640×360
solid-color canvas track (for `useScreenCapture`). Also deletes
`window.ImageCapture` so the video-element fallback path runs — it's
easier to drive from the canvas-backed track than the ImageCapture API.

### `mockApi.js`

Intercepts the two extraction edge-function routes and returns a canned
Maria-Garcia lead. Per-test overrides are supported:

```js
await installApiMocks(page, {
  vision: { firstName: { v: "Jane", confidence: "high" } },
});
```

### `mockWss.js`

Replaces `window.WebSocket` with a minimal stub that:

- Dispatches `open` asynchronously on construction.
- Auto-emits `hello` + `ready` on open (toggle with
  `window.__mockWssAutoHelloReady(false)`).
- Pushes each instance onto `window.__mockWsInstances` so tests can
  grab the latest one.
- Exposes `window.__mockWssEmit(msg)` to deliver any server message
  type (`utterance`, `suggestion_done`, `pecl_update`, etc).

The companion `VITE_BACKEND_WSS_URL=ws://mock.test/stream` env var set
by `playwright.config.js` ensures `useLiveAudio` actually attaches when
the call becomes active — otherwise the hook short-circuits to a no-op.

## CI

`.github/workflows/e2e.yml` runs on every PR and push to `main`. With a
`VERCEL_TOKEN` secret configured, the job waits for the Vercel preview
URL and runs against that. Without the secret it falls back to the
Playwright-managed dev server. On failure the HTML report and traces
are uploaded as workflow artifacts.
