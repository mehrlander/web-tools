// screenshot.mjs interaction scenario: the app's Waiting view, with the user
// calls read from web-tools-private's checkout and the Text collection's
// proposed edits from home's, both through the sibling-contents shim.
//
//   node tools/render/screenshot.mjs app/index.html \
//     --script tools/render/scenarios/app-waiting.mjs --out tools/.preview/app-waiting.png --full
//
// The app boots tokenless in a render, so a token is set here and the shell's
// count and view are driven by hand; the shim ignores the token. Logs WAITING
// with what the view read, so the log says what the PNG shows.
//
//   WAITING_STEP=view   (default) the list, and the first open call's detail
//                       beside it on a wide pane
//   WAITING_STEP=file   the file with most proposals selected, its staged
//                       proposals drawn inline
//   WAITING_STEP=call   the first call selected by a tap, which on a phone is
//                       the detail's own screen
//   WAITING_STEP=keys   Down twice from the first row: the second file, focused
//   WAITING_STEP=docs   the Map view's Docs tab instead, filtered to the
//                       documents with proposed edits
const STEP = process.env.WAITING_STEP || 'view';
const C = 'document.querySelector(\'[data-pane="waiting"] [x-data="waiting()"]\')?._x_dataStack?.[0]';
export default async function (page) {
  await page.waitForFunction(() => window.__shell && window.Alpine && window.UserCalls, null, { timeout: 30000 });
  await page.evaluate(async () => { window.TOKEN = 'shot-token'; await window.__shell.loadWaitingCount(); });
  if (STEP === 'docs') {
    await page.evaluate(() => window.__shell.goMap('docs'));
    await page.waitForFunction(() => { const m = document.querySelector('[x-data="map()"]')?._x_dataStack?.[0];
      return m && m.docsReg && m.docPending; }, null, { timeout: 90000 });
    await page.evaluate(() => { const m = document.querySelector('[x-data="map()"]')._x_dataStack[0]; m.toggleDocPending();
      console.log('DOCS ' + JSON.stringify({ pending: m.docPendingCount, rows: m.docDirFiles.map((d) => d.path + ':' + (m.pendingOf(d)?.staged || 0) + '/' + (m.pendingOf(d)?.calls.length || 0)) })); });
    await page.waitForTimeout(600);
    return;
  }
  await page.evaluate(() => window.__shell.goWaiting());
  await page.waitForFunction(`(() => { const x = ${C}; return x && !x.loadingCalls && !x.loadingPending && x.pending; })()`, null, { timeout: 90000 });
  if (STEP === 'file') await page.evaluate(`(() => { const x = ${C}; x.pick('file', x.groups[0].files[0].file); })()`);
  if (STEP === 'call') await page.locator('[data-waiting-call]').first().tap().catch(() => page.locator('[data-waiting-call]').first().click());
  // WAITING_STEP=keys: the first row focused, then Down twice, which lands on
  // the second file, the detail following.
  if (STEP === 'keys') {
    await page.locator('[data-waiting-call]').first().focus();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  }
  await page.waitForTimeout(1500);
  await page.evaluate(`(() => { const x = ${C}; console.log('WAITING ' + JSON.stringify({ summary: x.summary, open: x.openCalls.map((c) => c.id),
    sel: x.sel, diffs: document.querySelectorAll('[data-waiting-diff] .md-diff-ins, [data-waiting-diff] .md-diff-del').length,
    groups: x.groups.map((g) => g.repo + ' ' + g.staged + '/' + g.files.length), badge: window.__shell.waitingCount })); })()`);
}
