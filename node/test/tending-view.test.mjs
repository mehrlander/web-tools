// The Tending view (lib/alpineComponents/tending.js) mounted against a stub
// registry: it lists open and settled findings from the notes store, writes
// the owner's actions back as notes, and reads nothing else from GitHub.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const ROOTS = [
  { id: 'na', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget@claude/env-check',
    text: 'An environment report never reached main',
    finding: { kind: 'unreached', subjects: ['acme/widget@claude/env-check'], why: 'w', next: 'Fold the four facts in.' } },
  { id: 'nb', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget#735',
    text: 'One decision settles PR 735',
    finding: { kind: 'answer', subjects: ['acme/widget#735', 'me/registry:user-calls/5f95d663-close-735.json'], why: 'w',
               next: 'Close 735 once the user call says to.' } },
  { id: 'nc', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget#758',
    text: 'The Doc Craft PR already landed inside 762',
    finding: { kind: 'superseded', subjects: ['acme/widget#758'], why: 'w', next: 'Close 758 with a pointer to 762.', evidence: ['e'] } },
  { id: 'nd', at: '2026-10-01T01:00:00Z', author: 'claude/tend', about: 'acme/widget@codex/empty',
    text: 'An empty branch cut from main',
    // A record from before witnesses were retired: the view ignores the field.
    finding: { kind: 'superseded', subjects: ['acme/widget@codex/empty'], why: 'w', evidence: ['e'],
               witnesses: [{ ref: 'acme/widget@main', contains: '106f31c' }] } },
  { id: 'ne', at: '2026-10-01T02:00:00Z', author: 'claude/tend', about: 'acme/widget@claude/landed',
    text: 'A branch whose content landed',
    finding: { kind: 'superseded', subjects: ['acme/widget@claude/landed'], why: 'w', evidence: ['e'] } },
  { id: 'nf', at: '2026-10-01T03:00:00Z', author: 'claude/tend', about: 'acme/widget#9',
    text: 'A pull request recorded closed',
    finding: { kind: 'superseded', subjects: ['acme/widget#9'], why: 'w', evidence: ['e'] } },
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
const settle = async () => { for (let i = 0; i < 40 && data.loading; i++) await new Promise(r => setTimeout(r, 5)); await new Promise(r => setTimeout(r, 20)); };
await settle();
const plain = (x) => JSON.parse(JSON.stringify(x));
const ids = (fs) => plain(fs.map(f => f.id));

test('Open holds the open findings; Settled holds the rest', () => {
  assert.equal(data.attention[0].id, 'nb', 'a decision waiting in a user call leads, by kind');
  assert.deepEqual(ids(data.attention).sort(), ['na', 'nb', 'nc']);
  assert.deepEqual(ids(data.settled).sort(), ['nd', 'ne', 'nf']);
  assert.doesNotMatch(el.textContent, /Your call/, 'the view asks nothing itself');
  const call = [...el.querySelectorAll('a')].find(a => a.textContent.includes('user call close-735'));
  assert.equal(call.getAttribute('href'), '../pages/user-call.html#src=me/registry:user-calls/5f95d663-close-735.json');
});

test('an overtaken finding with a step left shows the step on the row, unopened', () => {
  assert.equal(data.open.nc, undefined);
  assert.match(el.textContent, /Close 758 with a pointer to 762\./);
  const [c] = data.attention.filter(f => f.id === 'nc');
  assert.equal(c.open, true);
  assert.equal(c.outstanding, true);
});

test('the view reads nothing from GitHub but the store', () => {
  assert.deepEqual(asked, []);
  const [d] = data.settled.filter(f => f.id === 'nd');
  assert.equal('witnesses' in d, false);
  assert.equal(data.closedLine(d), 'Nothing left to do');
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

test('a reopening written elsewhere on the page reaches the view without a reload', async () => {
  assert.ok(data.settled.some(f => f.id === 'nc') || data.attention.some(f => f.id === 'nc'));
  await data.resolve(data.findings.find(f => f.id === 'nc'));
  assert.ok(data.settled.some(f => f.id === 'nc'));
  await window.Notes.append(new StubGH({ repo: 'me/registry' }), window.Findings.reopening('nc', 'Not yet', 'mehrlander'));
  assert.ok(data.attention.some(f => f.id === 'nc'));
});
