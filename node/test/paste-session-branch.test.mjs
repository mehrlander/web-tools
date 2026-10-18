// node/test/paste-session-branch.test.mjs
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
  // Either history call: the address is the shell's sync, which pushes a new
  // entry for a new URL and replaces only an unchanged one.
  history.replaceState = (a, b, url) => stamped.push(url);
  history.pushState = (a, b, url) => stamped.push(url);

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

// A rundown hands a session over as a copy line ending in its record's short
// id, or as the session page's link. Both open the detail deck by row id.
function cacheGH(rows) {
  return class FakeGH {
    async get(p) {
      if (p === 'state/sessions.json') return { text: JSON.stringify({ rows }) };
      throw new Error('404');
    }
  };
}

test('sessionShortFromPaste reads a rundown copy line and a session page link', () => {
  const { shell } = makeShell({ win: { RepoAddress: { fromPaste: () => null } } });
  assert.equal(shell.sessionShortFromPaste('## 👉 Approve one rule for skill descriptions [8fbc1397]'), '8fbc1397');
  assert.equal(shell.sessionShortFromPaste('## 👉 Approve one rule [8FBC1397]()'), '8fbc1397');
  assert.equal(shell.sessionShortFromPaste('https://mehrlander.github.io/web-tools/pages/session.html#id=56f0064f'), '56f0064f');
  assert.equal(shell.sessionShortFromPaste('https://mehrlander.github.io/web-tools/pages/session.html#branch=x&id=56f0064f'), '56f0064f');
  assert.equal(shell.sessionShortFromPaste('a note that ends [draft]'), null);
  assert.equal(shell.sessionShortFromPaste('[8fbc139]'), null);
  assert.equal(shell.sessionShortFromPaste('[8fbc1397] then more text'), null);
  assert.equal(shell.sessionShortFromPaste('8fbc1397'), null, 'a bare id is the router\'s separate, quieter case');
});

test('pasteRoute opens session detail for a rundown copy line', async () => {
  const stamped = [];
  const { shell, win, events, history } = makeShell({
    browserStore: { repo: 'mehrlander/web-tools' },
    win: { RepoAddress: { fromPaste: () => null } },
  });
  history.replaceState = (a, b, url) => stamped.push(url);
  win.TOKEN = 'test-token';
  win.GH = cacheGH([{ id: '8fbc1397', agent: 'https://claude.ai/code/session_011bWZz3KcA5K2WJVX6x8x8T' }]);

  const handled = await shell.pasteRoute(fakeClipboard('## 👉 Approve one rule for skill descriptions [8fbc1397]\n'));

  assert.equal(handled, true);
  assert.equal(shell.view, 'sessions');
  assert.ok(stamped.some(u => /session=8fbc1397/.test(u)), 'should stamp the session in the address bar');
  const ev = events.find(e => e.type === 'web-tools:open-session-detail');
  assert.equal(ev?.detail?.id, '8fbc1397');
});

test('pasteRoute explains a rundown id with no record, and lets a bare unknown id stage', async () => {
  const { shell, win, toasts, events } = makeShell({
    browserStore: { repo: 'mehrlander/web-tools' },
    win: { RepoAddress: { fromPaste: () => null } },
  });
  win.TOKEN = 'test-token';
  win.GH = cacheGH([{ id: '56f0064f', agent: 'https://claude.ai/code/session_01SuqUMNCJYb941WoroGX2Q6' }]);

  // The bracketed form is the estate's own, so a miss is reported, not staged.
  assert.equal(await shell.pasteRoute(fakeClipboard('## 👉 Merge #955 [a42d85d1]')), true);
  assert.equal(toasts.length, 1);
  assert.match(toasts[0].msg, /a42d85d1 has no record/);

  // A bare eight-hex string may be a commit SHA: unknown, it declines to the Stage.
  assert.equal(await shell.pasteRoute(fakeClipboard('9f4d4f00')), false);
  assert.equal(toasts.length, 1, 'a bare miss raises no toast');

  // Known, it opens.
  assert.equal(await shell.pasteRoute(fakeClipboard('56f0064f')), true);
  assert.equal(events.filter(e => e.type === 'web-tools:open-session-detail').at(-1)?.detail?.id, '56f0064f');
});
