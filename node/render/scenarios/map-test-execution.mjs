// Read the actual checkout workflows in Map Tests. MAP_TEST_HOME optionally
// adds a local Home checkout as authenticated display data, without a real token.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default async (page) => {
  await page.waitForFunction(() => {
    const map = document.querySelector('[x-data="map()"]')?._x_dataStack?.[0];
    return map?.mapTab === 'tests' && !map.testExecutionLoading && map._testExecutionLoaded;
  }, null, { timeout: 45000 });
  if (process.env.MAP_TEST_HOME) {
    const root = path.resolve(process.env.MAP_TEST_HOME);
    const config = JSON.parse(readFileSync(path.join(root, '.web-tools.json'), 'utf8'));
    const files = { '.web-tools.json': JSON.stringify(config) };
    for (const entry of config.checking.execution)
      files[entry.workflow] = readFileSync(path.join(root, entry.workflow), 'utf8');
    await page.evaluate(async ({ config, files }) => {
      const original = GH.prototype.get;
      GH.prototype.get = async function(file, ...args) {
        if (this.repo === 'mehrlander/web-tools-private' && file === 'state/configs.json')
          return { text: JSON.stringify({ repos: { 'mehrlander/home': { config } } }) };
        if (this.repo === 'mehrlander/home' && files[file]) return { text: files[file] };
        return original.call(this, file, ...args);
      };
      const map = document.querySelector('[x-data="map()"]')._x_dataStack[0];
      map.hasToken = () => true;
      await map.loadTestExecution(true);
    }, { config, files });
  }
  await page.waitForTimeout(200);
  const state = await page.evaluate(() => {
    const map = document.querySelector('[x-data="map()"]')._x_dataStack[0];
    return { error: map.testExecutionError, repos: map.testExecutionGroups.map(g => g.repo),
      runs: map.testExecutionGroups.flatMap(g => g.runs.map(r => ({ title: r.title, command: r.command, machine: r.machine }))),
      width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth };
  });
  if (state.error || state.scroll > state.width + 1 || !state.runs.length)
    throw new Error('Map test execution: ' + JSON.stringify(state));
  if (process.env.MAP_TEST_HOME && state.runs.length !== 3) throw new Error('Home declarations were not displayed');
  console.log('MAP_TEST_EXECUTION ' + JSON.stringify(state));
};
