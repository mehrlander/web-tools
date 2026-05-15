// kits/persistence.js — idb-keyval-backed key/value persistence.
//
// Wraps https://github.com/jakearchibald/idb-keyval with a string-path API
// so pages can stash arbitrary state without managing schemas. All values
// are written through IndexedDB's structured-clone, so Uint8Array, Date,
// Map, Blob, etc. round-trip with their types intact.
//
// Loadable as a plain script (no ES modules):
//
//   <script src=".../kits/persistence.js"></script>
//   const { save, load } = window.persistence;
//   await save('compress.input', { text: 'hello', bytes: new Uint8Array([1,2,3]) });
//   const v = await load('compress.input');
//
// Path syntax: "<db>.<store>.<key>" with sensible defaults
//   "page.foo"            → db="page",  store="default", key="foo"
//   "page.bucket.foo"     → db="page",  store="bucket",  key="foo"
//   "page.bucket.foo.bar" → db="page",  store="bucket",  key="foo.bar"
//   "single"              → throws (require at least a namespace + key)
//
// Single-segment paths are rejected on purpose — every page should pick
// its own namespace so devtools shows separate IndexedDB databases and
// data from different pages doesn't collide in a shared store.

(() => {
  let mod;
  const loadIdb = async () =>
    mod ??= await import('https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm');

  // Cache store thunks by "<db>|<store>" so repeated save/load calls on the
  // same path don't spin up new transactions per call.
  const stores = new Map();

  const parsePath = (path) => {
    if (typeof path !== 'string' || !path.trim()) {
      throw new Error('persistence: path must be a non-empty string');
    }
    const parts = path.split('.').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`persistence: path "${path}" needs at least <namespace>.<key>`);
    }
    if (parts.length === 2) {
      return { db: parts[0], store: 'default', key: parts[1] };
    }
    return { db: parts[0], store: parts[1], key: parts.slice(2).join('.') };
  };

  // Build an idb-keyval-compatible store thunk: (txMode, callback) => Promise.
  // Unlike idb-keyval's built-in createStore (which opens with no version and
  // only fires onupgradeneeded for brand-new databases), this opens the DB,
  // checks whether the target store exists, and if not, reopens at version+1
  // with an upgrade that adds it. Lets us layer collections onto databases
  // that other tools on the same origin already created at higher versions.
  const buildStore = (dbName, storeName) => {
    let dbp = null;

    const ensureDb = () => new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error(`persistence: open blocked for "${dbName}"`));
      req.onupgradeneeded = () => {
        // Fresh database — create the store now so we don't need a second open.
        req.result.createObjectStore(storeName);
      };
      req.onsuccess = () => {
        const db = req.result;
        if (db.objectStoreNames.contains(storeName)) { resolve(db); return; }
        // DB exists at some version but is missing our store. Reopen with
        // version+1 and add the store in onupgradeneeded.
        const v = db.version;
        db.close();
        const up = indexedDB.open(dbName, v + 1);
        up.onerror = () => reject(up.error);
        up.onblocked = () => reject(new Error(`persistence: upgrade blocked for "${dbName}"`));
        up.onupgradeneeded = () => {
          const db2 = up.result;
          if (!db2.objectStoreNames.contains(storeName)) db2.createObjectStore(storeName);
        };
        up.onsuccess = () => resolve(up.result);
      };
    });

    return (txMode, callback) => {
      dbp ??= ensureDb();
      return dbp.then((db) =>
        callback(db.transaction(storeName, txMode).objectStore(storeName))
      );
    };
  };

  const storeFor = async (db, store) => {
    const id = `${db}|${store}`;
    let s = stores.get(id);
    if (!s) {
      s = buildStore(db, store);
      stores.set(id, s);
    }
    return s;
  };

  const save = async (path, data) => {
    const { db, store, key } = parsePath(path);
    const { set } = await loadIdb();
    await set(key, data, await storeFor(db, store));
  };

  const load = async (path) => {
    const { db, store, key } = parsePath(path);
    const { get } = await loadIdb();
    return get(key, await storeFor(db, store));
  };

  const remove = async (path) => {
    const { db, store, key } = parsePath(path);
    const { del } = await loadIdb();
    await del(key, await storeFor(db, store));
  };

  // List all keys in the store implied by `path`. The key segment of the
  // path is ignored — only db + store matter for listing.
  const list = async (path) => {
    const { db, store } = parsePath(path);
    const { keys } = await loadIdb();
    return keys(await storeFor(db, store));
  };

  // Read all entries in the store implied by `path` as an array of
  // [key, value] tuples.
  const entries = async (path) => {
    const { db, store } = parsePath(path);
    const { entries } = await loadIdb();
    return entries(await storeFor(db, store));
  };

  // Drop every key in the store implied by `path`.
  const clearStore = async (path) => {
    const { db, store } = parsePath(path);
    const { clear } = await loadIdb();
    await clear(await storeFor(db, store));
  };

  // collection(path) — record bag layered on top of idb-keyval.
  //
  //   const items = persistence.collection('dataShelf.items');
  //   const saved = await items.put({ name: 'foo', code: '...' });  // id auto-assigned
  //   await items.get(saved.id);
  //   await items.delete(saved.id);
  //   await items.all();         // [{id, ...}, ...]
  //   await items.find(pred);    // filter in JS
  //   await items.count();
  //   await items.clear();
  //
  // The collection is just an idb-keyval store (db=<db>, store=<store>); each
  // record is one entry keyed by its id. Records without an id get a fresh
  // crypto.randomUUID(). Importing legacy records with numeric ids (e.g. from
  // a Dexie ++id table) preserves the id, so re-imports overwrite cleanly.
  const collection = (path) => {
    const parts = path.split('.').map(s => s.trim()).filter(Boolean);
    if (parts.length !== 2) {
      throw new Error(`persistence: collection path "${path}" must be "<db>.<store>"`);
    }
    const [db, store] = parts;
    const keyPath = (id) => `${db}.${store}.${id}`;
    // For list/entries/clearStore the key segment is ignored; this sentinel
    // just satisfies parsePath's 3-segment shape.
    const scanPath = `${db}.${store}.x`;
    const genId = () => (globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2));

    return {
      async put(record) {
        const id = record?.id ?? genId();
        const stored = { ...record, id };
        await save(keyPath(id), stored);
        return stored;
      },
      async get(id) { return load(keyPath(id)); },
      async delete(id) { await remove(keyPath(id)); },
      async all() {
        return (await entries(scanPath)).map(([, v]) => v);
      },
      async find(pred) { return (await this.all()).filter(pred); },
      async count() { return (await list(scanPath)).length; },
      async clear() { await clearStore(scanPath); }
    };
  };

  // idb — native IndexedDB introspection. The base namespace is read-only:
  // list databases and stores on this origin, peek at record counts, pull all
  // records out of a store. Used by the data-shelf importer to migrate from
  // legacy Dexie databases (DataJarDB, DataShelfDB) and to surface anything
  // else IDB is holding for this origin. Mutating operations live under
  // `idb.admin` so callers that only want the read surface can ignore them.
  // No Dexie dependency; pure indexedDB API.
  const openDb = (dbName) => new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error(`idb: open blocked for "${dbName}"`));
  });

  const reqPromise = (r) => new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

  const idb = {
    async databases() {
      // indexedDB.databases() is supported in Chromium and Safari; Firefox
      // gained it in 125. Returns [] on older Firefox — callers should treat
      // an empty list as "unknown, not necessarily zero".
      if (typeof indexedDB.databases !== 'function') return [];
      try { return await indexedDB.databases(); }
      catch { return []; }
    },
    async stores(dbName) {
      const db = await openDb(dbName);
      const names = Array.from(db.objectStoreNames);
      db.close();
      return names;
    },
    // Like stores(), but returns one record per store with count + key shape.
    // Single open per database, so cheaper than stores()+count() in a loop
    // when a UI needs to render a tree of databases and stores.
    async storesDetail(dbName) {
      const db = await openDb(dbName);
      const names = Array.from(db.objectStoreNames);
      const out = [];
      for (const sn of names) {
        const s = db.transaction(sn, 'readonly').objectStore(sn);
        const count = await reqPromise(s.count());
        out.push({
          name: sn,
          count,
          keyPath: s.keyPath || '(key)',
          autoIncrement: s.autoIncrement
        });
      }
      db.close();
      return out;
    },
    async count(dbName, storeName) {
      const db = await openDb(dbName);
      if (!db.objectStoreNames.contains(storeName)) { db.close(); return 0; }
      return new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).count();
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },
    async readAll(dbName, storeName) {
      const db = await openDb(dbName);
      if (!db.objectStoreNames.contains(storeName)) { db.close(); return []; }
      return new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },

    // Destructive ops, kept under a sub-namespace so the read surface stays
    // boring. clearStore/deleteStore/deleteDb wrap the obvious indexedDB
    // calls; deleteStore bumps the database version since object stores can
    // only be removed during an upgrade. replaceAll wipes a store and re-adds
    // records inside one transaction — the records must carry whatever key
    // the store's keyPath expects (or omit it if the store auto-increments).
    admin: {
      async clearStore(dbName, storeName) {
        const db = await openDb(dbName);
        if (!db.objectStoreNames.contains(storeName)) { db.close(); return; }
        try {
          await reqPromise(db.transaction(storeName, 'readwrite').objectStore(storeName).clear());
        } finally { db.close(); }
      },
      async deleteStore(dbName, storeName) {
        const probe = await openDb(dbName);
        const nextVer = probe.version + 1;
        probe.close();
        await new Promise((resolve, reject) => {
          const r = indexedDB.open(dbName, nextVer);
          r.onupgradeneeded = e => {
            const d = e.target.result;
            if (d.objectStoreNames.contains(storeName)) d.deleteObjectStore(storeName);
          };
          r.onsuccess = e => { e.target.result.close(); resolve(); };
          r.onerror = () => reject(r.error);
          r.onblocked = () => reject(new Error(`idb: delete store blocked for "${dbName}.${storeName}"`));
        });
      },
      async deleteDb(dbName) {
        await new Promise((resolve, reject) => {
          const r = indexedDB.deleteDatabase(dbName);
          r.onsuccess = () => resolve();
          r.onerror = () => reject(r.error);
          r.onblocked = () => reject(new Error(`idb: delete database blocked for "${dbName}"`));
        });
      },
      async replaceAll(dbName, storeName, records) {
        const db = await openDb(dbName);
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          throw new Error(`idb: store "${storeName}" not in "${dbName}"`);
        }
        try {
          const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
          await reqPromise(store.clear());
          for (const rec of records) await reqPromise(store.add(rec));
        } finally { db.close(); }
      }
    }
  };

  window.persistence = { save, load, remove, list, entries, clearStore, parsePath, collection, idb };
})();
