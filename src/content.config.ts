import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    tracks: z.array(z.object({
      id: z.string().regex(/^[a-z][a-z0-9-]*$/),
      name: z.string(),
      description: z.string(),
    })).min(1),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    project: reference('projects'),
    track: z.string(),
    order: z.number().int().positive(),
    lagom_commit: z.string().regex(/^[0-9a-f]{40}$/),
    adrs: z.array(z.string()),
  }),
});

export const collections = { projects, articles };
