// A budget-drs unit is shot by budget-drs's own screenshot tool, run in the
// budget-drs checkout beside this one. The app was home's projects/budget-drs
// until 2026-11-10, and the recipes still sent its views to home's tool at
// projects/budget-drs/app/view/app.html, a page home no longer holds. Nothing
// here opens a browser: the recipe and the tool call are plain values.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';
import { derive, toolCall, BUDGET_DRS, HOME, HUB, TOOL_ROOT } from '../build/ui-recipes.mjs';

const SIZE = { width: 1280, height: 900 };
const view = (o) => ({ repo: 'budget-drs', host: 'budget-drs app', kind: 'view', view: 'funding', tab: '',
  files: 'app/view/views/funding.js', ...o });

test('the budget-drs checkout is the sibling node/ui-units.mjs reads the app from', () => {
  assert.equal(HUB, repoRoot);
  assert.equal(BUDGET_DRS, path.join(path.resolve(repoRoot, '..'), 'budget-drs'));
  assert.equal(TOOL_ROOT['budget-drs'], BUDGET_DRS);
  assert.equal(TOOL_ROOT.home, HOME);
});

test('a budget-drs view and tab open the app in the budget-drs checkout', () => {
  assert.deepEqual(derive(view()), { tool: 'budget-drs', page: 'app/view/app.html', query: 'view=funding' });
  assert.deepEqual(derive(view({ kind: 'tab', tab: 'CORE gates' })),
    { tool: 'budget-drs', page: 'app/view/app.html', query: 'view=funding&tab=core-gates' });
});

test('a page the app frames from another repo is shot in the view that frames it', () => {
  const framed = { repo: 'budget-wa', host: 'budget-drs app', kind: 'framed page', view: 'pensions', files: 'display/x.html' };
  assert.deepEqual(derive(framed), { tool: 'budget-drs', page: 'app/view/app.html', query: 'view=pensions' });
  // home still holds its own framed pages, so those are shot in home.
  assert.deepEqual(derive({ ...framed, repo: 'home', files: 'projects/pl/display/explorer.html' }),
    { tool: 'home', page: 'projects/pl/display/explorer.html', query: '' });
});

test("budget-drs's own pages, the app's frame among them, go to its tool", () => {
  assert.deepEqual(derive({ repo: 'budget-drs', host: 'Web Tools app', kind: 'page', view: '', files: 'app/view/app.html' }),
    { tool: 'budget-drs', page: 'app/view/app.html', query: '' });
  assert.deepEqual(derive({ repo: 'budget-drs', host: '', kind: 'page', view: '', files: 'submittal/checklist.html' }),
    { tool: 'budget-drs', page: 'submittal/checklist.html', query: '' });
  assert.equal(derive({ repo: 'home', host: '', kind: 'page', view: '', files: 'app/index.html' }).tool, 'home');
});

test("the call runs budget-drs's tools/screenshot.mjs in its checkout, with the address on the page", () => {
  const c = toolCall(derive(view({ kind: 'tab', tab: 'Requests' })), SIZE, true, '/tmp/x.png', '1', {});
  assert.equal(c.cwd, BUDGET_DRS);
  assert.deepEqual(c.argv.slice(0, 3), ['tools/screenshot.mjs', 'app/view/app.html?view=funding&tab=requests', '/tmp/x.png']);
  assert.ok(c.argv.includes('--eval') && c.argv.includes('--touch'));
  assert.equal(toolCall({ tool: 'home', page: 'a.html', query: '' }, SIZE, false, '/tmp/y.png').cwd, HOME);
  assert.equal(toolCall({ tool: 'wt', page: 'pages/a.html', query: '' }, SIZE, false, '/tmp/z.png').cwd, HUB);
});
