// The Tending view (lib/alpineComponents/tending.js), mounted against a stub
// registry and a stub GitHub API, so the component's own observe() runs: the
// requests it makes are the ones a phone makes, and their answers go through
// the kit's compare().
//
// What it holds:
//   Attention keeps every finding with work outstanding, whatever its kind, and
//   the outstanding step is on the row without a tap;
//   a settled finding whose evidence moved comes back to Attention;
//   a file is compared by its pinned object, read through its parent folder's
//   listing, so a change made before the finding was recorded still shows;
//   Comment keeps a finding open, Handled closes it, Reopen brings it back.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const ROOTS = [
  { id: 'na', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget@claude/env-check',
    text: 'An environment report never reached main',
    finding: { kind: 'unreached', subjects: ['acme/widget@claude/env-check'], why: 'w', next: 'Fold the four facts in.',
               witnesses: [{ ref: 'acme/widget@claude/env-check', sha: 'aaaaaaa' },
                           { ref: 'acme/docs@main:docs/environment/capabilities.md', sha: 'bbbbbbb' }] } },
  { id: 'nb', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget#735',
    text: 'One question decides PR 735',
    finding: { kind: 'answer', subjects: ['acme/widget#735'], why: 'w', next: 'n', choice: 'Close it, since declarations replaced guessing?',
               witnesses: [{ ref: 'acme/widget#735', state: 'open', updated: '2026-09-19T00:00:00Z' }] } },
  { id: 'nc', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget#758',
    text: 'The Doc Craft PR already landed inside 762',
    finding: { kind: 'superseded', subjects: ['acme/widget#758'], why: 'w', next: 'Close 758 with a pointer to 762.', evidence: ['e'] } },
  { id: 'nd', at: '2026-10-01T01:00:00Z', author: 'claude/tend', about: 'acme/widget@codex/empty',
    text: 'An empty branch cut from main',
    finding: { kind: 'superseded', subjects: ['acme/widget@codex/empty'], why: 'w', evidence: ['e'],
               witnesses: [{ ref: 'acme/widget@main', contains: '106f31c' }] } },
  { id: 'ne', at: '2026-10-01T02:00:00Z', author: 'claude/tend', about: 'acme/widget@claude/landed',
    text: 'A branch whose content landed',
    finding: { kind: 'superseded', subjects: ['acme/widget@claude/landed'], why: 'w', evidence: ['e'],
               witnesses: [{ ref: 'acme/widget@main:docs/kept.md', sha: '1111111' }] } },
];

let store = ROOTS.map(n => JSON.stringify(n)).join('\n') + '\n';
const puts = [], asked = [];
class StubGH {
  static toBase64(s) { return Buffer.from(s, 'utf8').toString('base64'); }
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  async get() { return { text: store, sha: 's' + store.length }; }
  async req(path, opts = {}) {
    if (path === '/user') return { login: 'mehrlander' };
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      store = Buffer.from(body.content, 'base64').toString('utf8');
      puts.push(store.trim().split('\n').at(-1));
      return { content: { sha: 's' + store.length } };
    }
    asked.push(path);
    const answers = {
      '/repos/acme/widget/branches/claude%2Fenv-check': { commit: { sha: 'aaaaaaa999' } },
      // The pinned object was bbbbbbb; the folder now lists cafef00d for it.
      '/repos/acme/docs/contents/docs/environment?ref=main': [{ name: 'capabilities.md', type: 'file', sha: 'cafef00d1234' }, { name: 'testing.md', type: 'file', sha: '9999999' }],
      '/repos/acme/docs/commits?sha=main&path=docs%2Fenvironment%2Fcapabilities.md&per_page=1': [{ sha: 'cafef00d1234', commit: { message: 'capabilities: new proxy fact' } }],
      '/repos/acme/widget/pulls/735': { state: 'open', merged_at: null, updated_at: '2026-09-19T00:00:00Z' },
      // main no longer contains the commit (a rewrite): the settled finding's ground moved.
      '/repos/acme/widget/compare/106f31c...main': { status: 'diverged', ahead_by: 3, behind_by: 1 },
      '/repos/acme/widget/contents/docs?ref=main': [{ name: 'kept.md', type: 'file', sha: '1111111aaaa' }],
    };
    if (path in answers) return answers[path];
    throw Object.assign(new Error('unexpected ' + path), { status: 404 });
  }
}

const { window } = makeWindow({ html: `<!doctype html><html><body><div id="t" x-data="tending()"></div></body></html>` });
window.TOKEN = 'tkn';
window.GH = StubGH;
window.__shell = { REGISTRY_REPO: 'me/registry', hasToken: () => true, tendingTab: '', tendingItem: '', tendingRepo: '',
                   goTending(o = {}) { this.tendingTab = o.tab || ''; } };
const Alpine = await startAlpine(window, ['lib/alpine-bundle.js', 'lib/kits/notes.js', 'lib/kits/findings.js', 'lib/alpineComponents/tending.js']);
const el = window.document.getElementById('t');
const data = Alpine.$data(el);
const settle = async () => { for (let i = 0; i < 40 && (data.loading || data.checking); i++) await new Promise(r => setTimeout(r, 5)); await new Promise(r => setTimeout(r, 20)); };
await settle();
const plain = (x) => JSON.parse(JSON.stringify(x));
const ids = (fs) => plain(fs.map(f => f.id));

test('Attention holds outstanding work and changed settled findings; Settled holds the rest', () => {
  assert.equal(data.attention[0].id, 'nb', 'the owner\'s question first');
  assert.deepEqual(ids(data.attention).sort(), ['na', 'nb', 'nc', 'nd']);
  assert.deepEqual(ids(data.settled), ['ne']);
  assert.match(el.textContent, /Your call/);
});

test('an overtaken finding with a step left shows the step on the row, unopened', () => {
  assert.equal(data.open.nc, undefined);
  assert.match(el.textContent, /Close 758 with a pointer to 762\./);
  const [c] = data.attention.filter(f => f.id === 'nc');
  assert.equal(c.open, true);
  assert.equal(c.outstanding, true);
});

test('a file changed before the finding was recorded reads as changed, through its folder listing', () => {
  const [a] = data.attention.filter(f => f.id === 'na');
  const changed = plain(data.changed(a));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].ref, 'acme/docs@main:docs/environment/capabilities.md');
  assert.match(changed[0].detail, /cafef00/);
  assert.match(changed[0].detail, /new proxy fact/);
  assert.ok(asked.includes('/repos/acme/docs/contents/docs/environment?ref=main'), 'read through the parent listing');
  assert.ok(!asked.some(p => p.includes('since=')), 'a pinned witness is never read as commits since a date');
  assert.match(el.textContent, /Changed since assessed/);
});

test('a settled finding whose ground moved comes back, saying so; a holding one stays settled', () => {
  const [d] = data.attention.filter(f => f.id === 'nd');
  assert.equal(d.open, false);
  assert.match(plain(data.changed(d))[0].detail, /no longer contains 106f31c/);
  assert.match(el.textContent, /Settled, but changed since/);
  const [e] = data.settled;
  assert.equal(data.closedLine(e), 'Nothing left to do');
});

test('Comment writes a reply without finding, and the finding stays open', async () => {
  const [a] = data.attention.filter(f => f.id === 'na');
  data.draft.na = 'Worth a look this week';
  await data.comment(a);
  const last = JSON.parse(puts.at(-1));
  assert.equal(last.about, 'note:na');
  assert.equal('finding' in last, false);
  assert.ok(data.attention.some(f => f.id === 'na'));
});

test('Handled writes a resolution, and the finding moves to Settled with the owner\'s words', async () => {
  // Handled on a finding with no moved witness, so nothing pulls it back.
  const [c] = data.attention.filter(f => f.id === 'nc');
  data.draft.nc = 'Closed 758';
  await data.resolve(c);
  const last = JSON.parse(puts.at(-1));
  assert.deepEqual(last.finding, { status: 'resolved' });
  assert.equal(data.attention.some(f => f.id === 'nc'), false);
  const [s] = data.settled.filter(f => f.id === 'nc');
  assert.match(data.closedLine(s), /^Handled \d{4}-\d\d-\d\d: Closed 758$/);
});

test('Reopen brings a handled finding back', async () => {
  const [c] = data.settled.filter(f => f.id === 'nc');
  await data.reopen(c);
  assert.ok(data.attention.some(f => f.id === 'nc'));
});
