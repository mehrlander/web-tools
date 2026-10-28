// findings.py check on an answer finding whose user call the owner closed:
// the answer the finding waited on has arrived, so the finding is due again
// though no witness moved. On 2026-10-25, 41 of 51 open findings named a call
// closed weeks earlier, and check flagged none of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const T = mkdtempSync(path.join(tmpdir(), 'findings-answered-'));
const GIT = { GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'push.negotiate', GIT_CONFIG_VALUE_0: 'false',
              GIT_CONFIG_KEY_1: 'commit.gpgsign', GIT_CONFIG_VALUE_1: 'false',
              GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const env = { ...process.env, ...GIT };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', env }).trim();

const CALL = 'user-calls/s1-merge.json';
const call = (closed) => JSON.stringify({ schema: 'user-call/1', id: 's1-merge', kind: 'merge',
  status: closed ? 'closed' : 'open', question: 'Merge acme/store#1?', ...(closed ? { closed } : {}) }) + '\n';

test('an open finding is due again once the user call it names is answered', () => {
  const bare = path.join(T, 'store.git'), work = path.join(T, 'store');
  git('init', '-q', '--bare', '-b', 'main', bare);
  git('init', '-q', '-b', 'main', work);
  const files = { '.web-tools.json': '{"notes":"notes"}\n', 'notes/.keep': '', [CALL]: call(null),
    'state/activity.json': '{"repos":{}}', 'state/sessions.json': '{"rows":[]}' };
  for (const [f, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(work, f)), { recursive: true });
    writeFileSync(path.join(work, f), text);
  }
  git('-C', work, 'add', '-A'); git('-C', work, 'commit', '-qm', 'seed');
  git('-C', work, 'remote', 'add', 'origin', bare); git('-C', work, 'push', '-q', 'origin', 'main');

  const py = (...a) => execFileSync('python3', [path.join(repoRoot, 'skills/tend/findings.py'),
    '--store', path.join(work, 'notes'), '--author', 'claude/test', ...a],
    { encoding: 'utf8', env: { ...env, FINDINGS_CHECKOUTS: JSON.stringify({ 'acme/store': work }) }, cwd: work });
  const f = path.join(T, 'f.json');
  writeFileSync(f, JSON.stringify({ kind: 'answer', title: 'Merge waits on the owner',
    subjects: ['acme/store#1', 'acme/store:' + CALL], why: 'Only the owner merges.', next: 'On Merge, a session merges #1.' }));
  py('add', f);
  const answered = () => JSON.parse(py('check', '--json'))[0].verdicts.filter(v => v.ref === 'acme/store:' + CALL);

  // The control: an open call leaves the finding as it was assessed.
  assert.deepEqual(answered(), []);

  // note.py commits onto origin/main without touching the working tree.
  git('-C', work, 'merge', '-q', '--ff-only', 'origin/main');
  const later = new Date(Date.now() + 60_000).toISOString();
  writeFileSync(path.join(work, CALL), call({ at: later, answer: 'Merge' }));
  git('-C', work, 'commit', '-qam', 'answer'); git('-C', work, 'push', '-q', 'origin', 'main');
  const [v] = answered();
  assert.equal(v?.verdict, 'changed');
  assert.match(v.detail, /^answered \d{4}-\d\d-\d\d: Merge$/);
  assert.match(py('check'), /REASSESS/);
});
