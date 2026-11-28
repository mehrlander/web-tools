// A turn's window and the files it changed, read from a record alone
// (lib/kits/turn-views.js, the reader behind pages/turn.html).
//
// Driven over a plain record; no DOM, no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const w = { chatRender: {} };
loadKit('closing-state', { window: w });
loadKit('session-render', { window: w });
loadKit('turn-views', { window: w });
const T = w.TurnViews;

const call = (at, name, input, extra = {}) => ({ at, name, ok: true, input, arg: input.file_path || input.command || '', ...extra });
const bash = (at, command, files) => call(at, 'Bash', { command },
  { harness_result: { bashEditDiff: { files: files.map((filePath) => ({ filePath, hunks: [] })) } } });

const record = {
  repos: [{ name: 'web-tools', branch: 'claude/late' }],
  pushed: [{ name: 'web-tools', branch: 'claude/early', at: '2026-11-01T10:30:00Z' },
           { name: 'web-tools', branch: 'claude/late', at: '2026-11-01T12:30:00Z' }],
  prompts: [{ at: '2026-11-01T10:00:00Z', text: 'First ask' },
            { at: '2026-11-01T11:00:00Z', text: 'Second ask' },
            { at: '2026-11-01T12:00:00Z', text: 'Third ask' }],
  replies: [{ at: '2026-11-01T10:40:00Z', text: 'Done.\n\n🟢 **Ready to continue:** next step.' },
            { at: '2026-11-01T11:40:00Z', text: 'Look.\n\n👁️‍🗨️ **Have a look:** the page.' }],
  // Tokens are enough for session-render to append its closing summary card,
  // stamped '\uffff\uffff', which is no turn and no window's end.
  tokens: { output: 10, input: 20 },
  calls: [
    call('2026-11-01T10:05:00Z', 'Write', { file_path: '/home/user/web-tools/pages/a.html' }),
    call('2026-11-01T10:06:00Z', 'Edit', { file_path: '/home/user/web-tools/docs/A.md' }),
    // The commit hook's catalogs, changed by a git command: not the turn's own.
    bash('2026-11-01T10:20:00Z', 'cd /home/user/web-tools && git commit -qm x', ['/home/user/web-tools/docs/kits.csv']),
    // A script's rewrite of a data file: counted, not carded.
    bash('2026-11-01T11:05:00Z', 'npm run gen', ['/home/user/web-tools/data/x.csv']),
    bash('2026-11-01T11:06:00Z', "sed -i 's/a/b/' pages/b.html", ['/home/user/web-tools/pages/b.html']),
    call('2026-11-01T11:07:00Z', 'Edit', { file_path: '/home/user/web-tools/pages/b.html' }),
    call('2026-11-01T11:08:00Z', 'Edit', { file_path: '/home/user/web-tools/lib/kits/k.js' }),
    call('2026-11-01T11:09:00Z', 'Write', { file_path: '/home/user/web-tools/data/y.json' }),
    call('2026-11-01T11:10:00Z', 'Write', { file_path: '/tmp/claude-0/x/scratchpad/shot.png' }),
  ],
};

test('turns are the Turns tab cards, numbered from 1', () => {
  assert.equal(T.count(record), 3);
  assert.equal(T.of(record, 0), null);
  assert.equal(T.of(record, 4), null);
  const t = T.of(record, 2);
  assert.equal(t.n, 2);
  assert.equal(t.from, '2026-11-01T11:00:00Z');
  assert.equal(t.to, '2026-11-01T12:00:00Z');
  assert.equal(t.ask, 'Second ask');
  assert.equal(t.closing.key, 'look');
  assert.equal(T.of(record, 3).to, '');
  assert.equal(T.of(record, 3).total, 3);
  assert.equal(T.at(record, '2026-11-01T11:30:00Z'), 2);
  assert.equal(T.at(record, '2026-11-01T11:00:00Z'), 2);
  assert.equal(T.at(record, '2026-10-31T00:00:00Z'), 0);
});

test('a turn keeps pages and documents a file tool or a non-git command changed', () => {
  const one = T.of(record, 1);
  assert.deepEqual(one.files.map((f) => f.key), ['web-tools:pages/a.html', 'web-tools:docs/A.md']);
  assert.equal(one.skipped.git, 1);
  assert.equal(one.files[0].branch, 'claude/early');

  const two = T.of(record, 2);
  assert.deepEqual(two.files.map((f) => [f.key, f.kind, f.edits]),
    [['web-tools:pages/b.html', 'page', 2], ['web-tools:data/y.json', 'doc', 1]]);
  assert.deepEqual(two.other.map((f) => f.path).sort(), ['data/x.csv', 'lib/kits/k.js']);
  assert.equal(two.skipped.outside, 1);
  assert.equal(two.files[0].branch, 'claude/late');
});

test('paths read against the checkouts the record knows', () => {
  const names = new Set(['web-tools', 'home']);
  assert.deepEqual(T.split('/home/user/home/README.md', names), { repo: 'home', path: 'README.md' });
  assert.deepEqual(T.split('web-tools/pages/x.html', names), { repo: 'web-tools', path: 'pages/x.html' });
  assert.equal(T.split('/etc/hosts', names).repo, '');
  assert.equal(T.kindOf('data/x.csv', false), '');
  assert.equal(T.kindOf('data/x.csv', true), 'doc');
});
