// Shoot a topic card on the Sessions list: Gemini's headline for each turn in
// one topic, opened by hovering (or, at phone width, tapping) the topic line.
//
// Same mounting as session-topics.mjs, from the real files in the
// web-tools-private checkout beside this one, with one addition: the card reads
// the session's companion off the registry's `background` branch, which a
// headless page cannot reach without a token, so COMPANION=<file> hands that
// file in through the card's own reader (readTopicCompanion).
//
//   git -C ../web-tools-private show origin/background:state/session-topics.json > /tmp/rollup.json
//   git -C ../web-tools-private show origin/background:<rollup row's path> > /tmp/companion.json
//   ID=8cddf1e3 TOPIC=0 TOPICS=/tmp/rollup.json COMPANION=/tmp/companion.json \
//     npm run shot -- app/index.html --query "view=sessions" \
//     --script node/render/scenarios/session-topic-card.mjs --width 1100 --height 900
//
// ID is the session's short id; TOPIC is which topic line on its row, from 0.
// TOPICS defaults to the checkout's own state/session-topics.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = path.resolve(here, '..', '..', '..', '..', 'web-tools-private');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));

export default async (page) => {
  const cache = json(path.join(registry, 'state/sessions.json'));
  const topics = json(process.env.TOPICS ? path.resolve(process.env.TOPICS) : path.join(registry, 'state/session-topics.json'));
  const companion = process.env.COMPANION ? json(path.resolve(process.env.COMPANION)) : null;
  const id = process.env.ID || '';
  await page.evaluate(({ cache, topics, companion, id }) => {
    const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
    st.authed = true;
    st.loading = false;
    st.sessionsLoading = false;
    st.sessionScope = 'all';
    st.takeSessions(cache);
    st.sessionTopicsDoc = topics;
    st.sessionRows_ = st.joinSessionTopics(st.sessionRows_);
    st.readTopicCompanion = async () => {
      if (!companion) throw new Error('no COMPANION given');
      return companion;
    };
    // The one row, so its topic lines are on screen without scrolling.
    if (id) st.activityQuery = id;
    st.setLens('list');
  }, { cache, topics, companion, id });
  await page.waitForTimeout(1200);
  const box = await page.evaluate(({ id, n }) => {
    const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
    const row = st.sessionRows_.find(r => r.id === id);
    const item = row && st.sessionTopicItems(row)[n];
    const btn = item && [...document.querySelectorAll('ul button')]
      .find(b => b.textContent.includes(st.sessionTopicLabel(item)));
    if (!btn) return null;
    btn.scrollIntoView({ block: 'center' });
    const r = btn.getBoundingClientRect();
    return { x: r.left + 40, y: r.top + r.height / 2 };
  }, { id, n: Number(process.env.TOPIC || 0) });
  if (!box) throw new Error('no topic line for ' + id);
  // A hover where the page can hover, a tap where it cannot: the two routes a
  // reader has into the card.
  const fine = await page.evaluate(() => !!window.__shell?.finePointer);
  if (fine) await page.mouse.move(box.x, box.y);
  else await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(900);
};
