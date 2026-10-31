// screenshot.mjs interaction scenario: ORIGINALS REPOS, the repos a working
// repo keeps its fetched files in, shown under the working repo that names them
// in its manifest's `originals` field (the shell's repoOriginals).
//
//   node node/render/screenshot.mjs app/index.html --width 390 \
//     --script node/render/scenarios/originals.mjs --out node/.preview/originals.png
//
// ORIGINALS_AT picks the surface:
//   menu     (default) an originals repo open, its masthead switcher open:
//            the repo nested and marked under its working repo, the
//            masthead's way back, and the sidebar section behind the menu
//   sidebar  the same repo, sidebar open and no menu
//   working  the working repo whose PROJECT names one, sidebar open
//   grid     the Repos view, its Originals fold open below the rule
//
// The sandbox blocks api.github.com and the real registry is private, so the
// config cache, the account list and the open repo are stubbed. Repo names are
// invented except the strings the public page already names.
export default async function (page) {
  const at = process.env.ORIGINALS_AT || 'menu';
  const ok = await page.evaluate(async (at) => {
    if (!window.Alpine || !window.__shell || !window.GH) return 'no shell';
    window.TOKEN = 'fixture-token';
    const shell = window.__shell;
    const store = window.Alpine.store('browser');

    const ACCOUNT = [
      { full_name: 'mehrlander/home',            description: 'Knowledge base and agent memory layer.', private: true,  default_branch: 'main', pushed_at: '2026-10-30T22:00:00Z', size: 312000 },
      { full_name: 'mehrlander/web-tools',       description: 'Browser tools and kits.',                private: false, default_branch: 'main', pushed_at: '2026-10-31T02:00:00Z', size: 690000 },
      { full_name: 'mehrlander/budget-wa',       description: 'The WA budget record.',                  private: true,  default_branch: 'main', pushed_at: '2026-10-30T12:41:33Z', size: 950000 },
      { full_name: 'mehrlander/notices-fetched', description: 'Published notices, as fetched.',         private: true,  default_branch: 'main', pushed_at: '2026-10-28T15:03:27Z', size: 2490932 },
      { full_name: 'mehrlander/tables-fetched',  description: 'Statistical tables, as fetched.',        private: true,  default_branch: 'main', pushed_at: '2026-10-08T15:14:12Z', size: 1089791 },
      { full_name: 'mehrlander/reports-fetched', description: 'Annual reports, as published.',          private: true,  default_branch: 'main', pushed_at: '2026-10-30T22:24:51Z', size: 116482 },
      { full_name: 'mehrlander/scratch',         description: 'Odds and ends.',                         private: true,  default_branch: 'main', pushed_at: '2026-06-14T21:34:51Z' },
    ];
    const CONFIGS = { repos: {
      'mehrlander/home':      { config: { estate: true, icon: 'ph-house', group: 'core', order: 9,
        projects: [{ path: 'projects/ledger', label: 'ledger', icon: 'ph-notebook', originals: ['mehrlander/reports-fetched'] }] } },
      'mehrlander/web-tools': { config: { estate: true, icon: 'ph-toolbox', group: 'core', order: 11 } },
      'mehrlander/budget-wa': { config: { estate: true, icon: 'ph-bank', group: 'data', order: 32,
        originals: ['mehrlander/notices-fetched', 'mehrlander/tables-fetched'] } },
      'mehrlander/notices-fetched': { config: null },
      'mehrlander/tables-fetched':  { config: null },
      'mehrlander/reports-fetched': { config: null },
      'mehrlander/scratch':         { config: null },
    } };

    const origGet = window.GH.prototype.get;
    const origReq = window.GH.prototype.req;
    const origLs = window.GH.prototype.ls;
    window.GH.prototype.repos = async function () { return ACCOUNT; };
    window.GH.prototype.get = async function (name) {
      if (/configs\.json$/.test(name) && this.repo === shell.REGISTRY_REPO) return { text: JSON.stringify(CONFIGS) };
      return origGet.call(this, name);
    };
    window.GH.prototype.req = async function (path) {
      if (typeof path === 'string' && path.startsWith('/repos/')) {
        const hit = ACCOUNT.find(r => r.full_name === path.slice('/repos/'.length));
        if (hit) return hit;
      }
      return origReq.call(this, path);
    };
    window.GH.prototype.ls = async function (path) {
      if (path === 'surfaces') throw Object.assign(new Error('404'), { status: 404 });
      return origLs.call(this, path);
    };

    // The estate lists the switchers and the sidebar read, through their real
    // read path over the stubbed cache.
    await shell.loadEstateSidebar();
    await shell.enrichSidebarPrivacy();

    if (at === 'grid') {
      shell.goRepos();
      const host = [...document.querySelectorAll('[x-data]')]
        .find(el => (el.getAttribute('x-data') || '').includes('estate('));
      if (!host) return 'no estate host';
      await window.Alpine.$data(host).load();
      return true;
    }

    // Open a repo the way project-view.mjs does: a stub over the GH the shell
    // holds, so the landing renders without the network.
    const repo = at === 'working' ? 'mehrlander/home' : 'mehrlander/notices-fetched';
    const obj = ACCOUNT.find(r => r.full_name === repo);
    store.gh = {
      repo, ref: 'main',
      async get(p) {
        const cfg = CONFIGS.repos[repo]?.config;
        if (p === '.web-tools.json' && cfg) return { text: JSON.stringify(cfg) };
        const e = new Error('404'); e.status = 404; throw e;
      },
      async req() { return obj; },
      ago: () => 'yesterday',
    };
    store.defaultRef = 'main';
    store.ref = 'main';
    store.repo = repo;
    await new Promise(r => setTimeout(r, 300));
    store.repoObj = { ...obj, stargazers_count: 0, forks_count: 0 };
    shell.view = 'landing';
    shell.sidebarOpen = true;
    return true;
  }, at);
  if (ok !== true) throw new Error('originals scenario: ' + ok);

  if (at === 'grid') {
    await page.waitForFunction(() => {
      const host = [...document.querySelectorAll('[x-data]')]
        .find(el => (el.getAttribute('x-data') || '').includes('estate('));
      const d = host && window.Alpine.$data(host);
      return d && !d.loading && d.unfiledSections.some(s => s.key === 'originals');
    }, { timeout: 20000 });
    await page.evaluate(() => {
      const host = [...document.querySelectorAll('[x-data]')]
        .find(el => (el.getAttribute('x-data') || '').includes('estate('));
      window.Alpine.$data(host).unfiledOpen.originals = true;
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => /Unfiled/.test(h.textContent));
      el?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(200);
    return;
  }

  await page.waitForFunction(() => document.querySelector('[data-originals-section]')?.offsetParent !== null,
    { timeout: 20000 });
  if (at === 'menu') {
    await page.evaluate(() => {
      document.querySelector('[data-repo-switch]')?.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('tables-fetched'), { timeout: 10000 });
  }
  await page.waitForTimeout(400);
}
