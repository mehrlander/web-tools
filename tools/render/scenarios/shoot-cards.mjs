import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = path.resolve(here, '..', '..', '..', '..', 'web-tools-private');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(registry, rel), 'utf8'));

export default async (page) => {
  const cache = read('state/sessions.json');
  const topics = read('state/session-topics.json');
  await page.evaluate(({ cache, topics }) => {
    const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
    st.authed = true;
    st.loading = false;
    st.sessionsLoading = false;
    st.sessionScope = 'all';
    st.takeSessions(cache);
    st.sessionTopicsDoc = topics;
    st.sessionRows_ = st.joinSessionTopics(st.sessionRows_);
  }, { cache, topics });
  await page.waitForTimeout(1500);

  const cardLocator = page.locator('div[data-part="item"]:has([data-part="links"])').first();
  await cardLocator.waitFor({ state: 'visible', timeout: 10000 });
  await cardLocator.scrollIntoViewIfNeeded();

  const outDir = path.resolve(here, '..', '.preview');
  const artifactDir = 'C:\\Users\\mehrl\\.gemini\\antigravity\\brain\\26c2bc15-08fb-4950-ad6e-f28d365ccfec';

  const modes = ['ticks', 'bar', 'databar', 'pips', 'weight', 'dot'];
  for (const mode of modes) {
    await page.evaluate((m) => {
      const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
      st._topicSizeMode = m;
    }, mode);
    await page.waitForTimeout(500);

    const dest = path.join(outDir, `card-${mode}.png`);
    await cardLocator.screenshot({ path: dest });
    console.log(`Saved ${dest}`);

    if (fs.existsSync(artifactDir)) {
      const artDest = path.join(artifactDir, `card-${mode}.png`);
      fs.copyFileSync(dest, artDest);
      console.log(`Copied to ${artDest}`);
    }
  }
};
