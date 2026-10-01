// Worth checking: a session that said it was finished, and a branch that says
// otherwise.
//
// The 2026-09-30 census of four repos found 99 branches holding content the
// default branch lacked, and exactly two sessions with real undecided work.
// Both had ended on a finished closing state while their branch never reached
// main. estate.js raises that disagreement as an alert: a badge on the row, a
// To check scope, and a count on the repo card, all from one rule
// (branchAlert). A note on the branch written after its last commit clears it.

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
window.__shell = { REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools',
                   quickLinks: [], hasToken: () => true, _authState: 'auth' };

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/branch-status.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));

const SESS = (id) => `https://claude.ai/code/session_${id}`;
const DATE = '2026-09-08T15:33:21Z';

// One repo's branches and PR index, the session records behind them, and the
// notes store. The PR index is uncapped (reach '') and never empty, since an
// empty index speaks for no branch and every row would read "not known".
const OTHER_PR = { head: 'claude/unrelated', number: 1, state: 'merged', draft: false, count: 1 };
const seed = ({ branches = [], branchPRs = [], sessions = [], notes = [] }) => {
  data.activity = { 'acme/widget': {
    defaultBranch: 'main', openPRs: [], branchPRs: [...branchPRs, OTHER_PR], prReach: '', scan: { branches },
  } };
  data.sessionRows_ = sessions;
  data.noteItems = notes;
  data.branchScope = 'all';
};
const row = (name) => data.allBranchRows.find(r => r.name === name);
const rec = (id, state, branch) => ({ agent: SESS(id), state, repos: [{ name: 'widget', branch }] });

test('a session that said done, on a branch that never had a PR, raises an alert', () => {
  seed({
    branches: [{ name: 'claude/stranded', group: 'stranded', date: DATE, session: SESS('A') }],
    sessions: [rec('A', 'pending', 'claude/other'), rec('B', 'merged', 'claude/x')],
  });
  // Pending is not a claim of being finished, so nothing yet.
  assert.equal(data.branchAlert(row('claude/stranded')), null);
  seed({
    branches: [{ name: 'claude/stranded', group: 'stranded', date: DATE, session: SESS('A') }],
    sessions: [rec('A', 'done', 'claude/stranded')],
  });
  const a = data.branchAlert(row('claude/stranded'));
  assert.equal(a.kind, 'said-done');
  assert.match(a.text, /ended done, but the branch never had a pull request/);
});

test('the record is found by branch name when the commits name no session', () => {
  seed({
    branches: [{ name: 'claude/no-trailer', group: 'active', date: DATE }],
    sessions: [rec('C', 'merged', 'claude/no-trailer')],
  });
  assert.ok(data.branchAlert(row('claude/no-trailer')));
});

test('a session read only off the branch tip is not the branch\'s session', () => {
  // The 2026-10-01 false positive: a branch cut from main and never committed
  // to, whose tip is a squash merge carrying another session's trailer.
  const record = rec('Z', 'done', 'claude/somewhere-else');
  seed({
    branches: [{ name: 'codex/cut-from-main', group: 'active', date: DATE,
                 sessions: [SESS('Z')], sessionsExact: false }],
    sessions: [record],
  });
  assert.equal(data.branchAlert(row('codex/cut-from-main')), null);
  // The same session named by a compare's unique commits is the branch's own.
  seed({
    branches: [{ name: 'codex/cut-from-main', group: 'active', date: DATE,
                 sessions: [SESS('Z')], sessionsExact: true }],
    sessions: [record],
  });
  assert.ok(data.branchAlert(row('codex/cut-from-main')));
});

test('a closed PR is a decision and an open one is work in flight: neither alerts', () => {
  seed({
    branches: [{ name: 'claude/closed', group: 'stranded', date: DATE },
               { name: 'claude/open', group: 'stranded', date: DATE }],
    branchPRs: [{ head: 'claude/closed', number: 41, state: 'closed', draft: false, count: 1 },
                { head: 'claude/open', number: 42, state: 'open', draft: true, count: 1 }],
    sessions: [rec('D', 'clean', 'claude/closed'), rec('E', 'done', 'claude/open')],
  });
  assert.equal(data.branchAlert(row('claude/closed')), null);
  assert.equal(data.branchAlert(row('claude/open')), null);
});

test('a merged PR raises nothing, even where the scan calls the branch stranded', () => {
  // The scan's stranded verdict counts files main later moved or retired, and
  // read as an alert it flagged 52 branches on the live cache, nearly all
  // false. Only "never had a pull request" is precise enough to alert on.
  seed({
    branches: [{ name: 'claude/merged-clean', group: 'active', date: DATE },
               { name: 'claude/merged-left', group: 'stranded', date: DATE }],
    branchPRs: [{ head: 'claude/merged-clean', number: 50, state: 'merged', draft: false, count: 1 },
                { head: 'claude/merged-left', number: 51, state: 'merged', draft: false, count: 1 }],
    sessions: [rec('F', 'merged', 'claude/merged-clean'), rec('G', 'merged', 'claude/merged-left')],
  });
  assert.equal(data.branchAlert(row('claude/merged-clean')), null);
  assert.equal(data.branchAlert(row('claude/merged-left')), null);
});

test('past the PR index reach "no PR" is not known, so nothing is raised', () => {
  data.activity = { 'acme/widget': {
    defaultBranch: 'main', openPRs: [], branchPRs: [OTHER_PR], prReach: '2026-09-13T00:00:00Z',
    scan: { branches: [{ name: 'claude/old', group: 'stranded', date: DATE }] },
  } };
  data.sessionRows_ = [rec('A', 'done', 'claude/old')];
  data.noteItems = [];
  assert.equal(data.branchState(row('claude/old')), 'unknown');
  assert.equal(data.branchAlert(row('claude/old')), null);
});

test('a landed branch with no PR raises nothing', () => {
  seed({
    branches: [{ name: 'claude/landed', group: 'landed', date: DATE }],
    sessions: [rec('H', 'done', 'claude/landed')],
  });
  assert.equal(data.branchAlert(row('claude/landed')), null);
});

test('a note written after the last commit clears the alert; an older one does not', () => {
  const branches = [{ name: 'claude/stranded', group: 'stranded', date: DATE }];
  const sessions = [rec('A', 'done', 'claude/stranded')];
  const about = 'acme/widget@claude/stranded';
  seed({ branches, sessions, notes: [{ id: 'n1', at: '2026-09-01T00:00:00Z', about, text: 'old' }] });
  assert.ok(data.branchAlert(row('claude/stranded')));
  seed({ branches, sessions, notes: [{ id: 'n2', at: '2026-09-30T12:00:00Z', about, text: 'checked: keep' }] });
  assert.equal(data.branchAlert(row('claude/stranded')), null);
});

test('the chip, the card badge and the jump all count one set', () => {
  seed({
    branches: [{ name: 'claude/a', group: 'stranded', date: DATE },
               { name: 'claude/b', group: 'active', date: DATE },
               { name: 'claude/c', group: 'landed', date: DATE }],
    sessions: [rec('A', 'done', 'claude/a'), rec('B', 'merged', 'claude/b'), rec('C', 'done', 'claude/c')],
  });
  assert.equal(data.branchScopes.find(s => s.key === 'check').count, 2);
  assert.equal(data.cardAlerts('acme/widget'), 2);
  assert.equal(data.cardAlerts('acme/other'), 0);
  const went = [];
  window.__shell.goBranches = () => went.push('branches');
  window.__shell.goActivity = window.__shell.goBranches;
  data.openChecks('acme/widget');
  assert.equal(data.branchScope, 'check');
  assert.equal(data.openRepoFilter, 'acme/widget');
  assert.deepEqual(JSON.parse(JSON.stringify(data.openRows.map(r => r.name).sort())), ['claude/a', 'claude/b']);
});
