// alpineComponents/branch-brief.js — the branch page's Notes section: the
// notes about the branch, its files and its PRs, read from the registry's
// notes store, and a note added there addressed to the branch. What breaks
// without it: another branch's notes shown here, a PR's notes missing, or the
// section drawn for a reader who cannot reach the registry.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const tick = (n = 1) => new Promise(r => setTimeout(r, n * 10));
const REG = 'me/registry';
const NOTES = 'notes/notes.jsonl';
const seed = [
  { id: 'n1', at: '2026-09-01T00:00:00Z', author: 'claude/x', about: 'me/tools@feat/a', text: 'on the branch' },
  { id: 'n2', at: '2026-09-02T00:00:00Z', author: 'me', about: 'me/tools@feat/a:lib/x.js', text: 'on a file' },
  { id: 'n3', at: '2026-09-03T00:00:00Z', author: 'me', about: 'me/tools#443', text: 'on the PR' },
  { id: 'n4', at: '2026-09-04T00:00:00Z', author: 'me', about: 'note:n1', text: 'a reply' },
  { id: 'n5', at: '2026-09-05T00:00:00Z', author: 'me', about: 'me/tools@feat/ab', text: 'another branch' },
  { id: 'n6', at: '2026-09-06T00:00:00Z', author: 'me', about: 'me/tools#9', text: 'another PR' },
];
let FILE = { text: seed.map(n => JSON.stringify(n) + '\n').join(''), sha: 's0' };

const { window } = makeWindow({ html: '<!doctype html><html><body><div id="m"></div></body></html>' });
for (const f of ['lib/kits/branch-status.js', 'lib/kits/branch-brief.js', 'lib/kits/repo-address.js', 'lib/kits/notes.js'])
  new window.Function('window', readFileSync(path.join(repoRoot, f), 'utf8'))(window);

class FakeGH {
  static FRESH = { cache: 'no-store' };
  static toBase64 = (s) => Buffer.from(s).toString('base64');
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || ''; }
  async compare() { return { ahead_by: 1, behind_by: 0, total_commits: 1, commits: [], files: [] }; }
  async req(p, opts) {
    if (p === '/user') return { login: 'me' };
    if (p === 'contents/' + NOTES && opts?.method === 'PUT') {
      const body = JSON.parse(opts.body);
      if (body.sha !== FILE.sha) throw Object.assign(new Error('409'), { status: 409 });
      FILE = { text: Buffer.from(body.content, 'base64').toString(), sha: FILE.sha + '+' };
      return { content: { sha: FILE.sha } };
    }
    if (/^git\/trees\//.test(p)) return { truncated: false, tree: [] };
    return /head=me%3Afeat%2Fa|head=me:feat\/a/.test(p) ? [{ number: 443, title: 'A', state: 'open', body: 'a' }] : [];
  }
  async get(p) {
    if (this.repo === REG && p === NOTES) return { ...FILE };
    throw Object.assign(new Error('404'), { status: 404 });
  }
}
window.GH = FakeGH;
window.__shell = { REGISTRY_REPO: REG };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
const { default: collapse } = await import('@alpinejs/collapse/dist/module.esm.js');
window.Alpine = Alpine;
Alpine.plugin(collapse);
for (const p of ['lib/alpine-bundle.js', 'lib/alpineComponents/file-review.js', 'lib/alpineComponents/branch-brief.js'])
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
Alpine.start();
await tick(2);

const mount = async () => {
  const host = window.document.getElementById('m');
  host.innerHTML = '';
  window.__opts = { repo: 'me/tools', base: 'main', branch: 'feat/a', framed: true,
                    facts: { ahead: 1, behind: 0, sessions: [] } };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'branchBrief(window.__opts)');
  host.append(el);
  Alpine.initTree(el);
  await tick(8);
  return Alpine.$data(el);
};

test('without a token there is no Notes section', async () => {
  window.TOKEN = '';
  const d = await mount();
  assert.equal(d.notesOn, false);
  assert.equal(window.document.querySelector('[data-notes-section]'), null);
});

test('the branch, its files and its PR show, with the reply under its note; neighbours do not', async () => {
  window.TOKEN = 'tkn';
  window.BranchBrief.forget();
  const d = await mount();
  assert.equal(d.noteRows.map(n => n.id + n.depth).join(' '), 'n30 n20 n10 n41');
  assert.ok(window.document.querySelector('[data-notes-section]'));
});

test('a note added on the page is about the branch, and is appended rather than saved over', async () => {
  window.TOKEN = 'tkn';
  window.BranchBrief.forget();
  const d = await mount();
  d.noteDraft = 'ready for review';
  await d.addNote();
  const lines = FILE.text.trim().split('\n');
  assert.equal(lines.length, seed.length + 1);
  const last = JSON.parse(lines.at(-1));
  assert.equal(last.about, 'me/tools@feat/a');
  assert.equal(last.author, 'me');
  assert.equal(d.noteDraft, '');
  assert.ok(d.noteRows.some(n => n.text === 'ready for review'));
});
