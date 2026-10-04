#!/usr/bin/env node
// pages/dictate.html — the four claims that only the assembled page can answer.
//
//   node tools/test/dictate-page.mjs
//
// kits/dictate.js has its own suite under node --test, and it covers the
// composition rules with a stub. What it cannot cover is the PAGE: whether the
// draft really survives a reload, whether the correction list reaches the
// buffer, whether a filed note really stops coming back, and whether the
// controls are where a thumb can reach them. The last one is not a style
// question. The first headless shot of this page showed Save sitting under the
// FAB launcher, which is fixed at the bottom right of every page that boots the
// lib chain: a primary action covered by standing equipment, invisible in the
// source and invisible to jsdom, which has no layout. Save is four buttons now
// (Copy, Share, Jot, Drop, flattened out of the sheet on 2026-08-27), so the
// geometry checks read the row rather than the button.
//
// Exits nonzero on any failure. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PHONE = { width: 390, height: 844 };

const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
};

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try {
    const body = await readFile(path.join(root, rel));
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
// A token, so Jot and Drop are live. BEFORE newPage: an init script added to a
// context does not reach a page that already exists, which is why Drop sat
// disabled the first time this ran.
await ctx.addInitScript(() => { try { localStorage.setItem('ghToken', 'test-token'); } catch {} });
// THE PAINTED SELECTION, for the checks written against it. The platform's
// selection is the page's default since 2026-10-01; everything here before
// "native by default" below was written when the painted one was, and its
// toggles turn native on from painted. Only where nothing has chosen yet.
await ctx.addInitScript(() => { try { if (localStorage.getItem('dictate:selection') == null) localStorage.setItem('dictate:selection', 'painted'); } catch {} });
const page = await ctx.newPage();

// A correction list with two entries. Everything the page writes is caught
// rather than sent.
const writes = [];
const routeAll = (route) => {
  const url = route.request().url();
  // Only the page's OWN reads and writes are caught here. Everything else on
  // api.github.com is the lib chain fetching its own files, which resolveCdn
  // answers from the checkout; catching those too was the first thing this
  // harness got wrong and it 404'd the whole boot.
  if (url.includes('api.github.com') && url.includes('/contents/')) {
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}');
      writes.push({ url, message: body.message,
                    text: Buffer.from(body.content || '', 'base64').toString('utf8') });
      return route.fulfill({ status: 201, contentType: 'application/json',
                             body: JSON.stringify({ content: { sha: 'written' } }) });
    }
    if (url.includes('autocorrect.json')) {
      const list = { items: [{ from: 'js deliver', to: 'jsDelivr' },
                             { from: 'web tools', to: 'web-tools' }] };
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: Buffer.from(JSON.stringify(list)).toString('base64'),
                               encoding: 'base64', sha: 'fixes', size: 1 }) });
    }
    if (/web-tools-private|mehrlander\/home/.test(url)) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    }
  }
  if (url.startsWith(origin)) return route.continue();
  const r = resolveCdn(url, root, null);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
};
await page.route('**/*', routeAll);
page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));

// The stub goes in AFTER load, since the kit resolves its constructor lazily
// at start() and this Chromium carries a real webkitSpeechRecognition that
// would answer instead.
const stub = () => page.evaluate(() => {
  class FakeSR {
    constructor() { window.__sr = this; window.__engines = (window.__engines || 0) + 1; }
    start() {}
    stop() { this.onend && this.onend(); }
    say(text, final) {
      this.onresult({ resultIndex: 0,
        results: [Object.assign([{ transcript: text }], { isFinal: !!final })] });
    }
  }
  window.SpeechRecognition = FakeSR;
  window.webkitSpeechRecognition = FakeSR;
  window.__engines = 0;
});

const open = async (query = '') => {
  await page.goto(`${origin}/pages/dictate.html${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await stub();
};
const begin = async () => {
  const tap = page.locator('button:has-text("start talking"), button:has-text("Tap to carry on")');
  if (await tap.count()) await tap.first().click();
  await page.waitForTimeout(200);
};
const say = async (t, final = true) => {
  await page.evaluate(([x, f]) => window.__sr.say(x, f), [t, final]);
  await page.waitForTimeout(120);
};
const buffer = () => page.evaluate(() => document.querySelector('[x-ref="body"]').textContent);

try {
  // ── 1. The FAB rides above the key rows ──────────────────────────────
  // The FAB launcher is fixed at the bottom right of every page that boots
  // the lib chain. This page declined it (data-no-fab) while the corner held
  // the cursor pad; the pad moved to the header, and the FAB is wanted here
  // for its ref bar. The page lifts it with --fab-bottom, so the assertion is
  // that it is present and covers no button, since a launcher at its default
  // corner lands on the backspace key and Send and the source would not say so.
  console.log('geometry at 390x844:');
  await open();
  const boxes = await page.evaluate(() => {
    const byTitle = (t) => document.querySelector(`button[title^="${t}"]`);
    const r = (el) => el ? el.getBoundingClientRect().toJSON() : null;
    return {
      copy: r([...document.querySelectorAll('button')].find(b => /Copy/.test(b.textContent))),
      drop: r([...document.querySelectorAll('button')].find(b => /Drop/.test(b.textContent))),
      pad: r(document.querySelector('[data-dictate-ui] button:has(i.ph-crosshair)')),
      mic: r(document.querySelector('button[title*="listening"], button[title*="Recording"]')),
      back: r(document.querySelector('button:has(i.ph-backspace)')),
      fab: r(document.querySelector('.fixed[class*="bottom-[var(--fab-bottom"]')),
      // Controls only: the empty page's tap-anywhere target is the text
      // surface itself, which the launcher floats over as it does the words.
      buttons: [...document.querySelectorAll('[data-dictate-ui] button')].filter(b => b.offsetParent)
        .map(b => b.getBoundingClientRect().toJSON()).filter(b => b.height < 200),
      h: innerHeight, docH: document.body.scrollHeight, w: innerWidth,
    };
  });
  const hit = boxes.fab && boxes.buttons.filter(b => b.width && b.height &&
    b.left < boxes.fab.right && b.right > boxes.fab.left && b.top < boxes.fab.bottom && b.bottom > boxes.fab.top);
  ok('the FAB is mounted', !!boxes.fab, 'no launcher found');
  ok('and it covers no button', !!boxes.fab && boxes.buttons.length > 8 && hit.length === 0,
    `${boxes.buttons.length} buttons, covered: ${JSON.stringify(hit)}`);
  // The instruments live in the HEADER now: record, undo, redo and the target
  // are each tapped a handful of times a session, and the bottom of a phone
  // belongs to whatever is tapped every sentence.
  ok('the target sits in the header', !!boxes.pad && boxes.pad.top < 60, JSON.stringify(boxes.pad));
  ok('the mic sits in the header', !!boxes.mic && boxes.mic.top < 60, JSON.stringify(boxes.mic));
  ok('and none of them overlaps its neighbour',
    !!boxes.mic && !!boxes.pad && boxes.mic.right <= boxes.pad.left,
    `mic.right=${boxes.mic?.right} target.left=${boxes.pad?.left}`);
  ok('the target is on the viewport centre line',
    !!boxes.pad && Math.abs((boxes.pad.left + boxes.pad.right) / 2 - boxes.w / 2) < 4,
    `centre=${boxes.pad && (boxes.pad.left + boxes.pad.right) / 2} of ${boxes.w}`);
  // Backspace is the exception to the paragraph above and went back down on
  // 2026-08-25: undo and redo are reached for a handful of times, but a
  // misheard word is deleted mid-sentence, over and over. It is a KEY now
  // rather than a lodger in the send row, so it is checked against the keys.
  ok('backspace is in the key row, above the destinations',
    !!boxes.back && !!boxes.copy && boxes.back.bottom <= boxes.copy.top + 1,
    `back.bottom=${boxes.back?.bottom} copy.top=${boxes.copy?.top}`);
  ok('and it is the last key, at the right edge',
    !!boxes.back && boxes.back.right > boxes.w - 12, JSON.stringify(boxes.back));
  ok('the destinations are on the bottom row',
    !!boxes.copy && !!boxes.drop && boxes.copy.bottom > boxes.h - 24
    && boxes.drop.bottom > boxes.h - 24, JSON.stringify([boxes.copy, boxes.drop]));
  // 92px at 390 with all four showing, 44 tall. A name that no longer fits
  // beside its icon wraps and the height goes with it, so height is the check
  // that catches a label growing past the room the row has.
  ok('each destination is a thumb-sized target',
    !!boxes.copy && boxes.copy.height >= 44 && boxes.copy.width >= 80
    && !!boxes.drop && boxes.drop.height >= 44 && boxes.drop.width >= 80,
    JSON.stringify([boxes.copy, boxes.drop]));
  ok('and they fill the row between them',
    !!boxes.copy && !!boxes.drop && boxes.drop.right - boxes.copy.left > boxes.w * 0.9,
    `left=${boxes.copy?.left} right=${boxes.drop?.right} of ${boxes.w}`);
  ok('no Save button survives',
    !(await page.evaluate(() =>
      [...document.querySelectorAll('[data-dictate-ui] button')].some(b => /^\s*Save\s*$/.test(b.textContent)))));
  // FOUR ACROSS, and the fourth is Send rather than Share. Share was bound to
  // navigator.share, which headless Chromium does not have, so this had to
  // force `canShare` to measure a row the browser would not otherwise draw.
  // Send is unconditional (it opens a sheet, it does not call a platform API),
  // and Share is the second button at the foot of that sheet, so the row is
  // four wide here and on a desktop alike. The tightest column, 92px at 390,
  // is the one that decides whether a name still fits beside its icon.
  const four = await page.evaluate(() => new Promise(done =>
    requestAnimationFrame(() => requestAnimationFrame(() => {
      done([...document.querySelectorAll('[data-dictate-ui] button')]
        .filter(x => x.offsetParent && /^(Copy|Send|Jot|Drop)$/.test(x.textContent.trim()))
        .map(x => ({ name: x.textContent.trim(), ...x.getBoundingClientRect().toJSON() })));
    }))));
  ok('all four fit the row at phone width', four.length === 4
    && four.every(b => b.width >= 80 && b.height >= 44 && b.height < 60),
    JSON.stringify(four.map(b => [b.name, Math.round(b.width), Math.round(b.height)])));
  ok('the shell does not scroll the document', boxes.docH <= boxes.h + 1,
    `body=${boxes.docH} viewport=${boxes.h}`);
  ok('the painter is asked for no arrow cluster',
    !(await page.evaluate(() => !!document.querySelector('[data-d="nudge"]'))));

  // ── 1c. The menu overlays; it does not shove the words down ──────────
  // It was a band inserted between the header and the text, so opening it
  // pushed the words down the screen to show four controls that are not about
  // the words at all. The measurement is the text pane's own top edge.
  console.log('the menu and the dictionary:');
  const topOf = () => page.evaluate(() =>
    document.querySelector('[x-ref="view"]').getBoundingClientRect().top);
  const shut = await topOf();
  await page.locator('button[title="More"]').click();
  await page.waitForTimeout(200);
  ok('the menu opens', await page.locator('button:has-text("Breaks")').isVisible());
  ok('and the text has not moved', Math.abs((await topOf()) - shut) < 1,
    `closed=${shut} open=${await topOf()}`);
  await page.mouse.click(200, 500);
  await page.waitForTimeout(200);
  ok('a tap outside closes it', !(await page.locator('button:has-text("Breaks")').isVisible()));

  // Autocorrect is one sheet holding the list AND the way to add to it, and
  // it is reached from the menu: the dictionary button in the header is gone,
  // since a control that opens a sheet the menu also opens is two doors.
  ok('no dictionary button survives in the header',
    !(await page.evaluate(() => !!document.querySelector('button:has(i.ph-book-open):not([class*=hover])'))) ||
    await page.evaluate(() => {
      const b = document.querySelector('button:has(i.ph-book-open)');
      return !b || b.closest('[x-show="menu"]') !== null;
    }));
  await page.locator('button[title="More"]').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Autocorrect")').click();
  await page.waitForTimeout(300);
  ok('the menu row opens the sheet', await page.locator('input[placeholder="heard"]').isVisible());
  ok('and the sheet carries the list, not a link out to GitHub',
    (await page.locator('text=web-tools').count()) > 0
    && !(await page.evaluate(() => !!document.querySelector('a[href*="autocorrect.json"]'))));
  // Scoped to the row list, since every sheet on this page has a close ✕ of
  // its own and an unscoped :has(i.ph-x) finds the hidden one first.
  const rowX = page.locator('.divide-y > div button');
  const rows = await rowX.count();
  ok('every row can be removed', rows >= 2, String(rows));
  await page.locator('[x-show="autoOpen"] button:has(i.ph-x)').first().click();
  await page.waitForTimeout(200);
  // Removing one is checked at the very END of this run: it writes a shorter
  // list into the page's own state, and the correction assertions further
  // down need both entries still in it.

  // ── 1b. The selection lock, over the WHOLE surface ───────────────────
  // Reported from the phone on 2026-08-24: selection was not suppressed where
  // it should be. The painted text was locked and the scroll box around it was
  // not, so every press in the padding and in the empty canvas below the last
  // line, which is most of the screen, raised the platform's own selection.
  // The lock is a stylesheet now, for the reason the composer has one, and
  // this is the measurement rather than a reading of the CSS.
  console.log('the selection lock:');
  const locks = await page.evaluate(() => {
    const cs = (sel) => {
      const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (!el) return null;
      const c = getComputedStyle(el);
      return { sel: c.webkitUserSelect || c.userSelect, touch: c.touchAction };
    };
    const host = document.querySelector('[x-ref="body"]');
    return {
      host: cs(host),
      view: cs('[x-ref="view"]'),
      layer: cs('[x-ref="layer"]'),
      marks: cs('[x-ref="layer"] ~ div button'),
      pad: cs('[data-dictate-ui] button:has(i.ph-crosshair)'),
      root: cs('[data-dictate-ui]'),
    };
  });
  // NO EXCEPTIONS ANY MORE. The pane used to read `pan-y pinch-zoom`, holding
  // the horizontal axis back from the browser so a sideways drag could select.
  // That drag is the mouse's now, so the axis went back and every surface here
  // reads the same.
  for (const [name, v] of Object.entries(locks)) {
    if (name === 'pad') continue;
    ok(`${name} refuses the browser its own selection`, v && v.sel === 'none', JSON.stringify(v));
    ok(`${name} refuses double-tap zoom`, v && v.touch === 'manipulation', JSON.stringify(v));
  }
  // touch-action does NOT inherit, which is how the host and the painted spans
  // computed `auto` under a layer that said manipulation.
  ok('the painted spans are covered too, since touch-action does not inherit',
    await page.evaluate(() => {
      const sp = document.querySelector('[x-ref="body"] [data-d="text"]');
      if (!sp) return false;
      const c = getComputedStyle(sp);
      return (c.webkitUserSelect || c.userSelect) === 'none' && c.touchAction === 'manipulation';
    }));
  // The pad is the one deliberate exception, and it says so inline so that
  // specificity settles it rather than source order.
  ok('the pad keeps touch-action:none, which is what makes its drag work',
    locks.pad && locks.pad.touch === 'none', JSON.stringify(locks.pad));
  // And the keyboard gets the platform back, since a textarea is where a
  // reader looks for select-all and the caret handles.
  await page.evaluate(() => {
    const el = document.querySelector('[x-data="dictate"]');
    el._x_dataStack[0].edit = true;
  });
  await page.waitForTimeout(150);
  ok('the textarea gets selection back',
    await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector('textarea'));
      return (c.webkitUserSelect || c.userSelect) === 'text';
    }));
  await page.evaluate(() => { document.querySelector('[x-data="dictate"]')._x_dataStack[0].edit = false; });
  await page.waitForTimeout(150);

  // ── 2. The engine is kept alive ──────────────────────────────────────
  console.log('keep-alive:');
  await begin();
  await say('the first sentence');
  const before = await page.evaluate(() => window.__engines);
  // An end nobody asked for: WebKit's own silence timeout, from inside.
  await page.evaluate(() => window.__sr.onend());
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__engines);
  ok('a fresh engine came up behind the silence', after > before, `${before} -> ${after}`);
  ok('and the mic still reads as recording, which is the only readout there is',
    await page.evaluate(() => {
      const b = document.querySelector('button:has(i.ph-microphone)');
      return !!b && b.className.includes('btn-error');
    }));
  await say('the sentence after the pause');
  ok('both sides of the pause are in one buffer',
    /first sentence/.test(await buffer()) && /after the pause/.test(await buffer()),
    await buffer());

  // ── 3. Corrections reach the buffer ──────────────────────────────────
  console.log('autocorrect:');
  await say('we load it from js deliver every time');
  const withFix = await buffer();
  ok('a correction fires on a whole phrase', /jsDelivr/.test(withFix), withFix);
  ok('and the words it replaced are gone', !/js deliver/.test(withFix), withFix);
  await say('Web tools is the hub');
  const cased = await buffer();
  ok('a correction at the head of a sentence keeps its capital',
    /Web-tools is the hub/.test(cased), cased);

  // ── 3b. The two gestures the composer port exists for ────────────────
  console.log('the cursor pad and the double tap:');
  const caretAt = () => page.evaluate(() => {
    const el = document.querySelector('[x-data="dictate"]');
    return el?._x_dataStack?.[0]?.d?.range?.start ?? null;
  });
  // The pad is pressed and dragged. The caret starts at the end (a null
  // range), so the first drag has to place one; dragging LEFT walks it back
  // through the buffer, which is the whole of what the control does.
  const padBox = await page.locator('[data-dictate-ui] button:has(i.ph-crosshair):visible').boundingBox();
  await page.mouse.move(padBox.x + padBox.width / 2, padBox.y + padBox.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 14; i++) {
    await page.mouse.move(padBox.x + padBox.width / 2 - 8 * (i + 1), padBox.y + padBox.height / 2);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(150);
  const moved = await caretAt();
  const len = await page.evaluate(() => document.querySelector('[x-ref="body"]').textContent.length);
  ok('a pad drag places the caret inside the buffer', moved != null && moved < len,
    `caret=${moved} length=${len}`);
  ok('and it did not have to touch the words to do it',
    await page.evaluate(() => !!document.querySelector('[data-d="caret"]')));

  // THE TARGET'S TAP HALF. Tap it and the caret becomes one end of a
  // selection; the next tap in the text is the other end. Two taps for an
  // arbitrary range, where the long press gives only a word.
  const target = page.locator('[data-dictate-ui] button:has(i.ph-crosshair):visible');
  const armed = () => page.evaluate(() =>
    document.querySelector('[x-data="dictate"]')._x_dataStack[0].armed);
  const targetRed = () => target.evaluate(el => el.className.includes('btn-error'));
  const sel = () => page.evaluate(() => {
    const d = document.querySelector('[x-data="dictate"]')._x_dataStack[0].d;
    const r = d.range;
    return r && r.start !== r.end ? { ...r, text: d.text.slice(r.start, r.end) } : null;
  });
  const anchorAt = await caretAt();
  await target.click();
  await page.waitForTimeout(150);
  ok('a tap on the target arms an anchor rather than dragging',
    await armed() === 'anchor', String(await armed()));
  ok('and the button says so, in the ring an armed pin wears', await targetRed());

  const words = await page.locator('[x-ref="body"] [data-d="text"]').first().boundingBox();
  await page.mouse.click(words.x + 40, words.y + 12);
  await page.waitForTimeout(250);
  const range = await sel();
  ok('the next tap in the text completes the selection', !!range, JSON.stringify(range));
  ok('it runs from the caret that was there to the word that was tapped',
    !!range && (range.start === anchorAt || range.end === anchorAt),
    `anchor=${anchorAt} range=${JSON.stringify(range)}`);
  // THE MANEUVER SETS, IT DOES NOT LEAVE A PIN LIT. Leaving one armed meant a
  // third tap to close a selection that was already made, on a 12px pinhead,
  // with a near miss clearing it. Refining an edge afterwards is still one tap.
  ok('and the maneuver finishes disarmed', (await armed()) === null, String(await armed()));
  ok('so the target goes dark with it', !(await targetRed()));

  // ONE ARMED STATE, NOT TWO. A pinhead and the target are two ways into the
  // same fact, so the target is red whenever a pin is, and tapping it is the
  // full-size way to put that pin down.
  // The pins are hidden once a mouse has been seen (drag and shift-click do
  // the extending there), and this harness is all mouse, so ask for them back.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; c.paint(); });
  await page.waitForTimeout(120);
  await page.locator('[x-ref="layer"] [data-edge="end"]').click();
  await page.waitForTimeout(150);
  ok('arming a pinhead arms the page', (await armed()) === 'end', String(await armed()));
  ok('and the target is red for it, having not been tapped', await targetRed());
  ok('the selection survived the arming', !!(await sel()));
  // Tapping the target ADVANCES the cycle rather than always disarming, once
  // there is a selection to cycle. The safe exit the pinhead lacked survives:
  // no tap here can lose the selection, and off is at most two taps away.
  await target.click();
  await page.waitForTimeout(150);
  ok('tapping the target hands the arming to the other pin',
    (await armed()) === 'start', String(await armed()));
  await target.click();
  await page.waitForTimeout(150);
  ok('and once more puts it down', (await armed()) === null, String(await armed()));
  ok('...without ever disturbing the selection', !!(await sel()));

  // ── DRAGGING A PINHEAD DIRECTLY ──────────────────────────────────────
  // Tap-then-pad is still there; this is the gesture every reader already
  // expects of a handle. The finger sits on the BALL, which is off the line,
  // so the objection that made this surface tap-first never applied to it.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; c.d.select(4, 20); c.armed = null; c.paint(); });
  await page.waitForTimeout(150);
  const endPin = await page.locator('[x-ref="layer"] [data-edge="end"]').boundingBox();
  const wasSel = await sel();
  await page.mouse.move(endPin.x + endPin.width / 2, endPin.y + endPin.height - 4);
  await page.mouse.down();
  await page.waitForTimeout(60);
  ok('a pinhead arms itself on the way down', (await armed()) === 'end', String(await armed()));
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(endPin.x + endPin.width / 2 + 12 * (i + 1), endPin.y + endPin.height - 4);
    await page.waitForTimeout(25);
  }
  const during = await sel();
  ok('dragging it moves that edge', !!during && during.end > wasSel.end,
    `${JSON.stringify(wasSel)} -> ${JSON.stringify(during)}`);
  ok('and leaves the other edge alone', !!during && during.start === wasSel.start);
  await page.mouse.up();
  await page.waitForTimeout(150);
  // A PIN DRAG ENDS PUT DOWN. The arming was the grip, not a mode to leave
  // behind, so letting go returns the pin to blue with the selection standing.
  ok('the release puts the pin back down', (await armed()) === null, String(await armed()));
  ok('and does not fall through to place a caret in the text', !!(await sel()));

  // THE VERTICAL DEADBAND. A short downward drag must not change the line, so
  // the thumb can clear the text before anything moves and a wandering slide
  // along a line does not step off it. A long one must.
  const lineH = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('[x-ref="view"]')).lineHeight));
  const dragPin = async (edge, dy) => {
    await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; c.d.select(34, 60); c.armed = null; c.paint(); });
    await page.waitForTimeout(150);
    const box = await page.locator(`[x-ref="layer"] [data-edge="${edge}"]`).boundingBox();
    // Grab the ball, which hangs above the line on start and below it on end.
    const y0 = edge === 'end' ? box.y + box.height - 4 : box.y + 4;
    await page.mouse.move(box.x + box.width / 2, y0);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(box.x + box.width / 2, y0 + (dy * i) / 10);
      await page.waitForTimeout(20);
    }
    const r = await sel();
    await page.mouse.up();
    await page.waitForTimeout(120);
    return r;
  };
  const base = await dragPin('end', 0);
  const nudged = await dragPin('end', lineH * 1.2);
  ok('a drag of one line down does not move the edge off its line',
    nudged && base && nudged.end === base.end, `${base?.end} -> ${nudged?.end}`);
  const pushed = await dragPin('end', lineH * 2.6);
  ok('but past the deadband it steps, so the line is still reachable',
    pushed && base && pushed.end > base.end, `${base?.end} -> ${pushed?.end}`);

  // THE BUFFER IS DOWNWARD FOR BOTH, and LONGER for the start pin. Its ball
  // hangs above the line, so its thumb begins on the wrong side and the buffer
  // has to carry it down across the line before it starts clearing. Upward is
  // immediate for both, since that direction is clearance for neither.
  const endUp = await dragPin('end', -lineH * 1.2);
  ok('the end pin answers a short drag UP at once', endUp && base && endUp.end < base.end,
    `${base?.end} -> ${endUp?.end}`);

  const sBase = await dragPin('start', 0);
  const startShort = await dragPin('start', lineH * 1.8);
  ok('the start pin absorbs a drag that would already have moved the end one',
    startShort && sBase && startShort.start === sBase.start,
    `${sBase?.start} -> ${startShort?.start}`);
  const startLong = await dragPin('start', lineH * 4);
  ok('and moves once that longer buffer is spent',
    startLong && sBase && startLong.start > sBase.start, `${sBase?.start} -> ${startLong?.start}`);
  const startUp = await dragPin('start', -lineH * 1.2);
  ok('while up moves it at once, as on the other pin',
    startUp && sBase && startUp.start < sBase.start, `${sBase?.start} -> ${startUp?.start}`);

  // The geometry the two buffers are derived from, which is why they differ.
  ok('the start ball sits above its line and the end ball below', await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.precise = false; c.d.select(34, 60); c.armed = null; c.paint();
    const lead = (e) => {
      const pin = document.querySelector(`[x-ref="layer"] [data-edge="${e}"]`);
      const bar = pin.firstElementChild.getBoundingClientRect();
      const dot = pin.lastElementChild.getBoundingClientRect();
      return (dot.top + dot.height / 2) - (bar.top + bar.height / 2);
    };
    return lead('start') < 0 && lead('end') > 0;
  }));

  // The pins have to vanish from hit testing while one is being dragged, or
  // caret-from-point answers with the pin the aim point is tracking.
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.pinDrag = 'end'; c.armed = 'end'; c.paint();
  });
  await page.waitForTimeout(150);
  ok('a pin is transparent to hit testing while a pin drag is live',
    await page.evaluate(() => {
      const pin = document.querySelector('[x-ref="layer"] [data-edge]');
      return pin ? getComputedStyle(pin).pointerEvents === 'none' : false;
    }));
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.pinDrag = null; c.paint(); });
  await page.waitForTimeout(120);

  // ── A LONG PRESS THAT KEEPS GOING ────────────────────────────────────
  // The press takes a word; carrying on extends from it in one gesture, the
  // way the platform does, rather than making the reader lift and start again.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; c.d.clearRange(); c.armed = null; c.paint(); });
  await page.waitForTimeout(150);
  const line1 = await page.locator('[x-ref="body"] [data-d="text"]').first().boundingBox();
  await page.mouse.move(line1.x + 60, line1.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(600);          // past the 450ms press
  const held = await sel();
  ok('a long press takes the word under the finger', !!held, JSON.stringify(held));
  ok('and arms nothing yet, since the gesture may end here', (await armed()) === null);

  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(line1.x + 60 + 14 * i, line1.y + 12);
    await page.waitForTimeout(25);
  }
  const grown = await sel();
  ok('dragging on extends the selection', grown && held && grown.end > held.end,
    `${JSON.stringify(held)} -> ${JSON.stringify(grown)}`);
  ok('from the WORD\'s edge, not from the character pressed',
    grown && held && grown.start === held.start,
    `start ${held?.start} -> ${grown?.start}`);
  ok('and the edge under the finger arms as it goes', (await armed()) === 'end');
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('the release puts the pin down, as every drag here does',
    (await armed()) === null, String(await armed()));
  ok('and does not fall through to place a caret', !!(await sel()));
  ok('nor leave the pins transparent afterwards',
    await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].pinDrag) === null);

  // A PLAIN DRAG SELECTS, no long press, and it is the MOUSE's: on a touch
  // screen the pane must scroll and a drag is the only way to scroll it, so
  // the long press is the way in there. The edge arms WHILE the drag runs, to
  // show which end is moving, and the release puts it down.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; c.d.clearRange(); c.armed = null; c.paint(); });
  await page.waitForTimeout(150);
  await page.mouse.move(line1.x + 40, line1.y + 12);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(line1.x + 40 + 16 * i, line1.y + 12);
    await page.waitForTimeout(20);
  }
  const swiped = await sel();
  ok('a drag across the words selects without a long press', !!swiped, JSON.stringify(swiped));
  ok('and arms the edge it is moving', (await armed()) === 'end', String(await armed()));
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('and puts it down again on release', (await armed()) === null, String(await armed()));
  ok('leaving the selection it made', !!(await sel()));

  // NO VERTICAL HOLD ON THIS ONE, which is the half that changed with it. The
  // hold exists to get a thumb off the words, and a cursor covers nothing, so
  // the mouse aims with the raw pointer: a drag that dips a line lands on the
  // line it dipped to, and a drag straight down selects at once rather than
  // spending a line and a half first. The hold stays on the two drags a thumb
  // actually drives, the long-press extend and the pin.
  const swipeAt = async (dy, dx = 16) => {
    await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; c.d.clearRange(); c.armed = null; c.paint(); });
    await page.waitForTimeout(150);
    await page.mouse.move(line1.x + 40, line1.y + 12);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(line1.x + 40 + dx * i, line1.y + 12 + (dy * i) / 8);
      await page.waitForTimeout(20);
    }
    const r = await sel();
    await page.mouse.up();
    await page.waitForTimeout(120);
    return r;
  };
  const flat = await swipeAt(0);
  const dipped = await swipeAt(lineH * 1.2);
  ok('a mouse drag that dips a line follows it there, with no hold to spend',
    flat && dipped && dipped.end > flat.end, `${flat?.end} -> ${dipped?.end}`);
  const straightDown = await swipeAt(lineH, 0);
  ok('and one straight down selects, which the hold used to swallow',
    !!straightDown && straightDown.end !== straightDown.start, JSON.stringify(straightDown));

  // AND A FINGER DOES NONE OF IT, in any direction. Every touch drag is a
  // scroll now, so it must neither make a selection nor, on release, fall
  // through to the tap path and drop a caret where the finger came up.
  //
  // FROM NOTHING SELECTED, deliberately: with a range live the pins are on
  // screen and a drag starting on one is a PIN drag, which still works and is
  // meant to. Isolating the plain drag means giving it nothing to grab.
  const touchDrag = async (dy, dx) => {
    await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; c.d.clearRange(); c.armed = null; c.paint(); });
    await page.waitForTimeout(150);
    await page.evaluate(([sx, sy, ddx, ddy]) => {
      const el = document.elementFromPoint(sx, sy);
      const send = (type, cx, cy, buttons) => el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, composed: true, cancelable: true, pointerId: 1, pointerType: 'touch',
        isPrimary: true, clientX: cx, clientY: cy, buttons }));
      send('pointerdown', sx, sy, 1);
      for (let i = 1; i <= 8; i++) send('pointermove', sx + (ddx * i) / 8, sy + (ddy * i) / 8, 1);
      send('pointerup', sx + ddx, sy + ddy, 0);
    }, [line1.x + 40, line1.y + 12, dx, dy]);
    await page.waitForTimeout(150);
    return sel();
  };
  ok('a finger dragging down makes no selection, and no caret either',
    (await touchDrag(lineH * 3, 0)) === null, JSON.stringify(await sel()));
  ok('nor one dragging sideways, which used to select',
    (await touchDrag(0, 120)) === null, JSON.stringify(await sel()));
  ok('nor one dragging up, the direction that never worked',
    (await touchDrag(-lineH * 2, 0)) === null, JSON.stringify(await sel()));

  // The long press is what remains, and it still reaches the same place: the
  // word, then the extension past it. Proven above under "a long press
  // selects the word"; this only checks the two have not become exclusive.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; c.d.clearRange(); c.armed = null; c.paint(); });
  await page.waitForTimeout(150);
  await page.touchscreen.tap(line1.x + 40, line1.y + 12);
  await page.mouse.move(line1.x + 40, line1.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(600);
  const pressed = await sel();
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('and a press still takes the word under it', !!pressed && pressed.end > pressed.start,
    JSON.stringify(pressed));

  // TAPPING THE HEADER'S BACKGROUND PUTS ANY PIN DOWN, which is the way of
  // simply ending the arming rather than changing which edge is live. Its
  // buttons must keep their own taps.
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.precise = false; c.d.select(4, 20); c.armed = 'end'; c.paint();
  });
  await page.waitForTimeout(150);
  const header = await page.locator('[x-data="dictate"] > div').first().boundingBox();
  await page.mouse.click(header.x + header.width / 2 - 62, header.y + header.height / 2);
  await page.waitForTimeout(150);
  ok('a tap on the header background disarms', (await armed()) === null, String(await armed()));
  ok('and leaves the selection alone', !!(await sel()));
  await target.click();
  await page.waitForTimeout(150);
  ok('the header tap did not eat the target\'s own tap', (await armed()) === 'end');
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.armed = null; c.paint(); });

  // AND IT HOLDS THE iOS SHEET for the length of the extension. The pane has
  // to keep scrolling, so this cannot be touch-action; it is a cancelled
  // touchmove (variant E), gated so an ordinary swipe still scrolls. The
  // listener lives on the node the touch started on, since paint() rebuilds
  // every span and a touch keeps its original, now detached, target.
  const holdProbe = async () => page.evaluate(() => {
    const ev = new Event('touchmove', { bubbles: true, cancelable: true });
    window.__pressed.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  // The press is driven by the mouse here, and a mouse pressed INSIDE a
  // selection picks it up to carry rather than long-pressing, so the one the
  // checks above left standing is collapsed first.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.d.caretAt(0); c.paint(); });
  await page.evaluate(({ x, y }) => { window.__pressed = document.elementFromPoint(x, y); },
    { x: line1.x + 60, y: line1.y + 12 });
  await page.mouse.move(line1.x + 60, line1.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(120);          // inside the press, before it fires
  ok('an ordinary touch is left alone, so the pane still scrolls',
    (await holdProbe()) === false);
  await page.waitForTimeout(500);          // past 450ms: the press has taken
  ok('but once the long press takes, the sheet is held', (await holdProbe()) === true);
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('and the hold is released with the finger', (await holdProbe()) === false);

  // Dragging BACK inside the word restores it rather than cutting into it: the
  // word is the floor of this gesture, as it is on the platform. The word the
  // press above took is collapsed first: pressed inside a selection, a mouse
  // now picks it up to carry, and this check would then compare two
  // unchanged ranges and pass without the extension ever running (found by
  // review, 2026-09-27). `grown` proves the extension ran.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.d.caretAt(0); c.paint(); });
  await page.mouse.move(line1.x + 60, line1.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(600);
  const held2 = await sel();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(line1.x + 60 + 12 * i, line1.y + 12);
    await page.waitForTimeout(20);
  }
  const grown2 = await sel();
  ok('the long press extends as it is dragged on', !!grown2 && !!held2 && grown2.end > held2.end,
    `${JSON.stringify(held2)} -> ${JSON.stringify(grown2)}`);
  await page.mouse.move(line1.x + 62, line1.y + 12);
  await page.waitForTimeout(80);
  const shrunk = await sel();
  await page.mouse.up();
  await page.waitForTimeout(120);
  ok('coming back inside the word restores it whole',
    shrunk && held2 && shrunk.start === held2.start && shrunk.end === held2.end,
    `${JSON.stringify(held2)} -> ${JSON.stringify(shrunk)}`);

  // NO STALK, DELIBERATELY. Arming used to push the ball out to clear the
  // thumb; the drag's vertical deadband above does that instead, from the
  // gesture rather than from the geometry. This holds the decision: the ball
  // marks the edge and does not move for being armed.
  const ballY = () => page.evaluate(() => {
    const dot = document.querySelector('[x-ref="layer"] [data-edge="start"]')?.lastElementChild;
    const r = dot?.getBoundingClientRect?.();
    return r ? r.top + r.height / 2 : null;
  });
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.precise = false; c.d.select(4, 30); c.armed = null; c.paint();
  });
  await page.waitForTimeout(150);
  const rest = await ballY();
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.armed = 'start'; c.paint(); });
  await page.waitForTimeout(200);
  const lit = await ballY();
  ok('arming lights the pin without moving it', rest != null && Math.abs(rest - lit) < 1,
    `${rest} -> ${lit}`);
  ok('and the page asks the painter for no reach at all',
    await page.evaluate(() => {
      const dot = document.querySelector('[x-ref="layer"] [data-edge="start"]').lastElementChild;
      return !/transition/.test(dot.getAttribute('style'));
    }));

  // VARIANT D against the iOS sheet: touch-action alone was measured on device
  // to let the sheet go, so both touch events must be cancellable and cancelled
  // on the pad and on every pin, and the pins are rebuilt on every paint.
  const holds = await page.evaluate(() => {
    const probe = (el) => {
      if (!el) return null;
      const seen = {};
      for (const type of ['touchstart', 'touchmove']) {
        const ev = new Event(type, { bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        seen[type] = ev.defaultPrevented;
      }
      return seen;
    };
    return {
      pad: probe(document.querySelector('[data-dictate-ui] button:has(i.ph-crosshair)')),
      pin: probe(document.querySelector('[x-ref="layer"] [data-edge]')),
    };
  });
  ok('the pad cancels touchstart, which touch-action cannot do', !!holds.pad?.touchstart);
  ok('the pad cancels touchmove, the half that holds the sheet', !!holds.pad?.touchmove);
  ok('a repainted pin carries the same hold', !!holds.pin?.touchstart && !!holds.pin?.touchmove);

  // AND A TAP THAT PLACES AN ARMED EDGE SPENDS THE ARMING. Arm a pinhead, tap
  // in the text: the edge moves there and the pin goes back to blue, so the
  // next tap anywhere is not a move nobody asked for.
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.precise = false; c.d.select(34, 60); c.armed = null; c.paint();
  });
  await page.waitForTimeout(150);
  await page.locator('[x-ref="layer"] [data-edge="end"]').click();
  await page.waitForTimeout(150);
  ok('the pinhead arms', (await armed()) === 'end', String(await armed()));
  const beforePlace = await sel();
  await page.waitForTimeout(400);          // clear of the double-tap window
  const firstLine = await page.locator('[x-ref="body"] [data-d="text"]').first().boundingBox();
  await page.mouse.click(firstLine.x + 30, firstLine.y + 12);
  await page.waitForTimeout(250);
  const placed = await sel();
  ok('the tap moves that edge', placed && beforePlace && placed.end !== beforePlace.end,
    `${beforePlace?.end} -> ${placed?.end}`);
  ok('and the placement puts the pin back to blue', (await armed()) === null, String(await armed()));

  // WITH A SELECTION THE TARGET CYCLES THE PINS, since which edge am I about
  // to move is the only question left. Without one there are no pins to cycle,
  // so it arms an anchor instead and the next tap in the text is the far end.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.d.select(4, 20); c.armed = null; c.paint(); });
  await page.waitForTimeout(150);
  await target.click(); await page.waitForTimeout(120);
  ok('with a selection, the target arms the end first', (await armed()) === 'end', String(await armed()));
  await target.click(); await page.waitForTimeout(120);
  ok('again and it hands over to the start', (await armed()) === 'start', String(await armed()));
  await target.click(); await page.waitForTimeout(120);
  ok('again and neither is armed', (await armed()) === null, String(await armed()));
  ok('and the selection survived the whole cycle', !!(await sel()));

  // And the target's own armed state has the same way out.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.d.clearRange(); c.armed = null; c.paint(); });
  await target.click();
  await page.waitForTimeout(120);
  ok('with no selection it arms an anchor instead', (await armed()) === 'anchor');
  await target.click();
  await page.waitForTimeout(120);
  ok('...and a second tap puts it away', (await armed()) === null);

  // A double tap on the words opens the keyboard, with the caret where it
  // landed. The pencil is retired, so this is the only way in.
  const line = await page.locator('[x-ref="body"] [data-d="text"]').first().boundingBox();
  await page.mouse.dblclick(line.x + 60, line.y + 12);
  await page.waitForTimeout(300);
  // READ THE OPACITY, not `isVisible`. The textarea is never `display:none`
  // any more, because WebKit only raises the keyboard for a focus taken inside
  // the tap and a hidden element cannot take one, so Playwright calls it
  // visible in both states and the old assertion passed vacuously.
  const typing = () => page.evaluate(() => {
    const ta = document.querySelector('[x-ref="ta"]');
    const cs = getComputedStyle(ta);
    return { shown: cs.opacity === '1', taps: cs.pointerEvents !== 'none',
             focused: document.activeElement === ta };
  });
  const opened = await typing();
  ok('a double tap opens the keyboard', opened.shown && opened.taps, JSON.stringify(opened));
  ok('and lands the caret in it, which is what raises the keyboard', opened.focused,
    JSON.stringify(opened));
  ok('there is no pencil to have opened it instead',
    !(await page.evaluate(() => !!document.querySelector('button[title*="Type instead"]'))));
  await page.evaluate(() => document.querySelector('[x-ref="ta"]').blur());
  await page.waitForTimeout(300);
  const closed = await typing();
  ok('and blurring is the way out', !closed.shown, JSON.stringify(closed));
  ok('with the field behind taking no taps', !closed.taps, JSON.stringify(closed));

  // ── 4. The draft survives, and a filed note does not ─────────────────
  console.log('persistence:');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const back = await buffer();
  ok('an interrupted session comes back after a reload', /first sentence/.test(back), back);
  ok('and says so rather than pretending it was always there',
    /Picked up where you left off/.test(await page.locator('body').innerText()));

  await stub();
  writes.length = 0;
  // A NAMED CHECK because the failure has no error in it. `:disabled` was
  // bound to `!token || saving`, and `saving` is a string: with a token in
  // hand the expression is '', which Alpine's bind() writes rather than
  // removes, because it drops an attribute only for null, undefined and
  // false. Both writing destinations were dead, with a token present, and
  // nothing anywhere said why.
  ok('Drop is live when a token is present',
    await page.locator('button:has-text("Drop")').isEnabled());
  await page.locator('button:has-text("Drop")').click();
  await page.waitForTimeout(600);
  ok('Drop wrote one file', writes.length === 1, JSON.stringify(writes.map(w => w.url)));
  ok('into the dated tray', /chron%2Fdump|chron\/dump/.test(writes[0]?.url || ''), writes[0]?.url);
  ok('carrying the words', /first sentence/.test(writes[0]?.text || ''), writes[0]?.text);
  ok('and the page went blank behind it', !(await buffer()).trim(), await buffer());

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  ok('a note that was FILED does not come back', !(await buffer()).trim(), await buffer());

  // ── 4a. The two halves lay text out identically ──────────────────────
  // Switching to the keyboard must not reflow the paragraph. The panes are
  // separate elements carrying separate class lists, so nothing but a check
  // holds them together: they drifted on `tracking` alone, which ran the type
  // 0.21px wider per character in the textarea, 16.8px over a 79-character
  // line. Mirrored rather than read off line boxes, since a textarea has none
  // to read: each side builds a probe from its OWN computed style at its own
  // content width, and the two probes must agree.
  console.log('the two halves:');
  const SAMPLE = 'The quick brown fox jumps over the lazy dog and keeps on running past the '
    + 'fence. Then it turned round and came back the way it had gone, twice over.';
  const mirror = (target) => page.evaluate(([sel, t]) => {
    const el = document.querySelector(sel);
    const cs = getComputedStyle(el);
    const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;font-family:${cs.fontFamily};`
      + `font-size:${cs.fontSize};font-weight:${cs.fontWeight};line-height:${cs.lineHeight};`
      + `letter-spacing:${cs.letterSpacing};word-spacing:${cs.wordSpacing};`
      + `white-space:pre-wrap;overflow-wrap:${cs.overflowWrap};word-break:${cs.wordBreak}`;
    d.textContent = t;
    document.body.appendChild(d);
    const h = Math.round(d.getBoundingClientRect().height);
    d.remove();
    return { width: Math.round(w), height: h };
  }, [target, SAMPLE]);

  await open();
  await page.evaluate((t) => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.text = t; c.started = true; c.paint();
  }, SAMPLE);
  await page.waitForTimeout(300);
  const readShape = await mirror('[x-ref="body"]');
  await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].editOpen(0));
  await page.waitForTimeout(300);
  const editShape = await mirror('[x-ref="ta"]');
  ok('the read pane and the textarea wrap to the same shape',
    readShape.width === editShape.width && readShape.height === editShape.height,
    `${JSON.stringify(readShape)} vs ${JSON.stringify(editShape)}`);

  // THE KEYBOARD BUTTON CARRIES THE SELECTION, which the double tap cannot:
  // it lands on a point and a point collapses one. That is the whole reason
  // the button exists rather than being a second route to the same place.
  await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].editClose());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.precise = false; c.d.select(4, 9); c.armed = null; c.paint();
  });
  await page.waitForTimeout(200);
  await page.locator('button[title^="Type."]').click();
  await page.waitForTimeout(400);
  const carried = await page.evaluate(() => {
    const ta = document.querySelector('[x-ref="ta"]');
    return { start: ta.selectionStart, end: ta.selectionEnd, over: ta.value.slice(ta.selectionStart, ta.selectionEnd) };
  });
  ok('the selection crosses into the keyboard intact',
    carried.start === 4 && carried.end === 9, JSON.stringify(carried));
  ok('so the first thing typed replaces those words', carried.over === 'quick', carried.over);
  // The pin layer sits OUTSIDE the read pane's x-show, so it does not go with
  // it. Invisible while the only way in was a double tap, which collapses a
  // selection; now the button carries one across, both marks were drawn.
  ok('and the pins come off, leaving the textarea to mark it once',
    await page.evaluate(() => !document.querySelector('[data-edge]')));

  // AND THE PINS COME BACK WHERE THEY WERE. Every position the painter writes
  // is measured, and a hidden element measures zero, so a paint that ran one
  // tick before the read pane came back put both pins at the layer's origin
  // and left them there. It looked like a layout bug rather than a timing one.
  const pinAt = () => page.evaluate(() => [...document.querySelectorAll('[data-edge]')]
    .map(e => { const r = e.getBoundingClientRect();
                return `${e.getAttribute('data-edge')}@${Math.round(r.left)},${Math.round(r.top)}`; }));
  await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].editClose());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.precise = false; c.d.select(4, 9); c.armed = null; c.paint();
  });
  await page.waitForTimeout(250);
  const pinsBefore = await pinAt();
  await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].editOpen());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].editClose());
  await page.waitForTimeout(400);
  const pinsAfter = await pinAt();
  ok('the pins come back where they were after a trip through the keyboard',
    pinsBefore.length === 2 && JSON.stringify(pinsBefore) === JSON.stringify(pinsAfter),
    `${JSON.stringify(pinsBefore)} -> ${JSON.stringify(pinsAfter)}`);

  // And a double tap still wins where it lands, since it said WHERE.
  await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].editClose());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.select(4, 9); c.paint(); c.editOpen(30);
  });
  await page.waitForTimeout(400);
  ok('an offset the reader pointed at still wins over the selection',
    await page.evaluate(() => {
      const ta = document.querySelector('[x-ref="ta"]');
      return ta.selectionStart === 30 && ta.selectionEnd === 30;
    }));

  // A long word breaks rather than scrolling the pane sideways, which is the
  // other half of matching the two: the textarea already broke it.
  await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].editClose());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.text = 'see https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=owner/repo:pages/dictate.html for it';
    c.paint();
  });
  await page.waitForTimeout(300);
  ok('a URL too long for the measure breaks instead of scrolling the pane',
    await page.evaluate(() => {
      const v = document.querySelector('[x-ref="view"]');
      return v.scrollWidth - v.clientWidth === 0;
    }));

  // THE DELETE KEY IS A KEY: same row as the marks and the shift, not the
  // header and not the send row. It is tapped over and over mid-sentence,
  // which is what that row is tall for.
  //
  // NOT BESIDE THE SHIFT ANY MORE, and the gap between them is the point. The
  // row divides into writing and repair past a hairline, so backspace is the
  // repair group's last key and the shift is the writing group's, with the
  // step-back and stitch keys between them. Same row, same parent, and this
  // asserts the divider rather than pretending the two are still adjacent.
  ok('backspace ends the key row, past the hairline that divides it',
    await page.evaluate(() => {
      const b = document.querySelector('button:has(i.ph-backspace)');
      if (!b) return false;
      const shift = [...document.querySelectorAll('button')].find(x => /^(·!¶|abc)$/.test(x.textContent.trim()));
      if (!shift || b.parentElement !== shift.parentElement) return false;
      const kids = [...b.parentElement.children];
      const rule = kids.find(e => e.tagName === 'DIV' && e.className.includes('w-px'));
      return !!rule && kids.indexOf(shift) < kids.indexOf(rule)
        && kids.indexOf(rule) < kids.indexOf(b)
        && b === kids[kids.length - 1];
    }));

  // ── 4b. The two modifier taps ────────────────────────────────────────
  // Keyboard, so desktop only in practice, but the checks are the cheap half:
  // that a bare tap acts, and that the same key inside a chord does not.
  console.log('the modifier taps:');
  await open();
  // The grant is remembered by now, so the page has already begun on the REAL
  // recognizer that this Chromium carries, before the stub went in. Cycle the
  // engine so the fake is the one running, and start from an empty buffer.
  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.stop(); c.d.text = '';
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].d.start());
  await page.waitForTimeout(200);
  await say('so I went to the store');
  ok('a pause writes the full stop', /store\.$/.test((await buffer()).trim()), await buffer());

  await page.keyboard.press('Control');
  await page.waitForTimeout(120);
  ok('a bare Control tap takes it back', !/store\./.test(await buffer()), await buffer());

  await say('And then I came back');
  ok('and the sentence runs on in lower case',
    /store and then i came back/i.test(await buffer())
      && !/store\. And/.test(await buffer()), await buffer());

  // The chord is the reason this listens on keyup rather than keydown: the
  // Control keydown fires first and looks exactly like the tap.
  const wasChord = (await buffer()).trim();
  await page.keyboard.press('Control+KeyC');
  await page.waitForTimeout(120);
  ok('Ctrl+C is a copy, not an un-ending', (await buffer()).trim() === wasChord, await buffer());

  await say('a new thought');
  const capsArmed = () => page.evaluate(() =>
    !!document.querySelector('[x-data="dictate"]')._x_dataStack[0].capsArmed);
  await page.keyboard.press('Shift');
  await page.waitForTimeout(120);
  ok('a bare Shift tap arms the capital', await capsArmed());
  ok('and the header says so', await page.locator('i.ph-text-aa').isVisible());

  await say('dexie', false);
  ok('the grey text already wears it', /Dexie/.test(await buffer()), await buffer());
  await say('dexie held the rest');
  ok('the word lands capitalised', /Dexie held the rest/.test(await buffer()), await buffer());
  ok('and one word spends the arming', !(await capsArmed()));

  await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.select(c.d.text.indexOf('rest'), c.d.text.indexOf('rest') + 4); c.paint();
  });
  await page.keyboard.press('Shift');
  await page.waitForTimeout(120);
  ok('with a word selected, Shift recases it instead of arming',
    /Rest/.test(await buffer()) && !(await capsArmed()), await buffer());

  // ── 5. Removing an autocorrect row ───────────────────────────────────
  // Last, because it writes a shorter list into the page's own state and the
  // correction assertions above need both entries still in it.
  console.log('removing a correction:');
  await page.locator('button[title="More"]').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Autocorrect")').click();
  await page.waitForTimeout(300);
  writes.length = 0;
  await page.locator('.divide-y > div button').first().click();
  await page.waitForTimeout(600);
  ok('it writes the shorter list', writes.length === 1
    && !JSON.parse(writes[0].text).items.some(c => c.from === 'web tools'),
    writes[0]?.text);
  ok('and the sheet stays open, since the list under it is the confirmation',
    await page.locator('input[placeholder="heard"]').isVisible());
  // ── An arrival, and the draft it displaces ──────────────────────────────
  // The expand carries a draft here through one localStorage key, and this
  // page saves whatever it is shown. Joining the arrival onto the stored draft
  // therefore compounded: the second expand opened on the first note stacked
  // above it, the third on both. An arrival replaces now, and what it
  // displaced is one tap away rather than gone.
  console.log('\nan arrival replaces the stored draft:');
  await page.evaluate(() => {
    localStorage.setItem('dictate:draft', 'an older note nobody filed');
    localStorage.setItem('wt:dictate-handoff', JSON.stringify({
      text: 'the note being carried over', at: '/pages/annotate.html', sentAt: Date.now() }));
    localStorage.removeItem('dictate:aside');
  });
  await open();
  ok('the page opens on the carried words alone',
    (await buffer()).trim() === 'the note being carried over', await buffer());
  ok('and says where they came from',
    (await page.locator('text=Carried over from').count()) === 1);
  ok('the displaced draft is offered back, not discarded',
    await page.locator('button:has-text("Bring back")').isVisible());

  await page.locator('button:has-text("Bring back")').click();
  await page.waitForTimeout(300);
  ok('and one tap puts it above what is here',
    (await buffer()).replace(/\s+/g, ' ').trim()
      === 'an older note nobody filed the note being carried over', await buffer());
  // x-show hides rather than removes, so this asks whether it is VISIBLE.
  ok('the offer is spent, since those words are now in the buffer',
    !(await page.locator('button:has-text("Bring back")').isVisible()));

  // The pile-up this replaced: a second arrival must not stack on the first.
  await page.evaluate(() => {
    localStorage.setItem('wt:dictate-handoff', JSON.stringify({
      text: 'a second note', at: '/pages/annotate.html', sentAt: Date.now() }));
  });
  await open();
  ok('a second arrival opens on itself, not on the pile',
    (await buffer()).trim() === 'a second note', await buffer());

  // ── Paragraphs in file mode: join, split, and carrying words ─────────
  // The Rendered view draws a document block by block, so the gap between two
  // paragraphs was nowhere to aim and a paragraph could only be cut from the
  // shifted ¶ key. These are the three routes that replaced that, driven the
  // way a finger drives them: a tap on the gap, a long press on a space, and
  // a long press inside a selection that then carries it.
  console.log('paragraphs:');
  const PARA_DOC = '# Title\n\nFirst one. First two.\n\nSecond para.\n\nThird para.\n';
  // What the fixture serves, swapped for a check that needs GitHub's copy to
  // have moved under a draft.
  let served = { text: PARA_DOC, sha: 'para' };
  await page.route('**/repos/mehrlander/web-tools/contents/tools/test/para-fixture.md*', (route) => {
    // A write to the fixture (Apply, Save) is logged like any other write.
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}');
      writes.push({ url: route.request().url(), message: body.message, text: Buffer.from(body.content || '', 'base64').toString('utf8') });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'applied' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      content: Buffer.from(served.text).toString('base64'), encoding: 'base64', sha: served.sha, size: served.text.length }) });
  });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.includes('dictate')) localStorage.removeItem(k); });
  await open('?file=mehrlander/web-tools:tools/test/para-fixture.md');
  await page.waitForFunction(() => document.querySelector('[x-ref="md"] p'), null, { timeout: 10000 });
  const docText = () => page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].text);
  const reset = () => page.evaluate((t) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.d.text = t; c.precise = false; c.d.caretAt(0); c.paint(); }, PARA_DOC);
  const touch = (type, x, y) => page.evaluate(([type, x, y]) => {
    document.elementFromPoint(x, y).dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch',
      pointerId: 11, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1 }));
  }, [type, x, y]);
  const pillAt = (label) => page.evaluate((label) => {
    const b = [...document.querySelectorAll('[data-seam].btn')].find((b) => b.textContent.includes(label));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, label);
  const rectOf = (needle, k = 0) => page.evaluate(([needle, k]) => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const r = window.MdSurface.rectAt(c.$refs.md, c.text.indexOf(needle) + k);
    return { x: r.left + 1, y: r.top + r.height / 2 };
  }, [needle, k]);
  const seamBelow = (start) => page.evaluate((start) => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const s = window.MdSurface.seams(c.$refs.md).find((s) => s.a.el.textContent.startsWith(start));
    const md = c.$refs.md.getBoundingClientRect();
    return s && { x: md.left + md.width / 2 + 40, y: (s.top + s.bottom) / 2 };
  }, start);

  // No Join pill: backspace joins, and a tap on the gap is only a tap.
  await reset();
  const gap = await seamBelow('First one');
  await page.touchscreen.tap(gap.x, gap.y);
  await page.waitForTimeout(200);
  ok('a tap on the gap between two paragraphs offers no Join pill and changes nothing',
    !(await pillAt('Join')) && (await docText()) === PARA_DOC);

  await reset();
  const sp = await rectOf(' First two', 0);
  await touch('pointerdown', sp.x + 2, sp.y);
  await page.waitForTimeout(550);
  await touch('pointerup', sp.x + 2, sp.y);
  await page.waitForTimeout(200);
  const split = await pillAt('Split');
  ok('a long press on the space between two sentences offers Split', !!split);
  if (split) {
    await page.touchscreen.tap(split.x, split.y);
    await page.waitForTimeout(250);
  }
  ok('and Split cuts the paragraph there, no space stranded',
    (await docText()).includes('First one.\n\nFirst two.'), JSON.stringify(await docText()));

  await reset();
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint(); });
  const from = await rectOf('First two.', 3);
  const to = await seamBelow('First one');
  await touch('pointerdown', from.x, from.y);
  await page.waitForTimeout(550);
  const LIFT = 44;
  for (let k = 1; k <= 6; k++) await touch('pointermove', from.x + k * 4, from.y + (to.y + LIFT - from.y) * k / 6);
  const mid = await page.evaluate(() => ({ label: !!document.querySelector('[data-move].truncate'),
    line: !!document.querySelector('[data-move].border-t-\\[3px\\]'),
    wide: document.documentElement.scrollWidth > innerWidth, pins: !!document.querySelector('[data-edge]') }));
  ok('a long press inside a selection picks it up: the words ride above the finger', mid.label, JSON.stringify(mid));
  ok('and the gap they would land in is lined', mid.line, JSON.stringify(mid));
  ok('the carried words stay inside the pane, so the page never widens', !mid.wide);
  ok('and the pins come off while they are carried', !mid.pins);
  await touch('pointerup', from.x + 24, to.y + LIFT);
  await page.waitForTimeout(250);
  ok('dropped on the gap below, the sentence becomes its own paragraph',
    (await docText()).includes('First one.\n\nFirst two.\n\nSecond para.'), JSON.stringify(await docText()));

  await reset();
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('Second para.'); c.d.select(a, a + 12); c.paint(); });
  const from2 = await rectOf('Second para.', 3);
  const end = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const r = window.MdSurface.rectAt(c.$refs.md, c.text.indexOf('First two.') + 9); return { x: r.left + 6, y: r.top + r.height / 2 }; });
  await touch('pointerdown', from2.x, from2.y);
  await page.waitForTimeout(550);
  for (let k = 1; k <= 6; k++) await touch('pointermove', from2.x + (end.x - from2.x) * k / 6, from2.y + (end.y + LIFT - from2.y) * k / 6);
  await touch('pointerup', end.x, end.y + LIFT);
  await page.waitForTimeout(250);
  ok('carried onto the end of the paragraph above, a paragraph joins it and leaves no gap',
    (await docText()).includes('First two. Second para.\n\nThird para.'), JSON.stringify(await docText()));
  const closedMark = await page.evaluate(() => !!document.querySelector('[x-ref="md"] [data-md-break="closed"]'));
  ok('and the card shows the break it closed, since the words themselves did not change', closedMark);
  // Going back through the card's bar, the way a reader would: the number
  // selects the card, the bar shows on it, and Remove takes the change back.
  const badge = await page.evaluate(() => { const b = document.querySelector('[x-ref="md"] [data-md-card-badge]');
    b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(badge.x, badge.y);
  await page.waitForTimeout(250);
  const bar = await page.evaluate(() => { const shown = [...document.querySelectorAll('[data-md-card-bar]')].filter((x) => !x.classList.contains('invisible'));
    const b = shown[0]; if (!b) return null;
    const card = b.closest('[data-md-card]').getBoundingClientRect(), r = b.getBoundingClientRect();
    const k = b.querySelector('[title^="Remove"]'), kr = k.getBoundingClientRect(), hit = getComputedStyle(k, '::before');
    return { n: shown.length, inCard: !!b.closest('[data-md-card]'), straddles: r.top < card.bottom && r.bottom > card.bottom,
             centred: Math.abs((r.left + r.right) / 2 - (card.left + card.right) / 2), words: b.textContent.replace(/\s+/g, ''),
             h: Math.round(r.height), fs: parseFloat(getComputedStyle(b).fontSize),
             reach: Math.round(kr.height + 2 * Math.abs(parseFloat(hit.top) || 0)), x: kr.left + kr.width / 2, y: kr.top + kr.height / 2 }; });
  ok('the number selects its card, and the card wears one pill, confirm and remove, centred on its bottom edge, 13px words in a pill no taller than 22px, with a tap reach of 40px or more',
    !!bar && bar.n === 1 && bar.inCard && bar.straddles && bar.centred < 3 && bar.words === 'confirmremove' && bar.fs >= 13 && bar.h <= 22 && bar.reach >= 40, JSON.stringify(bar));
  await page.touchscreen.tap(bar.x, bar.y);
  await page.waitForTimeout(250);
  ok('and Remove on the bar restores the document exactly', (await docText()) === PARA_DOC, JSON.stringify(await docText()));

  // ── Found by review, 2026-09-27 ─────────────────────────────────────
  // Each of these failed on the page the review read.
  console.log('paragraphs, review:');
  // A long press on a selection that never moves is not a drop: it used to
  // aim 44px above the finger at once and drop there on release.
  await reset();
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint(); });
  const hold = await rectOf('First two.', 3);
  await touch('pointerdown', hold.x, hold.y);
  await page.waitForTimeout(600);
  await touch('pointerup', hold.x, hold.y);
  await page.waitForTimeout(200);
  ok('a long press on a selection, released without moving, moves nothing', (await docText()) === PARA_DOC, JSON.stringify(await docText()));

  // Words landing mid-carry (a final result from the microphone) end the
  // carry: its range no longer names the words it picked up.
  await reset();
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint(); });
  const f3 = await rectOf('First two.', 3), g3 = await seamBelow('First one');
  await touch('pointerdown', f3.x, f3.y);
  await page.waitForTimeout(550);
  await touch('pointermove', f3.x + 20, f3.y + 20);
  const spoken = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.insert('words that just arrived'); return c.d.text; });
  for (let k = 1; k <= 4; k++) await touch('pointermove', f3.x + 20, f3.y + (g3.y + 44 - f3.y) * k / 4);
  await touch('pointerup', f3.x + 20, g3.y + 44);
  await page.waitForTimeout(200);
  ok('text changing under a carry ends it, and the drop moves nothing', (await docText()) === spoken, JSON.stringify(await docText()));
  // Words landing elsewhere (appended at the end) leave the carry alive.
  await reset();
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint(); });
  const f4 = await rectOf('First two.', 3);
  await touch('pointerdown', f4.x, f4.y);
  await page.waitForTimeout(550);
  await touch('pointermove', f4.x + 20, f4.y + 20);
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.text = c.d.text + 'Appended.\n'; });
  await page.waitForTimeout(150);
  // measured after the change, which moves the layout
  const g4 = await seamBelow('First one');
  for (let k = 1; k <= 4; k++) await touch('pointermove', f4.x + 20, f4.y + (g4.y + 44 - f4.y) * k / 4);
  await touch('pointerup', f4.x + 20, g4.y + 44);
  await page.waitForTimeout(200);
  ok('words landing elsewhere leave the carry alive, and it drops', (await docText()).includes('First one.\n\nFirst two.\n\nSecond para.'), JSON.stringify(await docText()));

  // A double tap on a gap opens the keyboard, as a double tap on the canvas
  // does anywhere else.
  await reset();
  const gapD = await seamBelow('First one');
  await page.touchscreen.tap(gapD.x, gapD.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(gapD.x, gapD.y);
  await page.waitForTimeout(300);
  const kbOpen = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; return c.edit || c.typing; });
  ok('a double tap on a gap opens the keyboard', !!kbOpen);
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; if (c.typing) c.stopTyping(); if (c.edit) c.editClose(); });

  // Split is not offered on a space inside inline code: it would cut the
  // code span in two.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.text = '# Title\n\nRun `npm run build now` first. Then more.\n'; c.d.caretAt(0); c.paint(); });
  await page.waitForTimeout(200);
  const inCodeOffer = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const t = c.text; return { code: c.inCode(t.indexOf(' run build')), prose: c.inCode(t.indexOf(' Then')) }; });
  ok('a space inside inline code is not a place to split, a sentence gap is', inCodeOffer.code && !inCodeOffer.prose, JSON.stringify(inCodeOffer));
  // And the gesture itself: a long press on that space offers no Split.
  const codeSp = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.precise = false; const t = c.text, r = window.MdSurface.rectAt(c.$refs.md, t.indexOf(' run build') + 1);
    return r && { x: r.left - 2, y: r.top + r.height / 2 }; });
  if (codeSp) {
    await touch('pointerdown', codeSp.x, codeSp.y);
    await page.waitForTimeout(550);
    await touch('pointerup', codeSp.x, codeSp.y);
    await page.waitForTimeout(200);
  }
  ok('and a long press there shows no Split button', !!codeSp && !(await pillAt('Split')));
  const fence = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.text = 'Text.\n\n```\n~~~\nstill code here\n```\n\nProse again here.\n';
    const t = c.text; return { inFence: c.inCode(t.indexOf(' code here')), after: c.inCode(t.indexOf(' again')) }; });
  ok('a ~~~ line inside a ``` fence does not close it', fence.inFence && !fence.after, JSON.stringify(fence));
  const indented = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.text = 'Intro.\n\n    one two. three\n    four five. six\n\n- item\n\n    Cont para. Next sentence.\n\nLazy line\n    wrapped on. Here.\n';
    const t = c.text; return { first: c.inCode(t.indexOf(' three')), second: c.inCode(t.indexOf(' six')), cont: c.inCode(t.indexOf(' Next')), lazy: c.inCode(t.indexOf(' Here')) }; });
  ok('every line of an indented code block is code, a list continuation or a lazy wrap is not',
    indented.first && indented.second && !indented.cont && !indented.lazy, JSON.stringify(indented));

  // A finger near the top of the pane aims above it; the drop is kept inside
  // the pane rather than landing on a gap scrolled out of sight.
  const aim = await page.evaluate(async () => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.text = Array.from({ length: 14 }, (_, k) => `Paragraph ${k} has a few words in it.`).join('\n\n') + '\n';
    c.paint();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Put a whole gap just above the top of the pane, out of sight.
    const v = c.$refs.view, s0 = window.MdSurface.seams(c.$refs.md)[4];
    v.scrollTop += s0.bottom - v.getBoundingClientRect().top - 1;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const vb = v.getBoundingClientRect(), md = c.$refs.md.getBoundingClientRect();
    c.mover = { a: 0, b: 1, text: 'x', x: 0, y: 0, touch: true, target: null };
    const t = c.dropAt(md.left + md.width / 2, vb.top - 12);
    c.mover = null; c.paint();
    const y = t && (t.para ? t.y : window.MdSurface.rectAt(c.$refs.md, t.at)?.top);
    return { vtop: vb.top, y, t, hidden: s0.at };
  });
  // Where the words LAND, not only where the marker is drawn: never on the
  // gap scrolled out of sight, and somewhere rather than nowhere.
  ok('a drop aimed above the pane lands inside it, not on the gap out of sight',
    !!aim.t && aim.t.at !== aim.hidden && aim.y >= aim.vtop - 12, JSON.stringify(aim));

  // ── Native selection, the menu's option ─────────────────────────────
  // The platform selects; the buffer follows its selection, and the page
  // stops painting one. Only a tap is the page's. A selection made in script
  // stands in for the platform's long press, which a headless browser cannot
  // produce; the handles and callout are the phone's to show.
  console.log('native selection:');
  await reset();
  // FILE MODE HAS ONE HEADER: the file's name sits in it, whole, on a phone,
  // and no face buttons beside it: the faces are the pill under the header.
  const hdr = await page.evaluate(() => {
    const head = document.querySelector('[x-data="dictate"] > div'), a = head.querySelector('a[href*="github.com"]');
    const vis = (el) => !!el && el.getClientRects().length > 0;
    const nm = a && a.querySelector('[data-file-name]'), dir = a && a.querySelector('[data-file-dir]');
    return { inHeader: vis(a), whole: !!nm && nm.scrollWidth <= nm.clientWidth, name: nm && nm.innerText.trim(), dir: dir && dir.innerText.trim(),
             stacked: !!nm && !!dir && dir.getBoundingClientRect().top >= nm.getBoundingClientRect().bottom - 2,
             faceBtn: [...head.querySelectorAll('.ph-eye, .ph-code')].some(vis), pill: vis(document.querySelector('[data-faces-pill]')) };
  });
  ok('in file mode the file\'s name sits whole in the one header, the repository and folders on a line under it, with no face buttons beside it',
    hdr.inHeader && hdr.whole && !/[:@/]/.test(hdr.name) && hdr.dir === 'web-tools/tools/test' && hdr.stacked && !hdr.faceBtn && hdr.pill, JSON.stringify(hdr));
  const pillB = await page.evaluate(() => { const r = document.querySelector('[data-faces-pill]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(pillB.x, pillB.y);
  await page.waitForTimeout(200);
  const rawB = await page.evaluate(() => { const r = document.querySelector('[data-face="raw-after"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(rawB.x, rawB.y);
  await page.waitForTimeout(250);
  const toSource = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    return { view: c.view, label: document.querySelector('[data-faces-pill]').textContent.trim(), open: c.facesOpen }; });
  ok('the faces pill opens its panel, and Raw · after is the Source view, named on the pill', toSource.view === 'source' && toSource.label === 'Raw · after' && !toSource.open, JSON.stringify(toSource));
  await page.setViewportSize({ width: 1024, height: PHONE.height });
  await page.waitForTimeout(200);
  const wide = await page.evaluate(() => { const head = document.querySelector('[x-data="dictate"] > div'), vis = (el) => !!el && el.getClientRects().length > 0;
    return { name: head.querySelector('a[href*="github.com"]').innerText.trim(), faceBtn: [...head.querySelectorAll('.ph-eye, .ph-code')].some(vis) }; });
  await page.setViewportSize(PHONE);
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.setFace('changes'); });
  await page.waitForTimeout(200);
  ok('with room, the header names the whole repo:path, and still has no face buttons',
    /:.+\//.test(wide.name) && !wide.faceBtn, JSON.stringify(wide));
  // The unsaved mark is also the way to clear every edit.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.d.text = c.text.replace('Third para.', 'Third para, edited.'); c.paint(); });
  await page.waitForTimeout(150);
  const dot = await page.evaluate(() => { const r = document.querySelector('[data-unsaved]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(dot.x, dot.y);
  await page.waitForTimeout(200);
  await page.locator('text=Clear all edits >> visible=true').first().click();
  await page.waitForTimeout(600);
  const cleared = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; return { text: c.text, dirty: c.dirty }; });
  ok('the unsaved dot offers Clear all edits, which puts the file back as GitHub holds it', cleared.text === PARA_DOC && !cleared.dirty, JSON.stringify(cleared));
  // The bar follows the caret: in a card it shows there, with Info saying
  // what the change was; outside every card there is none.
  const info = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.text = c.text.replace('Third para.', 'Third para, rewritten.'); c.paint();
    c.d.caretAt(c.text.indexOf('rewritten')); c.paint();
    await new Promise((r) => setTimeout(r, 200));
    const b = [...document.querySelectorAll('[data-md-card-bar]')].find((x) => !x.classList.contains('invisible'));
    const inCard = !!b;
    b?.closest('[data-md-card]')?.querySelector('[data-md-card-badge]')?.click();
    await new Promise((r) => setTimeout(r, 150));
    const p = document.querySelector('[data-card-info]');
    const out = { inCard, open: !!p && p.getClientRects().length > 0, diff: !!p?.querySelector('[data-info-diff]'),
      noteField: !!p?.querySelector('[data-info-note]'), head: !!p?.querySelector('[data-info-sum], [data-info-kind]'),
      plainMarks: new Set([...c.$refs.layer.querySelectorAll('[data-fmt-mark]'), ...c.$refs.md.querySelectorAll('[data-fmt-mark]')]).size };
    c.cardInfo = null;
    c.d.caretAt(3); c.paint(); await new Promise((r) => setTimeout(r, 100));
    out.outside = ![...document.querySelectorAll('[data-md-card-bar]')].some((x) => !x.classList.contains('invisible'));
    c.d.undo(); c.paint();
    // A change the marks cannot show, bold added: Info names it and lights
    // exactly the markers, and says it is formatting only.
    c.d.text = c.text.replace('Third para.', 'Third **para**.'); c.paint();
    c.d.caretAt(c.d.text.indexOf('Third') + 2); c.paint();
    await new Promise((r) => setTimeout(r, 200));
    // And the card says so in place: a dotted underline under the word the
    // markers now wrap, and under nothing else.
    // The word the markers make is one element, so the underline is its own
    // decoration, which moves with the text; nothing is drawn over it.
    const um = [...new Set([...c.$refs.md.querySelectorAll('[data-fmt-mark]'), ...c.$refs.layer.querySelectorAll('[data-fmt-mark]')])];
    const pa = c.d.text.indexOf('**para**') + 2, wr = window.MdSurface.rects(c.$refs.md, pa, pa + 4)[0];
    const ub = um[0] && um[0].getBoundingClientRect(), cs = um[0] && getComputedStyle(um[0]);
    // Text that moves after the paint, as a late style moved it on a desk,
    // takes the underline with it: nothing is repainted here.
    c.$refs.md.style.letterSpacing = '3px'; await new Promise((r) => setTimeout(r, 60));
    const moved = um[0] && (() => { const a = um[0].getBoundingClientRect(), w = window.MdSurface.rects(c.$refs.md, pa, pa + 4)[0];
      return Math.abs(a.left - w.left) < 2 && Math.abs(a.width - w.width) < 2 && Math.abs(a.width - ub.width) > 4; })();
    c.$refs.md.style.letterSpacing = '';
    const under = { n: um.length, moved, own: !!um[0] && c.$refs.md.contains(um[0]), style: cs && cs.textDecorationStyle,
      fits: um.length === 1 && Math.abs(ub.left - wr.left) < 2 && Math.abs(ub.width - wr.width) < 2 && cs.textDecorationLine.includes('underline') && cs.textDecorationStyle === 'dotted' };
    [...document.querySelectorAll('[data-md-card-bar]')].find((x) => !x.classList.contains('invisible'))?.closest('[data-md-card]')?.querySelector('[data-md-card-badge]')?.click();
    await new Promise((r) => setTimeout(r, 150));
    out.fmt = { head: !!p.querySelector('[data-info-sum], [data-info-kind]'),
      w: Math.round(p.getBoundingClientRect().width),
      pinned: !!(c.cardInfo && c.cardInfo.pinned), buttons: [...p.querySelectorAll('button')].filter((b) => getComputedStyle(b).visibility !== 'hidden').length, under };
    // No ✕, by the owner's choice: Escape puts it away, and so does a press
    // anywhere outside it. A note's trash is the one button the panel shows,
    // and only while there is a note; this card has none, so its trash is
    // held hidden and is not counted.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    out.fmt.escaped = c.cardInfo === null;
    [...document.querySelectorAll('[data-md-card-bar]')].find((x) => !x.classList.contains('invisible'))?.closest('[data-md-card]')?.querySelector('[data-md-card-badge]')?.click();
    await new Promise((r) => setTimeout(r, 150));
    const reopened = !!c.cardInfo;
    document.querySelector('header, [data-dictate-ui]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    out.fmt.pressedAway = reopened && c.cardInfo === null;
    c.cardInfo = null; c.d.undo(); c.paint();
    return out;
  });
  ok('with the caret in a card, the bar shows, and Info is the note field alone, with no line and no diff; outside every card, no bar',
    info.inCard && info.open && !info.diff && info.noteField && !info.head && info.outside, JSON.stringify(info));
  ok('a change the marks cannot show, bold added, has the same Info, the note alone, across the screen\'s width; clicked, it is pinned with no ✕ or any button, and Escape or a press outside puts it away',
    !info.fmt.head && info.fmt.pinned && info.fmt.buttons === 0 && info.fmt.w >= 340 && info.fmt.escaped && info.fmt.pressedAway, JSON.stringify(info.fmt));
  ok('and in the card, bold added gives exactly the word a dotted underline of its own, which stays with the word when the text moves after the paint, while a change of words gets none',
    info.fmt.under.fits && info.fmt.under.moved && info.plainMarks === 0, JSON.stringify({ under: info.fmt.under, plainMarks: info.plainMarks }));
  // AN UNDERLINE, TAPPED, OFFERS THE RAW CHANGE AND ITS UNDO, as a mark does.
  const tapUnder = async (from, to, nth = 0) => {
    const at = await page.evaluate(async ([from, to, nth]) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
      c.$refs.view.scrollTop = 0; c.d.text = c.text.replace(from, to); c.d.caretAt(0); c.paint();
      await new Promise((r) => setTimeout(r, 250));
      // By the hits, in order, each at the middle of its words' first box.
      const h = (c._fmtHits || [])[nth];
      if (!h) return { dbg: { cards: c.$refs.md.querySelectorAll('[data-md-card]').length, hits: c._fmtHits } };
      const r = window.MdSurface.rects(c.$refs.md, h.u[0], h.u[1])[0]; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [from, to, nth]);
    if (!at || at.dbg) return { missing: true, dbg: at && at.dbg };
    await page.touchscreen.tap(at.x, at.y); await page.waitForTimeout(350);
    const pop = await page.evaluate(() => { const p = document.querySelector('[data-word-pop]'); if (!p || !p.getClientRects().length) return null;
      const lit = (sel) => [...p.querySelectorAll(sel + ' .rounded-sm')].map((s) => s.textContent).join('|');
      const b = p.querySelector('button').getBoundingClientRect();
      const chg = (k) => [...p.querySelectorAll('[data-pop-raw] [data-chg="' + k + '"]')].map((s) => s.textContent).join('|');
      return { raw: p.querySelector('[data-pop-raw]')?.textContent, add: chg('add'), del: chg('del'), labels: /was|now|added/.test(p.textContent.replace(p.querySelector('[data-pop-raw]')?.textContent || '', '')),
               btn: { x: b.left + b.width / 2, y: b.top + b.height / 2 } }; });
    if (pop) { await page.touchscreen.tap(pop.btn.x, pop.btn.y); await page.waitForTimeout(250); }
    return { pop, text: await docText() };
  };
  await reset();
  const boldU = await tapUnder('Third para.', 'Third **para**.');
  ok('a tap on an underline opens its pop: the line of raw markdown with the added markers lit green, no labels, and Undo restores GitHub\'s text',
    boldU.pop && boldU.pop.raw.includes('Third **para**.') && boldU.pop.add === '**|**' && !boldU.pop.del && !boldU.pop.labels && boldU.text === PARA_DOC, JSON.stringify(boldU));
  await reset();
  // A doubled space alone makes no card (the words and the rendering are
  // unchanged), so it is checked inside a card that bold made.
  const spaceU = await tapUnder('Second para.', '**Second**  para.', 0);
  ok('and a doubled space in a card the same: underlined, the added space shown as a green dot, and undone exactly, the bold beside it kept',
    spaceU.pop && spaceU.pop.add === '·' && spaceU.pop.raw.includes('**Second** ·para.') && spaceU.text === PARA_DOC.replace('Second para.', '**Second** para.'), JSON.stringify(spaceU));
  await reset();
  // HOVER OPENS INFO, where there is hover: unpinned, so with no ✕, and it
  // goes when the mouse is demonstrably elsewhere (kits/panel-tip.js).
  const infoBtn = await page.evaluate(async () => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.$refs.view.scrollTop = 0; c.d.text = c.text.replace('Third para.', 'Third para, rewritten.'); c.d.caretAt(c.d.text.indexOf('rewritten')); c.paint();
    await new Promise((r) => setTimeout(r, 250));
    const b = [...document.querySelectorAll('[data-md-card-bar]')].find((x) => !x.classList.contains('invisible'))?.closest('[data-md-card]')?.querySelector('[data-md-card-badge]');
    const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const infoNow = () => page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const x = document.querySelector('[data-card-info] [data-wt-panel-tip-close]');
    return { open: !!c.cardInfo, pinned: !!(c.cardInfo && c.cardInfo.pinned), ghost: !!x && x.getClientRects().length > 0 }; });
  // This browser has touch emulated and so reports no hover; the check is of
  // what the page does where there is hover.
  await page.evaluate(() => { window._mm = window.matchMedia;
    window.matchMedia = (q) => /hover:\s*none/.test(q) ? { matches: false } : /hover:\s*hover/.test(q) ? { matches: true } : window._mm(q); });
  await page.mouse.move(infoBtn.x, infoBtn.y); await page.waitForTimeout(400);
  const hovered = await infoNow();
  await page.mouse.move(5, 5); await page.mouse.move(8, 400); await page.waitForTimeout(500);
  const left = await infoNow();
  ok("a mouse resting on a card's number opens its Info unpinned, with no ✕, and moving well away closes it", hovered.open && !hovered.pinned && !hovered.ghost && !left.open, JSON.stringify({ hovered, left }));
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; window.matchMedia = window._mm; c.cardInfo = null; c.d.undo(); c.paint(); });
  // The Changes face is retired; what it alone had, the count and a step
  // between changes, sits in the Rendered face's corner.
  const jump = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], vis = (el) => !!el && el.getClientRects().length > 0;
    await new Promise((r) => setTimeout(r, 150));   // the counter hides on Alpine's next render
    const pill = document.querySelector('[data-jump]'), none = vis(pill);
    c.d.text = c.text.replace('First one.', 'First once.').replace('Third para.', 'Third paragraph.'); c.paint();
    await new Promise((r) => setTimeout(r, 200));
    const shown = vis(pill), label = pill.querySelector('span').textContent.replace(/\s+/g, ' ').trim();
    c.jumpCard(1); c.jumpCard(-1);
    c.d.undo(); c.paint(); await new Promise((r) => setTimeout(r, 200));
    return { none, shown, label, after: vis(pill), changesFace: !!document.querySelector('[x-data="dictate"] > div').querySelector('.ph-git-diff') };
  });
  ok('with two changes the corner counts them and steps between them, and with none it is gone; no Changes face remains',
    !jump.none && jump.shown && jump.label === '2 changes' && !jump.after && !jump.changesFace, JSON.stringify(jump));
  // From the top: the check before this one scrolled the pane down.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.$refs.view.scrollTop = 0; c.toggleNativeSel(); });
  await page.waitForTimeout(150);
  const nat = await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md;
    const us = (el) => { const cs = getComputedStyle(el); return cs.webkitUserSelect || cs.userSelect; };
    return { on: c.native, attr: md.hasAttribute('data-native-sel'), p: us(md.querySelector('p')) };
  });
  const fileTarget = await page.evaluate(() => {
    const vis = (el) => el && el.getClientRects().length > 0;
    const t = [...document.querySelectorAll('[data-dictate-ui] button:has(i.ph-crosshair), [data-target]')].filter(vis);
    const b = document.querySelector('[data-target]').getBoundingClientRect();
    return { shown: t.length, bottom: b.top > innerHeight / 2, centre: Math.abs(b.left + b.width / 2 - innerWidth / 2) };
  });
  ok('in file mode the one target is in the bottom row, on the centre line', fileTarget.shown === 1 && fileTarget.bottom && fileTarget.centre < 4, JSON.stringify(fileTarget));
  ok('the option makes the rendered words selectable by the platform', nat.on && nat.attr && nat.p === 'text', JSON.stringify(nat));
  const synced = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md;
    const a = c.text.indexOf('First two.'), b = a + 'First two.'.length;
    const p = window.MdSurface.domPoint(md, a), q = window.MdSurface.domPoint(md, b);
    document.getSelection().setBaseAndExtent(p.node, p.offset, q.node, q.offset);
    await new Promise((r) => setTimeout(r, 100));
    return { range: c.d.range, a, b, painted: !!document.querySelector('[data-md-surface="sel"]'),
             pins: !!document.querySelector('[data-edge]'), move: !!document.querySelector('[data-target] i.ph-arrows-out-cardinal') };
  });
  ok('the platform\'s selection becomes the buffer\'s range', synced.range && synced.range.start === synced.a && synced.range.end === synced.b, JSON.stringify(synced));
  ok('and the page paints no selection or pins of its own, and the target offers Move', !synced.painted && !synced.pins && synced.move, JSON.stringify(synced));
  // The target, tapped, holds the words; a tap in the gap below the first
  // paragraph then lands them as a paragraph of their own.
  const tgt = await page.evaluate(() => { const r = document.querySelector('[data-target]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(tgt.x, tgt.y);
  await page.waitForTimeout(150);
  const heldArm = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    return { arm: c.moveArm, wash: !!document.querySelector('[data-seam].bg-primary\\/25'), lit: document.querySelector('[data-target]').classList.contains('btn-primary') }; });
  ok('the target holds the words, keeps them washed, and lights', !!heldArm.arm && heldArm.wash && heldArm.lit, JSON.stringify(heldArm));
  const label = await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const k = window.MdSurface.rectAt(c.$refs.md, c.d.range.start);
    const w = [...document.querySelectorAll('[data-seam].ph-caret-down, [data-seam].ph-caret-up')].map((n) => n.getBoundingClientRect());
    const t = document.querySelector('[data-move-here]')?.getBoundingClientRect();
    return { cancel: document.querySelector('[data-move-cancel]').getClientRects().length > 0,
      wedges: w.length, aligned: w.every((r) => Math.abs(r.left + r.width / 2 - k.left) < 3),
      above: w.some((r) => r.bottom <= k.top + 2), below: w.some((r) => r.top >= k.bottom - 2),
      tag: !!t && Math.abs(t.left + t.width / 2 - k.left) < 60 && (t.top > k.bottom || t.bottom < k.top) };
  });
  ok('held, yellow wedges point at the caret from above and below, a Move here tag sits by it, and a cancel shows',
    label.cancel && label.wedges === 2 && label.aligned && label.above && label.below && label.tag, JSON.stringify(label));
  // A tap on the text aims and lands nothing; Move here lands them. A tap in
  // the gap below the first paragraph makes them a paragraph of their own.
  const gN = await seamBelow('First one');
  await page.touchscreen.tap(gN.x, gN.y);
  await page.waitForTimeout(200);
  const aimOnly = await page.evaluate(() => ({ text: document.querySelector('[x-data="dictate"]')._x_dataStack[0].text, line: !!document.querySelector('[data-move]') }));
  ok('a tap on the text while words are held aims them, shows the drop line, and moves nothing', aimOnly.text === PARA_DOC && aimOnly.line, JSON.stringify(aimOnly));
  const tgt2 = await page.evaluate(() => { const r = document.querySelector('[data-move-here]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(tgt2.x, tgt2.y);
  await page.waitForTimeout(200);
  ok('and the Move here tag drops them there', (await docText()).includes('First one.\n\nFirst two.\n\nSecond para.'), JSON.stringify(await docText()));
  // A range the page sets is written into the platform's selection.
  const reflected = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('Second para.'); c.d.select(a, a + 12); c.paint();
    await new Promise((r) => setTimeout(r, 50));
    return document.getSelection().toString();
  });
  ok('a range set by the page shows as the platform\'s selection', reflected === 'Second para.', JSON.stringify(reflected));
  // The Rendered face's caret pulses, as the Source face's always has.
  const pulse = await page.evaluate(async () => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.d.caretAt(3); c.paint(); await new Promise((r) => setTimeout(r, 50));
    const k = document.querySelector('[data-md-surface="caret"]'); return k && getComputedStyle(k).animationName; });
  ok('the rendered caret pulses', pulse === 'dictate-caret', JSON.stringify(pulse));
  // A long press is the platform's: the page takes no word and moves nothing.
  await reset();
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.d.caretAt(3); c.paint(); });
  const lp = await rectOf('Second para.', 2);
  await touch('pointerdown', lp.x, lp.y);
  await page.waitForTimeout(550);
  await touch('pointerup', lp.x, lp.y);
  await page.waitForTimeout(150);
  const afterLp = await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].d.range);
  ok('a long press is left to the platform: no word taken, the caret stays', afterLp && afterLp.start === 3 && afterLp.end === 3, JSON.stringify(afterLp));
  // A press on a selection's end is on the platform's handle, not a tap.
  const edge = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('Third'); c.d.select(a, a + 5); c.paint();
    const r = [...document.getSelection().getRangeAt(0).getClientRects()].filter((x) => x.width)[0];
    return { x: r.left + 2, y: r.top - 8, a }; });
  await page.touchscreen.tap(edge.x, edge.y);
  await page.waitForTimeout(350);
  const afterEdge = await page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].d.range);
  ok('a press on the start handle is the platform\'s: the range stands', afterEdge && afterEdge.start === edge.a && afterEdge.end === edge.a + 5, JSON.stringify(afterEdge));
  // A tap is still the page's: it places the caret and clears the selection.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('Third'); c.d.select(a, a + 5); c.paint(); });
  const tp = await rectOf('Second para.', 3);
  await page.touchscreen.tap(tp.x, tp.y);
  await page.waitForTimeout(350);
  const afterTap = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    return { r: c.d.range, want: c.text.indexOf('Second para.') + 3, sel: document.getSelection().toString() }; });
  ok('a tap places the caret and the platform\'s selection goes', afterTap.r && afterTap.r.start === afterTap.r.end
    && Math.abs(afterTap.r.start - afterTap.want) <= 1 && !afterTap.sel, JSON.stringify(afterTap));
  // Found by review, 2026-09-27.
  console.log('native selection, review:');
  // A selection ending in the gap between two paragraphs ends at the first
  // one's last word, and takes nothing of the next.
  await reset();
  const gapEnd = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md;
    const a = c.text.indexOf('First two'), p = window.MdSurface.domPoint(md, a, 'start');
    const next = [...md.querySelectorAll('p')].find((x) => x.textContent.startsWith('Second'));
    document.getSelection().setBaseAndExtent(p.node, p.offset, next, 0);
    await new Promise((r) => setTimeout(r, 100));
    return { got: c.text.slice(c.d.range.start, c.d.range.end) };
  });
  ok('a selection ending in the gap below a paragraph takes nothing of the next', gapEnd.got === 'First two.', JSON.stringify(gapEnd));
  // The H key twice on a selection makes an h3, as it does without the
  // option: the range it leaves on the marker is not widened on the way back.
  await reset();
  const h2 = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md;
    const a = c.text.indexOf('Second para.'), p = window.MdSurface.domPoint(md, a, 'start'), q = window.MdSurface.domPoint(md, a + 12, 'end');
    document.getSelection().setBaseAndExtent(p.node, p.offset, q.node, q.offset);
    await new Promise((r) => setTimeout(r, 100));
    c.format('H'); await new Promise((r) => setTimeout(r, 100));
    c.format('H'); await new Promise((r) => setTimeout(r, 100));
    return c.text;
  });
  ok('H twice on a native selection makes an h3 and touches nothing else', h2.includes('\n\n### Second para.\n\n') && h2.startsWith('# Title\n\nFirst one. First two.'), JSON.stringify(h2));
  // Words held for Move are let go when the text changes under them.
  await reset();
  const stale = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('First two'); c.d.select(a, a + 9); c.paint();
    c.padTap();
    const armed = !!c.moveArm;
    c.d.text = 'Inserted. ' + c.text; await new Promise((r) => setTimeout(r, 50));
    return { armed, after: c.moveArm, wash: !!document.querySelector('[data-seam].bg-primary\\/25') };
  });
  ok('an edit lets go of words held for Move', stale.armed && !stale.after && !stale.wash, JSON.stringify(stale));
  // The target aims too: held words go where the caret is when it is tapped
  // again, and tapped twice without aiming they stay where they were.
  await reset();
  const aimed = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint();
    c.padTap(); c.d.caretAt(c.text.indexOf('Third para.') + 11); c.paint(); c.padTap();
    await new Promise((r) => setTimeout(r, 50));
    const moved = c.text;
    c.d.undo(); c.paint();
    const b = c.text.indexOf('First two.'); c.d.select(b, b + 10); c.paint();
    c.padTap(); c.padTap();
    return { moved, stayed: c.text };
  });
  ok('the target drops held words at the caret it aimed', aimed.moved.includes('Third para. First two.') && aimed.moved.includes('First one.\n\nSecond'), JSON.stringify(aimed.moved));
  ok('and two taps without aiming leave them where they were', aimed.stayed === PARA_DOC, JSON.stringify(aimed.stayed));
  // THE PLATFORM'S OWN DRAG: a drop on the Rendered face moves the dragged
  // words there. Synthetic drag events stand in for the phone's lift.
  await reset();
  const dnd = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md;
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint();
    const dt = new DataTransfer(); dt.setData('text/plain', 'First two.');
    const s = window.MdSurface.seams(md).find((x) => x.a.el.textContent.startsWith('Second'));
    const r = md.getBoundingClientRect(), y = (s.top + s.bottom) / 2, x = r.left + r.width / 2;
    const fire = (type) => md.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    fire('dragstart');
    const over = !fire('dragover');
    const marker = !!document.querySelector('[data-move]');
    const L = document.querySelector('[data-drop-loupe]'), lc = L && L.querySelector('[data-lens-caret]')?.getBoundingClientRect();
    const loupe = { text: L ? L.textContent : '', line: !!lc && lc.width > lc.height, off: !!(L && L.querySelector('[data-md-off]')) };
    fire('drop'); fire('dragend');
    await new Promise((r) => setTimeout(r, 50));
    return { over, marker, loupe, text: c.text };
  });
  ok('a native drag over the text is taken, with the drop marker shown', dnd.over && dnd.marker, JSON.stringify(dnd));
  ok('and a loupe above the thumb shows the text there, with a line across the gap', /Second para/.test(dnd.loupe.text) && dnd.loupe.line, JSON.stringify(dnd.loupe));
  // The loupe's caret sits on the drop point in its copy of the text, even
  // below a card whose hidden original is taller than what shows. Reported
  // from the phone: the lens ran half a line off, because the copy was
  // assumed to lay out as the page does.
  await reset();
  const lensAt = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md;
    c.$refs.view.scrollTop = 0;
    c.d.text = '# Title\n\nFirst one. First two. Second para.\n\nThird para.\n'; c.paint();
    await new Promise((r) => setTimeout(r, 200));
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint();
    const at = c.text.indexOf('para.', c.text.indexOf('Third'));
    const r = window.MdSurface.rectAt(md, at);
    const dt = new DataTransfer(); dt.setData('text/plain', 'x');
    const fire = (type) => md.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 1, clientY: r.top + r.height / 2 }));
    fire('dragstart'); fire('dragover');
    // Measured after the styles have had frames to land, and against the
    // text too, not only against the measurement that placed it.
    await new Promise((r) => setTimeout(r, 300));
    const L = document.querySelector('[data-lens]');
    const k = L.querySelector('[data-lens-caret]').getBoundingClientRect();
    const p = c.copyCaret(L.querySelector('[data-lens-text]'), c.dnd.target.at);
    fire('dragend');
    return { dx: Math.round(p.left - (k.left + k.width / 2)), dy: Math.round((p.top + p.bottom) / 2 - (k.top + k.bottom) / 2) };
  });
  ok('the loupe\'s caret sits on the drop point in its copy, below a card with a taller original', Math.abs(lensAt.dx) <= 3 && Math.abs(lensAt.dy) <= 3, JSON.stringify(lensAt));
  // While words are held, nothing else may take a drag: the sheet an iPhone
  // presents the page in closes on one. A touch on the text cancels its start
  // and its moves; a touch on a control keeps its start (so its tap lands)
  // and loses its moves. Without words held, the text scrolls as ever.
  await reset();
  const sheet = await page.evaluate(() => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md;
    const word = md.querySelector('p span[data-src]'), key = document.querySelector('[data-dictate-ui] button:has(i.ph-clipboard-text)');
    const fire = (el, type) => { const r = el.getBoundingClientRect();
      const t = new Touch({ identifier: 7, target: el, clientX: r.left + 2, clientY: r.top + 2 });
      return !el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
    const probe = (el) => { const start = fire(el, 'touchstart'), move = fire(el, 'touchmove'); fire(el, 'touchend'); return { start, move }; };
    const idle = probe(word);
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint(); c.padTap();
    const text = probe(word), control = probe(key);
    c.padTap();
    return { idle, text, control };
  });
  ok('while words are held, a drag on the text is held from the page: start and moves cancelled', sheet.text.start && sheet.text.move, JSON.stringify(sheet));
  ok('a control keeps its tap but not its drag, and without words held nothing is cancelled',
    !sheet.control.start && sheet.control.move && !sheet.idle.start && !sheet.idle.move, JSON.stringify(sheet));
  // The cancel leaves held words where they were, still selected.
  await reset();
  const cancelled = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint(); c.padTap();
    c.d.caretAt(c.text.indexOf('Third para.')); c.paint();
    await new Promise((r) => setTimeout(r, 100));
    document.querySelector('[data-move-cancel]').click();
    await new Promise((r) => setTimeout(r, 100));
    return { held: !!c.moveArm, text: c.text, sel: c.text.slice(c.d.range.start, c.d.range.end),
             label: !!document.querySelector('[data-move-here]') };
  });
  ok('the cancel lets go of held words where they were, still selected', !cancelled.held && cancelled.text === PARA_DOC
    && cancelled.sel === 'First two.' && !cancelled.label, JSON.stringify(cancelled));
  // While words are held, a finger dragged on the text moves the caret in
  // parallel, as the target's own drag does, with no loupe (the finger is not
  // over the caret), and drops nothing.
  await reset();
  const pre = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.$refs.view.scrollTop = 0;
    const a = c.text.indexOf('First two.'); c.d.select(a, a + 10); c.paint(); c.padTap();
    const r = window.MdSurface.rectAt(c.$refs.md, c.text.indexOf('Third para.') + 2);
    return { x: r.left, y: r.top + r.height / 2, caret: c.d.range.start }; });
  await touch('pointerdown', pre.x, pre.y);
  for (let k = 1; k <= 6; k++) await touch('pointermove', pre.x + k * 12, pre.y - k * 10);
  const midLens = await page.evaluate(() => !!document.querySelector('[data-drop-loupe]'));
  await touch('pointerup', pre.x + 72, pre.y - 60);
  await page.waitForTimeout(150);
  const surfPad = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    return { caret: c.d.range.start, collapsed: c.d.range.start === c.d.range.end, held: !!c.moveArm, text: c.text,
             lensAfter: !!document.querySelector('[data-drop-loupe]') }; });
  ok('a drag on the text while words are held moves the caret and drops nothing',
    surfPad.held && surfPad.collapsed && surfPad.caret !== pre.caret && surfPad.text === PARA_DOC, JSON.stringify({ ...surfPad, was: pre.caret }));
  ok('and no loupe covers the view while it aims', !midLens && !surfPad.lensAfter, JSON.stringify({ midLens, lensAfter: surfPad.lensAfter }));
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.padTap(); });
  ok('and the drop moves the words, here onto a gap as their own paragraph', dnd.text.includes('Second para.\n\nFirst two.\n\nThird para.'), JSON.stringify(dnd.text));
  // The platform letting go without a tap does not leave a live range with
  // no highlight: it is written back.
  await reset();
  const dropped = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf('Second para.'); c.d.select(a, a + 12); c.paint();
    await new Promise((r) => setTimeout(r, 50));
    document.getSelection().removeAllRanges();
    await new Promise((r) => setTimeout(r, 100));
    return { sel: document.getSelection().toString(), r: c.text.slice(c.d.range.start, c.d.range.end) };
  });
  ok('a selection the platform drops without a tap is shown again, not kept invisible', dropped.sel === 'Second para.' && dropped.r === 'Second para.', JSON.stringify(dropped));
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.toggleNativeSel(); });
  const offAgain = await page.evaluate(() => document.querySelector('[x-ref="md"]').hasAttribute('data-native-sel'));
  ok('turning the option off gives the words back to the page', !offAgain);

  // ── A card's readings are a snap track ──────────────────────────────
  // The text follows the finger and the platform settles it on a reading,
  // as the Changes view does. The page no longer reads a swipe off how far a
  // release landed from its press, which is how a selection handle dragged
  // sideways across a card turned it over.
  {
  // A DESK: a mouse that hovers. The upper keys are not drawn (the keyboard
  // types them), Copy, the target and Send stay, and the formats are chords.
  console.log('desk and shortcuts:');
  await reset();
  const C = () => document.querySelector('[x-data="dictate"]')._x_dataStack[0];
  const desk = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const vis = (el) => !!el && el.getClientRects().length > 0;
    const dot = () => [...document.querySelectorAll('[data-dictate-ui] button')].find((b) => b.textContent.trim() === '.');
    const before = vis(dot());
    c.desk = true; await new Promise((r) => setTimeout(r, 100));
    const out = { before, after: vis(dot()), copy: vis([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Copy')),
                  target: vis(document.querySelector('[data-target]')), list: !!document.querySelector('[data-shortcuts]') };
    c.desk = false; await new Promise((r) => setTimeout(r, 100));
    return out;
  });
  ok('on a desk the upper keys and the target go, and Copy and Send stay', desk.before && !desk.after && desk.copy && !desk.target && desk.list, JSON.stringify(desk));
  const sel = (w) => page.evaluate((w) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const a = c.text.indexOf(w); c.d.select(a, a + w.length); c.paint(); document.activeElement?.blur?.(); }, w);
  const txt = () => page.evaluate(() => document.querySelector('[x-data="dictate"]')._x_dataStack[0].text);
  await sel('Second para.'); await page.keyboard.press('Control+b');
  const bold = await txt();
  await sel('Third para.'); await page.keyboard.press('Control+e');
  const code = await txt();
  ok('Ctrl+B bolds the selection and Ctrl+E makes it code', bold.includes('**Second para.**') && code.includes('`Third para.`'), JSON.stringify(code));
  await reset();
  await sel('Second para.'); await page.keyboard.press('Control+Alt+Digit3');
  const h3 = await txt();
  await sel('Second para.'); await page.keyboard.press('Control+Alt+Digit3');
  const h0 = await txt();
  await sel('Third para.'); await page.keyboard.press('Control+Shift+Digit8');
  const li = await txt();
  ok('Ctrl+Alt+3 makes an h3 and again clears it, and Ctrl+Shift+8 makes a list item',
    h3.includes('\n\n### Second para.\n\n') && h0.includes('\n\nSecond para.\n\n') && li.includes('\n\n- Third para.\n'), JSON.stringify({ h3, h0, li }));
  // Send itself fetches the account's repositories, which fails late here and
  // moves the page under the next section, so the chord is checked against a
  // stand-in for openSend rather than by opening the sheet.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c._realSend = c.openSend; c.openSend = () => { c._sent = true; }; });
  await page.keyboard.press('Control+Enter');
  const sent = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.openSend = c._realSend; return !!c._sent; });
  ok('and Ctrl+Enter opens Send', sent, String(sent));
  // A CARD FOR THE KEYS. A click beside a card's words takes the card with no
  // caret, so the arrows turn it; reported from a desk, where the caret in the
  // card walked the text and no key could swipe.
  await reset();
  const cardBox = await page.evaluate(async () => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.$refs.view.scrollTop = 0; c.d.text = c.text.replace('Second para.', 'Second paragraph here.'); c.d.caretAt(c.text.indexOf('Second') + 3); c.paint();
    await new Promise((r) => setTimeout(r, 250));
    const card = c.$refs.md.querySelector('[data-md-card]'), r = card.getBoundingClientRect();
    return { i: +card.dataset.mdCard, x: r.left + 3, y: r.top + r.height / 2 }; });
  const keyState = () => page.evaluate((i) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const card = c.$refs.md.querySelector('[data-md-card="' + i + '"]');
    const t = card && card.querySelector('[data-md-track]');
    return { key: c.keyCard, reading: window.MdSurface.readingOf(c.$refs.md, i), at: t && ['old', 'inline', 'new'][Math.round(t.scrollLeft / t.clientWidth)], caret: !!c.$refs.layer.querySelector('[data-md-surface="caret"]'),
             ring: !!card && /0\.828 0\.189/.test(getComputedStyle(card).borderTopColor) && getComputedStyle(card).boxShadow === 'none', typing: c.typing, text: c.text }; }, cardBox.i);
  await page.mouse.click(cardBox.x, cardBox.y);
  await page.waitForTimeout(250);
  const taken = await keyState();
  ok('on a desk a click beside a card\'s words takes the card, its own border amber and no ring outside it, with no caret', taken.key === cardBox.i && taken.ring && !taken.caret && !taken.typing, JSON.stringify(taken));
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(400);
  const kOld = await keyState();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
  const kNew = await keyState();
  await page.keyboard.press('x'); await page.waitForTimeout(100);
  const kTyped = await keyState();
  ok('and the arrows turn it: left to the original, right twice to the new text, and a letter types nothing',
    kOld.reading === 'old' && kOld.at === 'old' && kNew.reading === 'new' && kNew.at === 'new' && kNew.key === cardBox.i && kTyped.text === kNew.text,
    JSON.stringify({ kOld, kNew: { reading: kNew.reading, at: kNew.at, key: kNew.key }, same: kTyped.text === kNew.text }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const kEsc = await keyState();
  ok('Escape lets the card go and the caret comes back', kEsc.key === null && kEsc.caret && !kEsc.ring, JSON.stringify(kEsc));
  const onWords = await page.evaluate((i) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const r = window.MdSurface.rectAt(c.$refs.md, c.text.indexOf('paragraph here') + 2); return { x: r.left, y: r.top + r.height / 2 }; }, cardBox.i);
  await page.mouse.click(onWords.x, onWords.y); await page.waitForTimeout(200);
  const kWords = await keyState();
  ok('and a click on the words is an editor\'s click: a caret, no card taken', kWords.key === null && kWords.caret, JSON.stringify(kWords));
  // Put the card back on its marked reading, which outlives a reset.
  await page.evaluate((i) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; if (c.typing) c.stopTyping();
    window.MdSurface.setReading(c.$refs.md, i, 'inline'); c.paint(); }, cardBox.i);
  // A MARKED WORD, TAPPED, OFFERS ITS UNDO: struck or added alike, one pill,
  // one word. Reported from the phone: a struck word opened a panel with two
  // buttons, and an added word offered nothing short of the keyboard.
  console.log('mark undo:');
  const tapMarkAndUndo = async (edit, pick) => {
    await reset();
    await page.evaluate((edit) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
      c.$refs.view.scrollTop = 0; c.d.text = c.text.replace(edit[0], edit[1]); c.d.caretAt(0); c.paint(); }, edit);
    await page.waitForTimeout(250);
    const at = await page.evaluate((pick) => { const el = [...document.querySelectorAll('[x-ref="md"] ' + pick[0])].find((x) => x.textContent.includes(pick[1]));
      if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, pick);
    if (!at) return { missing: pick };
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(300);
    const pop = await page.evaluate(() => { const p = document.querySelector('[data-word-pop]'); if (!p || !p.getClientRects().length) return null;
      const chg = (k) => [...p.querySelectorAll('[data-pop-raw] [data-chg="' + k + '"]')].map((s) => s.textContent).join('|');
      return { btn: p.querySelector('button').textContent.trim(), raw: p.querySelector('[data-pop-raw]').textContent, add: chg('add'), del: chg('del') }; });
    const k = await page.evaluate(() => { const b = document.querySelector('[data-word-pop] button'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (k) await page.touchscreen.tap(k.x, k.y);
    await page.waitForTimeout(250);
    return { pop, text: await docText() };
  };
  const struck = await tapMarkAndUndo(['Second para.', 'Para.'], ['del', 'Second']);
  ok('a tap on struck words shows them struck red in the raw line (here beside the green that replaced them) with Undo, and Undo puts them back', struck.pop && struck.pop.btn === 'Undo' && struck.pop.del.includes('Second') && struck.text === PARA_DOC, JSON.stringify(struck));
  const addedW = await tapMarkAndUndo(['First two.', 'First extra two.'], ['ins', 'extra']);
  ok('a tap on added words shows them green in the raw line beside the same Undo, which takes them out, space and all', addedW.pop && addedW.pop.btn === 'Undo' && addedW.pop.add.includes('extra') && !addedW.pop.del && addedW.text === PARA_DOC, JSON.stringify(addedW));
  const repl = await tapMarkAndUndo(['Third para.', 'Third page.'], ['ins', 'page']);
  // A LONG CHANGE ON A PHONE, reported 2026-09-30: the pop, placed from the
  // middle of the screen, was squeezed to a column a word wide and printed
  // the whole insertion down the screen. It takes the width its line needs,
  // shortens a long change to its ends, and puts Undo under the line.
  const longPop = await (async () => {
    await reset();
    const at = await page.evaluate(async () => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
      c.$refs.view.scrollTop = 0;
      c.d.text = c.text.replace('Second para.', 'Second read the situation the skill answers, a constraint or an opportunity, stating the forces either way.'); c.d.caretAt(0); c.paint();
      await new Promise((r) => setTimeout(r, 250));
      const el = [...c.$refs.md.querySelectorAll('ins')].find((x) => x.textContent.includes('constraint')); if (!el) return null;
      const r = el.getClientRects()[0]; return { x: r.left + Math.min(r.width / 2, 60), y: r.top + r.height / 2 }; });
    if (!at) return null;
    await page.touchscreen.tap(at.x, at.y); await page.waitForTimeout(350);
    return page.evaluate(() => { const p = document.querySelector('[data-word-pop]'); if (!p || !p.getClientRects().length) return null;
      const r = p.getBoundingClientRect(), code = p.querySelector('[data-pop-raw]').getBoundingClientRect(), b = p.querySelector('button').getBoundingClientRect();
      return { w: Math.round(r.width), vw: innerWidth, lines: Math.round(code.height / 20), below: b.top >= code.bottom - 1, inView: r.left >= 0 && r.right <= innerWidth,
               cut: p.querySelector('[data-pop-raw]').textContent.includes(' … ') }; });
  })();
  ok('on a phone a long change\'s pop takes the width it needs, shortens the change to its ends, stays on screen, and puts Undo under the line',
    !!longPop && longPop.w >= 0.75 * (longPop.vw - 16) && longPop.lines <= 5 && longPop.below && longPop.inView && longPop.cut, JSON.stringify(longPop));
  await reset();
  ok('a replacement shows red and green together, and Undo on either half undoes the whole of it', repl.pop && repl.pop.btn === 'Undo' && repl.pop.del && repl.pop.add && repl.text === PARA_DOC, JSON.stringify(repl));
  // A mark that wraps has a box per line: the pill goes under the line tapped,
  // not under the union of them, whose centre was a line away on the phone.
  await reset();
  const wrapAt = await page.evaluate(async () => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.$refs.view.scrollTop = 0; c.d.text = c.text.replace('First two.', 'First two and then a good many more words added here so it wraps.'); c.d.caretAt(0); c.paint();
    await new Promise((r) => setTimeout(r, 200));
    const el = [...c.$refs.md.querySelectorAll('ins')].find((x) => x.getClientRects().length > 1);
    if (!el) return null; const q = el.getClientRects()[0];
    return { x: q.left + Math.min(q.width / 2, 20), y: q.top + q.height / 2, bottom: q.bottom, lines: el.getClientRects().length }; });
  if (wrapAt) { await page.touchscreen.tap(wrapAt.x, wrapAt.y); await page.waitForTimeout(400); }
  // The pop is as wide as its line of source and slides inward near an
  // edge, so the check is that it sits just under the tapped line and spans
  // the finger, not that its centre is exactly there.
  const wrapPop = wrapAt && await page.evaluate(() => { const p = document.querySelector('[data-word-pop]'), b = p && p.querySelector('button'); if (!b || !p.getClientRects().length) return null;
    const r = p.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bg: getComputedStyle(b).backgroundColor }; });
  ok('on a mark that wraps, the pop sits under the line tapped, across the finger, and its Undo wears the action blue',
    !!wrapPop && wrapPop.top >= wrapAt.bottom && wrapPop.top - wrapAt.bottom < 16 && wrapPop.left <= wrapAt.x && wrapPop.right >= wrapAt.x && !/255, 255, 255/.test(wrapPop.bg),
    JSON.stringify({ wrapAt, wrapPop }));
  // THE FIVE FACES: the pill names the face on screen, green while the text
  // differs from GitHub's; the before faces show GitHub's copy and nothing to
  // edit, and the text changing under one brings the text now back.
  await reset();
  const faces = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], vis = (el) => !!el && el.getClientRects().length > 0;
    const pill = () => document.querySelector('[data-faces-pill]'), wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await c.setFace('raw-after'); await wait(150);
    const clean = { label: pill().textContent.trim(), green: /emerald/.test(pill().className) };
    c.d.text = c.text.replace('Third para.', 'Third paragraph.'); c.paint(); await wait(150);
    const edited = { label: pill().textContent.trim(), green: /emerald/.test(pill().className) };
    await c.setFace('rendered-before'); await wait(150);
    const rb = { shown: vis(document.querySelector('[data-before="rendered"]')), old: document.querySelector('[data-before="rendered"]').textContent.includes('Third para.'),
                 md: vis(c.$refs.md), jump: vis(document.querySelector('[data-jump]')), label: pill().textContent.trim() };
    await c.setFace('raw-before'); await wait(150);
    const raw = { text: document.querySelector('[data-before="raw"]').textContent === c.fileBase, body: vis(c.$refs.body) };
    c.d.text = c.text.replace('Third paragraph.', 'Third paragraph, again.'); c.paint(); await wait(150);
    const back = { before: c.before, face: c.face };
    await c.setFace('rendered-after'); await wait(150);
    const plain = { cards: c.$refs.md.querySelectorAll('[data-md-card]').length, marks: c.showMarks };
    await c.setFace('changes'); await wait(200);
    const changes = { cards: c.$refs.md.querySelectorAll('[data-md-card]').length };
    c.d.text = c.fileBase; c.paint();
    return { clean, edited, rb, raw, back, plain, changes };
  });
  ok('the faces pill names the face, green with edits; before shows GitHub\'s copy alone, an edit brings the text back, and Changes and Rendered · after are the cards on and off',
    faces.clean.label === 'Raw · after' && !faces.clean.green && faces.edited.green
    && faces.rb.shown && faces.rb.old && !faces.rb.md && !faces.rb.jump && faces.rb.label === 'Rendered · before'
    && faces.raw.text && !faces.raw.body && faces.back.before === null && faces.back.face === 'raw-after'
    && faces.plain.cards === 0 && !faces.plain.marks && faces.changes.cards > 0, JSON.stringify(faces));
  // RAW · CHANGES: the same cards, each block drawn as its markdown source, so
  // a heading reads with its hashes; typing there is literal, Enter one
  // newline where the render's Enter makes a paragraph.
  await reset();
  const rawFace = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const cards = () => c.$refs.md.querySelectorAll('[data-md-card]').length;
    c.d.text = c.text.replace('Third para.', 'Third para, edited.'); c.paint(); await wait(150);
    const rendered = { cards: cards(), hashes: c.$refs.md.textContent.includes('# Title') };
    await c.setFace('raw-changes'); await wait(250);
    const raw = { face: c.face, label: document.querySelector('[data-faces-pill]').textContent.trim(), cards: cards(),
                  blocks: c.$refs.md.querySelectorAll('[data-md-raw]').length, hashes: c.$refs.md.textContent.includes('# Title'),
                  cell: !!document.querySelector('[data-face="raw-changes"]') && !!document.querySelector('[data-face="changes"]') };
    const enter = (at) => { c.d.caretAt(at); c.sinkBefore({ inputType: 'insertParagraph', preventDefault() {} }); return c.text; };
    const t0 = c.text, at = t0.indexOf('First one.') + 'First one.'.length;
    const rawEnter = enter(at).slice(at, at + 3);
    c.d.text = t0; c.paint(); await wait(100);
    const bs = t0.indexOf('Second para.');
    c.d.caretAt(bs); c.sinkBefore({ inputType: 'deleteContentBackward', preventDefault() {} });
    const rawBack = c.text.slice(bs - 3, bs + 2);
    c.d.text = t0; c.paint(); await wait(100);
    await c.setFace('changes'); await wait(200);
    const renEnter = enter(at).slice(at, at + 3);
    c.d.text = c.fileBase; c.paint();
    return { rendered, raw, rawEnter, rawBack, renEnter };
  });
  ok('Raw · changes draws the same cards over the markdown source, a heading with its hashes, and is a cell of the grid beside Changes',
    rawFace.raw.face === 'raw-changes' && rawFace.raw.label === 'Raw · changes' && rawFace.raw.cards === rawFace.rendered.cards && rawFace.raw.cards > 0
    && rawFace.raw.blocks > 0 && rawFace.raw.hashes && !rawFace.rendered.hashes && rawFace.raw.cell, JSON.stringify(rawFace));
  ok('typing in Raw · changes is literal: Enter is one newline and backspace at a line\'s start takes the newline; the render\'s Enter still makes a paragraph',
    rawFace.rawEnter[0] === '\n' && rawFace.rawEnter[1] !== '\n' && rawFace.renEnter.startsWith('\n\n')
    && rawFace.rawBack === '.\nSec', JSON.stringify(rawFace));
  // CONFIRM, THEN APPLY: a card is confirmed from its pill, the corner offers
  // Apply, and Apply commits GitHub's copy with only the confirmed cards'
  // changes; the rest stay as edits. A note is not commit text: it stays on
  // the page, moved onto the applied text.
  console.log('confirm and apply:');
  await reset();
  const conf = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md, vis = (el) => !!el && el.getClientRects().length > 0;
    c.token = c.token || 'test-token';
    // 'Second  para.' is a doubled space: a change no card shows, which
    // Apply must leave out of the commit as it leaves out an unconfirmed card.
    c.$refs.view.scrollTop = 0; c.d.text = c.text.replace('First one.', 'First once.').replace('Second para.', 'Second  para.').replace('Third para.', 'Third paragraph.'); c.d.caretAt(0); c.paint();
    await new Promise((r) => setTimeout(r, 250));
    const third = () => [...md.querySelectorAll('[data-md-card]')].find((x) => x.textContent.includes('paragraph'));
    const btn = () => third().querySelector('[data-md-card-act="confirm"]');
    const state = async () => { await new Promise((r) => setTimeout(r, 120)); const b = third().querySelector('[data-md-card-badge]');
      const ap = document.querySelector('[data-apply]');
      return { word: btn().textContent, green: b.classList.contains('bg-success!'), apply: vis(ap) ? ap.textContent.trim() : null, n: c.confirmedCount,
               tip: btn().dataset.titleTip, title: btn().getAttribute('title'), applyTip: ap.dataset.titleTip, applyTitle: ap.getAttribute('title') }; };
    btn().click(); const on = await state();
    btn().click(); const off = await state();
    btn().click(); await state();
    c.d.text = c.text.replace('Third paragraph.', 'Third paragraphs.'); c.paint(); const edited = await state();
    c.d.text = c.text.replace('Third paragraphs.', 'Third paragraph.'); c.paint(); await state();
    btn().click(); await state();
    const i = +third().dataset.mdCard;
    c.openCardInfo(i, btn(), true); await new Promise((r) => setTimeout(r, 150));
    const note = document.querySelector('[data-info-note]');
    note.value = 'Clearer.'; note.dispatchEvent(new Event('input', { bubbles: true }));
    c.cardInfo = null;
    return { on, off, edited, noted: !!note };
  });
  ok('confirm marks the card, green number and "confirmed ✓", and brings Apply 1; the same word takes it back', conf.on.word === 'confirmed ✓' && conf.on.green && /^Apply 1\b/.test(conf.on.apply || '') && conf.off.word === 'confirm' && !conf.off.green && conf.off.apply === null, JSON.stringify(conf));
  ok('confirm, confirmed and Apply say what they do in title-tips, never in a `title`',
    conf.off.tip === 'Accept this change (can undo).' && /Tap to take it back/.test(conf.on.tip) && /^Commit the 1 confirmed change to .* as one commit\.$/.test(conf.on.applyTip)
      && !conf.on.title && !conf.off.title && !conf.on.applyTitle, JSON.stringify({ on: conf.on, off: conf.off }));
  ok('editing a confirmed card lets the confirmation lapse', conf.edited.n === 0 && conf.edited.word === 'confirm', JSON.stringify(conf.edited));
  const before = writes.length;
  await page.evaluate(() => document.querySelector('[data-apply]').click());
  await page.waitForTimeout(400);
  const applied = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    return { base: c.fileBase, text: c.text, cards: c.changesCount, n: c.confirmedCount,
             notes: c.notes.map((n) => ({ text: n.text, exact: n.exact, at: n.o == null ? null : c.fileBase.slice(n.o, n.e) })) }; });
  const w = writes[writes.length - 1];
  const want = PARA_DOC.replace('Third para.', 'Third paragraph.');
  ok('Apply commits GitHub\'s copy with only the confirmed change, and the other edits, a card and a doubled space no card shows, stay as edits',
    writes.length === before + 1 && w.text === want && /^Apply 1 change to /.test(w.message)
      && applied.base === want && applied.text.includes('First once.') && applied.text.includes('Second  para.') && applied.cards === 1 && applied.n === 0,
    JSON.stringify({ w, applied }));
  ok('the note is not in the commit message; it stays on the page, on the applied text, quoting it',
    !w.message.includes('Clearer.') && applied.notes.length === 1 && applied.notes[0].text === 'Clearer.'
      && applied.notes[0].at === 'Third paragraph.' && applied.notes[0].exact === 'Third paragraph.', JSON.stringify({ message: w.message, notes: applied.notes }));
  await page.evaluate((t) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.fileBase = t; c.notes = []; c.confirmed = {}; }, PARA_DOC);
  // A card that only adds keeps its note through an edit to its own text,
  // while a confirmation of it lapses, as any confirmation does.
  await reset();
  const addNote = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], wait = (ms) => new Promise((r) => setTimeout(r, ms));
    c.d.text = c.text.replace('Second para.\n', 'Second para.\n\nAn added line.\n'); c.paint(); await wait(200);
    const u0 = c.unitsNow().find((u) => u.card === 0);
    c.notes = [window.DictateRecord.make(u0, c.fileBase, c.text, 'Why it is here.')]; c.toggleConfirm(0); await wait(50);
    c.d.text = c.text.replace('An added line.', 'An added line, reworded.'); c.paint(); await wait(200);
    const u1 = c.unitsNow().find((u) => u.card === 0), held = c.notesAt(u1.o);
    const out = { note: held[0] ? held[0].text : null, quote: c.liveNotes()[0].exact, confirmed: c.confirmedCount };
    c.notes = []; c.confirmed = {}; c.d.text = c.fileBase; c.paint();
    return out;
  });
  // No move lands in code: a fence, or inline code, refuses the drop and the
  // text is unchanged; prose still takes it.
  const codeDrop = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const doc = 'Lead words here.\n\n```\nconst a = 1;\n```\n\nSee `code span` too.\n';
    c.d.text = doc; c.paint();
    const a = doc.indexOf('words'), b = a + 5;
    const fence = c.landMove(a, b, doc.indexOf('a = 1'), false), afterFence = c.d.text === doc;
    const inline = c.landMove(a, b, doc.indexOf('span'), false), afterInline = c.d.text === doc;
    const prose = c.landMove(a, b, doc.indexOf('too'), false), moved = c.d.text !== doc && !c.d.text.startsWith('Lead words');
    c.d.text = c.fileBase; c.paint();
    return { fence, afterFence, inline, afterInline, prose, moved };
  });
  ok('a move into a code fence or inline code is refused, the text unchanged; prose still takes it',
    codeDrop.fence === false && codeDrop.afterFence && codeDrop.inline === false && codeDrop.afterInline && codeDrop.prose === true && codeDrop.moved, JSON.stringify(codeDrop));
  // The refusal's toast stays 2.5s, over what the next checks tap.
  await page.waitForTimeout(2700);
  ok('a card that only adds keeps its note when its text is edited, the note quoting the text as it reads now, and its confirmation lapses',
    addNote.note === 'Why it is here.' && addNote.quote === 'An added line, reworded.' && addNote.confirmed === 0, JSON.stringify(addNote));
  // NOTES ON BLOCKS: the caret in an unchanged paragraph marks it, its badge
  // opens a note, and the note is a record kept apart from the edit: on an
  // unchanged file, through a reload, Clear all edits, a move on GitHub and a
  // Save, and out in the record Send hands over.
  console.log('notes on blocks:');
  await reset();
  const blockNote = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    c.notes = []; c.confirmed = {}; c.hoverBlock = null; c.hoverCard = null; c.selCard = null; c.cardInfo = null;
    c.d.text = c.fileBase; c.paint(); await wait(120);
    const para = () => [...md.querySelectorAll('[data-md-block] p')].find((x) => x.textContent.includes('Second para'));
    c.d.caretAt(+para().querySelector('[data-src]').dataset.src + 2); c.paint(); await wait(150);
    const wrap = para().closest('[data-md-block]'), badge = wrap.querySelector('[data-md-block-badge]');
    const br = badge && badge.getBoundingClientRect(), pr = para().getBoundingClientRect();
    const out = { outlined: wrap.dataset.blockCaret != null, lit: md.querySelectorAll('[data-block-caret]').length, badge: !!badge,
      topLeft: !!br && br.top < pr.top && br.bottom <= pr.top + 6 && Math.abs(br.left - pr.left) <= 4,
      overflow: c.$refs.view.scrollWidth - c.$refs.view.clientWidth };
    // A mouse over another paragraph washes that one and leaves the caret's
    // outline where it is; leaving takes the wash and nothing else.
    const third = [...md.querySelectorAll('[data-md-block] p')].find((x) => x.textContent.includes('Third para'));
    const tr = third.getBoundingClientRect();
    third.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: tr.left + 20, clientY: tr.top + 5 }));
    await wait(80);
    const tw = third.closest('[data-md-block]');
    out.hover = { washed: tw.dataset.blockHover != null, outlined: tw.dataset.blockCaret != null, caretKept: wrap.dataset.blockCaret != null,
      washedCaret: wrap.dataset.blockHover != null, badges: md.querySelectorAll('[data-md-block-badge]').length };
    md.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    await wait(80);
    out.left = { washed: md.querySelectorAll('[data-block-hover]').length, caretKept: wrap.dataset.blockCaret != null, badges: md.querySelectorAll('[data-md-block-badge]').length };
    // Focused within the tap's own microtasks, before any frame or timer: a
    // later focus raises no keyboard on iOS.
    badge.click(); await null;
    out.inTap = !!document.activeElement && document.activeElement.matches('[data-info-note]') && !!document.activeElement.getClientRects().length;
    await wait(200);
    const info = document.querySelector('[data-card-info]'), f = info.querySelector('[data-info-note]');
    // Hung from the badge, as a dropdown is: its top 6px under the number and
    // its left edge on the number's, not clear of the whole paragraph.
    const nb = badge.getBoundingClientRect(), ib = info.getBoundingClientRect();
    out.hung = { gap: Math.round(ib.top - nb.bottom), left: Math.round(ib.left - Math.max(8, Math.min(innerWidth - ib.width - 8, nb.left))),
      clear: ib.top < pr.bottom };
    out.head = !!info.querySelector('[data-info-sum], [data-info-kind]');
    out.diff = !!info.querySelector('[data-info-diff]'); out.focused = document.activeElement === f;
    f.value = 'Is this still true?'; f.dispatchEvent(new Event('input', { bubbles: true })); await wait(50);
    out.same = document.querySelector('[data-info-note]') === f;
    const key = Object.keys(localStorage).find((k) => k.startsWith('dictate:file:'));
    const held = JSON.parse(localStorage.getItem(key) || 'null');
    out.held = held && { text: held.text, notes: (held.notes || []).map((n) => n.text), base: held.base, sha: c.baseSha };
    c.cardInfo = null; c.d.caretAt(0); c.paint(); await wait(150);
    const m = para().closest('[data-md-block]').querySelector('[data-md-block-badge]');
    out.mark = !!m && m.hasAttribute('data-noted') && m.parentElement.dataset.blockCaret == null;
    c.d.text = c.text.replace('Second para.', 'Second para, edited.'); c.paint(); await wait(200);
    const card = [...md.querySelectorAll('[data-md-card]')].find((x) => x.textContent.includes('edited'));
    out.cardMark = !!card && !!card.querySelector('[data-md-card-badge] [data-note-mark]');
    c.openCardInfo(+card.dataset.mdCard, card.querySelector('[data-md-card-badge]'), true); await wait(150);
    out.cardNote = document.querySelector('[data-info-note]').value;
    c.cardInfo = null;
    c.d.text = c.fileBase; c.paint(); await wait(150);
    out.back = !!md.querySelector('[data-md-block-badge][data-noted]');
    return out;
  });
  ok('the badge\'s panel hangs from the badge, 6px under the number with its left edge on the number\'s, over the paragraph rather than below it',
    blockNote.hung.gap === 6 && Math.abs(blockNote.hung.left) <= 1 && blockNote.hung.clear, JSON.stringify(blockNote.hung));
  ok('the caret in an unchanged paragraph outlines that block alone, its badge at the top left as a card\'s number is, nothing scrolling sideways',
    blockNote.outlined && blockNote.lit === 1 && blockNote.badge && blockNote.topLeft && blockNote.overflow === 0, JSON.stringify(blockNote));
  ok('a mouse over another paragraph washes it and leaves the caret\'s outline in place, each with a badge; leaving takes only the wash',
    blockNote.hover.washed && !blockNote.hover.outlined && blockNote.hover.caretKept && !blockNote.hover.washedCaret && blockNote.hover.badges === 2
      && blockNote.left.washed === 0 && blockNote.left.caretKept && blockNote.left.badges === 1, JSON.stringify({ hover: blockNote.hover, left: blockNote.left }));
  ok('its badge opens the panel with the note field alone, no header and no diff, focused and kept as the note is made',
    !blockNote.head && !blockNote.diff && blockNote.focused && blockNote.same, JSON.stringify(blockNote));
  ok('the field is focused inside the tap, shown and before any frame, which is what lets iOS raise the keyboard', blockNote.inTap, JSON.stringify({ inTap: blockNote.inTap }));
  ok('a note on a file with no edit is kept: the draft holds the note, the blob it is anchored in, and no text',
    !!blockNote.held && blockNote.held.text === null && blockNote.held.notes.join() === 'Is this still true?' && blockNote.held.base === blockNote.held.sha, JSON.stringify(blockNote.held));
  ok('the noted block keeps its mark with the caret gone; edited, its card carries the mark and its Info the note; taken back, the note is on the block again',
    blockNote.mark && blockNote.cardMark && blockNote.cardNote === 'Is this still true?' && blockNote.back, JSON.stringify(blockNote));
  // REMOVING A NOTE: the trash on its row, on the field's first line and the
  // panel's right edge, removes it and closes the panel; the toast's Undo
  // puts the same record back. An empty field shows no trash. On a phone the
  // badge carries no title-tip, which a tap opened over the line above.
  const removed = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const block = (t) => [...md.querySelectorAll('[data-md-block] p')].find((x) => x.textContent.includes(t));
    const badgeOf = (t) => block(t).closest('[data-md-block]').querySelector('[data-md-block-badge]');
    c.d.caretAt(+block('Third para').querySelector('[data-src]').dataset.src + 2); c.paint(); await wait(150);
    badgeOf('Third para').click(); await wait(200);
    const out = { emptyTrash: getComputedStyle(document.querySelector('[data-card-info] [data-info-note-remove]')).visibility };
    c.cardInfo = null;
    c.d.caretAt(+block('Second para').querySelector('[data-src]').dataset.src + 2); c.paint(); await wait(150);
    const b = badgeOf('Second para');
    out.tip = b.hasAttribute('data-title-tip'); out.label = b.getAttribute('aria-label');
    b.click(); await wait(200);
    const info = document.querySelector('[data-card-info]'), trash = info.querySelector('[data-info-note-remove]');
    const ir = info.getBoundingClientRect(), tr = trash.getBoundingClientRect(), fr = info.querySelector('[data-info-note]').getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(trash.closest('.px-3')).paddingRight) + parseFloat(getComputedStyle(info).borderRightWidth);
    out.shown = getComputedStyle(trash).visibility;
    out.edge = Math.round(ir.right - pad - tr.right); out.line = Math.round(tr.top + tr.height / 2 - (fr.top + 10));
    const id = c.notes[0] && c.notes[0].id;
    trash.click(); await wait(150);
    const toasts = Alpine.store('toasts'), t = toasts.find((x) => x.action);
    out.after = { notes: c.notes.length, open: !!c.cardInfo, badge: badgeOf('Second para').textContent, toast: t ? t.msg + '|' + t.action.label : null };
    if (t) t.action.run();
    await wait(150);
    out.undo = { notes: c.notes.map((n) => n.text).join(), same: !!c.notes[0] && c.notes[0].id === id, badge: badgeOf('Second para').textContent, toasts: toasts.length };
    c.d.caretAt(0); c.paint(); await wait(100);
    return out;
  });
  ok('a block with no note shows no trash in its panel; on a phone the badge has no title-tip, its aria-label saying what it does',
    removed.emptyTrash === 'hidden' && !removed.tip && removed.label === 'The note on this block', JSON.stringify(removed));
  ok('a note\'s trash sits on the field\'s first line at the panel\'s right edge; it removes the note and closes the panel, the badge back to "+ note"',
    removed.shown === 'visible' && Math.abs(removed.edge) <= 1 && Math.abs(removed.line) <= 1
      && removed.after.notes === 0 && !removed.after.open && removed.after.badge === '+ note', JSON.stringify(removed));
  ok('the toast says the note was removed, and its Undo puts the same record back',
    removed.after.toast === 'Note removed|Undo' && removed.undo.same && removed.undo.notes === 'Is this still true?' && removed.undo.badge === 'note' && removed.undo.toasts === 0,
    JSON.stringify({ after: removed.after, undo: removed.undo }));
  // ONE NOTE PER SECTION (owner, 2026-10-04). Two records on one section, as
  // a join of two noted paragraphs leaves, read as one field; the first edit
  // folds them into one record, and the trash takes the section's whole note,
  // its Undo putting both back. And with no room under the badge, the panel
  // opens over it.
  const single = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const R = window.DictateRecord, saved = c.notes;
    const u = c.unitsNow().find((x) => c.text.slice(x.o[0], x.o[1]).includes('Third para'));
    c.notes = [...saved, R.make(u, c.fileBase, c.text, 'First thought.'), R.make(u, c.fileBase, c.text, 'Second thought.')];
    c.d.caretAt(u.o[0] + 2); c.paint(); await wait(150);
    const badge = [...md.querySelectorAll('[data-md-block] p')].find((x) => x.textContent.includes('Third para')).closest('[data-md-block]').querySelector('[data-md-block-badge]');
    badge.click(); await wait(200);
    const info = document.querySelector('[data-card-info]'), f = info.querySelector('[data-info-note]');
    const out = { fields: info.querySelectorAll('[data-info-note]').length, value: f.value };
    f.value = 'One thought.'; f.dispatchEvent(new Event('input', { bubbles: true })); await wait(50);
    out.folded = c.notesAt(u.o).map((n) => n.text);
    c.notes = [...saved, R.make(u, c.fileBase, c.text, 'First thought.'), R.make(u, c.fileBase, c.text, 'Second thought.')]; await wait(50);
    info.querySelector('[data-info-note-remove]').click(); await wait(150);
    out.trashed = c.notesAt(u.o).length;
    const t = Alpine.store('toasts').find((x) => x.action);
    if (t) t.action.run();
    await wait(100);
    out.undone = c.notesAt(u.o).map((n) => n.text).sort().join('|');
    const floor = c.$refs.view.getBoundingClientRect().bottom;
    out.over = c.infoPlace({ getBoundingClientRect: () => ({ top: floor - 40, bottom: floor - 20, left: 30 }) }).pos;
    out.under = c.infoPlace({ getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 30 }) }).pos;
    c.notes = saved; c.save(); c.cardInfo = null; c.d.caretAt(0); c.paint(); await wait(100);
    return out;
  });
  ok('a section holds one note: two records on it read as one field, the first edit folds them into one, and the trash takes both, Undo putting both back',
    single.fields === 1 && single.value === 'First thought.\n\nSecond thought.' && single.folded.join('|') === 'One thought.'
      && single.trashed === 0 && single.undone === 'First thought.|Second thought.', JSON.stringify(single));
  ok('with room under the badge the panel opens under it, and with none it opens over it',
    single.under === 'top:126px' && /^bottom:\d+px$/.test(single.over), JSON.stringify({ under: single.under, over: single.over }));
  const kept = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const on = () => c.notes.map((n) => (n.o == null ? null : c.fileBase.slice(n.o, n.e))).join();
    await c.loadFile(); await wait(150);
    const out = { reload: on(), text: c.text === c.fileBase };
    c.d.text = c.text.replace('Third para.', 'Third para, edited.'); c.paint(); await wait(100);
    await c.loadFile(true); await wait(150);
    out.cleared = { edit: c.text === c.fileBase, notes: on() };
    return out;
  });
  ok('the note comes back on a reload, and Clear all edits drops the edit and keeps the note',
    kept.reload === 'Second para.' && kept.text && kept.cleared.edit && kept.cleared.notes === 'Second para.', JSON.stringify(kept));
  served = { text: PARA_DOC.replace('# Title\n\n', '# Title\n\nA paragraph someone added on GitHub.\n\n'), sha: 'moved' };
  const moved = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await c.loadFile(); await wait(150);
    return { notes: c.notes.map((n) => (n.o == null ? null : c.fileBase.slice(n.o, n.e))), base: c.baseSha };
  });
  ok('when GitHub\'s copy moved under the note, it is found again by its quote', moved.notes.join() === 'Second para.' && moved.base === 'moved', JSON.stringify(moved));
  served = { text: PARA_DOC, sha: 'para' };
  const sentRec = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await c.loadFile(); await wait(150);
    c.token = c.token || 'test-token';
    c.d.text = c.text.replace('Third para.', 'Third para, saved.'); c.paint(); await wait(100);
    // No account list: the identity read it makes is not answered here, and
    // a refused one puts up the token wall over the whole page.
    c.repoList = []; c.openSend(); await wait(100);
    const out = { what: c.sendWhat, md: c.sharePayload, count: document.querySelector('[data-send-count]').textContent };
    c.recordAs = 'json'; await wait(20);
    try { out.json = JSON.parse(c.sharePayload); } catch (e) { out.json = String(e); }
    c.recordAs = 'md'; c.sendOpen = false;
    await c.saveFile(); await wait(150);
    out.after = c.notes.map((n) => (n.o == null ? null : c.fileBase.slice(n.o, n.e))).join();
    return out;
  });
  const sw = writes[writes.length - 1];
  ok('Send opens on the record when there are notes: markdown with the note under its passage, JSON a dictate/1 record',
    sentRec.what === 'record' && sentRec.count === '1 change · 1 note' && sentRec.md.includes('## Note · line 5\n> Second para.\n\n**Note:** Is this still true?')
      && sentRec.json.kind === 'dictate/1' && sentRec.json.notes[0].lines.start === 5 && sentRec.json.changes[0].new === 'Third para, saved.', JSON.stringify(sentRec));
  ok('Save commits the edit with no note in the message, and the note stays on its paragraph',
    sw.message === 'Edit para-fixture.md via dictate' && sentRec.after === 'Second para.', JSON.stringify({ message: sw.message, after: sentRec.after }));
  const legacy = await page.evaluate(async (doc) => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const key = Object.keys(localStorage).find((k) => k.startsWith('dictate:file:'));
    localStorage.setItem(key, JSON.stringify({ text: doc.replace('Second para.', 'Second para, old draft.'), sha: 'para', confirmed: {},
      notes: { ['o' + doc.indexOf('Second para.')]: 'A note from before.' } }));
    await c.loadFile(); await wait(300);
    const out = c.notes.map((n) => [n.text, c.fileBase.slice(n.o, n.e)]);
    c.notes = []; c.confirmed = {}; c.d.text = c.fileBase; c.paint(); c.save();
    return out;
  }, PARA_DOC);
  ok('a draft from before notes were records keeps its note, now a record on the same card',
    legacy.length === 1 && legacy[0][0] === 'A note from before.' && legacy[0][1] === 'Second para.', JSON.stringify(legacy));
  console.log('card track:');
  await reset();
  const cardAt = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    c.$refs.view.scrollTop = 0;
    c.d.text = c.text.replace('Second para.', 'Second paragraph here.'); c.paint();
    await new Promise((r) => setTimeout(r, 100));
    const card = c.$refs.md.querySelector('[data-md-card]'), t = card.querySelector('[data-md-track]');
    const r = t.getBoundingClientRect();
    return { i: +card.dataset.mdCard, w: t.clientWidth, sw: t.scrollWidth, left: t.scrollLeft,
             x: r.left + r.width / 2, y: r.top + r.height / 2, reading: window.MdSurface.readingOf(c.$refs.md, +card.dataset.mdCard) };
  });
  ok('a card opens on its marked reading, with the others beside it on a track',
    cardAt.reading === 'inline' && Math.abs(cardAt.sw - 3 * cardAt.w) < 4 && Math.abs(cardAt.left - cardAt.w) < 2, JSON.stringify(cardAt));
  const readNow = () => page.evaluate((i) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const t = c.$refs.md.querySelector('[data-md-card="' + i + '"] [data-md-track]');
    return { reading: window.MdSurface.readingOf(c.$refs.md, i), left: t && t.scrollLeft, w: t && t.clientWidth,
             mapped: !!c.$refs.md.querySelector('[data-md-card="' + i + '"] [data-md-reading="new"] [data-src]') }; }, cardAt.i);
  const stopNew = await page.evaluate((i) => { const b = document.querySelector('[data-md-card-read="' + i + ':new"]').getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, cardAt.i);
  await page.touchscreen.tap(stopNew.x, stopNew.y);
  await page.waitForTimeout(700);
  const afterStop = await readNow();
  ok('a tap on a stop scrolls the track there, and that reading takes the caret',
    afterStop.reading === 'new' && Math.abs(afterStop.left - 2 * afterStop.w) < 2 && afterStop.mapped, JSON.stringify(afterStop));
  // A finger dragged right across the card: the text moves while it drags,
  // and the release settles one reading back, on marked.
  const cdp = await page.context().newCDPSession(page);
  const touchAt = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: cardAt.y }] });
  await touchAt('touchStart', cardAt.x - 100);
  for (let k = 1; k <= 8; k++) { await touchAt('touchMove', cardAt.x - 100 + k * 25); await page.waitForTimeout(16); }
  // A finger that pauses mid-drag is still dragging: nothing settles under it.
  await page.waitForTimeout(400);
  const mid = await readNow();
  ok('a drag that pauses with the finger down is not settled under it', mid.reading === 'new', JSON.stringify(mid));
  // But the pill already lights the reading under the finger, before any
  // settle: it used to wait for the release and the quiet spell after it.
  const litMid = await page.evaluate((i) => { const b = document.querySelector('[data-md-card="' + i + '"] [data-md-card-read].font-medium');
    return b && b.dataset.mdCardRead.split(':')[1]; }, cardAt.i);
  const underMid = ['old', 'inline', 'new'][Math.round(mid.left / mid.w)];
  ok('and its stops pill lights the reading under the finger while the finger is still down', litMid === underMid && litMid !== 'new', JSON.stringify({ litMid, underMid }));
  await touchAt('touchEnd');
  // The glide after the release is short and the reading is taken the moment
  // it lands: a platform snap glide ran on for half a second on the phone,
  // then waited out a quiet spell, and a quick second swipe fell into it.
  const tEnd = Date.now();
  const gliding = await page.evaluate((i) => document.querySelector('[data-md-card="' + i + '"] [data-md-track]')?.style.overflowX === 'hidden', cardAt.i);
  let settledIn = null;
  while (Date.now() - tEnd < 1500) { if ((await readNow()).reading === 'inline') { settledIn = Date.now() - tEnd; break; } await page.waitForTimeout(10); }
  await page.waitForTimeout(300);
  const afterDrag = await readNow();
  ok('the release glides itself, off the platform snap, and the reading is taken within 300ms', gliding && settledIn != null && settledIn < 300, JSON.stringify({ gliding, settledIn }));
  ok('a drag moves the text with the finger', mid.left < 2 * mid.w - 20, JSON.stringify(mid));
  ok('and the release settles on the next reading over', afterDrag.reading === 'inline' && Math.abs(afterDrag.left - afterDrag.w) < 2, JSON.stringify(afterDrag));
  // A short, quick flick turns the card too, as the platform's snap did: a
  // fifth of the way across, fast, goes on to the reading it points at.
  await touchAt('touchStart', cardAt.x - 40);
  for (let k = 1; k <= 3; k++) { await touchAt('touchMove', cardAt.x - 40 + k * 25); await page.waitForTimeout(16); }
  await touchAt('touchEnd');
  await page.waitForTimeout(500);
  const flicked = await readNow();
  ok('a short quick flick goes on to the next reading', flicked.reading === 'old' && flicked.left < 2, JSON.stringify(flicked));
  await page.evaluate((i) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.pickReading(i, 'inline'); }, cardAt.i);
  await page.waitForTimeout(400);
  // A press that travels sideways and lifts is no longer a swipe: under the
  // native option that is a selection handle, and it must leave the card be.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; if (!c.nativeSel) c.toggleNativeSel(); });
  await touch('pointerdown', cardAt.x - 60, cardAt.y);
  await touch('pointermove', cardAt.x + 60, cardAt.y);
  await touch('pointerup', cardAt.x + 60, cardAt.y);
  await page.waitForTimeout(300);
  const afterHandle = await readNow();
  ok('a sideways press-and-release, as a selection handle makes, does not turn the card', afterHandle.reading === 'inline', JSON.stringify(afterHandle));
  // A real drag across a card, under the native option: the platform's
  // selection takes the card's text once, not its three readings, and the
  // track stays on the reading it was on. Reported from the phone.
  const acrossCard = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], md = c.$refs.md;
    c.$refs.view.scrollTop = 0; c.d.caretAt(0); c.paint();
    await new Promise((r) => setTimeout(r, 200));
    const A = window.MdSurface.rectAt(md, c.text.indexOf('First one') + 1), B = window.MdSurface.rectAt(md, c.text.indexOf('Third para') + 3);
    return { ax: A.left, ay: A.top + A.height / 2, bx: B.left, by: B.top + B.height / 2 };
  });
  await page.mouse.move(acrossCard.ax, acrossCard.ay); await page.mouse.down();
  for (let k = 1; k <= 12; k++) await page.mouse.move(acrossCard.ax + (acrossCard.bx - acrossCard.ax) * k / 12, acrossCard.ay + (acrossCard.by - acrossCard.ay) * k / 12);
  await page.mouse.up();
  await page.waitForTimeout(250);
  const afterAcross = await page.evaluate((i) => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const t = c.$refs.md.querySelector('[data-md-card="' + i + '"] [data-md-track]'), s = document.getSelection().toString();
    return { second: (s.match(/Second/g) || []).length, onInline: Math.abs(t.scrollLeft - t.clientWidth) < 2, reading: window.MdSurface.readingOf(c.$refs.md, i) }; }, cardAt.i);
  ok('a drag across a card selects its text once and leaves its track where it was',
    afterAcross.second === 1 && afterAcross.onInline && afterAcross.reading === 'inline', JSON.stringify(afterAcross));
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.precise = false; if (c.nativeSel) c.toggleNativeSel(); });
  // A swipe settling rebuilds the cards, and the page stays where it was.
  // Reported from the phone: settling a card sent the reader to the top, as
  // the emptied document let the scroller clamp to zero mid-rebuild.
  const held = await page.evaluate(async () => {
    const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0], v = c.$refs.view, md = c.$refs.md;
    const saved = { base: c.fileBase, text: c.text };
    const long = PARA => PARA + Array.from({ length: 40 }, (_, k) => 'Filler paragraph number ' + k + ' to give the pane a scroll.').join('\n\n') + '\n';
    c.fileBase = long(saved.base);
    c.d.text = c.fileBase.replace('Filler paragraph number 20 ', 'Filler paragraph, changed, number 20 '); c.paint();
    await new Promise((r) => setTimeout(r, 300));
    const card = md.querySelector('[data-md-card]');
    card.scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 100));
    const before = v.scrollTop;
    md.dispatchEvent(new CustomEvent('md-card-reading', { detail: { i: +card.dataset.mdCard, mode: 'new' } }));
    await new Promise((r) => setTimeout(r, 300));
    const after = v.scrollTop;
    c.fileBase = saved.base; c.d.text = saved.text; c.paint();
    return { before, after };
  });
  ok('a swipe settling on another reading leaves the page where it was, not at the top',
    held.before > 200 && Math.abs(held.after - held.before) < 4, JSON.stringify(held));
  // The first card a page draws opens on its marked reading too. The track
  // is not a scroller until the styles for its classes exist, which the
  // browser build writes a frame after the node appears, so the position set
  // at render was dropped and the card opened on the original.
  await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0]; c.save(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await stub();
  const fresh = await page.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
    const t = c.$refs.md.querySelector('[data-md-track]');
    return t && { left: t.scrollLeft, w: t.clientWidth, off: [...t.querySelectorAll('[data-md-off]')].every((l) => getComputedStyle(l).visibility === 'hidden') }; });
  ok('the first card on a fresh page opens on its marked reading, the others hidden',
    !!fresh && fresh.w > 0 && Math.abs(fresh.left - fresh.w) < 2 && fresh.off, JSON.stringify(fresh));
  }

  // NATIVE BY DEFAULT: with nothing chosen, the platform selects, on a phone
  // and on a desk. On a desk that only holds if a click places the caret
  // without opening typing, a press while typing ends it, and the keys a
  // textarea would handle still work with none open. A link in the document
  // is text, and the note badge's reach stops short of the first line.
  console.log('native by default:');
  const fresh2 = async (opts) => {
    const cx = await browser.newContext(opts);
    await cx.addInitScript(() => { try { localStorage.setItem('ghToken', 'test-token'); } catch {} });
    const pg = await cx.newPage();
    await pg.route('**/*', routeAll);
    pg.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));
    await pg.goto(`${origin}/pages/dictate.html?file=mehrlander/web-tools:docs/annotation.md`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => { const c = document.querySelector('[x-data="dictate"]')?._x_dataStack?.[0]; return c && c.rendered && document.querySelector('[data-md-block]'); }, null, { timeout: 15000 });
    await pg.waitForTimeout(400);
    return { cx, pg };
  };
  {
    const { cx, pg } = await fresh2({ viewport: PHONE, hasTouch: true, isMobile: true });
    const phone = await pg.evaluate(() => { const c = document.querySelector('[x-data="dictate"]')._x_dataStack[0];
      return { nativeSel: c.nativeSel, native: c.native, stored: localStorage.getItem('dictate:selection') }; });
    ok('with nothing chosen, a phone selects with the platform', phone.nativeSel && phone.native && phone.stored === null, JSON.stringify(phone));
    await cx.close();
  }
  {
    const { cx, pg } = await fresh2({ viewport: { width: 1280, height: 800 } });
    const C = 'document.querySelector(\'[x-data="dictate"]\')._x_dataStack[0]';
    const st = () => pg.evaluate(`(() => { const x = ${C}, s = document.getSelection(); return { sel: s.toString(), a: x.d.range.start, b: x.d.range.end,
      native: x.native, typing: x.typing, painted: document.querySelectorAll('[data-md-surface="sel"]').length }; })()`);
    const at = (k, line = 0) => pg.evaluate(`(() => { const ps = ${C}.$refs.md.querySelectorAll('[data-md-block] p'), p = ps[Math.min(${k}, ps.length - 1)];
      const r = [...p.querySelector('[data-src]').getClientRects()][${line}] || p.querySelector('[data-src]').getBoundingClientRect(); return { x: r.left, y: r.top, h: r.height, w: r.width }; })()`);
    const p1 = await at(1);
    await pg.mouse.click(p1.x + 30, p1.y + p1.h / 2); await pg.waitForTimeout(200);
    const click = await st();
    await pg.mouse.move(p1.x + 30, p1.y + p1.h / 2); await pg.mouse.down(); await pg.mouse.move(p1.x + 260, p1.y + p1.h / 2, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(250);
    const drag = await st();
    ok('on a desk a click places the caret without opening typing, and a drag selects with the platform, the page painting none',
      click.native && !click.typing && click.a === click.b && drag.native && drag.sel.length > 10 && drag.b - drag.a > 10 && drag.painted === 0, JSON.stringify({ click, drag }));
    const p2 = await at(2);
    await pg.mouse.dblclick(p2.x + 30, p2.y + p2.h / 2); await pg.waitForTimeout(200);
    const word = await pg.evaluate(`(() => { const x = ${C}; return x.text.slice(x.d.range.start, x.d.range.end); })()`);
    const len0 = await pg.evaluate(`${C}.text.length`);
    await pg.keyboard.type('Q'); await pg.waitForTimeout(250);
    const typed = await pg.evaluate(`(() => { const x = ${C}; return { delta: x.text.length - ${len0}, typing: x.typing }; })()`);
    ok('a double click takes a word, and the first key typed opens typing over it', word.length > 1 && typed.typing && typed.delta === 1 - word.length, JSON.stringify({ word, typed }));
    const p3 = await at(3);
    await pg.mouse.click(p3.x + 30, p3.y + p3.h / 2); await pg.waitForTimeout(200);
    const after = await st();
    const a0 = after.a;
    await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(150);
    const moved = await st();
    ok('a click while typing ends it and places the caret; the arrows travel with no typing open',
      !after.typing && after.native && after.a === after.b && moved.a === a0 + 2 && !moved.typing, JSON.stringify({ after, moved }));
    await pg.mouse.dblclick(p3.x + 30, p3.y + p3.h / 2); await pg.waitForTimeout(200);
    const w2 = await pg.evaluate(`(() => { const x = ${C}; return { n: x.d.range.end - x.d.range.start, len: x.text.length }; })()`);
    await pg.keyboard.press('Backspace'); await pg.waitForTimeout(250);
    const bs = await pg.evaluate(`${C}.text.length`);
    ok('backspace on a selection with no typing open deletes it', w2.n > 1 && bs === w2.len - w2.n, JSON.stringify({ w2, bs }));
    const link = await pg.evaluate(`(() => { const l = ${C}.$refs.md.querySelector('a[href]'); const r = l.getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; })()`);
    const url0 = pg.url();
    await pg.mouse.click(link.x, link.y); await pg.waitForTimeout(400);
    ok('a click on a link in the document stays on the page, as a click on any word', pg.url() === url0, pg.url());
    // The mouse rests on a paragraph, which puts its badge up, and a click on
    // that paragraph's first word places the caret rather than opening a note.
    const p4 = await at(99);
    await pg.mouse.move(p4.x + 20, p4.y + p4.h / 2); await pg.waitForTimeout(150);
    await pg.mouse.click(p4.x + 20, p4.y + p4.h / 2); await pg.waitForTimeout(200);
    const first = await pg.evaluate(`(() => { const x = ${C}; return { info: !!x.cardInfo, badge: !!x.$refs.md.querySelector('[data-block-hover] [data-md-block-badge]'), caret: x.d.range.start === x.d.range.end,
      tip: !!x.$refs.md.querySelector('[data-md-block-badge][data-title-tip]') }; })()`);
    ok('with a paragraph\'s badge up, a click on its first word places the caret and opens no note', first.badge && !first.info && first.caret, JSON.stringify(first));
    ok('on a desk the badge keeps its title-tip, where a pointer can hover it', first.tip, JSON.stringify(first));
    await cx.close();
  }

  // THE PROPOSAL QUEUE: with &proposed, the Text collection's proposals for
  // this file arrive as change cards, and nothing else does. The fixture has a
  // passage proposed here, one with a variant nobody proposed, and one proposed
  // for another file; only the first may be staged.
  console.log('the proposal queue:');
  {
    const { createHash } = await import('node:crypto');
    const pid = (t) => createHash('sha256').update(t.trim(), 'utf8').digest('hex');
    const DOC = '# Title\n\nProposed elsewhere.\n\nThe old wording here.\n\nOnly a variant.\n';
    const FIX = 'tools/test/prop-fixture.md';
    const pairs = [['Proposed elsewhere.', 'Not for this file.', 'docs/other.md'],
                   ['The old wording here.', 'The new wording.', FIX],
                   ['Only a variant.', 'Nobody proposed this.', null]];
    const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    const files = {
      'passages.jsonl': jsonl(pairs.flatMap(([a, b]) => [{ id: pid(a), text: a }, { id: pid(b), text: b }])),
      'variants.jsonl': jsonl(pairs.map(([a, b]) => ({ from: pid(a), to: pid(b), author: 'Check', purpose: 'tighten' }))),
      'proposals.jsonl': jsonl(pairs.filter((p) => p[2]).map(([a, b, path]) => ({ from: pid(a), to: pid(b),
        repo: 'mehrlander/web-tools', path, basis: 'https://github.com/mehrlander/web-tools/pull/1' }))),
    };
    const cx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await cx.addInitScript(() => { try { localStorage.setItem('ghToken', 'test-token'); } catch {} });
    const pg = await cx.newPage();
    await pg.route('**/*', routeAll);
    const serve = (route, text, sha) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      content: Buffer.from(text).toString('base64'), encoding: 'base64', sha, size: text.length }) });
    const put = [];
    await pg.route(`**/repos/mehrlander/web-tools/contents/${FIX}*`, (route) => {
      if (route.request().method() !== 'PUT') return serve(route, DOC, 'prop');
      put.push(Buffer.from(JSON.parse(route.request().postData() || '{}').content || '', 'base64').toString('utf8'));
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'applied' } }) });
    });
    await pg.route('**/repos/mehrlander/home/contents/projects/text/**', (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      return files[name] ? serve(route, files[name], name)
        : route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });
    pg.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));
    const C = 'document.querySelector(\'[x-data="dictate"]\')._x_dataStack[0]';
    const arrive = async (query) => {
      await pg.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.includes('dictate:file')) localStorage.removeItem(k); }).catch(() => {});
      await pg.goto(`${origin}/pages/dictate.html?file=mehrlander/web-tools:${FIX}${query}`, { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => { const x = document.querySelector('[x-data="dictate"]')?._x_dataStack?.[0];
        return x && x.fileBase != null && x.rendered; }, null, { timeout: 15000 });
      await pg.waitForTimeout(500);
      return pg.evaluate(`(() => { const x = ${C}; return { text: x.text, cards: window.MdSurface.cards(x.$refs.md).length }; })()`);
    };
    const plain = await arrive('');
    ok('without &proposed the file opens as GitHub has it, with no cards', plain.text === DOC && plain.cards === 0, JSON.stringify(plain));
    const staged = await arrive('&proposed');
    ok('with &proposed only the proposal for this file is staged, as one card',
      staged.text === DOC.replace('The old wording here.', 'The new wording.') && staged.cards === 1, JSON.stringify(staged));
    await pg.evaluate(`(async () => { const x = ${C}; x.toggleConfirm(0); await x.applyConfirmed(); })()`);
    await pg.waitForTimeout(300);
    ok('a confirmed staged proposal is applied as written', put.length === 1 && put[0] === staged.text, JSON.stringify(put));
    await cx.close();
  }

  // A DOCUMENTATION CALL: its head over the file, the edits it can find staged
  // as cards, each edit's decision read off the page, and the answer either
  // committed (to the file's branch or a new one) with a line beside the call,
  // or held as JSON with nothing written. The fixture's third edit is already
  // in the file and its fourth names text the file does not hold.
  console.log('a documentation call:');
  {
    const DOC = '# Title\n\nFirst para old.\n\nSecond para old.\n\nThird para new.\n\nFourth para.\n';
    const FIX = 'tools/test/call-fixture.md', CALLP = 'calls/test-call.json';
    const CALL = { schema: 'call/1', id: 'a710e806-test', session: 'a710e806', slug: 'test', kind: 'documentation',
      question: 'Apply 4 edits to call-fixture.md?', brief: 'Two new wordings, one already in, one gone.',
      file: 'mehrlander/web-tools:' + FIX, pr: 'mehrlander/web-tools#1', recommend: 'applying both', why: 'they are shorter',
      edits: [{ from: 'First para old.', to: 'First para new.', why: 'one' }, { from: 'Second para old.', to: 'Second para new.' },
              { from: 'Third para old.', to: 'Third para new.' }, { from: 'Missing para.', to: 'Whatever.' }] };
    const cx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await cx.addInitScript(() => { try { localStorage.setItem('ghToken', 'test-token'); } catch {} });
    const pg = await cx.newPage();
    await pg.route('**/*', routeAll);
    const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const file = (route, text, sha) => json(route, { content: Buffer.from(text).toString('base64'), encoding: 'base64', sha, size: text.length });
    const docPuts = [], answerPuts = [], refs = [], comments = [];
    let answers = '';
    const putBody = (route) => JSON.parse(route.request().postData() || '{}');
    await pg.route(`**/repos/mehrlander/web-tools/contents/${FIX}*`, (route) => {
      if (route.request().method() !== 'PUT') return file(route, DOC, 'doc');
      const b = putBody(route);
      docPuts.push({ branch: b.branch || '', message: b.message, text: Buffer.from(b.content, 'base64').toString('utf8') });
      return json(route, { content: { sha: 'applied' }, commit: { sha: 'c0ffee', html_url: 'https://github.com/mehrlander/web-tools/commit/c0ffee' } }, 201);
    });
    await pg.route(`**/repos/mehrlander/web-tools/contents/${CALLP}*`, (route) => file(route, JSON.stringify(CALL), 'call'));
    await pg.route('**/repos/mehrlander/web-tools/contents/calls/test-call.answers.jsonl*', (route) => {
      if (route.request().method() !== 'PUT') return answers ? file(route, answers, 'ans') : json(route, {}, 404);
      answers = Buffer.from(putBody(route).content, 'base64').toString('utf8');
      answerPuts.push(putBody(route));
      return json(route, { content: { sha: 'ans' } }, 201);
    });
    // A new branch is cut from the default branch, which the API names.
    await pg.route(/\/repos\/mehrlander\/web-tools\/?(\?.*)?$/, (route) => json(route, { default_branch: 'main' }));
    await pg.route('**/repos/mehrlander/web-tools/git/ref/heads/*', (route) => json(route, { object: { sha: 'tip' } }));
    await pg.route('**/repos/mehrlander/web-tools/git/refs', (route) => { refs.push(putBody(route)); return json(route, { ref: 'x' }, 201); });
    await pg.route('**/repos/mehrlander/web-tools/issues/1/comments', (route) => { comments.push(putBody(route).body); return json(route, { html_url: 'https://github.com/c/1' }, 201); });
    await pg.route('https://api.github.com/user', (route) => json(route, { login: 'tester' }));
    pg.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));
    const C = 'document.querySelector(\'[x-data="dictate"]\')._x_dataStack[0]';
    await pg.goto(`${origin}/pages/dictate.html?file=mehrlander/web-tools:${FIX}&call=mehrlander/web-tools:${CALLP}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => { const x = document.querySelector('[x-data="dictate"]')?._x_dataStack?.[0];
      return x && x.call && x.rendered && document.querySelector('[data-md-card]'); }, null, { timeout: 15000 });
    await pg.waitForTimeout(500);
    const st = await pg.evaluate(`(() => { const x = ${C}; return { text: x.text, status: x.callStatus, cards: window.MdSurface.cards(x.$refs.md).length,
      head: document.querySelector('[data-call-head]')?.textContent.replace(/\\s+/g, ' ') }; })()`);
    ok('the call\'s head names its question over the file', /Apply 4 edits to call-fixture\.md\?/.test(st.head || ''), st.head);
    ok('the edits the file holds are staged, one already in it and one not found are not',
      JSON.stringify(st.status) === '["staged","staged","applied","stale"]' && st.cards === 2
      && st.text === DOC.replace('First para old.', 'First para new.').replace('Second para old.', 'Second para new.'), JSON.stringify(st));
    // The call's why is the head of the first card's Info, the number wears
    // its mark, and the Info has no diff in it.
    const why = await pg.evaluate(`(async () => { const x = ${C}; const b = x.$refs.md.querySelector('[data-md-card="0"] [data-md-card-badge]');
      b.click(); await new Promise((r) => setTimeout(r, 200)); const i = document.querySelector('[data-card-info]');
      const out = { why: (i.querySelector('[data-info-why]') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '', diff: !!i.querySelector('[data-info-diff]'),
        mark: !!b.querySelector('[data-why-mark]'), other: !!x.$refs.md.querySelector('[data-md-card="1"] [data-why-mark]') };
      x.cardInfo = null;
      // A note on the second card, which the reader then discards.
      x.openCardInfo(1, x.$refs.md.querySelector('[data-md-card="1"] [data-md-card-badge]'), true);
      await new Promise((r) => setTimeout(r, 150)); x.setNote('Keep the second as it is.'); x.cardInfo = null;
      return out; })()`);
    ok('a call\'s why heads its card\'s Info, which holds no diff, and the card\'s number wears a mark only where the call says why',
      why.why === 'one' && !why.diff && why.mark && !why.other, JSON.stringify(why));
    await pg.evaluate(`(() => { const x = ${C}; x.toggleConfirm(0); x.rejectCard(window.MdSurface.cards(x.$refs.md)[1]); })()`);
    await pg.waitForTimeout(300);
    await pg.evaluate(`${C}.openAnswer()`);
    await pg.waitForTimeout(300);
    const held = await pg.evaluate(`(() => { const x = ${C}; return { rows: x.answerRows, json: JSON.parse(x.answerJson) }; })()`);
    ok('each edit\'s decision is read off the page: confirmed, discarded, and the two it did not stage',
      JSON.stringify(held.rows) === '["confirmed","discarded","applied","stale"]', JSON.stringify(held.rows));
    ok('the reader\'s note on a discarded edit rides with that edit\'s decision, and shows on its row of the sheet',
      held.json.decisions[1].decision === 'discarded' && held.json.decisions[1].note === 'Keep the second as it is.' && !held.json.notes
      && (await pg.evaluate(`${C}.answerRowNotes[1]`)) === 'Keep the second as it is.', JSON.stringify(held.json.decisions));
    ok('the copied answer carries the decisions and the confirmed patch, and nothing was written',
      held.json.decisions.length === 4 && /\+First para new\./.test(held.json.patch) && !/Second para new/.test(held.json.patch)
      && docPuts.length === 0 && answerPuts.length === 0, JSON.stringify(held.json));
    await pg.evaluate(`(async () => { const x = ${C}; x.answerTo = 'branch'; x.answerBranch = 'call/test'; await x.answerCall(); })()`);
    await pg.waitForTimeout(300);
    const line = answers.trim() ? JSON.parse(answers.trim().split('\n').pop()) : {};
    ok('to a new branch: the branch is cut from the tip, the confirmed edit committed there, and the call named',
      refs.length === 1 && refs[0].ref === 'refs/heads/call/test' && refs[0].sha === 'tip'
      && docPuts.length === 1 && docPuts[0].branch === 'call/test' && /Call: mehrlander\/web-tools:calls\/test-call\.json/.test(docPuts[0].message)
      && docPuts[0].text === DOC.replace('First para old.', 'First para new.'), JSON.stringify({ refs, docPuts }));
    ok('the answer lands beside the call with its target and commit, and is posted on the PR',
      line.target === 'call/test' && /c0ffee/.test(line.commit || '') && line.by === 'tester' && line.decisions?.[1]?.decision === 'discarded'
      && comments.length === 1 && /Answer: \*\*1 confirmed, 1 discarded/.test(comments[0]), JSON.stringify({ line, comments }));
    await pg.evaluate(`(async () => { const x = ${C}; x.answerTo = 'file'; x.answerComment = false; await x.answerCall(); })()`);
    await pg.waitForTimeout(300);
    const after = await pg.evaluate(`(() => { const x = ${C}; return { base: x.fileBase, confirmed: x.confirmedCount }; })()`);
    ok('to the file\'s branch: committed with no branch named, and GitHub\'s copy moves under the page',
      docPuts.length === 2 && docPuts[1].branch === '' && after.base === docPuts[1].text && after.confirmed === 0
      && answers.trim().split('\n').length === 2 && comments.length === 1, JSON.stringify({ docPuts, after }));
    await cx.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(failures.length ? `\n${failures.length} failure(s): ${failures.join(', ')}` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
