# web-tools

Browser-side utilities for stashing, viewing, compressing, and shipping small
bits of data. Every page runs straight from GitHub Pages — no install, no
build. Some pages are one-off appliances you can pin and forget; the rest
share a small runtime loader that pulls components and kits off this repo on
demand.

Two ways in:

- **À la carte** — grab a single page or bookmarklet and use it.
- **The full setup** — build a new page on the scaffolding.

## À la carte

Pages, live at `https://mehrlander.github.io/web-tools/pages/<name>.html`:

| Page | What it does |
|---|---|
| [index](https://mehrlander.github.io/web-tools/pages/) | Auto-generated directory of everything in `pages/`. |
| [data-shelf-v2](https://mehrlander.github.io/web-tools/pages/data-shelf-v2.html) | Persistent scratch shelf — paste records, edit, view, run, export. Imports from legacy IDB databases. |
| [idb-nav](https://mehrlander.github.io/web-tools/pages/idb-nav.html) | IndexedDB explorer — browse every database on the origin, edit records, delete what you don't want. |
| [compression-helper-v5](https://mehrlander.github.io/web-tools/pages/compression-helper-v5.html) | Paste text → brotli/gzip → out comes a compact blob or a self-decompressing bookmarklet. |
| [table-compress](https://mehrlander.github.io/web-tools/pages/table-compress.html) / [-multi](https://mehrlander.github.io/web-tools/pages/table-compress-multi.html) | Apply a JS transform per row, then bundle the result through brotli/gz. |
| [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/) | Browse any GitHub repo as a sidebar tree with a viewer pane. |
| [demos/](https://mehrlander.github.io/web-tools/pages/demos/) | Tiny live demo per kit (`fills`, `persistence`, `messaging`, `io`, `component`). |
| [bookmarklets-story](https://mehrlander.github.io/web-tools/pages/bookmarklets-story.html) | Field notes on bookmarklet packing. |

Bookmarklets — copy the file's contents into a new bookmark (GitHub strips
`javascript:` from rendered links, so direct drag from this README won't
work):

- [`page-toggle`](bookmarklets/page-toggle.js) — flip a tab between its
  rendered URL on github.io and its source on github.com. From anywhere
  else, jumps to this repo's index.

## The full setup

For new pages that want repo browsing, compression, persistence, messaging,
or shared UI components, two docs cover the machinery:

- **[SCAFFOLDING.md](SCAFFOLDING.md)** — the loader contract. The canonical
  `<head>` block, what each piece contributes (`gh-api.js`, `gh-fetch.js`,
  `gh-store.js`, `gh-auth.js`, `alpine-bundle.js`), how `gh.load()` works,
  the timing rules, the footgun list.
- **[kits/README.md](kits/README.md)** — the logic libraries (`compression`,
  `fills`, `persistence`, `messaging`, `io`, `component`). What each one
  exposes on `window`, with usage examples.

The shape of a scaffolded page in one block:

```html
<script type="module">
  const REPO = 'mehrlander/web-tools', BRANCH = 'main';
  const mod = await import(`https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/gh-api.js`);
  window.GH = mod.default;
  const gh = new window.GH({ repo: REPO, ref: BRANCH });

  await gh.load('kits/persistence.js');                   // logic kits
  await gh.load('alpineComponents/viewer-assembled.js');  // UI components
  await gh.load('alpine-bundle.js');                      // boots Alpine
</script>
```

Recent pages that make good templates:

- [`pages/data-shelf-v2.html`](pages/data-shelf-v2.html) — multiple kits +
  components, importer, FAB.
- [`pages/idb-nav.html`](pages/idb-nav.html) — kits + viewer + custom
  sidebar.
- [`pages/compression-helper-v5.html`](pages/compression-helper-v5.html) —
  compression kits + Alpine without alpine-bundle.

## Where to start

- **Use a tool.** Pick from the menu. Every page is a single URL; pin or
  bookmark it.
- **Add a page.** Copy one of the template pages above, swap the
  `gh.load(...)` list for the kits and components you need, write your
  `x-data` factory in an inline `<script>`. Read
  [SCAFFOLDING.md](SCAFFOLDING.md) first — the loader has rules.
- **Add a kit or component.** Read [kits/README.md](kits/README.md) for the
  file-shape rules, drop the file in `kits/` or `alpineComponents/`, and
  add it to the page's `gh.load(...)` chain. No build step.
