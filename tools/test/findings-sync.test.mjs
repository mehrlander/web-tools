// Activity and the Tending view mounted on one page: a resolution or a
// reopening written in Tending reaches Activity's finding lines and card
// counts without a reload, through the notes kit's notes:changed event.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const ROOT = { id: 'nf', at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: 'acme/widget@claude/env-check',
  text: 'An environment report never reached main',
  finding: { kind: 'unreached', subjects: ['acme/widget@claude/env-check'], why: 'w', next: 'Fold the facts in.' } };
let store = JSON.stringify(ROOT) + '\n';

class StubGH {
  static toBase64(s) { return Buffer.from(s, 'utf8').toString('base64'); }
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async get(path) {
    if (path === 'notes/notes.jsonl' && this.repo === 'me/registry') return { text: store, sha: 's' + store.length };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async ls() { throw Object.assign(new Error('404'), { status: 404 }); }
  async req(path, opts = {}) {
    if (path === '/user') return { login: 'mehrlander' };
    if (opts.method === 'PUT') {
      store = Buffer.from(JSON.parse(opts.body).content, 'base64').toString('utf8');
      return { content: { sha: 's' + store.length } };
    }
    return { default_branch: 'main', description: '', private: true, pushed_at: '' };
  }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div><div id="t" x-data="tending()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = StubGH;
window.__shell = { REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools', quickLinks: [], hasToken: () => true,
                   _authState: 'auth', tendingTab: '', tendingItem: '', tendingRepo: '', goTending() {} };
const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js', 'lib/kits/branch-status.js', 'lib/kits/surface.js',
  'lib/kits/notes.js', 'lib/kits/findings.js',
  'lib/alpineComponents/estate.js', 'lib/alpineComponents/tending.js',
]);
const activity = Alpine.$data(window.document.getElementById('es'));
const tending = Alpine.$data(window.document.getElementById('t'));
for (let i = 0; i < 40 && (tending.loading || !tending.notes.length); i++) await new Promise(r => setTimeout(r, 5));
activity.activity = { 'acme/widget': { defaultBranch: 'main', openPRs: [], branchPRs: [], prReach: '',
  scan: { branches: [{ name: 'claude/env-check', group: 'active', date: '2026-09-08T15:33:21Z' }] } } };
activity.noteItems = window.Notes.parse(store);
const row = () => activity.allBranchRows.find(r => r.name === 'claude/env-check');

test('a resolution written in Tending leaves Activity\'s row and card at once', async () => {
  assert.equal(activity.rowFindings(row()).length, 1);
  assert.equal(activity.cardFindings('acme/widget'), 1);
  await tending.resolve(tending.findings.find(f => f.id === 'nf'));
  assert.equal(activity.rowFindings(row()).length, 0);
  assert.equal(activity.cardFindings('acme/widget'), 0);
});

test('a reopening written in Tending puts it back', async () => {
  await tending.reopen(tending.findings.find(f => f.id === 'nf'));
  assert.equal(activity.rowFindings(row()).length, 1);
  assert.equal(activity.cardFindings('acme/widget'), 1);
});
