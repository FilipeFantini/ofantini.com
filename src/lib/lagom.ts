import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export interface TrackArticle {
  entry: CollectionEntry<'articles'>;
  slug: string;
  href: string;
}

// The Lagom project with its tracks in project order, each holding its articles
// in article order. Every list on the site is built from this one result.
export async function loadLagom() {
  const project = await getEntry('projects', 'lagom');
  if (!project) throw new Error('Project lagom is missing from the projects collection');
  const entries = (await getCollection('articles')).filter(entry => entry.data.project.id === 'lagom');
  const trackIds = new Set(project.data.tracks.map(track => track.id));
  const orphan = entries.find(entry => !trackIds.has(entry.data.track));
  if (orphan) throw new Error(`Article ${orphan.id} names the unknown track ${orphan.data.track}`);
  const tracks = project.data.tracks.map(track => ({
    ...track,
    href: `/projects/lagom/${track.id}/`,
    articles: entries
      .filter(entry => entry.data.track === track.id)
      .sort((a, b) => a.data.order - b.data.order)
      .map((entry): TrackArticle => {
        const slug = entry.id.split('/').at(-1)!;
        return { entry, slug, href: `/projects/lagom/${track.id}/${slug}/` };
      }),
  }));
  return { project, tracks };
}

export type LagomTrack = Awaited<ReturnType<typeof loadLagom>>['tracks'][number];
