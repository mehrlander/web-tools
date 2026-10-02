// Ping, 2026-10-02: questions put to Gemini from the Lists view, in the three
// states a question shows (sent, thinking, answered).
//
// The Lists view is token-gated and this renderer holds no token, so the seed
// flips `authed` and plants the questions straight into the component.
//
//   npm run shot -- app/index.html --query "view=lists" --width 430 --height 1100 \
//     --script tools/render/scenarios/ping.mjs --wait 3000
//
// Add `scrolled=1` to the query to scroll the list to the answered question,
// and `daemon=up|behind|quiet|checking` to plant the daemon marker's state.

const ago = (m) => new Date(Date.now() - m * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');

export default async function (page) {
  await page.waitForSelector('[x-data*="estate"]', { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.evaluate(async (items) => {
    const data = Alpine.$data(document.querySelector('[x-data*="estate"]'));
    data.authed = true;
    data.hasToken = () => true;
    data.armPingPoll = () => {};
    data.pingLoading = false;
    data.pingItems = items;
    data.pingDraft = 'Is the Snake longer than the Columbia?';
    // The daemon marker: `daemon=up|behind|quiet|checking` in the query.
    const mins = (m) => new Date(Date.now() - m * 60000).toISOString();
    const state = new URLSearchParams(location.search).get('daemon') || 'up';
    if (!window.Errands && window.gh?.load) await window.gh.load('kits/errands.js');
    data.daemon = {
      up:       { read: true, lastTopicsAt: mins(6), lastRecordAt: mins(8), check: null },
      behind:   { read: true, lastTopicsAt: mins(40), lastRecordAt: mins(14), check: null },
      quiet:    { read: true, lastTopicsAt: mins(190), lastRecordAt: mins(200), check: null },
      checking: { read: true, lastTopicsAt: mins(190), lastRecordAt: mins(200), check: { id: 'x', createdAt: mins(0.2) } },
    }[state];
    if (state !== 'up') data.pingItems = data.pingItems.filter(p => p.stage === 'answered');
    if (state === 'quiet' || state === 'checking') data.pingItems = data.pingItems.map(p => ({ ...p, at: mins(185), createdAt: mins(190) }));
    await new Promise(r => setTimeout(r, 600));
    if (location.search.includes('scrolled')) {
      const pane = [...document.querySelectorAll('section .overflow-y-auto')].find(el => el.textContent.includes('Gemini answered'));
      if (pane) pane.scrollTop = pane.scrollHeight;
    }
  }, [
    { id: 'p3', prompt: 'Draft a two-line toast for a retirement party, warm but not sappy.',
      createdAt: ago(1), stage: 'sent', open: true },
    { id: 'p2', prompt: 'What is the difference between a daemon and a service?',
      createdAt: ago(4), stage: 'thinking', open: true },
    { id: 'p1', prompt: 'Which rivers feed the Columbia? A short list.', createdAt: ago(30),
      stage: 'answered', ok: true, open: true, at: ago(27),
      reply: 'The Snake, the Willamette, the Kootenay, the Pend Oreille, the Spokane, the Yakima and the Okanogan.' },
  ]);
  await page.waitForTimeout(800);
}
