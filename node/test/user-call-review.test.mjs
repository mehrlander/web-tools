// node/test/user-call-review.test.mjs
// A documentation call's `review`, the peeves critic's runs on its document,
// as skills/user-calls/user-call.py parses, records and checks it: a report in
// the critic's form read into trips, each tagged with the edit it falls in, a
// report in neither form kept whole with no verdict, the edits given to the
// critic as line ranges, the changes between runs worked out from the texts
// the critic read with a rewrap counted apart as reflow, a quote held to the
// text it quotes, each change linked to the trips it answers, and `add`
// refusing a call whose wording the last run never read or a finding no one
// answered, and mapping each run's edits onto the call's.

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

test('a session detail caption among the sections is skipped, opening with the stamp or with a linked ⌂, and with a wider gap between pills', () => {
  const [found] = py('sections', `**Pre-existing**
- P04 · "it is thin" (line 3).
\`11/19 4:41pm\` 💬[1](https://example.invalid/session.html#id=4a1315f1) · 0𝗆
[\`⌂\`](https://example.invalid/app/?view=program)\`11/20 9:50am\` 💬[2](https://example.invalid/session.html#id=4a1315f1) \`0m\`
\`11/21 5:02pm\` 💬[3](https://example.invalid/session.html#id=4a1315f1) \`5k\` \u00a0\`0m\` [\`‹⋯›\`](https://example.invalid/app/?view=program)`);
  assert.deepEqual(found, { preexisting: ['- P04 · "it is thin" (line 3).'] });
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
    ['a pass with trips', CALL({ runs: [RUN({ verdict: 'pass' })] }), 'a failed run has a trip inside an edit'],
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
  assert.match(r.stdout, /then 1 change before run 2\n {4}c1 · line 3 · "Without `#base=`, the default branch stands in\."  quotes 1\.1\n.*--answers 1\.c1 1\nrun 2: pass/);
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

// ── The upgrade: edits given to the critic, trips tagged with them ─────────

const TAGGED = `**Trips**

- P05 · E1 · the new paragraph · "With no base, the default branch takes its place" · Unclear when.
- P12 · **E2** · the last line · "The end now" · A misquote: the text has a comma.
- P04 · E- · line 3 · "so that the lines / stay short" · Outside the edits.
- P74 · outside · line 9 · "Another wrapped paragraph" · Also outside.

**Clear**: P01, P02

Verdict: FAIL`;
const OUTSIDE_ONLY = `**Trips**
- P04 · E- · line 3 · "so that the lines" · Outside the edits.

**Clear**: P01

Verdict: FAIL`;

test('a trip carries the edit it was tagged with, E- or outside as 0; only trips outside every edit pass the run', () => {
  const [tagged, outside, old] = pyMany([['parse_report', [TAGGED]], ['parse_report', [OUTSIDE_ONLY]], ['parse_report', [FAILED]]]);
  assert.equal(tagged.verdict, 'fail');
  assert.deepEqual(tagged.trips.map((t) => [t.peeve, t.edit]), [['P05', 1], ['P12', 2], ['P04', 0], ['P74', 0]]);
  assert.deepEqual(tagged.trips[0], { peeve: 'P05', edit: 1, where: 'the new paragraph', quote: 'With no base, the default branch takes its place', clause: 'Unclear when.' });
  assert.equal(outside.verdict, 'pass', 'a trip outside every edit does not fail the run');
  assert.equal(outside.stated, 'fail', 'the verdict the critic stated is kept where it differs');
  assert.equal('edit' in old.trips[0], false, 'the old form carries no tag');
  const headed = py('parse_report', 'Trips, most costly first:\n\n- P06 · E1 · line 19 · "the others" · Name them.\n\nClear: P01\n\nVerdict: FAIL');
  assert.deepEqual([headed.verdict, headed.trips.map((t) => t.peeve)], ['fail', ['P06']],
    'the Trips heading the critic copies from its definition, "Trips, most costly first:", heads the section');
  const dot = py('parse_report', '**Trips**\n\n\u2022 P05 \u00b7 E1 \u00b7 line 3 \u00b7 "a quote" \u00b7 Vague.\n\n**Clear**: P01\n\nVERDICT: FAIL');
  assert.deepEqual([dot.verdict, dot.trips.map((t) => t.peeve)], ['fail', ['P05']], 'a trip line opening with the bullet character is a trip');
  // From the first real use (the critic-review docs, 2026-11-20): a trip
  // quoting the trip format, whose separators sit in a code span.
  const [fmt, kept] = pyMany([
    ['trip_of', ['- P74 · E2 · lines 40-42 · "put the edit after the id, as `P<id> · E<n> · <where> · "<quote>" · <one clause>`, and `E-` for a trip outside." · Split it.']],
    ['trip_of', ['- P74 · E1 · line 30 · "mark it with `--kept <n> "<why>"`; once that run is recorded" · Two steps.']],
  ]);
  assert.equal(fmt.quote, 'put the edit after the id, as `P<id> · E<n> · <where> · "<quote>" · <one clause>`, and `E-` for a trip outside.');
  assert.equal(fmt.clause, 'Split it.');
  assert.equal(kept.quote, 'mark it with `--kept <n> "<why>"`; once that run is recorded', 'a quote mark inside code keeps the outer ones stripped');
  assert.deepEqual(py('quote_parts', kept.quote), [kept.quote]);
  const [runOn, two] = pyMany([
    ['trip_of', ['- P74 · E1 · line 155 · "It also records the changes, and counts reflow." This sentence has a second claim. Split it.']],
    ['trip_of', ['- P03 · E1 · line 155 · "the peeves critic\'s runs" and "reflow". "Peeves critic" is not defined here.']],
  ]);
  assert.deepEqual([runOn.quote, runOn.clause], ['It also records the changes, and counts reflow.', 'This sentence has a second claim. Split it.'],
    'a clause run on after the quote with no separator is the clause');
  assert.deepEqual([two.quote, two.clause], ['"the peeves critic\'s runs" and "reflow"', '"Peeves critic" is not defined here.']);
  assert.equal(py('quote_in', 'Check changes against the principles. … the call is filed.', 'Check changes against the principles. ' + 'x'.repeat(900) + ' the call is filed.'), true,
    'a paragraph quoted by its two ends is in the text');
});

test('a rewrap is reflow, counted apart from the changes, and a quote is held to the text', () => {
  const [rewrapped, split, inText] = pyMany([
    ['run_diff', ['Intro.\n\nA wrapped\nparagraph here.\n\nOld words.', 'Intro.\n\nA wrapped paragraph\nhere.\n\nNew words.']],
    ['run_diff', ['One long paragraph that the session\nsplits by its wrap only.', 'One long paragraph that the session splits by its wrap only.']],
    ['quote_in', ['"changes" (row) against "Changes" (paragraph)', 'The changes row. Changes, the paragraph.']],
  ]);
  assert.deepEqual(rewrapped, [[{ from: 'Old words.', to: 'New words.' }], 1]);
  assert.deepEqual(split, [[], 1]);
  assert.equal(inText, true);
  const quotes = pyMany([
    ['quote_in', ['have home and [mehrlander/budget-drs](…) checked out', 'from a checkout that has home and budget-drs beside it']],
    ['quote_in', ['The `unit` of … starts `budget-drs:`', 'The unit of each row starts budget-drs: always.']],
    ['quote_in', ['so that the lines / stay short', 'so that the lines\nstay short']],
    ['quote_in', ['[mehrlander/home](…) holds', 'This folder of [mehrlander/home](https://github.com/mehrlander/home) holds']],
  ]);
  assert.deepEqual(quotes, [false, true, true, true], 'the pilot\'s misquote is caught; an ellipsis, a line break and a link are read');
});

const BASE = '# Title\n\nThe first paragraph wraps at a modest width so that the lines\nstay short and the reader can follow them easily.\n\n'
  + 'Another wrapped paragraph that sits in the\nmiddle of the document.\n\nThe end.\n';
const V1 = '# Title\n\nThe first paragraph wraps at a modest width so that the lines\nstay short and the reader can follow them easily.\n\n'
  + 'With no base, the default branch takes its place, and the whole paragraph sits on a single long line here.\n\n'
  + 'Another wrapped paragraph that sits in the\nmiddle of the document.\n\nThe end, now.\n';
const V2 = '# Title\n\nThe first paragraph wraps at a modest width so that the lines\nstay short and the reader can follow them easily.\n\n'
  + 'Without a base, the default branch stands in, and\nthe paragraph wraps like the rest.\n\n'
  + 'Another wrapped paragraph that sits in\nthe middle of the document.\n\nThe end, now.\n';

test('the edits as the critic\'s spans: an insertion\'s new text, a rewrite\'s, and a removal\'s neighbour', () => {
  const edits = [{ from: 'Intro.', to: 'Intro.\n\nAdded here.' }, { from: 'Old.', to: 'New.' }, { from: 'Keep.\n\nGone.', to: 'Keep.' }];
  const text = 'Intro.\n\nAdded here.\n\nNew.\n\nKeep.\n';
  const [spans, block] = pyMany([['spans_of', [{ edits }, text]], ['spans_text', ['docs/x.md', [{ lines: [3, 3] }, { lines: [5, 6] }]]]]);
  assert.deepEqual(spans.map((s) => s.lines), [[3, 3], [5, 5], [7, 7]]);
  const bullet = py('spans_of', { edits: [{ from: '- one\n- two\n- three', to: '- one\n- 2, said again\n  over two lines\n- three' }] }, 'Intro.\n\n- one\n- 2, said again\n  over two lines\n- three\n');
  assert.deepEqual(bullet.map((s) => s.lines), [[4, 5]], 'a rewritten list is cut to the lines that differ');
  const row = py('spans_of', { edits: [{ from: '| a |\n|---|\n| b |\n| c |', to: '| a |\n|---|\n| b |\n| new |\n| c |' }] }, '| a |\n|---|\n| b |\n| new |\n| c |\n');
  assert.deepEqual(row.map((s) => s.lines), [[4, 4]], 'a row inserted into a table is its own line, not the row after it too');
  assert.match(block, /^The edits to docs\/x\.md, as lines of the file as you read it:\nE1 {2}line 3\nE2 {2}lines 5-6\n\nTag each trip with its edit/);
  assert.match(block, /`Verdict: PASS` when no trip falls inside an edit/, 'the block carries the verdict rule, for a critic whose definition predates it');
});

test('a trip whose quote sits in another span than its tag is a warning', () => {
  const run1 = { edits: [{ lines: [6, 6] }, { lines: [11, 11] }], trips: [
    { peeve: 'P05', edit: 2, quote: 'With no base' }, { peeve: 'P04', edit: 0, quote: 'The end, now' }, { peeve: 'P06', edit: 1, quote: 'With no base' }] };
  assert.deepEqual(py('tag_warnings', run1, 1, V1), ['1.1 is tagged E2, but its quote is at line 6, in E1', '1.2 is tagged E-, but its quote is at line 11, in E2']);
});

test('a changed paragraph wrapped unlike the rest is a warning before the first run, as is an edit that only rewraps', () => {
  const [one, none, rewrap] = pyMany([
    ['wrap_warnings', [{ edits: [{ from: 'x', to: 'y' }] }, V1, [{ lines: [6, 6] }]]],
    ['wrap_warnings', [{ edits: [{ from: 'x', to: 'y' }] }, V2, [{ lines: [6, 7] }]]],
    ['wrap_warnings', [{ edits: [{ from: 'A b\nc.', to: 'A b c.' }] }, 'A b c.\n', [{ lines: [1, 1] }]]],
  ]);
  assert.match(one.join('\n'), /E1 has lines longer than the \d+ columns the rest of the document wraps at/);
  assert.deepEqual(none, []);
  assert.match(rewrap[0], /E1 changes only line breaks or spacing/);
});

test('the record holds each tag to its report and its spans, each change\'s answers to its trips, and lets a trip outside the edits go unanswered', () => {
  const T = (o) => ({ peeve: 'P05', edit: 1, where: 'w', quote: 'With no base, the default branch takes its place', clause: 'c', answer: 'changed', ...o });
  const R = (o) => ({ verdict: 'fail', report: TAGGED, edits: [{ lines: [6, 6], edit: 1 }, { lines: [11, 11], edit: 2 }], trips: [T()],
    changes: [{ from: 'a', to: 'b', answers: [1] }], ...o });
  const OUT = { verdict: 'pass', report: OUTSIDE_ONLY, trips: [{ peeve: 'P04', edit: 0, where: 'line 3', quote: 'so that the lines', clause: 'c' }] };
  const rows = [
    ['a tagged trip answered by a change, then a pass whose one trip is outside the edits', CALL({ runs: [R(), OUT] }), null],
    ['a misquoted trip, kept', CALL({ runs: [R({ trips: [T({ peeve: 'P12', edit: 2, quote: 'The end now', misquoted: true, answer: 'kept', why: 'Misquoted.' })], changes: [{ from: 'a', to: 'b' }] }), PASS] }), null],
    ['a rewrap answers a trip about the wrapping', CALL({ runs: [R({ changes: [], reflow: 1 }), PASS] }), null],
    ['a tag the report does not hold', CALL({ runs: [R({ trips: [T({ edit: 3 })], edits: [{ lines: [1, 1], edit: 1 }, { lines: [2, 2], edit: 1 }, { lines: [3, 3], edit: 1 }] }), PASS] }), 'its tag E3 is not in the run'],
    ['a tag past the run\'s spans', CALL({ runs: [R({ trips: [T({ edit: 2 })], edits: [{ lines: [6, 6], edit: 1 }] }), PASS] }), 'is the span it was tagged with'],
    ['a change answering a trip the run lacks', CALL({ runs: [R({ changes: [{ from: 'a', to: 'b', answers: [2] }] }), PASS] }), 'answers are trip numbers of run 1'],
    ['a change answering a kept trip', CALL({ runs: [R({ trips: [T({ answer: 'kept', why: 'x' })] }), PASS] }), 'answered by a change, so its answer is changed'],
    ['a pass with a trip inside an edit', CALL({ runs: [R({ verdict: 'pass' })] }), 'a failed run has a trip inside an edit'],
    ['spans with no lines', CALL({ runs: [R({ edits: [{ lines: [4, 2], edit: 1 }] }), PASS] }), 'edits are up to 40 spans'],
    ['a misquote mark that is not true or false', CALL({ runs: [R({ trips: [T({ misquoted: 'yes' })] }), PASS] }), 'misquoted is true or false'],
  ];
  const got = pyMany(rows.map(([, c]) => ['check', [c]]));
  rows.forEach(([what, , words], i) => (words === null
    ? assert.deepEqual(got[i], [], what)
    : assert.ok(got[i].some((e) => e.includes(words)), `${what}: ${JSON.stringify(got[i])}`)));
});

test('review gives the critic the spans, takes its tagged trips, links a change to what it answers, and add maps every run\'s spans onto the call\'s edits', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'review-spans-'));
  const repo = path.join(tmp, 'repo');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  const doc = path.join(repo, 'doc.md'), draft = path.join(tmp, 'call.json');
  writeFileSync(doc, BASE);
  git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'base');
  writeFileSync(doc, V1);
  writeFileSync(draft, JSON.stringify({ session: 'a710e806', slug: 'spans', kind: 'documentation', question: 'Apply 2 edits to doc.md?', brief: 'Tidy.',
    file: 'o/r@b:doc.md', base: 'main', edits: [{ from: 'The end.', to: 'The end, now.', why: 'ends it' }] }));
  let r = run(['review', draft, doc, '--spans']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /E1 {2}line 6\nE2 {2}line 11\n/);
  assert.match(r.stderr, /warning: E1 has lines longer than/, 'the wrapping is flagged before the first run');
  const saved = JSON.parse(readFileSync(draft, 'utf8'));
  assert.equal(saved.edits.length, 2, 'the draft\'s edits are worked out again from the base');
  assert.equal(saved.edits[1].why, 'ends it', 'keeping what the session wrote on an edit');
  r = run(['review', draft, doc, path.join(tmp, 'none.md'), '--spans', path.join(tmp, 'spans.txt')]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(path.join(tmp, 'spans.txt'), 'utf8'), /^The edits to .*doc\.md/);

  r = run(['review', draft, doc], TAGGED);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /1\.2 P12 · E2 · the last line · "The end now".*misquoted/);
  assert.doesNotMatch(r.stderr, /is tagged/, 'each tag agrees with where its quote sits');
  writeFileSync(doc, V2);
  r = run(['review', draft, doc], PASSED);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /then 1 change before run 2, and 1 block rewrapped \(reflow, not a change\)\n {4}c1 · E1 · line 6 · "Without a base/);
  r = run(['review', draft, '--answers', 'c1', '1']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /c1 · E1 · line 6 · .* answers 1\.1/);
  assert.equal(run(['review', draft, '--answers', 'c2', '1']).status, 1, 'a change the run does not have');
  assert.equal(run(['review', draft, '--kept', '1.2', 'Misquoted; the words read fine.']).status, 0);
  let d = JSON.parse(readFileSync(draft, 'utf8'));
  const [one, two] = d.review.runs;
  assert.deepEqual(one.trips.map((t) => [t.edit, t.answer || '', !!t.misquoted]), [[1, 'changed', false], [2, 'kept', true], [0, '', false], [0, '', false]],
    'a trip outside the edits is left unanswered');
  assert.equal(one.reflow, 1);
  assert.deepEqual(one.edits.map((s) => s.lines), [[6, 6], [11, 11]]);
  assert.deepEqual(two.edits.map((s) => s.lines), [[6, 12]], 'the rewrap joined the two edits into one');

  const store = path.join(tmp, 'store');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  git(tmp, 'clone', '-q', 'origin.git', 'store');
  writeFileSync(path.join(store, '.web-tools.json'), '{"user-calls": "user-calls"}\n');
  mkdirSync(path.join(store, 'user-calls'));
  writeFileSync(path.join(store, 'user-calls', '.keep'), '');
  git(store, 'add', '.'); git(store, 'commit', '-qm', 'init'); git(store, 'push', '-q', 'origin', 'main');
  r = run(['add', '--store', path.join(store, 'user-calls')], readFileSync(draft, 'utf8'));
  assert.equal(r.status, 0, r.stderr);
  d = JSON.parse(git(store, 'show', 'origin/main:user-calls/a710e806-spans.json'));
  assert.deepEqual(d.review.runs.map((x) => x.edits), [[{ lines: [6, 6], edit: 1 }, { lines: [11, 11], edit: 1 }], [{ lines: [6, 12], edit: 1 }]],
    'each run\'s spans name the call\'s edit, by the base text they replace');
  assert.equal(d.review.runs.some((x) => 'text' in x || x.edits.some((s) => 'from' in s || 'base' in s)), false, 'the draft\'s working texts are not filed');
});

test('add follows an edit whose wording moved to another paragraph to the edit it became', () => {
  // As in the doc-craft call of the first real use: runs 1 and 2 read the
  // recording sentences at the end of one paragraph; run 3 read them moved
  // into a new paragraph further on, and that paragraph is the call's edit.
  const T1 = 'Check the changes. Record every run.\n\nFile a call.\n', T2 = 'Check the changes. Record every run, briefly.\n\nFile a call.\n';
  const T3 = 'Check the changes.\n\nFile a call.\n\nRecord every run, briefly.\n';
  const run = (text, edits) => ({ ...PASS, text, edits });
  const c = { session: 'a710e806', slug: 'moved', kind: 'documentation', question: 'Apply 1 edit to x.md?', brief: 'Moves it.', file: 'o/r@b:x.md',
    edits: [{ from: 'File a call.', to: 'File a call.\n\nRecord every run, briefly.' }], review: { runs: [
      run(T1, [{ lines: [1, 1], from: 'Check the changes.', base: [0, 1] }]),
      run(T2, [{ lines: [1, 1], from: 'Check the changes.', base: [0, 1] }]),
      run(T3, [{ lines: [5, 5], from: 'File a call.', base: [2, 2] }])] } };
  const out = py('file_edits', c);
  assert.deepEqual(out.review.runs.map((r) => r.edits), [[{ lines: [1, 1], edit: 1 }], [{ lines: [1, 1], edit: 1 }], [{ lines: [5, 5], edit: 1 }]],
    'the base blocks the early spans replace are not the edit\'s, but their text became it');
  assert.equal(out.review.runs.some((r) => 'text' in r), false);
});
