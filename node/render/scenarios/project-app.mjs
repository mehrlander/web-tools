// screenshot.mjs interaction scenario: the PROJECT VIEW's App tab, which a
// workspace that declares a `landing` page gains: that page whole in a frame
// (app/index.html, projectLandingUrl), opened by the App button beside the
// project name, under a mark drawn as the project's `icon` SVG.
//
//   node node/render/screenshot.mjs app/index.html \
//     --script node/render/scenarios/project-app.mjs \
//     --out node/.preview/project-app.png
//
// The one workspace that declares a landing is private (home's
// projects/budget-drs, whose landing is the budget-drs app), so this stubs a
// manifest with one stand-in workspace whose landing is a public page of this
// repo, pages/doc-growth.html, served from the working tree, and whose icon is
// Web Tools' own favicon. Nothing private reaches a public shot.
export default async function (page) {
  const ok = await page.evaluate(async () => {
    if (!window.Alpine || !window.__shell) return 'no shell';
    window.TOKEN = 'stand-in-token';
    const shell = window.__shell;
    const store = window.Alpine.store('browser');
    const ICON = 'lib/favicon.svg';
    const MANIFEST = { projects: [{ path: 'site', label: 'site', landing: 'pages/doc-growth.html', icon: ICON }] };
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
    // The shell reads a repo's workspaces from its parsed manifest (repoProjects).
    store.config = MANIFEST;
    store.defaultRef = 'main';
    store.ref = 'main';
    store.repo = 'mehrlander/web-tools';
    await new Promise(r => setTimeout(r, 300));
    shell.goProject('site', 'app');
    return true;
  });
  if (ok !== true) throw new Error('project-app scenario: ' + ok);
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some(f => f.getClientRects().length && f.src),
    null, { timeout: 20000 });
  await page.waitForTimeout(6000);
}
