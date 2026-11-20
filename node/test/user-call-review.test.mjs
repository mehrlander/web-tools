// node/test/user-call-review.test.mjs
// A documentation call's `review`, the peeves critic's runs on its document,
// as skills/user-calls/user-call.py parses, records and checks it: a report in
// the critic's form read into trips, a report in neither form kept whole with
// no verdict, the changes between runs worked out from the texts the critic
// read, and `add` refusing a call whose wording the last run never read or a
// finding no one answered.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = path.join(repoRoot, 'skills', 'user-calls', 'user-call.py');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const HARNESS = `import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("user_call", sys.argv[1])
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
print(json.dumps([getattr(m, fn)(*a) for fn, a in json.loads(sys.argv[2])]))`;
const pyMany = (calls) => {
  const r = spawnSync('python3', ['-B', '-c', HARNESS, SCRIPT, JSON.stringify(calls)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
const py = (fn, ...args) => pyMany([[fn, args]])[0];

// Reports in the shapes the critic has returned them (a tend pass, 2026-11-19).
const FAILED = `**Trips**

1. P05 · the new paragraph · "with no \`#base=\`, the default branch takes its place" · A reader cannot tell when this applies.
2. P12 · row and paragraph · "changes" (row) against "Changes" (paragraph) · The mode is named two ways.
P74 · the second sentence · "One sentence carries two claims" · Split it.

**Clear**: P02, P04, P07, plus the page peeves, which do not apply.

**Candidates**
- A table cell that holds a conditional.
- None of the rest.

**Pre-existing** (untouched text, not counted)
- P04 · "it is thin on purpose" (line 3).
- P72/P74: line 36 packs several subjects into one block.

VERDICT: FAIL

\`11/19 4:41pm\` 💬[1](https://example.invalid/session.html#id=4a1315f1) · 0𝗆`;
const PASSED = `**Trips** (added or changed text)
None.

The added sentence checks against these ids:
- P01, P08: the edit moves a statement to its one owner.

**Clear**
P01, P08, P24.

**Candidates**
- None worth proposing.

Verdict: PASS`;
const REFUSED = `I can't judge this edit. The peeves list isn't in my context.

- **Reads denied:** Glob and Grep were denied.

VERDICT: none issued, because I couldn't check against the list.`;

test('a report in the critic\'s form is read into its verdict, trips, clear ids, candidates and trips outside the edit', () => {
  const r = py('parse_report', FAILED);
  assert.equal(r.verdict, 'fail');
  assert.deepEqual(r.trips.map((t) => t.peeve), ['P05', 'P12', 'P74'], 'numbered, bulleted or bare, each trip line is a trip');
  assert.deepEqual(r.trips[0], { peeve: 'P05', where: 'the new paragraph', quote: 'with no `#base=`, the default branch takes its place',
    clause: 'A reader cannot tell when this applies.' });
  assert.equal(r.trips[1].quote, '"changes" (row) against "Changes" (paragraph)', 'a quote of two quotes is kept as written');
  assert.deepEqual(r.clear, ['P02', 'P04', 'P07']);
  assert.deepEqual(r.candidates, ['A table cell that holds a conditional.'], 'a None line is no candidate');
  assert.deepEqual(r.preexisting.map((x) => x.peeve), ['P04', 'P72']);
  assert.equal(r.preexisting[1].text, 'line 36 packs several subjects into one block.');
  assert.equal(r.report, FAILED.trim(), 'the report is kept as it came back');
});

test('None under Trips is a pass, though the prose after it names peeves', () => {
  const r = py('parse_report', PASSED);
  assert.equal(r.verdict, 'pass');
  assert.deepEqual(r.trips, []);
  assert.deepEqual(r.clear, ['P01', 'P08', 'P24']);
  assert.deepEqual(r.candidates, []);
});

test('a report in neither form, or one whose trips are in some other shape, has no verdict', () => {
  const [refused, other, stated] = pyMany([
    ['parse_report', [REFUSED]],
    ['parse_report', ['**Trips**\n- P05 (the paragraph): vague.\n\n**Clear**: P01']],
    ['parse_report', ['**Trips**\n\n**Clear**: P01\n\nVERDICT: FAIL']],
  ]);
  assert.equal(refused.verdict, 'unknown');
  assert.equal(refused.report, REFUSED, 'kept whole');
  assert.equal(other.verdict, 'unknown', 'a section naming peeves without saying None is not a pass');
  assert.equal(stated.verdict, 'unknown', 'no trips under a stated FAIL is not a pass');
});

test('the changes between two drafts pair a moved and rewritten paragraph, and cut a list to its changed line', () => {
  const [moved, listed, same] = pyMany([
    ['run_changes', ['Intro.\n\nOld wording here.\n\nEvery mode.', 'Intro.\n\nEvery mode.\n\nNew wording here.']],
    ['run_changes', ['- a one\n- b two\n- c three', '- a one\n- b 2\n- c three']],
    ['run_changes', ['Same.', 'Same.']],
  ]);
  assert.deepEqual(moved, [{ from: 'Old wording here.', to: 'New wording here.' }]);
  assert.deepEqual(listed, [{ from: '- b two', to: '- b 2' }]);
  assert.deepEqual(same, []);
});

const RUN = (o = {}) => ({ verdict: 'fail', trips: [{ peeve: 'P05', where: 'the new paragraph', quote: 'with no `#base=`, the default branch takes its place',
  clause: 'x', answer: 'changed' }], clear: [], candidates: [], preexisting: [], report: FAILED, changes: [{ from: 'a', to: 'b' }], ...o });
const PASS = { verdict: 'pass', trips: [], clear: ['P01'], candidates: [], preexisting: [], report: PASSED };
const CALL = (review) => ({ session: 'a710e806', slug: 'tighten', kind: 'documentation', question: 'Apply 1 edit to docs/x.md?',
  brief: 'Tidy.', file: 'o/r@b:docs/x.md', edits: [{ from: 'a', to: 'b' }], review });

test('a review is held to its report and every trip is answered', () => {
  const rows = [
    ['two runs, the first answered by a change', CALL({ runs: [RUN(), PASS] }), null],
    ['a kept trip says why', CALL({ runs: [RUN({ trips: [{ ...RUN().trips[0], answer: 'kept', why: 'It is the table caption.' }], changes: [] }), PASS] }), null],
    ['an unanswered trip', CALL({ runs: [RUN({ trips: [{ ...RUN().trips[0], answer: undefined }] }), PASS] }), 'has no answer'],
    ['kept with no why', CALL({ runs: [RUN({ trips: [{ ...RUN().trips[0], answer: 'kept' }] }), PASS] }), 'says why'],
    ['changed when nothing changed', CALL({ runs: [RUN({ changes: [] }), PASS] }), 'nothing changed after run 1'],
    ['a quote the report does not hold', CALL({ runs: [RUN({ trips: [{ ...RUN().trips[0], quote: 'words never said' }] }), PASS] }), 'quote is not in the run'],
    ['a peeve the report does not name', CALL({ runs: [RUN({ trips: [{ ...RUN().trips[0], peeve: 'P99' }] }), PASS] }), 'P99 is not in the run'],
    ['a pass with trips', CALL({ runs: [RUN({ verdict: 'pass' })] }), 'a failed run has trips'],
    ['a last run with changes after it', CALL({ runs: [PASS, RUN()] }), 'run the critic again'],
    ['no report', CALL({ runs: [{ ...PASS, report: '' }] }), 'report is the critic'],
    ['no runs', CALL({ runs: [] }), '1 to 30 critic runs'],
    ['a review on a decision', { session: 'a710e806', slug: 'x', kind: 'decision', question: 'Q?', brief: 'B.', recommend: 'Do it', review: { runs: [PASS] } }, 'documentation call'],
  ];
  const got = pyMany(rows.map(([, c]) => ['check', [c]]));
  rows.forEach(([what, , words], i) => (words === null
    ? assert.deepEqual(got[i], [], what)
    : assert.ok(got[i].some((e) => e.includes(words)), `${what}: ${JSON.stringify(got[i])}`)));
});

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' });
const run = (args, input, extra = []) => spawnSync('python3', ['-B', SCRIPT, ...args, ...extra], { env: ENV, encoding: 'utf8', input });

test('review adds a run per report, works out the changes before the next, and records a kept trip and a note', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'review-'));
  const draft = path.join(dir, 'call.json'), doc = path.join(dir, 'doc.md');
  writeFileSync(doc, 'Intro.\n\nwith no `#base=`, the default branch takes its place.\n');
  let r = run(['review', draft, doc], FAILED);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /run 1: fail, 3 trips\n {2}1\.1 P05 · the new paragraph/);
  assert.ok(existsSync(draft), 'a draft that did not exist is started');
  r = run(['review', draft, '--kept', '3', 'The sentence is one claim with an example.']);
  assert.equal(r.status, 0, r.stderr);
  writeFileSync(doc, 'Intro.\n\nWithout `#base=`, the default branch stands in.\n');
  writeFileSync(path.join(dir, 'r2.md'), PASSED);
  r = run(['review', draft, doc, path.join(dir, 'r2.md')]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /then 1 change before run 2\nrun 2: pass/);
  r = run(['review', draft, '--note', 'Passed on the second run.']);
  assert.equal(r.status, 0, r.stderr);
  const runs = JSON.parse(readFileSync(draft, 'utf8')).review.runs;
  assert.deepEqual(runs[0].changes, [{ from: 'with no `#base=`, the default branch takes its place.', to: 'Without `#base=`, the default branch stands in.' }]);
  assert.deepEqual(runs[0].trips.map((t) => [t.answer, t.why || '']), [['changed', ''], ['changed', ''], ['kept', 'The sentence is one claim with an example.']],
    'a trip still unanswered when the text changed is answered changed; a kept one stays kept');
  assert.equal(runs[1].note, 'Passed on the second run.');
  assert.equal(typeof runs[1].text, 'string', 'the draft keeps the text the run read');
  assert.equal(run(['review', draft, '--kept', '9', 'why']).status, 1, 'a trip the run does not have');
});

test('add refuses edits the last run did not read, and drops the texts the draft kept', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'review-store-'));
  git(tmp, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  git(tmp, 'clone', '-q', 'origin.git', 'store');
  const dir = path.join(tmp, 'store');
  writeFileSync(path.join(dir, '.web-tools.json'), '{"user-calls": "user-calls"}\n');
  mkdirSync(path.join(dir, 'user-calls'));
  writeFileSync(path.join(dir, 'user-calls', '.keep'), '');
  git(dir, 'add', '.'); git(dir, 'commit', '-qm', 'init'); git(dir, 'push', '-q', 'origin', 'main');
  const store = ['--store', path.join(dir, 'user-calls')];
  const call = { ...CALL({ runs: [{ ...PASS, text: 'Intro.\n\nThe edit as the critic read it.\n' }] }), edits: [{ from: 'a', to: 'The edit as filed later.' }] };
  let r = run(['add'], JSON.stringify(call), store);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /last run did not read edit 1 as filed/);
  call.edits = [{ from: 'a', to: 'The edit as the critic read it.' }];
  r = run(['add'], JSON.stringify(call), store);
  assert.equal(r.status, 0, r.stderr);
  const filed = JSON.parse(git(dir, 'show', 'origin/main:user-calls/a710e806-tighten.json'));
  assert.equal(filed.review.runs[0].verdict, 'pass');
  assert.equal('text' in filed.review.runs[0], false, 'the kept text is not filed');
});
