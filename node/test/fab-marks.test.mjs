// fab-marks.test.mjs — the FAB's `marks` contract: a page's annotations on the
// document in view, offered to the launcher and the drawer.
//
// The contract is opt-in and must stay invisible on every page that does not
// offer it: the strip is the five tabs, the launcher carries no count and no
// stepper. A page that does offer marks is read at paint time, like `about`,
// so the launcher follows the page, and a row runs the page's own move with
// the drawer out of its way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, startAlpine, tick, repoRoot } from './bootstrap.mjs';

const SRC = readFileSync(path.join(repoRoot, 'lib/alpineComponents/fab.js'), 'utf8');
const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
const doc = window.document;
const Alpine = await startAlpine(window, [
  'lib/kits/csv.js', 'lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js',
]);

async function mountFab() {
  const host = doc.createElement('div');
  host.innerHTML = '<div x-data="fab()" data-repo="mehrlander/web-tools" data-path="pages/text-lab.html"></div>';
  doc.body.appendChild(host);
  Alpine.initTree(host);
  await tick(3);
  return { d: Alpine.$data(host.firstElementChild), host };
}

// A page component offering marks, the way pages/text-lab.html does under ?marks=.
const ran = [];
Alpine.data('markedPage', () => ({
  style: 'tab', at: -1, on: true,
  get marks() {
    if (!this.on) return null;
    const items = [
      { key: 'caption', label: 'Caption', icon: 'ph-scroll', short: 'caption', go: () => { ran.push('caption'); this.at = 0; } },
      { key: 'focus0', label: 'Focus', icon: 'ph-bookmark-simple', short: 'focus 1/1', go: () => { ran.push('focus'); this.at = 1; } },
    ];
    return { title: 'A piece', style: this.style, items, at: items[this.at] || null, step: d => { ran.push('step ' + d); } };
  },
}));

test('a page that offers no marks sees the strip and the launcher unchanged', async () => {
  const { d, host } = await mountFab();
  try {
    d.findMarks();
    assert.equal(d.pageMarks, null);
    assert.equal([...d.TABS].map(t => t.key).join(','), 'about,render,inspect,traffic,text');
    assert.equal(d.marksLabel, '');
  } finally { host.remove(); }
});

test('a page’s marks add a Marks tab, are read at paint time, and step the page', async () => {
  const page = doc.createElement('div');
  page.setAttribute('x-data', 'markedPage');
  doc.body.append(page);
  Alpine.initTree(page);
  const { d, host } = await mountFab();
  try {
    d.findMarks();
    assert.equal(d.pageMarks.items.length, 2);
    assert.equal([...d.TABS].map(t => t.key).join(','), 'about,render,inspect,traffic,text,marks', 'a sixth tab while the page offers marks');
    assert.equal(d.marksLabel, '2 marks', 'before a step, the stepper says how many');
    const p = Alpine.$data(page);
    p.at = 1;
    assert.equal(d.marksLabel, 'focus 1/1', 'read at paint time, not copied at the scan');
    ran.length = 0;
    d.marksStep(1);
    assert.deepEqual(ran, ['step 1'], 'the stepper asks the page to move');
    d.open = true;
    d.marksRun(d.pageMarks.items[0]);
    assert.equal(d.open, false, 'the drawer steps out of the way of the mark');
    assert.deepEqual(ran.slice(1), ['caption']);
    d.setTab('marks');
    assert.equal(d.activeTab, 'marks');
    assert.equal(typeof d[d.TABS.find(t => t.key === 'marks').on], 'function', 'the tab names an opener that exists');
    p.on = false;
    assert.equal(d.pageMarks, null, 'a page that withdraws its marks takes the tab with them');
    assert.equal([...d.TABS].map(t => t.key).join(','), 'about,render,inspect,traffic,text');
  } finally { page.remove(); host.remove(); }
});

// In a toss the page lives in its own Alpine, which the FAB's effects cannot
// watch, so the FAB repaints on the page's word instead: a fab:marks event
// bumps the tick that pageMarks reads.
test('a fab:marks event finds the page and repaints what reads the marks', async () => {
  const page = doc.createElement('div');
  page.setAttribute('x-data', 'markedPage');
  const { d, host } = await mountFab();
  try {
    assert.equal(d.pageMarks, null, 'mounted before the page');
    doc.body.append(page);
    Alpine.initTree(page);
    const tick = d._marksTick;
    window.dispatchEvent(new window.CustomEvent('fab:marks'));
    assert.equal(d._marksTick, tick + 1);
    assert.equal(d.pageMarks.items.length, 2, 'found on the page\'s word');
  } finally { page.remove(); host.remove(); }
});

test('the launcher shows a count or a stepper, by the page’s style, and the pane exists', () => {
  assert.match(SRC, /x-show="pageMarks && pageMarks\.style !== 'stepper'"[^>]*data-fab-marks-count/);
  assert.match(SRC, /x-show="pageMarks && pageMarks\.style === 'stepper'"[^>]*data-fab-marks-stepper/);
  assert.match(SRC, /x-show="activeTab === 'marks'"[^>]*data-fab-marks/, 'the Marks tab has a pane');
  assert.match(SRC, /window\.addEventListener\('fab:marks', \(\) => \{ this\.findMarks\(\); this\._marksTick\+\+; \}\)/,
    'a page whose marks arrive later, or change, can say so, and the launcher repaints on its word');
  assert.match(SRC, /if \(window\.__tossFrame\) \{\s*try \{ const w = window\.__tossFrame\.contentWindow/,
    'in a toss the frame is searched as soon as the renderer has stamped it, not once the drawer has a subject');
});

// The tuck, a trial beside the contract (pages/text-lab.html ?marks=d): a
// page's mark pad stands in the launcher's column, so while it is up the
// launcher steps aside to a stub in the corner and tells the pad where to
// stand; a tap on the stub brings it back until the pad next comes up.
test('a page’s mark pad tucks the launcher into its corner, and a tap brings it back', async () => {
  const { d, host } = await mountFab();
  const root = doc.documentElement;
  const pad = shown => window.dispatchEvent(new window.CustomEvent('mark-pad', { detail: { shown } }));
  try {
    assert.equal(d.tuckNow, false, 'no pad, no tuck');
    pad(true); await tick(2);
    assert.equal(d.tuckNow, true);
    assert.match(root.style.getPropertyValue('--mark-pad-bottom'), /var\(--fab-bottom/, 'the pad is told to come down');
    const cover = host.querySelector('[aria-label="Bring back the web-tools panel button"]');
    assert.ok(cover, 'the stub takes a tap of its own');
    cover.click(); await tick(2);
    assert.equal(d.tuckNow, false, 'the tap brings the launcher back');
    assert.equal(root.style.getPropertyValue('--mark-pad-bottom'), '', 'and the pad goes back over it');
    pad(true); await tick(2);
    assert.equal(d.tuckNow, false, 'and it stays back while that pad is up');
    pad(false); pad(true); await tick(2);
    assert.equal(d.tuckNow, true, 'until the pad next comes up');
    d.open = true; await tick(2);
    assert.equal(d.tuckNow, false, 'an open drawer is never tucked');
    d.open = false;
    pad(false); await tick(2);
    assert.equal(d.tuckNow, false);
    assert.equal(root.style.getPropertyValue('--mark-pad-bottom'), '');
  } finally { host.remove(); }
});

test('a pad that came up before the launcher still tucks it', async () => {
  const pad = doc.createElement('div');
  pad.setAttribute('data-mark-pad', '');
  doc.body.append(pad);
  const { d, host } = await mountFab();
  try {
    await new Promise(r => window.setTimeout(r, 5)); await tick(2);
    assert.equal(d.tuckNow, true, 'the page booted first, and the pad is on screen');
  } finally {
    host.remove(); pad.remove();
    window.dispatchEvent(new window.CustomEvent('mark-pad', { detail: { shown: false } }));
  }
});
