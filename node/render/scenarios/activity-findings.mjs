// Activity's Branches pane with the REAL activity cache, session index and
// notes store from web-tools-private's origin/main, opened on the Findings
// scope: the branch rows an open tending finding names, each with the line
// that opens it in the Tending view.
//
//   npm run shot -- app/index.html --query view=branches --width 390 --height 844 \
//     --script node/render/scenarios/activity-findings.mjs
//
// Optional: ACTIVITY_SCOPE=<scope key> (default found), TENDING_STORE=<checkout>.
// For Sessions or Repos, pass --query view=sessions or view=estate instead.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const show = (store, file) => execFileSync('git', ['-C', store, 'show', 'origin/main:' + file],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

export default async (page, ctx) => {
  const store = process.env.TENDING_STORE || path.resolve(ctx.repoRoot, '..', 'web-tools-private');
  const notes = show(store, 'notes/notes.jsonl').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const act = JSON.parse(show(store, 'state/activity.json'));
  const ses = JSON.parse(show(store, 'state/sessions.json'));
  const scope = process.env.ACTIVITY_SCOPE || 'found';

  // The same opening as activity-pr-state.mjs: a fake token and the mount
  // flag, with the view already chosen by the query.
  await page.evaluate(() => { window.TOKEN = 'FAKE'; window.__shell.estateSeen = true; });
  await page.waitForTimeout(600);
  const inject = () => page.evaluate(({ notes, repos, rows, scope }) => {
    const d = window.Alpine.$data(document.querySelector('[x-data="estate()"]'));
    d.authed = true; d.loading = false; d.activityLoading = false;
    d.activity = repos;
    d.sessionRows_ = rows;
    d.noteItems = notes;
    d.branchScope = scope;
  }, { notes, repos: act.repos || act, rows: ses.rows || ses, scope });
  await inject();
  await page.waitForTimeout(800);
  await inject();
  await page.waitForTimeout(400);
};
