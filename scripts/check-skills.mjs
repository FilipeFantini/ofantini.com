import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(process.argv[2] || new URL('../src/data/skills.json', import.meta.url), 'utf8'));
if (data.scale?.min !== 0 || data.scale?.max !== 7 || !Array.isArray(data.areas) || data.areas.length < 3) {
  throw new Error('Skills must have a scale from 0 to 7 and at least three areas.');
}
for (const area of data.areas) {
  if (typeof area.label !== 'string' || !area.label.trim() || !Number.isInteger(area.score) || area.score < 0 || area.score > 7) {
    throw new Error(`Invalid skill area or score: ${JSON.stringify(area)}. Scores must be integers from 0 to 7.`);
  }
}
