import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const articleDir = process.argv[2] || 'src/content/articles';
const projectDir = process.argv[3] || 'src/content/projects';
const projects = new Set((await readdir(projectDir)).filter(file => file.endsWith('.json')).map(file => basename(file, '.json')));
if (projects.size === 0) throw new Error('No projects found');
let count = 0;
for (const file of (await readdir(articleDir)).filter(file => file.endsWith('.md'))) {
  const source = await readFile(join(articleDir, file), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1];
  const match = frontmatter && /^project:\s*([a-z][a-z0-9-]*)\s*$/m.exec(frontmatter);
  if (!match) throw new Error(`Missing or invalid project reference in ${file}`);
  if (!projects.has(match[1])) throw new Error(`Unknown project ${match[1]} in ${file}`);
  count++;
}
if (count === 0) throw new Error('No articles found');
console.log(`Checked ${count} article project references`);
