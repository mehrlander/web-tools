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
      <td id="b" data-title-tip-bare data-title-tip="First line.&#10;&#10;Second line.">5,000</td>
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

test('an empty title-tip advertises nothing: no underline, no tab stop', () => {
  // A bound title-tip whose expression resolves to '' still carries the attribute.
  // Drawing the affordance over it promises a title-tip that does not exist, and a
  // tab stop on it is a stop that announces nothing. 54 of these were live on
  // the Map's Docs tab when this was measured.
  assert.match(TitleTip.CSS, /\[data-title-tip\]:not\(\[data-title-tip=""\]\)\{[^}]*text-decoration:underline dotted/s);
  const el = window.document.createElement('span');
  el.setAttribute('data-title-tip', '');
  window.document.body.append(el);
  TitleTip.refresh();
  assert.equal(el.hasAttribute('tabindex'), false, 'no tab stop for a title-tip with nothing to say');
  el.remove();
});

test('an element with nothing to underline opts out of the affordance', () => {
  // A table cell is the case: a spreadsheet render draws no underline anywhere
  // and the dotted rule would land on most of its numeric cells.
  assert.match(TitleTip.CSS, /\[data-title-tip\]:not\(\[data-title-tip=""\]\)\{[^}]*text-decoration:underline dotted/s);
  assert.match(TitleTip.CSS, /\[data-title-tip\]\[data-title-tip-bare\]\{text-decoration:none\}/);
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
