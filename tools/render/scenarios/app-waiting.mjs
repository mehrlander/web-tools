// screenshot.mjs interaction scenario: the app's Waiting view, with the user
// calls read from web-tools-private's checkout and the Text collection's
// proposed edits from home's, both through the sibling-contents shim.
//
//   node tools/render/screenshot.mjs app/index.html \
//     --script tools/render/scenarios/app-waiting.mjs --out tools/.preview/app-waiting.png
//   (a phone: add --width 390 --height 844 --touch)
//
// The app boots tokenless in a render, so a token is set here and the shell's
// count and view are driven by hand; the shim ignores the token. Logs WAITING
// with what the view read and where the list and the strip stand, so the log
// says what the PNG shows.
//
//   WAITING_STEP=view     (default) the Calls tab, its first call's card
//   WAITING_STEP=edit     the Edits tab, the file with most edits
//   WAITING_STEP=tighten  the Tighten tab, the file with most tightenings
//   WAITING_STEP=swipe    the Tighten tab, the strip scrolled by hand two cards
//                         on: the list's selection has to follow it
//   WAITING_STEP=pick     the Tighten tab, the fifth file tapped in the list:
//                         the strip has to land on its card
//   WAITING_STEP=full     the Edits tab with the strip given the whole height
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
  if (STEP !== 'view') {
    await page.locator(`[data-waiting-tab="${STEP === 'edit' || STEP === 'full' ? 'edit' : 'tighten'}"]`).click();
    await page.waitForTimeout(400);
  }
  // A hand swipe, as the strip sees one: its scroll position moved, nothing
  // else told.
  if (STEP === 'swipe') {
    await page.evaluate(() => { const s = document.querySelector('[data-waiting-strip]'); s.scrollTo({ left: s.clientWidth * 2, behavior: 'instant' }); });
  }
  if (STEP === 'pick') await page.locator('[data-waiting-file]').nth(4).click();
  if (STEP === 'full') await page.locator('[data-waiting-full]').click();
  await page.waitForTimeout(1500);
  await page.evaluate(`(() => { const x = ${C}; const s = document.querySelector('[data-waiting-strip]');
    const list = document.querySelector('[data-waiting-rows]'), on = list && list.querySelector('[aria-current="true"]');
    const lb = list && list.getBoundingClientRect(), ob = on && on.getBoundingClientRect();
    console.log('WAITING ' + JSON.stringify({ summary: x.summary, tab: x.tab, open: x.openCalls.map((c) => c.id),
      at: x.at, rows: x.rows.length, cur: x.cur && x.cur.id, review: document.querySelector('[data-waiting-open]')?.getAttribute('href'),
      headName: !!document.querySelector('[data-waiting-name]'), head: Math.round(document.querySelector('[data-waiting-head]')?.getBoundingClientRect().height || 0), card: s ? Math.round(s.scrollLeft / (s.clientWidth || 1)) : null,
      listOn: on ? on.dataset.key : null, rowInList: !!(ob && lb && ob.top >= lb.top - 1 && ob.bottom <= lb.bottom + 1),
      diffs: document.querySelectorAll('[data-waiting-diff] .md-diff-ins, [data-waiting-diff] .md-diff-del').length,
      groups: x.groupsOf(x.tab === 'calls' ? 'edit' : x.tab).map((g) => g.repo + ' ' + g.staged + '/' + g.files.length), badge: window.__shell.waitingCount,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth })); })()`);
}
