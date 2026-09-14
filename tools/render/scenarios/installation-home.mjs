// Answer the GitHub API for mehrlander/home from the sibling checkout, so the
// Installation tab of the wps workspace renders headlessly with real files and
// real blob shas. cdn.mjs impersonates only this repo; the project view's
// subject is a PRIVATE sibling, and without this every read of it fails on the
// sandbox's spent anonymous quota and the pane says the listing failed.
//
// Two fixture knobs, both by environment variable, because the tab's write
// side needs states the checkout does not hold on its own:
//   WPS_OBSERVATIONS=<file>  serve that file as projects/wps/data/observations.csv
//   WPS_ITEM=<repo path>     open the tab on that file (rides as &item=)
//   WPS_TAB=<tab>            the project tab to open (default: installation)
//   WPS_DEBUG=1              print the pane's loaded state, since a shot that
//                            catches it mid-boot looks like a broken pane
// The blob sha is git's own (sha1 over "blob <size>\0" + bytes) so the derived
// states agree with what the live API would say about the same bytes.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const REPO = 'mehrlander/home';

export default async (page, { repoRoot }) => {
  const root = path.resolve(repoRoot, '..', 'home');
  if (!existsSync(root)) throw new Error('sibling checkout ../home is missing');
  const head = execSync('git rev-parse HEAD', { cwd: root }).toString().trim();
  const overlay = {};
  if (process.env.WPS_OBSERVATIONS) overlay['projects/wps/data/observations.csv'] = readFileSync(process.env.WPS_OBSERVATIONS);
  const bytesOf = rel => overlay[rel] ?? readFileSync(path.join(root, rel));
  const blobSha = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const skip = new Set(['.git', 'node_modules']);
  let treeCache = null;
  const tree = () => {
    if (treeCache) return treeCache;
    const out = [];
    const walk = rel => {
      for (const e of readdirSync(path.join(root, rel), { withFileTypes: true })) {
        if (!rel && skip.has(e.name)) continue;
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) { out.push({ path: p, type: 'tree', sha: 'local' }); walk(p); }
        else { const b = bytesOf(p); out.push({ path: p, type: 'blob', sha: blobSha(b), size: b.length }); }
      }
    };
    walk('');
    return (treeCache = JSON.stringify({ sha: head, truncated: false, tree: out }));
  };
  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
  await page.route(`https://api.github.com/repos/${REPO}**`, route => {
    const u = new URL(route.request().url());
    const rest = u.pathname.slice(`/repos/${REPO}`.length).replace(/^\//, '');
    if (route.request().method() !== 'GET') return json(route, { message: 'read-only fixture' }, 403);
    if (!rest) return json(route, { full_name: REPO, name: 'home', owner: { login: 'mehrlander' },
      default_branch: 'main', private: true, description: 'fixture', pushed_at: new Date().toISOString() });
    if (rest.startsWith('git/trees/')) return route.fulfill({ status: 200, contentType: 'application/json', body: tree() });
    if (rest.startsWith('commits')) return json(route, [{ sha: head, commit: { message: 'fixture', author: { date: new Date().toISOString() } } }]);
    if (rest.startsWith('branches')) return json(route, [{ name: 'main', commit: { sha: head } }]);
    if (rest.startsWith('contents/')) {
      const rel = decodeURIComponent(rest.slice('contents/'.length)).replace(/\/$/, '');
      const fp = path.join(root, rel);
      if (overlay[rel] || (existsSync(fp) && !statSync(fp).isDirectory())) {
        const b = bytesOf(rel);
        return json(route, { content: b.toString('base64'), encoding: 'base64', sha: blobSha(b), size: b.length, html_url: '' });
      }
      if (existsSync(fp)) return json(route, readdirSync(fp, { withFileTypes: true }).map(e => ({
        name: e.name, path: rel ? `${rel}/${e.name}` : e.name, type: e.isDirectory() ? 'dir' : 'file', sha: 'local', size: 0 })));
      return json(route, { message: 'Not Found' }, 404);
    }
    console.log('[fixture] unhandled ' + rest);
    return json(route, { message: 'unhandled in fixture: ' + rest }, 404);
  });
  const url = new URL(page.url());
  url.searchParams.set('repo', REPO);
  url.searchParams.set('view', 'project');
  url.searchParams.set('project', 'projects/wps');
  url.searchParams.set('tab', process.env.WPS_TAB || 'installation');
  if (process.env.WPS_ITEM) url.searchParams.set('item', process.env.WPS_ITEM);
  await page.evaluate(() => { window.TOKEN = 'FAKE'; try { localStorage.setItem('ghToken', 'FAKE'); } catch {} });
  await page.goto(url.toString(), { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  if (process.env.WPS_DEBUG) {
    const state = await page.evaluate(() => {
      const el = document.querySelector('[x-data^="installationView"]');
      if (!el) return { mounted: false };
      const d = window.Alpine.$data(el);
      return { mounted: true, loading: d.loading, err: d.err, items: d.items?.length, tab: window.__shell?.projectTab };
    });
    console.log('[wps-debug] ' + JSON.stringify(state));
  }
};
