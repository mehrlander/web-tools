// kits/probe.js — the page shows its own conditions, so a screenshot carries
// them, and card.js's report hook, which is what puts a guard's REFUSAL into
// that picture.
//
// Held at the edges that decide whether the instrument can be trusted:
//
//   - silent unless the address asks, and a no-op shape when silent, so an
//     adopting page never branches and a reader never meets it by accident;
//   - never the pointer's target, which is the one rule the kit states as a
//     rule: the bug class it watches is decided by hit-testing, so an overlay
//     that can be hovered changes what it is measuring;
//   - card.js reports every branch it takes, the refusals included, and
//     reports nothing when nobody is listening.
//
// Each assertion below was checked to fail with its own fix removed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const src = (p) => readFileSync(path.join(repoRoot, p), 'utf8');

// One window per case: the kit reads the address once, at load, and installs
// listeners, so a shared window would carry one case's state into the next.
function boot({ search = '', withCard = true } = {}) {
  const { window } = makeWindow({
    html: `<!doctype html><html><body>
      <button id="trigger" data-obs="n1">note</button>
      <div id="pop"><p>a card</p></div>
    </body></html>`,
  });
  window.matchMedia = (q) => ({ matches: !q.includes('hover: none') });
  // jsdom has no rAF in every configuration; the kit coalesces its draws
  // through one, so an immediate stand-in keeps the drawn output synchronous
  // and the assertions free of timers.
  window.requestAnimationFrame = (fn) => { fn(); return 0; };
  try { window.history.replaceState(null, '', '/probe.html' + search); } catch (e) {}
  if (withCard) new window.Function(src('lib/kits/card.js'))();
  new window.Function(src('lib/kits/probe.js'))();
  return window;
}

test('silent unless the address asks for it, and a no-op shape when silent', () => {
  const w = boot({ search: '' });
  assert.equal(w.Probe.on, false);
  assert.equal(w.document.getElementById('wt-probe'), null);
  // The no-op has to answer every call an adopting page makes, or the page
  // that adopted it breaks the moment the probe is off, which is always.
  for (const m of ['log', 'watch', 'unwatch', 'file', 'state', 'trace']) {
    assert.equal(typeof w.Probe[m], 'function', m + ' missing from the no-op shape');
  }
  assert.doesNotThrow(() => { w.Probe.log('x', 'y'); w.Probe.watch('a', () => 'b'); });
  // ?probe=off is the explicit stand-down, for handing a probed link to
  // someone who should not meet the overlay.
  assert.equal(boot({ search: '?probe=off' }).Probe.on, false);
});

test('a caller can arm it with no address, and take it off again whole', () => {
  // The fab's launcher menu is the caller this exists for: a reader already
  // looking at the fault instruments it without retyping the URL on a phone.
  const w = boot({ search: '' });
  assert.equal(w.Probe.on, false);
  assert.equal(typeof w.Probe.arm, 'function', 'the idle shape must offer the way in');

  w.Probe.arm();
  assert.equal(w.Probe.on, true);
  assert.ok(w.document.getElementById('wt-probe'), 'armed, it draws');
  assert.equal(typeof w.__cardProbe, 'function', 'armed, card.js has somewhere to report');
  const api = w.Probe;
  api.log('x', 'y');
  assert.ok(api.trace().length > 0);

  // OFF MEANS GONE. An instrument that can only be removed by reloading is one
  // a reader stops reaching for, and a reload is the one thing that loses the
  // trace it was turned on to collect.
  assert.equal(w.Probe.stop(), true);
  assert.equal(w.Probe.on, false);
  assert.equal(w.document.getElementById('wt-probe'), null, 'the overlay goes');
  assert.equal(w.document.getElementById('wt-probe-css'), null, 'and its stylesheet with it');
  assert.equal(w.__cardProbe, undefined, 'and the card hook goes back to what it was');
  // The page's own wrappers keep a reference to the old object; a call through
  // it after stop() must record nothing, or the next arm opens onto a trace
  // that has been filling invisibly.
  api.log('after', 'stop');
  assert.equal(api.trace().length, 0);

  // And it comes back clean rather than resuming a trace with a hole in it.
  w.Probe.arm();
  assert.equal(w.Probe.on, true);
  assert.ok(w.Probe.trace().every((r) => r.tag !== 'after'));
});

test('the keyboard has a way off, and the overlay says which key it is', () => {
  // The overlay may never be tapped, so it cannot carry a close control; the
  // fab's launcher menu is the way off on a phone and this is the desktop's.
  // Both matter, because an instrument that can only be removed by reloading
  // loses the trace it was turned on to collect.
  const w = boot({ search: '?probe=1' });
  assert.ok(w.document.getElementById('wt-probe'));
  assert.match(w.document.getElementById('wt-probe').textContent, /X off/,
    'a key nobody can find is not a way out');
  const ev = new w.KeyboardEvent('keydown', { code: 'KeyX', altKey: true, shiftKey: true, bubbles: true });
  w.dispatchEvent(ev);
  assert.equal(w.Probe.on, false);
  assert.equal(w.document.getElementById('wt-probe'), null);
});

test('a page declares what it knows and the probe adopts it, whichever starts first', () => {
  // DECLARED, NOT REGISTERED. A page that registers watchers itself inside an
  // `if (Probe.on)` has nothing to give a probe armed later, which is the case
  // the fab created: the declaration has already run and gone unheard, so the
  // capture names card.js's verdicts with nothing saying which panel each
  // belongs to.
  const before = boot({ search: '' });
  before.__probeWatch = { 'note card': () => 'open=no' };
  before.Probe.arm();
  assert.match(before.document.getElementById('wt-probe').textContent, /note card/,
    'a declaration made before the probe started is taken up at arm time');

  // The other order: the address arms at boot and the page declares at its own
  // signal, minutes of DOM later. The check rides the draw, so neither side
  // has to announce itself.
  const after = boot({ search: '?probe=1' });
  assert.doesNotMatch(after.document.getElementById('wt-probe').textContent, /tip panel/);
  let handed = null;
  after.__probeWatch = (probe) => { handed = probe; probe.watch('tip panel', () => 'open=yes'); };
  after.Probe.log('nudge');   // any activity draws, and a draw adopts
  assert.equal(handed, after.Probe, 'the function is called with the probe itself');
  assert.match(after.document.getElementById('wt-probe').textContent, /tip panel/);

  // Once, not once per draw: a declaration that wraps handlers must not stack.
  let calls = 0;
  const w = boot({ search: '?probe=1' });
  w.__probeWatch = () => { calls++; };
  w.Probe.log('a'); w.Probe.log('b'); w.Probe.log('c');
  assert.equal(calls, 1);
});

test('it draws when asked, and the overlay is never the pointer target', () => {
  const w = boot({ search: '?probe=pop' });
  assert.equal(w.Probe.on, true);
  const box = w.document.getElementById('wt-probe');
  assert.ok(box, 'the overlay should be in the document');
  assert.equal(box.getAttribute('aria-hidden'), 'true');
  // THE RULE. Asserted against the stylesheet the kit ships rather than
  // against a computed style jsdom does not compute, and asserted twice: the
  // root declares it, and nothing under the root takes it back.
  const css = w.document.getElementById('wt-probe-css').textContent;
  assert.match(css, /#wt-probe\{[^}]*pointer-events:\s*none/,
    'the overlay root must be pointer-events:none');
  assert.equal(/pointer-events:\s*(auto|all)/.test(css), false,
    'nothing in the overlay may take the pointer back');
});

test('the overlay hops corners rather than being dragged', () => {
  const w = boot({ search: '?probe=pop' });
  const box = w.document.getElementById('wt-probe');
  // It starts away from the left column, where a page's own content usually
  // is, and the corner is an attribute the stylesheet answers rather than an
  // inline position, so the four cases stay in one place.
  assert.equal(box.getAttribute('data-corner'), 'br');
  const hop = () => w.document.dispatchEvent(
    new w.KeyboardEvent('keydown', { code: 'KeyM', altKey: true, shiftKey: true, bubbles: true }));
  hop();
  assert.equal(box.getAttribute('data-corner'), 'bl');
  hop(); hop(); hop();
  assert.equal(box.getAttribute('data-corner'), 'br', 'four hops return it');
  // Dragging is what a reader would reach for and is exactly what this cannot
  // offer: a draggable overlay takes the pointer, which is the rule.
  const css = w.document.getElementById('wt-probe-css').textContent;
  assert.equal(/pointer-events:\s*(auto|all)/.test(css), false);
});

test('the window is a page on the house stack, light, with one scroll region', () => {
  // Three defects reported from a real screenshot, now answered by the stack
  // the rest of the estate uses rather than by a private stylesheet.
  const page = src('pages/probe-window.html');

  // SAME LIBRARIES, SAME URL as every page here.
  assert.match(page, /@tailwindcss\/browser@4/, 'Tailwind, from the house combine URL');
  assert.match(page, /daisyui@5/, 'daisyUI, from the house combine URL');
  assert.match(page, /cdn\.jsdelivr\.net\/combine\//, 'one combine request, not several');

  // LIGHT, pinned rather than following the machine: daisyUI otherwise reads
  // prefers-color-scheme and the reader uses no dark theme.
  assert.match(page, /<html[^>]*data-theme="light"/, 'the theme is pinned on the root');

  // HOUSE RULE 4: the panes divide a viewport, and exactly one opts into
  // overflow, which is the whole of what "one scroll region" means.
  assert.match(page, /fixed inset-0 grid grid-rows-\[auto_auto_1fr_auto\]/,
    'the root is the rule-4 shape');
  assert.match(page, /<body[^>]*\boverflow-hidden\b/, 'the document itself must not scroll');
  const scrollers = page.match(/overflow-y-auto/g) || [];
  assert.equal(scrollers.length, 1, 'exactly one pane may scroll; found ' + scrollers.length);
});

test('the kit stays the model: no second stylesheet, no second DOM', () => {
  // The window is a page and owns its view. This is what stops the kit growing
  // a private copy of a stylesheet and a renderer, which is where the dark
  // theme and the double scrollbar came from.
  const kit = src('lib/kits/probe.js');
  assert.equal(/const WIN_CSS/.test(kit), false,
    'the kit carries no stylesheet of its own');
  assert.equal(/function renderWindow/.test(kit), false,
    'the kit builds no second DOM');
  // It opens the page by NAVIGATION, never by writing a document: measured
  // 2026-09-10, a document written into a blank window loads no external
  // subresource at all, so a written window can never be on the house stack.
  assert.equal(/w\.document\.write/.test(kit), false,
    'the window is navigated to, not written into');
  assert.match(kit, /window\.open\(winSrc/, 'it opens the page source as a blob');
  assert.match(kit, /gh\.get\('pages\/probe-window\.html'\)/,
    'fetched at whatever ref the kit itself was loaded from, so it needs no deploy');
});

test('a live line is read at draw time, not at registration', () => {
  const w = boot({ search: '?probe=pop' });
  let n = 0;
  w.Probe.watch('count', () => 'n=' + n);
  n = 7;
  w.Probe.log('tick');
  assert.match(w.document.getElementById('wt-probe').textContent, /n=7/,
    'a watcher caching its value at registration would still say n=0');
});

test('the trace keeps order, deltas and a bounded tail', () => {
  const w = boot({ search: '?probe=pop' });
  w.Probe.log('one', 'a');
  w.Probe.log('two', 'b');
  const t = w.Probe.trace();
  assert.equal(t.at(-2).tag, 'one');
  assert.equal(t.at(-1).tag, 'two');
  assert.ok(t.at(-1).t >= t.at(-2).t, 'stamps must not go backwards');
  assert.ok(t.at(-1).d >= 0, 'each entry carries its delta from the one before');
  for (let i = 0; i < 500; i++) w.Probe.log('fill', i);
  assert.ok(w.Probe.trace().length <= 400, 'the retained trace is bounded');
});

test('card.js reports every branch it takes, refusals included', () => {
  const w = boot({ search: '?probe=pop' });
  const seen = [];
  const chained = w.__cardProbe;              // the probe's own listener
  w.__cardProbe = (tag, el, d) => { seen.push(tag); chained(tag, el, d); };

  const pop = w.document.getElementById('pop');
  const trigger = w.document.getElementById('trigger');
  let closed = 0;
  w.Card.wire(pop, { onClose: () => { closed++; }, except: ['[data-obs]'], label: 'note card' });
  assert.ok(seen.includes('wire:on'), 'the attach is reported, with the panel named');

  // A press on the trigger is NOT a press outside, and the refusal is the
  // line that says so. Without it, a card that stayed open on a press looks
  // the same as one whose listener never ran.
  trigger.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true }));
  assert.ok(seen.includes('press:except'), 'the except-match refusal is reported');
  assert.equal(closed, 0);

  // And the press that does close it.
  w.document.body.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true }));
  assert.ok(seen.includes('press:close'));
  assert.equal(closed, 1);

  // The trace carries them as card:<door>:<verdict>, which is the shape a
  // reader of the overlay is scanning for.
  const tags = w.Probe.trace().map((r) => r.tag);
  assert.ok(tags.some((t) => t.startsWith('card:press:')), 'card decisions reach the trace');
});

test('the geometry mode is reported as such, so a capture is not misread', () => {
  const w = boot({ search: '?probe=pop' });
  const seen = [];
  const chained = w.__cardProbe;
  w.__cardProbe = (tag, el, d) => { seen.push([tag, d]); chained(tag, el, d); };
  const pop = w.document.getElementById('pop');
  w.Card.wire(pop, { onClose() {}, stale: 'geometry', label: 'tip panel' });
  // A pointer arriving elsewhere must be reported as declined-by-mode rather
  // than silently ignored: "the pointer guard is off here" is the answer on a
  // note-kind panel, and a trace that omits it reads as a missing listener.
  w.document.body.dispatchEvent(new w.Event('pointerover', { bubbles: true }));
  const off = seen.filter(([t]) => t === 'over:off');
  assert.equal(off.length, 1, 'geometry mode declines the pointer guard, and says so');
  assert.equal(off[0][1].stale, 'geometry');
  assert.equal(off[0][1].name, 'tip panel', 'the label names the panel in the trace');
  // ONCE, because it is a fact about the panel rather than an event. Said per
  // move it buries the arm and the close under one line per mouse twitch.
  for (let i = 0; i < 5; i++) w.document.body.dispatchEvent(new w.Event('pointerover', { bubbles: true }));
  assert.equal(seen.filter(([t]) => t === 'over:off').length, 1,
    'the mode is reported once per wired panel, not once per pointer move');
});

test('a repeat is one line with a count, so a flood cannot fill the tail', () => {
  const w = boot({ search: '?probe=pop' });
  w.Probe.log('win:scroll', 'document');
  for (let i = 0; i < 40; i++) w.Probe.log('win:scroll', 'document');
  const t = w.Probe.trace();
  assert.equal(t.length, 2, 'probe:on, then one coalesced run');
  assert.equal(t.at(-1).n, 41);
  assert.match(w.document.getElementById('wt-probe').textContent, /×41/);
  // A different detail is a different fact and starts its own line.
  w.Probe.log('win:scroll', 'div.list');
  assert.equal(w.Probe.trace().length, 3);
});

test('card.js costs nothing and says nothing with no listener attached', () => {
  const w = boot({ search: '', withCard: true });   // probe off: no hook installed
  assert.equal(w.__cardProbe, undefined);
  const pop = w.document.getElementById('pop');
  // The whole contract of the hook: with nobody listening the guards behave
  // exactly as before and nothing throws.
  let closed = 0;
  assert.doesNotThrow(() => {
    w.Card.wire(pop, { onClose: () => { closed++; }, except: ['[data-obs]'] });
    w.document.body.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true }));
  });
  assert.equal(closed, 1, 'the dismissal contract is unchanged when nothing is watching');
});

test('filing fetches the reporter on the key press, and refuses in words', async () => {
  const w = boot({ search: '?probe=pop' });
  // No gh, no reporter: the refusal names which of the two is missing, since
  // "it did not file" is the least useful thing a diagnostic can say.
  let r = await w.Probe.file();
  assert.equal(r.ok, false);
  assert.equal(r.why, 'no gh on this page');

  // With a loader present the kit fetches page-report.js rather than asking
  // every adopting page to carry a writer most loads never reach.
  const asked = [];
  w.gh = { load: (p) => { asked.push(p); w.PageReport = { watch() {}, send: async (d) => ({ ok: true, path: 'logs/page/x.json', doc: d }) }; return Promise.resolve(); } };
  r = await w.Probe.file('probe:test');
  assert.deepEqual(asked, ['kits/page-report.js']);
  assert.equal(r.ok, true);
  assert.equal(r.doc.reason, 'probe:test');
  assert.equal(r.doc.probeId, w.Probe.id, 'the filed capture carries the overlay id');
  assert.match(w.document.getElementById('wt-probe').textContent, /filed/,
    'and the overlay says so, so the screenshot proves the capture landed');
});

test('a filed capture carries what a screenshot cannot, joined by the load id', () => {
  const w = boot({ search: '?probe=pop' });
  w.Probe.watch('obs', () => 'open=true pinned=false');
  w.Probe.log('card:over:arm', 'note card ms=220');
  const s = w.Probe.state();
  assert.equal(s.probeId, w.Probe.id, 'the capture and the overlay carry one id');
  // The capture is spread over PageReport's own document, so it must not
  // carry a key the reporter owns. `at` is the reporter's ISO stamp and a
  // number here broke the write inside it.
  assert.equal('at' in s, false, 'the capture may not shadow the reporter\'s own keys');
  assert.equal(typeof s.probeAt, 'number');
  assert.equal(s.live.obs, 'open=true pinned=false');
  assert.ok(Array.isArray(s.trace) && s.trace.length, 'the whole trace files, not the drawn tail');
  assert.equal(typeof s.environment.hover, 'boolean');
  assert.ok('under' in s.pointer, 'what the pointer was over is part of the capture');
});
