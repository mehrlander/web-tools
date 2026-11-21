// alpineComponents/session-brief.js — the head: the title over a line of the
// session's facts, with find and the cards beside them (owner, 2026-11-17).
//
// What is pinned here:
//
//   A DECK HOST'S HEADER CARRIES IT. A host that lends its header (o.chrome,
//   swipe-deck's setChrome) is handed the facts line as the subtitle and the
//   magnifier and cards as actions, and the view draws no head of its own;
//   with no host the view draws the same elements itself.
//
//   FIND TAKES THE TITLE'S PLACE. The magnifier, Ctrl+F or Cmd+F turns the
//   title line into the search field, with no extra line; it counts the
//   matching turns; Escape or the magnifier, now an ✕, closes it and clears
//   it. Only the view in front answers the keys.
//
//   THE RECORD TAB'S SWITCH drives the one explorer, and follows it when the
//   explorer moves itself.
//
// Over the real matching kit (session-render's find); the deck painter and the
// outline are stand-ins.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const at = n => '2026-10-01T10:' + String(n).padStart(2, '0') + ':00Z';
const record = {
  schema: 13, short: 'ab12cd34', day: '2026-10-01', opening_ask: 'Find the launch discussion',
  started: at(0), ended: at(8), exchanges: 2, calls_total: 7, repos: [{ name: 'web-tools', branch: 'claude/x' }],
  prompts: [{ at: at(0), text: 'Where was launch decided?' }, { at: at(4), text: 'Can the budget change?' }],
  replies: [{ at: at(2), text: 'Launch needs approval.' }, { at: at(6), text: 'The budget is unchanged.' }],
};
const { window, problems } = makeWindow({ html: `<html><body>
  <div id="inline" x-data="sessionBrief(window.__inline)"></div>
  <div id="hosted" x-data="sessionBrief(window.__hosted)"></div>
  <div id="found" x-data="sessionBrief(window.__found)"></div>
  <div x-data="{ shell: true }">
    <div id="slideA" x-data="sessionBrief(window.__slideA)"></div>
    <div id="slideB" x-data="sessionBrief(window.__slideB)"></div>
  </div>
</body></html>` });
window.claudeMark = { svg: () => '<svg></svg>' };
window.gh = { load: async () => {} };
window.chatRender = {};
window.readAloud = {};
window.TitleTip = {};
for (const file of ['lib/vanilla-bundle.js', 'lib/kits/repo-address.js', 'lib/kits/repo-mark.js', 'lib/kits/closing-state.js',
                    'lib/kits/session-render.js', 'lib/kits/swipe-deck.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, file), 'utf8'))(window);
}
window.sessionRender.open = async () => ({});
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
// No deck is open over the page; the hosted mount's "header" is a host of the
// test's own, which is what setChrome hands it.
let top = null;
window.swipeDeck.top = () => top;
window.Element.prototype.scrollIntoView = function () {};
window.Element.prototype.scrollTo = function () {};
const chromes = [];
const header = window.document.createElement('header');
window.document.body.append(header);
const setChrome = (c) => {
  chromes.push(c);
  header.replaceChildren(...[c?.head || null, c?.sub || null, ...(c?.actions || [])].filter(Boolean));
};
window.__inline = { record, repo: 'me/private', path: 'sessions/2026/10/2026-10-01-ab12cd34.json' };
window.__hosted = { record, repo: 'me/private', framed: true, chrome: setChrome };
window.__found = { record, repo: 'me/private', framed: true, find: 'launch' };
// Two slides of one deck inside a shell's own scope, as the app mounts them.
const slideChrome = { A: [], B: [] };
window.__slideA = { record, repo: 'me/private', framed: true, chrome: (c) => slideChrome.A.push(c) };
window.__slideB = { record: { ...record, short: 'feedbeef', calls_total: 99 }, repo: 'me/private', framed: true, chrome: (c) => slideChrome.B.push(c) };
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine;
captureAlpineErrors(Alpine);
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpine-bundle.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-brief.js'), 'utf8'))();
Alpine.start();
await tick(8);
const el = (id) => window.document.getElementById(id);
const data = (id) => Alpine.$data(el(id));
// Up to two seconds: the field runs its search 200ms after the last keystroke.
const until = async (ok) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 20)); return ok(); };
const key = (o) => window.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...o }));

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('with no host the view draws its head: the title over the facts, the magnifier beside them', () => {
  const head = el('inline').querySelector('[data-session-head]');
  assert.ok(head, 'a head of its own');
  const title = head.querySelector('[data-session-title]');
  assert.equal(title.textContent, 'Find the launch discussion');
  const facts = head.querySelector('[data-session-facts]');
  assert.equal(title.nextElementSibling, facts, 'the facts line under the title');
  // No id and no running ref (owner, 2026-11-17): the reader knows which
  // session is open, and the ref is about the page, not the session.
  assert.deepEqual([...facts.children].map((n) => n.getAttribute('data-fact')), ['day', 'calls', 'repos']);
  assert.match(facts.className, /\bflex-wrap\b/);
  assert.match(facts.className, /\boverflow-hidden\b/, 'one row high, so a fact that does not fit drops out whole');
  assert.ok(head.querySelector('[data-at="find"]'), 'the magnifier');
  assert.equal(head.querySelector('[data-at="cards"]'), null, 'and not the cards, which close the tab row');
  const row = el('inline').querySelector('[data-at="tabs"]').parentElement;
  assert.ok(row.querySelector('[data-at="cards"]'), 'beside the tabs, where they sat before the row became one');
  assert.equal(el('inline').querySelectorAll('[data-session-facts]').length, 1, 'and no second strip under it');
});

test('a deck host is handed the facts as its subtitle and the magnifier as its action', async () => {
  assert.equal(el('hosted').querySelector('[data-session-head]'), null, 'the view draws no head of its own');
  const c = chromes.at(-1);
  assert.ok(c.sub?.matches('[data-session-facts]'), 'the facts line is the subtitle');
  assert.equal(c.head, null, 'and the title stays the host\'s');
  // Only the magnifier, as the design sketch draws the header, so the facts
  // line keeps the room; the cards close the tab row in both hosts.
  assert.deepEqual(JSON.parse(JSON.stringify(c.actions.map((a) => a.getAttribute('data-at')))), ['find']);
  assert.match(c.actions[0].className, /btn-circle/, 'in the header\'s shape');
  await tick(2);
  assert.ok(el('hosted').querySelector('[data-at="cards"]'), 'the cards are in the view\'s tab row');
});

test('the magnifier turns the title line into the search field, and the ✕ closes and clears it', async () => {
  const d = data('inline'), head = el('inline').querySelector('[data-session-head]');
  head.querySelector('[data-at="find"]').click();
  await tick(3);
  const box = head.querySelector('[role="search"]');
  assert.ok(box, 'the field is in the head');
  assert.equal(head.querySelector('[data-session-title]'), null, 'in place of the title');
  assert.equal(head.querySelector('[data-session-facts]'), null, 'and of the facts, with no extra line');
  assert.equal(d.pane, 'turns', 'the search filters the Turns tab');
  const input = box.querySelector('input');
  input.value = 'budget';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => d.findQuery === 'budget');
  await tick(2);
  assert.equal(box.querySelector('[data-find-count]').textContent, '1 turn', 'a count of the matching turns');
  const btn = head.querySelector('[data-at="find"]');
  assert.match(btn.querySelector('i').className, /ph-x/, 'the magnifier is now the way out');
  btn.click();
  await tick(3);
  assert.equal(d.findQuery, '');
  assert.equal(d.findShown, false);
  assert.ok(head.querySelector('[data-session-title]'), 'the title is back');
});

test('Escape in the field closes the search and goes no further', async () => {
  const d = data('inline');
  d.openFind();
  await tick(3);
  const input = el('inline').querySelector('[role="search"] input');
  input.value = 'launch';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => d.findQuery === 'launch');
  let reached = false;
  const spy = () => { reached = true; };
  window.addEventListener('keydown', spy);
  const e = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  input.dispatchEvent(e);
  window.removeEventListener('keydown', spy);
  assert.ok(e.defaultPrevented, 'a deck around it reads the key as handled');
  assert.equal(reached, false, 'and never hears it');
  await tick(2);
  assert.equal(d.findShown, false);
  assert.equal(d.findQuery, '');
});

test('Ctrl+F and Cmd+F open it from anywhere, in place of the browser\'s own find', async () => {
  const d = data('inline');
  // Three views are mounted here; the inline one is the one with no deck over
  // it and no host. The hosted one answers only while its facts are in front.
  header.replaceChildren();
  const e = new window.KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
  window.dispatchEvent(e);
  assert.ok(e.defaultPrevented, 'the browser\'s find stands down');
  await tick(2);
  assert.equal(d.findOpen, true);
  assert.equal(data('hosted').findOpen, false, 'a deck slide whose facts are not in the header does not answer');
  d.clearFind();
  await tick(2);
  key({ key: 'F', metaKey: true });
  await tick(2);
  assert.equal(d.findOpen, true, 'Cmd+F too');
  d.clearFind();
  await tick(2);
  key({ key: 'f', ctrlKey: true, shiftKey: true });
  assert.equal(d.findOpen, false, 'a chord with more keys is not this one');
  key({ key: 'f', ctrlKey: true, altKey: true });
  assert.equal(d.findOpen, false, 'Ctrl+Alt+F is not this one either');
});

test('a hosted view hands the field to the header in place of the title, once, and keeps its facts', async () => {
  const d = data('hosted');
  // Its chrome back in the header, as a deck paints the active slide's.
  setChrome(chromes.at(-1));
  top = { el: header };
  const before = chromes.length;
  key({ key: 'f', ctrlKey: true });
  await until(() => d.findOpen);
  await tick(2);
  assert.equal(data('inline').findOpen, false, 'an inline view with a deck on top does not answer');
  const c = chromes.at(-1);
  assert.equal(chromes.length, before + 1, 'one hand-over for the field');
  assert.ok(c.head?.matches('[role="search"]'), 'the field takes the title\'s place');
  assert.ok(c.sub?.matches('[data-session-facts]'));
  const input = c.head.querySelector('input');
  input.value = 'launch';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => d.findQuery === 'launch');
  await tick(2);
  assert.equal(chromes.length, before + 1, 'typing hands nothing over again, so the field keeps its caret');
  assert.equal(c.head.querySelector('[data-find-count]').textContent, '1 turn');
  d.clearFind();
  await tick(2);
  assert.equal(chromes.at(-1).head, null, 'closed, the title is back');
  top = null;
});

test('find= opens the field with its query, on the Turns tab', () => {
  const d = data('found');
  assert.equal(d.findShown, true);
  assert.equal(d.findQuery, 'launch');
  assert.equal(d.pane, 'turns');
  const input = el('found').querySelector('[role="search"] input');
  assert.equal(input.value, 'launch');
  assert.equal(el('found').querySelector('[data-find-count]').textContent, '1 turn');
});

test('the Record tab\'s switch drives the one explorer and follows it', async () => {
  const views = [];
  let opts = null;
  window.JsonExplorer = { mount: (box, o) => { opts = o; return { setView: (v) => { views.push(v); o.onView?.(v === 'schema' ? 'tree' : v); },
                                                                   destroy() {}, copy: async () => true }; } };
  const d = data('inline');
  d.show('record');
  await until(() => d.rawBuilt);
  assert.equal(opts.schemaPanel, false, 'the filled tree keeps a Schema view of its own');
  assert.equal(opts.mode, 'tree');
  d.setRecView('schema');
  assert.deepEqual(views, ['schema']);
  assert.equal(d.recView, 'schema', 'the switch holds what the reader chose, whatever the explorer echoes');
  opts.onView('table');
  assert.equal(d.recView, 'tree', 'the explorer opening a table from the schema moves the switch to Tree');
  d.show('schema');
  await tick(3);
  assert.equal(d.recView, 'schema', 'pane=schema sets the switch');
  assert.equal(views.at(-1), 'schema', 'on the explorer already up');
  const sw = el('inline').querySelector('[data-at="record-view"]');
  assert.deepEqual([...sw.querySelectorAll('[role="tab"]')].map((b) => b.textContent.trim()), ['Tree', 'Schema']);
  assert.ok(el('inline').querySelector('[data-session-record] [data-at="copy"]'), 'copy rides the switch\'s row');
});

test('inside another component\'s scope, each slide keeps its own head and hands it over', () => {
  // Alpine writes a property a component never declared to the OUTERMOST
  // scope, so two slides inside the app's shell shared one: the second slide
  // read the first's hand-over and never made its own (found 2026-11-17 in the
  // Sessions deck; a mount with no parent scope, like the ones above, cannot
  // show it).
  assert.equal(slideChrome.A.length, 1, 'the first slide handed its facts over');
  assert.equal(slideChrome.B.length, 1, 'and so did the second');
  assert.notEqual(slideChrome.A[0].sub, slideChrome.B[0].sub, 'each its own facts line');
  assert.match(slideChrome.B[0].sub.querySelector('[data-fact="calls"]').textContent, /99/);
  assert.match(slideChrome.A[0].sub.querySelector('[data-fact="calls"]').textContent, /^7$/);
});
