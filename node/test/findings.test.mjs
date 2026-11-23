// lib/kits/findings.js: the fold, and subjects read alike by the kit and findings.py.

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
             why: 'Four facts in it are not in the docs.', next: 'Fold them into capabilities.md.' },
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

test('a reassessment replaces fields and moves the assessment date; a comment moves neither', () => {
  const adv = { ...reply('nadv', '2026-10-02T00:00:00Z'), finding: { next: 'Open a PR with the four facts.', choice: '' } };
  const [f] = F.fold([ROOT, adv, reply('nc', '2026-10-03T00:00:00Z')]);
  assert.equal(f.next, 'Open a PR with the four facts.');
  assert.equal(f.assessedAt, '2026-10-02T00:00:00Z');
  assert.equal(f.history.at(-1).type, 'comment');
  assert.equal(f.history.at(-2).type, 'advanced');
});

test('witnesses and acknowledgments in older records are ignored', () => {
  const legacy = { ...ROOT, finding: { ...ROOT.finding, witnesses: [{ ref: 'acme/w@main:docs/a.md', sha: '1111111' }] } };
  const res = { ...reply('nack', '2026-10-02T00:00:00Z'), finding: { status: 'resolved', ack: [{ ref: 'acme/w@main:docs/a.md', seen: { sha: '2' } }] } };
  const [f] = F.fold([legacy, res]);
  assert.equal('witnesses' in f, false);
  assert.equal(f.status, 'resolved');
});

// A finding with a step left stays open until the step is done or the owner
// handles it, whatever its kind.
const OVERTAKEN = {
  id: 'nover', at: '2026-10-01T10:00:00Z', author: 'claude/x', about: 'acme/widget#758',
  text: 'PR 758 already landed inside 762',
  finding: { kind: 'superseded', subjects: ['acme/widget#758'], why: 'Its commits are in 762.', next: 'Close 758.',
             evidence: ['762 holds both commits'] },
};
const oreply = (id, at, extra = {}) => ({ id, at, author: 'claude/tend', about: 'note:nover', text: 'r ' + id, ...extra });

test('an overtaken finding with a step left stays open, with the step outstanding', () => {
  const [f] = F.fold([OVERTAKEN]);
  assert.equal(f.open, true);
  assert.equal(f.outstanding, true);
  assert.equal(f.kind, 'superseded');
  // The first records used kind "settled"; with a step left they are open too.
  const [g] = F.fold([{ ...OVERTAKEN, id: 'nlegacy', finding: { ...OVERTAKEN.finding, kind: 'settled' } }]);
  assert.equal(g.open, true);
});

test('an assessment that found nothing to do opens settled', () => {
  const [f] = F.fold([{ ...OVERTAKEN, id: 'nnone', finding: { ...OVERTAKEN.finding, next: '' } }]);
  assert.equal(f.open, false);
  assert.equal(f.outstanding, false);
  assert.equal(f.closedBy, null);
});

test('tending settles a finding by recording what was done, and the record says so', () => {
  const done = oreply('ndone', '2026-10-02T00:00:00Z', { finding: { status: 'settled', did: 'Closed 758 after the owner agreed' } });
  const [f] = F.fold([OVERTAKEN, done]);
  assert.equal(f.open, false);
  assert.equal(f.history.at(-1).type, 'settled');
  assert.equal(f.closedBy.did, 'Closed 758 after the owner agreed');
});

test('clearing the step settles it; renewing attention reopens it with a new step', () => {
  const cleared = oreply('nclr', '2026-10-02T00:00:00Z', { finding: { next: '' } });
  const [f] = F.fold([OVERTAKEN, cleared]);
  assert.equal(f.open, false);
  const renewed = oreply('nren', '2026-10-03T00:00:00Z', { finding: { status: 'open', next: 'Reopened upstream; read it again.' } });
  const [g] = F.fold([OVERTAKEN, cleared, renewed]);
  assert.equal(g.open, true);
  assert.equal(g.history.at(-1).type, 'reopened');
  assert.equal(g.closedBy, null);
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

test('open findings read by kind, then newest', () => {
  const mk = (id, kind, at) => ({ id, at, kind, open: true });
  const order = F.sortOpen([mk('a', 'overlap', '2026-10-03'), mk('b', 'unreached', '2026-10-02'),
                            mk('c', 'overlap', '2026-10-01'), mk('d', 'answer', '2026-10-01')]);
  assert.deepEqual(plain(order.map(f => f.id)), ['d', 'b', 'a', 'c']);
});

test('a user call is a subject the view links to its page', () => {
  const p = F.parse('me/registry:user-calls/5f95d663-keep-profile.json');
  assert.equal(p.type, 'call');
  assert.equal(p.repo, 'me/registry');
});

test('the kit and findings.py read a subject alike, a pinned one and a bare repo included', async () => {
  // A pinned ref (@branch@commit) reads at the commit in both: the kit through
  // RepoAddress, findings.py through note.py's patterns.
  const { execFileSync } = await import('node:child_process');
  const { repoRoot } = await import('./bootstrap.mjs');
  const refs = ['acme/w@claude/x', 'acme/w@claude/x@1014b18', 'acme/w@main:docs/x.md#h',
    'acme/w@claude/x@1014b1897601:docs/x.md', 'acme/w@feat@x:docs/x.md', 'acme/w', 'acme/w#12'];
  const py = JSON.parse(execFileSync('python3', ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(repoRoot + '/skills/tend')})
import findings
print(json.dumps([findings.parse_ref(r) for r in json.loads(sys.argv[1])]))
`, JSON.stringify(refs)], { encoding: 'utf8' }));
  refs.forEach((r, i) => {
    const k = F.parse(r);
    const [kind, repo, at, p] = py[i];
    if (kind === 'pr') return assert.deepEqual([repo, at], [k.repo, k.number], r);
    assert.deepEqual([kind === 'path' ? 'path' : kind, repo, at, p],
      [k.path ? 'path' : k.type, k.repo, k.ref || '', k.path || ''], r);
  });
});
