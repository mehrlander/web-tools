// A documentation user call on entries of a list (lists/*.json): the limits
// user-call.py's `add` holds it to, the check that each edit's entry is in the
// list at the call's base, the edits it derives from two copies of a list, and
// kits/call-answer.js's reading of the entries and the patch an answer carries.
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

test("each entry edit is read as the entry's text and note, so the page decides it as a paragraph", () => {
  const A = kit();
  assert.equal(A.listOf(CALL), true);
  assert.equal(A.listOf({ file: 'o/r:docs/x.md' }), false);
  assert.deepEqual(A.fileOf({ file: 'o/r@b:lists/useful.json#fact-strip' }), { repo: 'o/r', ref: 'b', path: 'lists/useful.json', item: 'fact-strip' });
  const c = A.listCall(CALL);
  assert.equal(c.edits[0].from, '**two-way-door** · Two-way door\n\nA choice that can be undone cheaply.');
  assert.equal(c.edits[1].to, '**fact-strip** · Fact strip\n\nA row of short facts.');
  assert.equal(A.listCall(c), c, 'a call already read is left as it is');
  const doc = A.listDoc(JSONTEXT, ['two-way-door', 'fact-strip']);
  assert.equal(doc, c.edits[0].from + '\n\n* * *\n\n**fact-strip** · Fact strip', 'only the entries the call names, in its order');
  assert.deepEqual(A.stage(doc, c.edits).status, ['staged', 'staged']);
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
