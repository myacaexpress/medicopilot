# CLAUDE.md — MediCopilot

Durable project context for any Claude Code session (human or AI) picking up work on this repo.

## What this is

MediCopilot is a real-time AI copilot for Medicare insurance agents on live sales calls. Think Cluely, but vertical — baked-in Medicare compliance (PECL / MSP / TPMO / SOA), plan/drug/provider intelligence, and AI suggestions surfaced in a floating overlay above Five9 or whatever dialer the agent runs. Web-first; macOS-native wrapper comes later.

Authoritative reference documents:

- **[plans/PRD.md](plans/PRD.md)** — the product requirements doc. Read this first. It defines phases P0→P5, scope, data models, compliance, architecture, decisions with rationale, open questions, and risks. Current version: v0.5 (2026-04-15).
- **[plans/ui-final-spec.md](plans/ui-final-spec.md)** — frozen UI/UX spec. Authoritative for visual behavior. Do not change UI patterns without updating this first.
- **[plans/ui-mockup.html](plans/ui-mockup.html)** + **[plans/ui-integrated-mockup.html](plans/ui-integrated-mockup.html)** — static HTML reference renderings.

If you read CLAUDE.md + PRD + ui-final-spec.md (in that order), you should be productive in under 5 minutes.

## Coding principles

Adapted from [Karpathy-inspired guidelines](https://github.com/forrestchang/andrej-karpathy-skills). These bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-driven execution

**This is the most important principle for this project.** Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

**MediCopilot-specific rule:** every fix that touches the live pipeline (server, audio, suggestions) MUST include verification that it actually works — Playwright test (`node scripts/debug/test-ask-ai-live.mjs`), `curl` check against the deployed endpoint, or screenshot proof. No more "fix shipped" without evidence it works in production.

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

These principles are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Deploy rules (DO NOT SKIP)

### Server-side changes require manual Fly deploy on PR branches

GitHub Actions auto-deploys the Fly server ONLY on pushes to `main`.
PR preview deploys on Vercel test the new frontend against MAIN's
server code — NOT the PR branch's server.

**If your PR includes ANY files under `server/**`:**

After `git push`, you MUST run:

    cd server && fly deploy --remote-only -a medicopilot-myacaexpress

Then verify:

    curl https://medicopilot-myacaexpress.fly.dev/health

The response should show `uptime` < 60 seconds.

DO NOT tell the user "pushed to PR" until Fly deploy completes. The
PR preview will be broken in non-obvious ways if you skip this.

Alternative: use `npm run push-pr` which does both automatically.

### Why this matters

We hit this bug multiple times in P2: Ask AI button appeared to fail
because the PR preview had new client code but stale server code.
Each "fix" re-shipped stale logic. Three PRs of wasted effort.
See plans/LESSONS.md for the full story.

## Current phase

**P2 Polish — Training Platform.** P2 core shipped (live transcript + AI suggestions). Current work: multi-tester training platform for solo practice with auto-save, scenario library, and admin dashboard.

P1 OCR MVP shipped earlier: real `getDisplayMedia` + Claude Vision extraction in CaptureLeadModal, LeadProvider + localStorage, Vercel fns at `api/extract-lead` (vision) and `api/extract-lead-text` (paste), consent banner, mobile photo + paste fallbacks, inline edit, SourcesRow hover highlight, marquee guard, single-slot toast.

The frozen v1 snapshot is tagged `v1-demo` and served independently from the primary deploy. Do not remove that tag.

## Training platform

Multi-tester solo practice mode for agents to rehearse Medicare sales calls.

**Architecture:**
- Tester identifies via localStorage (`trainingTesterName`) — no auth
- Training sessions stored in Neon Postgres (`training_sessions` + `training_flags` tables)
- Solo toggle replaces PTT hold-to-talk: Agent/Client buttons, click-to-switch, Space to toggle
- Scenario library in `src/data/training/scenarios.js` — 7 FL-focused Medicare personas
- Auto-save: every utterance, suggestion, and flag pushed to server in real time
- Admin dashboard at `/training/admin` — cross-tester session list, detail view, copy-as-markdown
- Server REST endpoints under `/api/training/*` (no auth — internal testing only)

**Key files:**
- `src/training/TrainingContext.jsx` — session lifecycle, auto-save hooks
- `src/training/SoloToggle.jsx` — Agent/Client click-to-switch
- `src/training/TrainingNotesPanel.jsx` — floating sidebar with persona, flags, timer
- `src/training/AdminDashboard.jsx` — `/training/admin` page
- `src/data/training/scenarios.js` — practice scenarios
- `server/src/routes/training.js` — REST API
- `server/src/db.js` — Postgres pool + schema migration

**TODO (P5):** Gate `/api/training/*` endpoints by user role.

## Stack

| Layer | Tech | Why |
|---|---|---|
| **Frontend** | React 19, Vite 8, lucide-react | Existing; keep stable through P5 |
| **Styling** | Inline style objects + CSS-in-JS per spec | Existing; don't introduce Tailwind or CSS modules without a reason |
| **Types** | JSDoc at P0–P1; TypeScript at P2 | Incremental migration documented in PRD OQ #9 |
| **Hosting (web)** | Vercel (primary + preview deploys) | Static CDN + edge fns for OCR |
| **Edge functions** | Vercel Edge (Node runtime for vision, Edge runtime for text) | Short-lived, cold-start-tolerant |
| **Backend (P2)** | Fastify on Fly.io `iad` | Long-lived WebSocket — edge can't hold WS for call duration |
| **Database** | Neon Postgres (from MVP) | Serverless, RLS-ready, branching for preview deploys |
| **Cache / sessions** | Upstash Redis | Transcript window, OTP rate-limits, WSS session state |
| **STT** | Deepgram Nova-3 streaming + diarization | Best streaming accuracy in category |
| **LLM** | Claude Sonnet 4.6 (suggestions + vision), Haiku 4.5 (classification) | Anthropic is the primary vendor |
| **Auth (MVP)** | Twilio Verify SMS-OTP + self-issued JWT (open signup) | Phone-only, no passwords, no allowlist |
| **Auth (P5)** | Clerk Organizations | Multi-tenant at P5 |
| **Telephony (P3)** | Twilio + Retell AI | Demo DID |
| **Native (P4)** | Tauri 2.x | Floating overlay, global hotkey, ScreenCaptureKit, Core Audio Taps |
| **Observability** | Sentry (errors) + Axiom (logs) | HIPAA-capable, cheap |
| **Product telemetry** | PostHog self-hosted | No PHI; BAA path at P5 |
| **Billing (P5)** | Stripe | Subscriptions via Stripe MCP tools |

## Accounts / environment

All secrets live in environment variables — **never in the client bundle**. See [`.env.example`](.env.example) for the canonical list.

- Vercel project: `medicopilot` (primary)
- Vercel project: `medicopilot-v1` (pins to git tag `v1-demo`, preserves the frozen mockup)
- Production URL: `medicopilot.vercel.app`

## Branch conventions

- `main` — production-deployed
- `claude/<description>-<id>` — feature branches for AI-cowork sessions (current: `claude/medicopilot-launch-planning-6Rmg5`)
- Pull requests must pass lint + typecheck + tests before merge to `main`
- Never push to `main` directly

## Directory layout

```
.
├── CLAUDE.md                     — this file
├── README.md                     — entry point, points here + to PRD
├── .env.example                  — full env-var template (P0→P5)
├── vercel.json                   — Vercel config
├── plans/
│   ├── PRD.md                    — product requirements (authoritative)
│   ├── ui-final-spec.md          — UI spec (frozen)
│   ├── ui-mockup.html            — static HTML references
│   └── ui-integrated-mockup.html
├── src/
│   ├── App.jsx                   — entry (wraps with LeadProvider)
│   ├── main.jsx
│   ├── index.css
│   ├── MediCopilot_macOS_Mockup.jsx  — monolith (being broken up through P0→P2)
│   ├── lead/                     — Lead state management (P1)
│   │   └── LeadContext.jsx       — LeadProvider, useLead(), reducer, buildLeadFromExtraction
│   ├── capture/                  — Capture primitives (P1)
│   │   ├── index.js              — barrel export
│   │   ├── useScreenCapture.js   — getDisplayMedia + frame grab + cropToBase64
│   │   ├── extractLeadFromImage.js — API client for vision + text extraction
│   │   ├── useConsentBanner.js   — consent state hook (sessionStorage gate)
│   │   └── ConsentBanner.jsx     — recording consent banner UI
│   ├── ui/                       — Cross-cutting UI primitives
│   │   └── Toast.jsx             — ToastProvider + useToast() (P1 error surfacing)
│   ├── training/                 — Training platform (P2 polish)
│   │   ├── TrainingContext.jsx   — session lifecycle, auto-save, tester identity
│   │   ├── TesterNamePrompt.jsx  — first-visit name prompt
│   │   ├── ScenarioPicker.jsx    — scenario selection modal
│   │   ├── SoloToggle.jsx        — Agent/Client click-to-switch
│   │   ├── TrainingNotesPanel.jsx— floating sidebar (persona, flags, timer)
│   │   └── AdminDashboard.jsx    — /training/admin page
│   ├── __tests__/                — Vitest tests
│   │   ├── leadContext.test.js   — reducer + helpers
│   │   ├── dataShape.test.js     — mock data shape validation
│   │   └── consentBanner.test.js — consent policy logic
│   └── data/                     — extracted mock data modules (P0)
│       ├── leads.js              — MOCK_LEADS + RECENT_LEADS
│       ├── transcript.js         — simulated transcript lines
│       ├── aiResponses.js        — AI response cards
│       ├── pecl.js               — PECL items (initial state)
│       ├── plans/                — mock plan data (seed for Plan Provider)
│       │   ├── index.js
│       │   └── seed.json
│       ├── training/
│       │   └── scenarios.js      — 7 practice scenarios (FL Medicare personas)
│       └── compliance/
│           └── states.js         — two-party-consent state list
├── api/                          — Vercel Serverless Functions (P1+)
│   ├── extract-lead.js           — vision OCR via Claude Sonnet (P1)
│   ├── extract-lead-text.js      — paste-parse via Claude Haiku (P1)
│   └── auth/                     — SMS-OTP endpoints (P2)
├── server/                       — Fastify app (P2+)
│   ├── package.json              — own deps (fastify, @fastify/websocket, pino)
│   ├── fly.toml + Dockerfile     — Fly.io iad deploy config
│   ├── src/
│   │   ├── index.js              — Fastify bootstrap + graceful shutdown
│   │   ├── env.js                — env loader
│   │   ├── logger.js             — pino (pretty in dev, JSON in prod)
│   │   ├── db.js                 — Postgres pool + training schema migration
│   │   └── routes/
│   │       ├── health.js         — GET /health
│   │       ├── stream.js         — WSS /stream
│   │       └── training.js       — REST /api/training/* (sessions, flags, admin)
│   └── test/                     — node:test runner (no vitest)
├── e2e/                          — Playwright smoke suite (see e2e/README.md)
│   ├── fixtures/                 — mockMediaDevices / mockApi / mockWss
│   └── *.spec.js                 — smoke, capture, call-state, msp, pecl
└── src-tauri/                    — Tauri wrapper (P4)
```

## Domain glossary

Medicare sales is acronym-dense. Stubs for common terms — full list in [PRD § Glossary](plans/PRD.md#glossary).

- **AEP** — Annual Enrollment Period (Oct 15 – Dec 7). Medicare's Black Friday.
- **MAPD** — Medicare Advantage + Prescription Drug plan (Part C + D combined).
- **PDP** — Part D standalone prescription drug plan.
- **MA** — Medicare Advantage (Part C).
- **OM** — Original Medicare (Parts A + B).
- **PECL** — Pre-Enrollment Checklist. CMS-required script items agents must cover.
- **MSP** — Medicare Savings Programs. State programs for Part B premium help.
- **LIS** — Low-Income Subsidy / Extra Help. Part D cost assistance.
- **SOA** — Scope of Appointment. CMS-required form.
- **TPMO** — Third-Party Marketing Organization disclosure. Required up front.
- **NPN** — National Producer Number. Agent license ID.
- **Five9** — Cloud dialer our primary customers use.
- **MARx** — CMS enrollment system. No public API — not a data source. Enrollment submission is out of scope for this product.

## Code conventions

Inferred from existing code — keep consistent unless PRD calls for a change.

1. **JSDoc typedefs**, not TypeScript, through P0–P1. `LeadContext`, `FieldValue`, `AIResponse`, `PECLState` shapes are defined in [PRD § Data models](plans/PRD.md#data-models-canonical). Pull those into `@typedef` comments as you go.
2. **Inline-style objects** for visual components — the existing UI uses this pattern consistently; stick with it.
3. **Hook-first** — functional components + hooks; no class components.
4. **Named exports** from `src/data/*` modules; default export reserved for page-level components.
5. **Environment access** — always `import.meta.env.VITE_*` for client-visible vars; server-only secrets never get the `VITE_` prefix.
6. **No `console.log` in shipped code** — use the logger (Axiom at P2). Replace `console.*` with `TODO` comments referencing the logger before PR merge.

## PII & compliance rules (read before writing code that touches lead data)

- **Redact SSN, credit-card, and raw phone numbers** in any string that crosses a network boundary. Use the redactor in `src/utils/redact.ts` (P2 addition).
- **First name, DOB, and medication names** are permitted in the Claude suggestion prompt under Anthropic's BAA (active from P5). See PRD OQ #12.
- **Never log PII** to Axiom, Sentry, or PostHog. Telemetry is anonymous only.
- **Two-party consent states** are in `src/data/compliance/states.js` — consent-banner copy branches on the lead's state.

## How to pick up a new session

1. Read **PRD.md** end-to-end. ~15 min. Decisions already made are in the Open Questions table.
2. Skim **ui-final-spec.md**. ~5 min. Only read end-to-end if doing UI work.
3. Check the PR / branch you're continuing. `git log --oneline -20` + `git status`.
4. Run `npm install` if needed; `npm run dev` to boot the mockup at `localhost:5173`.
5. Any decision you make that's not already in the PRD — add it to the PRD OQ table before you ship, so the next session doesn't re-derive.

## Scripts

```
npm run dev         # Vite dev server on :5173
npm run build       # production build to dist/
npm run preview     # preview the prod build locally
npm run lint        # ESLint
npm test            # Vitest (36 frontend tests)
npm run test:watch  # Vitest in watch mode
npm run server:dev  # Fastify server on :8080 (node --watch)
npm run server:test # node:test runner for server/ (4 tests)
```

Additional scripts:
- `npm run e2e` — Playwright smoke suite (see [e2e/README.md](e2e/README.md))
- `npm run e2e:ui` — Playwright UI runner for step-through debugging
- `npm run e2e:report` — open the last HTML report

Planned scripts (per phase):
- `npm run typecheck` (P0 — JSDoc first, full TS at P2)
- `npm run tauri:dev` (P4)

## Current contributors

- Shawn (myacaexpress) — product, domain, decisions
- Claude Code sessions — execution, planning, documentation

## Reporting issues / feedback

- Product or architectural decisions: discuss with Shawn, then update the PRD
- Claude Code tooling feedback: [github.com/anthropics/claude-code/issues](https://github.com/anthropics/claude-code/issues)
