import { getCollection } from 'astro:content';
import type { SectionArticle } from './lagom';

// The practice projects (ADR-0005), in title order, each with its articles in
// article order. A practice has a page at /projects/<id>/ and each article
// its own page at /projects/<id>/<slug>/; its articles live in
// src/content/articles/<id>/.
export async function loadPractices() {
  const projects = (await getCollection('projects')).filter(project => project.data.kind === 'practice');
  const entries = await getCollection('articles');
  return projects
    .map(project => {
      if (project.data.kind !== 'practice') throw new Error(`Project ${project.id} is not a practice`);
      const data = project.data;
      const articles = entries
        .filter(entry => entry.data.project.id === project.id)
        .sort((a, b) => a.data.order - b.data.order)
        .map((entry): SectionArticle => {
          const slug = entry.id.split('/').at(-1)!;
          return { entry, slug, href: `/projects/${project.id}/${slug}/` };
        });
      return { id: project.id, data, href: `/projects/${project.id}/`, articles };
    })
    .sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export type Practice = Awaited<ReturnType<typeof loadPractices>>[number];
