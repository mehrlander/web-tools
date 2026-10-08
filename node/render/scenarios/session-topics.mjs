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
//     --script node/render/scenarios/session-topics.mjs --width 430 --height 932
//   npm run shot -- app/index.html --query "view=sessions&topic=drs-submittal" \
//     --script node/render/scenarios/session-topics.mjs --width 430 --height 932
//
// SCOPE=<key> sets the scope first (day, week, month, failed, all); the
// default scope is the last day, and the topics written so far are older.
// OPEN=1 opens the first listed session's detail, for its summary block;
// OPEN=<short id> opens that session instead. TOPICS=<path> reads the rollup
// from that file rather than the checkout, which is how a format the poller
// has not published yet gets shot. TAP=<n> then taps the n-th topic in the
// detail's list (from 0), which scrolls the outline to it under its header.
// ROWTAP=<n> taps the n-th topic line in the list itself.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = path.resolve(here, '..', '..', '..', '..', 'web-tools-private');
const read = (rel) => JSON.parse(readFileSync(path.join(registry, rel), 'utf8'));

export default async (page) => {
  const cache = read('state/sessions.json');
  const topics = process.env.TOPICS
    ? JSON.parse(readFileSync(path.resolve(process.env.TOPICS), 'utf8'))
    : read('state/session-topics.json');
  await page.evaluate(({ cache, topics, scope, mode, lens }) => {
    const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
    st.authed = true;
    st.loading = false;
    st.sessionsLoading = false;
    if (scope) st.sessionScope = scope;
    if (mode) st._topicSizeMode = mode;
    st.takeSessions(cache);
    st.sessionTopicsDoc = topics;
    st.sessionRows_ = st.joinSessionTopics(st.sessionRows_);
    if (lens) st.setLens(lens);
  }, { cache, topics, scope: process.env.SCOPE || 'all', mode: process.env.MODE || '', lens: process.env.LENS || 'list' });
  await page.waitForTimeout(1200);
  // ROWTAP=<n> taps the n-th topic line on the first listed row, which opens
  // that session at the topic.
  if (process.env.ROWTAP) {
    await page.evaluate((n) => {
      const btn = [...document.querySelectorAll('button[title$="open the session here"], button[title="Open the session here"]')][Number(n)];
      btn?.click();
    }, process.env.ROWTAP);
    await page.waitForTimeout(3000);
  }
  if (process.env.OPEN) {
    await page.evaluate((id) => {
      const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
      const row = id === '1'
        ? st.sessionNodes.find(n => n.kind === 'record' && n.row)?.row
        : st.sessionRows_.find(r => r.id === id);
      if (row) st.openSessionDetail(row);
    }, process.env.OPEN);
    await page.waitForTimeout(2500);
  }
  if (process.env.TAP) {
    // The deck keeps its neighbours mounted, so the slide on screen is the
    // one whose box starts inside the viewport, not the first in the DOM.
    await page.evaluate((n) => {
      const slide = [...document.querySelectorAll('[x-data^="sessionBrief"]')].find(el => {
        const r = el.getBoundingClientRect();
        return r.width && r.left >= 0 && r.left < window.innerWidth;
      });
      slide?.querySelectorAll('ol button[type="button"]')[Number(n)]?.click();
    }, process.env.TAP);
    await page.waitForTimeout(1200);
  }
};
