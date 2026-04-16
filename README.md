# MediCopilot

Real-time AI copilot for Medicare insurance agents on live sales calls.

**Current phase:** P0 Foundations. The live deploy at [medicopilot.vercel.app](https://medicopilot.vercel.app) is the interactive UI mockup. Real integrations (screen OCR, transcription, AI suggestions) ship in P1–P2.

## Start here

- **[CLAUDE.md](CLAUDE.md)** — onboarding doc for any developer or AI session picking up work
- **[plans/PRD.md](plans/PRD.md)** — product requirements doc, authoritative for scope and architecture
- **[plans/ui-final-spec.md](plans/ui-final-spec.md)** — frozen UI/UX spec

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # production build to dist/
npm run preview   # preview the prod build locally
npm run lint      # ESLint
```

## Environment

See [`.env.example`](.env.example) for the full list of env vars across P0–P5. The current phase (P0) doesn't require any env vars — the mockup is static. P1 adds `ANTHROPIC_API_KEY`.

## License

Proprietary. © myacaexpress. Not for external distribution.
