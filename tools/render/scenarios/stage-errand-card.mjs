// Shoot the Stage opened on one errand by its own link, ?errand=<id>: the card
// on top, graded, with its one button. A fake token and a stubbed registry stand
// in for sign-in and the network; the listing, the grade and the render are the
// page's own.
//
//   npm run shot -- app/index.html --query 'view=stage&errand=read-home-tree' \
//     --script tools/render/scenarios/stage-errand-card.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../../test/bootstrap.mjs';

const REQUESTS = {
  'read-home-tree.json': { id: 'read-home-tree', action: 'tree', repo: 'mehrlander/home',
    note: 'List the files in mehrlander/home', title: 'List the files in mehrlander/home', for: 'mehrlander/home:tracker/tasks/example.md', createdAt: new Date().toISOString() },
  'wps-reports.json': { id: 'wps-reports', note: 'The report list off the work machine, as JSON.', purpose: 'get-data',
    dest: 'mehrlander/home:projects/wps/dump', createdAt: '2026-09-23T00:00:00Z',
    run: { script: 'mehrlander/web-tools@main:tools/render/fixtures/errand-list.ps1', method: 'ise-f5', venue: 'work-machine',
           outputType: 'json', outputSigned: true } },
  'hand-wps.json': { id: 'hand-wps', note: 'The PowerShell loaders off the Windows machine.\nAEF05.ps1 and Get-AEF05Detail are still missing.',
    dest: 'mehrlander/home:projects/wps/dump', expect: { names: ['*.ps1'] }, createdAt: '2026-09-20T00:00:00Z' },
};
const json = (route, body, status = 200) => route.fulfill({ status, body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default async (page) => {
  const script = readFileSync(path.join(repoRoot, 'tools/render/fixtures/errand-list.ps1'), 'utf8');
  const pointer = readFileSync(path.join(repoRoot, 'bookmarklets/courier-stage.js'), 'utf8');
  await page.route('https://api.github.com/**', route => {
    const u = new URL(route.request().url());
    const p = decodeURIComponent(u.pathname);
    if (p === '/user') return json(route, { login: 'mehrlander' });
    const m = p.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/(.*)$/);
    if (m) {
      const [, repo, file] = m;
      if (repo === 'mehrlander/web-tools-private' && file === 'errands/requests')
        return json(route, Object.keys(REQUESTS).map(name => ({ name, type: 'file', path: 'errands/requests/' + name })));
      if (repo === 'mehrlander/web-tools-private' && file.startsWith('errands/requests/')) {
        const text = JSON.stringify(REQUESTS[file.split('/').pop()]);
        return json(route, { type: 'file', encoding: 'base64', content: Buffer.from(text).toString('base64'), sha: 'x', size: text.length });
      }
      if (repo === 'mehrlander/web-tools' && (file === 'tools/render/fixtures/errand-list.ps1' || file === 'bookmarklets/courier-stage.js')) {
        const text = file.endsWith('.ps1') ? script : pointer;
        return json(route, { type: 'file', encoding: 'base64', content: Buffer.from(text).toString('base64'), sha: 'x', size: text.length });
      }
      return json(route, { message: 'Not Found' }, 404);
    }
    const t = p.match(/^\/repos\/mehrlander\/home\/git\/trees\//);
    if (t) return json(route, { truncated: false, tree: Array.from({ length: 1412 }, (_, i) => ({ path: 'f' + i, type: 'blob', size: 1, sha: 'x' })) });
    return json(route, { message: 'Not Found' }, 404);
  });
  await page.evaluate(() => localStorage.setItem('ghToken', 'fake-token-for-a-shot'));
  await page.reload({ waitUntil: 'load' });
  await page.locator('text=List the files in mehrlander/home').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
};
