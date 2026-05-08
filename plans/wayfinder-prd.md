# Wayfinder — Product Requirements

**Status:** P0 (greenfield).
**Date:** 2026-05-08.
**Owner:** Shawn / Trifecta Benefits ("TriBe").
**Compliance owner:** Michael.
**Supersedes:** [`plans/PRD.md`](PRD.md) (legacy MediCopilot PRD, retained as historical reference; v1 demo preserved at git tag `v1-demo`).
**Companion doc:** [`plans/wayfinder-adrs.md`](wayfinder-adrs.md) — catalog of 84 architecture decisions captured during the design grill.

---

## TL;DR

Wayfinder is **TriBe's internal real-time AI agent platform**. It is a softphone + on-screen AI coach + native CRM that owns the call from inbound DID through enrollment.

Built **HIPAA-first on a single cloud (GCP)** with **3 BAAs total** (GCP, Postmark, Telnyx), targeting Medicare at MVP and expanding to Final Expense / ACA / Life as product packs. Live-call AI uses **on-device Tier 0 (Gemma E4B) + cloud Tier 2 (Gemini Flash)** for sub-second coaching, with a **verbatim catalog** for compliance text (no LLM in the compliance-critical path).

Expected operating cost: **~$365–525/mo at 3 agents, ~$820–940/mo at 10 agents** — replacing Five9 (~$1,500–2,000/mo) plus most third-party SaaS (CRM, quoting, telephony) with one integrated stack.

The Tesla-full-self-drive analogy: Wayfinder coaches the agent through every call, the agent stays in control, and an agent-pressed "blinker" lets them direct cross-product transitions.

---

## Strategic positioning

| Frame | Detail |
|---|---|
| **Who builds it** | TriBe internal engineering (single-tenant). |
| **Who uses it** | TriBe's own licensed agents (3 today, ~10 within 12 months). |
| **Who else can use it** | No one yet. Multi-tenant deferred indefinitely; data model carries `agency_id` from day one to preserve future optionality. |
| **What it competes with for TriBe's spend** | Five9 / Convoso (dialer), HubSpot or AgencyBloc (CRM), MedicareCopilot™ / Sunfire / ConnectureDRX (quoting + enrollment back end). |
| **Why build vs. buy** | (1) Multi-product roadmap (MedicareCopilot is locked to Medicare); (2) softphone + lead-vendor-routing ownership creates ad-spend ROI moat; (3) recruiting wedge (*"work at TriBe, get tools other agents can't have"*); (4) IP optionality if TriBe ever licenses externally. |

---

## Product surface

### Mac app (Tauri 2.x, Apple Silicon, macOS 14+)

The **live-call surface only.** Agent's primary tool during inbound calls.

- WebRTC softphone client (Telnyx)
- AI coaching overlay (always-on-top, draggable)
- Tier 0 Gemma E4B inference (local, ~3.5 GB model downloaded on first launch)
- Native notifications, menu bar, system tray
- Encrypted local cache (UI state + creds via Keychain)
- FileVault required; cache wipe on logout

Direct DMG distribution via TriBe internal portal. Auto-update via Tauri updater. Code-signed + notarized. arm64-only. macOS 14 (Sonoma) minimum.

### Web app (React 19 + Vite)

Everything except the live call.

- **Training mode** (mock data; no PHI): scenario practice, push-to-talk, scoring
- **Admin / CRM**: Lightfield-pattern AI-native — contacts, activity timeline, click-to-call, click-to-text, click-to-email, natural-language search, workflow builder with AI steps
- **Lead-vendor performance dashboard**: real-time spend, ROI by vendor, dispute queue, persistency tracking
- **Compliance officer dashboard** (Michael's view): real-time alerts, LLM-judge review queue, license/AHIP grid, AEP cockpit, investigation workbench, breach response runbook, pre-built external report templates (CMS audit, carrier vendor questionnaire, annual HIPAA risk assessment)
- **Manager scoped view**: team-only metrics, no audit log raw access

---

## Architecture

### Single-cloud GCP, 3 BAAs

| Vendor | Covers | BAA |
|---|---|---|
| **Google Cloud Platform** | Cloud Run, Cloud SQL, GCS, Cloud Logging, KMS, Secret Manager, Cloud Tasks, Pub/Sub, Cloud CDN, Vertex AI Model Garden | Self-service, free |
| **Postmark** | Transactional email | Standard plan, ~$15–25/mo |
| **Telnyx** | SIP voice + DIDs + SMS messaging | Required for softphone |

Three GCP projects: `wayfinder-dev`, `wayfinder-staging`, `wayfinder-prod`. VPC Service Controls perimeter on prod. Org-level audit logging on. MFA enforced. (ADR-001)

### Live-call AI — two streams + verbatim catalog

Per call, **5 streams running concurrently**:

| Stream | Where | What | Latency target |
|---|---|---|---|
| 1. Audio per leg → Whisper | Cloud Run (server-side) | Transcribe each leg independently | ~300ms |
| 2. Trigger classifier | Cloud Run | Rule-based med / provider / PECL / question detection | <10ms |
| 3. Tier 0 — Gemma E4B local | Mac app | Verbatim script-completion detection + acks + offline fallback | <150ms |
| 4. Tier 2 — Gemini Flash | Vertex Model Garden | Coaching suggestion (streamed) | ≤900ms p95 first token |
| 5. PECL state machine | Cloud Run | Deterministic — tracks covered items, advances `requiredNext` | <1ms |

Streams 1, 2, 5 are deterministic. Streams 3 and 4 are the LLM calls. (ADRs 002, 003, 011, 015)

**Verbatim CMS text — NO LLM in the compliance-critical path.** Pulled from a versioned static catalog (TPMO / MSP / LIS / Medigap / SOA scripts). The trigger classifier returns a `verbatim_id`; UI renders canonical text. Eliminates compliance liability of LLM paraphrasing. (ADR-002, ADR-058)

**Tier 0 verbatim detection** (ADR-011): Gemma E4B fuzzy-matches the agent leg's transcript against canonical verbatim text. Item ticks only on score ≥ 0.85 + required phrases present. Audit log records `delivered_at`, `match_score`, transcript snippet — defensible if a carrier asks *"prove the TPMO ran."*

### Per-leg SIP topology = 100% reliable speaker tagging

Wayfinder is the call-termination point (not an overlay listening to a third-party dialer). Telnyx terminates inbound DIDs from lead vendors (Ringba / AllCalls / Trackdrive / etc.). Wayfinder bridges to the agent via WebRTC.

| Stream | Source | Tagged as |
|---|---|---|
| Inbound leg | The caller | `client` |
| Bridge leg | Agent's WebRTC client | `agent` |

No diarization, no first-speaker heuristic, no recalibrate button. Speaker = leg identity. Solves verbatim detection, PECL tracking, audit logs cleanly. (ADR-012, ADR-015)

### Lead routing brain

Vendors ping a Cloud Run endpoint asking *"do you want this call?"*. Wayfinder responds in <100ms based on:

- Agent availability (`available` status)
- License match (`product_type IN agent.active_products` AND `caller_state IN agent.licenses[product_type]`)
- AHIP cert current (for Medicare)
- Carrier appointment current (when vendor specifies carrier)
- Round-robin within filtered set

If no match, reject the ping; the vendor routes elsewhere. On accept, vendor SIP-forwards the call. (ADR-019)

**Vendor config table** drives behavior:

```
Vendor (AllCalls, Ringba, Trackdrive, ...)
  ├─ ping_endpoint_secret
  ├─ products_accepted[]
  ├─ buffer_seconds (when billable kicks in)
  ├─ cost_per_billable_call
  ├─ default_call_type (live_transfer | direct_inbound)
  └─ stripe_passthrough (true for independent agents — Phase 3+)
```

**Buffer timer** visible to agent in the softphone:

- Pre-buffer: green countdown — *"Billable in 0:23"*
- Crossed: amber — *"Billable now — $14.50"*
- Independent agent: tally for the day's incurred lead spend

(ADR-020)

### Data layer — 4-tier, primarily free

**~80% of Medicare data needs are met by free CMS public files + federally-mandated carrier provider directory APIs.**

| Tier | Source | What it gives | Cost |
|---|---|---|---|
| **Tier 1 — CMS PUFs** (self-hosted in Cloud SQL) | Plan Benefit Package (PBP), Formulary Reference File (FRF), Pharmacy Network File, Plan Landscape, Star Ratings | Plan benefits, formulary tier per drug, pharmacy network, geographic availability | $0 |
| **Tier 1.5 — Carrier Provider Directory APIs** (federally required Jan 1 2026 per CMS-4208-F2) | Each MA carrier's public unauthenticated API (FHIR Plan-Net or JSON) | Real-time provider network, ≤30 days fresh | $0 |
| **Tier 2 — HealthSherpa Partner API** | Their Connecture-powered data via deeplink + Create Contact API | E-enrollment with 54 carriers (89% MA market), Medigap quoting, application pre-fill | $0 (free for agents; they monetize via override commissions) |
| **Tier 3 — MARx via Trifecta partner** | Beneficiary lookup / eligibility | MBI lookup (admin-button only, never AI tool call) | Per-lookup, cents |
| **Tier 4 — RAG over carrier PDFs (Phase 2)** | Vertex Vector Search | Carrier-specific addendums, EOC excerpts | Year 2+ |

**Wayfinder owns provider intelligence; HealthSherpa owns the enrollment workflow.** Lead handoff via HealthSherpa Create Contact (v2 OAuth) accepting nested drugs, pharmacies, providers, with Connecture ID resolution server-side. (ADRs 025, 030, 032, 033)

**Adapter cost: ~3–4 weeks** for Top-6 MA carrier provider directory normalizers.

`lookup_*` interface keeps everything vendor-agnostic. Tool calls during the live call:

```
lookup_plan(plan_id)                         → benefits headline
lookup_drug(plan_id, drug_name | ndc)        → tier, copay, restrictions, alternates
lookup_provider(plan_id, npi | name+zip)    → in/out + nearby alternates + lastUpdated
lookup_pharmacy(plan_id, npi | zip)          → preferred / standard, dispensing fees
quote_plans(zip, dob, drug_list)             → ranked top 3 with rationale
```

Each resolves <300ms cached / <800ms uncached. Cards include a *"checked [date], verify in carrier portal before enrolling"* footer keyed off the `lastUpdated` timestamp from the carrier API. As provider directory data freshness improves over the next 1–3 years, the warning intensity scales down automatically. (ADR-027)

---

## CRM — Lightfield-pattern AI-native

The TriBe-built CRM is the system of record for **everything except Medicare client records** (which live in HealthSherpa). For Medicare clients, TriBe CRM holds the master record with `hs_contact_id` foreign key. (ADR-041, ADR-043)

### Core capabilities (Lightfield-inspired)

- **CRM auto-builds itself from the live call.** Vertex Flash extracts after each call: drugs (NDC-normalized), providers (NPI-normalized), current carrier/plan, family, preferences, DNC signals, sentiment, next-best-action. Confidence ≥0.95 auto-writes; 0.7–0.95 queues for agent review; <0.7 discards. AI updates show as `system_ai` in audit log. (ADR-078)
- **Activity timeline per contact** — every call, AI suggestion, transcript snippet, status change, SMS, email, status note. Chronological.
- **Click-to-call / click-to-text / click-to-email** — one-tap from the contact view. Reuses Telnyx softphone for voice and SMS, Postmark for email.
- **Natural language search** — *"All MA enrollees on Eliquis whose plan dropped that drug for 2027"* → Vertex translates to read-only SQL → results audit-logged. (ADR-079)
- **Workflow builder with AI steps** — visual builder; AI steps include *draft follow-up SMS*, *summarize relationship*, *extract fields*. Runs on Cloud Tasks. (ADR-080)
- **Configurable data model** — custom fields per product (FE has different fields than Medicare); tags / segments; agent-defined no-code.
- **Code execution agent (Phase 2)** — agent asks complex question → AI writes read-only SQL, runs it, returns chart/table; sandboxed, query-timeout, audit-logged. (ADR-084)

### Schema (sketch)

```
contacts                          -- universal record, MA + FE + ACA + Life
  id, agency_id, primary_product_type, hs_contact_id?,
  first_name, last_name, dob, phone, email, address, state,
  source (lead_vendor / inbound / referral / web / cold),
  status (active | dormant | dnc | deceased), created_at

contact_products                  -- one row per product the contact has
  contact_id, product_type, carrier, plan_id, enrollment_date,
  renewal_date, status, agent_of_record_id

contact_extracted_fields          -- AI auto-enrichment targets, with confidence
  contact_id, field_key, value_jsonb, confidence, source_call_id,
  reviewed_at, reviewed_by, accepted

activities                        -- timeline events
  contact_id, ts, type, ref, agent_id, summary

outreach_campaigns                -- automation definitions
  id, name, target_query (jsonb), channel, template_id, schedule_cron, active

outreach_messages
  campaign_id, contact_id, sent_at, channel, template_id, status, response_text

support_tickets
  id, contact_id, agent_id, opened_at, closed_at, category, status, summary

renewals
  contact_id, product_type, current_plan_id, renews_at, action_required,
  follow_up_date, agent_id

commission_records
  contact_id, product_type, vendor, amount, paid_at, period
```

(ADRs 041–044)

### Outreach automations (Cloud Scheduler + Cloud Tasks)

| Trigger | Channel | Action |
|---|---|---|
| Call ends with enrollment | SMS | Thank-you (1hr delay) |
| 7 days post-enroll | SMS | "Card arrived?" |
| 60 days before AEP | SMS + email | "Plan review window opens" |
| 30 days before non-AEP renewal | SMS + agent task | Renewal review queue |
| Formulary change affecting enrolled drug | Email + agent task | "Your plan dropped X — let's check alternatives" |
| Provider termination | Email + agent task | "Dr. X left network" |
| Birthday | SMS | Relationship-building |
| 12mo post-enroll | Email | NPS + cross-sell window check |
| Lead-vendor inbound (ping/post) | In-app | Routed call → softphone |
| Support ticket >24hr | In-app + email | Manager escalation |

**DNC suppression is a hard gate** before every outbound campaign — automated DNC scrub against federal + state lists. (ADR-044)

### Lead-vendor performance dashboard

The highest-leverage non-coaching feature. Per-vendor metrics:

| Category | Metrics |
|---|---|
| **Cost** | Total spend, cost per call, cost per billable call, buffer-cross rate |
| **Quality** | Connect rate, talk time avg, disposition mix, language-barrier rate, wrong-state rate |
| **Conversion** | Pre-qual rate, SOA capture rate, quote-to-enroll, same-call vs follow-up enroll, dispute-eligible rate |
| **Revenue** | Commission per enrollment, revenue per call, **ROI**, **LTV (multi-year retention factored)** |
| **Persistency** | 30d / 90d / 365d hold rates (drives chargebacks; carrier-specific) |
| **Time patterns** | Day-of-week, hour-of-day, AEP vs non-AEP performance |

**Recommendations alert-only at MVP** (auto-throttle Phase 2 once multi-month baseline exists). **Dispute queue** flags potentially refundable calls by disposition; one-click submit where vendor portal supports it. (ADRs 077, 081, 082, 083)

---

## Compliance

### HIPAA controls

- **Single-cloud GCP** under one BAA covering Vertex AI, Cloud Run, Cloud SQL, GCS, KMS, Secret Manager, Cloud Tasks, Pub/Sub, Cloud CDN, Cloud Logging.
- **Field-level encryption** for MBI / SSN / DOB / payment data using a separate KMS key, encrypted at app layer before insertion. (ADR-008, ADR-046)
- **3 redaction policies** (ADR-045):
  - **Policy A — Live AI prompts (Vertex)**: allow first name, year+month DOB, state, drug names, drug dosages, provider names, medical conditions, plan IDs. Redact: last name, full DOB day, SSN, MBI, full address, phone, email, payment info, NPN.
  - **Policy B — Logs / eval / LLM-judge**: aggressive — redact everything in Policy A list plus drug names, provider names, first name, full DOB, full zip. Keep structural metadata.
  - **Policy C — Recordings + transcripts**: full retention (CMS rule); redaction at access time for audit views.
- **Cloud DLP** as detection engine + custom regex (MBI), openFDA drug whitelist, NPPES provider allowlist. (ADR-047)
- **Unmask logging** — every read of unredacted PHI by humans/services logged with role + purpose + timestamp. Powers HIPAA §164.528 accounting-of-disclosures. (ADR-048)
- **MBI display default** — masked except last 4 (`1***-***-EF45`); "show full" requires click + reason capture + audit log.
- **Two-party consent** banner branched by caller state; consent capture timestamp + audio snippet logged.

### Recording retention

- **10-year retention** for call audio + transcripts + enrollment evidence + AI events + PECL ticks + consent capture (CMS marketing rule, 42 CFR 422.2274).
- **6-year retention** for HIPAA audit logs (45 CFR 164.316).
- **GCS bucket with locked retention policy in compliance mode** — within retention, no admin can delete (not even root). Forward-only; cannot be reduced.
- **Per-leg storage** — agent + caller as separate audio files (mixed only on playback).
- **Lifecycle**: Standard 0–90d → Nearline 90d–1y → Coldline 1–3y → Archive 3y–10y → delete at year 10+ unless legal hold.
- **Recording start** at SIP-ANSWER; consent disclosure delivered as agent's first words; both timestamps logged.
- **Access logging**: agent self-review of own calls allowed; manager scoped to their team; compliance role sees all. All access requires reason + MFA. (ADRs 008, 034–036)

### Audit log architecture

- **Async write** Cloud Logging → Pub/Sub → Postgres (hot 90d) + BigQuery (warm 1y) + GCS Coldline (cold 6y) → delete at year 6 unless legal hold.
- **Hash chain tamper evidence** — each event includes `prev_event_hash`; hourly anchors written to immutable GCS objects; daily chained.
- **Anomaly detection** — Cloud Monitoring on stream; default 7 rules (failed-login spikes, bulk PHI access, MBI unmask burst, off-hours access, cross-agent contact viewing, unmask reason repetition, recording deletion attempt).
- **No raw PHI in event row** — references via encrypted snapshot pointers.
- **`audit_read` role** dedicated to Michael; he can grant temporary access to leadership case-by-case (itself a logged event).
- **HIPAA right-to-accounting-of-disclosures**: direct query, 30-day response window. (ADRs 050–055)

### Eval harness

The architecture commitment that prevents Wayfinder from being actively dangerous to TriBe.

**6 dimensions weighted by harm potential:** Accuracy, Compliance, Tone, Latency, Helpfulness, Safety.

**4 modes:** Offline (every model/prompt change before deploy), Shadow (continuous, parallel with prod), A/B (5–10% of agents on new model when shadow looks good), Continuous monitoring (100% Tier 0 + 100% Tier 2 sampled to LLM-judge).

**LLM-as-judge** = Gemini Flash-Lite running rubric authored by Michael + senior agents. Quarterly recalibration: re-judge a 30-case sample of LLM-judge decisions; agreement >90% = judge stays in production; <90% = rubric refresh.

**Adversarial case set** (Michael-curated) — must remain at 0 failures for any deployed model. Examples: caller asks for medical advice → AI deflects; caller mentions crisis → AI surfaces crisis line; caller is impaired → AI flags capacity-to-enroll concern; agent says comparative claim → AI flags non-compliant; agent skips TPMO past 60s → AI escalates to BLOCK.

**Block-deploy thresholds:** verbatim PECL accuracy = 100% (zero tolerance), adversarial set failures = 0, hard-data accuracy ≥99.9%, soft compliance ≥99.5%, Tier 0 latency p95 <200ms, Tier 2 first-token p95 <1000ms, recording integrity 100%.

**Cost: ~$5/mo at 3 agents** with Flash-Lite as judge at 100% sampling. (ADRs 037–040)

### Failure modes — degrade gracefully, never lie

Three failure tiers (full table in ADR-056):

- **🔴 Compliance-critical** = hard-fail the call. Recording fails to start, consent capture fails. The call disconnects with a modal. CMS rule beats lead loss.
- **🟡 UX-critical** = degrade gracefully + banner. Vertex outage → Tier 0 takes over coaching ("AI in offline mode"). Tier 0 crashes → rule-based triggers only ("Limited coaching"). Audio degraded → verbatim detection paused. Agent WebRTC drops → auto-callback flow.
- **🟢 Quality-critical** = warn agent inline. Stale carrier directory data, Postgres slow, suggestion latency spike.

**Heartbeat health checks** every subsystem (ADR-060) — defends against the "frozen" failure mode where Wayfinder *looks* fine but is silently doing nothing.

**Prompt injection defense** (ADR-059) — Tier 0 detector + Tier 2 system prompt prefix + caller speech wrapped in `<caller_speech>` tags. Audit event per detected attempt.

**Auto-callback flow** (ADR-061) — agent leg drops, server keeps caller, tries same agent for 30s, then next available licensed agent for 30s, then voicemail + callback queue. Lead vendor not re-pinged.

### Compliance officer dashboard (Michael's view)

Designed for daily 5-minute scan, weekly 30-min review, AEP intensive monitoring, audit response under pressure.

- **Active alerts panel** (real-time SSE)
- **LLM-judge review queue** (cases flagged with low confidence)
- **Compliance health grid** (per-agent: licenses × states × products × AHIP × carrier appointments × eval pass-rate × anomaly count)
- **AEP cockpit** (auto-activated June 1; AHIP recert Gantt, TPMO trending, eval drift, carrier appointment freshness)
- **Investigation workbench** (search by contact / agent / free-text audit; one-click HIPAA §164.528 export)
- **Breach response runbook** (HHS 60-day workflow; templates auto-populate from audit log)
- **External report templates** (CMS audit packet, carrier vendor questionnaire, annual HIPAA risk assessment) (ADRs 070–076)

---

## Cost model

### Operating cost at 3 agents

| Line | Monthly |
|---|---|
| GCP infrastructure (Cloud Run, Cloud SQL, GCS, Cloud Logging, KMS) | ~$50–70 |
| Vertex AI (Flash-default router) | ~$25–60 |
| Telnyx — DIDs (~8 numbers) | ~$8 |
| Telnyx — TURN on GCE e2-micro | ~$7 |
| Telnyx — voice (~21.6k min × $0.0035) | ~$76 |
| Telnyx — recording storage | ~$3 |
| Postmark email | ~$15 |
| Cyber liability insurance (smaller policy) | ~$150–250 |
| Mac app distribution (Apple Dev + GitHub Actions) | ~$33 |
| Domain, dev tools, misc | ~$30 |
| **Total** | **~$365–525/mo** (~$120–175/agent) |

### Operating cost at 10 agents

| Line | Monthly |
|---|---|
| GCP infrastructure | ~$100 |
| Vertex AI | ~$80–200 |
| Telnyx (DIDs + TURN + ~72k min + storage) | ~$300 |
| Postmark | ~$15 |
| Cyber insurance | ~$275 |
| Mac app distribution | ~$33 |
| Domain, misc | ~$50 |
| **Total** | **~$820–940/mo** (~$82–94/agent) |

### Comparison

- Five9 alone: ~$150–200/agent/mo flat = $1,500–2,000/mo at 10 agents (dialer-only).
- MedicareCopilot: ~$200–500/agent/mo (presumed) = $600–1,500/mo for CRM+quoting.
- ConnectureDRX direct API tier: estimated $3–10K/mo enterprise base + per-agent.

**Wayfinder replaces all of the above with one stack at ~$82–94/agent.**

### Build effort

| Phase | Scope | Time |
|---|---|---|
| **0** | GCP BAA, projects, Postmark, synthetic data, base infra | 1–2 days |
| **1** | Backend foundation (FastAPI or NestJS on Cloud Run, Cloud SQL CMEK, audit logs, Ory Kratos auth) | 3–5 days |
| **2** | Inference router + eval harness | 3–5 days |
| **3** | Mac app integration (Tauri 2.x + Telnyx WebRTC + Tier 0 Gemma local) | 3–5 days |
| **4** | Frontend cutover (web admin to GCS + CDN) | 1–2 days |
| **5** | CRM module + AI-native enrichment + lead vendor tracking | 4–5 weeks |
| **6** | Compliance officer dashboard + recording retention + audit log + redaction | 3 weeks |
| **7** | Go-live: real PHI pilot, HHS SRA risk assessment, CMS-readiness review | 1–2 weeks |
| **Total MVP** | | **~10–14 engineer-weeks** for one engineer focused, faster with parallelization |

---

## Open questions / deferred decisions

| # | Item | When to revisit |
|---|---|---|
| 1 | Sunfire / MedicareCopilot integration if HealthSherpa data gaps emerge | Post-MVP, after 90d of HealthSherpa real-world use |
| 2 | Auto-throttling vendors based on ROI | Phase 2, after 3+ months of vendor baseline data |
| 3 | License verification UX depth (NIPR sync edge cases, Sircon integration) | Phase 2 (parked per current grill) |
| 4 | Stripe billing for independent agents | Phase 3+ when buffer-timer-driven billing matters |
| 5 | Code execution agent for power-user CRM queries | Phase 2 |
| 6 | ACA expansion (HealthSherpa flagship) | 2027 |
| 7 | Final Expense expansion + per-carrier Computer Use scrapers | 2027 |
| 8 | Med Supp / Medigap quoting (HealthSherpa covers; native build later if needed) | Year 2+ |
| 9 | Multi-tenant white-label | Indefinite |
| 10 | Mac MDM (Jamf/Kandji) for ≥20 agent scale | When TriBe crosses ~20 agents |
| 11 | Annual SOC 2 Type II | Skip until carriers explicitly require |
| 12 | Vanta / Drata compliance automation | When manual BAA tracking breaks (~year 2 or 5+ carriers) |

---

## Risks

| Risk | Mitigation |
|---|---|
| Carrier provider directory APIs have inconsistent FHIR Plan-Net implementations | Build for Top-6 carriers first; CMS testing period is doing this work for us in parallel; degrade to HealthSherpa UI deeplink for niche carriers |
| HealthSherpa Partner API roadmap doesn't ship needed endpoints | Computer Use agent fills gaps; TriBe-native CRM doesn't depend on their API for core flows |
| AI hallucination in coaching | Eval harness with 99.9% accuracy floor + LLM-judge continuous monitoring + verbatim catalog (no LLM in compliance-critical text) |
| MedicareCopilot™ market presence (HealthcareGPS + ConnectureDRX) | Wayfinder differentiates on softphone ownership, multi-product, on-device AI privacy, IP ownership; not competing for TriBe's own use |
| AEP traffic surge breaks AI eval | Continuous monitoring catches drift; block-deploy thresholds prevent degraded models from shipping during peak |
| Recording fail rate during AEP | Hard-fail rule (no recording = no call) prevents compliance violations; lost leads acceptable |
| MBI exposure via prompt injection | Tier 0 detector + system prompt prefix + audit event per attempt |
| 30-day carrier provider directory staleness misleads agents | `lastUpdated`-aware UI + "verify before enrollment" footer + AI safety prompt |
| Vendor (Telnyx, HealthSherpa, Vertex) outage | Tier 0 fallback for AI; recording continues server-side; auto-callback; banner UX |

---

## Glossary (Wayfinder-specific terms)

- **Blinker** — agent-pressed button that requests an AI-generated cross-product transition phrase (Tesla-style mode change).
- **Stealth preset** — toggle profile that mutes everything except verbatim + PECL overdue + buffer timer.
- **Tier 0 / Tier 2** — the on-device (local Gemma) and cloud (Vertex Flash) inference layers in the router.
- **Verbatim catalog** — versioned static JSON of CMS-required disclosure text (TPMO / MSP / LIS / Medigap / SOA). Rendered without LLM involvement.
- **Buffer-cross** — moment in a call when vendor billing kicks in (per-vendor `buffer_seconds`). Visible to agent in real-time.
- **Block-deploy** — eval harness CI gate that prevents a new model/prompt from shipping if it regresses below thresholds.
- **Adversarial case set** — Michael-curated edge cases the AI must handle correctly (medical advice deflection, crisis cues, etc.). Zero-failure threshold.

For Medicare-specific terms (AEP, MAPD, PDP, MA, OM, PECL, MSP, LIS, SOA, TPMO, NPN, MARx, etc.), see [`plans/PRD.md` § Glossary](PRD.md) (legacy, still authoritative for Medicare terminology).

---

## Appendix: ADR catalog

The 84 architecture decisions captured during the design grill are catalogued in [`plans/wayfinder-adrs.md`](wayfinder-adrs.md). Each ADR is referenced inline above by number; the catalog provides the full statement of each decision.

---

## How to pick up this PRD in a new session

1. Read this document end-to-end (~20 min).
2. Skim [`plans/wayfinder-adrs.md`](wayfinder-adrs.md) for ADR rationale.
3. Reference `plans/architecture-decisions.md` (the original GCP-first architecture doc) as the constitutional foundation.
4. The legacy MediCopilot codebase under `src/`, `server/`, `api/` is **not** part of Wayfinder — it remains as the v1 demo (Vercel + Fly).
5. Wayfinder is a greenfield build. Initial repo is `myacaexpress/wayfinder` (to be created).
6. CLAUDE.md still describes MediCopilot. Update to reflect Wayfinder when the new repo is initialized.
