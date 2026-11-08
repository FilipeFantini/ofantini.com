import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/projects' }),
  schema: z.object({ title: z.string() }),
});

const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    project: reference('projects'),
    track: z.string(),
    lagom_commit: z.string().regex(/^[0-9a-f]{40}$/),
    adrs: z.array(z.string()),
  }),
});

export const collections = { projects, articles };
