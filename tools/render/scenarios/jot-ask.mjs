// Asking Gemini about a jot, 2026-10-02: the three states a jot's ask shows.
//
// The Lists view is token-gated and this renderer holds no token, so the seed
// flips `authed` and plants the pile and its asks straight into the component:
// one jot with its prompt box open, one waiting on the daemon, one answered.
//
//   npm run shot -- app/index.html --query "view=todo" --width 430 --height 900 \
//     --script tools/render/scenarios/jot-ask.mjs --wait 3000
//
// Add `closed=1` to the query to leave the prompt box shut and scroll the pile
// to the answered jot.

const ago = (m) => new Date(Date.now() - m * 60000).toISOString();

export default async function (page) {
  await page.waitForSelector('[x-data*="estate"]', { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.evaluate(async ({ jots, asks }) => {
    const data = Alpine.$data(document.querySelector('[x-data*="estate"]'));
    data.authed = true;
    data.hasToken = () => true;
    data.jotLoading = false;
    data.jotItems = jots;
    data.asks = asks;
    data.armAskPoll = () => {};
    if (!location.search.includes("closed")) data.startAsk(jots[0]);
    data.askDraft = 'Is the Snake longer than the Columbia? One sentence.';
    await new Promise(r => setTimeout(r, 600));
    if (location.search.includes('closed')) {
      const pane = [...document.querySelectorAll('section .overflow-y-auto')].find(el => el.textContent.includes('Gemini answered'));
      if (pane) pane.scrollTop = pane.scrollHeight;
    }
  }, {
    jots: [
      { id: 'j3', text: 'Snake vs Columbia length', created_at: ago(3) },
      { id: 'j2', text: 'name for the Gemini errands feature', kind: 'idea', created_at: ago(40) },
      { id: 'j1', text: 'which rivers feed the Columbia', created_at: ago(300) },
    ],
    asks: {
      j2: { id: 'daemon-x-ask-j2-1', stage: 'thinking' },
      j1: { id: 'daemon-x-ask-j1-1', stage: 'answered', ok: true, open: true, at: ago(12), model: 'flash',
            reply: 'The main tributaries are the Snake, the Willamette, the Kootenay, the Pend Oreille, the Spokane, the Yakima and the Okanogan.' },
    },
  });
  await page.waitForTimeout(800);
}
