// screenshot.mjs interaction scenario: pages/shortcut-log.html as the promoted
// app view `shortcut-log`, with the shell drawn around it.
//
//   npm run shot -- app/index.html --query app=shortcut-log&shell=full \
//     --script tools/render/scenarios/shortcut-log-app-view.mjs --width 390 --height 844 --touch
//
// The address the dumpers open is app/?app=shortcut-log&shell=full. A headless
// run has no token, so the estate sidebar that resolves the slug is empty; this
// stages shortcut-tools' promotion (the same fixture shape approve-app-view.mjs
// uses) and a token the framed page can read, then routes the slug the way a
// cold open does. The log itself is served from the sibling web-tools-private
// checkout. DETAIL=1 taps the first row inside the frame.
export default async function (page) {
  // Identity has no local answer (cdn.mjs), and with a token in storage the
  // shell asks for it; a 401 there swaps the whole app for the token screen.
  await page.route(/api\.github\.com\/user(\/repos)?(\?|$)/, r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: /\/repos/.test(r.request().url()) ? '[]' : '{"login":"mehrlander"}' }));
  const ok = await page.evaluate(() => {
    if (!window.Alpine || !window.__shell || !window.GH) return 'no shell';
    window.TOKEN = 'fixture-token';
    const CONFIGS = { repos: {
      'mehrlander/shortcut-tools': { config: {
        estate: true, icon: 'ph-lightning', group: 'tools', order: 40,
        pages: [{
          path: 'mehrlander/web-tools:pages/shortcut-log.html',
          title: 'Shortcut log', appView: true, viewLabel: 'Shortcut log',
          icon: 'ph-list-checks', order: 32, slug: 'shortcut-log',
        }],
      } },
    } };
    const origGet = window.GH.prototype.get;
    window.GH.prototype.get = async function (name) {
      if (/configs\.json$/.test(name)) return { text: JSON.stringify(CONFIGS) };
      if (/^(state\/|lists\/)/.test(name) || name === '.web-tools.json'
          || name === 'CLAUDE.md' || name === '.claude/settings.json')
        throw Object.assign(new Error('404'), { status: 404 });
      return origGet.call(this, name);
    };
    window.__shell.refreshConfigCache = async () => ({ skipped: true });
    return true;
  });
  if (ok !== true) throw new Error('shortcut-log-app-view scenario: ' + ok);
  await page.evaluate(() => (window.__shell.appViewsReady = window.__shell.loadEstateSidebar()));
  // The framed page reads the token from storage, as it does on the phone.
  await page.evaluate(() => localStorage.setItem('ghToken', 'fixture-token'));
  await page.evaluate(async () => {
    const v = await window.__shell.appViewFromUrl({ app: 'shortcut-log' });
    window.__shell.goAppView(v);
    window.__shell.setShellMode('full');
  });
  const frame = async () => {
    for (let i = 0; i < 60; i++) {
      for (const f of page.frames()) if (await f.$('[data-row]').catch(() => null)) return f;
      await page.waitForTimeout(500);
    }
    return null;
  };
  const f = await frame();
  if (!f) throw new Error('shortcut-log-app-view scenario: no rows in the frame');
  await page.waitForTimeout(2500);
  if (process.env.DETAIL) { await f.locator('[data-row]').first().click(); await page.waitForTimeout(600); }
}
