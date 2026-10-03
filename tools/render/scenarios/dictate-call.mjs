// Shoot pages/dictate.html answering a documentation call: the call's head
// under the header and its edits staged as change cards. The shim serves the
// call and the file from the working tree, so a call written there and not yet
// pushed is the one drawn.
//
//   npm run shot -- pages/dictate.html --width 390 --height 844 --touch \
//     --query "file=mehrlander/web-tools:docs/text-tools.md&call=mehrlander/web-tools:calls/a710e806-text-tools-tighten.json" \
//     --script tools/render/scenarios/dictate-call.mjs
//
//   CALL_STEP=head    (default) the head closed, the first card under it
//   CALL_STEP=open    the head opened: recommendation, standing, links
//   CALL_STEP=answer  the first edit confirmed, the second discarded, and the
//                     answer sheet open on its JSON
//
// Logs CARDS <n> and, at answer, the decisions, so the log says what the page
// read without the PNG.
const STEP = process.env.CALL_STEP || 'head';
const c = 'document.querySelector(\'[x-data="dictate"]\')._x_dataStack[0]';

export default async (page) => {
  await page.waitForFunction(`${c}.rendered && ${c}.call && document.querySelector('[data-md-card]')`, null, { timeout: 20000 });
  await page.waitForTimeout(4800);
  await page.evaluate(`console.log('CARDS ' + window.MdSurface.cards(${c}.$refs.md).length)`);
  if (STEP === 'open') {
    await page.locator('[data-call-head] button[aria-expanded]').tap();
    await page.waitForTimeout(300);
    return;
  }
  if (STEP !== 'answer') return;
  await page.evaluate(`(() => { const x = ${c}; x.toggleConfirm(0); })()`);
  await page.waitForTimeout(250);
  await page.evaluate(`(() => { const x = ${c}; x.rejectCard(window.MdSurface.cards(x.$refs.md)[1]); })()`);
  await page.waitForTimeout(400);
  await page.evaluate(`(async () => { const x = ${c}; await x.openAnswer(); })()`);
  await page.waitForTimeout(400);
  await page.evaluate(`(() => { const x = ${c}; x.answerPreview = true; console.log('DECISIONS ' + JSON.stringify(x.answerRows)); })()`);
  await page.waitForTimeout(300);
};
