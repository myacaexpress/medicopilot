# Wayfinder — Architecture Decision Record catalog

**Status:** Locked decisions from the 2026-05-08 design grill (single Claude session).
**Companion to:** [`plans/wayfinder-prd.md`](wayfinder-prd.md)

Each ADR is a one-liner. Detailed rationale lives in the PRD body and the original architecture-decisions document. Numbered to match in-PRD references.

---

## Foundation (single-cloud, BAAs)

- **ADR-001** — Single-cloud foundation on Google Cloud Platform. One BAA covers Vertex AI, Cloud Run, Cloud SQL, GCS, KMS, Secret Manager, Cloud Tasks, Pub/Sub, Cloud CDN, Cloud Logging.
- **ADR-002** — Inference router via Vertex AI Model Garden. Tier ladder: Tier 0 (Gemma E4B local) → Tier 1 (Flash-Lite) → Tier 2 (Flash, default for suggestions) → Tier 3 (Gemma 31B) → Tier 4 (MedLM) → Tier 5 (Gemini Pro) → Tier 6 (Sonnet via Vertex, evaluated then likely removed).
- **ADR-003** — Whisper transcription. *Superseded by per-leg topology (ADR-015):* Whisper now runs server-side on Cloud Run, fed by per-leg RTP from Telnyx. Tier 0 Gemma stays on-device.
- **ADR-004** — Self-hosted Ory Kratos on Cloud Run for auth (not Firebase Auth, not in GCP BAA).
- **ADR-005** — *Superseded:* Native CRM build. CRM split: HealthSherpa for Medicare records, TriBe-native for FE/ACA/Life/Health and master record.
- **ADR-006** — Frontend on Cloud Storage + Cloud CDN (deprecating Vercel for the application).
- **ADR-007** — Postmark for transactional email (BAA-covered, ~$15–25/mo).
- **ADR-008** — *Amended (see ADR-034):* Storage and encryption — Cloud SQL Postgres (HA, PITR, CMEK), GCS lifecycle, audit-log Object Lock 7y, field-level encryption for MBI/SSN/DOB. Retention split per artifact:
  - Call audio + transcripts + AI events + consent + enrollment evidence: 10 years (CMS 42 CFR 422.2274)
  - HIPAA audit logs: 6 years (45 CFR 164.316)
  - Operational logs: 90d hot, 1y archive
- **ADR-009** — Observability via Cloud Logging + Cloud Monitoring + Cloud Error Reporting + Cloud Trace (no Sentry).
- **ADR-010** — Synthetic data only in dev/CI/demos. Real PHI never lands in non-prod environments.

## Live-call AI architecture (refined through grill)

- **ADR-011** — Verbatim script-completion detection. Tier 0 Gemma fuzzy-matches agent-leg transcript against canonical verbatim text. Item ticks only on score ≥ 0.85 + required phrases present. Audit log captures `delivered_at`, `match_score`, transcript snippet.
- **ADR-012** — Telnyx for inbound DID + WebRTC bridge to agent. Wayfinder is the call-termination point (a softphone, not an overlay). Ringba/AllCalls/Trackdrive route to Wayfinder's DID via SIP; they're not in the audio path.
- **ADR-013** — Live transfer vs. direct inbound — vendor config flag drives AI's first move (skip qualifier intro vs. cold start).
- **ADR-014** — Production live-call surface = Mac app. Web app for training, admin, CRM, dashboards. Both share auth + backend.
- **ADR-015** — Multi-leg SIP topology — speaker = leg identity, no diarization ever. Inbound leg = caller, bridge leg = agent.
- **ADR-016** — Computer Use via Sonnet 4.5 (Vertex) for application filling. Sequential per-call. Sandboxed Cloud Run browser. Graduate to deterministic connectors over time.
- **ADR-017** — Multi-product architecture via product packs (config-driven compliance, triggers, coaching). Wayfinder is product-agnostic; Medicare is one pack among several.

## Routing brain + agent profile

- **ADR-018** — Agent profile model. Licenses (state × product), active_products, carrier appointments. License + state matrix governs routing.
- **ADR-019** — Lead routing brain. Cloud Run ping endpoint, round-robin within license/state/availability/AHIP filter. Vendor config table (buffer_seconds, stripe_passthrough, products_accepted, default_call_type).
- **ADR-020** — Buffer timer visible to agent in softphone. `lead_charge` rows fire at threshold for independent agents (Stripe in P3+).
- **ADR-021** — Product pack pattern — Medicare is one pack; FE, ACA, Health, Life are pluggable. Medicare ships first; others = greyed-out tabs at MVP.
- **ADR-022** — Tesla blinker — agent-initiated transition (button) + AI-initiated opportunity hints (passive badges). Cross-vertical mode switch is always agent-confirmed.
- **ADR-023** — Live transfer vs direct inbound — vendor config flag drives AI opening behavior.
- **ADR-024** — Adjustable signal density — per-agent toggle catalog with 4 presets (Trainee/Standard/Veteran/Stealth), hotkey switching (⌥1–4), role-based admin locks. Engine emits everything; client filters; audit records what was suppressed.

## Data layer

- **ADR-025** — *Amended:* 4-tier data layer. Tier 1 = self-host CMS PUFs + carrier provider directory APIs (free, federally-mandated). Tier 2 = HealthSherpa Partner API for enrollment + Medigap. Tier 3 = MARx via Trifecta partner (admin-button only). Tier 4 = Vertex Vector Search RAG (Phase 2). MedicareCopilot / Sunfire / ConnectureDRX-direct deemed unnecessary at TriBe scale.
- **ADR-026** — MBI lookup is admin-button-only, never an AI tool call. Logged with explicit consent capture.
- **ADR-027** — Cache provider/formulary lookups 24h in Memorystore. Wrap all external data behind internal `lookup_*` interfaces so we can swap vendors.
- **ADR-028** — Agent license verification — NIPR nightly sync, AHIP self-upload + admin verify, carrier appointments manual at MVP (Sircon optional at scale), agent blocked from routing on expiry, manual override with audit trail.
- **ADR-029** — *Rewritten:* Hybrid build/buy. TriBe builds Wayfinder, uses HealthSherpa (free) for Medicare enrollment + Medigap. No need for MedicareCopilot.
- **ADR-030** — *Amended:* Wayfinder ↔ HealthSherpa integration. Lead push via Create Contact (v2 OAuth) including nested drugs / pharmacies / providers. HealthSherpa server-side resolves to Connecture IDs; unresolved degrade to text notes. Computer Use bridges API gaps.
- **ADR-031** — Source-of-truth split. Call data + transcripts + audit = Wayfinder. Client/lead/enrollment data for Medicare = HealthSherpa (TriBe CRM stores `hs_contact_id`). Non-Medicare = TriBe CRM.
- **ADR-032** — Carrier Provider Directory API integration. Per-carrier adapters (Top-6 first), FHIR-flavored, normalized into Wayfinder's `lookup_provider` interface. CMS-4208-F2 federal mandate Jan 1 2026.
- **ADR-033** — ID-space reconciliation. Wayfinder identifies entities by NPI / NDC. HealthSherpa resolves to Connecture IDs server-side. Unresolved entities degrade to notes; UI surfaces resolution status to agent before deeplink open.

## Recording + retention

- **ADR-034** — Recording lifecycle. GCS bucket with locked retention policy in compliance mode (immutable for 10 years). CMEK encryption. Lifecycle Standard → Nearline → Coldline → Archive → delete-at-year-10. Two-leg storage. Full event log per call.
- **ADR-035** — Recording start trigger = SIP-ANSWER. Consent disclosure delivered as agent's first words. Both timestamps logged.
- **ADR-036** — Agent self-review of own calls allowed. Manager review = team-scoped. Compliance review = all calls. All access logged with role + timestamp + reason. Retrieval requires MFA.

## Eval harness

- **ADR-037** — Eval harness — 4 modes (offline / shadow / A/B / continuous), 6 dimensions (accuracy / compliance / tone / latency / helpfulness / safety), LLM-as-judge with human-authored rubric + senior-agent quarterly recalibration.
- **ADR-038** — Adversarial case set — Michael-curated; must remain at 0 failures for any deployed model.
- **ADR-039** — Block-deploy CI gates — verbatim PECL accuracy = 100%, adversarial = 0 failures, hard-data accuracy ≥99.9%, soft compliance ≥99.5%, Tier 0 latency p95 <200ms, Tier 2 first-token p95 <1000ms, recording integrity 100%.
- **ADR-040** — Continuous monitoring sampling — 100% Tier 0 + 100% Tier 2 with Flash-Lite as judge. ~$5/mo at 3 agents.

## CRM (TriBe-native)

- **ADR-041** — TriBe-native CRM. Contacts table is master record. `hs_contact_id` foreign key for Medicare overlap with HealthSherpa.
- **ADR-042** — Multi-product contact model. `contact_products` join supports Medicare + FE + ACA + Life + Health side-by-side per contact.
- **ADR-043** — HealthSherpa ↔ TriBe CRM bidirectional sync. Partner API for Medicare records; outbound webhook from HealthSherpa when supported.
- **ADR-044** — Outreach automations. Cloud Scheduler + Cloud Tasks. Channels: Telnyx SMS, Postmark email, Telnyx voice queue, in-app. **DNC suppression is a hard gate** before every outbound campaign.

## Redaction + audit

- **ADR-045** — Three redaction policies (A=live AI selective, B=logs/eval aggressive, C=recordings raw with at-access redaction).
- **ADR-046** — Field-level encryption — MBI / SSN / DOB / payment data with separate KMS key, app-layer encrypt before insert.
- **ADR-047** — Cloud DLP as detection engine + custom regex (MBI), openFDA drug whitelist, NPPES provider allowlist.
- **ADR-048** — Unmask logging — every read of unredacted PHI by humans/services logged (role + purpose + timestamp). Powers HIPAA §164.528 accounting-of-disclosures.
- **ADR-049** — HIPAA rights workflow — 30-day right-to-access export by `contact_id`; recording amendment-note pattern; restriction-request log.
- **ADR-050** — Audit log architecture — async write Cloud Logging → Pub/Sub → Postgres + BigQuery. No raw PHI in event row; references only.
- **ADR-051** — Audit event schema — comprehensive coverage list per category, schema with `prev_event_hash`.
- **ADR-052** — Hash-chain tamper evidence — hourly anchor in immutable GCS, daily chained.
- **ADR-053** — Retention tiering — Postgres hot 90d / BigQuery warm 1y / GCS Coldline cold to year 6 / delete at year 6+ unless legal hold.
- **ADR-054** — Anomaly detection — Cloud Monitoring on audit stream; default rule set (failed-login spikes, bulk PHI access, MBI unmask burst, off-hours access, cross-agent contact viewing, unmask reason repetition, recording deletion attempt).
- **ADR-055** — Right-to-accounting-of-disclosures workflow — direct query, 30-day response window.

## Failure modes

- **ADR-056** — Failure mode taxonomy — three tiers (🔴 compliance-critical hard-fail, 🟡 UX-critical graceful degrade, 🟢 quality-critical warn). Specific behaviors per failure.
- **ADR-057** — Recording integrity rule — failed recording within 30s = hard call disconnect. Same for consent capture failure in two-party states.
- **ADR-058** — Vertex outage fallback — Tier 0 Gemma takes over coaching; rule-based PECL continues; verbatim catalog continues unchanged.
- **ADR-059** — Prompt injection defense — Tier 0 detector + Tier 2 system prompt prefix + caller speech tag wrapping. Audit event per detected attempt.
- **ADR-060** — Heartbeat health checks — every subsystem reports; missing heartbeat = banner + auto-restart. Defends against the "frozen" failure mode.
- **ADR-061** — Auto-callback flow — agent leg drop, 30s try-same-agent then 30s next-licensed-agent, otherwise voicemail + callback queue. Lead vendor not re-pinged.

## Mac app distribution

- **ADR-062** — Mac app framework = Tauri 2.x; arm64 only; macOS 14+.
- **ADR-063** — Distribution = direct DMG via TriBe internal portal; not App Store.
- **ADR-064** — Code signing + notarization mandatory; GitHub Actions CI pipeline.
- **ADR-065** — Auto-update via Tauri updater; 30-day force-upgrade window with banner warnings at 14d and 7d.
- **ADR-066** — Tier 0 Gemma model distributed separately on first launch (~3.5 GB); versioned independently from app binary.
- **ADR-067** — PHI at rest — FileVault required, app sandbox, encrypted cache via Keychain, 8hr inactivity timeout, cache wipe on logout.
- **ADR-068** — Agent offboarding — backend revoke + client-side wipe + audit log; optional MDM hard-wipe (Phase 2 if TriBe crosses ~20 agents).
- **ADR-069** — Crash reporting via Cloud Error Reporting; PHI scrubbed via Policy B before upload.

## Compliance officer dashboard

- **ADR-070** — Compliance officer dashboard at `/admin/compliance`, role-gated to `compliance` role + `audit_read` role.
- **ADR-071** — Real-time alerts via SSE from Cloud Monitoring; acknowledge/dismiss/escalate logged.
- **ADR-072** — LLM-judge review queue — daily ingestion of low-confidence cases; agree/disagree/note actions feed rubric calibration.
- **ADR-073** — Compliance health grid — per-agent matrix; AEP cockpit conditional on date (June 1 → October 31); license expiration drilldowns.
- **ADR-074** — Investigation workbench — search-by-contact / by-agent / free-text audit; one-click HIPAA §164.528 export.
- **ADR-075** — Pre-built external report templates — CMS audit packet, carrier vendor questionnaire, annual HIPAA risk assessment.
- **ADR-076** — Manager scoped view — team-only metrics; no audit log raw access.

## Lead-vendor performance + AI-native CRM

- **ADR-077** — Lead-vendor performance tracking — schema (lead_vendors, ping_log, vendor_disputes, vendor_metrics_daily); real-time spend; per-vendor ROI dashboard.
- **ADR-078** — AI-native CRM auto-enrichment — post-call Vertex Flash extracts contacts/drugs/providers/preferences with confidence scores; ≥0.95 auto-write, 0.7–0.95 review queue, <0.7 discard; corrections logged.
- **ADR-079** — Natural language CRM search — agent admin search bar; Vertex translates to read-only SQL; results audited; query log per user.
- **ADR-080** — Workflow builder with AI steps — visual builder; AI steps include draft SMS, summarize, extract, recommend; runs on Cloud Tasks.
- **ADR-081** — Persistency tracking — 30d / 90d / 365d hold rates per enrollment; carrier-specific chargeback rules; ROI calc uses realized commission.
- **ADR-082** — Dispute queue — flag refundable calls by disposition; one-click submit; outcome tracking.
- **ADR-083** — Decision intelligence — recommendations alert-only at MVP; auto-throttling Phase 2 when multi-month baseline exists.
- **ADR-084** — Code execution agent (Phase 2) — read-only SQL via Vertex against CRM; sandboxed, query-timeout, audit-logged.

---

## Decisions revised during the grill

- **ADR-003 superseded by ADR-015** (Whisper moves server-side once we own the SIP topology)
- **ADR-005 superseded** (CRM is hybrid: HealthSherpa for Medicare, TriBe-native for everything else)
- **ADR-008 amended by ADR-034** (retention split per artifact; compliance-mode Object Lock; no admin can delete within 10y)
- **ADR-025 amended** (CMS public + carrier directories are primary; HealthSherpa is enrollment + Medigap; no MedicareCopilot)
- **ADR-029 rewritten** (HealthSherpa replaced MedicareCopilot in the buy slot, at $0)
- **ADR-030 amended** (Create Contact accepts nested drugs / pharmacies / providers with Connecture ID resolution)
- **ADR-040 amended** (100% Tier 0 + 100% Tier 2 sampling cost-justified by Flash-Lite as judge)

## ADRs the architecture doc had that are no longer needed

- ConnectureDRX direct API contract (covered by HealthSherpa free)
- Sunfire direct contract (same)
- Twenty / AgencyBloc CRM (covered by hybrid HealthSherpa + TriBe-native)
- HubSpot / Salesforce as system of record (never had it)
- WorkOS for SSO (Ory Kratos sufficient at TriBe scale)
- Sentry Business tier (Cloud Error Reporting sufficient)
- Vanta / Drata at MVP (deferred until carriers require)
- SOC 2 Type II (deferred — not selling externally)
