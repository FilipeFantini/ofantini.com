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
  { script: 'check-projects', good: [], bad: [[`${fixtures}/invalid-group/articles`, `${fixtures}/invalid-reference/projects`], /Unknown group nonexistent of project lagom/] },
  { script: 'check-projects', good: [], bad: [[`${fixtures}/invalid-subproject/articles`, `${fixtures}/invalid-reference/projects`], /Unknown subproject nonexistent of project lagom/] },
  { script: 'check-projects', good: [], bad: [[`${fixtures}/invalid-kind/articles`, `${fixtures}/invalid-reference/projects`], /of subproject earthquakes has no kind pipeline or report/] },
  { script: 'check-projects', good: [], bad: [[`${fixtures}/invalid-directory/articles`, `${fixtures}/invalid-reference/projects`], /not in the directory of its section modeling/] },
  { script: 'check-projects', good: [], bad: [[`${fixtures}/invalid-order/articles`, `${fixtures}/invalid-reference/projects`], /Duplicate order 1 in section earthquakes of project lagom/] },
  { script: 'check-projects', good: [], bad: [[`${fixtures}/invalid-dates/articles`, `${fixtures}/invalid-reference/projects`], /Article modeling\/sample.md has an updated date that is not a day after its publication on 2026-11-09/] },
  { script: 'check-projects', good: [], bad: [[`${fixtures}/invalid-practice/articles`, `${fixtures}/invalid-practice/projects`], /Article patterns\/sample.md of practice patterns names a group, subproject or kind/] },
  { script: 'check-projects', good: [], bad: [['src/content/articles', `${fixtures}/invalid-stack/projects`], /Unknown technology nonexistent in subproject earthquakes/] },
  { script: 'check-projects', good: [], bad: [['src/content/articles', `${fixtures}/invalid-diagram/projects`], /names the missing diagram \/diagrams\/missing.svg/] },
  { script: 'check-projects', good: [], bad: [['src/content/articles', 'src/content/projects', `${fixtures}/invalid-icon/technologies.json`], /names the missing icon src\/icons\/missing.svg/] },
  { script: 'check-projects', good: [], bad: [['src/content/articles', 'src/content/projects', `${fixtures}/invalid-icon-source/technologies.json`], /Technology duckdb has no iconSource/] },
  { script: 'check-projects', good: [], bad: [['src/content/articles', 'src/content/projects', `${fixtures}/unused-icon/technologies.json`], /Icons no technology uses: /] },
  { script: 'check-diagrams', good: [], bad: [[`${fixtures}/diagrams/source`, `${fixtures}/diagrams/output`], /Stale diagram/] },
  { script: 'check-diagrams', good: [], bad: [[`${fixtures}/diagrams-motion/source`, `${fixtures}/diagrams-motion/output`], /no reduced-motion rule/] },
  { script: 'check-diagrams', good: [], bad: [[`${fixtures}/diagrams-icon/source`, `${fixtures}/diagrams-icon/output`], /names technology nonexistent, which is unknown or has no icon/] },
  // The SVG carries the digest of its source alone, so a logo outside the hash would pass.
  { script: 'check-diagrams', good: [], bad: [[`${fixtures}/diagrams-icon-stale/source`, `${fixtures}/diagrams-icon-stale/output`], /Stale diagram/] },
  // Without arguments check-copy also scans dist, which needs a build.
  { script: 'check-copy', good: ['src/content'], bad: [[`${fixtures}/invalid-copy`], /Forbidden copy in/] },
  { script: 'check-frames', good: [], bad: [[`${fixtures}/invalid-frame`], /not one of our projects/] },
  { script: 'check-frames', good: [], bad: [[`${fixtures}/invalid-frame-sandbox`], /Frame without sandbox="allow-scripts"/] },
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
  console.log(`${script}: passes on real content, rejects ${args.find(arg => arg.startsWith(fixtures)) ?? args[0]}`);
}
console.log('All build checks fail loudly on bad input');
