// screenshot.mjs interaction scenario: pages/approve.html as a promoted app
// view, with the shell drawn around it.
//
//   node tools/render/screenshot.mjs app/index.html \
//     --script tools/render/scenarios/approve-app-view.mjs \
//     --out tools/.preview/approve-app-view.png
//
// Two things this exists to show, and the second is why it is a scenario rather
// than a bare --query address.
//
// An app view opens at shell=none by design (docs/show-repo.md, "?shell="): the
// reader who addressed a promoted page by name asked for the page, not for the
// app around it. So a link handed over to show how the view sits IN the app
// has to say shell=full, and one that omits it correctly renders the page bare.
// That is what a reader reported on 2026-09-16 after being given the bare form.
//
// And the estate sidebar reads configs.json through the viewer's token, which a
// headless run does not have, so the shell boots with no repos and no app views
// at all. Staging the config is the whole job here; it is the same fixture
// shape sidebar-view-labels.mjs uses, cut to one repo and one view.
export default async function (page) {
  const ok = await page.evaluate(() => {
    if (!window.Alpine || !window.__shell || !window.GH) return 'no shell';
    window.TOKEN = 'fixture-token';

    const CONFIGS = { repos: {
      'mehrlander/web-tools': { config: {
        estate: true, icon: 'ph-toolbox', group: 'core', order: 1,
        note: 'The public hub.',
        pages: [{
          path: 'pages/approve.html',
          title: 'Approve',
          appView: true,
          viewLabel: 'Approve',
          icon: 'ph-seal-check',
          slug: 'approve',
          query: 'src=mehrlander/web-tools@claude/record-document-gating-fu48ar:'
               + 'approvals/2026-09-16-marker-vocabulary.request.json',
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
    window.__shell.goDashboard();
    return true;
  });
  if (ok !== true) throw new Error('approve-app-view scenario: ' + ok);

  await page.evaluate(() => window.__shell.loadEstateSidebar());
  await page.waitForFunction(() => (window.__shell?.appViews || []).length >= 1, { timeout: 20000 });
  // Open the view and draw the header around it, which is the state the bare
  // address does NOT produce and the one a reader asking "show me it in the
  // app" means.
  await page.evaluate(() => {
    window.__shell.goAppView(window.__shell.appViews[0]);
    // setShellMode, not an assignment: shellMode is a GETTER over _shellChoice
    // and the view's default, so writing to it is a silent no-op that leaves
    // the app view at its bare default and looks exactly like the bug this
    // scenario exists to rule out.
    window.__shell.setShellMode('full');
  });
  await page.waitForTimeout(6000);
}
