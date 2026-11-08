---
title: Agents in credential-free containers
summary: "Why the commands an agent runs get no credentials, and how a reviewed change is published by a separate connector."
project: lagom
track: security
order: 1
lagom_commit: 3d6039735d0ffca19553c1669d506f34da241a68
adrs: ["0032", "0035"]
---

Agents can help write code, but the commands they run should not receive the keys to the rest of the system. Lagom separates the place where code runs from the connector that can publish a reviewed change.

## A boundary around commands

An agent works in its own container, an isolated place to run commands, with a clone of the public repository. Infrastructure credentials do not enter that container. The runner's connector, not the container, may hold a GitHub token scoped to this one repository, under ADR-0035.

![Flowchart showing security boundaries for the data platform](/diagrams/security.svg)

## What the boundary does and does not do

The container limits access to credentials; it does not make generated code trustworthy. Changes still need review, and the token's permissions define what it can change. Isolation has a cost: agents need a deliberate way to share work.

[Source: ADR-0032](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/adr/0032-agents-in-credential-free-containers.md#L90-L140) · [Source: ADR-0035](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/adr/0035-agents-use-the-operators-scoped-token.md)
