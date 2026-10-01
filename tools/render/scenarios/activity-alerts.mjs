// The worth-checking alert: the PR-state seed plus one session record that
// ended "done" on the seed's branch with no pull request, opened on the
// To check chip. Composed rather than copied, like activity-pr-abandoned.mjs.
//
//   npm run shot -- app/index.html --query view=branches --script tools/render/scenarios/activity-alerts.mjs
//   npm run shot -- app/index.html --query view=estate --script tools/render/scenarios/activity-alerts.mjs
import seedPrState from './activity-pr-state.mjs';

export default async (page, ctx) => {
  await page.evaluate(() => { window.__scenarioScope = 'check'; });
  await seedPrState(page, ctx);
  await page.evaluate(() => {
    const d = window.Alpine.$data(document.querySelector('[x-data="estate()"]'));
    d.sessionRows_ = [{
      agent: 'https://claude.ai/code/session_01o-pr-yet', state: 'done',
      ask: 'Add a report on the environment check', title: 'Environment check report',
      day: new Date().toISOString().slice(0, 10),
      repos: [{ name: 'web-tools', branch: 'claude/scratch-no-pr-yet' }],
    }];
    d.noteItems = [];
  });
  await page.waitForTimeout(400);
};
