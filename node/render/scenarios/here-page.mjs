// This browser's Page tab: what the page a courier bookmark opened this window
// from keeps in its own storage. A stand-in opener plays the bookmark
// (bookmarklets/courier-stage.js): it answers courier-ready with a courier-page
// from https://shop.example and runs each courier-run's code exactly as the
// bookmark does, over a stand-in localStorage and a real IndexedDB database
// named for the shop, so the list is filled by the real kits/page-storage.js.
// The Stage opens first, as the bookmark opens it, and its courier card's
// storage link opens the tab, with a record store in the card.
//
//   SHOT_NO_LIVE_API=1 npm run shot -- app/index.html \
//     --script node/render/scenarios/here-page.mjs

export default async (page) => {
  await page.route('https://api.github.com/user', r => r.fulfill({ status: 200,
    contentType: 'application/json; charset=utf-8', body: '{"login":"mehrlander"}' }));
  await page.addInitScript(() => {
    const ORIGIN = 'https://shop.example';
    const entries = new Map([
      ['cart', JSON.stringify({ items: [{ sku: 'LAMP-7', qty: 1 }, { sku: 'MUG-2', qty: 2 }], updated: '2026-10-15T09:12:00Z' })],
      ['consent', 'analytics=no; ads=no'],
      ['recentSearches', JSON.stringify(['desk lamp', 'mugs', 'linen napkins'])],
      ['theme', 'dark'],
    ]);
    const pageLS = {
      get length() { return entries.size; },
      key(i) { return [...entries.keys()][i] ?? null; },
      getItem(k) { return entries.has(k) ? entries.get(k) : null; },
    };
    const real = window.indexedDB;
    const pageIDB = {
      open: (name, version) => real.open(name, version),
      databases: async () => (await real.databases()).filter(d => d.name.startsWith('shop')),
    };
    const seeded = new Promise((res) => {
      const r = real.open('shop-catalog', 1);
      r.onupgradeneeded = () => {
        const items = r.result.createObjectStore('items', { keyPath: 'sku' });
        items.put({ sku: 'LAMP-7', name: 'Desk lamp', price: 48, stock: 12 });
        items.put({ sku: 'MUG-2', name: 'Stoneware mug', price: 14, stock: 40 });
        items.put({ sku: 'NAP-4', name: 'Linen napkins, set of four', price: 22, stock: 0 });
        r.result.createObjectStore('views').put({ at: '2026-10-15T09:10:00Z', sku: 'LAMP-7' }, 1);
      };
      r.onsuccess = () => { r.result.close(); res(); };
      r.onerror = () => res();
    });
    const opener = {
      postMessage(msg) {
        const send = (data) => {
          const ev = new MessageEvent('message', { data, origin: ORIGIN, source: null });
          Object.defineProperty(ev, 'source', { value: opener });
          window.dispatchEvent(ev);
        };
        if (msg?.type === 'courier-ready') {
          setTimeout(() => send({ type: 'courier-page', url: ORIGIN + '/catalog', title: 'Shop catalog',
            selection: '', links: [{ text: 'Lamps', href: ORIGIN + '/lamps' }] }), 50);
        } else if (msg?.type === 'courier-run') {
          seeded.then(async () => {
            try {
              const text = await new Function('localStorage', 'indexedDB', 'location', 'ctx', msg.code)(
                pageLS, pageIDB, { host: 'shop.example' }, { errand: msg.errand });
              send({ type: 'courier-ran', id: msg.id, text: String(text) });
            } catch (e) { send({ type: 'courier-ran', id: msg.id, error: String(e) }); }
          });
        }
      },
    };
    Object.defineProperty(window, 'opener', { value: opener, configurable: true });
  });
  const url = new URL(page.url());
  url.search = '?view=stage&courier=1';
  await page.goto(url.href, { waitUntil: 'load' });
  await page.locator('text=shop.example stores in this browser').first().click({ timeout: 20000 });
  await page.locator('[data-id="idb:shop-catalog/items"]').first().click({ timeout: 20000 });
  await page.waitForTimeout(3000);
};
