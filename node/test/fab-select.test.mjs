// A selected passage reaches About with its anchor. Item and page drafts
// retain their addresses across selection changes and failed or pending saves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick, withBase64 } from './bootstrap.mjs';

const { window } = makeWindow({ html: `<!doctype html><html><body>
  <article><p id="p1">The quick brown fox jumps over the lazy dog.</p>
  <textarea id="ta">typed words here</textarea></article>
</body></html>` });
const doc = window.document;
// The trio rides along so noteSelection() finds window.Annotate without a
// gh.load, which jsdom has no network for. Nothing here mounts until enable().
const Alpine = await startAlpine(window, [
  'lib/kits/repo-address.js', 'lib/kits/notes.js', 'lib/kits/dictate.js', 'lib/kits/annotate.js',
  'lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js',
]);

const host = doc.createElement('div');
host.innerHTML = '<div x-data="fab()" data-repo="mehrlander/web-tools" data-path="app/index.html"></div>';
doc.body.appendChild(host);
Alpine.initTree(host);
await tick(3);
const d = Alpine.$data(host.firstElementChild);
d.SEL_SETTLE = 5;

// The real notes kit writes to an in-memory private store, never GitHub.
let journal = '', writeFailure = false, holdWrite = null;
window.GH = withBase64(class {});
const reg = { repo: 'mehrlander/web-tools-private', ref: 'main',
  get: async () => ({ text: journal, sha: 'current' }),
  req: async (route, options) => {
    if (route === '/user') return { login: 'mehrlander' };
    if (writeFailure) throw new Error('offline');
    if (holdWrite) await holdWrite;
    journal = window.GH.decode(JSON.parse(options.body).content);
    return { content: { sha: 'written' } };
  },
};
d._noteStore = async () => reg;


// jsdom has no layout, so every rect is zero and the offer would read every
// selection as detached. One stub on the prototype covers the range the fab
// clones as well as the one the selection hands out; `rect` is what the
// placement test varies.
let rect = { left: 120, top: 300, right: 260, bottom: 318, width: 140, height: 18 };
window.Range.prototype.getBoundingClientRect = () => rect;

const select = (node, a, b) => {
  const r = doc.createRange();
  r.setStart(node, a); r.setEnd(node, b);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(r);
  doc.dispatchEvent(new window.Event('selectionchange'));
};
const settle = async () => { await new Promise(r => setTimeout(r, 30)); await tick(2); };
// The launcher's disc: the element the offer lights.
const disc = () => host.querySelector('[role="button"][tabindex="0"]');
// A press and a release on the launcher, as onDown/onUp receive them.
const press = () => ({ button: 0, pointerId: 1, clientX: 0, clientY: 0, pointerType: 'touch',
                        currentTarget: { setPointerCapture() {} }, preventDefault() {} });

test('selecting text on the page lights the launcher, and draws nothing at the words', async () => {
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  assert.ok(d.selOffer, 'the offer is up');
  assert.equal(d.selOffer.quote, 'quick brown fox');
  await tick(2);
  // The highlighter replaces the mark, the disc wears a ring, and the passage
  // rides the disc's title-tip, which is a hover label on a control.
  assert.ok(disc().querySelector('i').classList.contains('ph-highlighter'), 'the highlighter is on the launcher');
  assert.match(disc().className, /ring-2/);
  assert.match(disc().getAttribute('data-title-tip'), /quick brown fox/);
  assert.equal(disc().getAttribute('aria-label'), 'Note the selected text');
  // Nothing at the words: the control the platform's callout used to cover is gone.
  assert.equal(doc.querySelector('[data-fab-sel-offer]'), null);
  d.dropSelOffer();
  await tick(2);
  assert.ok(disc().querySelector('i').classList.contains('ph-sidebar-simple'), 'and the mark comes back');
  assert.equal(disc().getAttribute('data-title-tip'), null);
});

test('a collapsed selection takes the offer down; a caret is not a passage', async () => {
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  window.getSelection().removeAllRanges();
  doc.dispatchEvent(new window.Event('selectionchange'));
  await settle();
  assert.equal(d.selOffer, null);
});

test('a selection inside a field the reader is typing in is not offered', async () => {
  const ta = doc.getElementById('ta');
  ta.focus();
  // jsdom keeps the document selection apart from the textarea's; what the
  // fab reads is the active element, which is the honest signal on a browser
  // too, since a selection inside a field is the reader editing, not reading.
  select(doc.getElementById('p1').firstChild, 0, 3);
  await settle();
  assert.equal(d.selOffer, null);
  ta.blur();
});

test('the launcher lights with the annotator on as well', async () => {
  window.Annotate.enable({ doc });
  select(doc.getElementById('p1').firstChild, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  d.dropSelOffer();
  window.Annotate.disable();
});

test('taking the offer opens the About panel with the passage quoted over an empty field', async () => {
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  // The platform may collapse the live selection on the tap; the Range the
  // offer read is what travels, so the note is still about the passage.
  window.getSelection().removeAllRanges();
  await d.noteSelection();
  await tick(2);
  assert.equal(d.selOffer, null, 'the offer is spent');
  assert.equal(d.open, true, 'the drawer opened');
  assert.equal(d.activeTab, 'about', 'on the About panel');
  assert.equal(d.noteQuote, 'quick brown fox', 'with the passage quoted');
  const ta = host.querySelector('[data-fab-note-ta]');
  assert.ok(ta, 'the field is there');
  assert.equal(doc.activeElement, ta, 'and has the focus');
  // The annotator holds the set and the highlight; its card is not the surface.
  const A = window.Annotate, S = A._state;
  assert.equal(A.enabled, true, 'the annotator came on');
  assert.ok(host.querySelector('[data-fab-note-hold]').contains(S.ui), 'its card waits in the hidden holder');
  assert.equal(S.draft, null, 'and stages no draft of its own');
  assert.equal(d.noteTarget.quote.exact, 'quick brown fox');
  assert.equal(S.pending && S.pending.quote.exact, 'quick brown fox', 'the passage is marked while the note is written');

  // Saving files the note into the annotator's set, and the list reads it back.
  d.noteText = 'a note on the fox';
  await d.saveNote();
  await tick(2);
  assert.equal(A.items.length, 1);
  assert.equal(A.items[0].target.quote.exact, 'quick brown fox');
  assert.equal(window.Alpine.raw(A.items[0].target), A.items[0].target, 'the set keeps a plain object, not the tab\'s proxy');
  assert.equal(A.items[0].note, 'a note on the fox');
  assert.equal(S.pending, null, 'the mark gives way to the note\'s own highlight');
  assert.equal(d.noteQuote, '', 'the field is ready for the next one');
  assert.equal(d.noteText, '');
  assert.equal(d.notesList.length, 1);
  assert.equal(d.notesList[0].anchor.exact, 'quick brown fox');
  assert.equal(d.notesList[0].text, 'a note on the fox');
  assert.match(journal, /a note on the fox/);
  assert.equal(host.querySelector('[aria-label="Delete this note"]'), null, 'saved notes cannot be deleted');
  A.clear();
  journal = ''; d.noteItems = []; d._noteRefresh();
  A.disable();
  d.close(); d.activeTab = 'render';
  await tick(2);
});

test('a tap on the lit launcher takes the passage, even when the press collapsed the selection first', async () => {
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  d.onDown(press());
  // The press collapses the page's selection, and the debounced read clears
  // the offer before the release arrives: the case that motivated holding it.
  window.getSelection().removeAllRanges();
  doc.dispatchEvent(new window.Event('selectionchange'));
  await settle();
  assert.equal(d.selOffer, null, 'the read cleared the offer');
  d.onUp(press());
  // The quote and the tab are set inside the tap; the anchoring follows the
  // kit, so this polls on time rather than on ticks.
  assert.equal(d.activeTab, 'about');
  assert.equal(d.noteQuote, 'quick brown fox');
  for (const t0 = Date.now(); Date.now() - t0 < 3000 && !d.noteTarget; ) await tick(1);
  assert.equal(d.noteTarget.quote.exact, 'quick brown fox');
  d.noteClear();
  assert.equal(window.Annotate._state.pending, null, 'clearing drops the mark');
  window.Annotate.disable();
  d.close(); d.activeTab = 'render';
  await tick(2);
});

test('the page selection is cleared inside the tap, before any field takes the focus', async () => {
  // WebKit's document selection includes a focused field's caret, so clearing
  // the selection after the Note field had the focus left an iPhone's keyboard
  // up with nowhere to type. The clear has to happen in the tap, synchronously.
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  // jsdom, like WebKit, moves the document's selection into a field that
  // takes the focus, which would deselect the passage on its own; the
  // foothold's focus is stubbed so only the explicit clear can.
  const proxy = host.querySelector('input[aria-hidden="true"]');
  proxy.focus = () => {};
  const pending = d.noteSelection();          // not awaited: what follows is the tap's own work
  assert.equal(window.getSelection().rangeCount, 0, 'the passage is deselected before the first await');
  delete proxy.focus;
  await pending;
  await tick(2);
  // And nothing after the anchoring takes the focus from the field.
  assert.equal(doc.activeElement, host.querySelector('[data-fab-note-ta]'));
  d.noteClear();
  window.Annotate.disable();
  d.close(); d.activeTab = 'render';
  await tick(2);
});

test('typing that lands on the keyboard foothold is carried into the Note field', async () => {
  d.toggle();
  d.setTab('about');
  await tick(3);
  const proxy = host.querySelector('input[aria-hidden="true"]');
  const ta = host.querySelector('[data-fab-note-ta]');
  // As on a phone where the move to the field missed: the foothold has focus.
  proxy.focus();
  proxy.value = 'H';
  proxy.dispatchEvent(new window.Event('input', { bubbles: true }));
  await tick(2);
  assert.equal(d.noteText, 'H', 'the keystroke reached the note');
  assert.equal(proxy.value, '', 'and left the foothold empty');
  assert.equal(doc.activeElement, ta, 'and the focus moved to the field with it');
  d.noteClear();
  d.close(); d.activeTab = 'render';
  await tick(2);
});

test('closing the drawer before saving selects the passage again, and keeps what was written', async () => {
  // jsdom has no Highlight API; a stub records what the kit paints, so the
  // mark can be seen to go when the selection comes back.
  // A Set-backed Highlight and a Map registry, which is the shape the real
  // ones have (setlike and maplike), so clear(), size and get() behave.
  const had = { Highlight: window.Highlight, CSS: window.CSS };
  const marks = new Map();
  window.Highlight = class extends Set { constructor(...r) { super(r); } };
  window.CSS = { highlights: marks };
  try {
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  await d.noteSelection();
  await tick(2);
  const A = window.Annotate;
  assert.ok(A._state.pending, 'the passage is marked while the drawer is open');
  const mark = marks.get('annotate-notes-draft');
  assert.equal([...mark].map(String).join(), 'quick brown fox', 'painted on the page');
  d.noteText = 'half a thought';
  const p1el = doc.getElementById('p1');
  d.close();
  // WebKit kept the orange painted when the registry merely let go of it
  // (reported from an iPhone). The old mark is cleared, which is what makes
  // an engine repaint what it covered, and the block it sat on is nudged.
  assert.equal(mark.size, 0, 'the old mark is cleared, not just dropped');
  assert.equal(p1el.style.opacity, '0.999', 'and the passage is made to repaint');
  await new Promise(r => setTimeout(r, 60));
  assert.equal(p1el.style.opacity, '', 'leaving its style as it was');
  await tick(2);
  const sel = window.getSelection();
  assert.equal(sel.toString(), 'quick brown fox', 'the selection is back on the passage');
  assert.equal(A._state.pending, null, 'and the mark gives way to it');
  assert.equal(marks.has('annotate-notes-draft'), false, 'with nothing of it left on the page');
  assert.equal(d.noteText, 'half a thought', 'what was written stays in the field');
  // The launcher hears the restored selection and lights for it, so one tap
  // returns to the note in progress.
  await settle();
  assert.ok(d.selOffer, 'the launcher lights again');
  await d.noteSelection();
  await tick(2);
  assert.equal(d.noteQuote, 'quick brown fox');
  assert.equal(d.noteText, 'half a thought', 'and the text is still there');
  // Filed, there is no passage left to hand back.
  await d.saveNote();
  d.close();
  await tick(2);
  assert.equal(window.getSelection().toString(), '', 'nothing is reselected after a save');
  A.clear(); A.disable();
  d.activeTab = 'render';
  await tick(2);
  } finally { window.Highlight = had.Highlight; window.CSS = had.CSS; }
});

test('the About panel opened by hand writes about the page, and Ctrl or Cmd Enter saves', async () => {
  d.toggle();
  d.setTab('about');
  await tick(3);
  assert.equal(d.noteQuote, '');
  const ta = host.querySelector('[data-fab-note-ta]');
  ta.value = 'a thought about the whole page';
  ta.dispatchEvent(new window.Event('input', { bubbles: true }));
  await tick(1);
  ta.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  for (const t0 = Date.now(); Date.now() - t0 < 3000 && d.noteSaving || d.noteText; ) await tick(1);
  assert.ok(d.notesList.some(n => n.text === 'a thought about the whole page'));
  assert.equal(d.notesList[0].about, 'mehrlander/web-tools:app/index.html');
  window.Annotate.clear(); window.Annotate.disable();
  d.close(); d.activeTab = 'render';
  await tick(2);
});

test('an aim from the launcher menu steps off the About panel, since the dock is hidden there', async () => {
  d.toggle();
  d.setTab('about');
  await tick(2);
  await d.openAnnotate();
  await tick(2);
  assert.notEqual(d.activeTab, 'about');
  assert.ok(host.querySelector('[data-fab-note-dock]').contains(window.Annotate._state.ui), 'the card is in the dock');
  window.Annotate.disable();
  d.close();
  await tick(2);
});

test('with nothing selected, a tap on the launcher opens the drawer as it always has', async () => {
  d.dropSelOffer();
  d.onDown(press());
  d.onUp(press());
  await tick(2);
  assert.equal(d.open, true);
  d.close();
  await tick(2);
});

test('forgetting the offer drops it and the range with it', async () => {
  select(doc.getElementById('p1').firstChild, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  d.dropSelOffer();
  assert.equal(d.selOffer, null);
  await d.noteSelection();
  assert.equal(window.Annotate.enabled, false, 'nothing to note, so nothing came on');
});

test('a page that notes a selection itself declares so, and the offer stands down there', async () => {
  // Dictate: its own note is the one that travels in the answer, so a second
  // "+ note" filing elsewhere would lose what the reader wrote.
  doc.documentElement.setAttribute('data-fab-no-sel-offer', '');
  select(doc.getElementById('p1').firstChild, 4, 19);
  await settle();
  assert.equal(d.selOffer, null);
  doc.documentElement.removeAttribute('data-fab-no-sel-offer');
  select(doc.getElementById('p1').firstChild, 4, 19);
  await settle();
  assert.ok(d.selOffer, 'any other page keeps the offer');
  d.dropSelOffer();
});

test('in a toss, a document the subject frame loads after the announcement is watched too', async () => {
  // toss-render announces the subject as it STARTS the frame's load, so a
  // launcher already up reads the document being replaced. Two jsdom iframes
  // stand in for the outgoing and the incoming document of one frame.
  const mk = () => { const f = doc.createElement('iframe'); doc.body.appendChild(f);
    f.contentDocument.body.innerHTML = '<p>Words in the framed page to select.</p>'; return f.contentDocument; };
  const outgoing = mk(), incoming = mk();
  const frame = new window.EventTarget();
  let current = outgoing;
  Object.defineProperty(frame, 'contentDocument', { get: () => current });
  window.__tossFrame = frame;
  try {
    d.adoptSubject();
    current = incoming;
    frame.dispatchEvent(new window.Event('load'));
    const t = incoming.querySelector('p').firstChild;
    const r = incoming.createRange(); r.setStart(t, 0); r.setEnd(t, 5);
    const sel = incoming.defaultView.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    incoming.dispatchEvent(new window.Event('selectionchange'));
    await settle();
    assert.ok(d.selOffer, 'the incoming document was heard');
    assert.equal(d.selOffer.quote, 'Words');
    d.dropSelOffer();
  } finally {
    window.__tossFrame = null;
  }
});

test('item and page notes keep separate drafts, survive failed writes, and save to the captured subject', async () => {
  Alpine.data('noteContext', () => ({
    selected: 'P18',
    get about() { return { title: 'Peeves',
      subject: { about: 'mehrlander/web-tools:docs/map-tabs.csv#peeves', label: 'Peeves' },
      selection: { about: 'mehrlander/web-tools:skills/peeves/peeves.csv#' + this.selected,
        label: this.selected === 'P18' ? 'P18 · Shallow defense' : 'P33 · Reinventing the wheel',
        aliases: this.selected === 'P33' ? ['mehrlander/web-tools:skills/peeves/peeves.csv#P45'] : [] },
    }; },
  }));
  const context = doc.createElement('div');
  context.setAttribute('x-data', 'noteContext');
  context.getClientRects = () => [{ width: 390, height: 700 }];
  doc.body.prepend(context); Alpine.initTree(context);
  const view = Alpine.$data(context);
  d.noteScope = 'item'; d.openAbout(); await tick(2);
  assert.equal(d.TABS.some(t => t.key === 'note'), false, 'About is the only note surface');
  assert.equal(d.noteChoice.label, 'P18 · Shallow defense');
  d.noteText = 'The justification can be valid and still insufficient.';
  d.noteScope = 'page'; d.noteSync();
  assert.equal(d.noteText, '', 'the item draft does not move to the page');
  d.noteText = 'Review the secondary group.';
  d.noteScope = 'item'; d.noteSync();
  assert.match(d.noteText, /justification/);
  view.selected = 'P33'; await tick(2);
  assert.equal(d.noteText, '', 'a newly selected item has its own draft');
  view.selected = 'P18'; await tick(2);
  assert.match(d.noteText, /justification/);

  writeFailure = true;
  await d.saveNote();
  assert.match(d.noteText, /justification/, 'a failed save keeps the draft');
  assert.match(d.noteMsg, /Not saved: offline/);
  writeFailure = false;
  let release;
  holdWrite = new Promise(r => { release = r; });
  const saving = d.saveNote(); await tick(2);
  view.selected = 'P33'; await tick(2);
  d.noteText = 'Prefer the existing component.';
  release(); await saving; holdWrite = null;
  const stored = window.Notes.parse(journal).find(n => n.text.startsWith('The justification'));
  assert.equal(stored.about, 'mehrlander/web-tools:skills/peeves/peeves.csv#P18', 'an in-flight save stays on its original subject');
  assert.equal(d.noteText, 'Prefer the existing component.', 'a later draft is preserved');
  assert.equal(d.notesList.length, 0, 'P18 notes do not show under P33');
  view.selected = 'P18'; await tick(2);
  assert.equal(d.noteText, '', 'the successfully saved draft is cleared');
  assert.equal(d.notesList[0].text, stored.text);
  d.noteScope = 'page'; d.noteSync();
  assert.equal(d.noteText, 'Review the secondary group.');
  await d.saveNote();
  assert.equal(d.notesList[0].about, 'mehrlander/web-tools:docs/map-tabs.csv#peeves');

  d.noteScope = 'item'; view.selected = 'P33'; await tick(2);
  const old = window.Notes.make({ about: 'mehrlander/web-tools:skills/peeves/peeves.csv#P45', author: 'mehrlander', text: 'An older note on the merged entry.' });
  d.noteItems = await window.Notes.append(reg, old); d._noteRefresh();
  assert.equal(d.notesList[0].text, old.text, 'consolidated entries retain their notes');
  context.remove(); d.detect(); d.noteSync();
});
