// What waits on the owner (lib/kits/user-calls.js). The fixture is a store
// with four user calls (one answered, one closed, two open, one of them a
// documentation call), home's Text collection with four proposals, and the
// document three of them name. Of those three, one is pending as Dictate
// would stage it (one block the file still holds), one spans two blocks and
// so is never staged, and one was applied long ago; the fourth names a file
// that cannot be read. What is under test: which calls are open, what counts
// as pending, the per-file fold, and the links.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow } from './bootstrap.mjs';

const sha = (s) => createHash('sha256').update(s.trim(), 'utf8').digest('hex');
const DOC = '# Title\n\nKept as it is.\n\nFirst of a run.\n\nSecond of the run.\n\nTail.\n';
const STORE = 'mehrlander/web-tools-private';
const CALLS = {
  'a1-doc.json': { schema: 'user-call/1', id: 'a1-doc', kind: 'documentation', status: 'open', created: '2026-10-04T02:00:00Z',
                   question: 'Apply 1 edit to docs/x.md?', file: 'mehrlander/web-tools@dev:docs/x.md',
                   edits: [{ from: 'Kept as it is.', to: 'Kept.', why: 'shorter' }] },
  'a1-merge.json': { schema: 'user-call/1', id: 'a1-merge', kind: 'merge', status: 'open', created: '2026-10-04T01:00:00Z', question: 'Merge #9?' },
  'a1-done.json': { schema: 'user-call/1', id: 'a1-done', kind: 'decision', status: 'open', created: '2026-10-04T03:00:00Z', question: 'Done?' },
  'a1-closed.json': { schema: 'user-call/1', id: 'a1-closed', kind: 'decision', status: 'closed', created: '2026-10-04T04:00:00Z', question: 'Old?' },
};
const PAIRS = [
  ['Kept as it is.', 'Kept.', 'docs/x.md', 'https://github.com/mehrlander/web-tools/pull/1'],
  ['First of a run.\n\nSecond of the run.', 'One.', 'docs/x.md', 'https://github.com/mehrlander/web-tools/pull/2'],
  ['Applied long ago.', 'Gone.', 'docs/x.md', 'https://github.com/mehrlander/web-tools/pull/3'],
  ['Anything.', 'Else.', 'docs/missing.md', 'https://github.com/mehrlander/web-tools/pull/4'],
];
const TEXTS = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];
const FILES = {
  [STORE + ':user-calls/a1-done.answers.jsonl']: JSON.stringify({ answer: 'Yes', at: 't' }) + '\n',
  'mehrlander/home:projects/text/passages.jsonl': TEXTS.map((t) => JSON.stringify({ id: sha(t), text: t })).join('\n') + '\n',
  'mehrlander/home:projects/text/variants.jsonl': PAIRS.map(([a, b]) =>
    JSON.stringify({ from: sha(a), to: sha(b), author: 'Claude', purpose: 'update' })).join('\n') + '\n',
  'mehrlander/home:projects/text/proposals.jsonl': PAIRS.map(([a, b, p, basis]) =>
    JSON.stringify({ from: sha(a), to: sha(b), repo: 'mehrlander/web-tools', path: p, basis })).join('\n') + '\n',
  'mehrlander/web-tools:docs/x.md': DOC,
};
for (const [n, c] of Object.entries(CALLS)) FILES[STORE + ':user-calls/' + n] = JSON.stringify(c);

class FakeGH {
  static FRESH = { cache: 'no-store' };
  static refFor() { return window.__ref || null; }
  constructor(o) { this.repo = o.repo; this.ref = o.ref || 'main'; }
  async ls(dir) {
    const pre = this.repo + ':' + dir + '/';
    const names = Object.keys(FILES).filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length));
    if (!names.length) throw Object.assign(new Error('404'), { status: 404 });
    return [...names, 'user-call.py'].map((name) => ({ name, type: 'file' }));
  }
  async get(p) {
    const t = FILES[this.repo + ':' + p];
    if (t == null) throw Object.assign(new Error('404'), { status: 404 });
    return { text: t, sha: sha(t), size: t.length, path: p };
  }
}
const { window } = makeWindow();
if (!window.crypto?.subtle) Object.defineProperty(window, 'crypto', { value: webcrypto });
Object.assign(window, { GH: FakeGH, TOKEN: 't' });
for (const kit of ['csv.js', 'text-collection.js', 'md-diff.js', 'md-variants.js', 'user-calls.js'])
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
const U = window.UserCalls;

test('a call is open while its status is open and no answer has come back; newest first', async () => {
  const all = await U.list();
  assert.deepEqual(all.map((c) => c.id), ['a1-closed', 'a1-done', 'a1-doc', 'a1-merge']);
  assert.deepEqual(all.filter((c) => c.open).map((c) => c.id), ['a1-doc', 'a1-merge']);
  assert.equal(all.find((c) => c.id === 'a1-done').answers[0].answer, 'Yes');
});

test('a proposal counts only as Dictate would stage it: one block the file still holds', async () => {
  const by = await U.pendingEdits();
  const x = by.get('mehrlander/web-tools:docs/x.md');
  assert.equal(x.staged, 1, 'the two-block one is never staged, and the applied one is gone');
  assert.deepEqual(x.bases, ['https://github.com/mehrlander/web-tools/pull/1'], 'the bases are the staged ones only');
  assert.deepEqual(x.items, [{ from: 'Kept as it is.', to: 'Kept.', author: 'Claude', purpose: 'update',
    basis: 'https://github.com/mehrlander/web-tools/pull/1' }], 'each staged block carries its text as it stands and as proposed');
  assert.deepEqual(x.calls.map((c) => c.id), ['a1-doc'], 'the open documentation call is filed under its document, ref dropped');
  assert.equal(by.has('mehrlander/web-tools:docs/missing.md'), false, 'a file that cannot be read holds nothing');
});

test('links: a call answered in Dictate, the others on the call page, at the version the page runs at', () => {
  const doc = { kind: 'documentation', file: 'mehrlander/web-tools@dev:docs/x.md', _repo: STORE, _ref: 'main', _path: 'user-calls/a1-doc.json' };
  const merge = { kind: 'merge', _repo: STORE, _ref: 'main', _path: 'user-calls/a1-merge.json' };
  assert.equal(U.href(doc), 'https://mehrlander.github.io/web-tools/pages/dictate.html?file=mehrlander/web-tools:docs/x.md'
    + '&user-call=' + STORE + ':user-calls/a1-doc.json');
  assert.equal(U.href(merge), 'https://mehrlander.github.io/web-tools/pages/user-call.html#src=' + STORE + ':user-calls/a1-merge.json');
  assert.equal(U.dictateHref({ file: 'mehrlander/web-tools:docs/x.md', proposed: true }),
    'https://mehrlander.github.io/web-tools/pages/dictate.html?file=mehrlander/web-tools:docs/x.md&proposed');
  window.__ref = 'claude/x';
  assert.equal(U.dictateHref({ file: 'mehrlander/web-tools:docs/x.md', proposed: true }),
    'https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/x:pages/dictate.html?file=mehrlander/web-tools:docs/x.md&proposed');
  window.__ref = null;
});
