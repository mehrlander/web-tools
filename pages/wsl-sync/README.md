# WSL Sync & Pension Dashboard

A pair of GitHub Pages apps tracking Washington State Legislature pension
bills for the current biennium:

- [`wsl-sync.html`](wsl-sync.html) — the **syncer**: fetches bill data from
  the legislature's SOAP services (`wslwebservices.leg.wa.gov`) and stores it
  in the browser's IndexedDB.
- [`pension-dash.html`](pension-dash.html) — the **reader**: renders the
  bills that classify as pension-related, from the same IndexedDB. It never
  fetches; if the sync stores are empty, it shows an empty state.
- [`wsl-api.js`](wsl-api.js) — shared endpoint URLs, XML parsers, and RCW
  lookup/display helpers. [`pension-map.js`](pension-map.js) — the
  classifier: which RCW chapters count as pension / pension-adjacent.

## Two kinds of data

| Data | Where | What it is |
|---|---|---|
| `rcw/*.json` | committed in this folder | Static **RCW corpus** (titles, chapters, full cite hierarchy of the Revised Code of Washington) — reference data for lookups, labels, and popups. Doesn't change with bills. |
| Six sync stores | browser IndexedDB (and optionally `data/*.json`, below) | **Per-biennium bill data**: `legislation`, `prefiles`, `sponsors`, `rcws` (RCW cites affected per bill — the classifier's input), `history`, `actions`. |

Both pages read/write IndexedDB via idb-keyval under keys
`wsl-<biennium>-<store>` (e.g. `wsl-2025-26-rcws`). IndexedDB is
origin-scoped, so the two pages share data wherever they're served from the
same origin (e.g. GitHub Pages).

## Getting the bill data: two paths

### Path A: in-browser sync (paste mode)

On GitHub Pages, direct fetches to `wslwebservices.leg.wa.gov` are blocked by
CORS, so wsl-sync's **paste mode** is the workflow: for each sync mode the
page generates a console snippet, you run it in DevTools on
`wslwebservices.leg.wa.gov` (where the fetches are same-origin), and paste
the copied response back. Note the per-bill modes (`rcws`, `summary`) default
to a 20-bill "limit sync" cap — turn it off to cover every missing bill in
one snippet.

### Path B: repo-side fetch (no CORS, no paste shuffle)

[`fetch-data.mjs`](fetch-data.mjs) runs the same sync from Node, where CORS
doesn't apply, and writes the stores to `data/<biennium>/*.json` in this
folder (e.g. `data/2025-26/`), so each biennium archives alongside the others
instead of overwriting:

```sh
npm install            # once; pulls fast-xml-parser + flat (same versions the pages use)
npm run wsl-fetch                          # incremental: refetch lists, fill missing per-bill data
npm run wsl-fetch -- --full                # refetch everything (use for an open biennium)
npm run wsl-fetch -- --limit 50            # cap per-bill fetches (smoke test)
npm run wsl-fetch -- --biennium 2023-24    # a past biennium → data/2023-24/
```

Closed biennia (sessions over) are fetched once and never change. An **open**
biennium's per-bill data (`rcws`, `history`, `actions`) keeps growing, so
refresh it with `--full` rather than incrementally — the top-level list is
re-fetched every run regardless.

It reuses `wsl-api.js`'s own parsers (CDN imports rewritten to the pinned npm
packages), so the JSON shapes are identical to what the pages write to
IndexedDB. Incremental by default: existing `data/rcws.json` etc. are kept
and only missing bills fetched — commit the `data/` output to make the
snapshot servable alongside the pages.

Anything with Node 18+ and open egress can run it — your machine, or a
Claude Code session **if** the environment's network policy allows
`wslwebservices.leg.wa.gov` (the default allowlist does not; a blocked host
answers 403 with `x-deny-reason: host_not_allowed`).

### Seeding the browser from `data/`

The pages currently read only IndexedDB. Until a "load from repo" button
exists, seed IDB from the committed snapshot by running this in the DevTools
console **on either page** (same-origin fetch, no paste shuffle):

```js
const { set } = await import('https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm');
const B = '2025-26';
for (const k of ['legislation','prefiles','sponsors','rcws','history','actions']) {
  const r = await fetch(`./data/${B}/${k}.json`);
  if (!r.ok) { console.log(k, '— no repo data'); continue; }
  await set(`wsl-${B}-${k}`, await r.json());
  console.log('seeded', k);
}
```

Then hit Refresh on the dashboard.

## Store shapes (IDB and `data/*.json` alike)

| Store | Shape | Built by |
|---|---|---|
| `legislation`, `prefiles` | array of bills | `consolidate(parseLegislationXml(xml))` |
| `sponsors` | array | `parseSponsorsXml(xml)` |
| `rcws` | object keyed by `BillId` | `parseRcwXml(xml, billId)` — includes the pension classification |
| `history`, `actions` | object keyed by `BillNumber`, values arrays | `parseHistoryXml` / `parseActionsXml` — fetched only for pension/adjacent bills |

`data/meta.json` records when the snapshot was fetched and its counts.
