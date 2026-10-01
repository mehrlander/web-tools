// Findings: what a tending pass concluded, kept as notes (lib/kits/findings.js).
//
// The two rules the owner set on 2026-10-01, held here:
//   an ordinary note must not clear a finding: only a reply that carries
//   `finding` changes its status;
//   reassessment must see changes elsewhere: a finding's witnesses may lie
//   outside its subjects, and a moved witness reads as changed even when no
//   subject did.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
await startAlpine(window, ['lib/alpine-bundle.js', 'lib/kits/notes.js', 'lib/kits/findings.js']);
const F = window.Findings;
// Arrays and objects built inside the window are another realm's; compare plain copies.
const plain = (x) => JSON.parse(JSON.stringify(x));

const ROOT = {
  id: 'nroot', at: '2026-10-01T10:00:00Z', author: 'claude/x', about: 'acme/widget@claude/env-check',
  text: 'An environment report never reached main',
  finding: { kind: 'unreached', subjects: ['acme/widget@claude/env-check', 'acme/widget:sessions/2026/09/2026-09-29-abcd1234.json'],
             why: 'Four facts in it are not in the docs.', next: 'Fold them into capabilities.md.',
             witnesses: [{ ref: 'acme/widget@claude/env-check', sha: 'aaaaaaa' },
                         { ref: 'acme/docs@main:docs/environment/capabilities.md', sha: 'bbbbbbb' }] },
};
const reply = (id, at, extra = {}) => ({ id, at, author: 'mehrlander', about: 'note:nroot', text: 'r ' + id, ...extra });

test('a finding note folds into one open finding with its subjects', () => {
  const [f] = F.fold([ROOT, { id: 'nplain', at: '2026-10-01T09:00:00Z', author: 'x', about: 'acme/widget', text: 'plain note' }]);
  assert.equal(f.id, 'nroot');
  assert.equal(f.open, true);
  assert.equal(f.status, 'open');
  assert.equal(f.kind, 'unreached');
  assert.deepEqual(plain(f.subjects), ROOT.finding.subjects);
  assert.equal(f.history[0].type, 'found');
});

test('a comment, however recent, never changes a finding', () => {
  const [f] = F.fold([ROOT, reply('nc1', '2026-10-02T00:00:00Z'), reply('nc2', '2026-10-03T00:00:00Z')]);
  assert.equal(f.open, true);
  assert.deepEqual(plain(f.history.map(h => h.type)), ['found', 'comment', 'comment']);
  // A note addressed to the subject itself, not a reply, is not part of it at all.
  const [g] = F.fold([ROOT, { id: 'nsub', at: '2026-10-04T00:00:00Z', author: 'x', about: ROOT.about, text: 'checked' }]);
  assert.equal(g.open, true);
  assert.equal(g.history.length, 1);
});

test('the owner closes a finding only with a resolution, and can reopen it', () => {
  const res = { ...reply('nres', '2026-10-02T00:00:00Z'), finding: { status: 'resolved' } };
  const [f] = F.fold([ROOT, res]);
  assert.equal(f.open, false);
  assert.equal(f.status, 'resolved');
  assert.equal(f.history.at(-1).type, 'resolved');
  const re = { ...reply('nre', '2026-10-03T00:00:00Z'), finding: { status: 'open' } };
  const [g] = F.fold([ROOT, res, re]);
  assert.equal(g.open, true);
  assert.equal(g.history.at(-1).type, 'reopened');
});

test('the browser writes a resolution that carries finding, and a comment that does not', () => {
  const r = F.resolution('nroot', 'Folded into capabilities.md', 'mehrlander');
  assert.equal(r.about, 'note:nroot');
  assert.deepEqual(plain(r.finding), { status: 'resolved' });
  const c = window.Notes.make({ about: 'note:nroot', text: 'looks right', author: 'mehrlander' });
  assert.equal('finding' in c, false);
});

test('a reassessment replaces fields and moves the assessment date only with new witnesses', () => {
  const adv = { ...reply('nadv', '2026-10-02T00:00:00Z'), finding: { next: 'Open a PR with the four facts.', choice: '' } };
  const [f] = F.fold([ROOT, adv]);
  assert.equal(f.next, 'Open a PR with the four facts.');
  assert.equal(f.assessedAt, ROOT.at);
  assert.equal(f.history.at(-1).type, 'advanced');
  const re = { ...reply('nwit', '2026-10-03T00:00:00Z'), finding: { witnesses: [{ ref: 'acme/widget@claude/env-check', sha: 'ccccccc' }] } };
  const [g] = F.fold([ROOT, adv, re]);
  assert.equal(g.assessedAt, '2026-10-03T00:00:00Z');
  assert.equal(g.witnesses.length, 1);
});

test('tending settles a finding by kind or status, and a settled one opens closed', () => {
  const [f] = F.fold([ROOT, { ...reply('nset', '2026-10-02T00:00:00Z'), finding: { kind: 'settled', why: 'main absorbed it' } }]);
  assert.equal(f.open, false);
  assert.equal(f.history.at(-1).type, 'settled');
  const [g] = F.fold([{ ...ROOT, id: 'nset0', finding: { ...ROOT.finding, kind: 'settled' } }]);
  assert.equal(g.open, false);
});

test('witnesses: a moved file outside the subjects reads as changed', () => {
  const [, file] = ROOT.finding.witnesses;
  assert.deepEqual(plain(F.witnessPlan(file)), { type: 'path', repo: 'acme/docs', ref: 'main', path: 'docs/environment/capabilities.md' });
  assert.equal(F.compare(file, { commits: [] }).verdict, 'ok');
  const moved = F.compare(file, { commits: [{ sha: 'deadbeefcafe', message: 'capabilities: add the proxy note' }] });
  assert.equal(moved.verdict, 'changed');
  assert.match(moved.detail, /deadbee/);
  assert.equal(F.compare(file, { missing: true }).verdict, 'broken');
});

test('witnesses: branch tips and pull requests', () => {
  const tip = ROOT.finding.witnesses[0];
  assert.equal(F.compare(tip, { sha: 'aaaaaaa1234' }).verdict, 'ok');
  assert.equal(F.compare(tip, { sha: 'fffffff' }).verdict, 'changed');
  assert.equal(F.compare(tip, { missing: true }).verdict, 'broken');
  const pr = { ref: 'acme/widget#12', state: 'open', updated: '2026-09-20T00:00:00Z' };
  assert.equal(F.compare(pr, { state: 'open', updated: '2026-09-20T00:00:00Z' }).verdict, 'ok');
  assert.equal(F.compare(pr, { state: 'merged', updated: '2026-09-30T00:00:00Z' }).detail, 'now merged');
  assert.equal(F.compare(pr, { error: 'no token' }).verdict, 'unverifiable');
  // A merged PR is final; a later edit to it moves its update time and changes nothing witnessed.
  assert.equal(F.compare({ ref: 'acme/widget#9', state: 'merged', updated: '2026-09-01T00:00:00Z' }, { state: 'merged', updated: '2026-09-30T00:00:00Z' }).verdict, 'ok');
});

test('subjects parse into the kinds the view links', () => {
  assert.equal(F.parse('acme/widget#12').type, 'pr');
  assert.equal(F.parse('acme/widget@claude/x').type, 'branch');
  assert.equal(F.parse('acme/widget:tracker/tasks/fix-it.md').type, 'task');
  assert.equal(F.parse('acme/widget:docs/SNAGS.md#some-trap').type, 'snag');
  assert.equal(F.parse('acme/store:sessions/2026/09/2026-09-29-abcd1234.json').type, 'session');
  assert.equal(F.parse('acme/widget').type, 'repo');
  assert.equal(F.repoOf('acme/widget#12'), 'acme/widget');
});

test('a branch row matches by the branch or by a pull request it heads', () => {
  const [f] = F.fold([{ ...ROOT, about: 'acme/widget#12', finding: { ...ROOT.finding, subjects: ['acme/widget#12'] } }]);
  assert.equal(F.touchesBranch(f, 'acme/widget', 'claude/other', [12]), true);
  assert.equal(F.touchesBranch(f, 'acme/widget', 'claude/other', [13]), false);
  assert.equal(F.touchesRepo(f, 'acme/widget'), true);
});

test('open findings read a question for the owner first, then by kind', () => {
  const mk = (id, kind, choice, at) => ({ id, at, kind, choice, open: true });
  const order = F.sortOpen([mk('a', 'overlap', '', '2026-10-03'), mk('b', 'unreached', '', '2026-10-02'),
                            mk('c', 'overlap', 'Keep which?', '2026-10-01'), mk('d', 'answer', '', '2026-10-01')]);
  assert.deepEqual(plain(order.map(f => f.id)), ['c', 'd', 'b', 'a']);
});
