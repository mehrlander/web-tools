// Shoot pages/dictate.html reviewing the proposal queue: file mode with
// &proposed, so the Text collection's proposals for the file arrive as change
// cards. The shim serves home's working tree, so proposals filed there and not
// yet pushed are what the page stages.
//
//   npm run shot -- pages/dictate.html --width 390 --height 844 --touch \
//     --query "file=mehrlander/web-tools:docs/text-tools.md&proposed" \
//     --script node/render/scenarios/dictate-proposed.mjs
//
//   PROPOSED_STEP=cards    (default) the staged cards, the first in view
//   PROPOSED_STEP=confirm  the first card confirmed, Apply waiting
//
// Logs CARDS <n> and one CARD line per card (its new text's opening words),
// so the log says what was staged without reading the PNG.
const STEP = process.env.PROPOSED_STEP || 'cards';
const c = 'document.querySelector(\'[x-data="dictate"]\')._x_dataStack[0]';

export default async (page) => {
  await page.waitForFunction(`${c}.rendered && document.querySelector('[data-md-card]')`, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.evaluate(`(() => { const x = ${c}; const runs = window.MdSurface.cards(x.$refs.md);
    console.log('CARDS ' + runs.length);
    runs.forEach((_, i) => console.log('CARD ' + i + ' ' + x.cardSpans(i).N.s.replace(/\\s+/g, ' ').slice(0, 70))); })()`);
  await page.evaluate(`(() => { const x = ${c}; x.$refs.md.querySelector('[data-md-card]').scrollIntoView({ block: 'start' }); x.$refs.view.scrollTop -= 56; })()`);
  await page.waitForTimeout(300);
  if (STEP === 'cards') return;
  // The card's own confirm shows only under the caret, so call what it calls.
  await page.evaluate(`${c}.toggleConfirm(0)`);
  await page.waitForTimeout(400);
};
