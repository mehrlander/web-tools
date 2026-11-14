// The Activity row's Usage tab over stand-in usage extracts, so it can be shot
// without a token: the pane reads the private session store, which the sandbox
// cannot reach.
//
//   npm run shot -- app/index.html --query view=usage \
//     --script node/render/scenarios/usage-view.mjs --full
//   npm run shot -- app/index.html --query view=usage --width 390 --height 844 --touch \
//     --script node/render/scenarios/usage-view.mjs --full
//
// The extracts are the made-up ones the suite reads, node/test/fixtures/usage.
// USAGE_EXTRACTS names another folder of them instead, read through every
// level: a checkout of the session store's sessions/usage shows the real
// proportions. Such a shot holds what each session was first asked, so it
// stays out of this repository.
//
// USAGE_PANE=spend|calls|reloads|continue|compactions picks the reading;
// without it the pane is left on the one it opened on, or a look link chose.
// USAGE_SCOPE=warm|lapsed picks the Continue chip.
// USAGE_NOW=<ISO time> sets the page's clock, which Continue reads; without it
// the clock is twenty minutes after the newest session's last step, so at
// least one session is warm.
// USAGE_MARK=<n> marks the nth compaction row (1-based) and its dot.
// USAGE_TIP=<selector> hovers the first match, which opens its title-tip.
// USAGE_THEME=<daisyUI theme> sets the page's theme, dark for the dark hues.
//
// The stand-in answers the two reads the pane makes: the listings under
// sessions/usage, each file with its git blob sha, and a blob by that sha.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const blobSha = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.json') ? [path.join(dir, d.name)] : []));

export default async (page, ctx) => {
  const dir = process.env.USAGE_EXTRACTS || path.join(ctx.repoRoot, 'node/test/fixtures/usage');
  const files = walk(dir).sort().map((f) => {
    const bytes = fs.readFileSync(f);
    const name = path.basename(f), data = JSON.parse(bytes.toString('utf8'));
    return { name, month: String(data.day || '').slice(0, 7).replace('-', '/'), sha: blobSha(bytes), text: bytes.toString('utf8'), last: data.last_step_at || '' };
  }).filter((f) => /^\d{4}\/\d{2}$/.test(f.month));
  if (!files.length) throw new Error('usage-view scenario: no usage extracts under ' + dir);
  const newest = files.map((f) => Date.parse(f.last)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  const now = process.env.USAGE_NOW ? Date.parse(process.env.USAGE_NOW) : newest + 20 * 60000;
  const pane = process.env.USAGE_PANE || '';

  await page.evaluate(({ files, now }) => {
    Date.now = () => now;
    window.TOKEN = 'FAKE';
    window.__shell.hasToken = () => true;
    // A read the sandbox refuses would otherwise send the shell to its token view.
    window.__shell.routeAuthFail = () => {};
    const ROOT = 'sessions/usage';
    const months = [...new Set(files.map((f) => f.month))];
    const byName = (a, b) => a.name.localeCompare(b.name);
    const ls = window.GH.prototype.ls, req = window.GH.prototype.req;
    window.GH.prototype.ls = async function (p, ...rest) {
      if (p !== ROOT && !String(p).startsWith(ROOT + '/')) return ls.call(this, p, ...rest);
      const at = String(p).slice(ROOT.length + 1);
      if (!at) return [...new Set(months.map((m) => m.slice(0, 4)))].map((y) => ({ type: 'dir', name: y, path: ROOT + '/' + y })).sort(byName);
      if (/^\d{4}$/.test(at)) return months.filter((m) => m.startsWith(at + '/')).map((m) => ({ type: 'dir', name: m.slice(5), path: ROOT + '/' + m })).sort(byName);
      return files.filter((f) => f.month === at).map((f) => ({ type: 'file', name: f.name, path: ROOT + '/' + at + '/' + f.name, sha: f.sha, size: f.text.length })).sort(byName);
    };
    window.GH.prototype.req = async function (p, ...rest) {
      const m = /^git\/blobs\/([0-9a-f]{40})$/.exec(String(p));
      const f = m && files.find((x) => x.sha === m[1]);
      if (!f) return req.call(this, p, ...rest);
      return { sha: f.sha, encoding: 'base64', content: window.GH.toBase64(f.text) };
    };
    window.__shell.goUsage();
  }, { files, now });

  const usage = () => {
    const el = document.querySelector('[x-data="usage(usageCfg)"]');
    return el && window.Alpine.$data(el);
  };
  // Opened by its address, the pane has already tried the real store and
  // failed; either way it reads again, now through the stand-in.
  await page.waitForFunction(`(${usage})() && !(${usage})().loading`, null, { timeout: 30000 });
  await page.evaluate(async ({ pane, scope, usage }) => {
    const d = new Function('return (' + usage + ')()')();
    if (!d.r) await d.refresh();
    if (pane) d.show(pane);
    if (scope) d.scope = scope;
  }, { pane, scope: process.env.USAGE_SCOPE || '', usage: String(usage) });
  await page.waitForFunction(`(${usage})().r`, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  if (process.env.USAGE_THEME) {
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, process.env.USAGE_THEME);
    await page.waitForTimeout(400);
  }
  const mark = +(process.env.USAGE_MARK || 0);
  if (mark && pane === 'compactions') {
    await page.evaluate((n) => {
      const row = document.querySelectorAll('[data-usage-compaction]')[n - 1];
      row?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    }, mark);
    await page.waitForTimeout(200);
  }
  if (process.env.USAGE_TIP) {
    await page.locator(process.env.USAGE_TIP).first().hover({ force: true });
    await page.waitForTimeout(400);
  }
};
