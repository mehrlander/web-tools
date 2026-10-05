// lib/kits/look.js — look markers: a fragment that lands, says why, and rings
// the control to tap.
//
// The split is land.test.mjs's: what a DOM without layout can hold is here, and
// the geometry (where the dock sits, the ring over the control, the page not
// widening) is checked in pixels by `npm run shot` on lib/kits/demos/look.html.
// What is pinned here is the part a screenshot cannot show: which anchor a name
// resolves to, that a hidden target is revealed by clicking each named opener
// once and outermost first, that a miss says so instead of landing nowhere,
// that a message from a URL never becomes markup, and that a fragment is read
// the same way whether a page declared the walk or the link carried it.

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TextEncoder, TextDecoder } from 'node:util';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const KIT = readFileSync(path.join(repoRoot, 'lib/kits/look.js'), 'utf8');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// One realm per test, since the kit holds a single run per page. jsdom has no
// layout, so getClientRects answers empty for everything; here an element
// shows unless it or an ancestor carries `hidden`, which is the only hiding
// these fixtures use. jsdom also has no Web Animations and no scrolling, and
// the kit calls both unguarded, as a browser would answer them.
// A running marker re-places itself every frame, and jsdom's frames keep the
// process alive, so every realm is stopped and closed after its test.
const open = [];
afterEach(() => { for (const w of open.splice(0)) { try { w.Look?.stop(); } catch {} w.close(); } });

function realm(body, hash = '') {
  const { window } = makeWindow({
    html: `<!doctype html><html><head></head><body>${body}</body></html>`,
    url: 'https://localhost/test/' + (hash ? '#' + hash : ''),
  });
  window.Element.prototype.getClientRects = function () { return this.closest('[hidden]') ? [] : [{}]; };
  window.Element.prototype.animate = function () { return { cancel() {} }; };
  window.scrollTo = () => {};
  // Nor pseudo-elements, which the kit reads to tell whether the page already
  // draws Phosphor. Answered as "no icon font", which is what a bare page
  // gets, so the kit adds Phosphor's stylesheets.
  const style = window.getComputedStyle.bind(window);
  window.getComputedStyle = (el) => style(el);
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  new window.Function(KIT)();
  open.push(window);
  return window;
}

const card = (w) => w.document.querySelector('[data-look="dock"]');
const said = (w) => card(w)?.querySelector('[data-say]')?.textContent;
const loaded = (w) => new Promise(r => w.document.readyState === 'complete' ? r() : w.addEventListener('load', () => r()));

test('a link that says something lands, and the message stays text', async () => {
  // The message arrives from a URL. Set as HTML, `say=<img onerror=…>` would
  // run in the page; set as text it is only read.
  const w = realm('<p data-at="x">Hello</p>', 'show=x&say=' + encodeURIComponent('<b>bold</b> claim'));
  await loaded(w);
  await wait(30);
  assert.equal(said(w), '<b>bold</b> claim');
  assert.equal(card(w).querySelector('b'), null, 'no element was made from the message');
  assert.equal(card(w).style.display, '', 'the dock is on screen');
});

test('a lone landing with nothing to say draws no dock', async () => {
  const w = realm('<p data-at="x">Hello</p>');
  w.Look.start([{ at: 'x' }]);
  await wait(30);
  assert.equal(card(w).style.display, 'none');
  assert.equal(w.document.querySelector('[data-look="halo"]').style.display, 'block', 'the tint is the whole answer');
});

test('an absent anchor says so on screen rather than landing nowhere', async () => {
  const w = realm('<p data-at="x">Hello</p>');
  w.Look.start([{ at: 'nowhere', say: 'unused' }], { wait: 60 });
  await wait(150);
  assert.match(said(w), /^Not on this page: nowhere$/);
  assert.equal(card(w).querySelector('code').textContent, 'nowhere');
});

test('a target that exists but never shows is reported as hidden, not absent', async () => {
  // Two different repairs: an absent anchor is a wrong name, a hidden one is a
  // region that names no opener.
  const w = realm('<section hidden><p data-at="h">x</p></section>');
  w.Look.start([{ at: 'h', say: 'unused' }], { wait: 60 });
  await wait(150);
  assert.match(said(w), /^Hidden on this page: h$/);
});

test('a closed region is opened by the control it names', async () => {
  const w = realm(
    '<button data-at="tab-b">B</button>' +
    '<section id="b" hidden data-at-open="tab-b"><p data-at="row">row</p></section>');
  let clicks = 0;
  w.document.querySelector('[data-at="tab-b"]').addEventListener('click', () => {
    clicks++;
    w.document.getElementById('b').hidden = false;
  });
  w.Look.start([{ at: 'row', say: 'here' }], { wait: 200 });
  await wait(120);
  assert.equal(clicks, 1);
  assert.equal(w.document.getElementById('b').hidden, false);
  assert.equal(said(w), 'here');
});

test('nested regions open outermost first, and each opener is clicked once', async () => {
  // A toggle clicked twice closes what the first click opened, so a walk that
  // retried the inner opener while the outer one was still shut would leave
  // the target hidden behind a region it had opened and closed again.
  const w = realm(
    '<button data-at="outer">o</button>' +
    '<div id="o" hidden data-at-open="outer">' +
      '<button data-at="inner">i</button>' +
      '<div id="i" hidden data-at-open="inner"><p data-at="deep">deep</p></div>' +
    '</div>');
  const order = [];
  for (const id of ['outer', 'inner']) {
    w.document.querySelector(`[data-at="${id}"]`).addEventListener('click', () => {
      order.push(id);
      const r = w.document.getElementById(id[0]);
      r.hidden = !r.hidden;
    });
  }
  w.Look.start([{ at: 'deep', say: 'found' }], { wait: 300 });
  await wait(250);
  assert.deepEqual(order, ['outer', 'inner']);
  assert.equal(said(w), 'found');
});

test('doing a do step unlocks its forward arrow rather than moving on, and the tap reaches the page', async () => {
  // The reader should see what the tap did before going on, so the walk
  // stays on the step: the hand becomes the arrow, the number becomes a check.
  const w = realm('<button data-at="go">Go</button><p data-at="after">after</p>');
  let pressed = 0;
  w.document.querySelector('[data-at="go"]').addEventListener('click', () => pressed++);
  w.Look.start([{ at: 'go', tap: true, say: 'tap it' }, { at: 'after', say: 'and here' }]);
  await wait(30);
  assert.equal(said(w), 'tap it');
  assert.ok(card(w).querySelector('[data-where]'), 'a do step shows the hand where the forward arrow would be');
  assert.equal(card(w).querySelector('[aria-label="Next"]'), null, 'and no arrow to tap past the action');
  assert.equal(card(w).querySelector('[aria-label="Skip to step 2"]')?.dataset.go, '1', 'skipping is offered, and named');
  w.document.querySelector('[data-at="go"]').click();
  await wait(250);
  assert.equal(pressed, 1, 'the page saw the tap');
  assert.equal(said(w), 'tap it', 'the walk stays on the step');
  assert.equal(card(w).querySelector('[data-where]'), null, 'the hand is gone');
  assert.ok(card(w).querySelector('[aria-label="Next"]'), 'and the arrow is there');
  assert.equal(card(w).querySelector('[aria-label^="Skip"]'), null, 'with nothing left to skip');
  assert.ok(card(w).querySelector('[data-mark] i.ph-check'), 'the step is checked off');
  card(w).querySelector('[aria-label="Next"]').click();
  await wait(30);
  assert.equal(said(w), 'and here');
  assert.match(card(w).textContent, /2 of 2/);
});

test('tapping the hand before the step is done says what to tap', async () => {
  const w = realm('<button data-at="go" aria-label="Elements">E</button><p data-at="after">after</p>');
  w.Look.start([{ at: 'go', tap: true, say: 'open it' }, { at: 'after', say: 'then here' }]);
  await wait(30);
  assert.equal(w.document.querySelector('[data-look="tip"]'), null);
  card(w).querySelector('[data-where]').click();
  const tip = w.document.querySelector('[data-look="tip"]');
  assert.ok(tip, 'the hand answers');
  assert.equal(tip.textContent, 'Tap \u201cElements\u201d on the page to unlock the next step.');
  assert.equal(said(w), 'open it', 'and the walk stays put');
  w.document.querySelector('[data-at="go"]').click();
  await wait(30);
  assert.equal(w.document.querySelector('[data-look="tip"]'), null, 'doing the step takes the tip down');
});

test('a single tap link is unlocked by its tap and finished by Done; with nothing to say it just ends', async () => {
  let w = realm('<button data-at="go">Go</button>');
  w.Look.start([{ at: 'go', tap: true, say: 'tap it' }]);
  await wait(30);
  w.document.querySelector('[data-at="go"]').click();
  await wait(30);
  const done = card(w).querySelector('[aria-label="Done"]');
  assert.ok(done, 'Done appears once tapped');
  done.click();
  await wait(30);
  assert.equal(w.document.querySelector('[data-look]'), null);
  w = realm('<button data-at="go">Go</button>');
  w.Look.start([{ at: 'go', tap: true }]);
  await wait(30);
  w.document.querySelector('[data-at="go"]').click();
  await wait(30);
  assert.equal(w.document.querySelector('[data-look]'), null, 'no dock to unlock, so the marker goes');
});

test('Next, Back and Done move through a walk, and Done takes everything down', async () => {
  const w = realm('<p data-at="a">a</p><p data-at="b">b</p>');
  w.Look.start([{ at: 'a', say: 'first' }, { at: 'b', say: 'second' }]);
  await wait(30);
  card(w).querySelector('[data-go="1"]').click();
  await wait(30);
  assert.equal(said(w), 'second');
  card(w).querySelector('[data-go="-1"]').click();
  await wait(30);
  assert.equal(said(w), 'first');
  card(w).querySelector('[data-go="1"]').click();
  await wait(30);
  card(w).querySelector('[data-go="1"]').click();   // Done
  await wait(30);
  assert.equal(w.document.querySelector('[data-look]'), null, 'no marker left behind');
});

test('Escape takes the marker down', async () => {
  const w = realm('<p data-at="a">a</p>');
  w.Look.start([{ at: 'a', say: 'x' }]);
  await wait(30);
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(w.document.querySelector('[data-look]'), null);
});

test('an anchor is a data-at name first, then an id, then words or a selector', () => {
  const w = realm(
    '<p id="dup">by id</p><p data-at="dup">by name</p>' +
    '<p hidden data-at="twice">hidden copy</p><p data-at="twice">shown copy</p>' +
    '<div class="bar"><span>Ignore</span><button>Export</button></div>' +
    '<p>Mixed Case Words</p>');
  const { find } = w.Look;
  assert.equal(find('dup').textContent, 'by name', 'data-at wins over an id of the same name');
  assert.equal(find('twice').textContent, 'shown copy', 'a visible match is preferred');
  assert.equal(find('text:Export').tagName, 'BUTTON', 'the smallest element with exactly those words');
  assert.equal(find('text:mixed case words').tagName, 'P', 'case is a fallback, not the first try');
  assert.equal(find('css:.bar button').textContent, 'Export');
  assert.equal(find('css:[[nonsense'), null, 'a bad selector is a miss, not a throw');
  assert.equal(find(''), null);
});

test('every fragment form reads to the same cleaned steps', () => {
  const w = realm(
    '<script type="application/json" id="look-walks">' +
    '{"tour":[{"at":"a","say":"one","tap":1,"extra":"dropped"},{"at":"b"}]}</script>');
  const { encode } = w.Look;
  // The kit's arrays belong to the page's realm; compare them as data.
  const fromHash = (h) => JSON.parse(JSON.stringify(w.Look.fromHash(h)));
  assert.deepEqual(fromHash('#show=a&say=hi'), [{ at: 'a', say: 'hi', tap: false }]);
  assert.deepEqual(fromHash('#tap=a&n=3&tab=x'), [{ at: 'a', say: '', tap: true }],
    'a nonce and a page\'s own keys ride beside it untouched');
  assert.deepEqual(fromHash('#walk=tour'), [{ at: 'a', say: 'one', tap: true }, { at: 'b', say: '', tap: false }]);
  const steps = [{ at: 'café', say: 'Ünïcode & "quotes" + slashes/', tap: true }];
  const carried = fromHash('#steps=' + encode(steps));
  assert.deepEqual(carried, steps, 'base64url carries any text through a URL intact');
  assert.doesNotMatch(encode(steps), /[+/=]/, 'and needs no escaping in one');
  assert.deepEqual(fromHash('#steps=' + encodeURIComponent(JSON.stringify(steps))), steps, 'plain JSON is read too');
  assert.equal(fromHash('#tab=x&gh=o/r'), null, 'a fragment with no look key is not an ask');
});

test('a fragment that cannot be followed becomes a miss the reader sees', () => {
  const w = realm('');
  const { fromHash } = w.Look;
  assert.match(fromHash('#walk=absent')[0].miss, /no walk named .absent./);
  assert.match(fromHash('#steps=!!!')[0].miss, /could not be read/);
  assert.match(fromHash('#steps=' + encodeURIComponent('[{"say":"no anchor"}]'))[0].miss, /no steps/);
});

test('a link is untrusted, so steps are capped and coerced', () => {
  const w = realm('');
  const many = Array.from({ length: 80 }, (_, i) => ({ at: 'a' + i, say: 'x'.repeat(900), tap: 'yes' }));
  const out = w.Look.fromHash('#steps=' + w.Look.encode(many));
  assert.equal(out.length, 50);
  assert.equal(out[0].say.length, 500);
  assert.equal(out[0].tap, true);
});

test('the fragment changing its look keys starts a new run; the page rewriting its own keys does not', async () => {
  const w = realm('<p data-at="a">a</p><p data-at="b">b</p>', 'show=a&say=one&tab=x');
  await loaded(w);
  await wait(30);
  assert.equal(said(w), 'one');
  w.Look.stop();
  w.location.hash = 'show=a&say=one&tab=y';
  await wait(60);
  assert.equal(card(w), null, 'a tab switch is not a second ask');
  w.location.hash = 'show=b&say=two&tab=y';
  await wait(60);
  assert.equal(said(w), 'two');
});

test('a second copy of the kit defers to the first', () => {
  const w = realm('');
  const first = w.Look;
  new w.Function(KIT)();
  assert.equal(w.Look, first);
});

test('arriving scrolls every pane between the target and the page, not only the page', async () => {
  // The browser's scrollIntoView walks each scroller, which is the point: a
  // target in a pane that is itself out of view must reach the reader.
  // Measured 2026-10-04 through a toss, where the page-only scroll left the
  // target clipped in its pane with the tint drawn over the content below.
  const w = realm('<div id="pane" style="overflow:auto;height:100px"><p data-at="deep">deep</p></div>');
  const calls = [];
  w.Element.prototype.scrollIntoView = function (o) { calls.push([this.getAttribute('data-at'), o.block]); };
  w.Look.start([{ at: 'deep', say: 'here' }]);
  await wait(40);
  assert.deepEqual(calls, [['deep', 'center']]);
});

test('a target scrolled out of its pane takes its mark with it', async () => {
  // The overlay lives on the root, so nothing clips it but this check: without
  // it the tint floats over whatever now occupies the target's old place.
  // Both longhands, since jsdom does not expand the overflow shorthand into
  // overflowX/overflowY the way a browser's computed style does.
  const w = realm('<div id="pane" style="overflow-x:auto;overflow-y:auto"><p data-at="deep">deep</p></div>');
  w.Element.prototype.scrollIntoView = () => {};
  const rect = (top) => () => ({ top, bottom: top + 20, left: 0, right: 100, width: 100, height: 20 });
  const pane = w.document.getElementById('pane'), deep = w.document.querySelector('[data-at="deep"]');
  pane.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 300, width: 300, height: 100 });
  deep.getBoundingClientRect = rect(40);
  w.Look.start([{ at: 'deep', say: 'here' }]);
  await wait(60);
  const halo = w.document.querySelector('[data-look="halo"]');
  assert.equal(halo.style.visibility, '', 'in its pane: marked');
  deep.getBoundingClientRect = rect(400);
  await wait(60);
  assert.equal(halo.style.visibility, 'hidden', 'scrolled out of its pane: unmarked');
  assert.equal(said(w), 'here', 'and the message stays');
});

test('a walk numbers its target and its dock alike, and the number becomes the way back', async () => {
  // The dock does not sit beside its target, so the number is what ties them.
  // Scrolled away, the dock's number turns into an arrow toward the target,
  // and tapping it brings the target back.
  const w = realm('<p data-at="a">a</p><p data-at="b">b</p>');
  const calls = [];
  w.Element.prototype.scrollIntoView = function () { calls.push(this.getAttribute('data-at')); };
  const a = w.document.querySelector('[data-at="a"]');
  a.getBoundingClientRect = () => ({ top: 100, bottom: 120, left: 0, right: 100, width: 100, height: 20 });
  w.Look.start([{ at: 'a', say: 'first' }, { at: 'b', say: 'second' }]);
  await wait(40);
  const mark = card(w).querySelector('[data-mark]');
  assert.equal(w.document.querySelector('[data-look="num"]').textContent, '1');
  assert.equal(mark.textContent, '1');
  a.getBoundingClientRect = () => ({ top: 3000, bottom: 3020, left: 0, right: 100, width: 100, height: 20 });
  await wait(60);
  assert.equal(mark.dataset.away, 'down', 'below the screen: an arrow down');
  assert.ok(mark.querySelector('i.ph-arrow-down'), 'drawn as Phosphor\'s arrow, not a character');
  assert.equal(w.document.querySelector('[data-look="num"]').style.visibility, 'hidden');
  calls.length = 0;
  mark.click();
  assert.deepEqual(calls, ['a'], 'the arrow brings the target back');
  a.getBoundingClientRect = () => ({ top: -300, bottom: -280, left: 0, right: 100, width: 100, height: 20 });
  await wait(60);
  assert.equal(mark.dataset.away, 'up');
  a.getBoundingClientRect = () => ({ top: 100, bottom: 120, left: 0, right: 100, width: 100, height: 20 });
  await wait(60);
  assert.equal(mark.textContent, '1', 'back in view: the number again');
  assert.equal(mark.style.display, 'inline-flex', 'shown as the badge it was styled as, so the number stays centred');
  assert.equal(w.document.querySelector('[data-look="num"]').style.display, 'inline-flex');
});

test('the arrow keys walk, but not while the reader is typing', async () => {
  const w = realm('<input id="field"><p data-at="a">a</p><p data-at="b">b</p>');
  w.Look.start([{ at: 'a', say: 'first' }, { at: 'b', say: 'second' }]);
  await wait(30);
  const key = (k, target = w.document.body) =>
    target.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
  key('ArrowRight');
  await wait(30);
  assert.equal(said(w), 'second');
  key('ArrowRight');
  await wait(30);
  assert.equal(said(w), 'second', 'the last step stays: only Done ends a walk');
  key('ArrowLeft', w.document.getElementById('field'));
  await wait(30);
  assert.equal(said(w), 'second', 'an arrow in a text field is the field\'s');
  key('ArrowLeft');
  await wait(30);
  assert.equal(said(w), 'first');
});

test('a step with a message keeps its tint while the dock is up; a bare landing fades', async () => {
  // The reader may scroll away and back to a step, so its mark has to be there
  // when they return. A landing with nothing to say has no dock to return by.
  const fades = (w) => {
    const seen = [];
    w.Element.prototype.animate = function (frames) {
      if (this.getAttribute('data-look') === 'halo' && frames.some(f => f.opacity === 0)) seen.push(1);
      return { cancel() {} };
    };
    return seen;
  };
  let w = realm('<p data-at="a">a</p>');
  let seen = fades(w);
  w.Look.start([{ at: 'a', say: 'stays' }]);
  await wait(30);
  assert.equal(seen.length, 0);
  w = realm('<p data-at="a">a</p>');
  seen = fades(w);
  w.Look.start([{ at: 'a' }]);
  await wait(30);
  assert.equal(seen.length, 1);
});

test('a page without Phosphor is given its stylesheets once; a page that links them is left alone', async () => {
  // The marker's arrows, close and hand are Phosphor classes, and a class with
  // no stylesheet behind it draws nothing, so a bare page has to be given one.
  const links = (w) => [...w.document.querySelectorAll('link[href*="@phosphor-icons/web"]')].map(l => l.href.split('/src/')[1]);
  let w = realm('<p data-at="a">a</p>');
  w.Look.start([{ at: 'a', say: 'x' }]);
  w.Look.start([{ at: 'a', say: 'again' }]);
  assert.deepEqual(links(w), ['bold/style.css', 'fill/style.css'], 'both weights, and not twice');
  w = realm('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/bold/style.css">' +
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/fill/style.css"><p data-at="a">a</p>');
  w.Look.start([{ at: 'a', say: 'x' }]);
  assert.equal(links(w).length, 2, 'nothing added beside the page\'s own');
});

test('the layer clips nothing, and a mark at the right edge stays inside the page', async () => {
  // A zero-height layer that clipped sideways drew nothing on an iPhone: the
  // tint and the step's number were gone and only the fixed dock showed. With
  // no clip, the page's width is kept by clamping each mark to it instead.
  const w = realm('<button data-at="edge">Edge</button>');
  const vw = w.innerWidth;
  w.document.querySelector('[data-at="edge"]').getBoundingClientRect =
    () => ({ top: 100, bottom: 130, left: vw - 60, right: vw, width: 60, height: 30 });
  w.Look.start([{ at: 'edge', tap: true, say: 'here' }, { at: 'edge', say: 'again' }]);
  await wait(60);
  const q = (k) => w.document.querySelector(`[data-look="${k}"]`);
  const layer = q('layer');
  assert.equal(layer.style.overflow + layer.style.overflowX + layer.style.overflowY, '', 'no clip on the layer');
  const right = (el) => parseFloat(el.style.left) + parseFloat(el.style.width || el.offsetWidth || 0);
  assert.ok(right(q('halo')) <= vw, `halo ends at ${right(q('halo'))}, inside ${vw}`);
  assert.ok(parseFloat(q('num').style.left) + 24 <= vw, 'the number too');
  assert.ok(parseFloat(q('pointer').style.left) >= 0, 'and the hand');
});

test('skipping a do step passes over what its tap would have made, and so does Back', async () => {
  // The demo's Save button exists only while its row is being edited. Leaving
  // the edit undone must not land on the Save step, nor must coming back to
  // it after the edit is finished: neither has anything to point at.
  const w = realm('<p data-at="start">start</p><button data-at="edit">Edit</button><p data-at="end">end</p>');
  w.document.querySelector('[data-at="edit"]').addEventListener('click', () => {
    w.document.body.insertAdjacentHTML('beforeend', '<button data-at="save">Save</button>');
    w.document.querySelector('[data-at="save"]').addEventListener('click', (e) => e.target.remove());
  });
  w.Look.start([{ at: 'start', say: 'start' }, { at: 'edit', tap: true, say: 'edit' },
    { at: 'save', tap: true, say: 'save' }, { at: 'end', say: 'end' }], { wait: 60 });
  await wait(30);
  card(w).querySelector('[data-go="1"]').click();
  await wait(30);
  const skip = card(w).querySelector('[aria-label^="Skip"]');
  assert.equal(skip.getAttribute('aria-label'), 'Skip to step 4', 'past the Save step, which has no target yet');
  skip.click();
  await wait(30);
  assert.equal(said(w), 'end');
  card(w).querySelector('[aria-label="Back"]').click();
  await wait(30);
  assert.equal(said(w), 'edit', 'Back passes over the Save step too');
  w.document.querySelector('[data-at="edit"]').click();
  await wait(30);
  card(w).querySelector('[aria-label="Next"]').click();
  await wait(30);
  assert.equal(said(w), 'save', 'and doing the tap brings the Save step back');
  w.document.querySelector('[data-at="save"]').click();
  await wait(30);
  assert.ok(card(w).querySelector('[data-mark] i.ph-check'), 'a done step whose target went away keeps its check, not a way back');
  card(w).querySelector('[aria-label="Next"]').click();
  await wait(30);
  assert.equal(said(w), 'end');
  card(w).querySelector('[aria-label="Back"]').click();
  await wait(30);
  assert.equal(said(w), 'edit', 'once saved, Back from the end skips the Save step again');
});

test('a target an earlier tap makes, reached by Next, sends the reader back to that tap', async () => {
  // Next from a look step goes one on, since a target may still be
  // rendering; when it is missing for want of a skipped tap, the dock says so.
  const w = realm('<button data-at="edit">Edit</button><p data-at="mid">mid</p>');
  w.document.querySelector('[data-at="edit"]').addEventListener('click', () => {
    if (!w.document.querySelector('[data-at="save"]')) w.document.body.insertAdjacentHTML('beforeend', '<button data-at="save">Save</button>');
  });
  w.Look.start([{ at: 'edit', tap: true, say: 'edit' }, { at: 'mid', say: 'mid' }, { at: 'save', say: 'save' }], { wait: 60 });
  await wait(30);
  card(w).querySelector('[aria-label="Skip to step 2"]').click();
  await wait(30);
  card(w).querySelector('[aria-label="Next"]').click();
  await wait(150);
  assert.equal(said(w), 'This step needs step 1 first.');
  card(w).querySelector('[aria-label="Go to step 1"]').click();
  await wait(30);
  assert.equal(said(w), 'edit');
  w.document.querySelector('[data-at="edit"]').click();
  await wait(30);
  card(w).querySelector('[aria-label="Next"]').click();
  await wait(30);
  assert.equal(said(w), 'mid');
  card(w).querySelector('[aria-label="Next"]').click();
  await wait(30);
  assert.equal(said(w), 'save', 'and from there the walk carries on');
});

test('a missing target with no tap before it is still a wrong name', async () => {
  const w = realm('<p data-at="a">a</p>');
  w.Look.start([{ at: 'a', say: 'one' }, { at: 'nowhere', say: 'two' }], { wait: 60 });
  await wait(30);
  card(w).querySelector('[data-go="1"]').click();
  await wait(150);
  assert.match(said(w), /^Not on this page: nowhere$/);
  assert.equal(card(w).querySelector('[aria-label^="Go to step"]'), null);
});
