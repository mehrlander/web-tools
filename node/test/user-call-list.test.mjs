// A documentation user call on entries of a list (lists/*.json): the limits
// user-call.py's `add` holds it to, the check that each edit's entry is in the
// list at the call's base, the edits it derives from two copies of a list, and
// kits/call-answer.js's reading of the entries and the patch an answer carries,
// and the peeves critic's runs on it, whose spans are entries by id.
//
// What can go wrong is an answer that changes another entry, or more of the
// file than the kept entries, or a call filed on an entry the list never held.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' });

const LIST = { title: 'Useful', icon: 'book-open-text', items: [
  { id: 'two-way-door', text: 'Two-way door', note: 'A choice that can be undone cheaply.', created_at: 't' },
  { id: 'standfirst', text: 'Standfirst', note: 'The lead under a headline.' },
  { id: 'fact-strip', text: 'Fact strip' },
] };
const JSONTEXT = JSON.stringify(LIST, null, 2) + '\n';
const CALL = {
  session: 'a710e806', slug: 'useful-sweep', kind: 'documentation',
  question: 'Keep 2 edits to the Useful list?', brief: 'Tightens two entries.',
  file: 'o/lists@claude/x:lists/useful.json', base: 'main',
  edits: [
    { item: 'two-way-door', from: { text: 'Two-way door', note: 'A choice that can be undone cheaply.' },
      to: { text: 'Two-way door', note: 'A decision that can be reversed cheaply.' }, why: 'the plain word' },
    { item: 'fact-strip', from: { text: 'Fact strip' }, to: { text: 'Fact strip', note: 'A row of short facts.' } },
  ],
};

test('a list call names its entries and gives each before and after', () => {
  const one = { ...CALL, file: 'o/lists:lists/useful.json#fact-strip', edits: [{ from: { text: 'Fact strip' }, to: { text: 'Facts' } }] };
  const rows = [
    ['several entries, each by item', CALL, null],
    ['one entry, named by the file', one, null],
    ['one entry in the file, another in the edit', { ...one, edits: [{ ...one.edits[0], item: 'standfirst' }] }, 'file names entry fact-strip'],
    ['one entry in the file and two edits', { ...one, edits: [one.edits[0], { ...one.edits[0], item: 'x' }] }, 'names the list alone'],
    ['an edit with no item', { ...CALL, edits: [{ from: { text: 'a' }, to: { text: 'b' } }] }, 'item'],
    ['two edits on one entry', { ...CALL, edits: [CALL.edits[0], CALL.edits[0]] }, 'one edit per entry'],
    ['text edits, as a document call has', { ...CALL, edits: [{ item: 'a', from: 'a', to: 'b' }] }, '{text, note?}'],
    ['a field other than text and note', { ...CALL, edits: [{ item: 'a', from: { text: 'a', group: 'x' }, to: { text: 'b' } }] }, '{text, note?}'],
    ['an edit that changes nothing', { ...CALL, edits: [{ item: 'a', from: { text: 'a' }, to: { text: 'a' } }] }, 'changes nothing'],
    ['a new entry', { ...CALL, new: true }, 'a new entry needs no call'],
    ['a JSON file outside lists/', { ...CALL, file: 'o/lists:data/useful.json' }, 'entries of a list'],
  ];
  const got = pyMany(rows.map(([, c]) => ['check', [c]]));
  rows.forEach(([what, , words], i) => (words === null
    ? assert.deepEqual(got[i], [], what)
    : assert.ok(got[i].some((e) => e.includes(words)), `${what}: ${JSON.stringify(got[i])}`)));
});

test('edits on a list are one per entry whose text or note changed', () => {
  const next = { ...LIST, items: [{ ...LIST.items[0], note: 'Reversible.' }, LIST.items[1], { id: 'new', text: 'New' }] };
  const [found] = pyMany([['list_edits', [JSONTEXT, JSON.stringify(next, null, 2)]]]);
  assert.deepEqual(found, [{ item: 'two-way-door', from: { text: 'Two-way door', note: 'A choice that can be undone cheaply.' },
    to: { text: 'Two-way door', note: 'Reversible.' } }], 'a removed entry and an added one are not edits');
});

// A checkout of o/lists whose main holds LIST, the project root a call is filed
// from, and a store beside it.
function project() {
  const tmp = mkdtempSync(path.join(tmpdir(), 'user-call-list-'));
  mkdirSync(path.join(tmp, 'o'));
  git(tmp, 'init', '-q', '--bare', '-b', 'main', 'o/lists.git');
  git(tmp, 'clone', '-q', 'o/lists.git', 'lists');
  const dir = path.join(tmp, 'lists');
  mkdirSync(path.join(dir, 'lists'));
  writeFileSync(path.join(dir, 'lists', 'useful.json'), JSONTEXT);
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'init');
  git(dir, 'push', '-q', 'origin', 'main');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', 'store.git');
  git(tmp, 'clone', '-q', 'store.git', 'store');
  const store = path.join(tmp, 'store');
  writeFileSync(path.join(store, '.web-tools.json'), '{"user-calls": "user-calls"}\n');
  mkdirSync(path.join(store, 'user-calls'));
  writeFileSync(path.join(store, 'user-calls', '.keep'), '');
  git(store, 'add', '.');
  git(store, 'commit', '-qm', 'init');
  git(store, 'push', '-q', 'origin', 'main');
  return { dir, store };
}
const add = (p, call) => spawnSync('python3', ['-B', SCRIPT, 'add', '--store', path.join(p.store, 'user-calls')],
  { env: { ...ENV, CLAUDE_PROJECT_DIR: p.dir }, encoding: 'utf8', input: JSON.stringify(call) });

test("add files a list call only when each edit's entry is in the list at the base, as its from reads", () => {
  const p = project();
  const ok = add(p, CALL);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), 'user-calls/a710e806-useful-sweep.json');
  const missing = add(p, { ...CALL, slug: 'useful-missing', edits: [{ ...CALL.edits[1], item: 'no-such-entry' }] });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /the list holds no entry no-such-entry/);
  const moved = add(p, { ...CALL, slug: 'useful-moved', edits: [{ ...CALL.edits[0], from: { text: 'Two-way door', note: 'Old.' } }] });
  assert.notEqual(moved.status, 0);
  assert.match(moved.stderr, /from is not entry two-way-door as the list holds it/);
  // A project two levels down, so the search for siblings stays inside the temporary folder.
  const bare = path.join(mkdtempSync(path.join(tmpdir(), 'no-lists-')), 'project');
  mkdirSync(bare);
  const away = add({ ...p, dir: bare }, { ...CALL, slug: 'useful-away' });
  assert.notEqual(away.status, 0, 'with no checkout of the list there is nothing to check the entries against');
  assert.match(away.stderr, /no checkout of o\/lists/);
});

const kit = () => {
  const window = { MdSurface: { patch: (p, a, b) => JSON.stringify([p, a, b]) } };
  for (const k of ['lib/kits/repo-address.js', 'lib/kits/call-answer.js']) new Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
  return window.CallAnswer;
};

test("each entry edit is read as its term and note, the id after the term only where the list shows ids", () => {
  const A = kit();
  assert.equal(A.listOf(CALL), true);
  assert.equal(A.listOf({ file: 'o/r:docs/x.md' }), false);
  assert.deepEqual(A.fileOf({ file: 'o/r@b:lists/useful.json#fact-strip' }), { repo: 'o/r', ref: 'b', path: 'lists/useful.json', item: 'fact-strip' });
  const c = A.listCall(CALL);
  assert.equal(c.edits[0].from, '**Two-way door**\n\nA choice that can be undone cheaply.', 'the term leads, and an id the list hides is left out');
  assert.equal(c.edits[1].to, '**Fact strip**\n\nA row of short facts.');
  assert.equal(A.listCall(c), c, 'a call already read is left as it is');
  const doc = A.listDoc(JSONTEXT, ['two-way-door', 'fact-strip']);
  assert.equal(doc, c.edits[0].from + '\n\n* * *\n\n**Fact strip**', 'only the entries the call names, in its order');
  assert.deepEqual(A.stage(doc, c.edits).status, ['staged', 'staged']);
  const shown = A.listCall(c, true);
  assert.equal(shown.edits[0].from, '**Two-way door** · `two-way-door`\n\nA choice that can be undone cheaply.', 'with show_id, the id follows the term as code');
  assert.equal(shown.edits[0].entry, c.edits[0].entry, 'read again from the entry, not from the earlier reading');
  const withIds = JSON.stringify({ ...LIST, show_id: true }, null, 2);
  assert.deepEqual(A.stage(A.listDoc(withIds, ['two-way-door', 'fact-strip']), shown.edits).status, ['staged', 'staged']);
});

test("an uncommitted list call's patch sets only the kept entries, and a committed one's puts back only the discarded", async () => {
  const A = kit();
  const read = async (ref) => (ref === 'claude/x' ? JSONTEXT : (() => { throw new Error('404'); })());
  const s = await A.source({ ...CALL, base: undefined }, read);
  assert.deepEqual(s.status, ['staged', 'staged']);
  assert.equal(s.raw, JSONTEXT);
  const edits = A.listCall(CALL).edits;
  const [p, from, to] = JSON.parse(A.answerPatch({ path: 'lists/useful.json', raw: s.raw, edits, decisions: ['confirmed', 'discarded'], committed: '' }));
  assert.equal(p, 'lists/useful.json');
  assert.equal(from, JSONTEXT);
  const want = structuredClone(LIST);
  want.items[0].note = 'A decision that can be reversed cheaply.';
  assert.equal(to, JSON.stringify(want, null, 2) + '\n', 'the kept entry set, the discarded one left, the rest byte for byte');

  // Committed: the branch holds both edits, so main is where they are decided.
  const branch = structuredClone(want);
  branch.items[2].note = 'A row of short facts.';
  const BR = JSON.stringify(branch, null, 2) + '\n';
  const s2 = await A.source(CALL, async (ref) => (ref === 'claude/x' ? BR : JSONTEXT));
  assert.equal(s2.committed, 'main');
  assert.equal(s2.raw, BR, 'the patch is made from the list as the branch holds it');
  assert.equal(A.answerPatch({ path: 'lists/useful.json', raw: s2.raw, edits, decisions: ['confirmed', 'confirmed'], committed: 'main' }), '', 'keeping both needs no patch');
  const [, , back] = JSON.parse(A.answerPatch({ path: 'lists/useful.json', raw: s2.raw, edits, decisions: ['confirmed', 'discarded'], committed: 'main' }));
  assert.equal(back, JSON.stringify(want, null, 2) + '\n', 'the discarded entry goes back to how main has it');
});

test('a list laid out by hand changes only where the kept entry stands', () => {
  const A = kit();
  const hand = '{\n  "title": "Useful",\n  "kinds": ["a", "b"],\n  "items": [\n    {"id": "x", "text": "Old", "note": "N"}\n  ]\n}\n';
  assert.equal(A.setEntries(hand, [['x', { text: 'New', note: 'N' }]]), hand.replace('"text": "Old"', '"text": "New"'));
  assert.throws(() => A.setEntries(hand, [['x', { text: 'Old' }]]), /cannot place the note/, 'a note dropped from a hand layout is not guessed at');
  assert.throws(() => A.setEntries(JSONTEXT, [['nope', { text: 'a' }]]), /no entry nope/);
});

// The peeves critic on a list call: the critic reads the call's entries as
// text, each edit's span is its entry by id, and the runs file with the call
// as a Markdown call's do.
test("a list call's critic runs: spans are entries, the run reads the entries, and add maps each span to its edit", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'user-call-list-review-'));
  git(tmp, 'init', '-q', '-b', 'main');
  mkdirSync(path.join(tmp, 'lists'));
  const file = path.join(tmp, 'lists', 'useful.json');
  writeFileSync(file, JSONTEXT);
  git(tmp, 'add', '.');
  git(tmp, 'commit', '-qm', 'init');
  const next = structuredClone(LIST);
  next.items[0].note = 'A decision that can be reversed cheaply.';
  next.items[2].note = 'A row of short facts.';
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  const draft = path.join(tmp, 'draft.json');
  writeFileSync(draft, JSON.stringify({ ...CALL, edits: [{ ...CALL.edits[0], why: 'the plain word' }] }));
  const review = (...a) => spawnSync('python3', ['-B', SCRIPT, 'review', draft, file, ...a], { encoding: 'utf8', env: ENV });

  const spans = review('--spans');
  assert.equal(spans.status, 0, spans.stderr);
  assert.match(spans.stdout, /E1 {2}entry two-way-door\nE2 {2}entry fact-strip/, 'the edits are refreshed from the base, one per changed entry');
  assert.match(spans.stdout, /\*\*Fact strip\*\*\n\nA row of short facts\./, 'the critic is given the entries to read');
  const d1 = JSON.parse(readFileSync(draft, 'utf8'));
  assert.equal(d1.edits[0].why, 'the plain word', "the session's why is carried by the entry it names");

  const report = 'Trips:\n\n- P06 · E2 · fact-strip · "short facts" · Name which facts.\n\nClear: P01\n\nVerdict: FAIL';
  writeFileSync(path.join(tmp, 'r.md'), report);
  const r1 = review(path.join(tmp, 'r.md'));
  assert.equal(r1.status, 0, r1.stderr);
  const d2 = JSON.parse(readFileSync(draft, 'utf8'));
  const last = d2.review.runs.at(-1);
  assert.deepEqual(last.edits, [{ item: 'two-way-door' }, { item: 'fact-strip' }]);
  assert.equal(last.trips[0].edit, 2);
  assert.match(last.text, /^\*\*Two-way door\*\*\n/);
  assert.equal(last.trips[0].misquoted, undefined, 'the quote is in the entries the run read');

  // Answered: the trip kept, then the call checked as add files it.
  assert.equal(spawnSync('python3', ['-B', SCRIPT, 'review', draft, '--kept', '1', 'the facts vary by page'], { encoding: 'utf8' }).status, 0);
  const d3 = JSON.parse(readFileSync(draft, 'utf8'));
  const [unread, filed] = pyMany([['unread_edits', [d3]], ['file_edits', [d3]]]);
  assert.deepEqual(unread, [], 'the last run read every edit as filed');
  assert.deepEqual(filed.review.runs[0].edits, [{ item: 'two-way-door', edit: 1 }, { item: 'fact-strip', edit: 2 }]);
  assert.equal(filed.review.runs[0].text, undefined, 'the text the run read is dropped at filing');
  assert.deepEqual(pyMany([['check', [filed]]])[0], []);
});

test("a list report's trips grouped under their entry's id take that entry's span", () => {
  const report = '**Trips**\n\n- `two-way-door` (two-way door)\n  - P05: "undone cheaply". Name it.\n  - P74 (also): the note runs on.\n- `standfirst`\n  - P01: "headline". Provenance.\n\nVerdict: FAIL';
  const [run] = pyMany([['parse_report', [report]]]);
  assert.equal(run.verdict, 'fail');
  assert.deepEqual(run.trips.map((t) => [t.peeve, t.item, t.quote]), [['P05', 'two-way-door', 'undone cheaply'], ['P74', 'two-way-door', ''], ['P01', 'standfirst', 'headline']]);
  const [draft] = pyMany([['add_run', [{}, 'text', report, 't', [{ item: 'two-way-door' }, { item: 'fact-strip' }]]]]);
  const r = draft.review.runs[0];
  assert.deepEqual(r.trips.map((t) => t.edit), [1, 1, 0], 'an entry outside the call is E-');
  assert.equal(r.trips[0].item, undefined);
  assert.equal(r.verdict, 'fail');
  assert.deepEqual(pyMany([['review_errors', [{ runs: [{ ...r, trips: r.trips.map((t) => ({ ...t, answer: 'kept', why: 'w' })) }] }]]])[0], [],
    "the entry's id in the report stands for the tag");
});

test('a stated PASS that names no peeve passes without a Trips section; one that names a peeve, or a FAIL, has no verdict', () => {
  const [ok, named, fail] = pyMany([
    ['parse_report', ['Run 2: all seven notes pass.\n\n- two-way-door: PASS.\n\nVerdict: PASS']],
    ['parse_report', ['Run 2: P05 is gone.\n\nVerdict: PASS']],
    ['parse_report', ['Run 2: one note still reads poorly.\n\nVerdict: FAIL']],
  ]);
  assert.equal(ok.verdict, 'pass');
  assert.equal(named.verdict, 'unknown', 'a peeve named outside a Trips section may be a trip in another shape');
  assert.equal(fail.verdict, 'unknown');
});
