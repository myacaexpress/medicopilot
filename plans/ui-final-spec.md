# MediCopilot UI — Final Design Spec (pre-refactor freeze)

**Status:** Design freeze. No code changes yet. Once approved, we refactor
`src/MediCopilot_macOS_Mockup.jsx` into components matching this spec.

**Design tokens** (unchanged, mirrored from current mockup so nothing drifts):
- Teal `#007B7F` / tealDark `#004D50` / tealLight `#1A9EA2`
- Coral `#F47C6E` / coralDark `#D45A48`
- Green `#34C77B` · Amber `#F5A623` · Red `#E74C3C` · Dusk `#B0C4DE`
- Surface: `rgba(255,255,255,0.03–0.15)` over `#0a1628` / `#00282A`
- Borders: `rgba(255,255,255,0.06–0.3)`
- Fonts: Montserrat (display), Lora (body), JetBrains Mono (mono)
- Radii: 6 / 8 / 10 / 12 / 16
- Display headers: 9–11px, weight 600, uppercase, letter-spacing 0.04em

---

## 1. Lead Context panel

Persistent card that answers "who is on this call." Single source of truth
for lead fields; every AI response card that cites a field links back here.

### Placement decision
Docked to the **top of the overlay, immediately below the header toolbar
and above the transcript** — not replacing the header, not collapsed by
default. Rationale:
- Lead context is the agent's first need on every call; burying it in a
  collapsible defeats the purpose.
- The header toolbar (mic/screen/mode toggles) is operator controls and
  should stay separate from lead data.
- Panel is **collapsible to a one-line summary** (name + ZIP) when the
  agent wants more vertical room for transcript; affordance is a chevron
  on the panel's right edge, not in the header.

### States
| State | Trigger | Visual |
|---|---|---|
| **Confident match** | All required fields populated, at least one `verified` or `high` | Full panel, green check, "Ready" label in teal |
| **Ambiguous** | ≥2 candidate leads returned from screen-pop or OCR | Panel shows top candidate with a "2 matches — pick one" strip above. One tap collapses strip. |
| **Cold** | No lead data | Empty form with coral "No lead loaded" banner + primary CTA "Capture Lead" + secondary "Enter manually". AI nudge fires in response card: *"Start by getting spelling of first and last name."* |

### Fields
Rendered as a 3-column grid on desktop (≥720px), stacked on mobile.

Row 1: Name · DOB · Phone
Row 2: Address (spans 2 cols) · Lead source
Row 3 (collapsible): Current coverage · Medications (chips) · Providers (chips)

Each field: `[label]` above, `[value] [confidence pill] [pencil]` inline.
Clicking pencil swaps the value to an input (ZIP gets a numeric input
since it's the most-used field). Enter/blur saves; Esc reverts.

### Confidence pills
| Level | Color | Source |
|---|---|---|
| `verified` | Green `#34C77B`, filled | Webhook payload, or agent confirmed aloud |
| `high`     | Teal  `#007B7F`, filled | Five9 / CRM screen-pop |
| `medium`   | Amber `#F5A623`, outlined | Vision OCR |
| `low`      | Red   `#E74C3C`, outlined pulse | Conflict or unclear — AI must verify verbally |

Pills are 16px tall, font 9px mono, letter-spacing 0.04em. They double as
tap targets → tooltip explains source.

### Controls
- **Capture Lead** — primary teal button, top-right of panel
- **Switch lead** — ghost link, opens lead search dropdown (future: search
  recent Five9 records)
- **Clear lead** — `×` icon, muted, requires confirm modal "Clear Maria
  Garcia's info? The active call won't be affected."
- **Collapse chevron** — right edge, collapses to `Maria Garcia · 33024 · verified ✓`

### Mobile behavior
Below 768px, the panel is a **one-line sticky header** at top of the copilot
sheet: `Maria Garcia · 33024 · ✓`. Tap expands to a bottom-sheet-style
editor. Capture Lead and Switch lead move into a `⋯` menu.

---

## 2. Capture Lead flow

Screen-region OCR driven by `getDisplayMedia` + a crosshair selector. Designed
so a new agent can complete their first capture in <10 seconds.

### Flow
1. **Capture Lead** clicked → permission prompt for `getDisplayMedia`.
2. Agent picks a source (Five9 window typically). One frame grabbed.
3. **Full-viewport overlay** fades in over MediCopilot UI (rest dims to 25%
   opacity, still visible for context so agent doesn't lose their place).
4. Captured frame shown center-screen with `object-fit: contain`, letterboxed.
5. Crosshair cursor. Agent **click-drags a rectangle**. Live preview shows
   a dashed teal border (2px `#1A9EA2`, dash 6,4) while dragging.
6. On release: rectangle gets **4 corner handles + 4 edge handles + move
   grip in center**. Handles are 10px teal squares with white border.
7. **Action bar** appears pinned to the rectangle's bottom-right (or
   flips to top-right if near viewport edge):
   - `Extract` (teal, primary, icon: sparkle)
   - `Retry`   (ghost, icon: rotate)
   - `Cancel`  (ghost, icon: ×)
8. `Extract` click → spinner replaces the Extract label; cropped region stays
   visible with a subtle pulsing teal border so the agent knows what was sent.
9. Success → overlay fades out, Lead Context panel fills in, each new field
   flashes amber (`medium` confidence) for 500ms. Toast top-right:
   *"3 fields captured — verify spelling with client."*

### Error states
| State | Visual | Copy |
|---|---|---|
| Zero-size rect | Extract button disabled, tooltip on hover | "Drag a rectangle first" |
| No fields found | Amber toast + overlay stays open | "No lead info found. Try again or paste manually." |
| Vision API error | Red toast + overlay stays open | "Extraction failed. Retry." |
| getDisplayMedia denied | Inline in Lead panel | "Screen access denied. Enable in browser settings or enter manually." |

### Nice-to-haves (deferred behind feature flags)
- **Re-capture last region** — after first successful capture per session,
  the Capture button splits into a two-button group: `[ Re-capture ↻ ] [ New ]`.
  Re-capture skips the selector, regrabs the same bounding box.
- **Merge mode** — if Lead panel already has `verified`/`high` fields and a
  new capture returns different values, those fields are *not* overwritten;
  instead the conflict shows as a small amber dot next to the field with
  "1 conflict" link → inline diff modal.

---

## 3. PECL Checklist polish

- **Header line 1:** `Pre-Enrollment Checklist`  (display, 11px, weight 600,
  uppercase, letter-spacing 0.04em — matches other section headers)
- **Header line 2:** `(PECL)` in `rgba(255,255,255,0.35)`, same font
- **`i` icon** (12px, lucide `Info`) to right of header. Hover/tap:
  > "CMS Pre-Enrollment Checklist — items required before Medicare plan
  > enrollment. Skipping items can result in enrollment reversal."
- Tooltip: 240px wide, same glass treatment as AI cards, 8px padding,
  body font 11px.
- Row rendering unchanged. Progress bar unchanged.

---

## 4. MSP badge polish

- Default: amber pill, 18px tall, label `MSP`.
- Hover (desktop) or tap (mobile): pill expands inline (120ms cubic-bezier
  ease-out) to `MSP reminder` + tooltip:
  > "Medicare Savings Programs — you must offer to screen for eligibility
  > per PECL before enrolling."
- Click inserts this script block at the top of the active AI response
  card's `Say this` section:
  > *"Mrs. Garcia, I'm required to mention Medicare Savings Programs —
  > state programs that can help with your Part B premium. Would you
  > like me to check if you might qualify?"*
  Inserted with a 400ms amber→teal fade to signal "now covered."
- Badge state transitions from amber `MSP` → teal `MSP ✓` (label becomes
  `MSP covered`). Clicking again reverts (agent may want to re-insert).

---

## 5. AudioWave + input level meter

UX-only in this iteration; wiring to `AnalyserNode` comes later.

- Keep existing wave animation amplitude range and colors.
- Add a **second wave stacked below the first**, 60% amplitude, coral
  (`#F47C6E`), 40% opacity. This is the "far-end speaker" (client).
- Tiny labels below each wave, 9px mono, `rgba(255,255,255,0.3)`:
  - Top wave: `you`
  - Bottom wave: `client`
- Waves collapse into a single combined wave when width < 220px.
- When real audio lands, each wave binds to its track's analyser. Until
  then, both are decorative.

---

## 6. Consent / recording indicator

- **Persistent pill** in overlay header, next to the mode switcher:
  - Mic on: red dot (8px, `#E74C3C`) + `Recording` (display, 10px, weight 600)
  - Mic off, screen on: amber dot + `Listening (screen only)`
  - Both off: no pill
- Dot pulses at 1Hz (opacity 0.4→1) when recording.
- **First-capture banner** (per-session, dismissable):
  - Full-width strip below header, teal-tinted glass, 40px tall
  - Copy: *"MediCopilot is listening for agent suggestions. Remember to
    disclose recording per state requirements."*
  - Dismiss `×` on right; stored in `sessionStorage` so it won't re-show.
- Two-party-consent-state aware (future): if the lead's state is flagged
  as two-party, the banner turns amber with stronger copy.

---

## 7. Unchanged — do not touch

Draggable/resizable card · split/tabs/fullscreen switcher · transcript panel
layout · AI response card structure (context / sayThis / pressMore /
followUps / plans / compliance) · dock · menu bar · Five9 simulator
background · color palette · fonts · mobile tabbing.

---

## Answers to open design questions

### Q1 — Where does the Lead Context panel fit?
**Above transcript, below header.** Not replacing the header (header is
operator controls, different concern). Not default-collapsed (lead data is
the single most-referenced thing on every call — always-visible default
pays for its pixels). Collapsible via right-edge chevron for agents who
want transcript real estate.

### Q2 — Mobile capture fallback
`getDisplayMedia` is **not supported on iOS Safari**, and is flaky in
mobile Chrome. So on mobile:
1. **Primary fallback: photo upload.** Capture button opens native camera
   or gallery picker. User snaps a photo of the Five9 screen on their
   laptop, or uploads an existing screenshot. Same Vision extraction path,
   just a different input.
2. **Secondary fallback: paste.** A "Paste lead info" action under the
   capture button accepts unstructured text; Vision/LLM parses it into
   fields. Useful when agent copies from a CRM.
3. **Tertiary: manual entry.** Always available via the pencil icons.

The capture flow overlay on mobile shows a static image (not full-viewport
crosshair selector). Crop handles are larger (16px) for touch. Or — simpler
— on mobile we skip the crop step entirely and send the full photo to
Vision, since agents are more likely to take a tight shot on purpose.

### Q3 — Should AI cards show which lead field they used?
**Yes, but subtle.** Add a `sources` row at the bottom of each AI response
card: tiny 9px mono chips like `ZIP 33024` `DOB 1958`. Max 3 chips, muted
`rgba(255,255,255,0.35)` text on `rgba(255,255,255,0.03)` surface. Hover
highlights the corresponding field in the Lead Context panel (brief
teal ring, 800ms). This builds trust without visual weight — agents who
don't care can ignore it; agents debugging a weird suggestion have a
one-glance answer.

### Q4 — Loading skeletons during extraction
Match glassmorphic treatment:
- Field values render as `rgba(255,255,255,0.05)` pill-shaped bars at the
  field's baseline width ×70%, animated with a subtle horizontal shimmer
  (`linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)`
  translating 0→100%, 1.4s loop).
- Confidence pill slot renders a 16×32 amber outline skeleton (hint that
  `medium` is incoming).
- Panel border gets a slow teal pulse (box-shadow 0 0 0 1px `#007B7F` with
  opacity 0.3→0.6) so the whole panel reads as "thinking."
- Duration cap: if extraction takes >6s, skeleton converts to a retry
  state with the crop preview visible.

---

## Implementation sequencing (for the refactor PR, not this design freeze)

1. Extract `<LeadContextPanel>` — pure, state-driven, three visual states
2. Extract `<ConfidencePill>` — 4 variants, used in-panel and in AI cards
3. Extract `<CaptureOverlay>` — handles `getDisplayMedia`, crop, action bar
4. Wire MSP click handler to AI card's `sayThis` insertion API
5. Add `<RecordingPill>` to header; add first-capture banner with session
   storage gate
6. Add `<SourcesRow>` to AI cards, drawing from Lead Context state

Each of the above can ship independently behind a feature flag; Lead
Context panel is the only blocker for the others since they reference it.

---

## Open items still needing product input

- Final copy for the two-party-consent banner variant per state
- Whether `verified` requires two separate confirmation sources (current
  plan: webhook alone is enough; verbal confirmation alone is enough)
- What happens to PECL state when `Clear lead` is used mid-call — does the
  checklist reset? Recommendation: yes, but show a toast "PECL progress
  cleared" with undo.
