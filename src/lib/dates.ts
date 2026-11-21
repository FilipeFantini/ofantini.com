import type { CollectionEntry } from 'astro:content';

// Dates on the site are calendar days in ISO form (2026-11-21), the form the
// articles already use in their text. Frontmatter dates parse as midnight UTC,
// so the UTC day is the day written in the file.
export const day = (date: Date) => date.toISOString().slice(0, 10);

// The day an article last changed: its update, or its publication.
export const lastChange = (entry: CollectionEntry<'articles'>) => entry.data.updated ?? entry.data.published;

// The latest change among a project's articles, shown on its card.
export function latest(entries: CollectionEntry<'articles'>[]) {
  if (entries.length === 0) return null;
  return entries.map(lastChange).reduce((a, b) => (b > a ? b : a));
}
