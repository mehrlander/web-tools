// The Tending view over the REAL notes store, not fixtures: the findings on
// web-tools-private's origin/main, with the witness verdicts that
// `skills/tend/findings.py check --all --json` computed from the checkouts.
// The sandbox cannot reach the GitHub API the view checks witnesses through,
// so the verdicts are supplied rather than observed; everything else is the
// component's own rendering of what is stored.
//
//   python3 skills/tend/findings.py check --all --json > /tmp/verdicts.json
//   TENDING_VERDICTS=/tmp/verdicts.json npm run shot -- app/index.html --width 390 --height 844 \
//     --script tools/render/scenarios/tending-findings.mjs
//
// Optional: TENDING_TAB=settled, TENDING_OPEN=<id,id> (details open),
// TENDING_SCROLL=<id> (scroll that finding to the top), TENDING_STORE=<checkout>.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default async (page, ctx) => {
  const store = process.env.TENDING_STORE || path.resolve(ctx.repoRoot, '..', 'web-tools-private');
  const notes = execFileSync('git', ['-C', store, 'show', 'origin/main:notes/notes.jsonl'], { encoding: 'utf8' })
    .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const vf = process.env.TENDING_VERDICTS;
  const verdicts = vf && fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, 'utf8')) : [];
  const tab = process.env.TENDING_TAB || '';
  const open = (process.env.TENDING_OPEN || '').split(',').filter(Boolean);
  const scroll = process.env.TENDING_SCROLL || '';

  await page.evaluate((tab) => { window.TOKEN = 'FAKE'; window.__shell.goTending({ tab }); }, tab);
  // Let the component mount and finish its own load against the sandbox,
  // which fails or reads a stale working tree; what it found is replaced below.
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data="tending()"]');
    const d = el && window.Alpine.$data(el);
    return d && !d.loading && !d.checking;
  }, null, { timeout: 15000 }).catch(() => {});

  const inject = () => page.evaluate(({ notes, verdicts, open }) => {
    const d = window.Alpine.$data(document.querySelector('[x-data="tending()"]'));
    d.err = ''; d.loading = false; d.checking = 0;
    d.notes = notes;
    const seen = {};
    for (const f of window.Findings.fold(notes)) {
      const v = verdicts.find(x => x.id === f.id);
      for (const w of f.witnesses) {
        const hit = v && (v.verdicts || []).find(x => x.ref === w.ref);
        seen[f.assessedAt + ' ' + w.ref] = hit ? { verdict: hit.verdict, detail: hit.detail || '' }
                                               : { verdict: 'unverifiable', detail: 'not checked here' };
      }
    }
    d.seen = seen;
    for (const id of open) d.open[id] = true;
  }, { notes, verdicts, open });

  await inject();
  await page.waitForTimeout(800);
  await inject();   // again, in case a witness request the sandbox refused landed late
  await page.waitForTimeout(300);
  if (scroll) {
    await page.evaluate((id) => document.getElementById('finding-' + id)?.scrollIntoView({ block: 'start' }), scroll);
    await page.waitForTimeout(200);
  }
};
