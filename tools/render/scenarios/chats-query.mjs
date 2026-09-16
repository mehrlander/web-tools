// Shoot the Chats pane's text box with fixture rows, no archive checkout.
//
// The sibling scenario chats-pane.mjs reads the real mehrlander/chat-histories
// from the checkout beside this one (tools/render/cdn.mjs serves it), which is
// the right way to shoot the pane's DATA. This one is about the CONTROL: the
// box that narrows the loaded months and the button that hands the query to the
// Files view's Chats lane. Stubbing the rows keeps it shootable in a sandbox
// with no archive clone, and the layout, classes and chip contract on screen are
// still the page's own.
//
//   QUERY=<text> npm run shot -- app/index.html --query view=chats \
//     --script tools/render/scenarios/chats-query.mjs --height 700

const MONTH = '2026-07';
const ROWS = [
  { url: 'https://claude.ai/chat/3d4f92e4-b714-46ad-a7c3-0854e6519a0a', month: MONTH,
    date: '2026-07-04', provider: 'claude', hand: true,
    title: 'Packing a bookmarklet with gzip',
    summary: 'Worked out a base64url envelope so the whole payload rides in the fragment, and measured what the address bar will actually carry.',
    tags: ['bookmarklets', 'compression', 'ios'],
    open: 'https://claude.ai/chat/3d4f92e4-b714-46ad-a7c3-0854e6519a0a' },
  { url: 'https://chatgpt.com/c/0d926532-977f-4993-9287-02c6a43e0264', month: MONTH,
    date: '2026-07-03', provider: 'chatgpt', hand: false,
    title: 'Allotment schedule, packet by fund',
    summary: 'Walked the allotment packet fund by fund and worked out which lines are appropriated and which are not.',
    tags: ['wa-budget', 'drs'],
    open: 'https://chatgpt.com/c/0d926532-977f-4993-9287-02c6a43e0264' },
  // The row with nowhere to go: Takeout keeps no per-conversation address, so
  // the title renders as text. It is in the fixture because a filtered list has
  // to keep drawing it correctly.
  { url: 'gemini-session/341', month: MONTH,
    date: '2026-07-02', provider: 'gemini', hand: false,
    title: 'Deep research on pension funding policy',
    summary: 'A long read on contribution-rate policy across states, with the report itself inside the activity record.',
    tags: ['pensions', 'deep-research'], open: '' },
];

const FRONTIER = {
  archived_through: '2026-07-06',
  providers: {
    Claude:  { frontier: '2026-07-06', chats: 5922, months: [MONTH, '2026-06', '2026-05'], snapshots: ['2026-06-01', '2026-07-06'] },
    ChatGPT: { frontier: '2026-07-05', chats: 8658, months: [MONTH, '2026-06'], snapshots: ['2026-07-06'] },
    Gemini:  { frontier: '2026-06-01', chats: 8648, months: ['2026-06'], snapshots: ['2026-06-01'] },
  },
};

export default async function (page) {
  await page.evaluate(async ({ ROWS, FRONTIER, MONTH }) => {
    // The kit, which the pane's own loader would have fetched. Everything the
    // pane reads off it is a pure fold (the banner, the month spine, the box's
    // matcher), so loading it here and handing it fixtures is the same code
    // path with the network taken out.
    if (!window.chatArchive) await window.gh.load('kits/chat-archive.js');
    const st = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
    st.authed = true;
    st.loading = false;
    // chatsTried stops the pane's own loader from firing over the fixture: it
    // would fail with no token and paint the error box instead.
    st.chatsTried = true;
    st.chatsBusy = false;
    st.chatsErr = '';
    st.chatFrontier = FRONTIER;
    st.chatLoadedMonths = [MONTH];
    st.chatRowsByMonth = { [MONTH]: ROWS };
    window.__shell.hasToken = () => true;
  }, { ROWS, FRONTIER, MONTH });
  await page.waitForTimeout(600);

  if (process.env.QUERY) {
    await page.getByLabel('Filter chats').fill(process.env.QUERY);
    await page.waitForTimeout(600);
  }
}
