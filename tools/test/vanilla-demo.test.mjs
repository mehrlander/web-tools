// kits/vanilla-demo.js — the living-documentation demo format.
//
// The module had no test until 2026-09-14, and the defect that prompted one is
// the reason it is worth having: a `stage` snippet's whole job is to WIRE
// something, and its console capture was lifted the moment run() returned, so
// the first thing built on the kind logged from a drop handler and the box
// under it stayed empty. Nothing in the suite could have said so.
//
// What is pinned here is the part of the format that is logic rather than
// paint: which host kind owns the console and for how long, what a stage
// snippet is handed, and the two-track layout that keeps an example's prose off
// a cap of its own (house style rule 3, the class of defect this same session
// had to clear by hand across eleven files).
//
// CM6 and proof are stubbed. The editor is genuinely absent in this
// environment, and the format is built for that: getCode() falls back to
// cfg.code and Run stays wired, which is also how the demo pages survive a CDN
// that will not serve CodeMirror.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit, makeWindow } from './bootstrap.mjs';

const { window } = makeWindow();
// jsdom ships no Web Animations API and example() animates its entrance.
window.Element.prototype.animate ??= function () { return { finished: Promise.resolve() }; };
global.Element = window.Element;

// The editor the sandbox cannot load, in the shape block() consumes: a promise
// of a handle with getValue/setValue.
window.cm6 = {
  create: async (host, opts) => {
    let value = opts.value;
    return {
      getValue: () => value, setValue: (v) => { value = v; },
      // The display control applies these to every live editor on mount.
      setFontSize: () => {}, setLineNumbers: () => {}, setWrap: () => {},
    };
  },
  loadStatus: () => null,
  preload: async () => {},
};
window.proof = { doc: () => '<!doctype html><html></html>' };
global.cm6 = window.cm6;
global.proof = window.proof;

loadKit('vanilla-demo', { window });
const demo = window.demo;

const tick = (ms = 12) => new Promise(r => setTimeout(r, ms));

// The rendered example, plus the handles a test needs to drive it.
function render(cfg) {
  const sec = demo.example({ lang: 'js', title: 't', ...cfg }, 0, 0);
  window.document.body.append(sec);
  const runBtn = [...sec.querySelectorAll('button')].find(b => b.textContent.includes('Run'));
  // The console box: the one font-mono panel in the proof zone.
  const box = () => [...sec.querySelectorAll('div')]
    .find(d => /font-mono/.test(d.className) && /min-h-/.test(d.className));
  return { sec, runBtn, log: () => (box()?.textContent || '').trim() };
}

test('the format offers a stage kind, and the legend can name it', () => {
  assert.ok(demo.PROOF_META.stage, 'stage is one of the kinds');
  assert.ok(demo.PROOF_META.stage.label && demo.PROOF_META.stage.icon);
});

test('a stage snippet is handed an element to draw into', async () => {
  const { sec, runBtn } = render({
    kind: 'stage',
    code: `stage.textContent = 'drawn';`,
  });
  assert.ok(runBtn, 'a host kind runs only on Run, so the button has to be there');
  runBtn.click();
  await tick();
  assert.match(sec.textContent, /drawn/);
});

test('a second Run is a second demonstration, not a second copy', async () => {
  const { sec, runBtn } = render({
    kind: 'stage',
    code: `stage.append(document.createElement('hr'));`,
  });
  runBtn.click();
  await tick();
  runBtn.click();
  await tick();
  assert.equal(sec.querySelectorAll('hr').length, 1, 'the stage is cleared before each run');
});

// THE DEFECT THIS FILE EXISTS FOR. Both halves matter: the stage has to keep
// the console, and `parent` has to give it back, or one demo's output lands in
// another's box.
test('a stage keeps the console after its run returns, since what it wired runs later', async () => {
  const { runBtn, log } = render({
    kind: 'stage',
    code: `setTimeout(() => console.log('from the handler'), 0);`,
  });
  runBtn.click();
  await tick(40);
  assert.match(log(), /from the handler/);
});

test('a parent snippet gives the console back when its run ends', async () => {
  const { runBtn, log } = render({
    kind: 'parent',
    code: `setTimeout(() => console.log('after the fact'), 0);`,
  });
  runBtn.click();
  await tick(40);
  assert.doesNotMatch(log(), /after the fact/,
    'a parent captures its run and nothing after it');
});

test('what a snippet logs while it runs reaches its own box either way', async () => {
  for (const kind of ['parent', 'stage']) {
    const { runBtn, log } = render({ kind, code: `console.log('during ${kind}');` });
    runBtn.click();
    await tick();
    assert.match(log(), new RegExp(`during ${kind}`), kind);
  }
});

test('a thrown snippet reports the error rather than failing silently', async () => {
  const { runBtn, log } = render({ kind: 'parent', code: `throw new Error('bang');` });
  runBtn.click();
  await tick();
  assert.match(log(), /bang/);
});

// Rule 3, as a layout rather than a cap. Held here because the alternative is
// a cap on the text element, which is exactly what this repo spent a session
// removing from eleven files.
test('an example lays its prose and its block on two tracks, neither capped', () => {
  const { sec } = render({ kind: 'parent', code: '1;', prose: 'commentary' });
  assert.match(sec.className, /lg:grid/, 'two tracks at lg and up');
  assert.match(sec.className, /lg:grid-cols-\[minmax\(0,/, 'and both tracks may shrink to nothing');
  const [rail, block] = sec.children;
  assert.match(rail.className, /min-w-0/);
  assert.match(block.className, /min-w-0/,
    'without this an editor line widens the track and scrolls the page sideways');
  assert.doesNotMatch(sec.innerHTML, /max-w-\[\d+ch\]/,
    'the measure comes from the track, not from a cap on the text');
});

test('the prose rail carries the kicker, the title and the commentary', () => {
  const { sec } = render({ kind: 'parent', code: '1;', title: 'A title', prose: 'commentary' });
  const rail = sec.children[0];
  assert.match(rail.textContent, /1\.1/);
  assert.match(rail.textContent, /A title/);
  assert.match(rail.textContent, /commentary/);
});
