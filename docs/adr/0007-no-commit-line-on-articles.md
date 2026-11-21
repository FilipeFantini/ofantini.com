# ADR-0007 — Article pages drop the pinned-commit line

- **Status:** Accepted, by the operator approving the pull request that adds it
- **Date:** 2026-11-21
- **Decided by:** the operator, on 2026-11-21: the line "A dated account,
  pinned to Lagom commit … and ofantini.com commit …" is more detail than a
  reader needs.
- **Amends:** [ADR-0005](0005-practice-projects.md), withdrawing Decision 3
  (`pins`), and [ADR-0006](0006-published-and-updated-dates.md), Decision 2,
  in where the dates sit.

## Context and problem

Every article page opened with a line naming the commit it was pinned to,
linked to that commit: `lagom_commit` for a Lagom article, `pins` with one
commit per repository for a practice article. The line was the article's only
use of those fields. Since ADR-0006, the page also shows when the article was
published and updated, which tells a reader how current it is in plainer
terms. Each source line already links to a permalink at a fixed commit, so
the facts stay dated where they are cited.

## Decision

1. **The line goes.** Article pages show the title, then the published and
   updated days.
2. **The fields go with it.** `lagom_commit` and `pins` are removed from every
   article, from the fixtures, from the content schema and from the contract
   test, which no longer looks for the line. A field nothing reads would be
   unused configuration (AGENTS.md §3).
3. **What still dates the facts.** Every source line is a permalink to a file
   at a fixed commit of Lagom or of this repository, as
   [Lagom's ADR-0039](https://github.com/FilipeFantini/lagom/blob/main/docs/adr/0039-the-site-in-its-own-repository.md),
   Decision 3, asks. The figures in `src/data/figures.json` keep their own
   pinned sources and their check.

## Consequences

**Positive.** The top of an article is shorter and says what a reader needs:
when it was written and last changed.

**Negative.** No single link shows the whole repository as it was when an
article was written; a reader follows a source line instead. Nothing checks
that the source lines of one article point at the same commit, as nothing did
before.

## Reversal

Restore the fields in the articles and the schema, the line in
`src/layouts/Article.astro` and `src/layouts/PracticeArticle.astro`, its style,
and the two contract assertions.
