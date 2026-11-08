# ADR-0001 — How a change reaches main

- **Status:** Accepted
- **Date:** 2026-11-08
- **Decided by:** the operator, on 2026-11-08: this repository is kept to the
  same standard as Lagom, without its platform-specific checks.

## Context and problem

[Lagom's ADR-0039](https://github.com/FilipeFantini/lagom/blob/main/docs/adr/0039-the-site-in-its-own-repository.md)
moved the site into this repository and left two things to it: its branch
protection and its rules for agents, approved by the operator in its first
pull request (Decision 5). The same decision has Cloudflare Pages build the
site with its own Git integration, so whatever reaches `main` is published.

Most changes here are written by agents, on more than one harness, acting
with the operator's GitHub account. The repository is public. Without
protection, any of them could push to `main` and publish at once.

## Requirements and constraints

- Nothing reaches `main`, and so the internet, without the build, the browser
  tests, a secret scan and a review.
- An agent cannot weaken a gate in the same pull request the gate judges, and
  cannot approve a change to the gates or to its own instructions.
- No cost: ADR-0039 rules out new GitHub Actions minutes.
- Only what the site needs. Lagom's resource budget, manifest policy,
  promotion and dbt checks have nothing to check here.

## Decision

1. **A ruleset on `main`**: no deletion, no force push, a pull request for
   every change, squash merge only, no bypass. Four checks are required:
   `build and test`, `secret scan`, `agent review`, `guardrail approval`.
   Squash merge gives one commit per pull request, so a branch's
   work-in-progress commits never reach the history.
2. **CI checks on GitHub Actions; Cloudflare still builds what it serves.**
   Standard runners are free for a public repository, so ADR-0039's cost
   constraint holds. `build and test` runs the same `npm run build` Cloudflare
   runs, then the five browser tests against the preview, which Cloudflare
   does not run. `secret scan` is gitleaks over the whole history, with its
   default rules.
3. **`agent review`** is Lagom's job (its ADR-0036 and ADR-0038): the role in
   `.claude/agents/reviewer.md` on Sonnet, from `main` through
   `pull_request_target`, read-only, blocking only blocker and major findings.
   One difference: Lagom skips the model for a change to Markdown only; here
   only Markdown outside `src/` is skipped. Markdown under `src/` is rendered
   into the site, raw HTML included, so an article is a publication and is
   reviewed like code.
4. **`guardrail approval`** is Lagom's gate (its ADR-0035): a pull request
   that touches a path in `.github/CODEOWNERS` waits for the operator's
   approval of the `guardrail` environment, whose required reviewer is the
   operator, with admin bypass off. The path match is
   `.github/guarded-paths.sh`, a few lines of shell for the subset of the
   CODEOWNERS format the file uses, instead of Lagom's Python tool.
5. **Agents follow [`AGENTS.md`](../../AGENTS.md)**: the same harness rules as
   Lagom's, and, for a runner's connector, a fine-grained token for this
   repository alone with the permissions of Lagom's ADR-0035.

## Consequences

**Positive.** The site has the assurance Lagom has: a page reaches the
internet only after it was built, tested in three browsers, scanned and
reviewed, and a change to the gates waits for the operator.

**Negative.**

- **The first pull request is not judged by its own gates.** `agent review`
  and `guardrail approval` run from `main`, which has neither until that pull
  request merges. It is reviewed by a reviewer subagent before merge and
  approved by the operator in conversation; the ruleset is applied right
  after.
- **`agent review` needs the secret `CLAUDE_CODE_OAUTH_TOKEN`** in this
  repository. Without it the check fails, which blocks every change but
  Markdown outside `src/`: it fails closed.
- **Each article spends one review** of the operator's Claude subscription.
- **Cloudflare preview deployments would bypass all of this.** By default
  Pages publishes every branch at a public `pages.dev` address before any
  check. When the Pages project is connected, preview deployments are set to
  none, so only `main` is built.

## Risks, cost, and reversal

Cost: none; Actions minutes are free for a public repository. Reversal:
delete the ruleset and the `guardrail` environment in the repository settings,
and the workflows.
