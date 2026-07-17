// screenshot.mjs interaction scenario: the estate's scrollable-row layout
// with a nested companion card.
//
//   node tools/render/screenshot.mjs pages/show-repo/show-repo.html \
//     --script tools/render/scenarios/estate-rows.mjs --out tools/.preview/estate-rows.png
//
// The sandbox blocks api.github.com and the real registry is private, so the
// scenario stubs the GH instance methods the estate touches with a neutral
// fixture registry (repo names invented; only the strings the public page
// already names — the default repo, the registry repo, the home hinge — are
// real). What the pixels prove: the two snap-scroll rows, trailing cards off
// to the side, and the web-tools-private strip nested under the web-tools
// card, at the viewport the shot is taken at.
export default async function (page) {
  const ok = await page.evaluate(() => {
    if (!window.Alpine || !window.__shell || !window.GH) return 'no shell';
    window.TOKEN = 'fixture-token';

    const REGISTRY = {
      repos: [
        { repo: 'mehrlander/home', icon: 'ph-house', group: 'core', note: 'Knowledge base and agent memory layer.' },
        { repo: 'mehrlander/web-tools', icon: 'ph-toolbox', group: 'core', note: 'Browser tools and kits; hosts this shell.' },
        { repo: 'mehrlander/web-tools-private', icon: 'ph-shield-check', group: 'core', note: 'The private registry.' },
        { repo: 'mehrlander/field-notes', icon: 'ph-chats', group: 'archives', note: 'An archive repo, off to the side.' },
        { repo: 'mehrlander/data-one', icon: 'ph-scales', group: 'data', note: 'A data repo on the second row.' },
        { repo: 'mehrlander/data-two', icon: 'ph-chart-line-up', group: 'data', note: 'Another data repo.' },
        { repo: 'mehrlander/gizmos', icon: 'ph-lightning', group: 'tools', note: 'A tools repo, off to the side.' },
      ],
    };
    const PINS = {
      'mehrlander/web-tools': ['pages', 'lib', 'docs/CONVENTIONS.md'],
      'mehrlander/web-tools-private': ['surfaces', 'state'],
      'mehrlander/home': ['chron', 'created'],
    };

    const origGet = window.GH.prototype.get;
    const origReq = window.GH.prototype.req;
    const origLs = window.GH.prototype.ls;
    window.GH.prototype.get = async function (name) {
      if (name === '.web-tools.json') {
        if (this.repo === window.__shell.REGISTRY_REPO) return { text: JSON.stringify(REGISTRY) };
        if (PINS[this.repo]) return { text: JSON.stringify({ pins: PINS[this.repo] }) };
        throw Object.assign(new Error('404'), { status: 404 });
      }
      return origGet.call(this, name);
    };
    window.GH.prototype.req = async function (path) {
      if (typeof path === 'string' && path.startsWith('/repos/')) {
        const repo = path.slice('/repos/'.length);
        const priv = repo !== 'mehrlander/web-tools';
        return { default_branch: 'main', description: '', private: priv,
                 pushed_at: new Date(Date.now() - 36e5 * (3 + repo.length)).toISOString() };
      }
      return origReq.call(this, path);
    };
    window.GH.prototype.ls = async function (path) {
      if (path === 'surfaces') throw Object.assign(new Error('404'), { status: 404 });
      return origLs.call(this, path);
    };

    // A bare open already mounted the estate (it is the front door), with the
    // pre-patch token state; re-run its load now that the fixture is in place.
    window.__shell.goEstate();
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('estate('));
    if (!host) return 'no estate host';
    window.Alpine.$data(host).load();
    return true;
  });
  if (ok !== true) throw new Error('estate scenario: ' + ok);

  await page.waitForFunction(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('estate('));
    if (!host) return false;
    const d = window.Alpine.$data(host);
    return !d.loading && d.rows.length >= 2 && d.entries.some(e => e.child);
  }, { timeout: 20000 });
  await page.waitForTimeout(400);
  // Settle every row at its resting position: the shot shows the layout as
  // opened, not wherever async fills left the scroll.
  await page.evaluate(() => {
    document.querySelectorAll('.snap-x').forEach(el => { el.scrollLeft = 0; });
  });
  await page.waitForTimeout(150);
}
