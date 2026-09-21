// tools/test/paste-session-branch.test.mjs
// Verifies that pasting a Claude session URL or a branch identifier routes
// to the respective detail takeover deck instead of staging as content.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShell } from './shell.mjs';

function fakeClipboard(text, { file = false } = {}) {
  return {
    getData: (flavor) => (flavor === 'text/plain' ? text : ''),
    items: file ? [{ kind: 'file' }] : [{ kind: 'string' }],
    files: file ? [{ name: 'screen.png', type: 'image/png' }] : [],
  };
}

test('parseBranchPaste recognizes repo@branch, github tree URLs, and assistant branches', () => {
  const { shell } = makeShell({
    browserStore: {
      repo: 'mehrlander/web-tools',
      estateRepos: [
        { repo: 'mehrlander/web-tools' },
        { repo: 'mehrlander/home' },
      ],
    },
  });

  // 1. Full owner/repo@branch
  assert.deepEqual(shell.parseBranchPaste('mehrlander/web-tools@claude/some-work'), {
    repo: 'mehrlander/web-tools',
    name: 'claude/some-work',
  });

  // 2. Short repo@branch expanded from estate repos
  assert.deepEqual(shell.parseBranchPaste('home@feat/budget'), {
    repo: 'mehrlander/home',
    name: 'feat/budget',
  });

  // 3. GitHub tree/branch URL
  assert.deepEqual(shell.parseBranchPaste('https://github.com/mehrlander/web-tools/tree/claude/active-work'), {
    repo: 'mehrlander/web-tools',
    name: 'claude/active-work',
  });

  // 4. Assistant-prefixed bare branch
  assert.deepEqual(shell.parseBranchPaste('claude/quick-patch-1234'), {
    repo: 'mehrlander/web-tools',
    name: 'claude/quick-patch-1234',
  });

  // 5. Non-branches and addresses decline
  assert.equal(shell.parseBranchPaste(''), null);
  assert.equal(shell.parseBranchPaste('just some text'), null);
  assert.equal(shell.parseBranchPaste('mehrlander/web-tools:docs/a.md'), null);
  assert.equal(shell.parseBranchPaste('claude/branch\nother/line'), null);
});

test('pasteRoute navigates to branch detail on branch paste', async () => {
  const stamped = [];
  const { shell, events, history } = makeShell({
    browserStore: {
      repo: 'mehrlander/web-tools',
      estateRepos: [{ repo: 'mehrlander/web-tools' }],
    },
    win: { RepoAddress: { fromPaste: () => null } },
  });
  history.replaceState = (a, b, url) => stamped.push(url);

  const cd = fakeClipboard('web-tools@claude/my-test-branch');
  const handled = await shell.pasteRoute(cd);

  assert.equal(handled, true, 'pasteRoute should handle branch paste');
  assert.equal(shell.view, 'branches', 'should switch view to branches');
  assert.ok(stamped.some(u => /detail=mehrlander%2Fweb-tools%40claude%2Fmy-test-branch|detail=mehrlander\/web-tools@claude\/my-test-branch/.test(u)),
    'should stamp branch detail in address bar');

  const branchEvent = events.find(e => e.type === 'web-tools:open-branch-detail');
  assert.ok(branchEvent, 'should dispatch web-tools:open-branch-detail');
  assert.deepEqual(branchEvent.detail, {
    repo: 'mehrlander/web-tools',
    name: 'claude/my-test-branch',
  });
});

test('pasteRoute navigates to session detail on Claude session URL paste', async () => {
  const stamped = [];
  const { shell, win, events, history } = makeShell({
    browserStore: { repo: 'mehrlander/web-tools' },
    win: {
      RepoAddress: { fromPaste: () => null },
    },
  });
  history.replaceState = (a, b, url) => stamped.push(url);
  // Set TOKEN and GH after construction (makeShell script overrides win.TOKEN on construction)
  win.TOKEN = 'test-token';
  win.GH = class FakeGH {
    async get(p) {
      if (p === 'state/sessions.json') {
        return {
          text: JSON.stringify({
            rows: [
              {
                id: '8656253f',
                agent: 'https://claude.ai/code/session_01Xqmvcv6DYk3xkw5zWHZqR7',
                day: '2026-09-11',
              },
            ],
          }),
        };
      }
      throw new Error('404');
    }
  };

  const cd = fakeClipboard('https://claude.ai/code/session_01Xqmvcv6DYk3xkw5zWHZqR7');
  const handled = await shell.pasteRoute(cd);

  assert.equal(handled, true, 'pasteRoute should handle Claude session URL');
  assert.equal(shell.view, 'sessions', 'should switch view to sessions');
  assert.ok(stamped.some(u => /session=8656253f/.test(u)), 'should stamp session ID in address bar');

  const sessEvent = events.find(e => e.type === 'web-tools:open-session-detail');
  assert.ok(sessEvent, 'should dispatch web-tools:open-session-detail');
  assert.equal(sessEvent.detail.id, '8656253f');
});

test('pasteRoute shows toast when Claude session URL is not yet in sessions cache', async () => {
  const { shell, win, toasts } = makeShell({
    browserStore: { repo: 'mehrlander/web-tools' },
    win: {
      RepoAddress: { fromPaste: () => null },
    },
  });
  win.TOKEN = 'test-token';
  win.GH = class FakeGH {
    async get() {
      return { text: JSON.stringify({ rows: [] }) };
    }
  };

  const cd = fakeClipboard('https://claude.ai/code/session_01UnknownSession');
  const handled = await shell.pasteRoute(cd);

  assert.equal(handled, true, 'session URL should be handled rather than staging as text');
  assert.equal(toasts.length, 1, 'should emit a warning toast');
  assert.match(toasts[0].msg, /not found in sessions cache/);
});

test('pasteRoute declines file-carrying clipboards and multi-line content to the Stage', async () => {
  const { shell } = makeShell({
    win: { RepoAddress: { fromPaste: () => null } },
  });

  // 1. File in clipboard always wins (declines to Stage)
  const fileCd = fakeClipboard('https://claude.ai/code/session_01ABC', { file: true });
  assert.equal(await shell.pasteRoute(fileCd), false);

  // 2. Multi-line text declines to Stage
  const multiCd = fakeClipboard('https://claude.ai/code/session_01ABC\nsecond line');
  assert.equal(await shell.pasteRoute(multiCd), false);

  // 3. Plain prose declines to Stage
  const proseCd = fakeClipboard('just some normal text about sessions and branches');
  assert.equal(await shell.pasteRoute(proseCd), false);
});
