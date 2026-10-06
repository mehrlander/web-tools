// screenshot.mjs interaction scenario: the PROJECT VIEW's Overview as a
// workspace that declares an `installation` manifest draws it, the installation
// view (lib/alpineComponents/installation-view.js), which declares a List and
// detail (data/ui-units/codebook.md, "Declaring a pattern in markup").
//
//   node tools/render/screenshot.mjs app/index.html \
//     --script tools/render/scenarios/project-overview-installation.mjs \
//     --out tools/.preview/project-overview-installation.png
//
// The one workspace that declares an installation is private (home's
// projects/wps), so this stubs a manifest with one stand-in workspace and
// answers its reads with the fixture tools/test/installation-view.test.mjs
// mounts: a PowerShell profile, a module, a form and a script against a
// manifest of four areas. Nothing private reaches a public shot.
export default async function (page) {
  const ok = await page.evaluate(async () => {
    if (!window.Alpine || !window.__shell) return 'no shell';
    window.TOKEN = 'stand-in-token';
    const shell = window.__shell;
    const store = window.Alpine.store('browser');
    const P = 'wps';
    const MANIFEST = { projects: [{ path: P, label: 'wps', installation: P + '/data/installation.json' }] };
    const FILES = {
      [P + '/data/installation.json']: JSON.stringify({
        root: 'Documents\\WindowsPowerShell', observations: P + '/data/observations.csv',
        correspondence: [
          { repo: 'app/Profile.ps1', area: 'Profile', installs: '' },
          { repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' },
          { repo: 'app/Forms/', area: 'Forms', installs: 'Forms/' },
          { repo: 'app/Scripts/', area: 'Scripts', installs: null },
        ],
        local_areas: [{ name: 'Leg', status: 'unresolved', shape: 'reportedly bill collections' },
                      { name: 'ISELog', status: 'local-only', shape: 'ZIP snapshots of editor text' }],
        pending_adoption: [],
      }),
      [P + '/data/observations.csv']: 'date,path,kind,revision,blob_sha,local_sha256,match,method,note\n',
      [P + '/app/Profile.ps1']: '# profile\nImport-Module Forms\n',
      [P + '/app/Modules/Forms/Forms.psm1']: 'function Import-Form {}\n',
      [P + '/app/Forms/Bookmarks/Bookmarks.ps1']: '# controller\n',
      [P + '/app/Forms/Bookmarks/Bookmarks.xaml']: '<Window/>\n',
      [P + '/app/Scripts/Demo.ps1']: 'Write-Output demo\n',
    };
    const missing = () => { const e = new Error('404'); e.status = 404; throw e; };
    const sha = (p) => (p.length.toString(16) + 'b'.repeat(40)).slice(0, 40);
    store.gh = {
      repo: 'mehrlander/web-tools', ref: 'main',
      async get(p) {
        if (p === '.web-tools.json') return { text: JSON.stringify(MANIFEST) };
        return p in FILES ? { text: FILES[p], sha: sha(p) } : missing();
      },
      async req(p) {
        if (p.startsWith('commits')) return [{ sha: 'a'.repeat(40) }];
        if (p.startsWith('git/trees/')) return { truncated: false,
          tree: Object.keys(FILES).map(path => ({ type: 'blob', path, sha: sha(path), size: FILES[path].length })) };
        return missing();
      },
      ago: () => 'just now',
    };
    // The shell reads a repo's workspaces from its parsed manifest (repoProjects).
    store.config = MANIFEST;
    store.defaultRef = 'main';
    store.ref = 'main';
    store.repo = 'mehrlander/web-tools';
    await new Promise(r => setTimeout(r, 300));
    shell.goProject(P, 'overview');
    return true;
  });
  if (ok !== true) throw new Error('project-overview-installation scenario: ' + ok);
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-pattern="list-detail"] [data-part="item"]')].some(e => e.getClientRects().length),
    null, { timeout: 20000 });
  await page.waitForTimeout(400);
}
