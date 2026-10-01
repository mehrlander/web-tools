// Findings beside their subjects: what a tending pass concluded, on the
// Activity rows and Repos cards it concerns.
//
// These replaced a mechanical alert (2026-09-30 to 2026-10-01, "the session
// said done, the branch never had a pull request") that any note newer than
// the branch's last commit cleared. Two things changed and both are held here:
// a row shows a FINDING, written by a tending pass with its reasons, rather
// than a rule's verdict; and a plain note on the branch leaves it in place.
// Only a reply carrying `finding` (a reassessment, or the owner's Handled in
// the Tending view) takes it off the row.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

class StubGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async get() { throw new Error('404'); }
  async ls() { throw new Error('404'); }
  async req() { return { default_branch: 'main', description: '', private: true, pushed_at: '' }; }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = StubGH;
const went = [];
window.__shell = { REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools',
                   quickLinks: [], hasToken: () => true, _authState: 'auth',
                   goTending: (o) => went.push(o) };

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/branch-status.js',
  'lib/kits/surface.js',
  'lib/kits/notes.js',
  'lib/kits/findings.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));
const plain = (x) => JSON.parse(JSON.stringify(x));

const DATE = '2026-09-08T15:33:21Z';
const OTHER_PR = { head: 'claude/unrelated', number: 1, state: 'merged', draft: false, count: 1 };
const finding = (id, subjects, extra = {}) => ({
  id, at: '2026-10-01T00:00:00Z', author: 'claude/tend', about: subjects[0], text: 'Finding ' + id,
  finding: { kind: 'unreached', subjects, why: 'w', next: 'n', ...extra },
});
const seed = ({ branches = [], branchPRs = [], openPRs = [], notes = [] }) => {
  data.activity = { 'acme/widget': {
    defaultBranch: 'main', openPRs, branchPRs: [...branchPRs, OTHER_PR], prReach: '', scan: { branches },
  } };
  data.noteItems = notes;
  data.branchScope = 'all';
};
const row = (name) => data.allBranchRows.find(r => r.name === name);

test('a finding shows on the row of the branch it names, and on no other', () => {
  seed({
    branches: [{ name: 'claude/env-check', group: 'active', date: DATE }, { name: 'claude/other', group: 'active', date: DATE }],
    notes: [finding('n1', ['acme/widget@claude/env-check'])],
  });
  assert.deepEqual(plain(data.rowFindings(row('claude/env-check')).map(f => f.id)), ['n1']);
  assert.equal(data.rowFindings(row('claude/other')).length, 0);
});

test('a finding about a pull request shows on the row of the branch it heads', () => {
  seed({
    branches: [{ name: 'gemini/doc-craft', group: 'active', date: DATE }],
    openPRs: [{ head: 'gemini/doc-craft', number: 758, title: 'Doc craft', draft: false }],
    notes: [finding('n2', ['acme/widget#758'], { kind: 'superseded', next: '', evidence: ['in 762'] })],
  });
  // A finding with nothing left to do is settled, so it leaves the row.
  assert.equal(data.rowFindings(row('gemini/doc-craft')).length, 0);
  seed({
    branches: [{ name: 'gemini/doc-craft', group: 'active', date: DATE }],
    openPRs: [{ head: 'gemini/doc-craft', number: 758, title: 'Doc craft', draft: false }],
    notes: [finding('n2b', ['acme/widget#758'], { kind: 'superseded', next: 'Close 758.', evidence: ['in 762'] })],
  });
  // Overtaken with a step left is still work, so it stays on the row.
  assert.equal(data.rowFindings(row('gemini/doc-craft')).length, 1);
  seed({
    branches: [{ name: 'gemini/doc-craft', group: 'active', date: DATE }],
    openPRs: [{ head: 'gemini/doc-craft', number: 758, title: 'Doc craft', draft: false }],
    notes: [finding('n3', ['acme/widget#758'])],
  });
  assert.equal(data.rowFindings(row('gemini/doc-craft')).length, 1);
});

test('a plain note on the branch leaves the finding in place; a resolution removes it', () => {
  const f = finding('n4', ['acme/widget@claude/env-check']);
  const branches = [{ name: 'claude/env-check', group: 'active', date: DATE }];
  const later = { id: 'nplain', at: '2026-10-05T00:00:00Z', author: 'me', about: 'acme/widget@claude/env-check', text: 'looked at it' };
  const comment = { id: 'ncom', at: '2026-10-05T00:00:00Z', author: 'me', about: 'note:n4', text: 'agree' };
  seed({ branches, notes: [f, later, comment] });
  assert.equal(data.rowFindings(row('claude/env-check')).length, 1);
  const handled = { id: 'nres', at: '2026-10-06T00:00:00Z', author: 'me', about: 'note:n4', text: 'folded in', finding: { status: 'resolved' } };
  seed({ branches, notes: [f, later, comment, handled] });
  assert.equal(data.rowFindings(row('claude/env-check')).length, 0);
});

test('the Findings scope, the card count and the card tap agree', () => {
  seed({
    branches: [{ name: 'claude/a', group: 'active', date: DATE }, { name: 'claude/b', group: 'stranded', date: DATE },
               { name: 'claude/c', group: 'landed', date: DATE }],
    notes: [finding('n5', ['acme/widget@claude/a']), finding('n6', ['acme/widget@claude/b', 'acme/widget:docs/SNAGS.md#a-trap']),
            finding('n7', ['acme/widget:tracker/tasks/fix-it.md'])],
  });
  assert.equal(data.branchScopes.find(s => s.key === 'found').count, 2);
  // The card counts every open finding touching the repo, a task's as well as a branch's.
  assert.equal(data.cardFindings('acme/widget'), 3);
  assert.equal(data.cardFindings('acme/other'), 0);
  data.openRepoFindings('acme/widget');
  assert.deepEqual(plain(went.at(-1)), { repo: 'acme/widget' });
  data.openFinding({ id: 'n5' });
  assert.deepEqual(plain(went.at(-1)), { item: 'n5' });
});

test('a finding naming a session record shows on that session', () => {
  seed({ notes: [finding('n8', ['me/registry:sessions/2026/09/2026-09-29-01895c91.json'])] });
  assert.equal(data.sessionFindings({ id: '01895c91', day: '2026-09-29' }).length, 1);
  assert.equal(data.sessionFindings({ id: 'ffffffff', day: '2026-09-29' }).length, 0);
});

test('the notes store loads for every pane that shows findings', () => {
  for (const tab of ['repos', 'branches', 'sessions', 'lists']) assert.equal(data.paneNeeds(tab).notes, true, tab);
  assert.equal(data.paneNeeds('stage').notes, false);
});
