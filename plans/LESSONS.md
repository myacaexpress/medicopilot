# Lessons Learned

Hard-won knowledge from production incidents and PR surprises. Read before shipping.

---

## Deploy gotchas

### PR preview branches test frontend against main's server code

**Date:** 2026-04-17 (PR #13)

Vercel preview deploys build the frontend from the PR branch, but the Fly.io backend only auto-deploys from `main`. If a PR includes server changes (new WSS message types, route logic, etc.), the preview URL will hit the **old** server code on Fly — and things will silently break or appear to work when they shouldn't.

Vercel preview URLs build from the PR branch's FRONTEND code but
the Fly server on medicopilot-myacaexpress.fly.dev always runs
whatever was last deployed to main. PR branch server changes won't
reach the preview until either (a) merged to main, or (b) manually
deployed via `cd server && fly deploy`. This caused the PTT-not-
working bug in PR #13 and multiple Ask AI "fixes" in PRs #8-#10.

**Fix:** Before testing a preview that depends on server changes, manually deploy from the PR branch:

```bash
cd server
fly deploy --remote-only -a medicopilot-myacaexpress
```

The main-branch auto-deploy will overwrite this once the PR merges, so there's no cleanup needed.

Alternative: use `npm run push-pr` which detects server/ changes and deploys automatically.
