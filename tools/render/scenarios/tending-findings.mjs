// The Tending view over the REAL notes store, checking its witnesses ITSELF.
//
// SHOT_GIT_API (tools/render/cdn.mjs) answers the view's GitHub reads from the
// checkouts beside this one, at origin's copy of each ref: the notes store
// from web-tools-private's main, folder listings with git's real object shas,
// branch tips, compares, and pull-request state from the crawl's cache. So the
// component loads the store and runs its own observe() and compare(), as on a
// phone, with nothing injected. Fetch the checkouts first so origin is current.
//
//   python3 skills/tend/findings.py check --json > /tmp/verdicts.json
//   TENDING_VERDICTS=/tmp/verdicts.json npm run shot -- app/index.html --width 390 --height 844 \
//     --script tools/render/scenarios/tending-findings.mjs
//
// With TENDING_VERDICTS, the browser's verdict for every witness is compared
// with the command line's and the result written to TENDING_PARITY (default
// tools/.preview/tending-parity.json); a mismatch is also logged as a console
// error, so it lands in the shot log.
//
// Optional: TENDING_TAB=settled, TENDING_OPEN=<id,id> (details open),
// TENDING_SCROLL=<id> (scroll that finding to the top).
import fs from 'node:fs';
import path from 'node:path';

process.env.SHOT_GIT_API = '1';

export default async (page, ctx) => {
  const vf = process.env.TENDING_VERDICTS;
  const cli = vf && fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, 'utf8')) : null;
  const tab = process.env.TENDING_TAB || '';
  const open = (process.env.TENDING_OPEN || '').split(',').filter(Boolean);
  const scroll = process.env.TENDING_SCROLL || '';

  // A token the shim does not check: the view only needs to believe it has one.
  await page.evaluate((tab) => { window.TOKEN = 'FAKE'; window.__shell.goTending({ tab }); }, tab);
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data="tending()"]');
    const d = el && window.Alpine.$data(el);
    return d && !d.loading && d.notes.length > 0 && d.checking === 0
      && Object.values(d.seen).every(v => v.verdict !== 'pending');
  }, null, { timeout: 60000 });

  if (cli) {
    const browser = await page.evaluate(() => {
      const d = window.Alpine.$data(document.querySelector('[x-data="tending()"]'));
      return d.findings.map(f => ({ id: f.id, open: f.open,
        verdicts: f.witnesses.map(w => ({ ref: w.ref, ...d.verdict(f, w) })) }));
    });
    const rows = [];
    for (const f of browser) {
      const c = cli.find(x => x.id === f.id);
      for (const v of f.verdicts) {
        const cv = c && (c.verdicts || []).find(x => x.ref === v.ref);
        // The shim knows only the PRs the crawl's cache holds. A merged PR older
        // than that reads "not found" here, while on GitHub the view reads it
        // from the pulls API and findings.py holds merged as final: a limit of
        // this harness, reported apart rather than counted as a disagreement.
        const harness = /#\d+$/.test(v.ref) && v.detail === 'pull request not found' && cv?.verdict === 'ok';
        rows.push({ id: f.id, ref: v.ref, browser: v.verdict, cli: cv ? cv.verdict : 'absent',
                    agree: !!cv && cv.verdict === v.verdict, harness, browserDetail: v.detail, cliDetail: cv?.detail || '' });
      }
    }
    const out = process.env.TENDING_PARITY || path.join(ctx.repoRoot, 'tools/.preview/tending-parity.json');
    const bad = rows.filter(r => !r.agree && !r.harness);
    fs.writeFileSync(out, JSON.stringify({ witnesses: rows.length, agree: rows.filter(r => r.agree).length,
      harnessLimited: rows.filter(r => r.harness).length, disagree: bad.length, rows }, null, 1));
    for (const b of bad) await page.evaluate((b) => console.error('parity: ' + JSON.stringify(b)), b);
  }

  if (open.length) {
    await page.evaluate((open) => {
      const d = window.Alpine.$data(document.querySelector('[x-data="tending()"]'));
      for (const id of open) d.open[id] = true;
    }, open);
  }
  await page.waitForTimeout(300);
  if (scroll) {
    await page.evaluate((id) => document.getElementById('finding-' + id)?.scrollIntoView({ block: 'start' }), scroll);
    await page.waitForTimeout(200);
  }
};
