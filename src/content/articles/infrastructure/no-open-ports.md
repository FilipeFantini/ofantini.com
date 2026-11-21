---
title: "Administering a server with no inbound ports"
summary: "How the node accepts no inbound connection at all, yet is administered over a private network, with web tools open in a browser behind a login."
project: lagom
group: infrastructure
order: 3
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0021", "0028", "0030"]
---

Every port a server opens to the internet is a door to guard. This node has none, on IPv4 or IPv6, and is still administered, with its web tools, such as the orchestrator's interface, open from any browser.

## How it works

Two channels are used. Tailscale, a private network between the operator's devices and the node, grants raw access to the database and the cluster. Cloudflare Access opens a tool in the browser behind a login, with nothing to install.

[Source: access channels](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L403-L411)

**The private network.** Tailscale is a WireGuard mesh (encrypted tunnels between devices) with access rules by identity and no open ports. Operators reach the node's SSH and the Kubernetes API, nothing else, and the node can open no connection to any device, so a compromised node cannot reach the operator's.

[Source: access channels](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L430-L434)

The cloud firewall has no inbound rules, so it denies all inbound traffic. Tailscale still connects because the firewall is stateful and the connection starts outbound.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L951-L958)

**The tunnel.** A small Pod, `cloudflared`, dials out to Cloudflare and keeps the connections open, and browser requests come back down them, like a phone line dialled out that then carries incoming calls. An Access application shows a login page, admits only the e-mail addresses in its policy, then adds a signed token, a JWT, to every request; `cloudflared` refuses a request whose token is missing or not signed for this application.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1407-L1412)

![Sequence of a browser request: cloudflared dials out first; the browser logs in at the Cloudflare edge; the request comes down the open connection with a signed token, which cloudflared checks before forwarding to the Dagster webserver](/diagrams/infrastructure-no-open-ports.svg)

[Source: the tunnel decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L154-L167)

## The trade-off

Because `cloudflared` checks the token itself, a deleted or bypassed Access application leaves the tools failing closed. The price is that Cloudflare terminates TLS and sees the traffic: run metadata and logs, which may include sample rows of public data. The Access application, its policy and the DNS record also live outside Git.

[Source: the tunnel decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L88-L98) · [Source: the tunnel decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L200-L225)

With public port 22 closed, no inbound port is left on IPv4 or IPv6. The runbook probes the public ports from outside alongside a control probe that must succeed, so a closed result means something. One safeguard is unverified end to end: seeing `cloudflared` refuse a request would mean turning Access off.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L111-L114) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L966-L978) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1544-L1547)

## Details

The first answer over the private network and why it lasted one day, the firewall against what k3s publishes, the go-live measurements and the other costs accepted:

[Source: the Tailscale decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0028-dagster-ui-over-the-tailnet.md#L48-L102) · [Source: the Tailscale decision, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0028-dagster-ui-over-the-tailnet.md#L239-L252) · [Source: the tunnel decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L6-L10) · [Source: the k3s components decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L19-L22) · [Source: the tunnel decision, note of 2026-11-07](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0030-operator-uis-behind-cloudflare-access.md#L263-L277) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L30-L32)
