---
title: "A server with no open ports, and still reachable"
summary: "How the platform's node accepts no inbound connection, yet the operator administers it over a private network and opens web tools in a browser behind a login."
project: lagom
track: infrastructure
order: 3
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0021", "0028", "0030"]
---

A server that listens for the internet has a door, and every door needs a lock, a guard and someone watching. We wanted a node with no door at all: no inbound port open, on IPv4 or IPv6. The operator still has to administer it, and still wants to open web tools, such as the orchestrator's interface, from any browser.

## What we built

Access is split into channels, each less privileged than the one before. The ones that matter here are two. Tailscale, a private network between the operator's devices and the node, grants raw access to the database and the whole cluster. Cloudflare Access grants a tool in the browser behind a login, with nothing to install.

[Source: architecture.md, section 10](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L403-L411)

**The private network.** Tailscale is a WireGuard mesh with access rules by identity and no open ports. The node is tagged as a machine of a role, not a person, and the rules name roles: operators reach the node's SSH and the Kubernetes API, and nothing else, not even the kubelet (the agent that runs pods). The node can open no connection to anyone's device, so a compromised node cannot reach the operator's machine. The policy carries `tests`, assertions the admin console checks on every save, and a policy that breaks them is rejected.

[Source: architecture.md, section 10](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L430-L434) · [Source: architecture.md, runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L943-L949)

The cloud firewall stays attached with no inbound rules, which denies all inbound traffic. Tailscale still connects directly because the firewall is stateful and the connection starts from outbound packets.

[Source: architecture.md, runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L951-L958)

**The tunnel.** For browser tools, a small Pod called `cloudflared` dials out to Cloudflare and keeps the connections open. Requests come back down them. Think of a phone line we call out on, which then carries incoming calls. An Access application is Cloudflare's doorman: it shows a login page and lets through only the e-mail addresses in its policy. The login is a one-time code sent to that address. After login, Access signs a token, a JWT, and adds it to every request; `cloudflared` refuses a request whose token is missing or not signed for this application.

[Source: architecture.md, runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1407-L1412)

![Sequence of a browser request: cloudflared dials out first; the browser logs in at the Cloudflare edge; the request comes down the open connection with a signed token, which cloudflared checks before forwarding to the Dagster webserver](/diagrams/infrastructure-no-open-ports.svg)

The diagram follows the ADR's six steps, from the outbound connections to the forward over plain HTTP inside the cluster.

[Source: ADR-0030](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L154-L167)

## Why this choice

The tools have no login of their own: whoever reaches Dagster's open-source UI can start, cancel and delete runs, so reaching it is the access control. That shaped the first answer. ADR-0028 chose `tailscale serve` on the node: Tailscale was already running there, it needed 0 MiB of new requests and no new credential. It set aside a Tailscale Kubernetes operator: not measured, but the ADR put its requests at about 128 MiB or more, which would not fit the roughly 100 MiB left under the memory ceiling, and it becomes the better option once several services need their own names. It also rejected Cloudflare Tunnel with Access as the wrong channel, since the operator's channel was Tailscale, and because it "fails open": a misconfigured Access application would mean a public Dagster with no login.

[Source: ADR-0028](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0028-dagster-ui-over-the-tailnet.md#L22-L24) · [Source: ADR-0028](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0028-dagster-ui-over-the-tailnet.md#L48-L102)

Then the operator saw it running and changed their mind. ADR-0030 records why: a port in the URL is not how the platform should present its tools, other orchestrators will follow, and the tools should be reachable from anywhere, behind a login. It also rejected running our own login proxy, because it would need port 443 open to the internet, which ends "zero inbound ports".

[Source: ADR-0030](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L6-L10) · [Source: ADR-0030](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L72-L77)

ADR-0028's objection was that Access fails open. ADR-0030 adds a check that closes that gap: because `cloudflared` checks the signed token itself, a deleted or bypassed Access application leaves the tools failing closed. The tools also share one hostname, with one path per tool, kept apart from the one that serves the public site: a DNS name points at one destination, so putting the tools on the site's own hostname would route the site through the node and take it down with the cluster.

[Source: ADR-0030](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L88-L98) · [Source: ADR-0030](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L134-L142)

## How it has worked

Public port 22 was closed, leaving zero inbound ports on IPv4 and IPv6. The runbook's check probes the public ports from outside the tailnet with a control probe that must succeed, so a closed result means something. Over the tailnet, 22 and 6443 answer and 10250 does not.

[Source: roadmap, M1](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L111-L114) · [Source: architecture.md, runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L966-L978)

On 2026-11-07 the tunnel went live. `cloudflared` registered four connections to Cloudflare's edge. Without a login, each tool path and the root answered 302 to the Access login page. The operator logged in from a private window with the e-mail code. An address outside the policy saw "code sent" and received nothing, which is Access's intended behaviour. `cloudflared` used 24 MiB at start and 31 MiB a few minutes later, idle, against its 48 MiB request.

[Source: ADR-0030, note of 2026-11-07](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L263-L277)

## Gotchas

**The first answer lasted one day.** On 2026-11-05, `tailscale serve` was set up and measured: `tailscaled`'s memory went from 60,708 to 60,824 KiB, about 0.1 MiB. From the operator's machine the URL timed out, as expected, because the access rules had not yet granted the port, which also showed the default deny at work. The operator then chose the tunnel. Serve was turned off the same day and the rules were never changed. Removing an Application from Git does not remove its objects, so the Service had to be deleted by hand.

[Source: ADR-0028, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0028-dagster-ui-over-the-tailnet.md#L239-L252)

**The firewall was doing more than it seemed.** k3s listens on every interface. The runbook says never to delete or detach the empty firewall: it is the only thing keeping the API, the kubelet and anything a future LoadBalancer Service publishes off the internet. That was not hypothetical. Traefik, which served nothing, was published on ports 80 and 443 of the node's public address by k3s's built-in load balancer, and only the firewall kept them closed. ADR-0021 disabled both, so the firewall is now a second layer for those ports, not the only one.

[Source: architecture.md, runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L951-L957) · [Source: ADR-0021](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L19-L22) · [Source: ADR-0021, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L66-L69)

**One safeguard is not verified end to end.** Seeing `cloudflared` refuse a request would mean turning Access off. What was checked instead is that the rules parse and that the `access` block applies to every rule.

[Source: architecture.md, runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1544-L1547)

**Costs accepted on purpose.** Cloudflare terminates TLS, so it sees the traffic: run metadata and logs, which may include sample rows of public data. The Access application, its policy and the DNS record live outside Git, like the Tailscale rules. The hostname is public in DNS and says that operator tools exist, though nothing is reachable through it without the login. A change to the tunnel's rules needs a manual annotation bump to restart it, and nothing checks that yet.

[Source: ADR-0030](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L200-L225)

**Small things that bite.** Bookmark the tool addresses with the final slash. Without it Dagster redirects to an address that says `http://`, because it does not know the request came in over HTTPS.

[Source: architecture.md, runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1398-L1401)

## What comes next

Partners' reports will use the same path, each with its own Access policy. Terraform is to take over the resources outside the cluster by a trigger, the next node created or rebuilt, which the operator deferred on 2026-10-28.

[Source: roadmap, trigger table](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L30-L32)
