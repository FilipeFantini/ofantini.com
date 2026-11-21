---
title: "Guardrails for AI agents writing code"
summary: "How agents work on the platform repository under one rulebook, in containers with no credentials, with a token that cannot approve its own changes, and how those gates were made leaner."
project: lagom
group: security
order: 2
published: 2026-11-09
updated: 2026-11-21
adrs: ["0013", "0029", "0032", "0035", "0036", "0037", "0038"]
---

The code in the platform repository is written by AI agents and, by design, is not read line by line by the operator: approval rests on a plain-language summary and the reviewer's verdict. So trust rests on gates outside the agent, which the agent's own credentials cannot open.

[Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L142-L153) · [Source: the reviewer decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L5-L8)

## How it works

**One rulebook.** The rules live in `AGENTS.md`, which Codex, OpenCode and most harnesses read (a harness runs a model as an agent, gives it tools and enforces what it may do). `CLAUDE.md` holds one line, `@AGENTS.md`, which Claude Code expands into the file.

[Source: the multi-harness decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0029-agents-on-more-than-one-harness.md#L21-L30)

**Containers without credentials.** Each agent's commands run in a container with no kubeconfig, SSH key, GitHub token or provider key. From the operator's Mac such a container could reach the cluster's API and SSH ports, so the boundary is the missing credentials, not the network.

[Source: the container decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0032-agents-in-credential-free-containers.md#L44-L50) · [Source: the container decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0032-agents-in-credential-free-containers.md#L107-L114)

**A token that cannot approve.** Agents finish their work with the operator's fine-grained GitHub token, scoped to this repository, with no access to Administration, Deployments, Environments, Secrets or Workflows. A pull request on a guarded path waits on a GitHub environment, `guardrail`, whose required reviewer is the operator, and approving it needs the Deployments permission the token lacks.

[Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L31-L47) · [Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L100-L140)

**The reviewer as a required check.** A workflow runs a reviewer agent on every pull request, with its prompt and role taken from `main`, so a pull request cannot weaken the review that judges it.

[Source: the reviewer decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L58-L79)

![Path of a pull request through the gates: CI checks, the agent review and the guardrail approval run in parallel; a guarded change waits for the operator, and the agent's own token is refused when it tries to approve; merge needs every required check green](/diagrams/security-agents.svg)

## The trade-off

A separate machine account for agents was suspended by GitHub at once, so the only identity available was the operator's, and the gates must look at what the token can do, not who acted. On 2026-11-07, an approval with the runner's token was refused with a 403.

[Source: the token decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L43-L47) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L420-L435)

The gates then proved too heavy, so the guarded list was cut to the security core, and the reviewer blocks only what would make the platform wrong or unsafe. The accepted cost: an agent can now edit a decision record or the runbook without the operator's approval, with only the reviewer reading it. The reviewer is a model, so it can be wrong or steered, and a wrong summary is approved as if it were right.

[Source: the leaner gates decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0038-leaner-agent-gates.md#L33-L57) · [Source: its consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0038-leaner-agent-gates.md#L71-L73) · [Source: the reviewer decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0036-the-reviewer-as-a-required-check.md#L123-L127)

## Details

The layers of guardrails, the escape that became a gate, the machinery built and removed in a day, why the reviewer runs on Sonnet, and what could loosen the guard next:

[Source: the guardrails decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L65-L88) · [Source: the guardrails decision, rule 1](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0013-agent-driven-development-guardrails.md#L82-L85) · [Source: the multi-harness decision, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0029-agents-on-more-than-one-harness.md#L53-L59) · [Source: the Sonnet decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0037-the-reviewer-runs-on-sonnet.md#L12-L23) · [Source: the token decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0035-agents-use-the-operators-scoped-token.md#L182-L200)
