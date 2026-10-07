// Shoot pages/dictate.html answering a documentation call: the call's head
// under the header and its edits staged as change cards. The shim serves the
// call from the web-tools-private checkout and the file from this one, each at
// its working tree, so a call written there and not yet pushed is the one drawn.
//
//   npm run shot -- pages/dictate.html --width 390 --height 844 --touch \
//     --query "file=mehrlander/web-tools:docs/text-tools.md&user-call=mehrlander/web-tools-private:user-calls/a710e806-text-tools-tighten.json" \
//     --script node/render/scenarios/dictate-user-call.mjs
//
//   CALL_STEP=head    (default) the head closed, the first card under it
//   CALL_STEP=open    the head opened: recommendation, standing, links
//   CALL_STEP=sheet   both edits confirmed and the answer sheet open, on its
//                     default destination, Record (a session applies the patch)
//   CALL_STEP=answer  the first edit confirmed, the second discarded with a
//                     note on it, and the answer sheet open on its JSON
//   CALL_STEP=raw     the Raw · changes face: the same cards over the markdown
//   CALL_STEP=info    the second card's Info: its note, the call's why until
//                     edited, read as text with a pencil
//   CALL_STEP=edit    the same note after the pencil: the field and Done
//   CALL_STEP=mine    the note edited and Done: the reader's, with the arrow
//                     back to the call's note
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
  if (STEP === 'raw') {
    await page.evaluate(`${c}.setFace('raw-changes')`);
    await page.waitForTimeout(600);
    await page.evaluate(`(() => { const x = ${c}; x.$refs.md.querySelector('[data-md-card]').scrollIntoView({ block: 'start' }); x.$refs.view.scrollTop -= 8; })()`);
    await page.waitForTimeout(300);
    return;
  }
  if (['info', 'edit', 'mine'].includes(STEP)) {
    await page.evaluate(`${c}.$refs.md.querySelector('[data-md-card="1"]').scrollIntoView({ block: 'center' })`);
    await page.waitForTimeout(300);
    await page.locator('[data-md-card="1"] [data-md-card-badge]').tap();
    await page.waitForTimeout(500);
    if (STEP === 'info') return;
    await page.locator('[data-info-edit]').tap();
    await page.waitForTimeout(300);
    if (STEP === 'edit') return;
    await page.keyboard.press('End');
    await page.keyboard.type(', which the doc no longer needs to explain');
    await page.locator('[data-info-done]').tap();
    await page.waitForTimeout(400);
    return;
  }
  if (STEP === 'sheet') {
    await page.evaluate(`(async () => { const x = ${c}; x.toggleConfirm(0); x.toggleConfirm(1); await x.openAnswer(); })()`);
    await page.waitForTimeout(500);
    await page.evaluate(`console.log('SHEET ' + JSON.stringify({ to: ${c}.answerTo, rows: ${c}.answerRows }))`);
    return;
  }
  if (STEP !== 'answer') return;
  await page.evaluate(`(async () => { const x = ${c}; x.openCardInfo(1, x.$refs.md.querySelector('[data-md-card="1"] [data-md-card-badge]'), true);
    await new Promise((r) => setTimeout(r, 150)); x.setNote('Keep this: it says why the threshold is not the share of link words.'); x.cardInfo = null; })()`);
  await page.evaluate(`(() => { const x = ${c}; x.toggleConfirm(0); })()`);
  await page.waitForTimeout(250);
  await page.evaluate(`(() => { const x = ${c}; x.rejectCard(window.MdSurface.cards(x.$refs.md)[1]); })()`);
  await page.waitForTimeout(400);
  await page.evaluate(`(async () => { const x = ${c}; await x.openAnswer(); })()`);
  await page.waitForTimeout(400);
  await page.evaluate(`(() => { const x = ${c}; x.answerPreview = true; console.log('DECISIONS ' + JSON.stringify(x.answerRows)); })()`);
  await page.waitForTimeout(300);
};
