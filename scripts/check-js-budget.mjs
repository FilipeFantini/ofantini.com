import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
}
const scripts = (await files('dist')).filter(path => path.endsWith('.js'));
const bytes = (await Promise.all(scripts.map(async path => gzipSync(await readFile(path)).byteLength))).reduce((a,b) => a+b,0);
if (bytes > 5 * 1024) throw new Error(`JavaScript budget exceeded: ${bytes} > 5120 gzip bytes`);
console.log(`JavaScript budget: ${bytes}/5120 gzip bytes across ${scripts.length} files`);
