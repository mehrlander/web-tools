// The Tending view (lib/alpineComponents/tending.js), mounted against a stub
// registry: open findings under Attention with a question for the owner first,
// settled ones under Settled, a witness outside the subjects read as changed
// when it moved, and the two writes that differ by one field: Comment keeps a
// finding open, Handled closes it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const ROOTS = [
  { id: 'na', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget@claude/env-check',
    text: 'An environment report never reached main',
    finding: { kind: 'unreached', subjects: ['acme/widget@claude/env-check'], why: 'w', next: 'n',
               witnesses: [{ ref: 'acme/widget@claude/env-check', sha: 'aaaaaaa' },
                           { ref: 'acme/docs@main:docs/environment/capabilities.md', sha: 'bbbbbbb' }] } },
  { id: 'nb', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget#735',
    text: 'One question decides PR 735',
    finding: { kind: 'answer', subjects: ['acme/widget#735'], why: 'w', next: 'n', choice: 'Close it, since declarations replaced guessing?',
               witnesses: [{ ref: 'acme/widget#735', state: 'open', updated: '2026-09-19T00:00:00Z' }] } },
  { id: 'nc', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget#758',
    text: 'The Doc Craft PR already landed inside 762', finding: { kind: 'settled', subjects: ['acme/widget#758'], why: 'w', evidence: ['e'] } },
];

let store = ROOTS.map(n => JSON.stringify(n)).join('\n') + '\n';
const puts = [];
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
    if (path.startsWith('/repos/acme/widget/branches/')) return { commit: { sha: 'aaaaaaa999' } };
    if (path.startsWith('/repos/acme/docs/commits')) return [{ sha: 'cafef00d1234', commit: { message: 'capabilities: new proxy fact', committer: { date: '2026-10-02T00:00:00Z' } } }];
    if (path.startsWith('/repos/acme/widget/pulls/735')) return { state: 'open', merged_at: null, updated_at: '2026-09-19T00:00:00Z' };
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
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 5)); };
await settle();
const plain = (x) => JSON.parse(JSON.stringify(x));

test('Attention lists open findings with the owner\'s question first; Settled holds the rest', () => {
  assert.deepEqual(plain(data.attention.map(f => f.id)), ['nb', 'na']);
  assert.deepEqual(plain(data.settled.map(f => f.id)), ['nc']);
  assert.match(el.textContent, /Your call/);
  assert.match(el.textContent, /Close it, since declarations replaced guessing\?/);
});

test('a witness outside the subjects that moved marks the finding changed; holding witnesses do not', () => {
  const [a] = data.attention.filter(f => f.id === 'na');
  const changed = plain(data.changed(a));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].ref, 'acme/docs@main:docs/environment/capabilities.md');
  assert.match(changed[0].detail, /cafef00/);
  const [b] = data.attention.filter(f => f.id === 'nb');
  assert.equal(data.changed(b).length, 0);
  assert.match(el.textContent, /Changed since assessed/);
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

test('Handled writes a resolution, and the finding moves to Settled', async () => {
  const [a] = data.attention.filter(f => f.id === 'na');
  data.draft.na = 'Folded the four facts into capabilities.md';
  await data.resolve(a);
  const last = JSON.parse(puts.at(-1));
  assert.deepEqual(last.finding, { status: 'resolved' });
  assert.equal(data.attention.some(f => f.id === 'na'), false);
  assert.ok(data.settled.some(f => f.id === 'na' && f.status === 'resolved'));
});

test('Reopen brings a handled finding back', async () => {
  const [a] = data.settled.filter(f => f.id === 'na');
  await data.reopen(a);
  assert.ok(data.attention.some(f => f.id === 'na'));
});
