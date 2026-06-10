// wsl-data.js — load the committed WSL snapshot into a plain store object.
//
// The repo-side fetcher (fetch-data.mjs, run by the wsl-fetch Action) commits
// one JSON file per store under data/<biennium>/, in the exact shape the pages
// keep in memory:
//   legislation / prefiles / sponsors → arrays
//   rcws / history / actions          → objects keyed by BillId or BillNumber
// so each file drops straight in with no reshaping.
//
// Source of truth is the committed files (the Action refreshes them, so the
// full lists are always current). IndexedDB is an *augment* layer for the
// keyed stores only: wsl-sync's paste flow can fetch rcws/history/actions for
// bills the snapshot doesn't cover and persist them here, and those keys merge
// on top of the file snapshot. List stores ignore IDB — the snapshot is
// authoritative for the full list, so a stale paste can never shadow it.

import { get } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

export const BIENNIUM = '2025-26';

// rcws/history/actions are keyed objects; the rest are arrays.
const KEYED = new Set(['rcws', 'history', 'actions']);
const empty = k => KEYED.has(k) ? {} : [];

export const dbKey = (k, biennium = BIENNIUM) => `wsl-${biennium}-${k}`;

// Fetch one store's JSON, falling back to its empty shape (a 404 or a parse
// failure is treated as "no data yet", never thrown — empty prefiles is valid).
const fetchStore = async (k, base) => {
    try {
        const r = await fetch(`${base}/${k}.json`, { cache: 'no-cache' });
        if (r.ok) return await r.json();
    } catch { /* fall through to empty */ }
    return empty(k);
};

// Load the requested stores. `overlay` merges IDB-persisted keys (paste flow)
// on top of the keyed stores; pass overlay:false to read the raw snapshot.
export async function loadStore({
    stores,
    biennium = BIENNIUM,
    base = `./data/${biennium}`,
    overlay = true,
} = {}) {
    const out = {};
    await Promise.all(stores.map(async k => {
        let val = await fetchStore(k, base);
        if (overlay && KEYED.has(k)) {
            const saved = await get(dbKey(k, biennium));
            if (saved && typeof saved === 'object') val = { ...val, ...saved };
        }
        out[k] = val;
    }));
    return out;
}
