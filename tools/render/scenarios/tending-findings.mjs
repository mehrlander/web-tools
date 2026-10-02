// The Tending view over the real notes store, checking its witnesses itself
// against SHOT_GIT_API's answers (tools/render/cdn.mjs). Fetch the sibling
// checkouts first so origin is current.
//
//   python3 skills/tend/findings.py check --json > /tmp/verdicts.json
//   TENDING_VERDICTS=/tmp/verdicts.json npm run shot -- app/index.html --width 390 --height 844 \
//     --script tools/render/scenarios/tending-findings.mjs
//
// With TENDING_VERDICTS, each witness's browser verdict is compared with the
// command line's and written to TENDING_PARITY (default
// tools/.preview/tending-parity.json); a mismatch is also a console error.
// Optional: TENDING_TAB=settled, TENDING_OPEN=<id,id>, TENDING_SCROLL=<id>.
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
      && Object.values(d.seen).every(v => !v.pending);
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
        rows.push({ id: f.id, ref: v.ref, browser: v.verdict, cli: cv ? cv.verdict : 'absent',
                    agree: !!cv && cv.verdict === v.verdict, browserDetail: v.detail, cliDetail: cv?.detail || '' });
      }
    }
    const out = process.env.TENDING_PARITY || path.join(ctx.repoRoot, 'tools/.preview/tending-parity.json');
    const bad = rows.filter(r => !r.agree);
    fs.writeFileSync(out, JSON.stringify({ witnesses: rows.length, agree: rows.length - bad.length,
      disagree: bad.length, rows }, null, 1));
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
