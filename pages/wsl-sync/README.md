# WSL Sync & Pension Dashboard

A pair of GitHub Pages apps tracking Washington State Legislature pension
bills for the current biennium:

- [`wsl-sync.html`](wsl-sync.html) — the **syncer**: refreshes bill data from
  the legislature's SOAP services (`wslwebservices.leg.wa.gov`), browses all
  six stores, and persists augmentations to the browser's IndexedDB.
- [`pension-dash.html`](pension-dash.html) — the **reader**: renders the
  bills that classify as pension-related. It never fetches from the
  legislature; it reads the committed snapshot (plus any IDB overlay).

Both are thin Alpine UIs over `window.wsl`. The logic lives in two kits
under [`lib/kits/`](../../lib/kits/):

- [`wsl-core.js`](../../lib/kits/wsl-core.js) — **dependency-free core**:
  endpoint URL builders, the XML→record parsers (exposed as a
  `makeParsers({ XMLParser, flatten })` factory rather than importing the
  libraries), pension classification, and pure list/group helpers. Because it
  imports nothing, the same file runs in the browser (via `gh.load`) and in
  Node (`fetch-data.mjs` executes it with `new Function`, exactly as
  `gh.load` would).
- [`wsl.js`](../../lib/kits/wsl.js) — **browser kit**: loads the core,
  registers `window.wsl` with lazy parsers (the XML libraries load from the
  CDN only on the first parse call, so a snapshot-only page like pension-dash
  never downloads them), the snapshot loader (`loadStore`/`saveStore`),
  direct fetch-and-parse helpers, and the RCW lookup/linkify/popup display
  utilities.

## Two kinds of data

| Data | Where | What it is |
|---|---|---|
| `rcw/*.json` | committed in this folder | Static **RCW corpus** (titles, chapters, full cite hierarchy of the Revised Code of Washington) — reference data for lookups, labels, and popups. Doesn't change with bills. |
| Six bill stores | committed in `data/<biennium>/*.json`, overlaid by IndexedDB | **Per-biennium bill data**: `legislation`, `prefiles`, `sponsors`, `rcws` (RCW cites affected per bill — the classifier's input), `history`, `actions`. |

## How the pages get bill data

The **committed snapshot is the source of truth**: at load, both pages call
`wsl.loadStore`, which fetches `data/<biennium>/<store>.json` alongside the
page. IndexedDB (idb-keyval, keys `wsl-<biennium>-<store>`) overlays **only
the keyed stores** (`rcws`, `history`, `actions`) — an in-browser sync can
persist per-bill data for bills beyond the snapshot, and those keys merge on
top. The list stores (`legislation`, `prefiles`, `sponsors`) always come from
the committed files, so a stale browser overlay can never shadow a refreshed
snapshot.

In-browser augmentation happens in wsl-sync.html, two ways: **direct sync**
(CORS permitting — in practice blocked when served from GitHub Pages) and
**paste mode**, which generates per-store console snippets to run on
`wslwebservices.leg.wa.gov` (where the fetches are same-origin), then parses
the pasted response and saves it to IDB.

## Refreshing the snapshot

### The WSL fetch Action (primary path)

The [`WSL fetch` workflow](../../.github/workflows/wsl-fetch.yml) runs
`fetch-data.mjs` on a GitHub runner (open egress, no CORS) and commits the
result under `data/<biennium>/`. Trigger it from the
[Actions tab](https://github.com/mehrlander/web-tools/actions/workflows/wsl-fetch.yml)
(inputs: biennium, limit, full), or let the monthly cron keep the open
biennium fresh.

### Locally

[`fetch-data.mjs`](fetch-data.mjs) runs anywhere with Node 18+ and direct
network access to `wslwebservices.leg.wa.gov` (the Claude Code sandbox
default allowlist blocks it — a blocked host answers 403 with
`x-deny-reason: host_not_allowed`):

```sh
npm install            # once; pulls fast-xml-parser + flat (same versions the pages use)
npm run wsl-fetch                          # incremental: refetch lists, fill missing per-bill data
npm run wsl-fetch -- --full                # refetch everything (use for an open biennium)
npm run wsl-fetch -- --limit 50            # cap per-bill fetches (smoke test)
npm run wsl-fetch -- --biennium 2023-24    # a past biennium → data/2023-24/
```

Each biennium archives to its own `data/<biennium>/` directory instead of
overwriting. Closed biennia (sessions over) are fetched once and never
change. An **open** biennium's per-bill data (`rcws`, `history`, `actions`)
keeps growing, so refresh it with `--full` rather than incrementally — the
top-level lists are re-fetched every run regardless.

## Store shapes (`data/*.json` and the IDB overlay alike)

| Store | Shape | Built by |
|---|---|---|
| `legislation`, `prefiles` | array of bills | `consolidate(parseLegislationXml(xml))` |
| `sponsors` | array | `parseSponsorsXml(xml)` |
| `rcws` | object keyed by `BillId` | `parseRcwXml(xml, billId)` — includes the pension classification |
| `history`, `actions` | object keyed by `BillNumber`, values arrays | `parseHistoryXml` / `parseActionsXml` — fetched only for pension/adjacent bills |

`data/meta.json` records when the snapshot was fetched and its counts.

## Dependency pin: fast-xml-parser 4.5.1

The XML libraries are pinned to the same versions in both runtimes —
`fast-xml-parser@4.5.1` + `flat@6` as CDN imports in `wsl.js` and as npm
devDependencies for `fetch-data.mjs` — so browser and Node run the identical
transform/classify code. `npm audit` flags fast-xml-parser <5.7.0
([GHSA-gh4j-gqv2-49f6](https://github.com/advisories/GHSA-gh4j-gqv2-49f6)),
but the advisory is against `XMLBuilder` (XML *writing*), which this code
never uses — only `XMLParser`. The v5 major bump is deliberately deferred;
if it ever happens, bump both runtimes together.
