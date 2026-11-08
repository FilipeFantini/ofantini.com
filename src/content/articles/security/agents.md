---
title: "Agents that write code behind gates they cannot open"
summary: "How AI agents work on the platform's repository under one rulebook, in containers with no credentials, with a token that cannot approve its own changes, and how those gates were later made leaner."
project: lagom
track: security
order: 2
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0013", "0029", "0032", "0035", "0036", "0037", "0038"]
---

Agents write most of the code in this repository, and the operator does not read code. That raises a plain question: why trust a change? Our answer was not to trust the agent. We built gates that sit outside it, and then made sure the agent's own credentials cannot open them.

## What we built

**One rulebook.** The rules live in `AGENTS.md`, which Codex, OpenCode and most harnesses read. A harness is the program that runs a model as an agent, gives it tools and enforces what it may do. `CLAUDE.md` holds one line, `@AGENTS.md`, which Claude Code expands into the file. A rule that every agent must follow is never kept in one agent's memory.

[Source: ADR-0029](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0029-agents-on-more-than-one-harness.md#L21-L30) · [Source: ADR-0029, decision 1](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0029-agents-on-more-than-one-harness.md#L85-L90)

**Containers without credentials.** An agent runner runs several agents at once. Each agent's commands run in a container that holds no credential: no kubeconfig, SSH key, GitHub token or provider key. The agent clones the public repository inside it, and no folder of the operator's checkout is lent. A container on the operator's Mac was measured on 2026-11-07 reaching the cluster's API port and SSH port, so the boundary is the missing credentials, not the network.

[Source: ADR-0032](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0032-agents-in-credential-free-containers.md#L44-L50) · [Source: ADR-0032, decisions 2 and 3](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0032-agents-in-credential-free-containers.md#L107-L114)

**A scoped token.** To finish their own work, agents got one credential: a fine-grained GitHub token of the operator's, scoped to this repository, expiring in at most 90 days, with read and write on contents and pull requests and read on metadata. Administration, Deployments, Environments, Secrets and Workflows are all "No access". Writing to `main` is writing to the cluster, because Argo CD applies `main`, so the gates must hold even though the agent acts as the operator.

[Source: ADR-0035](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L31-L47) · [Source: ADR-0035, decision 1](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L80-L93)

**The guardrail environment.** A list of guarded paths, kept in `CODEOWNERS`, names what reaches the cluster, judges a change or states the rules. A pull request that touches one waits on a GitHub environment called `guardrail`, whose required reviewer is the operator. Approving needs the Deployments permission, which the agents' token lacks, and GitHub's MCP server offers no tool for it.

[Source: ADR-0035, decisions 3 and 4](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L100-L140)

**The reviewer as a required check.** A workflow runs a reviewer agent on every pull request. It runs on `pull_request_target`, so its prompt and role come from `main`, and a pull request cannot weaken the review that judges it. The reviewer gets `Read`, `Grep` and `Glob`: no shell, no network.

[Source: ADR-0036, decisions 1 and 2](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L58-L79)

![Path of a pull request through the gates: CI checks, the agent review and the guardrail approval run in parallel; a guarded change waits for the operator, and the agent's own token is refused when it tries to approve; merge needs every required check green](/diagrams/security-agents.svg)

## Why this choice

ADR-0013 started from a gap: "never push, never change the cluster" was prose, and nothing technical enforced it. Its answer was five layers of guardrails, from permissions through CI gates and agent review to the human, with one rule that a gate never approves a change to itself. It rejected full autonomy because GitOps amplifies a bad merge, and a human reviewing every change because it caps throughput at one person's attention.

[Source: ADR-0013](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L15-L23) · [Source: ADR-0013, decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L65-L88) · [Source: ADR-0013](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L45-L55)

ADR-0035 then ran into a hard fact. A separate machine account for agents was created and suspended by GitHub at once, so the only identity available was the operator's. A usual code-owner rule would not work, since the operator cannot approve a pull request opened in their own name. The ADR's conclusion: gates must look at what the token can do, not who acted.

[Source: ADR-0035](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L43-L47) · [Source: ADR-0035, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L60-L69)

For the reviewer, ADR-0036 rejected putting the review in the ordinary CI workflow: on `pull_request` GitHub runs the workflow as the pull request edits it, so a change could rewrite its own reviewer's prompt, and a secret would sit next to code the pull request supplies.

[Source: ADR-0036](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L44-L47)

## How it has worked

The roadmap records the setup and its test on 2026-11-07. A guarded test pull request waited on the environment, an unguarded one passed, and approving with the runner's token was refused with a 403. The reviewer was made a required check the same day, after it posted a verdict on a test pull request.

[Source: roadmap, Track G](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L420-L435)

The roadmap and the ADRs record no count of the pull requests agents merged or of how often the reviewer blocked one, so we give none.

## Gotchas

**An escape became a gate.** ADR-0013's first rule is that every defect found after merge adds the check that would have caught it. The first instance: an implementer agent discarded its own uncommitted work with `git checkout -- .`. Deny rules for destructive git commands followed, and they bind every Claude Code session, since the harness cannot scope them to one agent.

[Source: ADR-0013, rule 1](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L82-L85) · [Source: roadmap, Track G](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L369-L373)

**Machinery was built and removed in a day.** On 2026-11-05 an orchestration layer for running agents from one page was built in a sealed container and then removed. The operator judged it too much machinery for the need. The ADR keeps its design for when several agents at once, or work from the phone, become a need.

[Source: ADR-0029, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0029-agents-on-more-than-one-harness.md#L53-L59)

**The gates were too heavy within a day.** After the agent gates went live, about half of the guarded list protected process and quality, not security: the ADRs, the roadmap, every dependency file. Each change waited for the operator's click. The reviewer sent back pull requests for documentation points. ADR-0038 cut the list to the security core, made a Markdown-only change outside the agents' instructions pass without calling the model, and limited the reviewer's blocking to what would make the platform wrong or unsafe. The accepted cost: an agent can now edit an ADR or the runbook without the operator, and the reviewer reads it.

[Source: ADR-0038](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0038-leaner-agent-gates.md#L17-L25) · [Source: ADR-0038, decision and consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0038-leaner-agent-gates.md#L33-L57) · [Source: ADR-0038, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0038-leaner-agent-gates.md#L71-L73)

**A gate nobody can pass.** The reviewer first ran on Opus. On the day it became required, the subscription it spends was near its limit, and when the limit is reached the check fails and nothing merges. ADR-0037 moved it to Sonnet. The trade is stated: a weaker reader of the code, and the only one.

[Source: ADR-0037](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0037-the-reviewer-runs-on-sonnet.md#L12-L23) · [Source: ADR-0037, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0037-the-reviewer-runs-on-sonnet.md#L39-L41)

**What the gates do not cover is written down.** The reviewer is a model, so it can be wrong or be steered by text an author wrote to mislead it. The gate depends on the token's permissions, which the operator sets in GitHub's settings; the refusal test shows them once and nothing re-checks them later. No human reads the code: the operator approves on a plain-language section, and a summary that is wrong is approved as if it were right. Test code is not guarded either.

[Source: ADR-0036, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L123-L127) · [Source: ADR-0035, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L182-L200)

## What comes next

ADR-0035 notes that staging pins could lose their guard once an AppProject confines staging's Applications to their namespace and no cluster-scoped kind. Until then every deploy waits for the operator.

[Source: ADR-0035, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L189-L194)
