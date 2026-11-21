import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import technologies from './data/technologies.json';

const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const stack = z.array(z.enum(Object.keys(technologies) as [string, ...string[]])).min(1);

const link = z.object({ label: z.string(), href: z.string().regex(/^https:\/\/[^\s]+$/) });
const commit = z.string().regex(/^[0-9a-f]{40}$/);

// A project is one of two kinds (ADR-0005). A platform project, Lagom, has a
// shared platform, in groups of articles, and data subprojects, one per data
// source (called sources on the site); both kinds of section share the URL
// space /projects/<project>/<id>/, so scripts/check-projects.mjs also checks
// that no id is used twice. A practice project is a way of working applied
// across repositories: an introduction, the repositories it is applied in,
// and one ordered list of articles at /projects/<project>/<slug>/.
const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/projects' }),
  schema: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('platform'),
      title: z.string(),
      summary: z.string(),
      // Where to see the project itself, shown under its summary on the
      // Projects page: absolute https addresses of the operator's own pages.
      links: z.array(link).min(1),
      platform: z.object({
        stack,
        groups: z.array(z.object({ id, name: z.string(), description: z.string() })).min(1),
      }),
      subprojects: z.array(z.object({
        id,
        name: z.string(),
        source: z.string(),
        question: z.string(),
        status: z.enum(['live', 'building', 'planned']),
        diagram: z.object({ src: z.string().regex(/^\/diagrams\/[a-z0-9-]+\.svg$/), alt: z.string() }).optional(),
        stack,
      })).min(1),
    }),
    z.object({
      kind: z.literal('practice'),
      title: z.string(),
      summary: z.string(),
      // The project page's introduction, one string per paragraph.
      intro: z.array(z.string()).min(1),
      stack,
      // The repositories the practice is applied in, each linked to its
      // rulebook.
      appliedIn: z.array(link).min(1),
    }),
  ]),
});

// An article of a platform project names a group, or a subproject with a
// kind, and is pinned to a Lagom commit. An article of a practice project
// names neither and is pinned to one commit per repository it cites.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    project: reference('projects'),
    group: id.optional(),
    subproject: id.optional(),
    kind: z.enum(['pipeline', 'report']).optional(),
    order: z.number().int().positive(),
    // The day the article was first published on the site, and the day its
    // text last changed in substance, if after that (ADR-0006).
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    lagom_commit: commit.optional(),
    pins: z.array(z.object({ repo: z.enum(['lagom', 'ofantini.com']), commit })).min(1).optional(),
    adrs: z.array(z.string()),
  }).refine(
    data => data.group ? !data.subproject && !data.kind : !data.subproject === !data.kind,
    { message: 'An article names a group, or a subproject and a kind, or neither' },
  ).refine(
    data => !data.updated || data.updated > data.published,
    { message: 'An article is updated after it is published' },
  ).refine(
    data => (data.group || data.subproject) ? Boolean(data.lagom_commit) && !data.pins : Boolean(data.pins) && !data.lagom_commit,
    { message: 'An article in a section is pinned with lagom_commit; an article of a practice project with pins' },
  ),
});

export const collections = { projects, articles };
