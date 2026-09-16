// alpineComponents/estate.js — the branch deck owning ONE subject channel.
//
// A branch slide presents its readable files in a strip, and which panel is
// showing is chosen inside the slide. Nothing out here can derive it, and
// neither can the sidebar: it builds its layer strip by walking live frames,
// and a markdown panel is a div in this document rather than a frame, so the
// walk names app/index.html and stops two levels short of the reader. What that
// costs is the drawer's compare bar, gated on a subject having announced a
// BASE, while the slide mounts reading cards that each subscribe to the answer
// the bar publishes.
//
// pages/branch.html announces for itself (branch-brief-subject covers that).
// Here the slide REPORTS through `onSubject` and the deck announces, because
// three slides are alive at a time: three announcers would race, and worse, a
// channel restores its snapshot on release, so a slide being left could put its
// snapshot back over the slide being arrived at. One owner has neither problem.
//
// The channel kit is the real one; the slide is a stub, since the branch view's
// own reporting has its own suite and the deck's bookkeeping is the subject
// here. Same split estate-open-branches uses for the header.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, startAlpine, deckGeometry, repoRoot } from './bootstrap.mjs';

class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  ago() { return 'just now'; }
  async get() { throw new Error('404'); }
  async ls() { throw new Error('404'); }
  async req() { throw new Error('404'); }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.open = () => null;
window.__shell = {
  REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools',
  quickLinks: [], hasToken: () => true, _authState: 'auth',
  anchorMenu: (ev, rows, opts = {}) => ({ x: 10, y: 20, rows, ...opts }),
  menuStyle: () => 'left:-9999px;top:-9999px',
};
deckGeometry(window);
window.gh = { load: async () => {} };

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/branch-status.js',
  'lib/kits/swipe-deck.js',
  'lib/kits/subject-channel.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);

// The slide, as a name plus the one contract under test: it keeps the options
// object so a test can call the callback the deck handed it, which is what the
// real branch view does once its strip settles.
const slideOpts = [];
Alpine.data('branchBrief', (opts) => ({
  opts,
  init() { this.$el.textContent = opts.branch; slideOpts.push(opts); },
}));

const data = Alpine.$data(window.document.getElementById('es'));
const tick = (n = 1) => new Promise(r => setTimeout(r, n * 10));

const entry = (branches, prs, def = 'main') => ({ defaultBranch: def, openPRs: prs, scan: { branches } });
const seed = () => {
  slideOpts.length = 0;
  data.activity = {
    'me/tools': entry([
      { name: 'feat/a', sha: 'a1', group: 'stranded', date: '2026-07-19T22:00:00Z',
        firstDate: '2026-07-05T00:00:00Z', subject: 'work a', aheadBy: 4, behindBy: 1 },
      { name: 'feat/b', sha: 'b1', group: 'stranded', date: '2026-07-18T00:00:00Z',
        firstDate: '2026-07-17T20:00:00Z', subject: 'work b', aheadBy: 1, behindBy: 0 },
    ], []),
  };
  data.openRepoFilter = '';
  // Stated rather than inherited: these tests share one component, so a scope
  // taken from the default is really asserting the previous test's leftovers.
  data.branchScope = 'open';
};

const sub = (path, branch = 'feat/a') => ({ repo: 'me/tools', ref: branch, path,
                                            route: 'deck', base: 'main', baseName: 'main' });
// Normalized, because the global is UNSET before anything announces and NULL
// after a release, and the two mean the same thing to a reader of the drawer.
const said = () => window.__tossSubject || null;
const optsFor = (branch) => slideOpts.find(o => o.branch === branch);

// POLLED, NOT COUNTED IN TICKS. The deck builds its slides and each slide's
// Alpine tree inits after it, and a fixed tick count that passes on this file
// alone fails under the whole suite, where the workers are sharing a machine.
// Waiting on the thing itself is the only version that does not rot.
async function openAt(i) {
  seed();
  data.openBranchDetail(data.openBranches[i]);
  for (let n = 0; n < 200 && !(data._deck && slideOpts.length >= 2); n++) await tick(1);
  assert.ok(data._deck, 'the deck opened');
  assert.deepEqual(slideOpts.map(o => o.branch), ['feat/a', 'feat/b'], 'both slides mounted');
  return data._deck;
}

test('a slide reports and the deck announces, so the drawer names the document', async () => {
  await openAt(0);
  assert.equal(said(), null, 'nothing announced before a slide has anything to show');
  optsFor('feat/a').onSubject(sub('docs/SNAGS.md'));
  const s = said();
  assert.ok(s, 'the deck announced');
  assert.equal(s.path, 'docs/SNAGS.md');
  assert.equal(s.base, 'main', 'the base is what the sidebar gates its compare bar on');
  assert.equal(s.route, 'deck', 'an in-document subject, so no deployed twin is offered');
  data.closeDetail(); await tick(4);
});

test('a neighbour settling while the reader is elsewhere is stored, not announced', async () => {
  await openAt(0);
  optsFor('feat/a').onSubject(sub('docs/SNAGS.md'));
  // BY THE DISPATCH, not by what the drawer ends up naming. announceDeckSubject
  // always reads the ACTIVE slide's stored report, so a neighbour getting
  // through would re-announce the SAME document and leave every reading of the
  // subject unchanged. What the condition saves is the event, so count it.
  let fired = 0;
  const on = () => { fired++; };
  window.addEventListener('toss-subject', on);
  try {
    optsFor('feat/b').onSubject(sub('docs/loader.md', 'feat/b'));
    assert.equal(fired, 0, 'the slide in view is not re-announced by its neighbour');
    assert.equal(said().path, 'docs/SNAGS.md', 'and still owns the drawer');
    // ...and stepping to it uses what it already said, rather than waiting for a
    // second report that a settled slide will never make.
    data.onDeckSlide(1);
    assert.equal(fired, 1, 'the step is what announces');
  } finally { window.removeEventListener('toss-subject', on); }
  assert.equal(said().path, 'docs/loader.md');
  assert.equal(said().ref, 'feat/b');
  data.closeDetail(); await tick(4);
});

test('a deck drilled OVER this one owns the subject, so the branch deck stays quiet', async () => {
  const deck = await openAt(0);
  optsFor('feat/a').onSubject(sub('docs/SNAGS.md'));
  // The real stack, pushed by hand: a file deck drilled from the slide is
  // another entry on it, and the kit's own onTop is all this guard reads.
  window.swipeDeck.stack.push({ mine: false });
  try {
    assert.equal(deck.onTop, false, 'precondition: something is over the branch deck');
    optsFor('feat/a').onSubject(sub('docs/other.md'));
    assert.equal(said().path, 'docs/SNAGS.md', 'the drilled deck keeps what it announced');
  } finally {
    window.swipeDeck.stack.pop();
  }
  assert.equal(deck.onTop, true, 'and the branch deck is on top again');
  optsFor('feat/a').onSubject(sub('docs/other.md'));
  assert.equal(said().path, 'docs/other.md', 'which resumes rather than staying stuck');
  data.closeDetail(); await tick(4);
});

test('a slide with nothing readable hands the drawer back rather than keeping the last document', async () => {
  await openAt(0);
  optsFor('feat/a').onSubject(sub('docs/SNAGS.md'));
  assert.ok(data._bChan, 'precondition: the deck holds the channel');
  optsFor('feat/a').onSubject(null);
  // BOTH halves, because announcing an undefined subject and releasing the
  // channel both leave the global falsy, and only one of them is right.
  assert.equal(data._bChan, null, 'the channel was released');
  assert.equal(said(), null, 'and the drawer names nothing off screen');
  optsFor('feat/a').onSubject(sub('docs/SNAGS.md'));
  assert.equal(said().path, 'docs/SNAGS.md', 'and claimed again when one arrives');
  data.closeDetail(); await tick(4);
});

test('closing the deck puts back whatever the drawer was pointed at', async () => {
  await openAt(0);
  optsFor('feat/a').onSubject(sub('docs/SNAGS.md'));
  assert.ok(said());
  data.closeDetail();
  await tick(4);
  assert.equal(said(), null, 'the shell owns the drawer again');
  assert.deepEqual(Object.keys(data._slideSubject), [], 'and no slide report outlives the deck');
});

test('a report from a slide the deck has released is dropped', async () => {
  const deck = await openAt(0);
  optsFor('feat/b').onSubject(sub('docs/loader.md', 'feat/b'));
  assert.ok(data._slideSubject[1], 'stored while the slide is built');
  deck.deck.drop(1);
  assert.equal(data._slideSubject[1], undefined,
    'a stale report would name a document no slide is showing');
  data.closeDetail(); await tick(4);
});

// The chain, read from the source: this fixture hands the kit to the window
// directly, so nothing here would notice the deck no longer asking for it. In
// the app that is a silent failure rather than an error, since the pre-build
// inlines only what something reaches: announceDeckSubject would find no
// subjectChannel and return, and the drawer would quietly go back to naming
// app/index.html.
test('the branch deck asks for the subject-channel kit it now owns', () => {
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8');
  const chain = src.slice(src.indexOf('async mountDeck('));
  const line = chain.slice(0, chain.indexOf('await gh.load(k)'));
  assert.match(line, /kits\/subject-channel\.js/,
    'the branch deck loads it, in the chain that is readable in one place');
});
