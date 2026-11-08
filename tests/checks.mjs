import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Each build check must pass on the real content and fail, naming the defect,
// on a committed bad input. No browser or preview server is needed.
const fixtures = 'tests/fixtures';
const cases = [
  { script: 'check-figures', good: [], bad: [[`${fixtures}/invalid-figures.json`], /Invalid figure or pinned source/] },
  { script: 'check-skills', good: [], bad: [[`${fixtures}/invalid-skills-range.json`], /Invalid skill area or score/] },
  { script: 'check-skills', good: [], bad: [[`${fixtures}/invalid-skills-decimal.json`], /Invalid skill area or score/] },
  { script: 'check-projects', good: [], bad: [[`${fixtures}/invalid-reference/articles`, `${fixtures}/invalid-reference/projects`], /Unknown project missing-project/] },
  { script: 'check-diagrams', good: [], bad: [[`${fixtures}/diagrams/source`, `${fixtures}/diagrams/output`], /Stale diagram/] },
  // Without arguments check-copy also scans dist, which needs a build.
  { script: 'check-copy', good: ['src/content'], bad: [[`${fixtures}/invalid-copy`], /Forbidden copy in/] },
];

function run(script, args) {
  return spawnSync('node', [`scripts/${script}.mjs`, ...args], { encoding: 'utf8' });
}

for (const { script, good, bad: [args, defect] } of cases) {
  const ok = run(script, good);
  assert.equal(ok.status, 0, `${script} failed on the real content:\n${ok.stderr}`);
  const failed = run(script, args);
  assert.notEqual(failed.status, 0, `${script} accepted ${args.join(' ')}`);
  assert.match(failed.stderr, defect, `${script} did not name the defect for ${args.join(' ')}:\n${failed.stderr}`);
  console.log(`${script}: passes on real content, rejects ${args[0]}`);
}
console.log('All build checks fail loudly on bad input');
