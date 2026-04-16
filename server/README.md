# medicopilot-server

Fastify 5 backend for MediCopilot. Phase 2+ runs the long-lived WebSocket pipeline (browser mic → Deepgram → Claude → suggestion cards) that the Vercel edge can't host because it doesn't do long-lived connections.

This package is a **nested npm package** — it intentionally has its own `package.json` and deps so the frontend bundle stays lean and Fly.io's build context is tiny.

## Local development

```bash
cd server
npm install
npm run dev       # node --watch src/index.js — auto-reloads on file change
npm test          # node:test runner, no extra test deps
```

Defaults: binds to `0.0.0.0:8080`, `LOG_LEVEL=debug` with pretty output.

From the repo root you can also run:

```bash
npm run server:dev    # proxies to server/'s dev script
```

## Env vars (current tier)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP/WSS port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | pino level |
| `APP_VERSION` | `0.1.0-dev` | Surfaced on `GET /health` |
| `CORS_ORIGIN` | `*` | P2+ — tightens when auth lands |

Phase 2 adds `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_*`, `TWILIO_*`, `JWT_SECRET`. See [.env.example](../.env.example) in the repo root.

## Endpoints

### `GET /health`
Uptime probe for Fly.io + client connectivity. Returns:
```json
{ "status": "ok", "uptime": 42, "version": "0.1.0-dev", "env": "production", "now": "2026-04-16T..." }
```

### `GET /`
Service banner. Safe to curl.

### `WSS /stream`
Long-lived WebSocket. **Tier 1 scope (current):**

Server → client:
- `{ type: "hello", sessionId, serverTime }` on connect
- `{ type: "pong", t }` in response to a ping
- `{ type: "error", code, message }` for malformed input

Client → server:
- `{ type: "ping", t }`
- `{ type: "bye" }` — graceful close

Tier 2 will add binary audio frame ingest and Deepgram proxying. Tier 3 adds Claude suggestion streaming.

## Deployment (Fly.io)

First time only:

```bash
cd server
fly launch --no-deploy     # creates the app from fly.toml; uses medicopilot-api name
```

Then:

```bash
fly deploy                 # build + push + release in iad
fly logs                   # tail
fly status                 # machines & health
```

Set secrets (once per env):

```bash
fly secrets set ANTHROPIC_API_KEY=... DEEPGRAM_API_KEY=...   # P2+
```

The app auto-stops (suspends) when idle and wakes on first connection — keeps MVP cost near zero while the mockup is unvisited.

## Testing strategy

- `test/health.test.js` — `fastify.inject`, no network
- `test/stream.test.js` — real `ws` client against a locally-listening instance on an ephemeral port

Uses the built-in [`node:test`](https://nodejs.org/api/test.html) runner to avoid pulling vitest into server deps. Vitest lives in the root package for the frontend.

## Why a separate package

- Fly.io's Dockerfile copies only `server/` — a top-level `package.json` with React + Vite would bloat the image by ~100 MB
- `node --watch` and `node --test` have fewer surprises without Vite in the mix
- When we split the repo or move server to its own cluster later, this split has already happened

## Directory layout

```
server/
├── package.json          # own deps
├── fly.toml              # Fly.io config, iad region
├── Dockerfile            # node:22-alpine, prod deps only
├── .dockerignore
├── README.md             # this file
├── src/
│   ├── index.js          # entry: exports build(), auto-starts if run directly
│   ├── env.js            # env loader
│   ├── logger.js         # pino (pretty in dev, JSON in prod)
│   └── routes/
│       ├── health.js
│       └── stream.js
└── test/
    ├── health.test.js
    └── stream.test.js
```
