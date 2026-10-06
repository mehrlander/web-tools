// screenshot.mjs interaction scenario: the PROJECT VIEW's Overview as a
// workspace that declares a `landing` page draws it, that page whole in a frame
// (app/index.html, projectLandingUrl), ahead of an installation or a README.
//
//   node tools/render/screenshot.mjs app/index.html \
//     --script tools/render/scenarios/project-overview-landing.mjs \
//     --out tools/.preview/project-overview-landing.png
//
// The one workspace that declares a landing is private (home's
// projects/budget-drs, whose landing is the budget-drs app), so this stubs a
// manifest with one stand-in workspace whose landing is a public page of this
// repo, pages/doc-growth.html, served from the working tree. Nothing private
// reaches a public shot.
export default async function (page) {
  const ok = await page.evaluate(async () => {
    if (!window.Alpine || !window.__shell) return 'no shell';
    window.TOKEN = 'stand-in-token';
    const shell = window.__shell;
    const store = window.Alpine.store('browser');
    const MANIFEST = { projects: [{ path: 'site', label: 'site', landing: 'pages/doc-growth.html' }] };
    store.gh = {
      repo: 'mehrlander/web-tools', ref: 'main',
      async get(p) {
        if (p === '.web-tools.json') return { text: JSON.stringify(MANIFEST) };
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
    shell.goProject('site', 'overview');
    return true;
  });
  if (ok !== true) throw new Error('project-overview-landing scenario: ' + ok);
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some(f => f.getClientRects().length && f.src),
    null, { timeout: 20000 });
  await page.waitForTimeout(6000);
}
