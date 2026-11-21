// kits/title-tip.js — the title-tip of the house popup rule (html-style mechanics.md,
// "Title-tips and panel-tips"), held at the edges that decide whether a fact reaches
// the reader at all.
//
// What is checked here is the pair of properties that make it a title-tip rather
// than a restyled `title`: the text is in the DOM (so a screenshot captures
// it), and the panel holds nothing tappable and never scrolls (so it stays a
// title-tip and does not quietly become a panel-tip). Plus the two touch consequences
// the rule draws from that: the title-tip closes on its own tap, and it fits.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({
  html: `<!doctype html><html><body>
    <span id="a" data-title-tip="Fetched from the repo when opened.">EXTERNAL</span>
    <table><tbody><tr>
      <td id="b" data-title-tip="First line.&#10;&#10;Second line.">5,000</td>
      <td id="c" data-title-tip-look="excel" data-title-tip-lead="slm4303:"
          data-title-tip="input the hours anticipated">5,000</td>
    </tr></tbody></table>
  </body></html>`,
});
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/title-tip.js'), 'utf8'))();
const TitleTip = window.TitleTip;
const $ = (sel) => window.document.querySelector(sel);

test('the kit registers window.TitleTip and reads a title-tip off an element', () => {
  assert.equal(typeof TitleTip, 'object');
  assert.equal(TitleTip.text($('#a')), 'Fetched from the repo when opened.');
  assert.equal(TitleTip.text(window.document.body), null, 'an element with no title-tip has none');
});

test('open() puts the text in the DOM, which is the whole reason this is not a title', () => {
  // A `title` cannot be captured in a screenshot, so a fact parked in one is
  // invisible to every review that happens through pixels. TitleTip.open exists so
  // a shot can be taken of the title-tip itself.
  TitleTip.open('#a');
  const panel = window.document.getElementById('wt-title-tip');
  assert.equal(panel.textContent, 'Fetched from the repo when opened.');
  assert.ok(panel.hasAttribute('data-open'));
  TitleTip.close();
  assert.equal(panel.hasAttribute('data-open'), false);
});

test('a blank line in a title-tip survives to the reader', () => {
  // A caller that joined two parts with a blank line (who left a comment, then
  // what the cell stores) meant the break. white-space:normal collapsed it and
  // ran the two parts together as one sentence.
  assert.match(TitleTip.CSS, /white-space:pre-line/);
  assert.doesNotMatch(TitleTip.CSS, /white-space:normal/);
  TitleTip.open('#b');
  assert.equal(window.document.getElementById('wt-title-tip').textContent,
    'First line.\n\nSecond line.');
  TitleTip.close();
});

test('the panel holds nothing tappable and never scrolls, which is the line between a title-tip and a panel-tip', () => {
  // The moment its content needs a tap, a link or a copy button, or a
  // scrollbar, it is a panel-tip and the panel-tip half of the rule applies instead.
  assert.match(TitleTip.CSS, /#wt-title-tip\{[^}]*pointer-events:none/s);
  assert.match(TitleTip.CSS, /#wt-title-tip\{[^}]*overflow:hidden/s);
  assert.match(TitleTip.CSS, new RegExp(`max-height:calc\\(${TitleTip.LINES} \\* 1\\.45em`));
});

test('on a screen with no hover the open title-tip takes its own tap and closes on it', () => {
  // The route out never depends on finding a tap-safe spot around the title-tip:
  // the panel is the neutral ground. Under hover:none only, so where the
  // pointer can hover the box never sits between the pointer and the control.
  assert.match(TitleTip.CSS, /@media \(hover:none\)\{#wt-title-tip\[data-open\]\{pointer-events:auto\}\}/);
  TitleTip.open('#a');
  const panel = window.document.getElementById('wt-title-tip');
  let reached = false;
  window.document.body.addEventListener('pointerdown', () => { reached = true; });
  const ev = new window.Event('pointerdown', { bubbles: true, cancelable: true });
  panel.dispatchEvent(ev);
  assert.equal(panel.hasAttribute('data-open'), false, 'the tap on the title-tip closed it');
  assert.equal(ev.defaultPrevented, true, 'and was swallowed');
  assert.equal(reached, false, 'nothing under the title-tip saw it');
});

test('a title-tip that fits says so; the overflow report is a browser measurement', () => {
  // jsdom lays nothing out, so every title-tip fits here; what is held is the
  // contract, that fits() reads the open panel and answers for the element
  // asked about.
  TitleTip.open('#a');
  assert.equal(TitleTip.fits($('#a')), true);
  assert.equal(TitleTip.fits($('#b')), true, 'a title-tip that is not open cannot be overflowing');
  TitleTip.close();
});

// A TRUNCATED LINE IS WIDER THAN ITS TIP. Centred on its trigger, the tip of a
// branch row's one-liner opened at the middle of the row, most of a row away
// from where the pointer entered it. jsdom lays nothing out, so the trigger and
// the panel are given boxes, and the pointer a position, by hand.
test('a trigger wider than its tip centres the tip on the pointer, and a narrow one on itself', () => {
  const panel = window.document.getElementById('wt-title-tip');
  const el = window.document.createElement('p');
  el.setAttribute('data-title-tip', 'The title of a pull request, cut short in its row');
  window.document.body.append(el);
  const box = (left, width, top = 300, height = 20) =>
    ({ left, width, right: left + width, top, height, bottom: top + height, x: left, y: top });
  const move = (x, y) => window.document.dispatchEvent(
    new window.MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
  const leftAt = () => {
    TitleTip.open(el);
    const l = parseInt(panel.style.left, 10);
    TitleTip.close();
    return l;
  };
  panel.getBoundingClientRect = () => box(0, 200, 0, 40);   // the tip: 200 wide
  try {
    el.getBoundingClientRect = () => box(20, 900);           // a row-wide line, centred at 470
    move(800, 310);
    assert.equal(leftAt(), 700, 'on the pointer: 800 less half the tip');
    move(150, 310);
    assert.equal(leftAt(), 50, 'near the left end too');
    move(800, 50);
    assert.equal(leftAt(), 370, 'a pointer off the trigger (a keyboard focus, a screenshot) centres on the trigger');
    el.getBoundingClientRect = () => box(600, 120);          // a chip, narrower than the tip
    move(610, 310);
    assert.equal(leftAt(), 560, 'a narrow trigger centres on itself, which is under the pointer anyway');
  } finally {
    delete panel.getBoundingClientRect;
    el.remove();
  }
});

test('an empty title-tip advertises nothing: no tab stop', () => {
  // A bound title-tip whose expression resolves to '' still carries the attribute.
  // A tab stop on it is a stop that announces nothing. 54 of these were live on
  // the Map's Docs tab when this was measured.
  const el = window.document.createElement('span');
  el.setAttribute('data-title-tip', '');
  window.document.body.append(el);
  TitleTip.refresh();
  assert.equal(el.hasAttribute('tabindex'), false, 'no tab stop for a title-tip with nothing to say');
  el.remove();
});

test('nothing marks a title-tip at rest', () => {
  // No dotted underline: the owner does not want one.
  assert.doesNotMatch(TitleTip.CSS, /text-decoration:underline/);
});

test('a lead line is its own bold row above the title-tip, and never markup', () => {
  // What the title-tip is ABOUT, where data-title-tip is what it says: a comment's
  // author, a form field's name. Excel formats both this way, which is why the
  // sheet render stopped joining them into "Fee Code: Enter …" itself.
  TitleTip.open('#c');
  const panel = window.document.getElementById('wt-title-tip');
  const lead = panel.querySelector('.wt-title-tip-lead');
  assert.equal(lead.textContent, 'slm4303:');
  assert.equal(lead.tagName, 'B');
  assert.equal(panel.textContent, 'slm4303:input the hours anticipated',
    'both parts are present; the row break is CSS, not a character');
  assert.match(TitleTip.CSS, /\.wt-title-tip-lead\{display:block;font-weight:600\}/);
  TitleTip.close();
});

test('pills take the place of the text, each one text, and the plain reading stays', () => {
  // A count and a median for every square of a lane: the same two pills each time
  // read faster than a sentence that changes shape. data-title-tip stays the plain
  // reading, so TitleTip.text and a kit without the attribute still say it.
  const el = $('#c');
  el.setAttribute('data-title-tip-pills', '68 people | $72K median|<b>x</b>|');
  TitleTip.open(el);
  const panel = window.document.getElementById('wt-title-tip');
  const pills = [...panel.querySelectorAll('.wt-title-tip-pills > span')].map(s => s.textContent);
  assert.deepEqual(pills, ['68 people', '$72K median', '<b>x</b>'], 'one pill per part, blanks dropped');
  assert.equal(panel.querySelectorAll('.wt-title-tip-pills b').length, 0, 'a pill was parsed as markup');
  assert.equal(panel.querySelector('.wt-title-tip-lead').textContent, 'slm4303:', 'the lead line stays above');
  assert.equal(TitleTip.text(el), 'input the hours anticipated');
  el.removeAttribute('data-title-tip-pills');
  TitleTip.close();
});

test('a lead line written as text stays text', () => {
  const el = $('#c');
  el.setAttribute('data-title-tip-lead', '<img src=x onerror=alert(1)>');
  TitleTip.open(el);
  const panel = window.document.getElementById('wt-title-tip');
  assert.equal(panel.querySelectorAll('img').length, 0, 'the lead line was parsed as markup');
  assert.equal(panel.querySelector('.wt-title-tip-lead').textContent, '<img src=x onerror=alert(1)>');
  el.setAttribute('data-title-tip-lead', 'slm4303:');
  TitleTip.close();
});

test('a look token is stamped on the panel and cleared by the next title-tip', () => {
  // One panel serves every title-tip on the page, so a look that stuck would leak
  // onto whatever the reader hovered next.
  const panel = window.document.getElementById('wt-title-tip') || (TitleTip.open('#a'), window.document.getElementById('wt-title-tip'));
  TitleTip.open('#c');
  assert.equal(panel.getAttribute('data-look'), 'excel');
  TitleTip.open('#a');
  assert.equal(panel.hasAttribute('data-look'), false, 'the token outlived the title-tip that asked for it');
  TitleTip.close();
});

test('the kit ships exactly one look beyond the default, plain, and no imitation of anything', () => {
  // `plain` is the browser's own tooltip redrawn, a house need rather than a
  // page's. A page reproducing something else (Excel's box, in the sheet
  // render) owns that look, next to the code asking; the kit owns the hook.
  const looks = [...TitleTip.CSS.matchAll(/data-look="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(looks, ['plain']);
});

test('a look set on an ancestor is the default for the title-tips under it', () => {
  // `<body data-title-tip-look="plain">` makes every title-tip on a table page plain in
  // one word; a title-tip that names its own look still wins, since closest()
  // finds the element itself first.
  const panel = window.document.getElementById('wt-title-tip');
  window.document.body.setAttribute('data-title-tip-look', 'plain');
  TitleTip.open('#a');
  assert.equal(panel.getAttribute('data-look'), 'plain');
  TitleTip.open('#c');
  assert.equal(panel.getAttribute('data-look'), 'excel', 'the title-tip\'s own token outranks the page default');
  window.document.body.removeAttribute('data-title-tip-look');
  TitleTip.open('#a');
  assert.equal(panel.hasAttribute('data-look'), false);
  TitleTip.close();
});

// ── The geometry guards, which are the title-tip's half of "a leave is not a
// promise". A title-tip is anchored beside its trigger, so anything that moves the
// trigger leaves it pointing at the wrong thing. Scroll and resize were here
// from the start; blur is the door that was open, and it is the one no gesture
// reports, since the reader is looking at another window when it happens.
test('a title-tip closes on a scroll, a resize and a window blur', () => {
  const open = () => {
    TitleTip.open('#a');
    assert.ok(window.document.getElementById('wt-title-tip').hasAttribute('data-open'));
  };
  const gone = (what) => assert.equal(
    window.document.getElementById('wt-title-tip').hasAttribute('data-open'), false, what);

  open();
  window.document.dispatchEvent(new window.Event('scroll', { bubbles: true }));
  gone('a scroll slides the trigger out from under it');

  open();
  window.dispatchEvent(new window.Event('resize'));
  gone('a resize moves the trigger');

  open();
  window.dispatchEvent(new window.Event('blur'));
  gone('a blur ends the hover with no pointerout behind it');
});

// ON A CONTROL, A HOVER LABEL. The swap of every `title` in the app for a
// title-tip put one on some 230 icon buttons, and on touch a tap both fired the
// button and opened the label (measured 2026-10-15). So on a control the tap
// belongs to the control, as it did when the label was a title.
const tap = (el, pointerType) => {
  const ev = new window.Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'pointerType', { value: pointerType });
  el.dispatchEvent(ev);
  return ev;
};
const isShown = () => window.document.getElementById('wt-title-tip').hasAttribute('data-open');

test('a touch tap on a button belongs to the button, not its title-tip', () => {
  const b = window.document.createElement('button');
  b.setAttribute('data-title-tip', 'Close');
  b.innerHTML = '<i class="ph ph-x"></i>';
  window.document.body.append(b);
  tap(b.firstChild, 'touch');
  assert.equal(isShown(), false, 'no title-tip on a touch tap');
  tap(b, 'mouse');
  assert.equal(isShown(), true, 'a mouse press still toggles it, as hover would show it');
  TitleTip.close(); b.remove();
});

test('a title-tip inside a link stays quiet on touch too', () => {
  const a = window.document.createElement('a');
  a.href = '#x';
  a.innerHTML = '<span data-title-tip="the full path">path</span>';
  window.document.body.append(a);
  tap(a.firstChild, 'touch');
  assert.equal(isShown(), false);
  a.remove();
});

test('a disabled control ignores the tap, so its title-tip takes it', () => {
  const l = window.document.createElement('label');
  l.setAttribute('data-title-tip', 'Needs the pause record');
  l.innerHTML = '<input type="checkbox" disabled><span>Breaks</span>';
  window.document.body.append(l);
  tap(l.lastChild, 'touch');
  assert.equal(isShown(), true, 'the reason a control is off reaches a phone');
  TitleTip.close(); l.remove();
});

test('a control keeps its look, and stays the only tab stop for what it holds', () => {
  assert.match(TitleTip.CSS, /:is\([^)]*button[^)]*\)\[data-title-tip\],:is\([^)]*button[^)]*\) \[data-title-tip\]\{text-decoration:none\}/);
  const b = window.document.createElement('button');
  b.innerHTML = '<span data-title-tip="inner label">x</span>';
  window.document.body.append(b);
  TitleTip.refresh();
  assert.equal(b.firstChild.hasAttribute('tabindex'), false, 'the button is the tab stop');
  b.remove();
});

test('a second copy of the kit defers to the first', () => {
  const first = window.TitleTip;
  new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/title-tip.js'), 'utf8'))();
  assert.equal(window.TitleTip, first);
});

// INTO A FRAME. The notes card and peek draw into a framed page's own
// document, where this copy's listeners never hear a hover. into() runs the
// kit again in that window, and a second call leaves the first copy alone.
test('into() installs a copy of the kit in a frame, once', () => {
  const f = window.document.createElement('iframe');
  window.document.body.append(f);
  const w = f.contentWindow;
  assert.equal(typeof TitleTip.into, 'function');
  TitleTip.into(w);
  assert.ok(w.TitleTip, 'the frame has its own copy');
  assert.notEqual(w.TitleTip, TitleTip, 'and it is the frame\'s, not this one');
  const first = w.TitleTip;
  TitleTip.into(w);
  assert.equal(w.TitleTip, first, 'a second call keeps the first copy');
  f.remove();
});

// A SPOKEN NAME. A `title` on an icon-only button was also its accessible name,
// and aria-describedby reaches the title-tip only while it is open. So the kit
// names an element that has no name of its own from its tip, and leaves alone
// one that has.
const settle = () => new Promise((r) => setTimeout(r, 0));

test('an icon-only control is named from its title-tip, and the name follows a bound tip', async () => {
  const b = window.document.createElement('button');
  b.setAttribute('data-title-tip', 'Close');
  b.innerHTML = '<i class="ph ph-x"></i>';
  window.document.body.append(b);
  TitleTip.refresh();
  assert.equal(b.getAttribute('aria-label'), 'Close');
  b.setAttribute('data-title-tip', 'Close the panel');
  await settle();
  assert.equal(b.getAttribute('aria-label'), 'Close the panel', 'a changed tip renames the control');
  b.setAttribute('data-title-tip', '');
  await settle();
  assert.equal(b.hasAttribute('aria-label'), false, 'an emptied tip withdraws the name it gave');
  b.remove();
});

test('an element with a name of its own keeps it', async () => {
  const withText = window.document.createElement('button');
  withText.setAttribute('data-title-tip', 'Saves to the branch');
  withText.textContent = 'Save';
  const withLabel = window.document.createElement('button');
  withLabel.setAttribute('data-title-tip', 'Copy the link');
  withLabel.setAttribute('aria-label', 'Copy');
  withLabel.innerHTML = '<i class="ph ph-copy"></i>';
  const withLabelledby = window.document.createElement('button');
  withLabelledby.setAttribute('data-title-tip', 'Open');
  withLabelledby.setAttribute('aria-labelledby', 'a');
  window.document.body.append(withText, withLabel, withLabelledby);
  TitleTip.refresh();
  assert.equal(withText.hasAttribute('aria-label'), false, 'text content is the name');
  assert.equal(withLabel.getAttribute('aria-label'), 'Copy', 'an author\'s aria-label is never replaced');
  withLabel.setAttribute('data-title-tip', 'Copy the address');
  await settle();
  assert.equal(withLabel.getAttribute('aria-label'), 'Copy', 'nor rewritten when the tip changes');
  assert.equal(withLabelledby.hasAttribute('aria-label'), false);
  withText.remove(); withLabel.remove(); withLabelledby.remove();
});

test('text filled in after the first pass replaces the name the kit gave', async () => {
  // An x-text span is empty when the kit first looks at it; once Alpine writes
  // its text, the text is the name and the tip goes back to describing it.
  const s = window.document.createElement('span');
  s.setAttribute('data-title-tip', '2026-11-16T18:35:02Z');
  window.document.body.append(s);
  TitleTip.refresh();
  assert.equal(s.getAttribute('aria-label'), '2026-11-16T18:35:02Z');
  s.textContent = '2026-11-16';
  await settle();
  assert.equal(s.hasAttribute('aria-label'), false);
  s.remove();
});
