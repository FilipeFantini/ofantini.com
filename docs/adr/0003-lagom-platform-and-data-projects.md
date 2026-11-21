# ADR-0003 — Lagom in two parts: the platform and its data projects

- **Status:** Accepted, by the operator approving the pull request that adds it
- **Amended by:** [ADR-0004](0004-projects-as-packages.md), in wording: a data
  project is now called a source, and the Projects page shows the project as one card
- **Date:** 2026-11-19
- **Decided by:** the operator, on 2026-11-19: Lagom is a batch data platform ([Lagom ADR-0052](https://github.com/FilipeFantini/lagom/blob/9bb344a46dfcb651eada1408bc8994919d8e95e5/docs/adr/0052-streaming-leaves-the-platform.md));
  the site separates the platform from the data work, and shows every data
  project at a glance.

## Context and problem

Lagom's pages were one flat list of tracks: infrastructure, ETL, modeling,
orchestration, security, data visualization. That list mixed two different
things. The platform is the shared foundation every source runs on, and the
part where AI agents helped most. The data work is one project
per data source, and the operator's own field. A visitor could not tell them
apart, and a second source would have had nowhere to go but into the same
tracks as the first.

## Requirements and constraints

- A visitor sees the platform and each data project as separate parts, and
  every data project at a glance, with its source, status and stack.
- A wrong reference still fails the build, as it did for tracks.
- Published addresses keep working.
- Logos are served by the site itself (AGENTS.md §3, "No tracking").

## Decision

1. **The project file holds both parts.** `src/content/projects/lagom.json`
   has `platform` (its stack and its groups of articles) and `subprojects`,
   one per data source, each with a source, the question its data answers, a
   status (`live`, `building` or `planned`), a stack and an optional pipeline
   diagram. A new collection for subprojects was the alternative; one file is
   simpler, and only Lagom has subprojects.
2. **An article names a group, or a subproject and a kind.** The kind is
   `pipeline` (loading, modelling, publishing) or `report` (what the data
   shows). `order` is unique within a group or a subproject. The content schema
   and `scripts/check-projects.mjs` refuse anything else, including an id used
   by both a group and a subproject, since both live at
   `/projects/lagom/<id>/`.
3. **The shared data stack is a platform group.** The storage decision and the
   dbt checks in CI serve every source, so they form the `Data stack` group,
   which keeps the id `modeling` and so its addresses. Placing them under one
   subproject would leave them in the wrong place once a second source exists.
4. **Moved addresses redirect.** The earthquake articles moved from
   `/projects/lagom/etl/` and `/projects/lagom/visualization/` to
   `/projects/lagom/earthquakes/`. `public/_redirects`, which Cloudflare Pages
   serves as permanent redirects, maps each old address to its new one, and
   `tests/contract.mjs` checks that every old address is no longer a page and
   every new one is.
5. **Logos come from Simple Icons or from the project itself, inlined.** The
   SVG files are copied into `src/icons/` and inlined in the page at build
   time, so they take the text colour and cost no request. Simple Icons comes
   first. A technology it lacks, such as dbt or Dagster, uses the mark from its
   own repository, reduced to one colour without redrawing the shape; with no
   first-party file it is shown by name alone, never with a lookalike. Every
   logo sits beside its name, which is what screen readers read. One registry,
   `src/data/technologies.json`, holds each technology's name, logo, and the
   logo's source and licence, and one component draws every stack from it.
6. **Diagrams take the same logos as badges.** A Mermaid source names a
   technology per node in a comment (`%% icon <node> <technology>`), and
   `npm run diagrams` draws its logo inside the rendered SVG, on the node's
   corner. Mermaid's own icon support was the alternative; by default it loads icon packs
   from the network at render time and would not draw the registry's files.
   The hash that marks a diagram current covers the source and the logos it
   uses.

## Consequences

**Positive.** The hub shows the platform as the existing map and the data
projects as cards; a new source is one entry in `subprojects` and one
directory of articles. The build fails on a wrong group, subproject, kind,
technology, icon or diagram.

**Negative.** The redirects run only on Cloudflare Pages: `npm run preview`
does not serve them, so the test checks the file, not the redirect itself.
Heading anchors inside the two moved articles changed with their directory.
The logos are brand marks: Simple Icons releases its files under CC0 and the
dbt and Dagster files come under the Apache License 2.0, but the brands remain
their owners' trademarks, used here only to name each technology.

## Reversal

Restore `tracks` in the project file and the `track` field in each article,
move the two articles back, and delete `public/_redirects`.
