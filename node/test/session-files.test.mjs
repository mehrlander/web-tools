// alpineComponents/session-brief.js — the Files tab as a list over a strip of
// file cards (house style rule 11, kits/linked-swiper.js; owner, 2026-11-17).
//
// What is pinned: rows group by checkout and branch, an edit leading a read; a
// file its branch changed carries the change's line counts and its card is the
// branch page's card (fileReview) on that change; a file only read, changed
// and not in the branch's change, or kept in a scratchpad, says which; and the
// card's door opens that branch's changed files full screen at it.
//
// Over the real list kits in jsdom. The branch's compare is a stand-in for
// BranchBrief.readBrief, and fileReview is a stand-in that records what it
// was handed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const record = {
  schema: 13, short: 'ab12cd34', day: '2026-10-01', prompts: [], replies: [],
  repos: [{ name: 'web-tools', branch: 'claude/x' }],
  files: { 'web-tools/lib/a.js': { edit: 3 }, 'web-tools/docs/b.md': { read: 2 }, 'web-tools/lib/c.js': { write: 1 },
           'scratchpad/notes.txt': { write: 1 }, 'web-tools/lib/z.js': { edit: 1 } },
};
const { window, problems } = makeWindow({ html: '<html><body><div id="f" x-data="sessionBrief(window.__f)"></div></body></html>' });
window.claudeMark = { svg: () => '<svg></svg>' };
window.gh = { load: async () => {} };
window.readAloud = {}; window.TitleTip = {}; window.ClosingState = {};
window.chatRender = { ready: async () => {} };
for (const file of ['lib/vanilla-bundle.js', 'lib/kits/repo-address.js', 'lib/kits/assistant-mark.js', 'lib/kits/session-render.js',
                    'lib/kits/swipe-deck.js', 'lib/kits/linked-swiper.js']) {
  try { new window.Function('window', readFileSync(path.join(repoRoot, file), 'utf8'))(window); } catch { /* optional */ }
}
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
window.Element.prototype.scrollIntoView = function () {};
window.Element.prototype.scrollTo = function () {};
window.GH = class { constructor(c = {}) { this.repo = c.repo; } async get() { throw Object.assign(new Error('404'), { status: 404 }); } async req() { return []; } };
window.TOKEN = 't';
// The branch's change against main: a.js changed, c.js written but not in it.
window.BranchBrief = { readBrief: async (gh, o) => ({ compare: { merge_base_commit: { sha: 'base1' },
  files: [{ filename: 'lib/a.js', status: 'modified', additions: 4, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' },
          { filename: 'lib/z.js', status: 'added', additions: 2, deletions: 0, patch: '+z' }] } }) };
const reviews = [];
const decks = [];
window.fileDeck = { open: (o) => decks.push(o) };
window.__f = { record, repo: 'me/private', framed: true, lent: true, pane: 'files' };
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine;
captureAlpineErrors(Alpine);
Alpine.data('fileReview', (o) => ({ init() { reviews.push(o); } }));
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpine-bundle.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8'))();
Alpine.start();
const el = window.document.getElementById('f');
const d = Alpine.$data(el);
const until = async (ok) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 20)); return ok(); };
const rows = () => [...el.querySelectorAll('[data-file-list] [data-file]')];
await until(() => d.diffsState === 'read' && rows().length === 5);
await tick(6);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('rows group by checkout and branch, an edit leading, and a changed file carries its line counts', () => {
  assert.deepEqual(rows().map((r) => r.getAttribute('data-file')),
    ['web-tools/lib/a.js', 'web-tools/docs/b.md', 'web-tools/lib/c.js', 'web-tools/lib/z.js', 'scratchpad/notes.txt']);
  const heads = [...el.querySelectorAll('[data-file-list] .sticky')].map((h) => h.textContent);
  assert.equal(heads.length, 2);
  assert.match(heads[0], /^web-tools · /);
  assert.match(rows()[0].textContent, /\+4\s*−1/, 'the change\'s counts');
  assert.doesNotMatch(rows()[1].textContent, /\+\d/, 'a file only read has none');
});

test('a changed file\'s card is the branch page\'s card, on the branch\'s change', async () => {
  await until(() => reviews.length);
  const r = reviews.find((x) => x.path === 'lib/a.js');
  assert.ok(r, 'fileReview mounted for the changed file');
  assert.deepEqual([r.repo, r.ref, r.base, r.status, r.additions, r.deletions, r.open, r.bare],
    ['me/web-tools', 'claude/x', 'base1', 'modified', 4, 1, true, true]);
  assert.match(r.patch, /\+new/);
});

test('a file only read, changed off the branch, or in a scratchpad says which', async () => {
  // Waits for the note it expects rather than for a fixed number of ticks:
  // a pick re-renders the strip asynchronously, and on a loaded CI runner six
  // ticks once read the previous pick's notes (Tests run 7460, 2026-11-18).
  const note = async (p, want) => {
    d._fileSwiper.pick(p);
    const text = () => [...el.querySelectorAll('[data-file-strip] [data-file-note]')].map((x) => x.textContent).join(' | ');
    await until(() => want.test(text()), 'the note for ' + p);
    return text();
  };
  assert.match(await note('web-tools/docs/b.md', /Read, not changed/), /Read, not changed/);
  assert.match(await note('web-tools/lib/c.js', /not in its branch's change/), /not in its branch's change/);
  assert.match(await note('scratchpad/notes.txt', /scratchpad/), /scratchpad/);
});

test('the door opens the branch\'s changed files full screen at the file', async () => {
  d._fileSwiper.pick('web-tools/lib/a.js');
  await tick(6);
  decks.length = 0;
  el.querySelector('[data-file-strip] [data-swipe-cards]').click();
  await until(() => decks.length);
  assert.equal(decks[0].repo, 'me/web-tools');
  assert.deepEqual(JSON.parse(JSON.stringify(decks[0].files.map((f) => f.path))), ['lib/a.js', 'lib/z.js']);
  assert.equal(decks[0].start, 0);
});

test('the door opens the deck at the picked file, not the first', async () => {
  d._fileSwiper.pick('web-tools/lib/z.js');
  await tick(6);
  decks.length = 0;
  el.querySelector('[data-file-strip] [data-swipe-cards]').click();
  await until(() => decks.length);
  assert.deepEqual(JSON.parse(JSON.stringify(decks[0].files.map((f) => f.path))), ['lib/a.js', 'lib/z.js']);
  assert.equal(decks[0].start, 1);
});
