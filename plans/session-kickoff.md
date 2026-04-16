# Session kickoff — MediCopilot

Paste this as the **first turn** of any new Claude Code session working on
MediCopilot. It makes sure the agent self-hydrates cleanly before touching
any code.

---

## Paste-me-first prompt

> You're working on MediCopilot, a real-time AI copilot for Medicare
> insurance agents on live sales calls. Before anything else:
>
> 1. Read `CLAUDE.md` at the repo root (onboarding doc — stack, conventions,
>    glossary, directory layout).
> 2. Read `plans/PRD.md` (authoritative product + architecture spec). Pay
>    attention to: the phase we're currently in, the Open Questions table
>    (resolved questions are decisions — don't re-derive them), and the
>    Data models section.
> 3. Skim `plans/ui-final-spec.md` only if the task involves UI work.
> 4. `git log --oneline -20` on the current branch to see recent commits.
>
> Now, here's the task: **[paste the issue title + link, or describe the
> specific task]**.
>
> Create a feature branch off the parent branch (the long-lived one is
> `claude/medicopilot-launch-planning-6Rmg5` — confirm with `git branch`).
> When you're done, commit with a descriptive message and open a PR
> targeting the parent branch.

---

## Conventions to call out explicitly if the agent forgets

- **No `console.log`** in shipped code — use TODO comments referencing
  the logger until Axiom lands in P2
- **No secrets in client bundle** — anything not prefixed `VITE_` is
  server-only
- **Inline style objects** (no Tailwind, no CSS modules) to match
  existing UI patterns
- **JSDoc typedefs**, not TypeScript (P0–P1); full TS migration lands in P2
- **PII redaction** — SSN / card / phone regex only; first name / DOB /
  meds pass through under Anthropic BAA (see PRD OQ #12)
- **Never push to `main` directly** — PRs only, lint + test + build must
  pass

## When to use sub-agents (Agent tool)

Spawn a sub-agent when:
- You need to explore 3+ files to answer one question (use `Explore` subagent)
- The task requires a focused plan before any code changes (use `Plan` subagent)
- You're running independent investigations in parallel

Don't spawn a sub-agent for:
- Single-file reads (use `Read` directly)
- Simple grep/glob searches (use `Grep`/`Glob` directly)
- The primary task itself (you are the agent)

## When to stop the session

Close the session when:
- Your PR is merged
- You hit a blocker you can't resolve without the user
- Context window is 70%+ full and your task isn't done — dump state into
  a PR draft / issue comment / scratch doc and start a fresh session

Do NOT stretch a session across multiple PRs. Fresh context per PR is
cheaper than re-hydrating a polluted one.

## Branching pattern

```
main                                       (production — deploy target)
└─ claude/medicopilot-launch-planning-6Rmg5 (long-lived planning branch)
   ├─ p1/lead-provider                     (one PR per issue — target the branch above)
   ├─ p1/pii-redactor
   ├─ p1/zod-schemas
   └─ p1/vitest-ci
```

Once the planning branch has enough P1 work merged in, we squash-merge
it into `main` — don't merge individual P1 PRs directly to `main`.
