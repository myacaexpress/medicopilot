# MediCopilot — Product Requirements Document (PRD)

**Status:** Draft v0.6 · **Owner:** Shawn (myacaexpress) · **Date:** 2026-04-17
**Audience:** Founder + AI coworking agents (Claude Code sessions)
**Commercial model:** SaaS for Medicare insurance agencies (multi-tenant from day one)
**Vertical:** Medicare-only for now; "generalize later" is explicit tech debt
**Scope horizon:** Full vision, phased (P0 → P5)

### Change log
- **v0.6** (2026-04-17) — P2 shipped. Added P2 status summary (shipped features, P2 polish roadmap, known limitations, locked decisions). Training mode + push-to-talk scoped as P2 polish.
- **v0.5** (2026-04-15) — Database: Neon Postgres pulled into MVP (was P5) to back open SMS-OTP signup. Removed phone allowlist — anyone with a phone number can register. Confirmed P4-start Tauri transparency spike with pre-approved CSS-backdrop-blur fallback. Plan seed data ownership assigned to Claude (author will curate FL/TX/CA × 5 carriers from public CMS Plan Finder). Resolved OQ #16 (database).
- **v0.4** (2026-04-15) — Architecture pass. MVP redefined as P0→P2 (dogfood-scale; no BAAs; myacaexpress-internal). Resolved auth (Twilio Verify SMS-OTP for MVP, Clerk at P5). Added Plan Data Provider abstraction (mock now; CMS Marketplace API + carrier machine-readable directories later). Locked monolith Fastify on Fly.io iad. Locked observability (Sentry + Axiom) and telemetry (PostHog self-hosted). Noted Tauri #13415 transparency-on-DMG risk with CSS-backdrop-blur fallback. Resolved OQs #3, #5, #7 and added #12–#15.
- **v0.3** (2026-04-15) — Added Reference Implementations subsection (Pluely as P4 architectural reference, GPL v3 no-fork rule). Added VAD to P2 trigger pipeline. Revised P4 bundle target (≤15MB, hard cap 30MB) based on Pluely benchmark. Added OQ#11 on stealth-mode default.
- **v0.2** (2026-04-15) — Added competitive landscape, GTM/pricing rationale, testing strategy, accessibility & i18n, telemetry & privacy, degradation/error handling, deferred/out-of-roadmap list. Added decision deadlines to open questions.
- **v0.1** (2026-04-15) — Initial draft: context, phases P0–P5, data models, compliance, architecture, non-functional, success metrics, risks, open questions, glossary, verification, execution.

---

## Context

MediCopilot today is a polished Vite+React mockup at `medicopilot.vercel.app` that
simulates a Cluely-style real-time copilot for Medicare agents on Five9. All UI
behaviors work — Lead Context panel, Capture Lead flow, Compliance Hub, AI
response cards — but everything beneath the UI is mocked: no real `getDisplayMedia`,
no vision API, no backend, no transcription, no telephony, no auth, no tenancy.
Design spec is frozen at `plans/ui-final-spec.md`.

This PRD exists to turn the mockup into a shippable SaaS product. It locks scope
per phase, defines data models and compliance requirements once, and gives any
future session (human or AI) the context needed to execute without re-deriving
decisions that were already made.

---

## TL;DR

MediCopilot is a real-time AI copilot for Medicare insurance agents during live
sales calls. It captures lead context (via screen OCR, webhooks, or manual
entry), transcribes the call, and surfaces contextual talking points, compliance
reminders (PECL / MSP), plan comparisons, and follow-up questions — in a
Cluely-style floating overlay that sits above the agent's Five9 / dialer
window. Medicare AEP agents fined or decertified for compliance misses today
get a safety net that makes compliance visible and one-click.

Product ships in five phases:

| # | Phase | What ships | Target |
|---|---|---|---|
| P0 | Foundations | CLAUDE.md, env scaffold, preserved v1 demo URL, multi-tenant auth | 1 week |
| P1 | OCR MVP (web) | Real `getDisplayMedia` + Claude Vision extraction; Lead Context persistence | 2 weeks |
| P2 | Live transcript | Browser mic → Deepgram → diarization; trigger-based AI suggestions | 2–3 weeks |
| P3 | Twilio phone demo | Inbound DID → AI agent via Retell/ConversationRelay; same UI observes | 2 weeks |
| P4 | macOS native wrapper | Tauri shell, floating overlay, global hotkey, system-audio capture | 3 weeks |
| P5 | SaaS productization | Tenant management, billing, audit logs, admin console, HIPAA BAAs | 3 weeks |

Phases are sequenced but not rigid — P3 can parallelize with P2 once transcript
contract is locked.

---

## Users & personas

1. **Field agent (primary)** — Medicare-licensed agent on Five9 or a similar
   dialer, doing 40–80 outbound AEP calls/day. Wants to close more enrollments
   without tripping PECL / MSP / SOA compliance. Pain: manual note-taking,
   missed MSP offers, slow plan lookups, spelling name wrong.
2. **Agency admin (decision maker)** — Runs 5–500 agents at an insurance
   agency. Buys MediCopilot to reduce compliance risk and improve AHT. Wants
   audit trails, per-agent performance, consolidated billing.
3. **Compliance officer (influence)** — Reviews call recordings, responds to
   CMS audits. Wants defensible audit logs proving PECL completion per call.
4. **Internal (PRD audience)** — Shawn + Claude cowork sessions + future devs.
   Needs decisions pre-made and discoverable.

---

## Problem & opportunity

Medicare sales is the highest-compliance, highest-churn category of insurance
call work. AEP runs ~45 days (Oct 15 – Dec 7) during which:

- Agents must complete a CMS Pre-Enrollment Checklist (PECL) every call or
  the enrollment can be reversed.
- Medicare Savings Programs (MSP) must be offered even when irrelevant.
- Missed compliance = fines, decertification, lost commissions.
- Agents juggle Five9 / CRM / plan lookup tools / state-specific rules
  simultaneously. Cognitive load is the bottleneck; tooling is a spreadsheet
  and a PDF.

Cluely proved that a floating AI overlay that listens to meetings is a valid
product category. MediCopilot applies that pattern to a vertical where the
compliance surface area is massive and the cost of a miss is measurable in
dollars. Differentiation vs. a generic call copilot: **baked-in Medicare
compliance, plan database, and PECL scoring — not a general-purpose prompt.**

---

## Competitive landscape

| Category | Example products | What they do | Gap we fill |
|---|---|---|---|
| **Generic call overlay** | Cluely, Granola (meetings), Superpowered | Floating UI, live transcript, generic prompt | No Medicare domain; no PECL; no plan DB; no compliance audit trail |
| **Call intelligence (enterprise)** | Gong, Chorus, Observe.ai | Post-call analysis, coaching scorecards | Post-call not real-time; priced for enterprise; no insurance vertical |
| **Medicare tech (quote + enroll)** | SunFire, Connecture, PlanCompass | Plan quoting, enrollment submission, rate lookup | Static tools, no live-call layer, no AI; agents still manually drive |
| **Medicare compliance (training)** | AHIP certification, carrier LMS | Upfront training and testing | Doesn't help in the moment, on the call |
| **AI voice agents (outbound)** | Retell, Vapi, Bland | AI talks to humans on the phone | We use them (P3); not competitors — our product is for the *human* agent |
| **Five9 itself** | Five9 Agent Assist, Five9 AI Summary | In-platform AI assist | Requires Five9 partnership + enterprise sale; doesn't help non-Five9 agents; shallow Medicare domain |

**Positioning statement:**
> Cluely-for-Medicare-compliance. Everything other call copilots are, plus the
> PECL/MSP/TPMO/SOA regulatory layer that Medicare demands and no generic
> copilot understands.

**Moats we are building toward:**
1. **Domain depth** — plan database + compliance scripts that an LLM prompt
   alone cannot match
2. **Velocity** — ship in weeks what enterprise tools ship in years
3. **Integration breadth** — OCR fallback means we never require a Five9
   partnership to work anywhere
4. **Audit trail** — per-call compliance attestation is a contractual asset
   for agencies under CMS audit

**Moats we explicitly are not trying to build:**
- Own the dialer (Five9 wins that)
- Own the enrollment submission (SunFire/Connecture win that)
- Build a carrier relationship (too slow, not where the value is)

### Reference implementations & prior art

Open-source projects we draw architectural lessons from. **Reference only —
licensing constraints prevent direct forks.**

| Project | License | What it proves / teaches | How we use it |
|---|---|---|---|
| **Pluely** ([iamsrikanthnani/pluely](https://github.com/iamsrikanthnani/pluely)) | GPL v3 | Tauri + React + Rust architecture; ~10MB bundle; cross-platform (macOS/Win/Linux); local SQLite; system audio capture; global hotkeys; stealth overlay pattern | Architectural reference for P4. **Cannot fork** (GPL v3 would force MediCopilot to GPL v3 and kill SaaS). Study the Rust crates they use for audio capture + window management; reimplement cleanly. |
| **Cluely** (closed source) | Proprietary | Product/UX reference for the floating-overlay pattern | Study marketing + public demos; do not reverse-engineer binaries |
| **Retell / Vapi / Bland** (SaaS) | Commercial | Reference for voice-agent plumbing | Used as vendors in P3, not cloned |

**Licensing rule for any reference we consult:** document the source + the
architectural takeaway in the relevant phase doc; do not copy code. If we
ever need a GPL-compatible path (e.g. an open-source community edition),
that's a separate product decision, documented then.

---

## Product vision (north star)

> Every Medicare agent in the US runs MediCopilot alongside their dialer.
> It listens, watches their screen, and makes every call compliant by default —
> no agent ever fails PECL, no MSP is ever forgotten, no client hears their
> name spelled wrong on the enrollment form. Agencies reduce compliance-related
> enrollment reversals by >90%. AEP no longer requires heroics.

---

## Current state (factual baseline, 2026-04-15)

From codebase inspection:

**Shipped in UI (working interactive mocks):**
- `LeadContextPanel` · `CaptureLeadModal` (4-stage mock) · `SwitchLeadModal`
- `ComplianceHub` (elevated PECL) · `ConfidencePill` · `RecordingPill`
- `MspInlineBadge` · `SourcesRow` · `AIResponseCard` · `MediCopilotOverlay`
- Mobile responsive layout, desktop draggable/resizable overlay

**Frozen design spec:** `plans/ui-final-spec.md` (270 lines, comprehensive)

**Missing (foundation):** `CLAUDE.md`, `.env.example`, `vercel.json`, `README.md`,
tests, `src/data/`, `api/` or backend folder

**Missing (real integration):**
- `getDisplayMedia` (currently animated marquee)
- Claude Vision API (currently hardcoded Harold Weaver)
- Sources row wiring to Lead state
- MSP click → AI card `sayThis` insertion
- First-capture consent banner with sessionStorage gate
- Mobile photo-upload fallback
- Loading skeletons

**Code shape:** one monolith, `src/MediCopilot_macOS_Mockup.jsx`, 1,916 lines.
Extraction into components is pending (spec §248–259).

**Dependencies:** React 19, Vite 8, lucide-react. No `@anthropic-ai/sdk`,
no WebSocket, no audio libs, no test runner.

**Git state:** feature branch `claude/medicopilot-launch-planning-6Rmg5`
is fast-forwarded to `main`; clean tree; `v1-demo` tag not yet created.

---

## Scope: what we're building (across all phases)

Functional areas that exist somewhere in the product:

1. **Lead Context** — ingest (OCR/webhook/manual), persist, display, edit, switch, verify
2. **Capture** — screen region OCR (web), photo upload (mobile), webhook push
3. **Transcript** — capture (mic or phone), stream, diarize, timestamp, redact
4. **Compliance** — PECL scoring, MSP reminder, SOA tracking, two-party consent
5. **Plan intelligence** — plan database, drug coverage, provider network, copay lookup
6. **AI suggestions** — trigger detection, contextual cards, script insertion
7. **Telephony** — Twilio DID inbound (demo), eventually outbound dialer integration
8. **Native overlay** — macOS floating window, global hotkey, system-audio capture
9. **Tenancy & billing** — tenant isolation, seat management, Stripe subscriptions
10. **Admin & audit** — per-call audit logs, PECL attestations, compliance reports

Non-goals (explicit, for all phases):
- We do **not** replace the dialer (Five9 stays the source of truth for calls)
- We do **not** enroll clients (agents still submit enrollment in their existing tool)
- We do **not** do final-expense / auto / life insurance (Medicare-only)
- We do **not** do Windows native in P0–P5 (web works on Windows; native later)

---

## Phase 0 — Foundations (1 week)

**Goal:** Make the repo self-documenting, preserve the v1 demo, scaffold the
shape of everything later phases will add.

### Deliverables
- `CLAUDE.md` at repo root: stack, accounts (names not secrets), branch
  conventions, domain glossary (PECL/MSP/MAPD/SOA/AEP/Five9), code
  conventions inferred from existing code, "how to pick this up in a new
  session" checklist
- `.env.example` listing all env vars the product will ever need (even
  empty placeholders for future phases): `ANTHROPIC_API_KEY`,
  `DEEPGRAM_API_KEY`, `TWILIO_*`, `CLERK_*` or `WORKOS_*`, `DATABASE_URL`,
  `STRIPE_*`
- `vercel.json` pinned to main branch for production, with preview
  deploys enabled for all other branches
- Git tag `v1-demo` on the current `main` commit + a second Vercel
  project (`medicopilot-v1`) tracking the tag so the current demo URL
  never goes away
- `README.md` pointing at CLAUDE.md and `plans/`
- `plans/PRD.md` (copy of this file, committed to the repo)
- `src/data/` extraction: move `MOCK_LEADS`, `RECENT_LEADS`,
  `transcriptLines`, `aiResponses`, `peclItems` out of the monolith into
  typed modules (JSDoc typedefs, not TypeScript yet)

### Acceptance
- Any new Claude session started on this repo can read CLAUDE.md + PRD
  and be productive within 60 seconds
- `medicopilot.vercel.app` still serves the current mockup unchanged
- `medicopilot-v1.vercel.app` (or chosen subdomain) serves the frozen
  snapshot independently of ongoing work
- `src/MediCopilot_macOS_Mockup.jsx` imports data instead of declaring it

### Out of scope for P0
No auth, no backend, no component extraction beyond data modules.

---

## Phase 1 — OCR MVP on web (2 weeks)

**Goal:** Replace the mocked Capture flow with real screen capture + Claude
Vision extraction. This is the minimum viable "works in a browser, extracts
a real lead from a real screen" product.

### Deliverables
- Vercel Edge Function at `api/extract-lead` that accepts a cropped image
  (base64 or multipart), calls Claude Sonnet 4.6 with vision, and returns
  a structured `LeadContext` JSON (schema below)
- `CaptureLeadModal` swaps the animated marquee for real
  `navigator.mediaDevices.getDisplayMedia({ video: true })`:
  - User picks a window/screen/tab
  - One frame captured via `OffscreenCanvas`
  - Real crosshair selector over the captured frame (keep current visual)
  - On Extract: POST cropped PNG to the edge function
  - On response: populate `LeadContext` with per-field confidence = `medium`
- Mobile fallback: native file input (`<input type="file" accept="image/*"
  capture="environment">`) that sends a photo to the same endpoint
- Paste fallback: textarea that sends raw text to a sibling endpoint
  `api/extract-lead-text` (cheaper, no vision)
- Real `LeadContext` state management (not just component-local): an `activeLead`
  singleton in React context, persisted to `localStorage` during the session
- `SourcesRow` actually reads from `activeLead` and highlights matching fields
  on hover (teal ring 800ms per spec §A3)
- First-capture consent banner with `sessionStorage` gate per spec §6
- Loading skeletons per spec §A4
- Zero-size-rectangle disabled state per spec §2 error table
- Extract failure / no-fields-found error toasts

### Acceptance
- Agent can capture a Five9 window, drag a rectangle over a real lead
  record, and see their real lead populate the panel in <8 seconds end-to-end
- `activeLead` state is the single source of truth — editing a field in
  the panel updates `SourcesRow` chips on the next AI card render
- Works on latest Chrome + Safari on macOS. iOS Safari uses photo fallback
- Edge function cost per extraction ≤ $0.02
- No Anthropic API key in the client bundle (verified by grep of
  `dist/` output)

### Dependencies added
`@anthropic-ai/sdk` (server-side only), no client-side addition

### Out of scope for P1
Audio, transcript, telephony, auth, tenancy, persistence beyond localStorage,
webhook ingestion. Manual entry still works (spec §2) but has no backend.

---

## Phase 2 — Live transcript + triggered suggestions (2–3 weeks)

**Goal:** Agent can put their phone on speaker (or use a headset). Browser
mic captures both sides. Transcript streams into the overlay. AI suggestions
fire on detected triggers (question asked, medication mentioned, provider
mentioned, MSP not yet covered).

### Deliverables
- Persistent Node backend (Fastify on Fly.io or Railway — NOT Vercel edge,
  which doesn't do long-lived WS) with endpoint `WSS /stream`
- Browser: `getUserMedia({ audio: { echoCancellation: false,
  noiseSuppression: false, autoGainControl: false } })` → MediaStream →
  AudioWorklet → WebSocket audio frames to backend
- Backend proxies audio → Deepgram Nova-3 streaming (diarize: true,
  utterance_end_ms: 1000) → forwards utterance events to the client
- Utterance handler pipes into an AI trigger system:
  - VAD (Voice Activity Detection) via `@ricky0123/vad-web` — cheap local
    signal for "someone is speaking" / "speaker just changed", used to
    segment transcript and gate LLM calls (don't call Claude during silence)
  - Question detection (rule + LLM fallback)
  - Medication / provider NER
  - PECL item detection (which item was just discussed)
- On trigger, call Claude Sonnet 4.6 with: `{ leadContext, transcriptWindow
  (last 120s), triggeredItem, screenContext (if vision ever ran) }` →
  stream structured JSON response matching `AIResponse` schema
- Frontend: replace hardcoded `aiResponses[]` with live stream; cards
  animate in; existing `AIResponseCard` renders them unchanged
- `AudioWave` wired to real `AnalyserNode` — two waves, agent vs. client,
  per spec §5
- `RecordingPill` wired to actual mic state per spec §6
- PECL auto-scoring: when transcript covers an item, its checkbox auto-ticks
  with a small `(auto)` tag next to it; agent can uncheck if disputed
- MSP badge click inserts script into the active AI card's `sayThis` per
  spec §4
- **SMS-OTP auth (open signup)**: phone-only sign-in via Twilio Verify;
  on first verified code, server upserts a row in the `users` table
  (Neon Postgres) and issues a 24h JWT stored in an `httpOnly; Secure;
  SameSite=Lax` cookie. No allowlist — anyone with a phone can register.
  Rate limits: 5 OTP sends / phone / hour. Clerk Organizations replaces
  this at P5 for tenant-scoped auth.
- **Neon Postgres baseline schema** (MVP tables only — tenancy/audit at P5):
  - `users` — id, phone_e164 (unique), display_name, created_at, last_login_at
  - `calls` — id, user_id, started_at, ended_at, lead_snapshot (jsonb), pecl_state (jsonb)
  - `events` — id, call_id, kind, payload (jsonb), at (append-only; thin audit precursor)
- **Plan Data Provider abstraction**: `PlanProvider` interface in
  `server/modules/plans/` with two implementations:
  - `MockPlanProvider` — curated JSON in `src/data/plans/` (3 states
    × top-5 carriers × representative MAPD/PDP shapes) for MVP
  - `CmsPlanProvider` (scaffolded, not active in MVP) — will hit CMS
    Marketplace API for drug RxCUI + coverage, and will ingest the
    CY 2026 machine-readable provider-directory JSONs that carriers
    must publish (same feed CMS crawls daily)
  - Suggestion engine only ever calls the interface; swap is a DI change

### Acceptance
- Agent puts a phone on speaker 12" from the laptop; both voices are
  transcribed; diarization is >90% accurate after 30s of audio
- Triggered AI suggestions appear within 3s of the trigger utterance
- PECL items auto-tick as covered; agent can override
- Transcript redacts anything matching SSN / DOB / credit card regex
  before the UI renders it (compliance)

### Infrastructure added
- Fly.io (or Railway) Node app, one region, $5/mo
- Deepgram account, pay-as-you-go ~$0.004/min
- Backend observability: Axiom or similar, free tier

### Out of scope for P2
Telephony, tenancy. Auth is **in scope** (SMS-OTP) but limited to a hard-coded
myacaexpress phone-number allowlist — no self-serve signup until P5.
External PHI / non-myacaexpress tenants are out of scope until BAAs are signed
at P5.

### P2 status (updated 2026-04-17)

**SHIPPED (P2 complete):**
- Full OCR + live transcript + Claude suggestions pipeline
- Ask AI button end-to-end
- Playwright e2e suite + CI
- Fly.io auto-deploy via GitHub Actions
- Speaker diarization (first-speaker-is-agent + Swap button)
- Call-state management (idle/active/ended)
- Capture Lead with real screen OCR

**NEXT (P2 polish):**
- ~~Training mode (per-call toggle, orange theme)~~ SHIPPED — solo toggle + multi-tester platform
- ~~Push-to-talk in training~~ REPLACED by solo Agent/Client toggle (click-to-switch, Space to toggle)
- Multi-tester training platform: tester identity, scenario library (7 FL personas), auto-save to Postgres, admin dashboard at `/training/admin`, flag moments with context, copy-as-markdown for prompt refinement
- Voice enrollment (optional calibration on first production Start Call)
- Prompt tuning (warmer voice, script-aware, diarization-resilient)

**KNOWN LIMITATIONS → P3:**
- Diarization on speakerphone ~70–80%. Real fix is Twilio softphone with separate audio streams.
- No inbound/outbound call detection — needs softphone integration.

**DECISIONS LOCKED:**
- Training mode = per-call toggle, not persistent
- Voice calibration = optional phrase on first production Start Call
- Training with remote partner = regular phone call on speaker + push-to-talk

---

## Phase 3 — Twilio phone demo (2 weeks, can parallelize with P2)

**Goal:** A hand-outable phone number. Anyone calls it, talks to "Maria the
AI Medicare shopper" (a demo persona — the AI is the *caller*, not the agent),
MediCopilot UI in the room visibly reacts to the call. Used for demos,
investor calls, and as the foundation for future "AI shopper" product.

### Deliverables
- Twilio DID ($1/mo), pointed at either:
  - **Recommended:** Retell AI (SaaS on top of Twilio) — we define system
    prompt + tool schema, Retell handles STT/TTS/barge-in
  - **Alt:** Twilio ConversationRelay directly, our backend owns the LLM
- System prompt + tool definitions for the AI caller:
  - Tools: `lookup_plans(zip, medications, providers)`, `explain_coverage`,
    `ask_followup(question)`, `end_call(reason)`
  - Persona: "Maria Garcia, 68, in Pembroke Pines, asking a Medicare agent
    about plan options" — the AI is role-playing a *client*, not a selling agent
- MediCopilot UI can "attach" to a phone call: the transcript of the call
  renders live in the overlay; the same trigger + suggestion pipeline from
  P2 fires, showing *what an agent should say* to this AI caller
- Demo mode toggle in the UI: "Connected to demo line · 📞 +1-XXX-XXX-XXXX"

### Acceptance
- External caller dials the number; gets an AI conversation indistinguishable
  from a real Medicare shopper for >60s before "breakdown"
- Shawn can demo the product by handing someone the phone number and
  sharing his screen — the overlay visibly reacts to the call
- Cost per 5-minute demo call ≤ $0.25

### Out of scope for P3
The AI agent *calling out* to clients (outbound), agent-initiated calls,
call recording storage, call history UI. This is a demo mechanism first.

---

## Phase 4 — macOS native wrapper (3 weeks)

**Goal:** Eliminate the friction of "is the app open", "did I allow screen
share", "is speakerphone loud enough." Ship a proper Cluely-style overlay
that floats over Five9, captures the Mac's *system audio* directly (no
speakerphone required), and toggles with a global hotkey.

### Deliverables
- Tauri 2.x shell wrapping the existing React app (>95% code reuse)
- Transparent, always-on-top `NSWindow` at `.floating` level; custom
  hit-testing so clicks pass through to underlying apps except on the
  copilot card itself
- Global hotkey (default Cmd+\\) toggles visibility
- Screen recording permission granted once in System Settings; then
  `ScreenCaptureKit`-based frame capture without per-session prompts
- System audio capture:
  - macOS 14.4+: Core Audio Taps (native API, no user install)
  - macOS ≤14.3: detect + fall back to "please install BlackHole" guide,
    or mic-only mode
- Notarized DMG build pipeline (GitHub Actions), signed with Apple
  Developer ID; auto-updater via `tauri-plugin-updater`
- Menu bar icon + "Quit / Preferences / Install Updates" menu
- **Optional auto call-start detection via macOS CallKit + Continuity**
  for iPhone-on-Mac users, with a confirmation prompt before
  transcription begins to avoid capturing personal calls. Falls back
  to the Start Call button for Android users, Windows users, and
  anyone who disables auto-detect in settings. The button is the
  primary mechanism; auto-detect is a convenience layer.

  **Note on the real zero-friction path:** for call-center agents
  (our actual ICP), the friction-free workflow is **dialer
  integration**, not OS-level call detection — P3 ships a Twilio
  demo DID that fires call-start webhooks into the copilot, and P5
  adds the Five9 webhook integration. CallKit is a nice-to-have for
  solo agents using their iPhone through Continuity; it is not the
  primary path to "no button press."

**Architectural reference:** Pluely (see Reference Implementations above)
demonstrates this exact stack at ~10MB bundle and <100ms startup. Study
their Rust crates for audio tap + window management; reimplement under our
own license. Do **not** fork (GPL v3).

### Acceptance
- Agent installs DMG, grants Screen Recording + Microphone once, never
  prompted again
- Global hotkey hides/shows overlay in <100ms
- System audio from Zoom/Teams/FaceTime call is captured and
  transcribed without the phone being on speaker
- Bundle size ≤15MB target (Pluely proves ~10MB is achievable; allow
  headroom for our deps), hard cap 30MB

### Out of scope for P4
Windows native (Tauri supports it; defer to post-P5), TestFlight / App
Store distribution, iOS companion app.

---

## Phase 5 — SaaS productization (3 weeks)

**Goal:** Multi-tenant, billable, auditable. Another agency can sign up and
use the product without Shawn touching anything.

### Deliverables
- Auth: Clerk or WorkOS for SSO + org/team support
- Tenant isolation: `tenant_id` on every row; Postgres (Neon/Supabase)
  with row-level security policies
- Billing: Stripe subscriptions, per-seat pricing (proposal: $49/seat/mo
  monthly, $39/seat/mo annual, 14-day trial). Stripe MCP tools available
  for implementation
- Audit logs table: every PECL item completion, every lead capture, every
  AI suggestion shown, retained per HIPAA requirements (6 years)
- Admin console: user/seat management, call history, PECL compliance
  reports per agent, export to CSV for CMS audits
- HIPAA posture: BAAs with Anthropic, Deepgram, Twilio, Clerk/WorkOS,
  Neon/Supabase, Vercel (or host backend on HIPAA-eligible infra).
  Encryption at rest + in transit. PII redaction in transcripts before
  storage
- Onboarding flow: agency admin signs up → adds agents by email → agents
  install macOS app or bookmark web app → first-call walkthrough

### Acceptance
- Second agency signs up end-to-end via self-serve with zero Shawn time
- Compliance officer can pull a CSV of PECL completion rates per agent
  for the last 30 days
- All PHI storage is encrypted, redacted where possible, and covered by
  a BAA

### Out of scope for P5
Enterprise SSO beyond WorkOS defaults, SOC 2 Type II (defer to post-P5,
start evidence collection now), on-prem deployment.

---

## Data models (canonical)

Defined once here. P0 extracts from monolith into `src/data/`; P2+ adds the
same shapes to the backend DB.

```ts
// LeadContext — single source of truth for "who is on the call"
type LeadContext = {
  id: string;                    // "captured_<ts>" | "five9_<sfdcId>" | "webhook_<uuid>"
  source: "manual"|"vision"|"webhook"|"five9"|"paste";
  fields: {
    firstName:  FieldValue<string>;
    lastName:   FieldValue<string>;
    dob:        FieldValue<string>;  // ISO
    phone:      FieldValue<string>;  // E.164
    address:    FieldValue<{ street?, city?, state, zip }>;
    coverage:   FieldValue<"OM"|"MA"|"MAPD"|"PDP"|"DUAL"|"UNKNOWN">;
    medications:FieldValue<string[]>;
    providers:  FieldValue<string[]>;
  };
  createdAt: string; updatedAt: string;
};
type FieldValue<T> = {
  v: T;
  confidence: "verified"|"high"|"medium"|"low";
  source: "manual"|"vision"|"webhook"|"five9"|"agent-confirmed";
  lastEditedAt: string;
};

// AIResponse — what an AI card renders from
type AIResponse = {
  id: string;
  triggeredBy: { utteranceId?: string; text: string; type: "question"|"med"|"provider"|"pecl" };
  context: { screen: string; audio: string };
  sayThis: string;               // primary talking point
  pressMore?: string[];          // follow-on beats
  followUps?: string[];          // questions for the client
  plans?: PlanSummary[];         // plan cards if applicable
  compliance?: string;
  script?: string;               // full script block
  sources: Array<"zip"|"dob"|"rx"|"provider"|"coverage"|"plan">;
};

// PECLState — compliance scoring per call
type PECLState = {
  callId: string;
  items: Record<"tpmo"|"lis"|"msp"|"medigap"|"soa", {
    done: boolean;
    coveredBy: "manual"|"auto-transcript";
    coveredAt?: string;
    utteranceId?: string;
  }>;
};

// Tenant (P5) — for SaaS
type Tenant = { id: string; name: string; stripeCustomerId: string; plan: "trial"|"monthly"|"annual"; seats: number; hipaaBaaSignedAt: string };
type User   = { id: string; tenantId: string; email: string; role: "admin"|"agent"|"compliance"; npn?: string /* licensed agent number */ };
type CallRecord = { id: string; tenantId: string; userId: string; leadId: string; startedAt; endedAt; duration; pecl: PECLState; transcriptUrl: string; };
```

---

## Compliance requirements (cross-cutting, baked in from P0)

1. **PECL (Pre-Enrollment Checklist)** — CMS requires these items be covered
   before Medicare enrollment: TPMO disclosure, LIS (Extra Help) screening,
   MSP offer, Medigap vs. MA distinction, SOA (Scope of Appointment) status.
   PECLState persisted per call (P5).
2. **TPMO** — Third Party Marketing Organization disclosure: required on
   every call where agent represents multiple carriers. A pre-recorded
   spiel in the first 30s. MediCopilot surfaces the exact script.
3. **Two-party-consent states** (CA, FL, IL, MD, MA, MT, NH, PA, WA + others
   — keep list in `src/data/compliance/states.ts`): recording disclosure
   must be explicit. Consent banner turns amber + stronger copy when
   lead's state is two-party.
4. **HIPAA** (P5 gating): Medicare PII + health data = PHI-adjacent.
   Requires BAAs with every subprocessor, encryption at rest + in
   transit, redaction of SSN / DOB / card numbers in transcripts before
   storage, 6-year audit log retention.
5. **CMS call recording** — some carriers require full call recording for
   AEP. MediCopilot does not replace the dialer's recording, but its
   audit logs are a parallel compliance record.
6. **State of FL (Shawn's primary market)** — two-party consent, licensure
   check required on agent, additional MSP screening language.

Design rule: **every compliance requirement is enforced in the data model
+ prompt, not just the UI.** If we ever build a non-UI client (API, mobile,
etc.) it should be compliant by construction.

---

## Architecture

### Current (web mockup)
```
Browser (Vite+React) → medicopilot.vercel.app (static CDN)
```

### Target end state (after P5)
```
┌──────────────────────────────────────────────────────────────┐
│  Agent's Mac                                                 │
│   ├─ Tauri shell (native window, global hotkey)              │
│   │    └─ React UI (same code as web)                        │
│   ├─ ScreenCaptureKit (frames) ──────────┐                   │
│   └─ Core Audio Tap (system audio) ──────┤                   │
└──────────────────────────────────────────┼──────────────────-┘
                                           ▼
                          WSS  ─────► Fastify backend (Fly.io)
                                        ├─ Deepgram proxy (streaming STT)
                                        ├─ Claude Sonnet 4.6 (suggestions)
                                        ├─ Claude vision (OCR extract)
                                        ├─ Twilio webhook handler (P3)
                                        ├─ PECL scoring engine
                                        └─ Audit log writer
                                           │
                              Postgres (Neon) · S3 (transcripts) · Stripe · Clerk
```

### Why this split
- **Edge function** (Vercel) for fast stateless endpoints: lead extraction,
  paste parse — short-lived, cold-start-tolerant.
- **Long-lived Node server** (Fly.io) for WebSocket streams — edge
  functions can't hold a WS for call duration.
- **Native wrapper** (Tauri) only for the things the browser can't do:
  floating overlay, global hotkey, system audio, persistent screen
  permission. The UI is the same React code.

---

## Non-functional requirements

| Area | Requirement | Phase |
|---|---|---|
| **Latency** | Trigger → card rendered ≤ 3s p95 | P2 |
| **Latency** | Lead extraction end-to-end ≤ 8s p95 | P1 |
| **Accuracy** | Diarization ≥ 90% after 30s warm-up | P2 |
| **Uptime** | 99.5% during AEP, 99.0% off-season | P5 |
| **Cost** | ≤ $0.15/call variable cost at steady state | P5 |
| **Bundle size** | Web: ≤ 500KB gzipped initial; Tauri DMG ≤ 30MB | All |
| **Security** | Secrets server-side only; audit via `grep` in CI | All |
| **Privacy** | PII redacted pre-storage (SSN/DOB/card regex) | P2+ |

---

## Testing strategy

Testing scales with risk. We do **not** TDD UI polish; we do harden the
contracts that a mistake would leak PHI or break a call.

| Phase | Unit | Integration | E2E / manual | Tooling |
|---|---|---|---|---|
| P0 | `src/data/` shape tests | — | Manual: visit both Vercel URLs, confirm snapshots | Vitest |
| P1 | `LeadContext` reducer + edge function handler | Edge function with a frozen PNG fixture → assert structured JSON | Manual: real Five9 screen on staging; capture → review | Vitest, MSW |
| P2 | Utterance→trigger classifier; PII redactor | Deepgram WS mock → suggestion pipeline | Scripted call: Shawn reads a known transcript, assert expected cards | Playwright (headed for mic permission) |
| P3 | AI tool schemas | Twilio webhook → Retell → our WSS echo | Manual: dial the DID, verify overlay updates | Twilio test credentials |
| P4 | Tauri IPC shim unit tests | Native audio tap → transcript round-trip | Manual: macOS install → permission grant → live call | Tauri test harness |
| P5 | Tenant isolation + RLS policy tests | Stripe webhook → subscription state; BAA evidence checklist | Two tenants in parallel, confirm no cross-visibility | Vitest + Playwright |

**Rules that apply every phase:**
- Any code that touches PII has a test with a known PII fixture asserting
  redaction happens before any network I/O
- Any prompt that drives compliance (PECL, MSP, TPMO, SOA) has a
  prompt-regression test — golden inputs + expected output keys
- CI gate: linting, typecheck (JSDoc for now, TS later), test suite must
  pass before a PR can merge to `main`

---

## Accessibility (a11y) & internationalization (i18n)

### Accessibility (all phases)
- **Keyboard navigation** for every action — Capture Lead, Switch Lead,
  MSP insert, card dismissal, checklist toggles
- **Screen reader labels** on all icon-only buttons (Lucide icons are
  decorative by default — add `aria-label`)
- **Text scaling** is already a prop in the existing UI (`scaledFont`);
  wire it to a user preference stored in `localStorage`, respect system
  `prefers-reduced-motion`
- **Color contrast** — the glassmorphic theme occasionally falls below WCAG
  AA on `rgba(255,255,255,0.35)` body text; add a dark-background contrast
  check in the Vitest visual suite (Storybook + axe-core) at P2
- **Focus management** — modals (Capture, Switch) must trap focus and
  return focus on close

### Internationalization (deferred but structured-for)
- English only for P0–P5. **Spanish is the most valuable next locale**
  (FL + TX + CA Medicare-beneficiary Hispanic populations are material).
- P0 structure decision: wrap all user-facing strings in a `t()` function
  from day one, even though only English exists. Using `lingui` or
  `react-intl` with extracted message catalogs means adding Spanish is a
  translation PR, not a refactor.
- **PECL / compliance scripts** — these have legally-reviewed Spanish
  equivalents already; carrying them in `src/data/compliance/{en,es}/`
  keeps the legal review auditable
- **Transcript + STT** — Deepgram Nova-3 supports Spanish; language
  detection per utterance is trivial. Defer full bilingual-call UX to
  post-P5 but don't lock it out of the data model

---

## Degradation & error handling

What happens when a dependency dies mid-call. Each failure mode has a
predefined UX, not "whatever the browser does."

| Failure | UX fallback | Implementation notes |
|---|---|---|
| Claude API 5xx or rate-limited | Last AI card stays visible; subtle amber "Suggestions paused" pill in header; local rule-based fallback fires PECL reminders | Client retries with exponential backoff; server caches last N responses per call |
| Deepgram WS drops | Transcript area shows "Reconnecting…" banner; audio buffer continues locally; flush on reconnect | Client buffers last 30s in `AudioWorklet`; replay on reconnect |
| Vercel edge cold start | Extract button shows "Warming up…" for >2s; no user-visible error | Acceptable, documented |
| Vision extraction returns empty | Amber toast "No lead info found"; keep overlay open; suggest paste fallback | Per spec §2 error table |
| `getDisplayMedia` denied | Inline banner in Lead panel with "Grant screen access" + "Enter manually" CTAs | Per spec §2 |
| Mic permission denied | Suggestions pipeline switches to OCR-only mode; banner explains | All other features work |
| Network entirely offline | Toast "Offline — your lead is saved locally"; enable review/edit of last captured lead; disable capture | `localStorage` is always the truth for the active lead |
| Twilio call drops (P3 demo) | Demo status pill flips to "Call ended"; UI retains transcript for review | |
| Backend (Fastify) down (P2+) | Card suggestions blank; transcript shows local-echo mode (STT direct from client if feasible as emergency path); amber banner | Never silently fail |

**Principle:** the product is useful at each degraded level. If suggestions
die, transcript keeps going. If transcript dies, OCR keeps working. If OCR
dies, manual entry keeps working. **No failure should make the whole app
unusable.** An agent mid-call cannot afford a blank screen.

---

## Telemetry & user privacy (separate from PHI)

What we collect *about the agent using the product*, never co-mingled with
client PHI. Stored in a separate analytics store with its own retention.

| Event | Payload | Purpose |
|---|---|---|
| `session_started` | tenant, user, app_version, platform | Adoption |
| `lead_captured` | method (vision/paste/manual), duration_ms, field_count | Activation metric |
| `suggestion_shown` | type, trigger, response_time_ms | Retention / quality |
| `suggestion_dismissed` | response_id, was_used (bool), used_snippet_ids[] | Quality loop |
| `pecl_item_covered` | item_id, method (auto/manual) | Compliance telemetry |
| `error_shown` | error_kind, context | Reliability |
| `hotkey_pressed` (P4) | action | Native adoption |

**Do not collect:** client names, DOBs, phone numbers, addresses, transcripts,
medication names, provider names, plan selections, or any field from
`LeadContext`. Tenant aggregate analytics are fine; per-client analytics are
PHI and live in the HIPAA-covered store.

**Tool:** PostHog self-hosted (or cloud with BAA at P5), not a generic product
analytics tool that lacks HIPAA posture.

**User controls:** tenants can toggle product telemetry off at org level.
PHI logging is never toggle-able — it's either there (audit logs) or redacted.

---

## Success metrics

- **Activation (P1):** % of agents who complete one real lead capture in
  their first session → target 70%
- **Retention (P2):** weekly active agents / monthly active agents → target 60%
- **Compliance (P5):** PECL completion rate per call → target 95% (baseline
  industry ~60% self-reported)
- **Enrollment conversion lift (P5):** close rate on calls with MediCopilot
  vs. without → target +15% across pilot agency
- **Compliance reversals (P5):** enrollments reversed due to missed PECL
  items → target -90% vs. baseline
- **Business (P5):** 3 paying agencies by end of first AEP using the
  product (Oct–Dec of the first year post-P5)

---

## Go-to-market (GTM)

### First customers (pilot wedge)
- **myacaexpress itself** is customer zero — dogfood during spring/summer
  off-season, iterate against real calls, then open to outside agencies
  for AEP
- **Target pilot profile:** independent Medicare FMOs (Field Marketing
  Organizations) with 10–50 agents. Small enough to sign in a call, big
  enough for meaningful telemetry. Typically founder-led, compliance-
  anxious, tooling-starved.
- **Hostile profile (avoid early):** carrier-captive agencies (need
  carrier IT approval), 500+ agent call centers (long procurement, want
  enterprise SSO + SOC 2 that we don't have yet)

### Acquisition channels (ranked by expected ROI in the first year)
1. **Shawn's network** — FL Medicare agent community, LinkedIn + direct
   outreach. Free, high conversion, limited ceiling.
2. **Content + SEO** — "Medicare PECL checklist 2026", "Medicare Savings
   Programs script for agents" — domain-rich posts that rank and demo
   the product at the bottom of the funnel. Sustainable pipeline.
3. **AEP conferences + agency-owner forums** — AHIP events, NAIFA,
   Medicarians. Expensive, good for enterprise pilots.
4. **Referrals + case studies** — lagging indicator from (1–3) but
   becomes the dominant channel after two cycles.

### Demo mechanics
- P3's hand-outable Twilio number is the shortest distance to "aha" — a
  prospect can dial it from the conference floor
- Screen-share demo of a real agent using it on a simulated call is the
  primary sales asset
- Free trial = 14-day full product; no credit card; agents must sign a
  HIPAA attestation before onboarding

### Pricing rationale (proposal; validate with pilot interviews)
- **$49/seat/mo monthly, $39/seat/mo annual** → blended ARPU ~$42
- **Anchor comparisons:**
  - SunFire (quote tool): ~$75/seat/mo, Medicare-specific, no AI
  - Gong (call intel): $100–$200+/seat/mo, enterprise
  - Cluely consumer: $20/mo prosumer — too low for B2B compliance value
- **Unit economics at target:**
  - $42 ARPU – ~$15 variable cost/month (vision + STT + LLM + infra) = $27 gross margin/seat
  - Target: ≥50% gross margin in year 1, ≥70% after scale
- **Discount mechanics:** 3 free seats for any agency that publishes a
  case study; 15% AEP ramp discount (tenants pay annual at 25% discount
  in exchange for a full AEP commitment)
- **What pricing is NOT:** usage-based per call (causes anxiety during
  AEP when call volume 4x's), success-based on enrollments (regulatory
  minefield — implies MediCopilot is compensated on enrollment)

### First-year targets (rough, update post-pilot)
- **Q1 (spring):** myacaexpress-only dogfood, 0 paid
- **Q2:** 2–3 pilot agencies, paid at discount, ~30 seats total
- **Q3:** AEP prep, 10 pilot agencies, ~200 seats
- **Q4 (AEP):** sustain + iterate; commitment targets set after Q3 data

---

## Risks & mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| macOS permissions friction kills conversion | High | Med | Ship web-first, only go native when users ask |
| Diarization fails on poor-quality speakerphone | High | High | Speaker system-audio capture in P4 eliminates; P2 documents calibration |
| CMS rules change mid-AEP | Med | Low | Compliance data in `src/data/compliance/`, not hardcoded; update path is a PR |
| Five9 integration requires partnership | Med | Med | Treat OCR as the universal fallback so we never *require* a Five9 API deal |
| Claude API rate limits during AEP peak | High | Med | Anthropic enterprise tier + aggressive caching + Sonnet fallbacks to Haiku |
| HIPAA BAA blockers delay P5 | Med | Low | Start BAA requests at start of P1; most vendors have self-serve now |
| Tauri transparent window ships white in DMG ([#13415](https://github.com/tauri-apps/tauri/issues/13415)) | Med (P4 only) | Med | Budget a P4-start spike on current Tauri nightly. If unfixed, ship opaque window with CSS `backdrop-filter: blur(20px)` — visually near-identical; re-enable true transparency when upstream resolves. |
| CMS Marketplace API deprecations / schema drift | Med | Low | `PlanProvider` interface abstracts the source; swap to cached snapshot on drift; monitor developer.cms.gov changelog |
| Competing product ships Cluely-for-Medicare first | Med | Med | Velocity is the moat; P1 ships in 2 weeks. Domain depth (PECL/MSP) is the other moat |
| iOS Safari has no `getDisplayMedia` | Low | Certain | Photo-upload fallback in P1 covers it |

---

## Open questions (decide before we hit each phase)

Each question has a recommendation, a decision owner, and a deadline
(expressed as "by end of phase X" so we can gate progress on it).

| # | Question | Recommendation | Decide by |
|---|---|---|---|
| 1 | Backend host: Fly.io vs. Railway vs. Render | **Fly.io** (regional latency) | End of P1 |
| 2 | STT vendor: Deepgram vs. AssemblyAI vs. Whisper self-hosted | **Deepgram** (streaming + diarization quality) | Start of P2 |
| 3 | Auth vendor for MVP and for P5 | **MVP: Twilio Verify SMS-OTP + self-issued JWT, open signup** (phone-only; anyone with a phone can register; `users` table persists account on first verified code). **P5: Clerk Organizations** when tenancy lands. Resolved 2026-04-15. | ✓ Resolved |
| 4 | Telephony path: Retell AI vs. ConversationRelay | **Retell** for P3 demo; revisit at P5 if cost/control forces it | Start of P3 |
| 5 | Plan database: build from CMS vs. license (SunFire/Connecture) | **MVP: hand-curated mock data in `src/data/plans/` behind a `PlanProvider` interface.** **P2+: real data via CMS Marketplace API (drug autocomplete, RxCUI, plan coverage) + CY 2026 carrier machine-readable provider directory JSONs (CMS ingests daily — piggyback on the same feeds).** MARx itself has no public API; carrier-portal integration deferred post-P5. Resolved 2026-04-15. | ✓ Resolved |
| 6 | Licensure gating: enforce NPN/AHIP check pre-activation | **Yes** — blocks PHI access until attestation complete | Start of P5 |
| 7 | Pricing validation: is $49/$39/seat right | **Validate via 3 pilot interviews** during P1/P2 | End of P2 |
| 8 | Outbound dialer vs. integration | **Integration-only** ("Switzerland" play) | Deferred — revisit post-P5 |
| 9 | JS → TS migration | **JSDoc in P0; full TS in P2** when backend lands | Start of P2 |
| 10 | Spanish locale: in P5 or deferred | **Structured-for in P0; catalog deferred post-P5.** Resolved 2026-04-15. | ✓ Resolved |
| 11 | Stealth mode: should the overlay be invisible in screen shares (Pluely-style) or openly visible? | **Openly visible by default.** Medicare agents are QA'd and compliance-audited; stealth could violate carrier contracts. Offer an "invisible in screen shares" toggle for agencies that allow it, off by default. | Start of P4 |
| 12 | PII-to-Anthropic redaction policy | **Pass first name / DOB / meds into the Claude suggestion prompt (necessary for personalization). Only SSN / card / phone-number regex redaction applies.** Comfortable under Anthropic BAA at P5; acceptable for internal-only MVP dogfood. Resolved 2026-04-15. | ✓ Resolved |
| 13 | MVP privacy / BAA timing | **MVP is myacaexpress-internal dogfood only; no BAAs required until P5 when external tenants onboard.** All vendor BAAs signed before first non-myacaexpress tenant is provisioned. Resolved 2026-04-15. | ✓ Resolved |
| 14 | Observability + telemetry stack | **Sentry (errors) + Axiom (logs/traces) + PostHog self-hosted (product analytics, no PHI).** Resolved 2026-04-15. | ✓ Resolved |
| 15 | Deployment regions for MVP | **Single region: Fly.io `iad` (US East).** Multi-region revisit at P5 when West Coast pilots onboard. Resolved 2026-04-15. | ✓ Resolved |
| 16 | Database: when and which | **Neon Postgres from MVP (was P5).** Open SMS-OTP signup needs a durable `users` table; pulling Neon in from day one avoids a later migration. Branching-per-preview-deploy; HIPAA BAA activates at P5 with no schema change. Resolved 2026-04-15. | ✓ Resolved |

---

## Deferred / explicitly out of roadmap

Things we know we want but are not in P0–P5. If a request matches this
list, the answer is "yes eventually, not now." Listed so scope creep is
rejectable by reference.

- **Windows native app** — Tauri supports it; defer to post-P5 when web
  demand shows a clear Windows-heavy customer
- **iOS / Android companion app** — agents don't work calls from phones;
  low ROI until we have a "supervisor mode" for agency admins
- **Outbound AI dialer** (AI calls clients on behalf of agents) —
  regulatory nightmare with TCPA / CMS, not our moat
- **SOC 2 Type II** — start evidence collection in P5, pursue certification
  post-P5 when enterprise demand is real
- **HITRUST** — only if pursued by a carrier pilot
- **Spanish (and additional locales)** — structured-for in P0; full
  translation not in budget until a pilot agency requests it
- **Call recording / storage** — the dialer already records; we don't
  double-record. We do retain transcripts.
- **Supervisor live-listen** — an admin listening to an agent's live call
  with suggestions. Good feature, bad priority; after P5.
- **CRM write-back** (push MediCopilot notes into Salesforce/HubSpot) —
  commonly requested; defer until pilot agencies are concentrated on one CRM
- **Generalization to ACA / auto / final expense** — explicit tech debt;
  wait for a customer asking to pay for it
- **Benchmarks / leaderboards across agents** — easy to ship, bad for
  morale, non-compliant with some carrier contracts

---

## Glossary

- **AEP** — Annual Enrollment Period (Oct 15 – Dec 7). Medicare's high season.
- **MAPD** — Medicare Advantage Prescription Drug plan (Part C + D combined).
- **PDP** — Prescription Drug Plan (Part D alone).
- **MA** — Medicare Advantage.
- **OM** — Original Medicare (Parts A + B).
- **PECL** — Pre-Enrollment Checklist. CMS-required script.
- **MSP** — Medicare Savings Programs. State programs for low-income Part B premium help.
- **LIS** — Low-Income Subsidy / Extra Help. Part D cost assistance.
- **SOA** — Scope of Appointment. CMS form agents must get signed.
- **TPMO** — Third Party Marketing Organization. Disclosure required up front.
- **NPN** — National Producer Number. Agent's license ID.
- **AHIP** — Industry certification agents must pass annually.
- **Five9** — Major cloud dialer / contact-center platform used in call centers.
- **Cluely-style** — Floating AI overlay pattern: transparent window, live mic + screen, contextual suggestions.
- **DID** — Direct Inward Dial. A phone number you can call.

---

## Critical files this PRD references

| Path | Purpose |
|---|---|
| `src/MediCopilot_macOS_Mockup.jsx` | Current monolith (1,916 lines) to refactor in P0 |
| `plans/ui-final-spec.md` | Frozen UI/UX spec, authoritative for visual behavior |
| `plans/ui-mockup.html` / `plans/ui-integrated-mockup.html` | Static HTML references |
| `package.json` | Deps baseline; vision/audio/test deps added per phase |
| `src/data/` (to be created in P0) | Extracted data modules: leads, responses, pecl, compliance |
| `api/extract-lead.ts` (to be created in P1) | Vercel Edge Function for vision OCR |
| `server/` (to be created in P2) | Fastify backend, WebSocket + Deepgram proxy |
| `src-tauri/` (to be created in P4) | Tauri wrapper config |
| `CLAUDE.md` (to be created in P0) | Durable project context |
| `.env.example` (to be created in P0) | Full env var template for all phases |

---

## Verification (how to know this PRD is done, not just drafted)

1. **Structural:** Every phase has goals, deliverables, acceptance
   criteria, out-of-scope. Every compliance requirement is mapped to a
   data model or prompt. Every open question has a recommendation + a
   decision deadline tied to a phase gate.
2. **Consistency:** Cross-references (e.g. spec §2 in the P1 section)
   resolve to real sections in `plans/ui-final-spec.md` or this PRD.
3. **Actionability:** A fresh Claude session can read CLAUDE.md + this
   PRD + `ui-final-spec.md` and pick up P1 work without further context.
4. **Sign-off:** Shawn reviews and either approves or marks specific
   sections with `TBD` / `REVISIT`. Sections without sign-off remain in
   "draft" state and do not drive engineering.

---

## Execution (on PRD approval)

When this PRD is approved, these are the immediate follow-up actions
(post-plan-mode, not done here):

1. Create `plans/PRD.md` in the repo with the content of this file
2. Commit to `claude/medicopilot-launch-planning-6Rmg5`, push
3. Begin **P0 execution**: draft `CLAUDE.md`, `.env.example`, `vercel.json`,
   tag `v1-demo`, extract `src/data/` modules
4. Schedule P1 kickoff once P0 foundations merge

This PRD is a living document. Updates happen on branch with the change
they justify; major scope changes (e.g. adding a new phase or flipping a
non-goal to a goal) require a new PRD version bump.

---
*End of PRD v0.5*


