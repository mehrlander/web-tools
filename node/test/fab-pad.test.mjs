// fab-pad.test.mjs — the FAB's arrow pad: four chevrons round the launcher,
// raised by the menu's Place row or a drag into the bottom-left corner, whose
// presses reach the page in view as keydown and keyup, and which a tap on the
// launcher takes off. Also where the launcher stands while Peek's panel is up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
const doc = window.document;
const Alpine = await startAlpine(window, [
  'lib/kits/csv.js', 'lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js',
]);

async function mountFab() {
  const host = doc.createElement('div');
  host.innerHTML = '<div x-data="fab()" data-repo="mehrlander/web-tools" data-path="pages/index.html"></div>';
  doc.body.appendChild(host);
  Alpine.initTree(host);
  await tick(3);
  return { d: Alpine.$data(host.firstElementChild), host };
}
const ev = (type, x, y) => ({ type, button: 0, pointerId: 1, clientX: x, clientY: y, currentTarget: { setPointerCapture() {} } });
const wait = (ms) => new Promise(r => window.setTimeout(r, ms));

test('a drag into the bottom-left corner puts the arrow pad round the launcher there, and a tap takes it off', async () => {
  const { d, host } = await mountFab();
  const wrap = host.querySelector('[data-fab-wrap]');
  const W = window.innerWidth;
  try {
    d.x = -100; d.y = -200;
    d.onDown(ev('pointerdown', 950, 500));
    d.onMove(ev('pointermove', 10, 600));
    assert.equal(d.padAim, false, 'against the left edge alone, nothing is aimed');
    d.onMove(ev('pointermove', 10, 800));
    assert.equal(d.padAim, true, 'against the left edge and the bottom, the pad is aimed');
    assert.equal(d.tuckAim, false);
    d.onUp(ev('pointerup', 10, 800)); await tick(2);
    assert.equal(d.padOn, true);
    assert.equal(d.tuckNow, false, 'which is not a tuck');
    assert.equal(d.open, false, 'and the drawer does not open behind it');
    assert.deepEqual([d.x, d.y], [-(W - 80) + 46, 24 - 46], 'the launcher stays in that corner, in far enough for its chevrons');
    assert.doesNotMatch(wrap.className, /(^|\s)hidden(\s|$)/, 'the launcher is still the launcher');
    const pad = wrap.querySelector('[data-fab-pad]');
    assert.ok(pad, 'the chevrons ride inside the launcher, so a drag carries them');
    assert.deepEqual([...pad.querySelectorAll('[data-pad-key]')].map(b => b.dataset.padKey).sort(),
      ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'], 'four of them');
    d.onDown(ev('pointerdown', 100, 700));
    d.onUp(ev('pointerup', 100, 700)); await tick(2);
    assert.equal(d.padOn, false, 'a tap on the launcher takes the pad off');
    assert.equal(d.open, false, 'rather than opening the drawer');
    assert.deepEqual([d.x, d.y], [-(W - 80) + 46, 24 - 46], 'where it stands');
  } finally { host.remove(); }
});

test('with the pad up, the launcher drags inside room for its chevrons, and the corners do nothing', async () => {
  const { d, host } = await mountFab();
  try {
    d.raisePad();
    assert.deepEqual([d.x, d.y], [-22, -22], 'raised at rest, it slides in to make room');
    d.onDown(ev('pointerdown', 900, 700));
    d.onMove(ev('pointermove', 1100, 900));
    assert.deepEqual([d.x, d.y], [-22, -22], 'the drag stops short of the edges');
    assert.equal(d.tuckAim, false, 'and the corner is not aimed');
    d.onUp(ev('pointerup', 1100, 900)); await tick(2);
    assert.equal(d.tuckNow, false);
    assert.equal(d.padOn, true, 'a drag is not a tap');
    d.lowerPad();
  } finally { host.remove(); }
});

test('the menu\'s Form row raises the pad and takes it off again', async () => {
  const { d, host } = await mountFab();
  try {
    d.fabMenu = true; await tick(2);
    const btn = host.querySelector('[data-fab-pad-row]');
    assert.equal(btn.getAttribute('aria-label'), 'Arrow pad');
    btn.click(); await tick(2);
    assert.equal(d.fabMenu, false, 'the button closes the menu');
    assert.equal(d.padOn, true);
    assert.equal(btn.getAttribute('aria-pressed'), 'true', 'and shows itself pressed');
    btn.click(); await tick(2);
    assert.equal(d.padOn, false, 'pressed again, it takes the pad off');
  } finally { host.remove(); }
});

// Peek docks a panel along the bottom or the top of the page; along the
// bottom, the launcher stands on its top edge rather than over its corner.
test('the launcher stands on Peek\'s panel while it is docked at the bottom', async () => {
  const { d, host } = await mountFab();
  const root = doc.documentElement;
  const panel = doc.createElement('div');
  panel.setAttribute('data-peek-panel', '');
  panel.getBoundingClientRect = () => ({ top: 500, height: 300, width: 390, bottom: 800 });
  doc.body.append(panel);
  const wait2 = () => new Promise(r => window.setTimeout(r, 20));
  try {
    root.setAttribute('data-peek-open', 'bottom'); await wait2(); await tick(2);
    assert.equal(d.peekLift, 312, 'the panel\'s height and a gap');
    assert.match(host.querySelector('[data-fab-wrap]').getAttribute('style'), /translate\(0px,-288px\)/, 'a launcher at home rises to the panel\'s edge');
    d.y = -400; await tick(2);
    assert.match(host.querySelector('[data-fab-wrap]').getAttribute('style'), /translate\(0px,-400px\)/, 'one already above it stays put');
    d.y = 0;
    root.setAttribute('data-peek-open', 'top'); await wait2(); await tick(2);
    assert.equal(d.peekLift, 0, 'docked at the top, the launcher keeps its place');
    root.removeAttribute('data-peek-open'); await wait2(); await tick(2);
    assert.equal(d.peekLift, 0);
  } finally { host.remove(); panel.remove(); root.removeAttribute('data-peek-open'); }
});

// A key made by script has no default, so what it can do is what the page's
// own listeners do with it; an up or down nobody takes falls back to a scroll.
test('a press reaches the focused element as keydown and keyup, and repeats while held', async () => {
  const { d, host } = await mountFab();
  const list = doc.createElement('div');
  list.tabIndex = 0;
  doc.body.append(list);
  const seen = [];
  list.addEventListener('keydown', e => { seen.push('down:' + e.key); if (e.key === 'ArrowRight') e.preventDefault(); });
  list.addEventListener('keyup', e => seen.push('up:' + e.key));
  try {
    list.focus();
    assert.equal(d.padKey('ArrowRight'), true, 'a key the page takes is reported taken');
    assert.deepEqual(seen, ['down:ArrowRight', 'up:ArrowRight']);
    let scrolled = 0;
    const se = doc.scrollingElement || doc.documentElement;
    const was = se.scrollBy;
    se.scrollBy = (o) => { scrolled += o.top; };
    try {
      assert.equal(d.padKey('ArrowDown'), false, 'a key nobody takes is not');
      assert.equal(scrolled, 40, 'and an untaken down scrolls a line');
      d.padKey('ArrowLeft');
      assert.equal(scrolled, 40, 'a sideways key nobody takes does nothing');
    } finally { se.scrollBy = was; }
    seen.length = 0;
    d.padPress('ArrowRight');
    await wait(600);
    d.padRelease();
    const n = seen.filter(s => s === 'down:ArrowRight').length;
    assert.ok(n >= 3, 'held, it repeats: ' + n);
    await wait(150);
    assert.equal(seen.filter(s => s === 'down:ArrowRight').length, n, 'released, it stops');
    assert.equal(d.padHeld, '');
  } finally { host.remove(); list.remove(); }
});

test('a press aimed from inside the FAB goes to the page instead', async () => {
  const { d, host } = await mountFab();
  const seen = [];
  const onKey = e => seen.push(e.target === doc.body ? 'body' : 'other');
  doc.addEventListener('keydown', onKey);
  try {
    host.querySelector('[data-fab-wrap] [role=button]').focus();
    d.padKey('ArrowUp');
    assert.deepEqual(seen, ['body'], 'the launcher holding focus does not swallow the key');
  } finally { doc.removeEventListener('keydown', onKey); host.remove(); }
});

// A raised menu is what the reader came for, so the chevrons do not cover it.
test('the menu stands over the chevrons and clear of the top one', async () => {
  const { d, host } = await mountFab();
  try {
    const menu = () => [...host.querySelectorAll('[data-fab-wrap] > div')].find(e => e.querySelector('[data-fab-hide]'));
    d.fabMenu = true; await tick(2);
    assert.match(menu().className, /\bz-10\b/, 'drawn over the chevrons, which come after it');
    assert.match(menu().className, /\bmb-2\b/);
    d.raisePad(); d.fabMenu = true; await tick(2);
    assert.match(menu().className, /\bmb-12\b/, 'with the pad up it stands above the top chevron');
    d.lowerPad();
  } finally { host.remove(); }
});

// A walkthrough's dock keeps a slot for the launcher (kits/look.js); the
// launcher stands in it, opens the sidebar on a tap as anywhere, and a drag
// out of it ends the walkthrough and leaves the launcher where it was dropped.
test('the launcher stands in a walkthrough\'s slot, and a drag out of it ends the walkthrough', async () => {
  const { d, host } = await mountFab();
  const root = doc.documentElement;
  const slot = doc.createElement('div');
  slot.setAttribute('data-look-fab-slot', '');
  let at = { left: 120, top: 700 };
  slot.getBoundingClientRect = () => ({ left: at.left, top: at.top, width: 44, height: 40 });
  doc.body.append(slot);
  const was = window.Look;
  let stopped = 0;
  window.Look = { stop: () => { stopped++; slot.remove(); root.removeAttribute('data-look-open'); } };
  const wrap = host.querySelector('[data-fab-wrap]');
  wrap.getBoundingClientRect = () => d.docked ? { left: d.lookSlot.left, top: d.lookSlot.top } : { left: window.innerWidth - 80 + d.x, top: window.innerHeight - 80 + d.yShown };
  const frames = (n) => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : window.requestAnimationFrame(f)); window.requestAnimationFrame(f); });
  try {
    d.x = -50; d.y = -60;
    root.setAttribute('data-look-open', ''); await tick(2); await frames(3);
    assert.equal(d.docked, true, 'the launcher takes the slot');
    assert.match(wrap.getAttribute('style'), /left:122px;top:700px/, 'its glyph centred on the slot');
    assert.ok(root.style.getPropertyValue('--look-dock-edge'), 'and the dock wears the launcher\'s edge');
    assert.match(host.querySelector('[data-fab-wrap] > [role=button]').className, /!border-transparent/, 'while the launcher shows only its glyph');
    at = { left: 140, top: 650 }; await frames(3);
    assert.match(wrap.getAttribute('style'), /left:142px;top:650px/, 'and follows the dock');
    d.onDown(ev('pointerdown', 162, 670));
    assert.equal(d.docked, true, 'a press alone leaves the launcher in the slot');
    d.onUp(ev('pointerup', 162, 670)); await tick(2);
    assert.equal(d.open, true, 'a tap opens the sidebar, as anywhere');
    assert.equal(d.docked, true, 'and the launcher stays in the slot');
    d.close(); await tick(2);
    d.onDown(ev('pointerdown', 162, 670));
    await new Promise(r => window.setTimeout(r, d.LONG_PRESS + 50));
    assert.equal(d.fabMenu, true, 'a long press raises the menu');
    assert.equal(d.docked, true, 'with the launcher still in the dock, drawn over it');
    d.onUp(ev('pointercancel', 162, 670)); await tick(2);
    assert.equal(d.docked, true, 'and a cancelled release leaves it there');
    d.fabMenu = false; await tick(2);
    d.close(); await tick(2);
    d.onDown(ev('pointerdown', 162, 670));
    d.onMove(ev('pointermove', 294, 392));
    d.onUp(ev('pointerup', 294, 392)); await tick(2);
    assert.equal(stopped, 1, 'a drag out of the slot ends the walkthrough');
    assert.equal(d.docked, false);
    assert.deepEqual([d.x, d.y], [142 - 8 + 132 - (window.innerWidth - 80), 650 - 8 - 278 - (window.innerHeight - 80)], 'and the launcher stays where it was dropped, its glyph where the drag took it');
    assert.equal(root.style.getPropertyValue('--look-dock-edge'), '', 'the dock gives the edge back');
    // A walkthrough that ends on its own sends the launcher back.
    doc.body.append(slot); at = { left: 120, top: 700 };
    d.x = -50; d.y = -60;
    root.setAttribute('data-look-open', ''); await tick(2); await frames(3);
    assert.equal(d.docked, true);
    root.removeAttribute('data-look-open'); await tick(2); await frames(2);
    assert.equal(d.docked, false);
    assert.deepEqual([d.x, d.y], [-50, -60], 'back to where it stood before the walkthrough');
  } finally { window.Look = was; slot.remove(); root.removeAttribute('data-look-open'); host.remove(); }
});
