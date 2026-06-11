#!/usr/bin/env node
// fetch-data.mjs — repo-side fetcher for the WSL Sync data stores.
//
// Fetches the same six stores the wsl pages consume, but from Node (no
// CORS), and writes them as JSON under pages/wsl-sync/data/<biennium>/ —
// the committed snapshot both pages load at boot via `wsl.loadStore`.
//
// Parsing is NOT reimplemented: lib/kits/wsl-core.js is dependency-free, so
// this script executes it exactly as the browser's gh.load does (a
// `new Function('gh', src)` body) and injects the same-version npm packages
// (fast-xml-parser@4.5.1, flat@6) through `makeParsers` — this script and
// the pages run the identical transform/classify code.
//
// Usage (from repo root, after npm install):
//   npm run wsl-fetch                  incremental: refetch lists, fill missing
//   npm run wsl-fetch -- --full        refetch everything, including rcws
//   node pages/wsl-sync/fetch-data.mjs --since 1/1/2025 --biennium 2025-26 --limit 50
//
// Requires direct network access to wslwebservices.leg.wa.gov (Node 18+ has
// global fetch). In a Claude Code web session that host must be on the
// environment's network allowlist; the tell for a blocked host is an
// HTTP 403 with `x-deny-reason: host_not_allowed`.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { flatten } from 'flat';

const here = path.dirname(fileURLToPath(import.meta.url));

// --- CLI ---------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name, dflt) => {
    const i = args.indexOf('--' + name);
    return i >= 0 ? args[i + 1] : dflt;
};
const BIENNIUM = opt('biennium', '2025-26');
// The legislation endpoint is date-based, not biennium-scoped; default the
// lower bound to the biennium's own start year so a past-year fetch reaches
// back far enough (and no further than needed).
const SINCE = opt('since', `1/1/${BIENNIUM.split('-')[0]}`);
const LIMIT = +opt('limit', 0);            // 0 = no cap on per-bill fetches
const CONCURRENCY = +opt('concurrency', 4);
const FULL = args.includes('--full');

// Per-biennium output dir, so each biennium archives alongside the others
// (data/2025-26/, data/2023-24/, …) instead of overwriting a flat data/.
const dataDir = path.join(here, 'data', BIENNIUM);

// --- Store I/O ----------------------------------------------------------
const readStore = (name, empty) => {
    const p = path.join(dataDir, name + '.json');
    if (FULL || !existsSync(p)) return empty;
    return JSON.parse(readFileSync(p, 'utf8'));
};
const writeStore = (name, value) => {
    writeFileSync(path.join(dataDir, name + '.json'), JSON.stringify(value));
    const n = Array.isArray(value) ? value.length : Object.keys(value).length;
    console.log(`  wrote data/${name}.json (${n} ${Array.isArray(value) ? 'items' : 'keys'})`);
};

const fetchText = async (url) => {
    const r = await fetch(url);
    if (!r.ok) {
        const deny = r.headers.get('x-deny-reason');
        throw new Error(`${r.status} on ${url}${deny ? ` (x-deny-reason: ${deny} — host not on the network allowlist)` : ''}`);
    }
    return r.text();
};

// Small fetch pool for the per-bill loops.
const pool = async (items, worker) => {
    let i = 0, done = 0;
    const run = async () => {
        while (i < items.length) {
            const item = items[i++];
            await worker(item);
            if (++done % 25 === 0 || done === items.length)
                process.stdout.write(`\r  ${done}/${items.length}`);
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
    if (items.length) process.stdout.write('\n');
};

// --- Main ---------------------------------------------------------------
// Run the dependency-free core exactly as the browser does — gh.load executes
// it as a `new Function('gh', src)` body — then inject Node's npm XML libs
// through makeParsers. Same bytes as the page, no source rewrite.
const coreSrc = readFileSync(path.join(here, '..', '..', 'lib', 'kits', 'wsl-core.js'), 'utf8');
new Function('gh', coreSrc)({});
const core = globalThis.wslCore;
const { URLS, consolidate, getBillNumber } = core;
const { parseLegislationXml, parsePrefilesXml, parseSponsorsXml,
        parseRcwXml, parseHistoryXml, parseActionsXml } = core.makeParsers({ XMLParser, flatten });

mkdirSync(dataDir, { recursive: true });

console.log(`Biennium ${BIENNIUM}, since ${SINCE}${FULL ? ', --full refetch' : ' (incremental)'}`);

// 1. The three single-call stores — always refetched (cheap).
// `GetLegislationIntroducedSince` is date-based, so a since-date that reaches
// into a prior biennium returns those bills too — and BillId isn't unique
// across biennia, so filter to the target biennium before consolidate merges.
console.log('Legislation…');
const legislation = consolidate(parseLegislationXml(await fetchText(URLS.legislation(SINCE)))
    .filter(b => b.Biennium === BIENNIUM));
writeStore('legislation', legislation);

console.log('Prefiles…');
const prefiles = consolidate(parsePrefilesXml(await fetchText(URLS.prefiles()))
    .filter(b => b.Biennium === BIENNIUM));
writeStore('prefiles', prefiles);

console.log('Sponsors…');
writeStore('sponsors', parseSponsorsXml(await fetchText(URLS.sponsors(BIENNIUM))));

// 2. RCW cites — per-bill, incremental over existing data/rcws.json.
const allBills = [...legislation, ...prefiles];
const rcws = readStore('rcws', {});
let missing = allBills.filter(b => b.BillId && !rcws[b.BillId]);
if (LIMIT) missing = missing.slice(0, LIMIT);
console.log(`RCW cites: ${Object.keys(rcws).length} cached, fetching ${missing.length} of ${allBills.length} bills…`);
await pool(missing, async (b) => {
    const r = parseRcwXml(await fetchText(URLS.rcwFor(encodeURIComponent(b.BillId), BIENNIUM)), b.BillId);
    if (r) rcws[r.BillId] = r;
});
writeStore('rcws', rcws);

// 3. History + actions — only for bills classified pension/adjacent,
//    mirroring wsl-sync.html's summary mode.
const relevant = [...new Set(allBills
    .filter(b => {
        const r = rcws[b.BillId];
        return r && (r.isPension === '1' || (r.AdjacentLabels || '') !== '');
    })
    .map(getBillNumber).filter(Boolean))];

const history = readStore('history', {});
const needH = relevant.filter(n => !history[n]);
console.log(`History: fetching ${needH.length} of ${relevant.length} pension/adjacent bills…`);
await pool(needH, async (n) => {
    history[n] = parseHistoryXml(await fetchText(URLS.historyFor(n, BIENNIUM)), n) || [];
});
writeStore('history', history);

const actions = readStore('actions', {});
const needA = relevant.filter(n => !actions[n]);
console.log(`Actions: fetching ${needA.length} of ${relevant.length} pension/adjacent bills…`);
await pool(needA, async (n) => {
    actions[n] = parseActionsXml(await fetchText(URLS.actionsFor(n, BIENNIUM)), n) || [];
});
writeStore('actions', actions);

writeStore('meta', {
    fetchedAt: new Date().toISOString(),
    biennium: BIENNIUM,
    sinceDate: SINCE,
    counts: {
        legislation: legislation.length,
        prefiles: prefiles.length,
        rcws: Object.keys(rcws).length,
        history: Object.keys(history).length,
        actions: Object.keys(actions).length
    }
});
console.log('Done.');
