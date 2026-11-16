import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

// A page may frame a page of the operator's own projects, and nothing else
// (docs/adr/0002-frames-of-our-own-projects.md). Each frame comes from a host
// in this list, over HTTPS, sandboxed to scripts alone (no same origin, no
// forms, no pop-ups, no top navigation), sends no referrer, loads lazily and
// has a title. Any other embed is refused.
const hosts = new Set(['lagom.ofantini.com']);
const required = { sandbox: 'allow-scripts', referrerpolicy: 'no-referrer', loading: 'lazy' };

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  }))).flat();
}

function attributes(tag) {
  const found = {};
  for (const [, name, value] of tag.matchAll(/\s([a-z-]+)="([^"]*)"/gi)) found[name.toLowerCase()] = value;
  return found;
}

let frames = 0;
const roots = process.argv.slice(2);
for (const root of roots.length ? roots : ['src/content', 'src/pages', 'src/components', 'src/layouts']) {
  for (const file of await walk(root)) {
    if (!['.astro', '.md', '.html'].includes(extname(file))) continue;
    const contents = await readFile(file, 'utf8');
    const embed = /<(object|embed|frame|frameset|portal)\b/i.exec(contents);
    if (embed) throw new Error(`Forbidden embed <${embed[1]}> in ${file}`);
    for (const [tag] of contents.matchAll(/<iframe\b[^>]*>/gi)) {
      const found = attributes(tag);
      let url;
      try { url = new URL(found.src); } catch { throw new Error(`Frame without an absolute src in ${file}: ${tag}`); }
      if (url.protocol !== 'https:' || !hosts.has(url.hostname)) {
        throw new Error(`Frame from a host that is not one of our projects in ${file}: ${url.hostname}`);
      }
      for (const [name, value] of Object.entries(required)) {
        if (found[name] !== value) throw new Error(`Frame without ${name}="${value}" in ${file}: ${tag}`);
      }
      if (!found.title) throw new Error(`Frame without a title in ${file}: ${tag}`);
      frames += 1;
    }
  }
}
console.log(`Checked ${frames} frames: our own hosts, sandboxed to scripts`);
