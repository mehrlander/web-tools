// Shoot pages/dictate.html in file mode with notes on blocks: the caret in an
// unchanged paragraph outlines it and puts a note badge at its top left, the
// badge opens the block's note, and a block left holding a note keeps a mark
// in the margin. NOTES_STEP picks how far it goes, so one scenario shows each
// state:
//
//   npm run shot -- pages/dictate.html --width 390 --height 844 --touch \
//     --query "file=mehrlander/web-tools:docs/annotation.md" \
//     --script tools/render/scenarios/dictate-notes.mjs
//
//   NOTES_STEP=caret    the caret in the second paragraph: outline and badge
//   NOTES_STEP=note     (default) its badge tapped and a note written
//   NOTES_STEP=marked   the caret moved on: the margin mark, and a card's mark
//   NOTES_STEP=send     the Send sheet on the record, its preview open
//   NOTES_STEP=hover    on a desk (no --touch, --width 1280): the mouse over a
//                       paragraph outlines it, the caret's block left alone
const STEP = process.env.NOTES_STEP || 'note';
const wait = (page, ms) => page.waitForTimeout(ms);
const c = 'document.querySelector(\'[x-data="dictate"]\')._x_dataStack[0]';

// Any sideways overflow the badges made, into the shot's log after each step.
const overflow = (page) => page.evaluate(`(() => { const v = ${c}.$refs.view; console.log('OVERFLOW ' + (v.scrollWidth - v.clientWidth)); })()`);

export default async (page) => {
  try { await steps(page); } finally { await overflow(page); }
};
const steps = async (page) => {
  await page.waitForFunction(`${c}.rendered && document.querySelector('[data-md-block]')`, null, { timeout: 20000 });
  await wait(page, 300);
  // The caret into the second paragraph, as a tap would put it.
  await page.evaluate(`(() => { const x = ${c}; const p = x.$refs.md.querySelectorAll('[data-md-block] p')[1];
    const at = +p.querySelector('[data-src]').dataset.src + 3; x.d.caretAt(at); x.paint(); })()`);
  await wait(page, 300);
  if (STEP === 'caret') return;
  if (STEP === 'hover') {
    const box = await page.evaluate(`(() => { const r = ${c}.$refs.md.querySelectorAll('[data-md-block] p')[2].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 8 }; })()`);
    await page.mouse.move(box.x, box.y);
    await wait(page, 300);
    return;
  }
  // A tap, not a click: a click is a mouse, and a mouse resting on the
  // badge would keep its block marked as hovered for every step after.
  await page.locator('[data-md-block-badge]').tap();
  await wait(page, 250);
  await page.locator('[data-info-note]').first().fill('Does the page still say this? Check before the next edit.');
  await wait(page, 200);
  if (STEP === 'note') return;
  // Close the panel, edit the first paragraph so it becomes a card with a
  // note of its own, and leave the caret at the top.
  await page.keyboard.press('Escape');
  await page.evaluate(`(() => { const x = ${c}; const p = x.$refs.md.querySelectorAll('[data-md-block] p')[0];
    const s = +p.querySelector('[data-src]').dataset.src; x.d.text = x.text.slice(0, s) + 'An ' + x.text.slice(s); x.paint(); })()`);
  await wait(page, 250);
  await page.evaluate(`(() => { const x = ${c}; const u = x.unitsNow().find((u) => u.card === 0);
    x.notes = [...x.notes, window.DictateRecord.make(u, x.fileBase, x.text, 'Why the article?')]; x.d.caretAt(0); x.paint(); })()`);
  await wait(page, 300);
  if (STEP === 'marked') return;
  await page.evaluate(`(() => { const x = ${c}; x.openSend(); x.sendPreview = true; })()`);
  await wait(page, 400);
  // Both readings into the shot's log, where they can be read in full.
  await page.evaluate(`(() => { const x = ${c}; console.log('RECORD-MD\\n' + x.sharePayload); x.recordAs = 'json';
    console.log('RECORD-JSON\\n' + x.sharePayload); x.recordAs = 'md'; })()`);
  await wait(page, 100);
};
