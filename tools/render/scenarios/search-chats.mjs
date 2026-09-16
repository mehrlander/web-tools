// screenshot.mjs interaction scenario: the Files view's Chats lane, the fourth
// mode pill and the sessions lane's opposite number.
//
//   npm run shot -- app/index.html --query view=search \
//     --script tools/render/scenarios/search-chats.mjs --height 760
//
// What the pixels have to prove: the pill sits beside Sessions, the two corpus
// lanes drop the repo rail and the folder trail (neither takes a repo), the
// caveat says what the catalog can and cannot answer, and a hit reads as a chat
// (date, provider, the matched field quoted) rather than as a file.
//
// The sandbox blocks the API, so the lane is stubbed at EstateSearch. The row
// shapes are the real ones EstateSearch.chats returns.
const HITS = [
  { url: 'https://claude.ai/chat/3d4f92e4-b714-46ad-a7c3-0854e6519a0a', open: 'https://claude.ai/chat/3d4f92e4',
    title: 'Packing a bookmarklet with gzip', date: '2026-07-04', month: '2026-07',
    provider: 'claude', hand: true,
    frag: 'summary: Worked out a base64url envelope so the whole payload rides in the fragment…' },
  { url: 'https://chatgpt.com/c/0d926532-977f-4993-9287-02c6a43e0264', open: 'https://chatgpt.com/c/0d926532',
    title: 'Compressing a payload into an address bar', date: '2026-03-18', month: '2026-03',
    provider: 'chatgpt', hand: false,
    frag: 'tags: compression, bookmarklets, base64' },
  { url: 'gemini-session/341', open: '',
    title: 'Deep research: URL length limits across browsers', date: '2025-11-22', month: '2025-11',
    provider: 'gemini', hand: false,
    frag: 'title: Deep research: URL length limits across browsers' },
];

export default async function (page) {
  const ok = await page.evaluate((HITS) => {
    if (!window.Alpine || !window.__shell || !window.EstateSearch) return 'no shell';
    window.__shell.hasToken = () => true;
    window.TOKEN = 'stub';
    window.chatArchive = window.chatArchive || {};
    window.EstateSearch = {
      ...window.EstateSearch,
      async chats({ onProgress }) {
        // Fired the way the real lane fires it, so the progress line is on the
        // same code path even though nothing is fetched here.
        onProgress?.({ done: 41, total: 41 });
        return { hits: HITS, total: HITS.length, months: 41, missing: [] };
      },
    };
    return '';
  }, HITS);
  if (ok) throw new Error(ok);

  await page.evaluate(() => {
    const st = window.Alpine.$data(document.querySelector('[x-data^="searchView"]'));
    st.setMode('chats');
    st.q = 'gzip';
    return st.run();
  });
  await page.waitForTimeout(800);
}
