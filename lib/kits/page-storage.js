// What a visited page keeps in its browser storage, read from inside that page.
//
// Browser storage is filed by origin, so no page on mehrlander.github.io can
// read another site's localStorage or IndexedDB. The courier is the one way in:
// its bookmark runs code the app sends ON the visited page and posts back what
// the code returns (courier/README.md). This kit is that code for the This
// browser view's Page tab, and only that: read() runs in the visited page, and
// script(request) is the text the app sends to run it.
//
// read() READS AND RETURNS, by the same rule an errand script follows. It opens
// no database it was not listed, writes nothing, and closes what it opens. It
// is serialized with toString() and run in another realm, so it must stay
// self-contained: no reference to anything outside its own body.
//
// One request per call, carried in ctx.errand (the bookmark hands every script
// that one argument, named for the errands it was built for):
//   { read: 'inventory' }               localStorage keys and sizes, the quota
//                                        estimate, and every database's stores
//                                        with their counts and key paths
//   { read: 'ls', key }                  one localStorage value
//   { read: 'store', db, store, limit }  a store's first `limit` records (default
//                                        500) and its total count
// Every answer is a JSON string. A value IndexedDB holds that JSON cannot
// (a Date, a Blob, binary) comes back as a labelled stand-in, never as a throw.
window.PageStorage = {
  async read(ctx) {
    const q = (ctx && ctx.errand) || {};
    const msg = (e) => String((e && e.message) || e);
    const req = (r) => new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    // Open a database the browser listed, never create one: an upgrade means
    // it does not exist, and is aborted before it can.
    const open = (name) => new Promise((resolve, reject) => {
      const r = indexedDB.open(name);
      r.onupgradeneeded = () => { r.transaction.abort(); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('no database named ' + name));
      r.onblocked = () => reject(new Error(name + ' is blocked by another connection'));
    });
    const plain = (v, depth) => {
      if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
      if (typeof v === 'bigint') return String(v) + 'n';
      if (depth > 24) return '[nested too deep]';
      if (v instanceof Date) return v.toISOString();
      if (typeof Blob !== 'undefined' && v instanceof Blob) return { '[blob]': v.type || 'unknown type', bytes: v.size };
      if (v instanceof ArrayBuffer) return { '[binary]': 'ArrayBuffer', bytes: v.byteLength };
      if (ArrayBuffer.isView(v)) return { '[binary]': v.constructor.name, bytes: v.byteLength };
      if (v instanceof Map) return [...v].map(([k, x]) => [plain(k, depth + 1), plain(x, depth + 1)]);
      if (v instanceof Set) return [...v].map(x => plain(x, depth + 1));
      if (Array.isArray(v)) return v.map(x => plain(x, depth + 1));
      if (typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) out[k] = plain(v[k], depth + 1);
        return out;
      }
      return String(v);
    };

    if (q.read === 'ls') return JSON.stringify({ value: localStorage.getItem(String(q.key)) });

    if (q.read === 'store') {
      const limit = Math.max(1, Math.min(5000, Number(q.limit) || 500));
      const db = await open(String(q.db));
      try {
        const st = db.transaction(String(q.store), 'readonly').objectStore(String(q.store));
        const [keys, values, total] = await Promise.all([
          req(st.getAllKeys(null, limit)), req(st.getAll(null, limit)), req(st.count())]);
        return JSON.stringify({
          total, keyPath: st.keyPath == null ? null : st.keyPath,
          entries: keys.map((k, i) => ({ key: plain(k, 0), value: plain(values[i], 0) })),
        });
      } finally { db.close(); }
    }

    const out = { host: location.host, ls: [], lsErr: '', usage: null, quota: null, persisted: null,
                  dbs: [], dbState: 'ok', dbErr: '' };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || '';
        out.ls.push({ key: k, bytes: (k.length + v.length) * 2 });
      }
    } catch (e) { out.lsErr = 'not readable: ' + msg(e); }
    try { const est = await navigator.storage.estimate(); out.usage = est.usage ?? null; out.quota = est.quota ?? null; } catch (e) {}
    try { out.persisted = await navigator.storage.persisted(); } catch (e) {}
    try {
      if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
        out.dbState = 'unlisted';
      } else {
        for (const d of (await indexedDB.databases()).filter(d => d && d.name)) {
          const row = { name: d.name, stores: [], records: 0, error: '' };
          try {
            const db = await open(d.name);
            try {
              for (const name of db.objectStoreNames) {
                const st = db.transaction(name, 'readonly').objectStore(name);
                const count = await req(st.count());
                row.stores.push({ name, count, keyPath: st.keyPath == null ? '(key)' : String(st.keyPath) });
                row.records += count;
              }
            } finally { db.close(); }
          } catch (e) { row.error = 'not opened: ' + msg(e); }
          out.dbs.push(row);
        }
      }
    } catch (e) { out.dbState = 'error'; out.dbErr = 'not readable: ' + msg(e); }
    return JSON.stringify(out);
  },

  // The text the courier runs: read() itself, called with the bookmark's ctx
  // and this request in place of an errand.
  script() {
    return 'return (' + this.read.toString().replace(/^async read/, 'async function') + ')(ctx);';
  },
};
