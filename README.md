# ofantini.com

A static personal site built with Astro. Its home introduces Filipe Fantini. The
about page, opened from the `me.txt` desktop icon at `/about/`, describes his data work,
infrastructure hobby and outdoor interests, with a skills radar.
Projects presents Lagom with its articles, and Articles lists every article by
project and section. The Lagom hub explains the small and medium data thesis in two
parts ([ADR-0003](docs/adr/0003-lagom-platform-and-data-projects.md)): the platform,
a map of its groups of articles, and the data projects, one card per data source.
Each group and each data project has a page, and each article its own page under it.
The USGS pipeline article records one production run; its figures are pinned to a
Lagom commit in `src/data/figures.json`.

## Build and preview

Use Node.js 22.12 or newer:

```sh
npm ci
npm run build
npm run preview -- --port 5000
```

The build writes only static HTML, CSS, JavaScript, fonts and SVG images to `dist/`.
Astro and every package version are fixed in `package-lock.json`. No analytics,
cookies, external scripts or browser downloads run in the site. An article may frame a
page of the operator's own projects, sandboxed to scripts
([ADR-0002](docs/adr/0002-frames-of-our-own-projects.md)). Fonts and diagrams
are served from the site itself. The build checks figure links, skill scores,
article project references, technologies and their icons, diagram hashes, frames, copy
and the 5 KiB gzip budget for JavaScript.

Run `node tests/navigation.mjs`, `node tests/radar.mjs`, `node tests/desktop.mjs`,
`node tests/accessibility.mjs` and `node tests/contract.mjs` against the preview.
They use Chromium, Firefox and WebKit on port 5000 unless `SITE_TEST_URL` is set.
The browser tests assume that `npm run build` has run. On macOS, AirPlay Receiver can hold port
5000; the preview then starts on the next free port, so set `SITE_TEST_URL` to the
address it prints. Install the browsers once with `npx playwright install chromium firefox webkit`.

`node tests/checks.mjs` needs neither a build nor a preview. It runs each build check
against the real content (must pass) and against a bad fixture in `tests/fixtures/`
(must fail and name the defect). `check-js-budget` takes no path, so it is not covered there.

## Deployment

Cloudflare Pages builds and serves the site through its own Git integration,
not through GitHub Actions (Lagom's ADR-0039, Decision 5). When a commit lands on
`main`, Cloudflare clones the repository, runs the build, and publishes `dist/`
to its network. Nothing else runs: the site is static files.

| Setting | Value |
|---|---|
| Pages project | `ofantini`, also served at `ofantini.pages.dev` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` |
| Preview branches | none: a branch is never published |
| Custom domain | `ofantini.com`, a proxied CNAME to `ofantini.pages.dev`, created by Pages |
| GitHub access | the Cloudflare app, installed on this repository only |

Previews stay off because Pages would otherwise publish every branch at a public
address before any check ([ADR-0001](docs/adr/0001-how-a-change-reaches-main.md)).
A failed Cloudflare build leaves the previous deployment online. To roll back,
revert the commit on `main` through a pull request; the project's Deployments
tab in Cloudflare can also roll back to an earlier deployment at once.

## Content and diagrams

Keep public professional information abstract: no employer, dates, location,
contact details or institutions. Write clear English without em or en dashes.
The project lives in `src/content/projects/lagom.json`: a title, a summary, the
`platform` (its stack and its `groups` of articles) and the `subprojects`, one per data
source, each with a `source`, the `question` its data answers, a `status` (`live`,
`building` or `planned`), a `stack` and an optional pipeline `diagram`. Groups and
subprojects show in the order of the file. One without articles shows as "In works"
and has no page. Group and subproject ids share the address `/projects/lagom/<id>/`,
so no id may be used twice.

To add an article, create `src/content/articles/<section>/<slug>.md`, where
`<section>` is a group or subproject id and `<slug>` becomes the last part of its URL.
Its frontmatter is `title`, `summary` (one sentence, shown in lists), `project: lagom`,
either `group` or `subproject` with `kind` (`pipeline` for loading, modelling and
publishing, `report` for what the data shows), `order` (a positive integer, its position
within the section, unique per section), `lagom_commit` (40 hex characters; the page
links to it) and `adrs`. Nothing else needs editing: the hub, the section page, Projects
and Articles are generated from the collections. The Astro content schema validates the
fields, and `scripts/check-projects.mjs` exits with an error if an article names a
project, group or subproject that does not exist, lacks a kind in a subproject, sits
outside its section's directory, or shares an `order` with another article of its
section. Figures must cite lines in a fixed Lagom commit.

A stack names technologies from `src/data/technologies.json`. A technology may name a
logo in `src/icons/`, which the page inlines beside its name in the text colour; the
build fails on an unknown technology, a missing logo or a logo no technology uses.
When an address moves, add a line to `public/_redirects` (`/old/ /new/ 301`, with and
without the final slash); Cloudflare Pages serves it as a permanent redirect, and
`tests/contract.mjs` checks that every old address is gone and every new one exists.

Mermaid sources live in `src/content/diagrams/`; their SVG images live in
`public/diagrams/`. When a diagram changes, run `npm run diagrams` locally and
commit both files. An article embeds a diagram as `![alt text](/diagrams/<name>.svg)`.
Mermaid animated edges (`A e1@--> B` with `e1@{ animate: true }`) work through CSS that
Mermaid embeds in the SVG; `npm run diagrams` adds a `prefers-reduced-motion` rule that
stops every animation, and the build fails for an SVG that has animation CSS without
it. `scripts/mermaid.json` sets the font to `arial, sans-serif`, because an SVG shown
through `<img>` gets no page fonts and the default font would be embedded in every SVG
(about 200 KB). This command downloads the pinned Mermaid CLI temporarily and
uses a local browser. The site build only checks the source hash in each SVG, so
Cloudflare Pages does not need a browser for diagrams.

## Interaction and accessibility

On screens at least 701 px wide and 560 px high, local JavaScript opens linked
pages as movable, resizable windows on one desktop. New windows start at up to
720 by 480 px and cascade by 32 px, leaving earlier title bars reachable. The
address bar records the front window only. Reloading or sharing that address opens that page by itself.
Every window is also a real page with its own URL; with JavaScript disabled,
ordinary links still work. Smaller screens use normal page scrolling. Reduced
motion disables window animations. Text uses solid surfaces and the browser tests
check contrast, keyboard access and horizontal overflow.

## Working on this repository

A merge to `main` publishes the site. Every change goes through a pull request
with four required checks; the rules for agents and humans are in
[`AGENTS.md`](AGENTS.md), and the reasons in
[`docs/adr/0001-how-a-change-reaches-main.md`](docs/adr/0001-how-a-change-reaches-main.md).

## License

Code is licensed under MIT ([`LICENSE`](LICENSE)). Original editorial content in
`src/content/` is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source excerpts and linked projects keep their own
licenses. The logos in `src/icons/` name the technologies a stack uses. They are trademarks
of their owners, shown only to name each technology (nominative use), and come from:

| Logos | Source | Licence of the file |
|---|---|---|
| `argo`, `cloudflare`, `dlthub`, `duckdb`, `k3s`, `postgresql`, `tailscale` | [Simple Icons](https://simpleicons.org) 16.38.0, copied unchanged | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `dbt` | the mark in [`etc/dbt-core.svg`](https://github.com/dbt-labs/dbt-core/blob/c23db31c0d1489bd188a60d046b336487d1a8b66/etc/dbt-core.svg) of dbt Labs' `dbt-core` repository; only the mark's path is kept, in one colour | [Apache License 2.0](https://github.com/dbt-labs/dbt-core/blob/c23db31c0d1489bd188a60d046b336487d1a8b66/License.md) |
| `dagster` | [`dagster_solid.svg`](https://github.com/dagster-io/dagster/blob/0ad8b455fc4f9e4b90b6ef0582cc145b24fe1b1b/js_modules/ui-components/src/icon-svgs/dagster_solid.svg) of the `dagster` repository, its one-colour mark; only the fixed size and fill are removed | [Apache License 2.0](https://github.com/dagster-io/dagster/blob/0ad8b455fc4f9e4b90b6ef0582cc145b24fe1b1b/LICENSE) |

The two changed files say so in a comment at their top, as the Apache License asks.
