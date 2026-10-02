// lib/kits/findings.js: the fold and the witness comparison (docs/views/tending.md).

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
  const w = { ref: 'acme/w@main:docs/a.md', sha: '1111111' };
  assert.deepEqual(plain(F.resolution('nroot', 'ok', 'mehrlander', [F.ackOf(w, { sha: '2222222' })]).finding),
    { status: 'resolved', ack: [{ ref: 'acme/w@main:docs/a.md', seen: { sha: '2222222' } }] });
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

test('Handled acknowledges witnesses as they stood, and a re-pin replaces the acknowledgment', () => {
  const pinned = { ...ROOT, finding: { ...ROOT.finding, witnesses: [{ ref: 'acme/w@main:docs/a.md', sha: '1111111' }] } };
  const res = { ...reply('nack', '2026-10-02T00:00:00Z'), finding: { status: 'resolved', ack: [{ ref: 'acme/w@main:docs/a.md', seen: { sha: '2222222' } }] } };
  const [f] = F.fold([pinned, res]);
  assert.deepEqual(plain(f.witnesses[0].ack), { sha: '2222222' });
  assert.equal(f.assessedAt, pinned.at, 'an acknowledgment is not a reassessment');
  const repin = { ...reply('nrepin', '2026-10-03T00:00:00Z'), finding: { witnesses: [{ ref: 'acme/w@main:docs/a.md', sha: '3333333' }] } };
  const [g] = F.fold([pinned, res, repin]);
  assert.equal('ack' in g.witnesses[0], false);
});

test('a settled finding whose evidence moved asks for attention again', () => {
  const [f] = F.fold([{ ...OVERTAKEN, id: 'nnone2', finding: { ...OVERTAKEN.finding, next: '' } }]);
  assert.equal(F.needsAttention(f, [{ verdict: 'ok' }]), false);
  assert.equal(F.needsAttention(f, [{ verdict: 'ok' }, { verdict: 'changed', detail: 'now 2222222' }]), true);
  assert.equal(F.needsAttention(f, [{ verdict: 'broken' }]), true);
  assert.equal(F.needsAttention(f, [{ verdict: 'unverifiable' }]), false);
});

test('witnesses: a file outside the subjects is compared by its pinned object', () => {
  const [, file] = ROOT.finding.witnesses;
  assert.deepEqual(plain(F.witnessPlan(file)), { type: 'path', repo: 'acme/docs', ref: 'main', path: 'docs/environment/capabilities.md' });
  assert.equal(F.compare(file, { sha: 'bbbbbbb9999' }).verdict, 'ok');
  // Changed between the investigation and the recording: a commits-since test
  // keyed to the recording time would call this unchanged.
  const moved = F.compare(file, { sha: 'deadbeefcafe', detail: 'last touched by deadbee' });
  assert.equal(moved.verdict, 'changed');
  assert.match(moved.detail, /deadbee/);
  assert.equal(F.compare(file, { missing: true }).verdict, 'broken');
  // A legacy witness that pinned no object falls back to commits since the assessment.
  const unpinned = { ref: file.ref };
  assert.equal(F.compare(unpinned, { commits: [] }).verdict, 'ok');
  assert.equal(F.compare(unpinned, { commits: [{ sha: 'abc1234', message: 'm' }] }).verdict, 'changed');
});

test('witnesses: main is pinned by what it contains, not by its tip', () => {
  const w = { ref: 'acme/widget@main', contains: '106f31c' };
  assert.deepEqual(plain(F.witnessPlan(w)), { type: 'contains', repo: 'acme/widget', ref: 'main', commit: '106f31c' });
  assert.equal(F.compare(w, { contained: true }).verdict, 'ok');
  assert.equal(F.compare(w, { contained: false }).verdict, 'changed');
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

// One set of cases for both comparisons; findings.py reads them from a file
// this test writes.
const WITNESS_CASES = [
  {
    "name": "branch tip unchanged",
    "witness": {
      "ref": "acme/w@claude/x",
      "sha": "aaaaaaa"
    },
    "seen": {
      "sha": "aaaaaaa1234"
    },
    "verdict": "ok"
  },
  {
    "name": "branch moved",
    "witness": {
      "ref": "acme/w@claude/x",
      "sha": "aaaaaaa"
    },
    "seen": {
      "sha": "bbbbbbb"
    },
    "verdict": "changed"
  },
  {
    "name": "branch gone",
    "witness": {
      "ref": "acme/w@claude/x",
      "sha": "aaaaaaa"
    },
    "seen": {
      "missing": true
    },
    "verdict": "broken"
  },
  {
    "name": "branch with no pinned tip",
    "witness": {
      "ref": "acme/w@claude/x"
    },
    "seen": {
      "sha": "bbbbbbb"
    },
    "verdict": "unverifiable"
  },
  {
    "name": "main still contains the commit",
    "witness": {
      "ref": "acme/w@main",
      "contains": "106f31c"
    },
    "seen": {
      "contained": true
    },
    "verdict": "ok"
  },
  {
    "name": "main no longer contains the commit",
    "witness": {
      "ref": "acme/w@main",
      "contains": "106f31c"
    },
    "seen": {
      "contained": false
    },
    "verdict": "changed"
  },
  {
    "name": "file object unchanged",
    "witness": {
      "ref": "acme/w@main:docs/a.md",
      "sha": "1111111"
    },
    "seen": {
      "sha": "1111111aaaa"
    },
    "verdict": "ok"
  },
  {
    "name": "file object changed between investigation and recording",
    "witness": {
      "ref": "acme/w@main:docs/a.md",
      "sha": "1111111"
    },
    "seen": {
      "sha": "2222222"
    },
    "verdict": "changed"
  },
  {
    "name": "folder tree changed",
    "witness": {
      "ref": "acme/w@main:lib/kits",
      "sha": "3333333"
    },
    "seen": {
      "sha": "4444444"
    },
    "verdict": "changed"
  },
  {
    "name": "file gone",
    "witness": {
      "ref": "acme/w@main:docs/a.md",
      "sha": "1111111"
    },
    "seen": {
      "missing": true
    },
    "verdict": "broken"
  },
  {
    "name": "unpinned path with no commits since",
    "witness": {
      "ref": "acme/w@main:docs/a.md"
    },
    "seen": {
      "commits": []
    },
    "verdict": "ok"
  },
  {
    "name": "unpinned path touched since",
    "witness": {
      "ref": "acme/w@main:docs/a.md"
    },
    "seen": {
      "commits": [
        {
          "sha": "5555555",
          "message": "edit"
        }
      ]
    },
    "verdict": "changed"
  },
  {
    "name": "open PR still open, not updated",
    "witness": {
      "ref": "acme/w#12",
      "state": "open",
      "updated": "2026-09-20T00:00:00Z"
    },
    "seen": {
      "state": "open",
      "updated": "2026-09-20T00:00:00Z"
    },
    "verdict": "ok"
  },
  {
    "name": "open PR updated since",
    "witness": {
      "ref": "acme/w#12",
      "state": "open",
      "updated": "2026-09-20T00:00:00Z"
    },
    "seen": {
      "state": "open",
      "updated": "2026-09-30T00:00:00Z"
    },
    "verdict": "changed"
  },
  {
    "name": "open PR now closed",
    "witness": {
      "ref": "acme/w#12",
      "state": "open",
      "updated": "2026-09-20T00:00:00Z"
    },
    "seen": {
      "state": "closed",
      "updated": "2026-10-01T00:00:00Z"
    },
    "verdict": "changed"
  },
  {
    "name": "merged PR is final, later edits ignored",
    "witness": {
      "ref": "acme/w#9",
      "state": "merged",
      "updated": "2026-09-01T00:00:00Z"
    },
    "seen": {
      "state": "merged",
      "updated": "2026-09-30T00:00:00Z"
    },
    "verdict": "ok"
  },
  {
    "name": "closed PR reopened",
    "witness": {
      "ref": "acme/w#7",
      "state": "closed"
    },
    "seen": {
      "state": "open",
      "updated": "2026-10-01T00:00:00Z"
    },
    "verdict": "changed"
  },
  {
    "name": "PR state unreadable",
    "witness": {
      "ref": "acme/w#7",
      "state": "open"
    },
    "seen": {
      "error": "not readable"
    },
    "verdict": "unverifiable"
  },
  {
    "name": "path changed, acknowledged as it now stands",
    "witness": {
      "ref": "acme/w@main:docs/a.md",
      "sha": "1111111",
      "ack": {
        "sha": "2222222"
      }
    },
    "seen": {
      "sha": "2222222abcd"
    },
    "verdict": "ok"
  },
  {
    "name": "path changed again after the acknowledgment",
    "witness": {
      "ref": "acme/w@main:docs/a.md",
      "sha": "1111111",
      "ack": {
        "sha": "2222222"
      }
    },
    "seen": {
      "sha": "3333333"
    },
    "verdict": "changed"
  },
  {
    "name": "branch gone, acknowledged gone",
    "witness": {
      "ref": "acme/w@claude/x",
      "sha": "aaaaaaa",
      "ack": {
        "missing": true
      }
    },
    "seen": {
      "missing": true
    },
    "verdict": "ok"
  },
  {
    "name": "branch acknowledged gone, then back",
    "witness": {
      "ref": "acme/w@claude/x",
      "sha": "aaaaaaa",
      "ack": {
        "missing": true
      }
    },
    "seen": {
      "sha": "bbbbbbb"
    },
    "verdict": "changed"
  },
  {
    "name": "main no longer contains the commit, acknowledged",
    "witness": {
      "ref": "acme/w@main",
      "contains": "106f31c",
      "ack": {
        "contained": false
      }
    },
    "seen": {
      "contained": false
    },
    "verdict": "ok"
  },
  {
    "name": "open PR not updated since the acknowledgment",
    "witness": {
      "ref": "acme/w#7",
      "state": "open",
      "updated": "2026-09-01T00:00:00Z",
      "ack": {
        "state": "open",
        "updated": "2026-09-20T00:00:00Z"
      }
    },
    "seen": {
      "state": "open",
      "updated": "2026-09-20T00:00:00Z"
    },
    "verdict": "ok"
  },
  {
    "name": "open PR updated after the acknowledgment",
    "witness": {
      "ref": "acme/w#7",
      "state": "open",
      "updated": "2026-09-01T00:00:00Z",
      "ack": {
        "state": "open",
        "updated": "2026-09-20T00:00:00Z"
      }
    },
    "seen": {
      "state": "open",
      "updated": "2026-10-01T00:00:00Z"
    },
    "verdict": "changed"
  }
];

test('the kit and findings.py agree on every shared witness case', async () => {
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const { repoRoot } = await import('./bootstrap.mjs');
  for (const c of WITNESS_CASES) assert.equal(F.compare(c.witness, c.seen).verdict, c.verdict, 'kit: ' + c.name);
  const file = mkdtempSync(tmpdir() + '/witness-') + '/cases.json';
  writeFileSync(file, JSON.stringify({ cases: WITNESS_CASES }));
  const py = JSON.parse(execFileSync('python3', [repoRoot + '/skills/tend/findings.py', 'vectors', file], { encoding: 'utf8' }));
  assert.deepEqual(py.map(x => x.verdict), WITNESS_CASES.map(c => c.verdict), 'findings.py disagrees with the cases');
});
