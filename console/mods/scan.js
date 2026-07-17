// console/mods/scan.js — durable capture over time. Every other mod takes one
// snapshot of the DOM as it is now; scan adds the axis they lack, which is
// time: define one or more streams (a selector + a format), then trigger a
// pass on an interval, on DOM churn, or across a scroll, and each pass keeps
// only the records whose key it hasn't seen (the fresh diff) and persists them
// to IndexedDB. Poll-scroll capture is scan.sweep(): scroll to reveal what a
// virtualizer hides, capture the fresh rows, repeat until the page runs dry.
//
// The store is raw IndexedDB (no import, so the mod stays a single paste), and
// because idb-nav / data-shelf read every database on the origin, whatever
// scan writes is browsable there for free.
//
//   glom('msg'); glom.grow(); glom.scan.define('rows')   seed a stream from the set
//   glom.scan.define('rows', {selector, format})         or define it explicitly
//   glom.scan.tick()                                 one capture pass now
//   glom.scan.watch()                                capture on DOM churn
//   await glom.scan.sweep()                          scroll-until-dry capture
//   glom.scan.start(ms) / glom.scan.stop()           crude interval fallback
//   glom.scan.grab('rows')                           adopt a stream back into the set
//   glom.scan.data('rows')                           the in-memory records
//   glom.scan.join('a', 'b')                         merge two streams
//   glom.scan.highlight()                            outline captured elements
//   await glom.scan.chat()                           preset: sidebar ↔ articles
//
// This is a glom citizen, not a bystander parked in the namespace: a bare
// define() reads the working set (infers the selector, snapshots each member),
// and grab() writes captured elements back to it, so scan is the persistence
// verb on the find → dance → grab loop. A stream's format(el) returns
// { key, ... }; key is what dedups a record across passes, so its stability (a
// href, a content hash, an id, not a shifting ordinal) is where capture
// quality lives. Requires base.js + core.js (mods/infer.js for set-seeding).
(() => {
  const g = window.glom;
  if (!g?.core) return console.warn('mods/scan: base.js + mods/core.js must load first');
  const { clean, HUES, docOrder, sweep, onChurn } = g.core;
  const now = () => new Date().toISOString();
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

  // Default keyer/format when a stream is seeded from the working set instead
  // of a hand-written format: a stable key (id, own or descendant href, else a
  // text hash) plus a text/html snapshot. The same "prefer a durable handle
  // over an ordinal" rule the docs preach, applied automatically.
  const keyOf = el => el.id || el.getAttribute?.('href') || el.querySelector?.('a[href]')?.getAttribute('href') || hash(clean(el.textContent));
  const snapshot = el => ({ key: keyOf(el), text: clean(el.textContent), html: el.outerHTML });

  // raw IndexedDB — one db, one keyPath:'key' store per stream.
  const idb = {
    open: (name, version, upgrade) => new Promise((res, rej) => {
      const r = indexedDB.open(name, version);
      if (upgrade) r.onupgradeneeded = e => upgrade(e.target.result);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }),
    op: (db, store, mode, fn) => new Promise((res, rej) => {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }),
  };

  // gzip through base's single codec (pop.pack/unpack), not a private copy.
  const gzip = { compress: s => window.pop.pack(s), decompress: s => window.pop.unpack(s) };

  const S = { db: null, name: 'glom-scan', stores: {}, timer: null, stopChurn: null };

  // Ensure the db is open and holds `store`; adding a store means a version bump.
  const ensure = async store => {
    if (!S.db) S.db = await idb.open(S.name);
    if ([...S.db.objectStoreNames].includes(store)) return;
    const version = S.db.version + 1;
    S.db.close();
    S.db = await idb.open(S.name, version, db => {
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'key' });
    });
  };

  // Pull a stream's persisted records into memory, decompressing as needed.
  const hydrate = async (name, st) => {
    const raw = (await idb.op(S.db, name, 'readonly', s => s.getAll())) || [];
    st.records = await Promise.all(raw.map(async r =>
      r.compressed ? { ...r, [st.field]: await gzip.decompress(r[st.field]), compressed: false } : r));
  };

  // The fresh diff for one stream: live elements → formatted → minus what we hold.
  const capture = st => {
    const els = [...document.querySelectorAll(st.selector)].filter(st.filter);
    const live = els.map(st.format).filter(Boolean);
    const have = new Set(st.records.map(r => r.key));
    return { els, live, fresh: live.filter(r => r && !have.has(r.key)) };
  };

  const scan = {
    gzip,
    db(name) { if (name) { S.name = name; S.db?.close(); S.db = null; S.stores = {}; return scan; } return S.name; },

    async define(name, { selector, format, filter = () => true, compress = false, field = 'content', hue } = {}) {
      // Seed from the working set: glom/dance/grow to a set, and a bare
      // define() infers the selector (via mods/infer.js) and snapshots each
      // member, the same set-native shortcut watch and harvest take. Pass
      // {selector, format} to override either half.
      selector ??= g.infer ? g.infer()?.selector : null;
      if (!selector) return console.warn('scan.define: pass {selector}, or glom a set (+ load mods/infer.js) to seed one');
      format ??= snapshot;
      await ensure(name);
      const st = S.stores[name] ??= { records: [] };
      Object.assign(st, { selector, format, filter, compress, field, hue });
      await hydrate(name, st);
      console.log(`scan: stream "${name}" armed (${st.records.length} on record)`);
      return scan;
    },

    // One capture pass across every defined stream. Returns the fresh count.
    async tick() {
      let total = 0;
      for (const [name, st] of Object.entries(S.stores)) {
        if (!st.selector) continue;
        for (const r of capture(st).fresh) {
          const stored = st.compress && typeof r[st.field] === 'string'
            ? { ...r, [st.field]: await gzip.compress(r[st.field]), compressed: true }
            : { ...r, compressed: false };
          await idb.op(S.db, name, 'readwrite', s => s.put(stored));
          st.records.push({ ...r, compressed: false });
          total++;
        }
      }
      if (total) { console.log(`scan: +${total} (${scan.counts()})`); scan.highlight(); }
      return total;
    },

    counts: () => Object.entries(S.stores).map(([n, s]) => `${n}: ${s.records.length}`).join(', '),

    // Crude interval trigger — wasteful and it races scroll. Prefer watch/sweep.
    start(ms = 2000) {
      if (S.timer) return console.warn('scan: already running — stop() first');
      scan.tick();
      S.timer = setInterval(() => scan.tick(), ms);
      console.log(`scan: polling every ${ms}ms — scan.stop() to disarm`);
      return scan;
    },
    stop() {
      clearInterval(S.timer); S.timer = null;
      S.stopChurn?.(); S.stopChurn = null;
      return scan;
    },

    // Churn trigger: capture whenever the DOM mutates (debounced). The right
    // default for a live, streaming page — no idle polling, no missed rows.
    watch({ settle = 300 } = {}) {
      scan.stop();
      scan.tick();
      S.stopChurn = onChurn(() => scan.tick(), settle);
      console.log(`scan: watching DOM churn (settle ${settle}ms) — scan.stop() to disarm`);
      return scan;
    },

    // Poll-scroll capture: scroll, settle, capture the fresh rows, repeat until
    // `dry` consecutive rounds surface nothing new. The harvest scroll engine
    // (core.sweep) with a durable sink. Returns total captured this sweep.
    async sweep(opts = {}) {
      const { total, rounds, hitMax } = await sweep(() => scan.tick(), opts);
      console.log(`scan: sweep captured ${total} over ${rounds} scrolls${hitMax ? ' (hit max — raise {max})' : ''}`);
      return total;
    },

    data(name) {
      return name ? [...(S.stores[name]?.records || [])]
        : Object.fromEntries(Object.entries(S.stores).map(([n, s]) => [n, [...s.records]]));
    },

    // Adopt a stream's still-present elements as the working set, so a capture
    // flows back into the dance (census.grab / harvest, but keyed on record).
    grab(name) {
      const names = name ? [name] : Object.keys(S.stores);
      const els = [];
      for (const n of names) {
        const st = S.stores[n];
        if (!st?.selector) continue;
        const have = new Set(st.records.map(r => r.key));
        for (const el of [...document.querySelectorAll(st.selector)].filter(st.filter)) {
          const r = st.format(el);
          if (r && have.has(r.key)) els.push(el);
        }
      }
      return g.set(docOrder(els));
    },

    search(term, name) {
      const t = term.toLowerCase();
      const hit = d => Object.values(d).some(v => typeof v === 'string' && v.toLowerCase().includes(t));
      const targets = name ? { [name]: S.stores[name] } : S.stores;
      return Object.fromEntries(Object.entries(targets).map(([n, s]) => [n, (s?.records || []).filter(hit)]));
    },

    // Left-join two streams into rows; unmatched members of b tail on. Default
    // relation: b's key contains a's key (the sidebar-link ↔ page pattern).
    join(aName, bName, rel = (a, b) => typeof b.key === 'string' && typeof a.key === 'string' && b.key.includes(a.key)) {
      const as = S.stores[aName]?.records || [], bs = S.stores[bName]?.records || [];
      const used = new Set(), rows = [];
      for (const a of as) {
        const b = bs.find(x => rel(a, x));
        if (b) used.add(b.key);
        rows.push({ a, b: b || null, joined: !!b });
      }
      for (const b of bs) if (!used.has(b.key)) rows.push({ a: null, b, joined: false });
      return rows;
    },

    async clear(name, term) {
      scan.stop();
      const targets = name ? { [name]: S.stores[name] } : S.stores;
      for (const [n, st] of Object.entries(targets)) {
        if (!st) continue;
        if (term) {
          const t = term.toLowerCase();
          const doomed = st.records.filter(d => Object.values(d).some(v => typeof v === 'string' && v.toLowerCase().includes(t)));
          st.records = st.records.filter(d => !doomed.includes(d));
          await Promise.all(doomed.map(d => idb.op(S.db, n, 'readwrite', s => s.delete(d.key))));
        } else {
          st.records = [];
          await idb.op(S.db, n, 'readwrite', s => s.clear());
        }
      }
      scan.highlight();
      return scan;
    },

    // Outline the elements each stream has on record, one hue per stream.
    highlight() {
      document.querySelectorAll('[data-scan]').forEach(el => { el.style.outline = ''; el.removeAttribute('data-scan'); });
      Object.entries(S.stores).forEach(([name, st], i) => {
        if (!st.selector) return;
        const have = new Set(st.records.map(r => r.key));
        [...document.querySelectorAll(st.selector)].filter(st.filter).forEach(el => {
          const r = st.format(el);
          if (r && have.has(r.key)) { el.style.outline = `2px solid ${st.hue || HUES[i % HUES.length]}`; el.setAttribute('data-scan', name); }
        });
      });
      return scan;
    },

    // Preset for chat UIs: a sidebar of conversation links (captions) joined to
    // the message bodies on the page (contents, content-hashed so distinct
    // messages persist rather than one blob per URL). A starting template —
    // retarget the selectors to the site in front of you.
    async chat() {
      await scan.define('captions', {
        selector: 'aside a[href]',
        format: a => ({ key: a.getAttribute('href'), caption: clean(a.textContent), firstSeen: now() }),
      });
      await scan.define('contents', {
        selector: 'article', compress: true, field: 'content',
        format: el => { const text = clean(el.textContent); return text ? { key: hash(text), content: el.innerHTML, chars: text.length, capturedAt: now() } : null; },
      });
      console.log('scan: chat preset armed (captions ← aside a[href], contents ← article). scan.watch() to run.');
      return scan;
    },
  };

  g.scan = scan;
})();
