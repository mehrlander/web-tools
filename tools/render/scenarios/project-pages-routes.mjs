// screenshot.mjs interaction scenario: the PROJECT VIEW's Pages tab with ROUTE
// cards, the entries that name the workspace's landing with a `query` and open
// the App tab there (app/index.html, projectPages). A route card shows its
// cached shot or the project's icon, never a live frame; the ordinary page
// beside them keeps its lazy live preview.
//
//   node tools/render/screenshot.mjs app/index.html \
//     --script tools/render/scenarios/project-pages-routes.mjs \
//     --out tools/.preview/project-pages-routes.png
//
// The one workspace with real route cards is private (home's
// projects/budget-drs, into the budget-drs app), so this stubs a manifest with
// one stand-in workspace whose landing is a public page of this repo,
// pages/doc-growth.html, with two routes into it and one ordinary page, and
// whose icon is Web Tools' own favicon. The registry holds no shot for a
// stand-in, so the route cards draw the icon. Nothing private reaches a public
// shot.
export default async function (page) {
  const ok = await page.evaluate(async () => {
    if (!window.Alpine || !window.__shell) return 'no shell';
    window.TOKEN = 'stand-in-token';
    const shell = window.__shell;
    const store = window.Alpine.store('browser');
    const ICON = 'lib/favicon.svg';
    const LANDING = 'pages/doc-growth.html';
    const MANIFEST = {
      projects: [{ path: 'site', label: 'site', landing: LANDING, icon: ICON }],
      pages: [
        { path: LANDING, title: 'Doc growth', project: 'site' },
        { path: LANDING, query: 'src=self', title: 'Growth: this repo', note: 'A route into the app: the App tab at ?src=self.', project: 'site' },
        { path: LANDING, query: 'src=self&kind=docs', title: 'Growth: docs', note: 'A second route into the same page.', project: 'site' },
        { path: 'pages/links.html', title: 'Links', note: 'An ordinary page, previewed live.', project: 'site' },
      ],
    };
    store.gh = {
      repo: 'mehrlander/web-tools', ref: 'main',
      async get(p) {
        if (p === '.web-tools.json') return { text: JSON.stringify(MANIFEST) };
        if (p === ICON) return { text: await (await fetch('../' + ICON)).text() };
        const e = new Error('404'); e.status = 404; throw e;
      },
      async req() { const e = new Error('404'); e.status = 404; throw e; },
      ago: () => 'just now',
    };
    store.config = MANIFEST;
    store.defaultRef = 'main';
    store.ref = 'main';
    store.repo = 'mehrlander/web-tools';
    await new Promise(r => setTimeout(r, 300));
    shell.goProject('site', 'pages');
    return true;
  });
  if (ok !== true) throw new Error('project-pages-routes scenario: ' + ok);
  await page.waitForFunction(() => document.querySelectorAll('[data-project-route]').length === 2, null, { timeout: 20000 });
  await page.waitForTimeout(4000);
}
