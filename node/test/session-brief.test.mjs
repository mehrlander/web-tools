// alpineComponents/session-brief.js — one captured session as a page.
//
// The view was inside pages/session.html until 2026-08-27, where its only
// possible host was that page. Lifting it into a component gave it a second
// host, the app's Sessions pane, which mounts one per slide so a session can
// be swiped through the way a branch already is. That is the whole reason this
// file exists, and the two things worth pinning follow from it:
//
//   The HEAD renders before the record does. A slide is handed the sessions
//   cache's row as `facts`, so its title, its strip and its closing reply are
//   right in the first frame and only the outline waits on the JSON. A view
//   that blanked until the fetch landed would flash on every swipe.
//
//   The RECORD is read once per session, not once per visit. The deck reuses
//   one mount per slide, so stepping back to a slide must not refetch, and the
//   memo lives at module scope for exactly that reason.
//
// Driven over a fake GH; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const PATH = 'sessions/2026/08/2026-08-05-b8fae678.json';
const TOPICS_PATH = 'sessions/topics/2026/08/2026-08-05-b8fae678.json';

const record = {
  schema: 4, short: 'b8fae678', day: '2026-08-05',
  started: '2026-08-05T13:00:00Z', ended: '2026-08-05T16:00:00Z',
  agent_session: 'https://claude.ai/code/session_01SX',
  repos: [{ name: 'web-tools', branch: 'claude/a-1' }],
  opening_ask: 'do the thing', exchanges: 2, calls_total: 40, failures: 1,
  files_total: 2, tokens: { output: 337631 },
  prompts: [{ at: '2026-08-05T13:00:00Z', text: 'do the thing' }],
  replies: [{ at: '2026-08-05T13:30:00Z', text: 'partway through' },
            { at: '2026-08-05T15:59:00Z', text: 'and here is what came of it' }],
  calls: [],
};

// What the Sessions pane lends a slide: the cache's own row, which holds every
// number on the strip.
const facts = {
  id: 'b8fae678', day: '2026-08-05', title: 'a named session',
  started: record.started, ended: record.ended, repos: record.repos,
  ask: 'do the thing', reply: 'a closing reply the cache carried', replyCut: '',
  exchanges: 2, calls: 40, failures: 1, filesTotal: 2, schema: 4,
  tokens: { output: 337631 }, agent: record.agent_session,
};

// ONE ORDERED LOG, not two counters. What has to be provable is that the lent
// slide reached its blob without a listing preceding it, and two independent
// tallies cannot say which came first.
const log = [];
const gets = () => log.filter(l => l.startsWith('get:'));
// The store's tree listing, which is what the once-only rule is about. A
// standalone mount also lists each repo's user-calls/ folder, a different read.
const trees = () => log.filter(l => l.startsWith('tree:') && !l.startsWith('tree:contents/user-calls'));
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  async get(p) {
    log.push('get:' + this.repo + ':' + p);
    // `__recordPatch` and `__recordSha` let a test serve a later record, and
    // the blob sha GitHub reports beside it, without a second fixture.
    if (p === PATH) return { text: JSON.stringify({ ...record, ...(window.__recordPatch || {}), readFrom: this.repo }),
                             sha: window.__recordSha || undefined };
    // Gemini's topics file, on the branch the laptop daemon writes, and only
    // there: a read of it from main is a bug, and it 404s like one.
    if (p === TOPICS_PATH && this.ref === 'background' && window.__topicsDoc) {
      if (window.__topicsDelay) await new Promise(r => setTimeout(r, window.__topicsDelay));
      return { text: JSON.stringify(window.__topicsDoc) };
    }
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p) {
    log.push('tree:' + p);
    return { tree: [{ type: 'blob', path: PATH }] };
  }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="lent" x-data="sessionBrief(window.__lent)"></div>
    <div id="cold" x-data="sessionBrief(window.__cold)"></div>
    <div id="stem" x-data="sessionBrief(window.__stem)"></div>
    <div id="unread" x-data="sessionBrief(window.__unread)"></div>
  </body></html>`,
});
window.GH = FakeGH;
window.TOKEN = 'tkn';
// The loader, as a log. `ready()` is the component's only use of it, and the
// last test in this file is about WHEN that runs.
const loads = [];
window.gh = { load: async (k) => { loads.push(k); } };
// The kit chain the component reads. Stubbed rather than loaded: what the deck
// DOES with a record is session-render.js's own test, and the outline is
// session-export.js's.
window.claudeMark = { svg: () => '<svg></svg>' };
const opened = [];
window.sessionRender = {
  describe: (r) => ({ title: 'described ' + r.short, subtitle: '' }),
  turns: (r) => (r.replies || []),
  groups: (t) => t.map(x => [x]),
  open: async (r, o) => { opened.push({ short: r.short, ...o }); return { close(){} }; },
};
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
window.chatRender = { block: () => window.document.createElement('pre') };
window.swipeDeck = { top: () => null };

// A slide is handed its row; a cold page is handed an id and nothing else.
window.__lent = { id: 'b8fae678', day: '2026-08-05', repo: STORE, framed: true, facts,
                  onMeta: (m) => { window.__meta = m; } };
window.__cold = { id: 'b8fae678', repo: STORE };
// The same session addressed by the whole filename stem, which is what the
// store's directory listing shows and therefore what a hand-built link tends to
// carry. Both forms have to land on one record.
window.__stem = { id: '2026-08-05-b8fae678', repo: STORE };
// A row whose record cannot be read. It is the state every slide passes through
// on its way to loaded, and it is also a real end state: the store is private,
// so a reader whose token cannot reach it still gets everything the cache knew.
window.__unread = { id: 'nosuch', day: '2026-08-05', repo: STORE, framed: true,
                    facts: { ...facts, id: 'nosuch' } };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
// pathOf lives in the sessions cache kit, and the component reads it there
// rather than deriving a second copy. The Sessions pane always has it loaded;
// a cold pages/session.html does not, which is the case the listing covers.
// repo-address.js is booted by every page; the component's GitHub links are
// built by window.RepoAddress.github.
for (const k of ['lib/kits/repo-address.js', 'lib/kits/closing-state.js', 'lib/kits/repo-sessions-cache.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/alpine-bundle.js', 'lib/alpineComponents/session-brief.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
await tick(6);

const lent = () => Alpine.$data(window.document.getElementById('lent'));
const cold = () => Alpine.$data(window.document.getElementById('cold'));
const stem = () => Alpine.$data(window.document.getElementById('stem'));
const strip = (d) => Object.fromEntries(d.strip.map(f => [f.k, f.v]));

test('mounting is quiet', () => {
  assert.deepEqual(problems, []);
});

// ── The head, before the record ─────────────────────────────────────────────

test('a lent row renders the strip and the title without waiting on the record', () => {
  // Every value here comes from `facts`. The assertion that matters is that
  // they are present at all: a slide that blanked until its fetch landed would
  // flash the whole head on every swipe.
  const s = strip(lent());
  assert.equal(s.calls, 40);
  assert.equal(s.failures, 1);
  assert.equal(lent().timeFacts.span, '3h 0m', 'how long it ran is the time panel\'s');
  assert.equal(s.repos, 'web-tools');
  // Short and friendly (owner, 2026-10-22), with the year only past a year
  // ago, so this holds whichever side of that line the suite runs on.
  assert.match(s.day, /^Aug 5(, 2026)?$/);
});

test('the strip carries four facts and no more, and names which', () => {
  // A CEILING, not a list for its own sake. Nine facts wrapped the strip to
  // three lines at 430px, half of a phone's head, and two of the nine were
  // printed again 44px below as the Outline and Files tab counts. `asks` and
  // `files` went for that duplication, `schema` because it is the record
  // FORMAT's version rather than a fact about the session, and `out tokens`
  // because nothing reads differently for a large one. `ran` went into the
  // start date's panel on 2026-10-22, beside when the session last moved.
  // Array.from, because a getter's return reaches a test through Alpine's
  // reactive proxy and deepEqual compares prototypes.
  assert.deepEqual(Array.from(lent().strip, f => f.k),
    ['day', 'calls', 'failures', 'repos']);
});

test('a count is a glyph that opens its panel; only the self-naming values are text', () => {
  // `f.k` stays the fact's NAME, which the notes and these tests key on. A date
  // reads as a date, so it draws bare; 251 does not read as calls, and since
  // 2026-10-22 the glyph says so, as on the Activity view's Sessions row, with
  // the unit in words in the panel the glyph opens. So no fact draws a unit
  // word any more.
  const f = Object.fromEntries(lent().strip.map(x => [x.k, x]));
  assert.deepEqual(Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x.unit])),
    { day: '', calls: '', failures: '', repos: '' });
  assert.equal(f.calls.icon, 'ph-wrench');
  assert.equal(f.calls.panel, 'tools');
  assert.equal(f.failures.panel, 'tools', 'failures open the same list, where the failing tool is named');
  assert.equal(f.failures.tone, 'text-warning');
  assert.equal(f.day.panel, 'time', 'the date opens when it ran');
  assert.equal(f.day.icon, '', 'and draws no glyph: the date names itself');
});

test('a zero failure count is stated in the tools panel, not on the strip', () => {
  // "no failures" and "not captured" are different answers, and the panel is
  // where the first one is said: its header reads "none failed". The strip
  // follows the Sessions row, where failures ride the tools card and take a
  // place of their own only when there are some (2026-10-22). Measured zero
  // calls still count, which is why the filter tests `v === 0`.
  const bare = { id: 'x', day: '2026-08-05', exchanges: 0, calls: 0, failures: 0 };
  window.__probe = { id: 'x', repo: STORE, facts: bare, record: null };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__probe)');
  window.document.body.append(el);
  Alpine.initTree(el);
  const d = Alpine.$data(el);
  const s = Object.fromEntries(d.strip.map(f => [f.k, f.v]));
  assert.equal(s.calls, 0, 'measured zero calls is a fact');
  assert.ok(!('failures' in s), 'a zero failure count leaves the strip');
  assert.equal(d.toolTally.failures, 0, 'and the panel has it to state');
  assert.equal(d.timeFacts.span, '', 'a duration nothing could compute is absent, not zero');
  assert.ok(!('agents' in s), 'and so is a fan-out nobody ran');
});

test('an unreadable record costs the outline and nothing else', () => {
  // The store is private, so a reader whose token cannot reach it still gets
  // everything the cache knew. What it loses is the record, and therefore the
  // outline; the head is the row's the whole time and does not blank.
  const d = Alpine.$data(window.document.getElementById('unread'));
  assert.equal(d.record, null, 'this record could not be read');
  assert.match(d.err, /Could not open nosuch/, 'and it says so rather than reading as empty');
  assert.equal(Object.fromEntries(d.strip.map(f => [f.k, f.v])).calls, 40);
});

// ── The read ────────────────────────────────────────────────────────────────

test('a lent day derives the store path, so a slide never reads the tree', () => {
  // The guess is right for every row the sessions cache built, and the listing
  // behind it is a recursive tree read of a private store. A deck of twenty
  // sessions must not pay for it twenty times, or once. The ORDER is the proof:
  // the first call this fixture made at all was the lent slide's own blob.
  assert.equal(log[0], 'get:' + STORE + ':' + PATH,
    'the lent slide went straight to its blob, with no listing ahead of it');
  assert.equal(lent().path, PATH);
});

test('a cold mount with no day resolves the id against the store listing', () => {
  assert.equal(cold().path, PATH);
  // Once for the whole store, however many mounts need it: this fixture has
  // two (the cold one, and the one whose derived path 404s and falls through).
  assert.equal(trees().length, 1, 'exactly one listing read');
});

test('the dated stem resolves to the same record as the bare id', () => {
  // The two names are in front of a reader in different places: every surface
  // PRINTS b8fae678, and the store's own directory listing SHOWS
  // 2026-08-05-b8fae678.json. A link built from the listing used to reach the
  // "No record" error on a record that was sitting in the tree, and the error
  // called the id a filename stem while refusing one (2026-09-05).
  assert.equal(stem().path, PATH);
  assert.equal(stem().err, '', 'the stem form is not an error state');
});

test('the record is read once, however many mounts ask for it', () => {
  // Three components mounted, two of them landing on this path within a tick.
  // The memo holds the PROMISE, not the settled record, which is the only
  // version of it that survives concurrent slides: caching after the await lets
  // every caller miss and fetch.
  assert.equal(gets().filter(g => g === 'get:' + STORE + ':' + PATH).length, 1);
});

test('record reads share a promise per repository and path without crossing stores', async () => {
  const boxes = [];
  window.__otherStore = { path: PATH, repo: 'another/private', framed: true, compact: true };
  for (let i = 0; i < 2; i++) {
    const box = window.document.createElement('div');
    box.setAttribute('x-data', 'sessionBrief(window.__otherStore)');
    window.document.body.append(box);
    Alpine.initTree(box);
    boxes.push(box);
  }
  await tick(6);
  assert.equal(gets().filter(g => g === 'get:another/private:' + PATH).length, 1);
  assert.ok(boxes.every(box => Alpine.$data(box).record.readFrom === 'another/private'));
  assert.equal(lent().record.readFrom, STORE);
  boxes.forEach(box => { Alpine.destroyTree(box); box.remove(); });
});

test('the record overwrites what the row lent', () => {
  const d = lent();
  assert.equal(d.record.short, 'b8fae678');
  assert.equal(d.head.title, 'described b8fae678', 'describe owns the name once the record is here');
});

// The closing reply, and the fidelity label that said whether it was the whole
// turn or the recorder's 500-character tail, were asserted here over a block
// this view drew above the tab row. The block went on 2026-09-06 and both
// claims are still gated, one surface over: estate-sessions.test.mjs holds
// `replyTurns` to the same reply and `replyLabel` to the same "final turn, tail
// only" wording, on the Sessions card that renders it properly. Two copies of
// one assertion was what this file had; the one that stayed is on the view that
// still draws the thing.

test('the host is told what only a finished read knows', () => {
  // The deck header names a session before its record is here, off the row. The
  // title a record carries can differ, and the Claude session link exists only
  // on a record written after 2026-08-07, so both come back this way.
  assert.equal(window.__meta.title, 'described b8fae678');
  assert.equal(window.__meta.agent, 'https://claude.ai/code/session_01SX');
  assert.equal(window.__meta.path, PATH);
});

// ── The deck door ───────────────────────────────────────────────────────────

test('the cards button opens the record at the card it was asked for', async () => {
  opened.length = 0;
  await lent().openDeck(7);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].short, 'b8fae678');
  assert.equal(opened[0].start, 7, 'an outline row hands over which card it was');
});

test('an open deck becomes the parent, so the cards drill rather than stack', async () => {
  // Opened from a deck of sessions, the cards are one level DOWN: Back returns
  // to the session rather than closing the reader out of everything. The same
  // seam branch-brief's file deck takes one object over.
  opened.length = 0;
  const parent = { id: 'parent-deck' };
  window.swipeDeck.top = () => parent;
  try {
    await lent().openDeck();
    assert.equal(opened[0].parent, parent);
    assert.ok(!('start' in opened[0]), 'no card named means no start, not slide 0 forced');
  } finally { window.swipeDeck.top = () => null; }
});


// ── The Files pane ──────────────────────────────────────────────────────────
// The strip counted the files a session opened and nothing routed to them. The
// record holds the whole map, so the list costs no read; what it cannot hold is
// the OWNER of each checkout, which is why the link is the host's to supply.

test('files are listed by the cache\'s own weight, and the badges carry the rest', async () => {
  window.__files = {
    repo: STORE,
    record: {
      short: 'f', schema: 3,
      files: {
        'web-tools/docs/read-a-lot.md': { read: 9 },
        'web-tools/lib/edited.js': { read: 1, edit: 6 },
        'home/untouched.md': { read: 1 },
      },
    },
  };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__files)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(2);
  const rows = Alpine.$data(el).fileRows;
  // The sessions cache's fileWeight is a PLAIN SUM: every access counts one, an
  // edit the same as a read. So nine reads (9) outrank one read and six edits
  // (7), which is not what "worked on" means to a reader and is exactly why the
  // per-kind badges are on the row. Pinned as the kit's rule rather than as a
  // rule of this pane's, since a pane that reordered would disagree with the
  // Sessions row's hover card over the same files.
  assert.equal(rows[0].path, 'web-tools/docs/read-a-lot.md');
  assert.equal(rows[1].path, 'web-tools/lib/edited.js');
  assert.equal(rows.at(-1).path, 'home/untouched.md');
  // The path splits so a column of long paths reads by its right-hand end.
  assert.equal(rows[1].dir, 'web-tools/lib/');
  assert.equal(rows[1].name, 'edited.js');
  // One badge per kind, heaviest first, and a zero is never drawn.
  // Joined rather than deep-compared: Alpine hands back reactive proxies, which
  // are structurally equal to a plain array and never reference-equal.
  assert.equal(rows[1].kinds.map(k => k.label + k.n).join(','), 'edit6,read1');
  assert.equal(rows[2].kinds.map(k => k.label + k.n).join(','), 'read1');
  assert.equal(rows[0].href, '', 'no host resolver means no link, not a guessed one');
});

test('an empty list says which kind of empty it is', async () => {
  const mount = (record) => {
    window.__e = { repo: STORE, record };
    const el = window.document.createElement('div');
    el.setAttribute('x-data', 'sessionBrief(window.__e)');
    window.document.body.append(el);
    Alpine.initTree(el);
    return Alpine.$data(el);
  };
  // "Opened nothing" and "never captured" are different answers and only one is
  // about the session, the same distinction the Sessions row draws with its
  // dimmed files glyph.
  assert.match(mount({ short: 'a', schema: 2 }).filesNote, /predates file-attention capture/);
  assert.match(mount({ short: 'b', schema: 4, files: {} }).filesNote, /No files were opened/);
});

test('a host resolver turns each row into a real anchor', async () => {
  window.__linked = {
    repo: STORE,
    record: { short: 'g', schema: 3, files: { 'web-tools/lib/a.js': { edit: 1 } } },
    fileHref: (path) => 'https://example.test/' + path,
  };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__linked)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(4);
  assert.equal(Alpine.$data(el).fileRows[0].href, 'https://example.test/web-tools/lib/a.js');
  // THE RENDER, not just the getter. The first draft picked the element with
  // <component :is="f.href ? 'a' : 'span'">, which is Vue's idiom and not
  // Alpine's: it renders an unknown <component> tag showing its children, so
  // every row looked exactly right and none of them linked. A getter assertion
  // could never have seen that.
  const a = el.querySelector('a[href="https://example.test/web-tools/lib/a.js"]');
  assert.ok(a, 'the row renders an <a> carrying the resolved href');
  assert.equal(a.getAttribute('target'), '_blank');
  assert.match(a.textContent.replace(/\s+/g, ''), /^web-tools\/lib\/a\.js$/);
});

test('an unresolved row renders an anchor with no href, so it is text', async () => {
  window.__plain = {
    repo: STORE,
    record: { short: 'i', schema: 3, files: { 'x/y.js': { read: 1 } } },
  };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__plain)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(4);
  const a = [...el.querySelectorAll('a')].find(n => n.textContent.includes('y.js'));
  assert.ok(a, 'the row is still drawn');
  assert.equal(a.getAttribute('href'), null, 'an href-less anchor is plain text, not a dead link');
});

test('a resolver that throws costs its link and nothing else', async () => {
  // The host reaches into estate state to resolve an owner, so it can fail on a
  // row the crawl has not placed. A pane that threw would take the whole brief
  // down with it for one unresolvable path.
  window.__bad = {
    repo: STORE,
    record: { short: 'h', schema: 3, files: { 'x/y.js': { read: 1 } } },
    fileHref: () => { throw new Error('no such repo'); },
  };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__bad)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(2);
  const rows = Alpine.$data(el).fileRows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].href, '');
});

// ── Landing where the address said ──────────────────────────────────────────

test('pane picks the tab, and an unknown one falls back rather than blanking', () => {
  const at = (pane) => {
    window.__p = { repo: STORE, record: { short: 'p', schema: 4 }, pane };
    const el = window.document.createElement('div');
    el.setAttribute('x-data', 'sessionBrief(window.__p)');
    window.document.body.append(el);
    Alpine.initTree(el);
    return Alpine.$data(el).pane;
  };
  assert.equal(at('files'), 'files');
  assert.equal(at('raw'), 'raw');
  assert.equal(at('outline'), 'outline');
  assert.equal(at('nonsense'), 'outline');
  assert.equal(at(undefined), 'outline');
});

test('start opens the deck on one card, which is what makes an exchange addressable', async () => {
  opened.length = 0;
  window.__card = { repo: STORE, record, start: 3 };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__card)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(4);
  assert.equal(opened.length, 1, 'the address named a card, so the deck opened on it');
  assert.equal(opened[0].start, 3);
});

// ── The kit chain, and what skipping the fetch must not skip ────────────────

test('a mount handed its record still loads the kit chain', async () => {
  // `load()` short-circuits when the record is already in hand, and until
  // 2026-09-01 it returned BEFORE `ready()`. That path is the one a reader with
  // no token takes (#gz=), and it was giving them the worst copy of the page:
  // no speaker on the deck, no markdown anywhere, markdown markers down every
  // row of the picker. The skip is of the FETCH, never of the renderers.
  loads.length = 0;
  log.length = 0;
  const el = window.document.createElement('div');
  window.__handed = { record, repo: STORE, framed: true };
  el.setAttribute('x-data', 'sessionBrief(window.__handed)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(6);
  const d = Alpine.$data(el);
  assert.equal(d.record.short, 'b8fae678');
  // The Calls tab lists the session's user calls (session-calls-tab.test.mjs);
  // that read is not the record's.
  assert.deepEqual(log.filter(l => !l.startsWith('tree:contents/user-calls')), [], 'and it still reads no record from the store');
  assert.ok(loads.includes('kits/read-aloud.js'),
    'the kit the deck speaks with and the picker rows reduce their previews through');
  assert.ok(loads.includes('kits/session-render.js'), 'and the one settle() renders with');
});

test('the brief fills its host, rather than drawing a phone column on a desktop', () => {
  // It carried `mx-auto` with `max-w-2xl`, so a 1280px browser drew a 672px
  // strip down the middle with the rest empty (reported 2026-09-01). The house
  // style names that exact pattern, and the estate's branch list already made
  // the same call: full width once nothing stands beside it to claim the space.
  //
  // Read off the SOURCE, not the DOM, because jsdom compiles no Tailwind and a
  // cap that is present renders as nothing here. The template is the artifact.
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8');
  const shell = src.match(/<div class="([^"]*)"\s*\n\s*:class="framed \?/);
  assert.ok(shell, 'the outer shell div, the one the framed/standalone class rides');
  assert.doesNotMatch(shell[1], /\bmax-w-|\bmx-auto\b/, shell[1]);
  assert.match(shell[1], /\bw-full\b/);
});

test('the closing-reply block is gone, and nothing here flattens markdown', () => {
  // A clamped, expandable block drew the session's last reply above the tab
  // row. It cost 124px of a 932px phone, a quarter of everything standing
  // between the reader and the first card, and it was the third copy of one
  // claim: the estate's Sessions card renders that reply properly, and the
  // record's last outline row previews it. Removed 2026-09-06.
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8');
  for (const gone of ['closingRaw', 'closingLabel', 'closingOpen', 'closingBody', 'CLAMP'])
    assert.doesNotMatch(src, new RegExp(gone), gone + ' went with the block');

  // THE FLATTENING GATE OUTLIVES THE BLOCK, and always did: it is scoped to the
  // whole file, not to that markup. A reply was arriving with its bold markers
  // showing because this component reduced markdown to text itself instead of
  // calling the kit that renders every other turn. A second such pass sitting
  // here is what would get reached for next time.
  assert.doesNotMatch(src, /speechText/, 'session-brief no longer flattens anything itself');

  // And the tooltip rule the block was the worked case of. A FACT may not ride
  // in a title: no touch screen shows one and no screenshot captures one.
  const el = window.document.getElementById('lent');
  assert.equal(el.querySelectorAll('.cursor-help').length, 0);
});

test('a clamped box is never a button, because Safari sizes one from its unclipped content', () => {
  // THIS GUARD MOVED RATHER THAN GOING. Its subject was the closing block, a
  // <button> wrapping a clipped body: Safari sizes a button from its UNCLIPPED
  // content, so the body clipped, the fade landed, and the button stood as tall
  // as five paragraphs. Chrome sizes from the clipped child and shows nothing
  // wrong, which is why this is asserted as structure and never as pixels.
  //
  // The rule outlived the block. session-export's row title is a two-line
  // `line-clamp` and is a role="button" div for exactly this reason, stated in
  // `asTrigger`, and that is now the estate's only clamped trigger. Snag:
  // safari-button-sizes-from-unclipped-content.
  const src = readFileSync(path.join(repoRoot, 'lib/kits/session-export.js'), 'utf8');
  const at = src.indexOf('const asTrigger = (el, key, host, label, fill) => {');
  assert.ok(at > 0, 'the row trigger, which is what carries the clamped line');
  const fn = src.slice(at, src.indexOf('\n    };', at));
  assert.match(fn, /setAttribute\('role', 'button'\)/, 'a role, so it keeps the reach');
  assert.match(fn, /setAttribute\('tabindex', '0'\)/);
  assert.doesNotMatch(fn, /h\('button'/, 'and never the element, which would size from the clip');
});

test('a fact carries its definition on data-title-tip, not in a title', () => {
  const d = lent();
  const el = window.document.getElementById('lent');
  // Half the strip is exact about something the plain word is not, so the
  // definitions are load-bearing. They rode in a `title` with `cursor-help`:
  // no touch screen shows one and no screenshot captures one.
  assert.equal(el.querySelectorAll('.cursor-help').length, 0);
  // Scoped to the strip and the head, not the whole view: the icon-only
  // controls below carry their labels too, as title-tips since 2026-10-16 (a
  // `title` before that). What may not sit in a title is a FACT.
  const strip = el.querySelector('.flex.flex-wrap.items-center.gap-x-2\\.5');
  assert.ok(strip, 'the facts strip');
  assert.equal(strip.querySelectorAll('[title]').length, 0, 'no fact is stranded in a title');
  // Three kinds of fact since 2026-10-22, and each carries its words its own
  // way. A TEXT fact (day, ran) has its definition on a title-tip. A GLYPH fact
  // is a button whose panel names the unit, so it carries an aria-label rather
  // than a title-tip, which a hover would draw over the panel it opens. The
  // SCOPE is one pill holding each repository's mark, and a button of the
  // same kind: it opens the checkouts panel (owner, 2026-10-22).
  const text = d.strip.filter(f => !f.panel && f.k !== 'repos');
  const glyphs = d.strip.filter(f => f.panel);
  assert.deepEqual(Array.from(text, f => f.k), [], 'every fact is a glyph or the date, each opening its panel');
  // The Gemini mark is a button of the same kind and no fact of the record's;
  // its own tests are below, with the topics file.
  const buttons = [...strip.querySelectorAll('[data-fact-btn]:not([data-gemini-mark])')];
  assert.equal(buttons.length, glyphs.length, 'one button per glyph fact');
  for (const b of buttons) {
    assert.ok(!b.hasAttribute('data-title-tip'), 'a glyph fact draws no title-tip over its panel');
    assert.ok(b.getAttribute('aria-label'), 'and names itself to a reader who gets neither');
  }
  const pill = strip.querySelectorAll('[data-scope-pill]');
  assert.equal(pill.length, 1, 'one pill for the whole scope');
  assert.equal(pill[0].getAttribute('aria-label'), 'Checked out: web-tools');
  assert.ok(pill[0].hasAttribute('data-fact-btn'), 'and it opens a panel like the counts do');
  assert.equal(pill[0].querySelectorAll('i.ph').length, d.scopeRepos.length, 'a mark per repository inside it');

  // THROUGH THE KIT, NOT A SECOND IMPLEMENTATION OF IT. `kits/title-tip.js` is this
  // estate's tier between a title and a built panel, and a strip definition is
  // what that kit calls its own case: a string a reader looks at. This file
  // hand-rolled a tap-to-reveal line for one commit, which was that kit again
  // with no keyboard, no screen reader and no affordance before the tap.
  const noted = [...el.querySelectorAll('[data-title-tip]')]
    .filter(n => !n.closest('[role="search"]') && !n.hasAttribute('data-scope-pill'));
  // Every fact, plus notes that are not facts about the SESSION: the id, the
  // `running <ref>` marker naming the ref this page's own code booted from,
  // the pages mark, and the follow-up summary's note saying Gemini wrote it,
  // not the record. The scope row's microphone was the fifth until it came
  // off on 2026-10-22. They are found
  // by SUBTRACTING the strip rather than by matching their own text, so the
  // count stays exact without a second list to keep in step.
  //
  // TWICE NOW A BRANCH HAS ADDED ONE while this count was written on main, and
  // both times the merge is what taught the gate about it. That is the gate
  // working: a note is cheap to add and this is the only thing that asks what
  // it is for, so it is raised by naming the newcomer, never by loosening the
  // comparison.
  const shownValues = new Set(text.map(f => String(f.v) + (f.unit ? ' ' + f.unit : '')));
  const extras = noted.filter(n => !shownValues.has(n.textContent.replace(/\s+/g, ' ').trim()));
  // The other nine are the labels on the icon-only controls: Contents, On
  // GitHub, Previous view, Next view, Open the page in a new tab, Swipe through
  // every view full screen, Read n cards one at a time, Open this session in
  // Claude Code, and The stored record on GitHub.
  assert.equal(extras.length, 13,
    'the id, the running-ref marker, the pages mark, the Gemini summary and nine control labels off-strip: '
    + JSON.stringify(extras.map(n => n.textContent.trim() || n.getAttribute('data-title-tip'))));
  assert.equal(noted.length, text.length + 13, 'every text fact and those thirteen, and nothing else');
  // MATCHED ON THE VALUE, not on the fact's name, because the name is no longer
  // drawn: the strip renders `2026-08-05` and `40 calls`, so a lookup keyed on
  // "day" or "calls" would find the definition of whichever fact happened to
  // start with those letters. The rendered text is what a reader points at, so
  // it is what the note has to be attached to.
  const byNote = new Map(noted.map(n => [n.textContent.replace(/\s+/g, ' ').trim(), n.getAttribute('data-title-tip')]));
  for (const f of text) {
    const shown = String(f.v) + (f.unit ? ' ' + f.unit : '');
    assert.ok(byNote.has(shown), 'strip row ' + f.k + ' is on the page as "' + shown + '"');
    assert.equal(byNote.get(shown), f.t,
      'and states the definition the strip carries, not a copy of it');
  }
  // The id's own note, pinned by what it must NOT say. It called the id the
  // record's filename stem, which it is not: the stem carries the date as well
  // (2026-08-05-b8fae678), and reading the note as written is what produced a
  // dead session link on 2026-09-05. The positive wording is free to move; the
  // conflation is what has to stay fixed.
  const idNote = noted.find(n => /^\(/.test(n.textContent))?.getAttribute('data-title-tip') || '';
  assert.ok(idNote.length > 20, 'the id carries a definition');
  assert.doesNotMatch(idNote, /filename stem/, 'the id is part of the stem, not the whole of it');
});

test('the kit that draws the title-tips is in the chain that loads them', () => {
  // A `data-title-tip` with nothing listening is a fact that renders as a dotted
  // underline and says nothing when touched, which is worse than the title it
  // replaced. Nothing else on this page loaded the kit before.
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8');
  assert.match(src, /'kits\/title-tip\.js'/);
  assert.match(src, /'kits\/closing-state\.js'/);
  // The early return must count every kit the chain loads, or a host that
  // already has the first three skips the rest and the page renders half-drawn.
  assert.match(src, /&& window\.TitleTip && window\.ClosingState\) return;/,
    'the early return counts them, or the chain never runs');
});

test('the page tells the brief that no embedder draws its header', () => {
  // `framed` on the PAGE means it sits in an iframe; `framed` on the BRIEF
  // means a host draws the title and the id. The first is true of a toss and
  // the second is true only of the app's Sessions pane, which mounts the
  // COMPONENT rather than this page. Passing one for the other left a tossed
  // session with no title and no id anywhere on screen.
  const page = readFileSync(path.join(repoRoot, 'pages/session.html'), 'utf8');
  assert.match(page, /opts = \{ \.\.\.opts, framed: false,/,
    'the page hands the brief a literal, not its own iframe test');
  assert.doesNotMatch(page, /framed: this\.framed/, 'and no address form still passes it through');
  // The page keeps its own flag, which still stands its address bar down.
  assert.match(page, /x-show="!framed \|\| !target"/);
});

// ── The scope ───────────────────────────────────────────────────────────────
// The checkouts the session stood in, drawn as one pill on the strip. A
// microphone beside it opened a follow-up session on the same scope until
// 2026-10-22; it went unused and came off, and its tests with it.

test('the wider `attached` list wins where the record carries it', () => {
  // Record schema 8. `repos` is where the shell stood and misses a checkout
  // worked entirely through absolute paths; `attached` is what the container
  // held. The union is what the pill draws.
  const d = lent();
  const was = d.rec;
  try {
    d.record = { ...was, attached: ['home', 'web-tools'] };
    assert.deepEqual([...d.scopeRepos], ['home', 'web-tools']);
  } finally { d.record = was; }
});

test('the checkouts panel lists every branch with work on it, under its repository', () => {
  // Best evidence first: a push the record names (schema 15), else commits
  // past main at the last stop that never left the container. A branch with
  // neither is only the checkout's name and is not listed; the repository
  // says "no commits" instead. A record older than both fields says nothing.
  const d = lent();
  const was = d.record;
  const shape = () => Object.fromEntries(Array.from(d.scopeRows, g =>
    [g.name, g.branches.length ? Array.from(g.branches, b => b.branch + ': ' + b.word) : g.word]));
  try {
    d.record = { ...d.rec, schema: 15, attached: ['home', 'web-tools', 'web-tools-private'],
      repos: [{ name: 'home', branch: 'claude/a-1', ahead_base: 2 },
              { name: 'web-tools', branch: 'claude/a-1', ahead_base: 0 },
              { name: 'web-tools-private', branch: 'claude/a-1', ahead_base: 0 }],
      pushed: [{ name: 'web-tools', branch: 'claude/a-1' }, { name: 'web-tools', branch: 'claude/b-2' },
               { name: 'wt-extra', branch: 'claude/c-3' }] };
    assert.deepEqual(shape(), {
      home: ['claude/a-1: 2 commits, not pushed'],
      'web-tools': ['claude/a-1: pushed', 'claude/b-2: pushed'],
      'web-tools-private': 'no commits',
      'wt-extra': ['claude/c-3: pushed'],
    }, 'two pushed branches in one repository are two lines, a bare checkout branch is none, '
       + 'and a checkout the session only pushed from is still a checkout');
    assert.equal(d.scopePushed, 3, 'the header counts branches pushed');
    assert.match(d.scopeRows[0].branches[0].url, /branch\.html#gh=me\/home@claude%2Fa-1$/);
    // What the page read live, once loadWork has run: the PR, the branch's
    // place in the branch deck, and how many files it changed (files, not
    // renderable views, since 2026-10-22).
    const work = d.work.branches;
    d.work.branches = [{ repoShort: 'web-tools', branch: 'claude/z-9', ahead: 1 },
                       { repoShort: 'home', branch: 'claude/a-1', pr: 7, prState: 'open', prUrl: 'pr7', ahead: 2,
                         files: 5, url: 'live-url' }];
    const home = d.scopeRows[0].branches[0];
    assert.deepEqual([home.pr, home.prState, home.files, home.word, home.url, home.n],
                     [7, 'open', 5, 'pushed', 'live-url', 1]);
    assert.equal(d.scopeRows.find(g => g.name === 'web-tools-private').branches.length, 0);
    d.work.branches = work;
    d.record = { ...d.rec, schema: 4, attached: undefined, pushed: undefined,
      repos: [{ name: 'web-tools', branch: 'claude/a-1' }] };
    assert.deepEqual(shape(), { 'web-tools': '' }, 'an old record makes no claim about commits');
  } finally { d.record = was; }
});

test('a Markdown view born with an empty html is read, once', async () => {
  // Views are created with html '', and a fill that waited for html to be
  // undefined read none of them: every document in the strip rendered blank.
  const d = lent();
  const was = window.marked;
  window.marked = { parse: (t) => '<p>' + t.length + '</p>' };
  try {
    const views = [{ kind: 'md', slug: STORE, branch: 'main', path: PATH, html: '' },
                   { kind: 'html', slug: STORE, branch: 'main', path: 'x.html', html: '' }];
    const before = gets().length;
    await d.fillMarkdown(views);
    assert.match(views[0].html, /^<p>\d+<\/p>$/, 'the document is read and rendered');
    assert.equal(views[1].html, '', 'a page is left to its frame');
    await d.fillMarkdown(views);
    assert.equal(gets().length, before + 1, 'and a second ask reads nothing again');
  } finally { window.marked = was; }
});

test('one container: the views are a tab and the calls are the Calls tab\'s alone', () => {
  // The page drew two: the head and a views card exactly one screen tall,
  // with the tabs a screen down, and the user calls listed above them as
  // well as in their own tab (owner, 2026-10-22). Read off the source, since
  // jsdom lays nothing out.
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8');
  const at = src.indexOf('── NOW: where the session');
  const now = src.slice(at, src.indexOf('</section>', at));
  assert.ok(at > 0 && now.length > 2000, 'the Now section, found and whole');
  assert.doesNotMatch(now, /in calls"/, 'no call is listed above the tabs');
  assert.doesNotMatch(now, /data-views/, 'and no views card');
  assert.match(now, /<div x-show="now" data-peek-host/, 'the card is the action message, where there is one');
  assert.doesNotMatch(src, /h-\[calc\(100dvh-4\.75rem\)\]/, 'nothing above the tabs is sized to the screen');
  assert.match(src, /x-show="pane === 'views' && work\.views\.length"/, 'the views are a pane');
  assert.match(src, /data-session-views-tab/, 'behind a tab of their own');
  assert.match(src, /pane === 'views' && Math\.abs\(i - vAt\) <= 1/, 'whose frames wait for it to open');
});

test('the FAB is told what a note is about, in the notes store\'s locators', () => {
  // docs/APP.md's `about`, read by fab.js: the page subject is the session's
  // record, the selection is the view on screen in the Views tab, and both are
  // labelled with the session's name.
  const d = lent();
  const was = { pane: d.pane, views: d.work.views, vAt: d.vAt, facts: d.facts, topics: d.topics };
  const plain = (x) => JSON.parse(JSON.stringify(x));   // the view's objects are the jsdom realm's
  try {
    d.pane = 'outline';
    d.topics = null;
    assert.equal(d.about.subject.about, STORE + ':' + PATH);
    assert.equal(d.about.subject.label, 'a named session', 'the host\'s label first');
    d.facts = null;
    d.topics = { title: 'What Gemini called it' };
    assert.equal(d.about.subject.label, 'What Gemini called it', 'then the topics file');
    d.topics = null;
    assert.equal(d.about.subject.label, d.head.title, 'then the opening ask');
    assert.equal(d.about.title, d.about.subject.label, 'the About title and the note label agree');
    assert.equal(d.about.selection, null, 'the selection is empty outside the Views tab');
    assert.equal(d.about.sources[0].path, PATH, 'the record is the source');
    d.pane = 'views';
    d.work.views = [{ name: 'a.md', repoShort: 'web-tools', short: 'x', slug: 'me/web-tools', branch: 'claude/x', path: 'docs/a.md' }];
    d.vAt = 0;
    assert.deepEqual(plain(d.about.selection), { about: 'me/web-tools@claude/x:docs/a.md', label: 'a.md · web-tools' });
  } finally {
    Object.assign(d, was);
  }
});

test('the time panel reads a long span in days and counts the days the owner spoke', () => {
  const d = lent();
  const was = d.record;
  try {
    d.record = { ...d.rec, started: '2026-10-11T16:55:00Z', ended: '2026-10-21T01:28:00Z',
      prompts: [{ at: '2026-10-11T17:00:00Z' }, { at: '2026-10-11T18:00:00Z' }, { at: '2026-10-15T18:00:00Z' }] };
    const t = d.timeFacts;
    assert.equal(t.span, '9d 8h', '224h 33m is exact and reads as nothing');
    assert.equal(t.turns, 3);
    assert.equal(t.days, 2);
    assert.match(t.started, /Oct 11/);
  } finally { d.record = was; }
});

test('the pill draws declared marks and counts the rest', () => {
  // Nine checkouts drew six neutral bookmarks in a row on a phone (owner,
  // 2026-10-22).
  const d = lent();
  const was = { record: d.record, marks: d.marks };
  try {
    d.record = { ...d.rec, attached: ['home', 'web-tools', 'wtp-a', 'wtp-b'] };
    d.marks = { home: 'ph-house', 'web-tools': 'ph-toolbox', 'wtp-a': '', 'wtp-b': '' };
    assert.deepEqual(Array.from(d.scopeMarked), ['home', 'web-tools']);
    assert.equal(d.scopeRepos.length - d.scopeMarked.length, 2, 'drawn as +2');
  } finally { d.record = was.record; d.marks = was.marks; }
});

test('a session that names no checkout draws no pill', () => {
  const d = lent();
  const was = d.record;
  try {
    d.record = { ...d.rec, repos: [], attached: [] };
    assert.deepEqual([...d.scopeRepos], []);
    assert.ok(!d.strip.some(f => f.k === 'repos'), 'absent rather than an empty pill');
  } finally { d.record = was; }
});


test('branchGroups groups session fileRows by repository and branch', async () => {
  window.__branchGroupSession = {
    repo: STORE,
    record: {
      short: 'bg1',
      schema: 4,
      repos: [
        { name: 'web-tools', branch: 'feat/json-explorer' },
        { name: 'other-repo', branch: 'main' },
      ],
      files: {
        'web-tools/lib/kits/json-explorer.js': { edit: 2, read: 5 },
        'web-tools/test/json-explorer.test.mjs': { write: 1 },
        'other-repo/README.md': { read: 1 },
        'unassigned/notes.txt': { read: 1 },
      },
    },
  };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__branchGroupSession)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(4);

  const data = Alpine.$data(el);
  const groups = data.branchGroups;
  assert.equal(groups.length, 3);
  assert.equal(groups[0].repo, 'web-tools');
  assert.equal(groups[0].branch, 'feat/json-explorer');
  assert.equal(groups[0].files.length, 2);
  assert.match(groups[0].branchUrl, /branch\.html#gh=me\/web-tools@feat%2Fjson-explorer/);

  assert.equal(groups[1].repo, 'other-repo');
  assert.equal(groups[1].branch, 'main');
  assert.equal(groups[1].files.length, 1);

  assert.equal(groups[2].repo, 'other');
  assert.equal(groups[2].files.length, 1);
});

test('mountRaw mounts JsonExplorer on demand and destroy cleans it up', async () => {
  let mountedWith = null;
  let destroyed = false;
  window.JsonExplorer = {
    mount: (box, opts) => {
      mountedWith = { box, opts };
      const expEl = window.document.createElement('div');
      expEl.className = 'json-explorer';
      box.append(expEl);
      return {
        destroy: () => { destroyed = true; expEl.remove(); },
      };
    },
  };

  window.__rawSession = {
    repo: STORE,
    record: { short: 'raw1', schema: 4, day: '2026-08-05' },
  };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__rawSession)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(4);

  const data = Alpine.$data(el);
  await data.mountRaw();

  assert.ok(mountedWith, 'JsonExplorer.mount was called');
  assert.equal(mountedWith.opts.name, 'raw1.json');
  assert.equal(mountedWith.opts.data.short, 'raw1');
  assert.ok(el.querySelector('.json-explorer'), '.json-explorer DOM mounted');

  data.destroy();
  assert.equal(destroyed, true, 'destroy cleans up _rawExplorer');
});

// ── Gemini's topics file ────────────────────────────────────────────────────
// Read by the form itself, from `background`, because the host's rollup row
// carries no turns and a deep-linked slide was mounted before that row had
// even been joined. The summary prefers it; the outline's notes come from it.
// Each test names its own store: the reads are memoised per store and path for
// a minute, which is the behaviour, so a shared key would hand one test the
// file another test served.
const mountTopics = async (doc, repo) => {
  window.__topicsDoc = doc;
  window.__topicsMount = { repo, path: PATH };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__topicsMount)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(8);
  return Alpine.$data(el);
};
const TOPICS_DOC = {
  format: 6, title: 'Gemini title', summary: 'What Gemini made of it.', topics: ['The thing'],
  agenda: [{ topic: 'The thing', kind: 'new', turns: [0, 0], at: record.prompts[0].at }],
  turns: [{ turn: 0, summary: 'The owner asked for the thing, and got it.', headline: 'The thing' }],
};

test('the topics file is read from background and outranks the row for the summary', async () => {
  const data = await mountTopics(TOPICS_DOC, 'me/topics-a');
  assert.ok(gets().includes('get:me/topics-a:' + TOPICS_PATH), 'read beside the record');
  assert.equal(data.gist.summary, 'What Gemini made of it.');
  assert.deepEqual(JSON.parse(JSON.stringify(data.turnNotes())),
    { [record.prompts[0].at]: { summary: 'The owner asked for the thing, and got it.', headline: 'The thing' } },
    'each note is keyed by the instant its turn was sent, which is what an outline row carries');
  window.__topicsDoc = null;
});

test('a session with no topics file reads as it did before there were any', async () => {
  const data = await mountTopics(null, 'me/topics-b');
  assert.equal(data.topics, null);
  assert.equal(data.turnNotes(), null);
  assert.equal(data.gist.summary, '');
});

test('an old record whose turn count disagrees gets no notes, rather than notes on the wrong rows', async () => {
  // Schema 4 predates the recorder separating injected prompts, so the file's
  // turn numbering and the record's prompts can differ, and here they do.
  const doc = { ...TOPICS_DOC, turns: [...TOPICS_DOC.turns, { turn: 1, summary: 'A second turn.' }] };
  const data = await mountTopics(doc, 'me/topics-c');
  assert.equal(data.record.schema, 4);
  assert.equal(data.turnNotes(), null);
  assert.equal(data.gist.summary, 'What Gemini made of it.', 'the session-level summary still applies');
  window.__topicsDoc = null;
});

test('the outline is built once, with the turn notes, when the topics file is prompt', async () => {
  // It was built bare at settle and again when the file landed: two builds of
  // every slide's outline, three slides at a time in the swiper, which on a
  // phone was a memory spike beside a page already near Safari's ceiling.
  const calls = [];
  const was = window.sessionExport.index;
  window.sessionExport.index = (rec, opts) => { calls.push(opts); return { el: window.document.createElement('div') }; };
  // The file arrives after the record, as it does over the network: the old
  // order built the outline before it landed and again after.
  window.__topicsDelay = 50;
  try {
    const data = await mountTopics(TOPICS_DOC, 'me/topics-d');
    await new Promise(r => setTimeout(r, 200));
    assert.equal(calls.length, 1, 'one build, not one bare and one with the notes');
    assert.ok(calls[0].notes?.[record.prompts[0].at], 'and the one build carries the notes');
    assert.equal(data.outlineBuilt, true);
  } finally {
    window.sessionExport.index = was;
    window.__topicsDoc = null;
    window.__topicsDelay = 0;
  }
});

// ── How far Gemini has read ─────────────────────────────────────────────────
// The poller's staleness test, as far as a page can run it: no file yet, or a
// file made from another version of the record. Each test serves a schema 8
// record, where turn i is prompts[i], and names its own store for the memo.
const TWO = [{ at: '2026-08-05T13:00:00Z', text: 'do the thing' },
             { at: '2026-08-05T15:00:00Z', text: 'and one more' }];
const mountRead = async (doc, repo, patch, sha) => {
  window.__recordPatch = { schema: 8, ...patch };
  window.__recordSha = sha;
  try { return await mountTopics(doc, repo); }
  finally { window.__recordPatch = null; window.__recordSha = undefined; window.__topicsDoc = null; }
};

test('every turn summarized from this version of the record reads as current', async () => {
  const doc = { ...TOPICS_DOC, turn_count: 1, source_ended: record.ended, source_blob: 'aaa' };
  const d0 = await mountRead(doc, 'me/gemini-a', {}, 'aaa');
  const g = d0.gemini && { ...d0.gemini, ...d0.geminiDetail };
  assert.equal(g.state, 'current');
  assert.equal(g.icon, 'ph-check');
  assert.deepEqual(JSON.parse(JSON.stringify(g.head)), { count: '1/1', unit: 'turns summarized' });
  assert.deepEqual(Array.from(g.rows, r => r.mark), ['done']);
});

test('a session that went on after Gemini read it is behind, by the turns it missed', async () => {
  // The case that prompted this (2026-10-22): six turns in the record, five in
  // the file, and nothing on the page said so.
  const doc = { ...TOPICS_DOC, turn_count: 1, source_ended: record.ended, source_blob: 'aaa' };
  const d0 = await mountRead(doc, 'me/gemini-b', { prompts: TWO, ended: '2026-08-05T15:30:00Z' }, 'bbb');
  const g = d0.gemini && { ...d0.gemini, ...d0.geminiDetail };
  assert.equal(g.state, 'behind');
  assert.equal(g.label, '1/2', 'the strip shows how far it got');
  assert.deepEqual(Array.from(g.rows, r => r.mark), ['done', 'after']);
  assert.ok(g.lines.some(l => /has moved since/.test(l)), 'and the panel says the record moved');
});

test('the blob decides where both sides have one, even when the end stamp agrees', async () => {
  // The last exchange can grow without a new turn: replies land, `ended` is
  // rewritten. The blob is the poller's own test, so it is this one's too.
  const doc = { ...TOPICS_DOC, turn_count: 1, source_ended: record.ended, source_blob: 'aaa' };
  const d0 = await mountRead(doc, 'me/gemini-c', {}, 'ccc');
  const g = d0.gemini && { ...d0.gemini, ...d0.geminiDetail };
  assert.equal(g.state, 'behind');
  assert.equal(g.icon, 'ph-arrows-clockwise', 'no turn to count, so a mark says it moved');
});

test('a file from before per-turn summaries reads as topics only, not as turns skipped', async () => {
  // Format 4 has the summary and the topics and no `turns` at all; 95 of the
  // 150 files on background were that shape on 2026-10-22.
  const { turns, ...doc } = { ...TOPICS_DOC, format: 4, turn_count: 1, source_ended: record.ended };
  const d0 = await mountRead(doc, 'me/gemini-d');
  const g = d0.gemini && { ...d0.gemini, ...d0.geminiDetail };
  assert.equal(g.state, 'topics');
  assert.equal(g.rows.length, 0, 'no rows, since there is nothing per turn to list');
  assert.equal(g.head.unit, 'turns read');
});

test('a turn step 1 skipped is a gap, named as skipped', async () => {
  const doc = { ...TOPICS_DOC, turn_count: 2, source_ended: record.ended,
                turns: [...TOPICS_DOC.turns, { turn: 1, summary: null, headline: null }] };
  const d0 = await mountRead(doc, 'me/gemini-e', { prompts: TWO });
  const g = d0.gemini && { ...d0.gemini, ...d0.geminiDetail };
  assert.equal(g.state, 'gaps');
  assert.equal(g.label, '1/2');
  assert.deepEqual(Array.from(g.rows, r => r.mark), ['done', 'skipped']);
});

test('no file is "not yet", and a record with no path makes no claim at all', async () => {
  const d0 = await mountRead(null, 'me/gemini-f');
  const g = d0.gemini && { ...d0.gemini, ...d0.geminiDetail };
  assert.equal(g.state, 'none');
  // A #gz= record was never in the store, so there is nothing to look for.
  window.__gzMount = { record: { ...record, short: 'gz1' } };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__gzMount)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(4);
  assert.equal(Alpine.$data(el).gemini, null);
});

// ── The tools panel ─────────────────────────────────────────────────────────
test('the tools panel lists every tool, its failures, and the subagents by task', async () => {
  window.__toolsMount = { record: { ...record, short: 'tl1', calls_total: 4, failures: 1,
    tools: { Bash: 3, Agent: 1 },
    calls: [{ name: 'Bash', ok: true }, { name: 'Bash', ok: false }, { name: 'Bash', ok: true }, { name: 'Agent', ok: true }],
    agents: [{ label: 'Fetch the docs', type: 'web-fetch', tools: { WebFetch: 4 } }] } };
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'sessionBrief(window.__toolsMount)');
  window.document.body.append(el);
  Alpine.initTree(el);
  await tick(4);
  const t = JSON.parse(JSON.stringify(Alpine.$data(el).toolTally));
  assert.deepEqual(t.rows, [{ name: 'Bash', n: 3, failed: 1 }, { name: 'Agent', n: 1, failed: 0 }]);
  assert.deepEqual(t.agents, [{ label: 'Fetch the docs', type: 'web-fetch', calls: 4 }]);
  assert.equal(t.note, '');
  // A call list shorter than the count cannot say which tool failed.
  const d = Alpine.$data(el);
  d.record = { ...d.record, calls: d.record.calls.slice(0, 2) };
  assert.equal(d.toolTally.rows[0].failed, 0);
  assert.match(d.toolTally.note, /Which tools failed is not in this record/);
});
