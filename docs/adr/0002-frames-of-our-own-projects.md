# ADR-0002 — A page may frame a page of our own projects

- **Status:** Accepted, by the operator approving the pull request that adds it
- **Date:** 2026-11-15
- **Decided by:** the operator, on 2026-11-15: no host other than our own
  projects (the same maintainer and developer), and a framed board keeps its
  tooltips.
- **Amends:** the "No tracking" rule of [`AGENTS.md`](../../AGENTS.md) §3,
  which allowed no request to another host at runtime.

## Context and problem

Lagom publishes its dashboards as static pages at `lagom.ofantini.com`. An
article about them is better with the board in it than with a picture of it:
the board is rebuilt after every pipeline run, and its tooltips show each
earthquake's figures. The site served everything from itself, and the rule
said so: no request to a third party at runtime.

A board is one HTML file that loads nothing else: Lagom's CI checks that it
fetches no script, stylesheet, image or frame by address, and the board sets
no cookie. Its telemetry runs where it is built, in Lagom's cluster, not in the
reader's browser.

## Requirements and constraints

- No tracking: no analytics, no cookie, no request a reader did not choose that
  tells someone else what they read.
- The site still builds from this repository alone (Lagom's ADR-0039,
  Decision 4): a frame is a runtime embed, not a build input.
- A framed page cannot reach the site: not its storage, not its navigation.
- A check fails the build when a frame breaks the rule, as for the copy and the
  figures.

## Alternatives considered

**A picture of the board, committed here.** Keeps the old rule. Rejected: it is
frozen at its commit, and it has no tooltips, which the operator wants kept.

**An SVG of the board, loaded as an image from Lagom's host.** No script runs
in an image. Rejected for the same tooltips.

**A link only.** Rejected: the reader leaves the article to see what it
describes.

## Decision

1. **A page may frame a page of the operator's own projects.** The hosts are
   listed in `scripts/check-frames.mjs`, today `lagom.ofantini.com` alone. A
   host joins the list in a pull request the operator approves; a host of
   anyone else's never does.
2. **Every frame is sandboxed to scripts alone:** `sandbox="allow-scripts"`,
   with no `allow-same-origin`, so the framed page runs in an opaque origin
   with no cookies or storage, and cannot submit forms, open pop-ups or
   navigate the site. It also has `referrerpolicy="no-referrer"`, so Lagom's
   host is not told which article framed it, `loading="lazy"`, and a `title`
   for screen readers.
3. **The build checks it.** `check-frames` fails on a frame from another host,
   on one without the sandbox, the referrer policy, lazy loading or a title,
   and on any `<object>`, `<embed>`, `<frame>` or `<portal>`. `tests/checks.mjs`
   proves it refuses a frame from another host and one with
   `allow-same-origin`.
4. **The framed page answers for itself.** A page joins only if it sets no
   cookie and loads nothing from another host, as Lagom's boards are checked to
   do. If one ever does, it leaves the list.

## Consequences

**Positive.** An article shows the live board, tooltips included, and links
the full one. The site's own pages still load nothing from elsewhere.

**Negative.** A reader of such an article sends one request to
`lagom.ofantini.com`, which Cloudflare serves and logs as it logs the site.
The frame has a fixed shape (an `aspect-ratio`), so when the board's height
changes, the frame is set again in this repository. When Lagom's host is down,
the frame is empty while the article stays readable.

## Reversal

Remove the frame from the article and the host from the list; the rule in
`AGENTS.md` returns to no request to another host.
