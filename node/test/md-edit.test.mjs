// lib/kits/md-edit.js — editing one section of a rendered markdown file and
// saving it back. What is pinned here is everything that decides WHAT gets
// written: where the section sits in the file (frontmatter included), how an
// edit lands on a file that moved since it was read, when it refuses instead,
// which files it will not edit at all, and what the checks say. The sheet and
// the editor are DOM over these; node/test/md-edit-live.mjs drives them in a
// browser against a stubbed GitHub.
//
// md-doc's half is pinned too: the Edit row appears only where the host opted
// in with the file as read, at a branch, with a token to write with.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow } from './bootstrap.mjs';
import { marked } from 'marked';

const { window } = makeWindow();
window.marked = marked;
const run = (file) => new Function('window', 'document', readFileSync(path.join(repoRoot, file), 'utf8'))(window, window.document);
run('lib/kits/src-doc.js');
run('lib/kits/md-doc.js');
run('lib/kits/md-edit.js');
const { mdDoc, mdEdit } = window;

const FM = '---\nstatus: draft\n---\n';
const BODY = [
  '# Title',
  '',
  'Opening.',
  '',
  '## First',
  '',
  'A paragraph about [the second](#second).',
  '',
  '### Under first',
  '',
  'More.',
  '',
  '## Second',
  '',
  'Closing words.',
  '',
].join('\n');
const FULL = FM + BODY;
const sec = (title) => mdDoc.split(BODY).find(s => s.title === title);

// ── Where the section goes ──────────────────────────────────────────────────

test('the rendered body is located inside the file, past its frontmatter', () => {
  assert.equal(mdEdit.offsetOf(FULL, BODY), FM.length);
  assert.equal(mdEdit.offsetOf(BODY, BODY), 0);
  assert.equal(mdEdit.offsetOf(FULL, BODY.replace('Opening', 'Changed')), -1,
    'a body that is not the file\'s tail cannot be written back');
});

test('a section is replaced in place and everything around it is untouched', () => {
  const s = sec('Second');
  const out = mdEdit.place(FULL, FM.length, s, '## Second\n\nNew closing words.\n\n\n');
  assert.equal(out, FULL.replace('Closing words.', 'New closing words.'));
});

test('a parent section carries its subsections, and the gap after it survives', () => {
  const s = sec('First');
  assert.match(s.raw, /### Under first/);
  const out = mdEdit.place(FULL, FM.length, s, '## First\n\nShorter.');
  assert.equal(out, FM + '# Title\n\nOpening.\n\n## First\n\nShorter.\n\n## Second\n\nClosing words.\n');
});

test('an emptied section takes its gap with it', () => {
  const out = mdEdit.place(FULL, FM.length, sec('First'), '   \n');
  assert.equal(out, FM + '# Title\n\nOpening.\n\n## Second\n\nClosing words.\n');
});

// ── A file that moved since it was read ─────────────────────────────────────

test('an edit lands on a newer file when another section changed', () => {
  const newer = FULL.replace('Opening.', 'Opening, revised elsewhere.');
  const r = mdEdit.rebase(newer, sec('Second'), '## Second\n\nMine.');
  assert.equal(r.conflict, undefined);
  assert.match(r.text, /Opening, revised elsewhere\./, 'their edit kept');
  assert.match(r.text, /## Second\n\nMine\.\n$/, 'mine applied');
});

test('the same section changed elsewhere is a conflict, never an overwrite', () => {
  const newer = FULL.replace('Closing words.', 'Their closing words.');
  assert.deepEqual(mdEdit.rebase(newer, sec('Second'), '## Second\n\nMine.'), { conflict: 'changed' });
});

test('a section whose text now occurs twice is a conflict too', () => {
  const s = sec('Second');
  const twice = FULL + '\n' + s.raw + '\n';
  assert.deepEqual(mdEdit.rebase(twice, s, '## Second\n\nMine.'), { conflict: 'ambiguous' });
});

// ── The save, against a fake GitHub ─────────────────────────────────────────

function fakeGH(files, { failPuts = 0 } = {}) {
  const puts = [], refs = [], pulls = [];
  let failed = 0;
  class GH {
    constructor(c) { this.repo = c.repo; this.ref = c.ref; }
    async get(p, o = {}) {
      const f = files[(o.ref || this.ref) + ':' + p];
      if (!f) throw Object.assign(new Error('404'), { status: 404 });
      return { text: f.text, sha: f.sha };
    }
    async save(p, text, message, o) {
      puts.push({ ref: this.ref, path: p, text, message, ...o });
      if (failed < failPuts) { failed++; throw Object.assign(new Error('conflict'), { status: 409 }); }
      files[this.ref + ':' + p] = { text, sha: 'sha' + puts.length };
      return { content: { sha: 'sha' + puts.length }, commit: { sha: 'c'.repeat(40), html_url: 'u' } };
    }
    async createRef(b, from) { refs.push({ b, from }); files[b + ':docs/x.md'] = files[from + ':docs/x.md']; return { branch: b }; }
    async createPull(o) { pulls.push(o); return { number: 7, html_url: 'pr' }; }
    async req() { return {}; }
  }
  GH.FRESH = { cache: 'no-store' };
  window.GH = GH;
  window.ghAuth = { resolve: () => 'tok' };
  return { puts, refs, pulls };
}

const S = (over = {}) => ({ sec: sec('Second'), addr: { repo: 'o/r', ref: 'main', path: 'docs/x.md' },
                            full: FULL, at: FM.length, ...over });

test('a save reads the file fresh, writes strictly, and names the sha it read', async () => {
  const { puts } = fakeGH({ 'main:docs/x.md': { text: FULL, sha: 'read1' } });
  const out = await mdEdit._commit(S(), '## Second\n\nMine.', 'm', 'direct');
  assert.equal(puts.length, 1);
  assert.equal(puts[0].sha, 'read1');
  assert.equal(puts[0].strict, true, 'a conflict must come back, not be retried over');
  assert.equal(out.merged, false);
  assert.match(out.text, /Mine\./);
  assert.match(out.text, /^---\nstatus: draft\n---\n/, 'the frontmatter is written back');
});

test('a save onto a file that moved elsewhere merges, and says so', async () => {
  const { puts } = fakeGH({ 'main:docs/x.md': { text: FULL.replace('Opening.', 'Theirs.'), sha: 'newer' } });
  const out = await mdEdit._commit(S(), '## Second\n\nMine.', 'm', 'direct');
  assert.equal(out.merged, true);
  assert.equal(puts[0].sha, 'newer');
  assert.match(puts[0].text, /Theirs\.[\s\S]*Mine\./);
});

test('a save onto a section someone else changed writes nothing', async () => {
  const { puts } = fakeGH({ 'main:docs/x.md': { text: FULL.replace('Closing words.', 'Theirs.'), sha: 'newer' } });
  const out = await mdEdit._commit(S(), '## Second\n\nMine.', 'm', 'direct');
  assert.equal(out.conflict, 'changed');
  assert.equal(puts.length, 0);
});

test('a race between the read and the write is re-read, not overwritten', async () => {
  const { puts } = fakeGH({ 'main:docs/x.md': { text: FULL, sha: 'read1' } }, { failPuts: 1 });
  const out = await mdEdit._commit(S(), '## Second\n\nMine.', 'm', 'direct');
  assert.equal(puts.length, 2);
  assert.ok(out.res, 'the second round landed');
});

test('the branch mode writes to a new branch and opens a draft pull request', async () => {
  const { puts, refs, pulls } = fakeGH({ 'main:docs/x.md': { text: FULL, sha: 'read1' } });
  const out = await mdEdit._commit(S(), '## Second\n\nMine.', 'Edit it', 'pr');
  assert.match(refs[0].b, /^edit\/x-\d{12}$/);
  assert.equal(refs[0].from, 'main');
  assert.equal(puts[0].ref, refs[0].b, 'the write lands on the new branch');
  assert.equal(pulls[0].base, 'main');
  assert.equal(pulls[0].head, refs[0].b);
  assert.equal(out.pr.number, 7);
});

// ── Checks ──────────────────────────────────────────────────────────────────

test('the heading parser reads ATX and setext, and nothing else', () => {
  assert.deepEqual(mdEdit.heading('## Hi there ##\n\nx'), { depth: 2, title: 'Hi there', setext: false });
  assert.deepEqual(mdEdit.heading('Hi\n===\n'), { depth: 1, title: 'Hi', setext: true });
  assert.equal(mdEdit.heading('Just prose.\n'), null);
});

test('an unchanged section says so and nothing else', () => {
  assert.deepEqual(mdEdit.checks(sec('Second'), sec('Second').raw + '\n\n').map(c => c.id), ['same']);
});

test('a lost heading and a changed level are both called out', () => {
  const s = sec('Second');
  assert.deepEqual(mdEdit.checks(s, 'Closing words, no heading.').map(c => c.id), ['heading']);
  assert.deepEqual(mdEdit.checks(s, '### Second\n\nClosing words.').map(c => c.id), ['level']);
});

test('a renamed heading names both anchors and the links here that break', () => {
  const s = sec('Second');
  const next = '## Final\n\nClosing words.';
  const out = mdEdit.checks(s, next, { body: mdEdit.place(BODY, 0, s, next) });
  const anchor = out.find(c => c.id === 'anchor');
  assert.equal(anchor.text, 'Anchor #second becomes #final');
  assert.equal(out.find(c => c.id === 'anchor-here').text, '1 link in this file point at #second');
});

test('em dashes are flagged only on added prose lines, by file line', () => {
  const s = { ...sec('First'), raw: '## First\n\nOld line — kept as is.\n\nOther.' };
  const next = '## First\n\nOld line — kept as is.\n\nNew line — added.\n\n```\nrun -- --flag — x\n```';
  const out = mdEdit.checks(s, next, { line: 10 });
  assert.equal(out.find(c => c.id === 'dash').text, 'Em dash on line 14');
});

test('only links that are new and inside the repository are checked', () => {
  const before = 'See [a](a.md) and [site](https://x.org).';
  const after = before + ' And [b](../b.md#part), [here](#second), [web](https://y.org), [a again](a.md).';
  assert.deepEqual(mdEdit.newLinks(before, after), ['../b.md#part', '#second']);
});

// ── Files it will not edit, and what an edit sets off ───────────────────────

const legs = mdEdit.parseCsv(readFileSync(path.join(repoRoot, 'docs/hook-legs.csv'), 'utf8'));

test('generated files are refused by their own marker line', () => {
  for (const f of ['docs/README.md', 'tracker/board.md', 'pages/README.md']) {
    const text = readFileSync(path.join(repoRoot, f), 'utf8');
    assert.ok(mdEdit.generated(text, f, []), f + ' reads as generated');
  }
  const app = readFileSync(path.join(repoRoot, 'docs/APP.md'), 'utf8');
  assert.equal(mdEdit.generated(app, 'docs/APP.md', legs), null, 'an authored doc is editable');
});

test('a file the commit hook writes is refused even without a marker', () => {
  const g = mdEdit.generated('# Conversation\n', 'skills/default/CONVERSATION.md', legs);
  assert.ok(g);
  assert.match(g.why, /plugin-copies/);
});

test('a doc edit names the generated files it sets off', () => {
  const touched = mdEdit.legsFor('docs/stage.md', legs).map(l => l.leg);
  for (const leg of ['docs-reach', 'themes-graph', 'harness-census']) assert.ok(touched.includes(leg), leg);
  assert.ok(!touched.includes('pre-build'), 'lib/ legs are not set off by a doc');
  const stages = mdEdit.stagesOf(mdEdit.legsFor('docs/stage.md', legs));
  assert.ok(stages.includes('docs/docs.csv') && stages.includes('docs/themes.csv'));
});

test('watch patterns: a bare glob matches any folder, a folder matches below it', () => {
  assert.ok(mdEdit.matches('*.md', 'a/b/c.md'));
  assert.ok(mdEdit.matches('skills/*/demo.html', 'skills/x/demo.html'));
  assert.ok(!mdEdit.matches('skills/*/demo.html', 'skills/x/y/demo.html'));
  assert.ok(mdEdit.matches('lib/', 'lib/kits/a.js'));
  assert.ok(!mdEdit.matches('lib', 'library.md'));
});

// ── After the save ──────────────────────────────────────────────────────────

test('check runs reduce to one state', () => {
  const r = (status, conclusion, name = 'n') => ({ status, conclusion, name });
  assert.deepEqual(mdEdit.summarize([]), { state: 'none' });
  assert.equal(mdEdit.summarize([r('completed', 'success'), r('in_progress', null)]).state, 'running');
  assert.deepEqual(mdEdit.summarize([r('completed', 'success'), r('completed', 'failure', 'test')]),
    { state: 'failed', names: ['test'] });
  assert.deepEqual(mdEdit.summarize([r('completed', 'success'), r('completed', 'skipped')]),
    { state: 'passed', total: 2 });
});

test('the review copy fences each side longer than any fence inside it', () => {
  const s = { ...sec('Second'), raw: '## Second\n\n```js\nx\n```' };
  const text = mdEdit.reviewText(s, '## Second\n\nNo code.', { repo: 'o/r', ref: 'main', path: 'docs/x.md' });
  assert.ok(text.startsWith(mdEdit.REVIEW));
  assert.match(text, /From o\/r@main:docs\/x\.md lines/);
  assert.match(text, /````markdown\n## Second\n\n```js/);
});

// ── md-doc's Edit row ───────────────────────────────────────────────────────

function rowsFor(o) {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  mdDoc.render(host, BODY, o);
  host.querySelector('.md-sec-menu').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const labels = [...window.document.body.querySelectorAll('.fixed button')].map(b => b.textContent);
  window.document.body.querySelectorAll('.fixed').forEach(m => m.remove());
  host.remove();
  return labels.join(' | ');
}

const ADDR = { repo: 'o/r', ref: 'main', path: 'docs/x.md' };

test('the Edit row appears where the host opted in at a branch with a token', () => {
  window.ghAuth = { resolve: () => 'tok' };
  assert.match(rowsFor({ addr: ADDR, edit: { full: FULL } }), /Edit section/);
});

test('no Edit row without the opt-in, at a commit, or with no token', () => {
  window.ghAuth = { resolve: () => 'tok' };
  assert.doesNotMatch(rowsFor({ addr: ADDR }), /Edit section/);
  assert.doesNotMatch(rowsFor({ addr: { ...ADDR, ref: 'a'.repeat(40) }, edit: { full: FULL } }), /Edit section/);
  window.ghAuth = { resolve: () => '' };
  assert.doesNotMatch(rowsFor({ addr: ADDR, edit: { full: FULL } }), /Edit section/);
});
