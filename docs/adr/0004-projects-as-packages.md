# ADR-0004 — The Projects page shows each project as one card, and Lagom's data projects are called sources

- **Status:** Accepted, by the operator approving the pull request that adds it
- **Date:** 2026-11-21
- **Decided by:** the operator, on 2026-11-21: on the Projects page, Lagom's
  platform and data projects read as separate projects to a visitor who does
  not know Lagom. Each project must read as one package, with its stack shown
  by logo, so that a later project that has nothing to do with Lagom, or a new
  source inside Lagom, fits without confusion.
- **Amends:** [ADR-0003](0003-lagom-platform-and-data-projects.md), in
  wording only: its "data projects" are now called sources. Its structure,
  addresses and redirects stand.

## Context and problem

The Projects page listed Lagom's summary and then, under headings as large as
the project's own, "Platform" and "Data projects" with every article of each.
Two things made Lagom's parts look like projects of their own: the headings
sat at the same level as the project, and the word "project" named both the
top level and each data source inside Lagom. A second project would have
stacked another full article list under the first, and each new source would
have lengthened the page.

## Requirements and constraints

- Each project reads as one package on the Projects page.
- The card shows what the project is made of, with the technologies' logos.
- Published addresses keep working; no section or article moves.
- Every article stays reachable from the Articles page and from its section
  page.

## Decision

1. **The Projects page shows one card per project.** A card holds the
   project's title, which links to its page, its summary, its links, one stack
   with every technology of the platform and of every source, each once, a
   line counting its parts (platform groups, sources by name, articles), and a
   link to open the project. The articles are on the project's page and on the
   Articles page, not on the card.
2. **"Project" names only the top level.** Inside Lagom, a data source is a
   *source*: the hub's second part, the source page, the article trail and the
   Articles page say "Sources". The project file keeps the key `subprojects`,
   so the schema and the build checks are unchanged.
3. **The contract test follows.** `tests/contract.mjs` checks that the
   Projects page links to the project's page, lists each technology once and
   links to no article, and that every article is still listed on the
   Articles page and on its section page.

## Consequences

**Positive.** A new project is one more card of the same shape, and a new
source changes only a count and a name on Lagom's card. The page is short at
any size of Lagom.

**Negative.** A visitor needs one more click to reach an article from the
Projects page. The stack on the card no longer says which part uses which
technology; the Lagom hub still does.

## Reversal

Restore the article lists in `src/content/Projects.astro`, the words "Data
projects" in the hub, the source page, the article layout and the Articles
page, and the `/projects/` entry in the contract test's list of pages that
link to every article.
