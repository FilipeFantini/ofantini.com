import { access, readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';

// A project is a platform project, with platform groups and data subprojects,
// or a practice project, with one list of articles (ADR-0005). An article of a
// platform project names either a group, or a subproject and a kind; an
// article of a practice project names neither. This check fails the build on
// a wrong reference before Astro runs, and also checks what the content schema
// cannot: ids unique across groups and subprojects (they share
// /projects/<project>/<id>/), section and practice directories that do not
// collide, each article in its section's or practice's directory, a unique
// order per section or practice, and a known technology with its icon file.
const articleDir = process.argv[2] || 'src/content/articles';
const projectDir = process.argv[3] || 'src/content/projects';
const technologyFile = process.argv[4] || 'src/data/technologies.json';
const iconDir = process.argv[5] || 'src/icons';

const technologies = JSON.parse(await readFile(technologyFile, 'utf8'));
const icons = new Set((await readdir(iconDir)).filter(file => file.endsWith('.svg')).map(file => basename(file, '.svg')));
const usedIcons = new Set();
// A logo is a third-party file: each one records where it came from and under
// which licence, so the registry is also the record of its provenance.
for (const [id, { name, icon, iconSource, iconLicence }] of Object.entries(technologies)) {
  if (typeof name !== 'string' || !name) throw new Error(`Technology ${id} has no name`);
  if (icon !== undefined) {
    if (!icons.has(icon)) throw new Error(`Technology ${id} names the missing icon ${iconDir}/${icon}.svg`);
    if (typeof iconSource !== 'string' || !/^https:\/\/github\.com\/[^\s]+\.svg$/.test(iconSource)) throw new Error(`Technology ${id} has no iconSource link to the logo's file`);
    if (typeof iconLicence !== 'string' || !iconLicence) throw new Error(`Technology ${id} has no iconLicence`);
    usedIcons.add(icon);
  }
}
const unused = [...icons].filter(icon => !usedIcons.has(icon));
if (unused.length) throw new Error(`Icons no technology uses: ${unused.join(', ')}`);

const exists = path => access(path).then(() => true, () => false);
const kinds = new Set(['pipeline', 'report']);
const statuses = new Set(['live', 'building', 'planned']);
const ids = list => {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map(item => item?.id);
};
function checkStack(stack, owner) {
  if (!Array.isArray(stack) || stack.length === 0) throw new Error(`${owner} has no stack`);
  for (const technology of stack) {
    if (!Object.hasOwn(technologies, technology)) throw new Error(`Unknown technology ${technology} in ${owner}`);
  }
}

const projects = new Map();
for (const file of (await readdir(projectDir)).filter(file => file.endsWith('.json'))) {
  const project = JSON.parse(await readFile(join(projectDir, file), 'utf8'));
  if (project.kind === 'practice') {
    checkStack(project.stack, `practice ${file}`);
    if (!Array.isArray(project.appliedIn) || project.appliedIn.length === 0) throw new Error(`Practice ${file} names no repository it is applied in`);
    projects.set(basename(file, '.json'), { kind: 'practice' });
    continue;
  }
  if (project.kind !== 'platform') throw new Error(`Project ${file} has the unknown kind ${project.kind}`);
  const { platform, subprojects } = project;
  const groupIds = ids(platform?.groups);
  if (!groupIds) throw new Error(`Project ${file} has no platform groups`);
  const subprojectIds = ids(subprojects);
  if (!subprojectIds) throw new Error(`Project ${file} has no subprojects`);
  const all = [...groupIds, ...subprojectIds];
  if (all.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id))) throw new Error(`Project ${file} has a section without a valid id`);
  const repeated = all.find((id, index) => all.indexOf(id) !== index);
  if (repeated) throw new Error(`Project ${file} uses the section id ${repeated} twice`);
  checkStack(platform.stack, `the platform of ${file}`);
  for (const subproject of subprojects) {
    if (!statuses.has(subproject.status)) throw new Error(`Subproject ${subproject.id} of ${file} has the unknown status ${subproject.status}`);
    checkStack(subproject.stack, `subproject ${subproject.id} of ${file}`);
    if (subproject.diagram !== undefined && !(await exists(join('public', subproject.diagram.src)))) {
      throw new Error(`Subproject ${subproject.id} of ${file} names the missing diagram ${subproject.diagram.src}`);
    }
  }
  projects.set(basename(file, '.json'), { kind: 'platform', groups: new Set(groupIds), subprojects: new Set(subprojectIds) });
}
if (projects.size === 0) throw new Error('No projects found');
// Sections and practices both own a directory under the articles directory,
// so a practice id must not be a section id.
for (const [name, project] of projects) {
  if (project.kind !== 'practice') continue;
  for (const other of projects.values()) {
    if (other.kind === 'platform' && (other.groups.has(name) || other.subprojects.has(name))) throw new Error(`Practice ${name} uses the id of a section`);
  }
}

// The value of a scalar frontmatter field, without quotes or a trailing comment.
function field(frontmatter, name, pattern) {
  return new RegExp(`^${name}:\\s*["']?(${pattern})["']?\\s*(?:#.*)?$`, 'm').exec(frontmatter)?.[1];
}
const present = (frontmatter, name) => new RegExp(`^${name}:`, 'm').test(frontmatter);

async function* markdown(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* markdown(path);
    else if (entry.name.endsWith('.md')) yield path;
  }
}

let count = 0;
const orders = new Map();
for await (const path of markdown(articleDir)) {
  const file = relative(articleDir, path);
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(await readFile(path, 'utf8'))?.[1] ?? '';
  const project = field(frontmatter, 'project', '[a-z][a-z0-9-]*');
  if (!project) throw new Error(`Missing or invalid project reference in ${file}`);
  if (!projects.has(project)) throw new Error(`Unknown project ${project} in ${file}`);
  const { kind: projectKind, groups, subprojects } = projects.get(project);
  let section;
  if (projectKind === 'practice') {
    if (present(frontmatter, 'group') || present(frontmatter, 'subproject') || present(frontmatter, 'kind')) throw new Error(`Article ${file} of practice ${project} names a group, subproject or kind`);
    section = project;
  } else if (present(frontmatter, 'group')) {
    if (present(frontmatter, 'subproject') || present(frontmatter, 'kind')) throw new Error(`Article ${file} names a group and a subproject or kind`);
    section = field(frontmatter, 'group', '[a-z][a-z0-9-]*');
    if (!groups.has(section)) throw new Error(`Unknown group ${section} of project ${project} in ${file}`);
  } else if (present(frontmatter, 'subproject')) {
    section = field(frontmatter, 'subproject', '[a-z][a-z0-9-]*');
    if (!subprojects.has(section)) throw new Error(`Unknown subproject ${section} of project ${project} in ${file}`);
    const kind = field(frontmatter, 'kind', '[a-z]+');
    if (!kinds.has(kind)) throw new Error(`Article ${file} of subproject ${section} has no kind pipeline or report`);
  } else {
    throw new Error(`Article ${file} names neither a group nor a subproject`);
  }
  if (dirname(file) !== section) throw new Error(`Article ${file} is not in the directory of its section ${section}`);
  const order = field(frontmatter, 'order', '[1-9][0-9]*');
  if (!order) throw new Error(`Missing or invalid order in ${file}`);
  const key = `${project}/${section}/${order}`;
  if (orders.has(key)) throw new Error(`Duplicate order ${order} in section ${section} of project ${project}: ${orders.get(key)} and ${file}`);
  orders.set(key, file);
  count++;
}
if (count === 0) throw new Error('No articles found');
console.log(`Checked ${count} articles: project, section, kind, directory and order; ${Object.keys(technologies).length} technologies and ${icons.size} icons`);
