// alpineComponents/session-brief.js — the Calls tab: the decisions a session put
// to the owner, beside its Outline, Files and Raw (owner, 2026-10-19: "it would
// be helpful to see it with the session like that as opposed to in this
// independent placement"). A framed slide in the app's Sessions pane read no
// calls at all before this; the tab is how it shows them.
//
// Driven over a fake GH holding one session with two calls, one answered, and
// a second with two documentation calls, one closed. The
// tab comes first, and an open call is answered on its card (owner, 2026-10-19:
// "give the ability to approve on these"), in a box whose send takes the
// recommendation when left empty and sends the words as the adjustment.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const record = {
  schema: 4, short: 'c0ffee01', day: '2026-10-15', started: '2026-10-15T10:00:00Z', ended: '2026-10-15T12:00:00Z',
  repos: [{ name: 'widget', branch: 'claude/x' }], exchanges: 1,
  prompts: [{ at: '2026-10-15T10:00:00Z', text: 'ask' }], replies: [{ at: '2026-10-15T11:00:00Z', text: 'reply' }], calls: [],
};
const CALLS = {
  'user-calls/c0ffee01-size.json': { id: 'c0ffee01-size', session: 'c0ffee01', kind: 'decision', name: 'Topic Size',
    question: 'Split topics?', brief: 'Eleven turns disagree.', recommend: 'Keep them whole', why: 'it is the key as built',
    size: 'S', confidence: 'firm', pr: 'me/widget#7', created: '2026-10-15T11:00:00Z' },
  'user-calls/c0ffee01-two.json': { id: 'c0ffee01-two', session: 'c0ffee01', kind: 'decision', question: 'Two steps?',
    recommend: 'Yes, switch', confidence: 'lean', why: 'closer on average', created: '2026-10-15T11:30:00Z' },
  'user-calls/c0ffee02-x.json': { id: 'c0ffee02-x', session: 'c0ffee02', kind: 'decision', question: 'Foreign?',
    recommend: 'No', created: '2026-10-15T12:00:00Z' },
};
// A second session's documentation calls: one waiting, one closed.
CALLS['user-calls/d0c5e001-readme.json'] = { id: 'd0c5e001-readme', session: 'd0c5e001', kind: 'documentation', name: 'Readme Links',
  question: 'Apply 2 edits to the widget README?', brief: 'Two links.', file: 'me/widget@claude/x:docs/guide/README.md',
  pr: 'me/widget#7', created: '2026-10-15T11:00:00Z', edits: [{ from: 'a', to: 'b' }, { from: 'c', to: 'd' }] };
CALLS['user-calls/d0c5e001-old.json'] = { id: 'd0c5e001-old', session: 'd0c5e001', kind: 'documentation', status: 'closed',
  question: 'Apply 1 edit to NOTES.md?', file: 'me/widget@claude/x:NOTES.md', created: '2026-10-15T10:00:00Z',
  edits: [{ from: 'e', to: 'f' }], closed: { answer: 'Superseded' } };
// A third session that Gemini has read: two topics over three turns, and
// five calls, one answered and the last filed after the record ends.
const AT = (h) => '2026-10-20T' + h + ':00Z';
for (const [slug, kind, created] of [['early', 'documentation', AT('10:05')], ['done', 'documentation', AT('10:30')], ['mid', 'decision', AT('11:10')],
                                     ['beta', 'documentation', AT('12:02')], ['late', 'documentation', AT('13:00')]]) {
  CALLS['user-calls/a9e0da01-' + slug + '.json'] = { id: 'a9e0da01-' + slug, session: 'a9e0da01', kind, created,
    question: slug + '?', brief: 'The brief.', recommend: 'Yes', name: slug,
    ...(kind === 'documentation' ? { file: 'me/widget@claude/x:' + slug + '.md', edits: [{ from: 'a', to: 'b' }] } : {}) };
}
const ANSWERS = { 'user-calls/c0ffee01-two.answers.jsonl': '{"answer":"Take","at":"2026-10-16T00:00:00Z"}\n',
                  'user-calls/a9e0da01-done.answers.jsonl': '{"answer":"1 confirmed","at":"2026-10-20T10:40:00Z"}\n' };
const listed = [];
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  async get(p) {
    if (p in CALLS && this.repo === STORE) return { text: JSON.stringify(CALLS[p]) };
    if (p in ANSWERS && this.repo === STORE) return { text: ANSWERS[p] };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p) {
    if (p.startsWith('contents/user-calls')) {
      listed.push(this.repo);
      if (this.repo !== STORE) throw Object.assign(new Error('404'), { status: 404 });
      return [...Object.keys(CALLS), ...Object.keys(ANSWERS), 'user-calls/deadbeef-other.json']
        .map((f) => ({ name: f.split('/')[1], path: f, type: 'file' }));
    }
    return { tree: [] };
  }
  static FRESH = { cache: 'no-store' };
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="slide" x-data="sessionBrief(window.__slide)"></div>
  <div id="none" x-data="sessionBrief(window.__none)"></div>
  <div id="docs" x-data="sessionBrief(window.__docs)"></div>
  <div id="topics" x-data="sessionBrief(window.__topics)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.claudeMark = { svg: () => '<svg></svg>' };
window.sessionRender = { describe: (r) => ({ title: r.short, subtitle: '' }), turns: (r) => r.replies || [], groups: (t) => t.map((x) => [x]),
                         open: async () => ({ close(){} }) };
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
window.chatRender = { block: () => window.document.createElement('pre') };
const decks = [];
// The deck renders its first slide, so the form it mounts says what it was asked;
// a form mounted as a card in the Calls tab's strip is kept apart, whole.
const forms = [], cardForms = [];
// The real strip and list kits, since the tab is a list over a strip of cards
// (kits/linked-swiper.js on swipeDeck.core); only the full-screen deck is a
// stand-in, recording where it opened.
for (const k of ['lib/vanilla-bundle.js', 'lib/kits/swipe-deck.js', 'lib/kits/linked-swiper.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
window.Element.prototype.scrollTo = function () {};
window.Element.prototype.scrollIntoView = function () {};
window.swipeDeck.top = () => null;
window.swipeDeck.open = (o) => {
  decks.push({ count: o.count, start: o.start, title: o.title });
  o.render(o.start, window.document.createElement('div'));
  return { close(){} };
};
// The call page's helpers, as the card's answer buttons reach them: a post is
// recorded, not sent.
const posts = [];
window.UserCallForm = { prOf: (ref) => (ref ? { slug: 'me/widget', n: 7 } : null),
                        postAnswer: async (a) => { posts.push(a); } };
// A slide of the app's Sessions pane, framed, opened on the Calls tab as a
// Waiting card's session link asks; and one whose session filed nothing.
window.__slide = { id: 'c0ffee01', repo: STORE, framed: true, record, pane: 'calls' };
window.__none = { id: 'feed0002', repo: STORE, framed: true, record: { ...record, short: 'feed0002' }, pane: 'calls' };
window.__docs = { id: 'd0c5e001', repo: STORE, framed: true, record: { ...record, short: 'd0c5e001' }, pane: 'calls' };
window.__topics = { id: 'a9e0da01', repo: STORE, framed: true, pane: 'calls',
  record: { ...record, schema: 8, short: 'a9e0da01', day: '2026-10-20', started: AT('10:00'), ended: AT('12:30'),
            prompts: [{ at: AT('10:00'), text: 'one' }, { at: AT('11:00'), text: 'two' }, { at: AT('12:00'), text: 'three' }] } };
const TOPICS = { topics: ['Alpha', 'Beta'],
  topic_status: [{ topic: 'Alpha', status: 'open', waits_on: 'owner', waiting: 'the mid call', basis: 'correction',
                   evidence: 'claude:a9e0da01 at 2026-10-20T12:10:00Z' },
                 { topic: 'Beta', status: 'done', basis: 'pr', evidence: 'widget#7 merged' }],
  agenda: [{ topic: 'Alpha', kind: 'new', area: 'Sessions', turns: [0, 1], at: AT('10:00'), state: { glyph: '🟢', name: 'Ready', line: '' } },
           { topic: 'Beta', turns: [2, 2], at: AT('12:00'), state: { glyph: '🟣', name: 'Done', line: '' } }],
  turns: [{ turn: 0, headline: 'Alpha begins' }, { turn: 1, headline: 'The mid call is shaped' }, { turn: 2, headline: 'Beta lands' }] };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
Alpine.data('userCallForm', (o) => ({ init() { if (this.$el.closest('[data-call-strip]')) cardForms.push(o); else forms.push(o.call.id); } }));
// repo-address.js is booted by every page; the component's GitHub links are
// built by window.RepoAddress.github.
for (const k of ['lib/kits/repo-address.js', 'lib/kits/closing-state.js', 'lib/kits/repo-sessions-cache.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/alpine-bundle.js', 'lib/alpineComponents/session-brief.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const el = (id) => window.document.getElementById(id);
const data = (id) => Alpine.$data(el(id));
const until = async (ok) => { for (let i = 0; i < 60 && !ok(); i++) await tick(2); return ok(); };
await until(() => data('slide').calls.length === 2 && !data('none').callsLoading);
await until(() => el('slide').querySelectorAll('[data-session-call]').length === 2);
await until(() => data('docs').calls.length === 2 && cardForms.length);
await until(() => data('topics').calls.length === 5);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('a framed slide reads its session\'s calls, and only its own', () => {
  // c0ffee02-x shares the session's prefix but not its id, and is not listed.
  assert.deepEqual(Array.from(data('slide').calls, (c) => c.id), ['c0ffee01-size', 'c0ffee01-two']);
  assert.ok(listed.includes(STORE), 'the store\'s user-calls/ is listed');
});

// What waits on the owner is the first thing to see (owner, 2026-10-19). Since
// the view split into two regions (2026-11-09), Calls leads the bottom row,
// and that region opens on it while a call waits.
test('the Calls tab leads the one tab row, and the row opens there while a call waits', async () => {
  // One row since 2026-11-17: Calls, Overview, Turns, Outline, Views, Files,
  // Record, with Calls first and present only for a session that filed some.
  const row = el('slide').querySelector('[data-at="tabs"]');
  const tabs = [...row.querySelectorAll('[role=tab]')].map((t) => t.textContent.trim().match(/^[A-Za-z]+/)?.[0]);
  assert.equal(tabs[0], 'Calls');
  await until(() => data('slide').openCallCount === 1);
  assert.equal(data('slide').pane, 'calls');
});

test('the Calls tab shows with a count, tinted while a call waits', async () => {
  const tab = el('slide').querySelector('[data-session-calls-tab]');
  await until(() => tab.style.display !== 'none');
  assert.notEqual(tab.style.display, 'none');
  assert.match(tab.textContent, /Calls\s*2/);
  await until(() => data('slide').openCallCount === 1);
  assert.equal(data('slide').openCallCount, 1, 'one is answered');
  assert.match(tab.querySelector('span').className, /bg-warning\/30/);
  assert.equal(el('none').querySelector('[data-session-calls-tab]').style.display, 'none', 'no calls, no tab');
});

test('a closed, unanswered call does not wait: the open count and the tab tint ignore it', async () => {
  const s = data('slide'), keep = s.calls;
  s.calls = [...keep, { id: 'c0ffee01-shut', session: 'c0ffee01', kind: 'decision', question: 'Closed?', recommend: 'No', status: 'closed' }];
  try {
    await tick(2);
    assert.equal(s.openCallCount, 1);
    assert.match(el('slide').querySelector('[data-session-calls-tab] span').className, /bg-warning\/30/);
  } finally { s.calls = keep; await tick(2); }
});

test('size and cautions ride the name\'s line, each with its tip', () => {
  const [one, two] = el('slide').querySelectorAll('[data-session-call-head]');
  const size = one.querySelector('[data-chip=size]');
  assert.match(size.textContent, /S/);
  assert.match(size.dataset.titleTip, /one session with room to spare: the work the recommended answer sets off/);
  assert.match(two.querySelector('[data-chip=lean]').dataset.titleTip, /Another option has a real case: closer on average/);
  decks.length = 0;
  size.click();
  assert.equal(decks.length, 0, 'a tap on a chip is for its tip, not the deck');
});

test('the pane holds one card per call: question, brief, recommendation, state', async () => {
  const cards = [...el('slide').querySelectorAll('[data-session-call]')];
  assert.equal(cards.length, 2);
  await until(() => /Answered: Take/.test(cards[1].textContent));
  assert.match(cards[0].textContent, /Approval[\s\S]*Open[\s\S]*Split topics\?[\s\S]*Eleven turns disagree\.[\s\S]*Recommended:\s*Keep them whole/);
  // The card's head names the call; its first line says the kind.
  assert.match(el('slide').querySelector('[data-call-strip] [data-ls="head"]').textContent, /Topic Size/);
  assert.match(cards[1].textContent, /Approval[\s\S]*Lean[\s\S]*Answered: Take[\s\S]*Two steps\?/);
});

test('the list groups the calls and the card\'s door opens the deck of call forms at the call in view', async () => {
  const rows = [...el('slide').querySelectorAll('[data-call-list] [data-call]')];
  assert.deepEqual(rows.map((r) => r.getAttribute('data-call')), ['c0ffee01-size', 'c0ffee01-two']);
  assert.deepEqual([...el('slide').querySelectorAll('[data-call-list] .sticky')].map((h) => h.textContent), ['Other calls']);
  decks.length = 0; forms.length = 0;
  el('slide').querySelectorAll('[data-session-call]')[1].click();
  assert.deepEqual(decks, [], 'a card is read and answered where it is; a tap on it opens nothing');
  rows[1].click();
  await tick(2);
  assert.equal(data('slide').cSel, 'c0ffee01-two', 'a pick in the list selects the call');
  el('slide').querySelector('[data-call-strip] [data-swipe-cards]').click();
  assert.deepEqual(decks, [{ count: 2, start: 1, title: 'Calls' }]);
  assert.deepEqual(forms, ['c0ffee01-two']);
});

test('a deck opened on a documentation call holds only documentation calls, and the other kinds keep theirs', () => {
  const s = data('slide'), keep = s.calls;
  s.calls = [...keep, { id: 'c0ffee01-doc', session: 'c0ffee01', kind: 'documentation', question: 'Apply 1 edit to docs/x.md?',
                        file: 'me/widget@claude/x:docs/x.md', edits: [{ from: 'a', to: 'b' }] }];
  try {
    decks.length = 0; forms.length = 0;
    s.openCalls(2);
    assert.deepEqual(decks, [{ count: 1, start: 0, title: 'Calls' }]);
    assert.deepEqual(forms, ['c0ffee01-doc']);
    decks.length = 0; forms.length = 0;
    s.openCalls(1);
    assert.deepEqual(decks, [{ count: 2, start: 1, title: 'Calls' }], 'the decisions keep their own deck');
  } finally { s.calls = keep; }
});

const card = () => el('slide').querySelectorAll('[data-session-call]')[0];
const send = () => card().querySelector('[data-session-call-send]');
// The send's Confirm label is shown, not written, so its visibility is the test.
const armed = () => [...send().querySelectorAll('span')].some((x) => x.textContent === 'Confirm' && x.style.display !== 'none');
const reopen = async () => { data('slide').callAnswers = { ...data('slide').callAnswers, 'c0ffee01-size': [] }; await tick(2); };

test('a call filed as Take or Adjust is answered in a box, its send empty taking the recommendation', async () => {
  const box = card().querySelector('[data-session-call-note]');
  assert.equal(box.placeholder, 'Go ahead as recommended');
  assert.equal(card().querySelectorAll('[data-session-call-answer]').length, 0, 'no Take or Adjust buttons beside it');
  const answered = el('slide').querySelectorAll('[data-session-call]')[1];
  assert.equal(answered.querySelector('[data-session-call-reply]').style.display, 'none', 'an answered call has no box');
  decks.length = 0; posts.length = 0;
  send().click();
  await until(armed);
  assert.ok(armed(), 'the first tap arms the send, on Confirm');
  assert.equal(posts.length, 0, 'the first tap sends nothing');
  assert.equal(decks.length, 0, 'and opens no deck');
  send().click();
  await until(() => /Answered: Take/.test(card().textContent));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].repo, STORE);
  assert.equal(posts[0].path, 'user-calls/c0ffee01-size.answers.jsonl');
  assert.deepEqual([posts[0].entry.answer, posts[0].entry.note, posts[0].entry.then], ['Take', '', undefined]);
  assert.match(posts[0].comment, /Answer: \*\*Take\*\*, the recommendation: Keep them whole\n\n_c0ffee01-size, sent from the session's Calls tab\._/);
  assert.equal(data('slide').openCallCount, 0);
  assert.equal(decks.length, 0);
});

test('words in the box send it as the adjustment, and changing them disarms the send', async () => {
  await reopen();
  const box = card().querySelector('[data-session-call-note]');
  posts.length = 0;
  send().click();
  await until(armed);
  assert.ok(armed(), 'the first tap arms the send, on Confirm');
  box.value = 'Split the three clearest';
  box.dispatchEvent(new window.Event('input'));
  await until(() => !armed());
  assert.ok(!armed(), 'what the send means changed, so it asks again');
  send().click(); await tick(2); send().click();
  await until(() => /Answered: Adjust/.test(card().textContent));
  assert.equal(posts.length, 1);
  assert.deepEqual([posts[0].entry.answer, posts[0].entry.then, posts[0].entry.note], ['Adjust', 'go', 'Split the three clearest']);
  assert.match(posts[0].comment, /Answer: \*\*Adjust\*\*, then \*\*go\*\*: make the change and carry on\n\n> Split the three clearest/);
  assert.equal(data('slide').callNotes['c0ffee01-size'], '', 'the box is emptied once sent');
});

test('an address asking for Calls on a session with none lands on the overview', () => {
  assert.equal(data('slide').pane, 'calls');
  assert.equal(data('none').pane, 'overview');
});

// A documentation call's row names its document and counts its edits in a
// pill, and its card is the call form, where the edits are read and answered
// (owner, 2026-11-21). A call that no longer waits is the row drawn pale, with
// a check at its end in a slot every row keeps, and no pill saying so.
test('a documentation row is its repo, its path and a pill counting the edits', () => {
  const rows = [...el('docs').querySelectorAll('[data-call-list] [data-call]')];
  assert.deepEqual(rows.map((r) => r.getAttribute('data-call')), ['d0c5e001-readme', 'd0c5e001-old']);
  const [open, closed] = rows;
  assert.match(open.textContent, /^\s*widget\s*docs\/guide\/README\.md\s*2\s*$/, 'no question, and no Open');
  assert.doesNotMatch(open.textContent, /Apply|edits to/);
  const pill = open.querySelector('[data-call-count]');
  assert.equal(pill.textContent, '2');
  assert.equal(pill.dataset.titleTip, '2 edits');
  assert.equal(open.querySelector('[data-call-state]'), null, 'a waiting call is the row at full strength');
  assert.equal(open.querySelector('.opacity-50'), null);
  assert.equal(open.lastElementChild.className, 'w-4 shrink-0', "the state's slot is kept empty, so the pills stay in one column");
  assert.match(closed.textContent, /^\s*widget\s*NOTES\.md\s*1\s*$/, 'no Closed pill');
  const state = closed.querySelector('[data-call-state]');
  assert.equal(state, closed.lastElementChild, "a check at the row's end");
  assert.equal(state.getAttribute('aria-label'), 'Closed');
  assert.ok(state.querySelector('.ph-check'));
  assert.equal(closed.querySelectorAll('.opacity-50').length, 3, 'the icon, the path and the pill are drawn pale');
  // A row with no document keeps its question, and says Open nowhere.
  const other = el('slide').querySelector('[data-call-list] [data-call="c0ffee01-size"]');
  assert.match(other.textContent, /Split topics\?/);
  assert.doesNotMatch(other.textContent, /Open/);
  assert.equal(el('slide').querySelector('[data-call-list] [data-call="c0ffee01-two"] [data-call-state]').getAttribute('aria-label'), 'Answered: Take');
});

test("a documentation call's card is the call form, hosted, and an answer from it pales the row where it stands", async () => {
  const strip = el('docs').querySelector('[data-call-strip]');
  assert.equal(strip.querySelector('[data-session-call]'), null, 'not the decision card');
  const o = cardForms.find((f) => f.call.id === 'd0c5e001-readme');
  assert.ok(o, 'the selected call is mounted as a form');
  assert.deepEqual([o.repo, o.ref, o.path], [STORE, 'main', 'user-calls/d0c5e001-readme.json']);
  assert.equal(typeof o.onHead, 'function', 'hosted, so the form leaves the name to the card head');
  assert.match(strip.querySelector('[data-ls="head"]').textContent, /Readme Links/);
  assert.equal(data('docs').openCallCount, 1);
  o.onAnswer({ answer: '2 confirmed', at: '2026-10-16T00:00:00Z' });
  await until(() => data('docs').openCallCount === 0);
  assert.equal(el('docs').querySelector('[data-call="d0c5e001-readme"] [data-call-state]')?.getAttribute('aria-label'), 'Answered: 2 confirmed');
  assert.deepEqual([...el('docs').querySelectorAll('[data-call-list] [data-call]')].map((r) => r.dataset.call), ['d0c5e001-readme', 'd0c5e001-old'],
    'an answer sent here leaves the row in place, so the next card is still the next one');
});

// THE TOPICS (owner, 2026-11-21): a call is placed by the turn it was filed in
// and the topic Gemini's agenda gives that turn, never by words the session
// wrote; the list groups by topic, a heading opens its topic's panel, a card
// says which turn its call came from, and the Overview's topics lead to their
// calls and back.
test("a call's origin is its filing turn and that turn's topic, and a call past the record has neither", async () => {
  const s = data('topics');
  s.topics = TOPICS; s.topicsState = 'found';
  await tick(2);
  const o = (slug) => { const x = s.callOrigin(s.callById('a9e0da01-' + slug)); return [x.turn, x.topic]; };
  assert.deepEqual([o('early'), o('mid'), o('beta'), o('late')], [[0, 'Alpha'], [1, 'Alpha'], [2, 'Beta'], [-1, '']]);
});

test('the list groups the calls under their topics, waiting calls before settled ones', async () => {
  const s = data('topics');
  await s.mountCalls();
  const list = el('topics').querySelector('[data-call-list]');
  assert.deepEqual([...list.querySelectorAll('[data-call-group]')].map((h) => h.textContent),
    ['\u{1F7E2}Alpha', '\u{1F7E3}Beta', "After Gemini's reading"]);
  assert.deepEqual([...list.querySelectorAll('[data-call]')].map((r) => r.dataset.call),
    ['a9e0da01-early', 'a9e0da01-mid', 'a9e0da01-done', 'a9e0da01-beta', 'a9e0da01-late'],
    'within a topic, the waiting calls first, documentation first among them, then the answered one');
  assert.deepEqual([...list.querySelectorAll('[data-call-group][aria-current]')].map((h) => h.dataset.callGroup), ['alpha'],
    "the selected call's heading is marked with it");
  assert.deepEqual([...list.querySelectorAll('button[data-call-topic]')].map((h) => h.dataset.callTopic), ['alpha', 'beta'],
    'a topic heading is a control; the heading for calls past the reading is not');
});

test("a card leads with the turn its call came from, by Gemini's headline, and not the topic the list heads it with", async () => {
  const s = data('topics');
  s._callSwiper.pick('a9e0da01-mid');
  const find = () => [...el('topics').querySelectorAll('[data-call-strip] [data-call-origin]')]
    .find((x) => /mid\?/.test(x.parentElement.textContent) && /turn 2/.test(x.textContent));
  await until(find);
  const line = find();
  assert.ok(line, 'the origin line names the turn');
  assert.match(line.textContent, /turn 2\s*The mid call is shaped\s*Oct 20/);
  assert.doesNotMatch(line.textContent, /Alpha/, 'the list heading names the topic');
});

test("a topic's heading opens its panel: its status and what set it, its turns, and the ways to the Overview and Turns", async () => {
  const s = data('topics');
  const head = () => el('topics').querySelector('[data-call-list] [data-call-topic="alpha"]');
  const panel = () => el('topics').querySelector('[data-topic-panel]');
  head().click();
  await until(panel);
  assert.equal(s.factTip.kind, 'topic');
  assert.equal(s.factTip.pinned, true, 'a tap pins it');
  assert.match(panel().textContent, /Alpha/);
  assert.equal(panel().querySelector('[data-topic-status]').textContent.replace(/\s+/g, ' ').trim().split(' Corrected')[0], 'Waits on you: the mid call');
  assert.equal(panel().querySelector('[data-topic-basis]').textContent, 'Corrected by this session, Oct 20', 'a correction says who made it');
  assert.equal(panel().querySelector('[data-topic-meta]').textContent, 'New work \u00b7 Sessions \u00b7 2 turns: 1\u20132');
  assert.deepEqual([...panel().querySelectorAll('[data-topic-turn]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
    ['1 Alpha begins', '2 The mid call is shaped']);
  assert.equal(panel().querySelector('[data-topic-first]'), null, 'the first row is the way to the first turn');
  el('topics').querySelector('[data-call-list]').dispatchEvent(new window.Event('scroll'));
  await until(() => !s.factTip);
  assert.equal(s.factTip, null, 'the list scrolling from under its heading closes it');
  head().click();
  await until(panel);
  head().click();
  await until(() => !s.factTip);
  assert.equal(s.factTip, null, 'a second tap closes it');
  head().click();
  await until(panel);
  panel().querySelector('[data-topic-overview]').click();
  await tick(2);
  assert.equal(s.factTip, null);
  assert.equal(s.pane, 'overview');
  assert.equal(s.topicLit, 'alpha');
  assert.match(el('topics').querySelector('[data-topic="alpha"]').className, /bg-primary\/10/, 'the topic is lit on the Overview');
});

test('a topic past six turns shows its first three and last three, a return to it opening with a rule', () => {
  const s = data('topics');
  const keep = s.topics;
  s.topics = { ...TOPICS, agenda: [{ topic: 'Long', turns: [0, 4] }, { topic: 'Other', turns: [5, 5] }, { topic: 'Long', turns: [6, 8] }],
               topic_status: [], turns: [] };
  s.factTip = { kind: 'topic', topic: 'long' };
  try {
    const rows = s.topicPanel.rows;
    assert.deepEqual(Array.from(rows, (r) => r.more || r.n), [1, 2, 3, 2, 7, 8, 9]);
    assert.deepEqual(Array.from(rows.filter((r) => r.gap), (r) => r.n), [], 'the cut, not a rule, stands between the two ends');
    assert.equal(s.topicPanel.meta, '8 turns: 1\u20135, 7\u20139');
    s.topics = { ...s.topics, agenda: [{ topic: 'Long', turns: [0, 1] }, { topic: 'Other', turns: [2, 2] }, { topic: 'Long', turns: [3, 3] }] };
    assert.deepEqual(Array.from(s.topicPanel.rows.filter((r) => r.gap), (r) => r.n), [4], 'a return opens with a rule');
  } finally { s.factTip = null; s.topics = keep; }
});

test("each topic on the Overview counts its calls, and the count opens the Calls tab at the topic's first", async () => {
  const s = data('topics');
  const pill = (k) => el('topics').querySelector('[data-topic="' + k + '"] [data-topic-calls]');
  assert.equal(pill('alpha').textContent.trim(), '2');
  assert.equal(pill('alpha').dataset.titleTip, '2 calls waiting on you, of 3 filed in this topic');
  assert.equal(pill('beta').dataset.titleTip, '1 call waiting on you, of 1 filed in this topic');
  pill('beta').click();
  await tick(4);
  assert.equal(s.pane, 'calls');
  assert.equal(s.cSel, 'a9e0da01-beta');
  await until(() => el('topics').querySelector('[data-call-group][aria-current]')?.dataset.callGroup === 'beta');
  assert.equal(el('topics').querySelector('[data-call-group][aria-current]').dataset.callGroup, 'beta', 'the mark follows the selection');
});

test('a session whose turns cannot be timed keeps the two kinds apart', () => {
  const s = data('docs');
  s.topics = { ...TOPICS }; s.topicsState = 'found';
  try {
    assert.equal(s.callsPlaced, false, 'a schema 4 record and a topics file with no turn instants place nothing');
    assert.deepEqual(Array.from(s.callOrder, (c) => c.id), ['d0c5e001-readme', 'd0c5e001-old']);
  } finally { s.topics = null; s.topicsState = ''; }
});
