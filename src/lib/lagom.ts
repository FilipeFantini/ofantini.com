import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export interface SectionArticle {
  entry: CollectionEntry<'articles'>;
  slug: string;
  href: string;
}

// The Lagom project in two parts: the platform groups and the data
// subprojects, each in project order and each holding its articles in article
// order. A group or a subproject is a section: it has a page at
// /projects/lagom/<id>/ once it has an article. Every Lagom list on the site is
// built from this one result.
export async function loadLagom() {
  const project = await getEntry('projects', 'lagom');
  if (!project) throw new Error('Project lagom is missing from the projects collection');
  if (project.data.kind !== 'platform') throw new Error('Project lagom must be a platform project');
  const data = project.data;
  const entries = (await getCollection('articles')).filter(entry => entry.data.project.id === 'lagom');
  const groupIds = new Set(data.platform.groups.map(group => group.id));
  const subprojectIds = new Set(data.subprojects.map(subproject => subproject.id));
  for (const { id, data } of entries) {
    if (data.group && !groupIds.has(data.group)) throw new Error(`Article ${id} names the unknown group ${data.group}`);
    if (data.subproject && !subprojectIds.has(data.subproject)) throw new Error(`Article ${id} names the unknown subproject ${data.subproject}`);
  }
  const articlesOf = (section: string) => entries
    .filter(entry => (entry.data.group ?? entry.data.subproject) === section)
    .sort((a, b) => a.data.order - b.data.order)
    .map((entry): SectionArticle => {
      const slug = entry.id.split('/').at(-1)!;
      return { entry, slug, href: `/projects/lagom/${section}/${slug}/` };
    });
  const groups = data.platform.groups.map(group => ({
    ...group,
    href: `/projects/lagom/${group.id}/`,
    articles: articlesOf(group.id),
  }));
  const subprojects = data.subprojects.map(subproject => {
    const articles = articlesOf(subproject.id);
    return {
      ...subproject,
      href: `/projects/lagom/${subproject.id}/`,
      articles,
      pipeline: articles.filter(article => article.entry.data.kind === 'pipeline'),
      report: articles.filter(article => article.entry.data.kind === 'report'),
    };
  });
  return { project: { ...project, data }, groups, subprojects, sections: [...groups, ...subprojects] };
}

type Lagom = Awaited<ReturnType<typeof loadLagom>>;
export type LagomGroup = Lagom['groups'][number];
export type LagomSubproject = Lagom['subprojects'][number];
export type LagomSection = Lagom['sections'][number];
