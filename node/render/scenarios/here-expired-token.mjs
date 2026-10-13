// The This browser view as an expired token reaches it: a saved token GitHub
// now rejects, its record (saved, last accepted), a browser note, and some
// IndexedDB to list, including a legacy shelf. The scenario then opens the Map's
// Skills tab, whose manifest read fails with 401, so the shot shows the app
// routing the failure to ?view=here rather than the gh-auth takeover.
// Run with SHOT_NO_LIVE_API=1 so no live call is spent or answered.
//
//   SHOT_NO_LIVE_API=1 npm run shot -- app/index.html --full \
//     --script node/render/scenarios/here-expired-token.mjs

// Stand-in storage for a This browser shot: a token GitHub now rejects, its
// record, a browser note, and two IndexedDB databases, one a legacy shelf.
// Shared with here-stored.mjs.
export async function seed(page) {
  await page.evaluate(async () => {
    const day = 864e5, now = Date.now();
    localStorage.setItem('ghToken', 'ghp_' + 'x'.repeat(32) + 'a1b2');
    localStorage.setItem('wt:tokenMeta', JSON.stringify({ tail: 'a1b2', savedAt: now - 30 * day, okAt: now - 9 * day, login: 'mehrlander' }));
    localStorage.setItem('wt:browserNote', 'Laptop, Chrome');
    const put = (name, store, rows) => new Promise((res, rej) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => {
        const tx = req.result.transaction(store, 'readwrite');
        rows.forEach(r => tx.objectStore(store).put(r));
        tx.oncomplete = () => { req.result.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
      req.onerror = () => rej(req.error);
    });
    await put('dataShelf', 'items', [{ name: 'tidy tables', type: 'js', code: 'document.querySelectorAll("table")' }, { name: 'notes', type: 'text', code: 'remember the milk' }]);
    await put('DataJarDB', 'actions', [{ name: 'old action', code: 'alert(1)', autorun: false }]);
  });
}

export default async (page) => {
  const json = (status, body, headers = {}) => ({ status, contentType: 'application/json; charset=utf-8',
    headers: { 'x-ratelimit-remaining': '4988', 'x-ratelimit-limit': '5000', ...headers }, body: JSON.stringify(body) });
  const rejected = { message: 'Bad credentials', documentation_url: 'https://docs.github.com/rest' };
  // Registered after the renderer's own route, so these answer first.
  await page.route('https://api.github.com/user', r => r.fulfill(json(401, rejected, { 'x-ratelimit-remaining': '' })));
  await page.route(/api\.github\.com\/repos\/mehrlander\/web-tools\/contents\/skills\/manifest\.csv/,
    r => r.fulfill(json(401, rejected)));
  await seed(page);
  const url = new URL(page.url());
  url.search = '?view=map&tab=skills';
  await page.goto(url.href, { waitUntil: 'load' });
  await page.waitForTimeout(6000);
};
