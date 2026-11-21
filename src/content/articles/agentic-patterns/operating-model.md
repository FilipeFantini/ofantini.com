---
title: "An operating model for AI agents: roles, a rulebook and layered gates"
summary: "How AI agents write most of the code in Lagom and in this site while the operator keeps control: the guardrail layers, one rulebook for every harness, the roles, the handoff between providers, and what none of it guarantees."
project: agentic-patterns
order: 1
published: 2026-11-21
adrs: ["0013", "0029", "0035", "0036", "0037", "0038", "0051", "0054"]
---

Lagom was set up to be extended through prompts alone: a source or a data product is described, and agents carry development, testing and deployment. The same decision names the constraint: human attention does not scale with volume, and neither does prose. So the code is not read by the operator. A change is approved on a plain-language summary and a reviewer's verdict, and the rest rests on gates that hold without anyone watching.

[Source: the guardrails decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0013-agent-driven-development-guardrails.md#L8-L27) · [Source: the token decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0035-agents-use-the-operators-scoped-token.md#L7-L16)

The division of work is explicit too: in the infrastructure, agents lead and explain; in the data, the operator leads with domain expertise.

[Source: the documentation decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0054-documentation-one-place-per-fact.md#L13-L15)

## Terms

A **model** is the AI itself. A **harness** is the program that runs a model as an agent, gives it tools and enforces what it may do: Claude Code, Codex and Antigravity are harnesses. A **role** is a written job, such as reviewer, that any harness can take on.

[Source: the harness decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0029-agents-on-more-than-one-harness.md#L23-L27)

## Five layers of guardrails

Each layer catches what the one before it cannot: permissions (what an agent may do at all), deterministic gates (what a change may contain), agent review (whether it is right where no rule can say), verification after deployment (whether what reached the cluster behaved), and the human (which way the platform goes). A rule moves to the most deterministic layer that can express it.

[Source: the guardrails decision, layers](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0013-agent-driven-development-guardrails.md#L63-L80)

Two rules carry the model. Every escape becomes a gate: a defect found after a merge is fixed together with the check that would have caught it, or with the reason none can. And a gate never approves a change to itself: a change to CI, to agent instructions, to permissions or to secrets needs the operator.

[Source: the guardrails decision, rules](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0013-agent-driven-development-guardrails.md#L82-L101)

## One rulebook for every harness

The rules first lived in `CLAUDE.md`, which only Claude Code loads, and the permission for an agent to merge after an approving review lived only in Claude's private memory, which no other agent reads. The rules moved to `AGENTS.md`, which most harnesses read, and `CLAUDE.md` now holds one line that imports it. A rule every agent must follow is never kept in one agent's memory.

[Source: the harness decision, context](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0029-agents-on-more-than-one-harness.md#L31-L43) · [Source: its decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0029-agents-on-more-than-one-harness.md#L85-L97) · [Source: this site's rulebook](https://github.com/FilipeFantini/ofantini.com/blob/cf6bc5d99de9720908ba254548667beb27f22c15/AGENTS.md#L1-L7)

## Roles

The session the operator talks to is the architect: it designs, writes briefs and decides. A reviewer is never the session that wrote the change. It runs in CI as a required check, with its workflow and instructions taken from `main`, so a pull request cannot weaken the review that judges it. A change to a guarded path also waits for an approval in a GitHub environment that only the operator can give. How each gate is enforced is in [Guardrails for AI agents writing code](/projects/lagom/security/agents/).

[Source: Lagom's rulebook](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/AGENTS.md#L99-L111) · [Source: the reviewer decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0036-the-reviewer-as-a-required-check.md#L69-L73) · [Source: this site's workflow](https://github.com/FilipeFantini/ofantini.com/blob/cf6bc5d99de9720908ba254548667beb27f22c15/AGENTS.md#L129-L138)

## Handing off between providers

A second provider exists to keep working when one provider's usage limit is reached, not to run many agents at once. The first design ran the other harness in a sandbox with the network off, so it could not commit or push. When the architect session was the one at its limit, the handoff fell to the operator, who is not a developer, and stalled. That design was dropped.

[Source: the handoff decision, context](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0051-handoff-to-another-provider-through-t3-code.md#L28-L48)

The handoff now runs through T3 Code, a desktop app that runs Claude Code, Codex and Antigravity one at a time, each under the operator's own account. The repository is the handoff: the outgoing session leaves the status in the project board, the decision records and the open pull request, and the incoming agent starts from there, not from a copy of the chat. The decision record still reads Proposed, while Lagom's rulebook already applies it.

[Source: the handoff decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0051-handoff-to-another-provider-through-t3-code.md#L71-L102) · [Source: Lagom's rulebook](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/AGENTS.md#L139-L149)

## How the model changed

Autonomy was first to be earned per class of change, after a run of merges with no escape. It was replaced by one gate for every class: green required checks and an approving review. A machine account for agents was suspended by GitHub on creation, so agents act with the operator's token, scoped to one repository, and the gates look at what the token can do, not at who acts. An orchestration layer, Paseo, was built and removed on the same day as too much machinery for the need.

[Source: the harness decision, merging](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0029-agents-on-more-than-one-harness.md#L111-L121) · [Source: the token decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0035-agents-use-the-operators-scoped-token.md#L7-L16) · [Source: the harness decision, alternatives](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0029-agents-on-more-than-one-harness.md#L55-L61)

The gates then proved heavy. The guarded list was cut to the security core, and the reviewer, the one gate that costs money, was moved to Sonnet to spend less of the subscription, and now blocks only what would make the platform wrong or unsafe.

[Source: leaner gates](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0038-leaner-agent-gates.md#L7-L12) · [Source: their decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0038-leaner-agent-gates.md#L33-L59) · [Source: the reviewer's model](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0037-the-reviewer-runs-on-sonnet.md#L28-L33)

## What it does not guarantee

The reviewer is the only reader of the code, and a model: a defect it misses reaches `main` unless a required check catches it. A deny list matches commands as written, so it stops mistakes, not a deliberate bypass. In a handoff through T3 Code, the rules bind the other harnesses only as instructions; their own command settings can mirror the deny list as a second layer, not as the boundary.

[Source: the reviewer's model, consequences](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0037-the-reviewer-runs-on-sonnet.md#L35-L41) · [Source: the harness decision, alternatives](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0029-agents-on-more-than-one-harness.md#L76-L78) · [Source: the handoff decision](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0051-handoff-to-another-provider-through-t3-code.md#L86-L94)

## Using it in another repository

The same pieces run in Lagom and in this site, and travel as files:

- `AGENTS.md` as the one rulebook, and `CLAUDE.md` with one line that imports it;
- roles as plain instructions in `.claude/agents/`, with a reviewer that never wrote the change;
- the reviewer as a required check, run from `main`;
- a `CODEOWNERS` list of guarded paths and a `guardrail` environment only the operator can approve;
- a token scoped to one repository, without the permissions to approve.

What stays local is each repository's deterministic gates: a memory budget and dbt tests in Lagom, a JavaScript budget and browser tests here.

[Source: how a change reaches this site's main](https://github.com/FilipeFantini/ofantini.com/blob/cf6bc5d99de9720908ba254548667beb27f22c15/docs/adr/0001-how-a-change-reaches-main.md#L30-L58) · [Source: Lagom's guarded list](https://github.com/FilipeFantini/lagom/blob/56507046c6b6d65acdfbfbb2dab7bea530075adf/docs/adr/0038-leaner-agent-gates.md#L35-L40)
