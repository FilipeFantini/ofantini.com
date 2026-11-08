import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const banned = /[—–]|\b(?:seamless|robust|leverage|unlock|cutting-edge|empower|game-changer)\b/iu;
async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  }))).flat();
}
const roots = process.argv.slice(2);
for (const root of roots.length ? roots : ['src/content', 'dist']) {
  for (const file of await walk(root)) {
    if (!['.astro', '.md', '.html'].includes(extname(file))) continue;
    let contents = await readFile(file, 'utf8');
    if (file.endsWith('.html')) {
      contents = contents.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ');
    }
    const match = banned.exec(contents);
    if (match) throw new Error(`Forbidden copy in ${file}: ${match[0]}`);
  }
}
console.log('Copy check passed');
