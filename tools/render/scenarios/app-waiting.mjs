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
  await page.waitForTimeout(500);
  await page.evaluate(`(() => { const x = ${C}; console.log('WAITING ' + JSON.stringify({ summary: x.summary, open: x.openCalls.map((c) => c.id),
    groups: x.groups.map((g) => g.repo + ' ' + g.staged + '/' + g.files.length), badge: window.__shell.waitingCount })); })()`);
}
