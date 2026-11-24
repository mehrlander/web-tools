// node/test/user-call-script.test.mjs
// The user-calls skill's script (skills/user-calls/user-call.py): the limits
// `add` holds each kind of call to, the edits it derives from two copies, how
// it prints an answer, and its reads and writes against a throwaway store: a
// bare origin and a clone parked on another branch, as in notes.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = path.join(repoRoot, 'skills', 'user-calls', 'user-call.py');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };

// The script's functions, each [name, args] called in one interpreter, since
// starting Python per call made this file take fifteen seconds. -B keeps
// __pycache__/ out of the skill folder, which ships in the plugin.
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
const lines = (answer, call) => py('answer_lines', answer, call ?? null);
// Rows of [what, call, words]: the call passes `check` when words is null, and
// otherwise one of its errors contains the words.
const verdicts = (rows) => {
  const got = pyMany(rows.map(([, c]) => ['check', [c]]));
  rows.forEach(([what, , words], i) => (words === null
    ? assert.deepEqual(got[i], [], what)
    : assert.ok(got[i].some((e) => e.includes(words)), `${what}: ${JSON.stringify(got[i])}`)));
};

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' });
// A store holding `files` in user-calls/ on main, its clone on another branch.
function store(files = {}) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'user-calls-'));
  git(tmp, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  git(tmp, 'clone', '-q', 'origin.git', 'store');
  const dir = path.join(tmp, 'store');
  writeFileSync(path.join(dir, '.web-tools.json'), '{"user-calls": "user-calls"}\n');
  mkdirSync(path.join(dir, 'user-calls'));
  writeFileSync(path.join(dir, 'user-calls', '.keep'), '');
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(dir, 'user-calls', name), body);
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'init');
  git(dir, 'push', '-q', 'origin', 'main');
  git(dir, 'checkout', '-qb', 'claude/elsewhere');
  return dir;
}
const run = (dir, args, input) => spawnSync('python3', ['-B', SCRIPT, ...args, '--store', path.join(dir, 'user-calls')],
  { env: ENV, encoding: 'utf8', input });
const onMain = (dir, name) => git(dir, 'show', `origin/main:user-calls/${name}`);

const DOC = {
  session: 'a710e806', slug: 'text-tools-tighten', kind: 'documentation',
  question: 'Apply 2 edits to docs/x.md?', brief: 'Cuts a repeated sentence.',
  file: 'mehrlander/web-tools:docs/x.md',
  edits: [{ from: 'Old one.', to: 'New one.', why: 'shorter' }, { from: 'Two.', to: '2.' }],
};
const DOC_ID = 'a710e806-text-tools-tighten';
const ANS = {
  answer: '1 confirmed, 1 discarded', note: 'Good cuts.', at: '2026-10-04T03:00:00Z', by: 'owner',
  target: 'call/test', commit: 'https://github.com/o/r/commit/c0ffee',
  decisions: [{ edit: 1, decision: 'confirmed' },
    { edit: 2, decision: 'discarded', note: 'Keep the second as it is.\nIt says why.' }],
  notes: [{ on: 'Tail.', note: 'Is this\n still true?' }],
};
const PATCH = '--- a/docs/x.md\n+++ b/docs/x.md\n@@ -1 +1 @@\n-Old one.\n+New one.\n';
const REC = {
  answer: '1 confirmed', at: 't', by: 'owner', call: `o/r:user-calls/${DOC_ID}.json`,
  decisions: [{ edit: 1, decision: 'confirmed' }], patch: PATCH, apply: 'session',
};
const DEC = {
  session: '2708d02c', slug: 'close-nine-prs', question: 'Close nine PRs?', brief: 'b',
  options: ['Close all', 'Keep some'], recommend: 'Close all', why: 'their work landed',
};
const FULL = {
  ...DEC, name: 'Nine Ghost PRs', size: 'XS', confidence: 'firm', reversible: true,
  depends_on: ['mehrlander/web-tools#870', '2708d02c-merge-886',
    'mehrlander/home:projects/budget-drs/tracker/tasks/grid-membership-cv0o2a.md'],
};
const PK = {
  session: '8be17d0e', slug: 'surfacing-mark-picks', kind: 'pick',
  question: "Which of these could become Surfacing's mark?", brief: 'Picks seed the drawn mark.',
  board: { q: ['gem', 'crystal', 'mine'], sets: ['game-icons'], color: '0891b2', group: 'loose' },
};
const IB = {
  ...PK, slug: 'model-diagram-picks', question: 'Which concepts should the Model diagram build on?',
  board: { ideas: 'mehrlander/web-tools@708efe810b89:docs/prototypes/model-diagram-ideas.json' },
};

test('a documentation call is held to its limits', () => {
  const edit = DOC.edits[0];
  verdicts([
    ['a well-formed documentation call', DOC, null],
    ['a ref on the file', { ...DOC, file: 'mehrlander/web-tools@dev:docs/x.md' }, null],
    ['a CSV file', { ...DOC, file: 'mehrlander/web-tools:docs/registries.csv' }, null],
    ['prose inside code', { ...DOC, file: 'mehrlander/web-tools@dev:skills/user-calls/user-call.py' }, 'markdown or CSV'],
    ['a file without a path', { ...DOC, file: 'mehrlander/web-tools' }, 'file'],
    ['no edits', { ...DOC, edits: [] }, 'edits'],
    ['an edit that changes nothing', { ...DOC, edits: [{ from: 'a', to: 'a' }] }, 'changes nothing'],
    ['an edit without a from', { ...DOC, edits: [{ to: 'a' }] }, 'from'],
    ['options, since each edit is answered on its card', { ...DOC, options: ['Yes', 'No'] }, 'options'],
    ['a long question', { ...DOC, question: 'q'.repeat(81) }, 'question'],
    ['a new document with no edits', { ...DOC, new: true, edits: [] }, null],
    ['a new document with edits', { ...DOC, new: true }, 'new document'],
    ['an old document with no edits', { ...DOC, edits: [] }, '1 to 40'],
    ['a base ref', { ...DOC, file: 'mehrlander/web-tools@topic:docs/x.md', base: 'main' }, null],
    ['a base that is not a ref', { ...DOC, base: 'o/r@main:x' }, 'base'],
    ["an edit's notes, corrections, clarifications or neither", { ...DOC, edits: [{ ...edit, notes: [
      { kind: 'correct', text: 'the count was wrong' }, { kind: 'clarify', text: 'and it read as two claims' },
      { text: 'a note with no kind' }] }] }, null],
    ['a note of another kind', { ...DOC, edits: [{ ...edit, notes: [{ kind: 'tighten', text: 't' }] }] }, 'kind'],
    ['a note without text', { ...DOC, edits: [{ ...edit, notes: [{ kind: 'correct' }] }] }, 'text'],
    ['notes that are not a list', { ...DOC, edits: [{ ...edit, notes: 'fix it' }] }, 'notes'],
  ]);
});

test('edits pairs the blocks of two copies so every from is text the old copy holds', () => {
  const old = '# T\n\nKeep.\n\nOld one.\n\nGone.\n\nTail.\n';
  const got = py('edits', old, '# T\n\nKeep.\n\nNew one.\n\nTail.\n\nAdded.\n');
  assert.equal(got.length, 2, 'a run that changed its block count is one edit, and an insertion another');
  assert.deepEqual(got[0], { from: 'Old one.\n\nGone.', to: 'New one.' });
  assert.ok(got.every((e) => old.includes(e.from)));
  assert.deepEqual(got.at(-1), { from: 'Tail.', to: 'Tail.\n\nAdded.' }, 'an insertion at the end takes its neighbour');
});

// Frontmatter pairs by property: an edit to one field is that field alone, and
// the title under the closing fence is a block of its own though no blank
// line parts them. lib/kits/md-diff.js splits the same way, so the page draws
// the edit as the block it is.
const FRONT = '---\ntitle: "The pool"\nstatus: current\nsummary: "Account 447 took in $94.1M, and DRS spent it."\n---\n# The pool\n\nBody text.\n';

test('frontmatter is a block per property, and a summary-only change one edit, the summary alone', () => {
  const next = FRONT.replace('$94.1M, and DRS spent it.', '$94.1M. DRS spent it all.');
  const [db, got, spans] = pyMany([['doc_blocks', [FRONT]], ['edits', [FRONT, next]], ['spans_of', [{ edits: py('edits', FRONT, next) }, next, FRONT]]]);
  assert.deepEqual(db, [['---', 1, 1], ['title: "The pool"', 2, 2], ['status: current', 3, 3],
    ['summary: "Account 447 took in $94.1M, and DRS spent it."', 4, 4], ['---', 5, 5], ['# The pool', 6, 6], ['Body text.', 8, 8]]);
  assert.deepEqual(got, [{ from: 'summary: "Account 447 took in $94.1M, and DRS spent it."', to: 'summary: "Account 447 took in $94.1M. DRS spent it all."' }]);
  assert.deepEqual(spans.map((s) => s.lines), [[4, 4]], 'its span is the summary line');
  const wrapped = 'A paragraph wrapped at a narrow\nwidth, as the rest of the file is.\n\nAnother one wrapped at the same\nnarrow width as the first.\n';
  const long = (t) => t.replace('DRS spent it', 'DRS spent it from the pool in 2019-21, which matches the spending under the expenditure authority') + '\n' + wrapped;
  const e = py('edits', long(FRONT), long(next));
  assert.deepEqual(py('wrap_warnings', { edits: e }, long(next), py('spans_of', { edits: e }, long(next))), [],
    'a long field is not a paragraph left unwrapped');
});

test('a property added, removed or split pairs without a blank line, so each edit applies back to the new copy', () => {
  const nexts = [
    FRONT.replace('status: current\n', 'status: current\nowner: DRS\n'),
    FRONT.replace('status: current\n', ''),
    FRONT.replace('status: current\n', 'status: living\nowner: DRS\n'),
    FRONT.replace('title: "The pool"', 'title: "A pool"').replace('# The pool', '# A pool'),
  ];
  const all = pyMany(nexts.map((n) => ['edits', [FRONT, n]]));
  const spans = pyMany(nexts.map((n, k) => ['spans_of', [{ edits: all[k] }, n, FRONT]]));
  nexts.forEach((n, k) => {
    let t = FRONT;
    for (const e of all[k]) { assert.equal(t.split(e.from).length, 2, JSON.stringify(e)); t = t.replace(e.from, e.to); }
    assert.equal(t, n, JSON.stringify(all[k]));
    assert.ok(spans[k].every(Boolean), 'every edit has a span');
  });
  assert.deepEqual(all[0], [{ from: 'status: current', to: 'status: current\nowner: DRS' }]);
  assert.deepEqual(spans[0].map((s) => s.lines), [[4, 4]], 'an added property is its own line');
  assert.equal(all[3].length, 2, 'the title field and the heading are two edits');
});

test('a document without frontmatter splits into its blank-line blocks, as before', () => {
  const docs = ['---\n\nA rule opens this one.\n\n---\n# H\n', '---\nNo key here.\n---\n# H\n', '---\ntitle: never closed\n# H\n', '# H\n\nOne.\nStill one.\n\nTwo.\n'];
  const got = pyMany(docs.map((d) => ['blocks', [d]]));
  docs.forEach((d, k) => assert.deepEqual(got[k], d.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean), JSON.stringify(d)));
});

test('the script and md-diff split a document into the same blocks', () => {
  const win = {};
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits/md-diff.js'), 'utf8'))(win, undefined);
  const docs = [FRONT, FRONT.replace('---\n# The', '---\n\n# The'), '---\ntags:\n  - a\n  - b\n\n# comment\nname: x\n---\n# H\nPara.\n\nMore.\n',
    '---\n\nA rule opens this one.\n\n---\n# H\n', '---\ntitle: never closed\n# H\n', '# H\n\nOne.\n\nTwo.\n'];
  const got = pyMany(docs.map((d) => ['doc_blocks', [d]]));
  docs.forEach((d, k) => assert.deepEqual(win.mdDiff.blocks(d).map((b) => b.text), got[k].map((b) => b[0]), JSON.stringify(d)));
});

test("an answer prints its decisions, each edit's note line by line, and notes on other text", () => {
  const got = lines(ANS, DOC);
  assert.equal(got[0], '1 confirmed, 1 discarded  (owner 2026-10-04T03:00:00Z)  "Good cuts."');
  assert.equal(got[1], '  committed to call/test: https://github.com/o/r/commit/c0ffee');
  assert.equal(got[2], '  1. confirmed  (shorter)');
  assert.deepEqual(got.slice(3, 6), ['  2. discarded  (Two.)', '       Keep the second as it is.', '       It says why.']);
  assert.equal(got[6], '  on "Tail.": Is this still true?');
  assert.deepEqual(lines({ answer: 'Yes', at: 't', by: 'owner' }), ['Yes  (owner t)']);
  assert.equal(lines(REC, DOC)[1],
    '  not committed: a patch of 2 changed lines waits for a session (user-call.py patch a710e806-text-tools-tighten)');
  assert.deepEqual(lines({ answer: 'Adjust', then: 'return', note: 'split at 47', at: 't', by: 'owner' }),
    ['Adjust, then return (draft the change and file a new call before acting)  (owner t)  "split at 47"']);
});

test('the five fields that say what sort of call it is', () => {
  const task = { kind: 'task', ref: 'mehrlander/web-tools:tracker/tasks/pr-body-open-threads-z5o66p.md', label: 'Open threads' };
  verdicts([
    ['a call carrying all five', FULL, null],
    ['a call carrying none', DEC, null],
    ['a long name', { ...DEC, name: 'n'.repeat(25) }, 'name'],
    ["a size off the tracker's scale", { ...DEC, size: 'huge' }, 'size'],
    ['confidence with no recommendation', { ...DEC, recommend: null, confidence: 'firm' }, 'needs one'],
    ['a lean recommendation without a why', { ...DEC, why: '', confidence: 'lean' }, 'lean'],
    ['reversible that is not a boolean', { ...DEC, reversible: 'yes' }, 'reversible'],
    ['a dependency that is none of the three', { ...DEC, depends_on: ['after lunch'] }, 'depends_on'],
    ['more than six dependencies', { ...DEC, depends_on: Array(7).fill('o/r#1') }, 'depends_on'],
    ['a task link to a tracker task', { ...DEC, materials: [task] }, null],
    ['a task link to anything else', { ...DEC, materials: [{ ...task, ref: 'mehrlander/web-tools:docs/x.md' }] }, 'tracker/tasks'],
    ['a merge call rated without a recommend', { session: '2708d02c', slug: 'merge-7', kind: 'merge', pr: 'o/r#7',
      shipped: ['x'], confidence: 'lean', size: 'XS', reversible: true }, null],
  ]);
});

test('a chain, a tree, a glossary, views and materials name files at a ref', () => {
  const dec = { session: 'bb88ffa7', slug: 'topic-size', kind: 'decision', question: 'How big is a topic?',
    brief: "The key's size.", options: ["The key's reading", 'Finer'] };
  const ch = { design: 'mehrlander/web-tools-private@main:crazy8/templates/threaded', at: 'def',
    theme: 'mehrlander/web-tools-private@main:crazy8/takes/themes.json#compact' };
  const w = 'mehrlander/web-tools-private@main:calls/chain.json';
  const f = { kind: 'file', ref: 'mehrlander/web-tools-private@main:calls/cases/topic-size.md' };
  verdicts([
    ['a chain with a design, a block and a theme', { ...dec, chain: ch }, null],
    ['a chain without a theme', { ...dec, chain: { design: ch.design, at: ch.at } }, null],
    ["a chain's design without its ref", { ...dec, chain: { ...ch, design: 'mehrlander/x:templates/a' } }, 'chain.design'],
    ['a chain naming no block', { ...dec, chain: { ...ch, at: '' } }, 'chain.at'],
    ["a chain's theme with no name", { ...dec, chain: { ...ch, theme: 'mehrlander/x@main:themes.json' } }, 'chain.theme'],
    ['a chain with its own words', { ...dec, chain: { ...ch, words: w } }, null],
    ["a chain's words not at a ref", { ...dec, chain: { ...ch, words: 'calls/chain.json' } }, 'chain.words'],
    ['a glossary', { ...dec, glossary: w.replace('chain', 'glossary') }, null],
    ['a views file', { ...dec, views: w.replace('chain', 'views/topic-size') }, null],
    ['a decision tree', { ...dec, tree: w.replace('chain', 'tree') }, null],
    ['a tree not at a ref', { ...dec, tree: 'calls/tree.json' }, 'tree'],
    ['a views file that is not JSON', { ...dec, views: 'views/topic-size.md' }, 'views'],
    ['a glossary that is not JSON', { ...dec, glossary: 'mehrlander/x@main:glossary.md' }, 'glossary'],
    ['a material naming one of the answers', { ...dec, materials: [{ ...f, answer: dec.options[0] }] }, null],
    ['a material naming an answer the call lacks', { ...dec, materials: [{ ...f, answer: 'Close half' }] }, 'answer'],
    ['a material filed against a block', { ...dec, materials: [{ ...f, field: 'decide.paths[1]' }] }, null],
    ["a material's field that is not a path", { ...dec, materials: [{ ...f, field: 'The key' }] }, 'field'],
  ]);
});

test('a decision is a recommendation the owner takes or adjusts', () => {
  const ta = { session: 'bb88ffa7', slug: 'topic-size', kind: 'decision', question: 'Is reworking one part a new topic?',
    brief: 'The key says no.', recommend: 'No, same topic', why: 'it is the key as built' };
  const f = { kind: 'file', ref: 'mehrlander/web-tools-private@main:calls/cases/topic-size.md' };
  verdicts([
    ['a recommendation and no options', ta, null],
    ['neither', { ...ta, recommend: '' }, 'takes it or adjusts it'],
    ['a recommendation too long for its button', { ...ta, recommend: 'r'.repeat(21) }, '20'],
    ['a material showing what Take approves', { ...ta, materials: [{ ...f, answer: 'Take' }] }, null],
    ['a material naming any other answer', { ...ta, materials: [{ ...f, answer: 'Adjust' }] }, 'is Take'],
    ["an older call's options", { ...ta, options: ['Yes', 'No'], recommend: 'No' }, null],
  ]);
});

test('a pick call carries a board of searches or an idea board pinned to a commit', () => {
  verdicts([
    ['a well-formed pick call', PK, null],
    ['a board with no searches', { ...PK, board: { q: [] } }, 'board.q'],
    ['a search with a comma, since the board splits on commas', { ...PK, board: { q: ['gem, crystal'] } }, 'board.q'],
    ['an unknown source', { ...PK, board: { ...PK.board, src: 'unsplash' } }, 'board.src'],
    ['a tint with its #', { ...PK, board: { ...PK.board, color: '#0891b2' } }, 'board.color'],
    ['an unknown grouping', { ...PK, board: { ...PK.board, group: 'huge' } }, 'board.group'],
    ['a recommendation', { ...PK, recommend: 'gem' }, 'the answer is the picks'],
    ['a pick call on an idea board', IB, null],
    ['an idea board pinned to a branch', { ...IB, board: { ideas: 'mehrlander/web-tools@main:docs/x.json' } }, 'board.ideas'],
    ['an idea board with searches beside it', { ...IB, board: { ...IB.board, q: ['gem'] } }, 'board.ideas'],
  ]);
  assert.deepEqual(lines({ answer: 'Picked', at: 't', by: 'owner',
    picks: [{ id: 'iconify game-icons:crystal-shine', href: 'https://x/crystal-shine/' }] }),
  ['Picked  (owner t)', '  iconify game-icons:crystal-shine  https://x/crystal-shine/']);
  assert.deepEqual(lines({ answer: 'Picked', at: 't', by: 'owner', picks: [{ id: 'idea 2 Build it up', href: '' }],
    notes: [{ on: 'idea 2 Build it up', note: 'frames too small' }] }),
  ['Picked  (owner t)', '  on "idea 2 Build it up": frames too small', '  idea 2 Build it up']);
});

test('add refuses a merge call before looking for a store', () => {
  const r = spawnSync('python3', ['-B', SCRIPT, 'add', '--store', path.join(tmpdir(), 'no-such-store')],
    { encoding: 'utf8', input: JSON.stringify({ session: '2708d02c', slug: 'merge-7', kind: 'merge', pr: 'o/r#7' }) });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /a merge is not a call/);
});

test('add writes the call to main, whatever branch the checkout is on, and leaves the working tree alone', () => {
  const dir = store();
  const r = run(dir, ['add'], JSON.stringify(FULL));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'user-calls/2708d02c-close-nine-prs.json');
  const c = JSON.parse(onMain(dir, '2708d02c-close-nine-prs.json'));
  assert.equal(c.schema, 'user-call/1');
  assert.equal(c.status, 'open');
  assert.equal(git(dir, 'branch', '--show-current').trim(), 'claude/elsewhere');
  assert.equal(existsSync(path.join(dir, 'user-calls', '2708d02c-close-nine-prs.json')), false);

  const taken = run(dir, ['add'], JSON.stringify({ ...FULL, slug: 'close-four-tasks' }));
  assert.notEqual(taken.status, 0, 'a second open call may not take a name already in use');
  assert.match(taken.stderr, /2708d02c-close-nine-prs/);
  const again = run(dir, ['add'], JSON.stringify(FULL));
  assert.equal(again.status, 0, 're-adding the same call keeps its own name');
  assert.equal(JSON.parse(onMain(dir, '2708d02c-close-nine-prs.json')).created, c.created, 'and its created stamp');

  const listed = run(dir, ['list', '2708d02c']);
  assert.equal(listed.stdout, '2708d02c-close-nine-prs: Close nine PRs?\n');
  const closed = run(dir, ['close', '2708d02c-close-nine-prs', 'Close all']);
  assert.equal(closed.status, 0, closed.stderr);
  assert.equal(JSON.parse(onMain(dir, '2708d02c-close-nine-prs.json')).closed.answer, 'Close all');
  assert.equal(run(dir, ['list']).stdout, '', 'a closed call is no longer listed');
});

test('without --store, the store is the folder a checkout declares as "user-calls"', () => {
  const dir = store({ [`${DOC_ID}.json`]: JSON.stringify({ ...DOC, id: DOC_ID, status: 'open' }) });
  const r = spawnSync('python3', ['-B', SCRIPT, 'list'],
    { env: { ...ENV, CLAUDE_PROJECT_DIR: path.dirname(dir) }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `${DOC_ID}: Apply 2 edits to docs/x.md?\n`);
  // A project two levels down, so the search for siblings stays inside the temporary folder.
  const bare = path.join(mkdtempSync(path.join(tmpdir(), 'no-store-')), 'project');
  mkdirSync(bare);
  const none = spawnSync('python3', ['-B', SCRIPT, 'list'],
    { env: { ...ENV, CLAUDE_PROJECT_DIR: bare }, encoding: 'utf8' });
  assert.notEqual(none.status, 0);
  assert.match(none.stderr, /no checkout declares a user-call store/);
});

test('link, answers and patch read the call and its answers from main', () => {
  const dir = store({
    [`${DOC_ID}.json`]: JSON.stringify({ ...DOC, id: DOC_ID }),
    [`${DOC_ID}.answers.jsonl`]: `${JSON.stringify(ANS)}\n${JSON.stringify(REC)}\n`,
    '8be17d0e-surfacing-mark-picks.json': JSON.stringify(PK),
    '8be17d0e-model-diagram-picks.json': JSON.stringify(IB),
  });
  assert.equal(run(dir, ['link', DOC_ID, '--at', 'mehrlander/web-tools@dev']).stdout.trim(),
    `https://mehrlander.github.io/web-tools/pages/user-call.html#src=mehrlander/web-tools@dev:user-calls/${DOC_ID}.json`);
  assert.ok(run(dir, ['link', '8be17d0e-surfacing-mark-picks']).stdout
    .startsWith('https://mehrlander.github.io/web-tools/pages/image-board.html#user-call='));
  assert.ok(run(dir, ['link', '8be17d0e-model-diagram-picks']).stdout
    .startsWith('https://mehrlander.github.io/web-tools/app/?view=program&program=content&pick='));
  const missing = run(dir, ['link', 'a710e806-no-such-call']);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /no call a710e806-no-such-call on main/);

  const out = run(dir, ['answers', DOC_ID]).stdout;
  assert.ok(out.includes('2. discarded  (Two.)') && out.includes('Keep the second'), out);
  const patch = run(dir, ['patch', DOC_ID]);
  assert.equal(patch.status, 0, patch.stderr);
  assert.equal(patch.stdout, PATCH, 'the latest answer\'s patch, as git apply takes it');

  const committed = store({ [`${DOC_ID}.answers.jsonl`]: `${JSON.stringify(REC)}\n${JSON.stringify(ANS)}\n` });
  const refusal = run(committed, ['patch', DOC_ID]);
  assert.notEqual(refusal.status, 0, 'refused when the latest answer was committed');
  assert.match(refusal.stderr, /committed/);
});
