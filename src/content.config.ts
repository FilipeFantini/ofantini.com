import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import technologies from './data/technologies.json';

const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const stack = z.array(z.enum(Object.keys(technologies) as [string, ...string[]])).min(1);

// A project has a shared platform, in groups of articles, and data
// subprojects, one per data source. Both kinds of section share the URL space
// /projects/<project>/<id>/, so scripts/check-projects.mjs also checks that
// no id is used twice.
const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
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
});

// An article belongs to a platform group, or to a subproject with a kind.
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
    lagom_commit: z.string().regex(/^[0-9a-f]{40}$/),
    adrs: z.array(z.string()),
  }).refine(
    data => data.group ? !data.subproject && !data.kind : Boolean(data.subproject && data.kind),
    { message: 'An article names either a group, or a subproject and a kind' },
  ),
});

export const collections = { projects, articles };
