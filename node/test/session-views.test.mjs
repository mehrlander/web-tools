// alpineComponents/session-brief.js — the Views tab as a list over a strip of
// cards (house style rule 11, kits/linked-swiper.js; owner, 2026-11-17).
//
// What is pinned: the rows name each file by its last two path segments,
// grouped under their repository and branch; a pick in the list shows its card
// and a swipe of the strip picks its row; a page's card is a frame and a
// document's is its Markdown, filled when the file arrives; the card's door
// opens every view full screen at the one in view, and that deck's last slide
// is where the list and the strip are left.
//
// Over the real kits (swipe-deck, linked-swiper) in jsdom, which lays nothing
// out, so the strip is driven through the kit's own API rather than by a swipe.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const record = { schema: 13, short: 'ab12cd34', day: '2026-10-01', repos: [], prompts: [], replies: [] };
const { window, problems } = makeWindow({ html: '<html><body><div id="v" x-data="sessionBrief(window.__v)"></div></body></html>' });
window.claudeMark = { svg: () => '<svg></svg>' };
window.gh = { load: async () => {} };
window.chatRender = { ready: async () => {} };
window.readAloud = {};
window.TitleTip = {};
window.marked = { parse: (t) => '<p>' + t + '</p>' };
for (const file of ['lib/vanilla-bundle.js', 'lib/kits/repo-address.js', 'lib/kits/closing-state.js', 'lib/kits/session-render.js',
                    'lib/kits/swipe-deck.js', 'lib/kits/linked-swiper.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, file), 'utf8'))(window);
}
window.sessionRender.open = async () => ({});
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
window.Element.prototype.scrollIntoView = function () {};
window.Element.prototype.scrollTo = function () {};
// The Markdown reads, by path.
class FakeGH {
  constructor(c = {}) { this.repo = c.repo; this.ref = c.ref; }
  async get(p) { if (p.endsWith('.md')) return { text: 'body of ' + p }; throw Object.assign(new Error('404'), { status: 404 }); }
  async req() { return []; }
}
window.GH = FakeGH;
window.TOKEN = 't';
// Opened decks, with their onSlide, so a test can move one.
const decks = [];
window.swipeDeck.open = (o) => { const h = { o, setTitle() {}, setSubtitle() {}, setIcon() {} }; decks.push(h); return h; };
window.__v = { record, repo: 'me/private', path: 'sessions/2026/10/2026-10-01-ab12cd34.json', lent: true };
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine;
captureAlpineErrors(Alpine);
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpine-bundle.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8'))();
Alpine.start();
await tick(6);
const el = window.document.getElementById('v');
const d = Alpine.$data(el);
const until = async (ok) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 20)); return ok(); };
const view = (slug, branch, p, kind = /\.md$/.test(p) ? 'md' : 'html') => ({
  key: slug + '@' + branch + ':' + p, kind, path: p, slug, branch, repoShort: slug.split('/').pop(),
  short: branch.split('/').pop(), name: p.split('/').pop(), dir: '', icon: 'ph-git-branch', html: '', url: 'about:blank#' + p, ago: '2h ago' });
d.work.views = [view('me/web-tools', 'claude/a', 'pages/session.html'), view('me/web-tools', 'claude/a', 'docs/README.md'),
                view('me/home', 'claude/a', 'projects/mail/README.md')];
d.show('views');
await until(() => d._viewSwiper);
await tick(4);
const rows = () => [...el.querySelectorAll('[data-view-list] [data-view]')];

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('the list names each file by its last two segments, under its repository and branch', () => {
  assert.deepEqual(rows().map((r) => r.textContent.replace(/\s*2h ago$/, '').trim()),
    ['pages/session.html', 'docs/README.md', 'mail/README.md'], 'two README.md files stay apart');
  const heads = [...el.querySelectorAll('[data-view-list] .sticky')].map((h) => h.textContent);
  assert.deepEqual(heads, ['web-tools · a', 'home · a']);
  assert.equal(el.querySelector('[data-view-list-btn]'), null, 'no dropdown inside the card');
});

test('a pick in the list shows its card, and the strip moving picks its row', async () => {
  rows()[2].click();
  await tick(2);
  assert.equal(d.vAt, 2);
  assert.equal(rows()[2].getAttribute('aria-selected'), 'true');
  assert.match(el.querySelector('[data-views] [data-ls="head"]').textContent, /mail\/README\.md/);
  d._viewSwiper.pick(d.work.views[0].key);
  await tick(2);
  assert.equal(d.vAt, 0);
  assert.equal(rows()[0].getAttribute('aria-selected'), 'true');
});

test('a page\'s card is its frame, and a document\'s is its Markdown once the file arrives', async () => {
  const card = el.querySelector('[data-views]');
  await until(() => d.work.views[1].html);
  await tick(4);
  assert.ok(card.querySelector('iframe[sandbox]'), 'the page in a frame');
  const md = [...card.querySelectorAll('[data-md]')].find((n) => n.getAttribute('data-md') === d.work.views[1].key);
  assert.ok(md, 'the document beside it is drawn');
  assert.match(md.innerHTML, /body of docs\/README\.md/, 'and filled when its file arrived');
});

test('the card\'s door opens every view full screen at the one in view, and the list follows the deck', async () => {
  d._viewSwiper.pick(d.work.views[1].key);
  await tick(2);
  decks.length = 0;
  el.querySelector('[data-views] [data-swipe-cards]').click();
  assert.equal(decks.length, 1);
  assert.equal(decks[0].o.start, 1);
  assert.equal(decks[0].o.title, 'docs/README.md', 'the deck names the file the same way');
  decks[0].o.onSlide(2);
  await tick(2);
  assert.equal(d.vAt, 2, 'closing returns to the view last read');
  assert.equal(rows()[2].getAttribute('aria-selected'), 'true');
});
