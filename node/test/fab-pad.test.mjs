// fab-pad.test.mjs — the FAB's arrow pad: the launcher turned into four arrow
// keys, raised by the menu's Pad or a drag into the bottom-left corner, whose
// presses reach the page in view as keydown and keyup, and whose centre turns
// it back into the launcher.

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

test('a drag into the bottom-left corner turns the launcher into the pad there, and its centre turns it back', async () => {
  const { d, host } = await mountFab();
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
    assert.equal(d.padSide, 'left', 'in the corner it was dragged to');
    assert.equal(d.tuckNow, false, 'which is not a tuck');
    assert.equal(d.open, false, 'and the drawer does not open behind it');
    assert.deepEqual([d.x, d.y], [-100, -200], 'the launcher keeps the place the drag began');
    assert.match(host.querySelector('[data-fab-wrap]').className, /\bhidden\b/, 'the launcher is gone while the pad is up');
    const pad = host.querySelector('[data-fab-pad]');
    assert.deepEqual([...pad.querySelectorAll('[data-pad-key]')].map(b => b.dataset.padKey).sort(),
      ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'], 'four arrows');
    assert.match(pad.className, /left-6/);
    pad.querySelector('[data-fab-pad-home]').dispatchEvent(new window.Event('pointerup', { bubbles: true })); await tick(2);
    assert.equal(d.padOn, false, 'the centre turns it back');
    assert.doesNotMatch(host.querySelector('[data-fab-wrap]').className, /\bhidden\b/);
  } finally { host.remove(); }
});

test('the menu\'s Pad raises the pad in the corner on the launcher\'s side', async () => {
  const { d, host } = await mountFab();
  try {
    d.fabMenu = true; await tick(2);
    host.querySelector('[data-fab-pad-row]').click(); await tick(2);
    assert.equal(d.fabMenu, false, 'the row closes the menu');
    assert.equal(d.padOn, true);
    assert.equal(d.padSide, 'right', 'the launcher at rest is on the right');
    d.lowerPad();
    d.x = -(window.innerWidth - 200);
    d.raisePad();
    assert.equal(d.padSide, 'left', 'a launcher dragged left raises it on the left');
    d.lowerPad();
  } finally { host.remove(); }
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
