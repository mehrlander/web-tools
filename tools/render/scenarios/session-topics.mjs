// Shoot the Sessions pane with the follow-up's topics joined, from real data.
//
// The pane is token-gated and the sandbox has no token, so this does what
// estate-sessions.mjs does, mounting the data into the component after Alpine
// has started, but with the REAL files rather than fixtures: the registry's
// state/sessions.json and state/session-topics.json, read from the
// web-tools-private checkout beside this one. The join itself runs through the
// pane's own joinSessionTopics, so what is shot is the code path a reader gets.
//
//   npm run shot -- app/index.html --query "view=sessions&lens=topics" \
//     --script tools/render/scenarios/session-topics.mjs --width 430 --height 932
//   npm run shot -- app/index.html --query "view=sessions&topic=drs-submittal" \
//     --script tools/render/scenarios/session-topics.mjs --width 430 --height 932
//
// SCOPE=<key> sets the scope first (day, week, month, failed, all); the
// default scope is the last day, and the topics written so far are older.
// OPEN=1 opens the first listed session's detail, for its summary block.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = path.resolve(here, '..', '..', '..', '..', 'web-tools-private');
const read = (rel) => JSON.parse(readFileSync(path.join(registry, rel), 'utf8'));

export default async (page) => {
  const cache = read('state/sessions.json');
  const topics = read('state/session-topics.json');
  await page.evaluate(({ cache, topics, scope }) => {
    const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
    st.authed = true;
    st.loading = false;
    st.sessionsLoading = false;
    if (scope) st.sessionScope = scope;
    st.takeSessions(cache);
    st.sessionTopicsDoc = topics;
    st.sessionRows_ = st.joinSessionTopics(st.sessionRows_);
  }, { cache, topics, scope: process.env.SCOPE || '' });
  await page.waitForTimeout(1200);
  if (process.env.OPEN) {
    await page.evaluate(() => {
      const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
      const row = st.sessionNodes.find(n => n.kind === 'record' && n.row)?.row;
      if (row) st.openSessionDetail(row);
    });
    await page.waitForTimeout(2500);
  }
};
