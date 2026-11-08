import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';

const articleDir = process.argv[2] || 'src/content/articles';
const projectDir = process.argv[3] || 'src/content/projects';

const projects = new Map();
for (const file of (await readdir(projectDir)).filter(file => file.endsWith('.json'))) {
  const { tracks } = JSON.parse(await readFile(join(projectDir, file), 'utf8'));
  if (!Array.isArray(tracks) || tracks.length === 0) throw new Error(`Project ${file} has no tracks`);
  const ids = tracks.map(track => track?.id);
  if (ids.some(id => typeof id !== 'string' || !id)) throw new Error(`Project ${file} has a track without an id`);
  if (new Set(ids).size !== ids.length) throw new Error(`Project ${file} repeats a track id`);
  projects.set(basename(file, '.json'), new Set(ids));
}
if (projects.size === 0) throw new Error('No projects found');

// The value of a scalar frontmatter field, without quotes or a trailing comment.
function field(frontmatter, name, pattern) {
  return new RegExp(`^${name}:\\s*["']?(${pattern})["']?\\s*(?:#.*)?$`, 'm').exec(frontmatter)?.[1];
}

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
  const track = field(frontmatter, 'track', '[a-z][a-z0-9-]*');
  if (!projects.get(project).has(track)) throw new Error(`Unknown track ${track} of project ${project} in ${file}`);
  if (dirname(file) !== track) throw new Error(`Article ${file} is not in the directory of its track ${track}`);
  const order = field(frontmatter, 'order', '[1-9][0-9]*');
  if (!order) throw new Error(`Missing or invalid order in ${file}`);
  const key = `${project}/${track}/${order}`;
  if (orders.has(key)) throw new Error(`Duplicate order ${order} in track ${track} of project ${project}: ${orders.get(key)} and ${file}`);
  orders.set(key, file);
  count++;
}
if (count === 0) throw new Error('No articles found');
console.log(`Checked ${count} articles: project, track, directory and order`);
