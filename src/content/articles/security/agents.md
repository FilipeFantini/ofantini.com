---
title: "Letting AI agents write code behind gates they cannot open"
summary: "How agents work on the platform repository under one rulebook, in containers with no credentials, with a token that cannot approve its own changes, and how those gates were made leaner."
project: lagom
track: security
order: 2
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0013", "0029", "0032", "0035", "0036", "0037", "0038"]
---

Agents write code in my repository, and I don't read it, by design: approval rests on a plain-language summary and the reviewer's verdict, not on the code. That raises a plain question: why trust a change? The answer was not to trust the agent. I built gates that sit outside it, and then made sure the agent's own credentials cannot open them.

[Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L142-L153) · [Source: the reviewer decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L5-L8)

## What was built

**One rulebook.** The rules live in `AGENTS.md`, which Codex, OpenCode and most harnesses read. A harness is the program that runs a model as an agent, gives it tools and enforces what it may do. `CLAUDE.md` holds one line, `@AGENTS.md`, which Claude Code expands into the file. A rule that every agent must follow is never kept in one agent's memory.

[Source: the multi-harness decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0029-agents-on-more-than-one-harness.md#L21-L30) · [Source: the multi-harness decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0029-agents-on-more-than-one-harness.md#L85-L90)

**Containers without credentials.** An agent runner runs several agents at once. Each agent's commands run in a container that holds no credential: no kubeconfig, SSH key, GitHub token or provider key. The agent clones the public repository inside it, and no folder of the checkout is lent. A container on my Mac was measured on 2026-11-07 reaching the cluster's API port and SSH port, so the boundary is the missing credentials, not the network.

[Source: the container decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0032-agents-in-credential-free-containers.md#L44-L50) · [Source: the container decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0032-agents-in-credential-free-containers.md#L107-L114)

**A scoped token.** To finish their own work, agents got one credential: my fine-grained GitHub token, scoped to this repository, expiring in at most 90 days, with read and write on contents and pull requests and read on metadata. Administration, Deployments, Environments, Secrets and Workflows are all "No access". The token sits in the runner's connector, not in the container, so the agent uses the tools without reading it. Writing to `main` is writing to the cluster, because Argo CD (the program that applies `main` to the cluster) deploys whatever is there, so the gates must hold even though the agent acts as me.

[Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L31-L47) · [Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L80-L93)

**The guardrail environment.** As first built, a list of guarded paths, kept in `CODEOWNERS`, names what reaches the cluster, judges a change or states the rules. A pull request that touches one waits on a GitHub environment called `guardrail`, whose required reviewer is me. Approving needs the Deployments permission, which the agents' token lacks, and GitHub's MCP server (the tool interface agents use to reach GitHub) offers no tool for it.

[Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L100-L140)

**The reviewer as a required check.** As first built, a workflow runs a reviewer agent on every pull request. It runs on `pull_request_target`, so its prompt and role come from `main`, and a pull request cannot weaken the review that judges it. The reviewer gets `Read`, `Grep` and `Glob`: no shell, no network.

[Source: the reviewer decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L58-L79)

![Path of a pull request through the gates: CI checks, the agent review and the guardrail approval run in parallel; a guarded change waits for me, and the agent's own token is refused when it tries to approve; merge needs every required check green](/diagrams/security-agents.svg)

## Why this way

It started from a gap: "never push, never change the cluster" was prose, and nothing technical enforced it. The answer was five layers of guardrails, from permissions through CI gates and agent review to the human, with one rule that a gate never approves a change to itself. I rejected full autonomy because GitOps amplifies a bad merge, and a human reviewing every change because it caps throughput at one person's attention.

[Source: the guardrails decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L15-L23) · [Source: the guardrails decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L65-L88) · [Source: the guardrails decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L45-L55)

Then came a hard fact. A separate machine account for agents was created and suspended by GitHub at once, so the only identity available was mine. A usual code-owner rule would not work, since I can't approve a pull request opened in my own name. The conclusion: gates must look at what the token can do, not who acted.

[Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L43-L47) · [Source: its alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L60-L69)

For the reviewer, the ordinary CI workflow was out: on `pull_request` GitHub runs the workflow as the pull request edits it, so a change could rewrite its own reviewer's prompt, and a secret would sit next to code the pull request supplies.

[Source: the reviewer decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L44-L47)

## How it's going

The roadmap records the setup and its test on 2026-11-07. A guarded test pull request waited on the environment, an unguarded one passed, and approving with the runner's token was refused with a 403. The reviewer was made a required check the same day, after it posted a verdict on a test pull request.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L420-L435)

The roadmap and decision notes record no count of the pull requests agents merged or of how often the reviewer blocked one, so none is given here.

## Gotchas

**An escape became a gate.** The first rule is that every defect found after merge adds the check that would have caught it. One instance: an implementer agent discarded its own uncommitted work with `git checkout -- .`. Deny rules for destructive git commands followed, and they bind every Claude Code session, since the harness cannot scope them to one agent.

[Source: the guardrails decision, rule 1](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L82-L85) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L369-L373)

**Machinery was built and removed in a day.** On 2026-11-05 I built an orchestration layer for running agents from one page, in a sealed container, and then removed it. It was too much machinery for the need. The notes keep its design for when several agents at once, or work from the phone, become a need.

[Source: the multi-harness decision, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0029-agents-on-more-than-one-harness.md#L53-L59)

**The gates were too heavy within a day.** After the agent gates went live, about half of the guarded list protected process and quality, not security: the decision records, the roadmap, every dependency file. Each change waited for a click. The reviewer sent back pull requests for documentation points. I cut the list to the security core, made a Markdown-only change outside the agents' instructions pass without calling the model, and limited the reviewer's blocking to what would make the platform wrong or unsafe. The accepted cost: an agent can now edit a decision record or the runbook without me, and the reviewer reads it.

[Source: the leaner gates decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0038-leaner-agent-gates.md#L17-L25) · [Source: its decision and consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0038-leaner-agent-gates.md#L33-L57) · [Source: its consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0038-leaner-agent-gates.md#L71-L73)

**A gate nobody can pass.** The reviewer first ran on Opus. On the day it became required, the subscription it spends was near its limit, and when the limit is reached the check fails and nothing merges. It moved to Sonnet. The trade is stated: a weaker reader of the code, and the only one.

[Source: the Sonnet decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0037-the-reviewer-runs-on-sonnet.md#L12-L23) · [Source: its consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0037-the-reviewer-runs-on-sonnet.md#L39-L41)

**What the gates do not cover is written down.** The reviewer is a model, so it can be wrong or be steered by text an author wrote to mislead it. The gate depends on the token's permissions, which are set in GitHub's settings; the refusal test shows them once and nothing re-checks them later. No human reads the code: approval rests on a plain-language section, and a summary that is wrong is approved as if it were right. Test code is not guarded either.

[Source: the reviewer decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L123-L127) · [Source: the token decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L182-L200)

## What's next

A note says staging pins could lose their guard once an AppProject (an Argo CD boundary on what an Application may create) confines staging's Applications to their namespace and no cluster-scoped kind. Until then every deploy waits for me.

[Source: the token decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L189-L194)
