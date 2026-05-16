# web-tools

Two patterns recur when you build tools in a browser: a small set of output
formats they tend to take, and a small set of building blocks you reach for
to produce them. This repo is the working record of both.

The outputs come in three shapes:

- **Pages.** Full-screen browser tabs you navigate to.
- **Bookmarklets.** Snippets that run on whatever tab is already open.
- **Popups.** Small windows opened from another tab to act as a side-helper
  on a specific origin. The newest category, still forming.

The building blocks are one library, used together:

- **Scaffolding** at the repo root (`gh-api.js` and its augmentations,
  `alpine-bundle.js`) bootstraps a page and loads everything else off
  this repo at runtime.
- **Kits** in `kits/` are non-UI logic libraries (compression, persistence,
  messaging, io, file shapes).
- **Alpine components** in `alpineComponents/` are reusable UI pieces
  registered as `Alpine.data(...)`.

You don't pick one of the three. A scaffolded page loads the scaffolding,
then loads whichever kits and components it needs, in that order. Kits and
components are written in a specific shape (IIFE, `window.foo =`, no
`import`/`export`) so they can be pulled in by the scaffolding's runtime
loader. Reaching for them without the scaffolding is possible but cuts
across the grain.

## Outputs

### Pages

Live at `https://mehrlander.github.io/web-tools/pages/<name>.html`:

| Page | What it does |
|---|---|
| [index](https://mehrlander.github.io/web-tools/pages/) | Auto-generated directory of everything in `pages/`. |
| [data-shelf](https://mehrlander.github.io/web-tools/pages/data-shelf/) | Persistent scratch shelf. Paste records, edit, view, run, export. Imports records forward from legacy IDB databases. |
| [idb-nav](https://mehrlander.github.io/web-tools/pages/idb-nav.html) | IndexedDB explorer. Every database on the origin, every store, edit records, delete what you don't want. |
| [compression-helper](https://mehrlander.github.io/web-tools/pages/compression-helper/) | Paste text, run brotli or gzip, get back a compact blob or a self-decompressing bookmarklet. |
| [table-compress](https://mehrlander.github.io/web-tools/pages/table-compress.html) / [-multi](https://mehrlander.github.io/web-tools/pages/table-compress-multi.html) | Apply a JS transform per row, then bundle the result through brotli/gz. |
| [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/) | Browse any GitHub repo as a sidebar tree with a viewer pane. |
| [demos/](https://mehrlander.github.io/web-tools/pages/demos/) | One small demo page per kit (`fills`, `persistence`, `messaging`, `io`, `component`). Double-duty as a builder reference. |
| [bookmarklets-story](https://mehrlander.github.io/web-tools/pages/bookmarklets-story.html) | Field notes on bookmarklet packing. |

The `compression-helper/` and `data-shelf/` folders each contain the current
version as `index.html` plus older iterations alongside. The auto-listed
index at `pages/` is the full directory if you want to see everything,
including development scratchpads not curated above.

### Bookmarklets

GitHub strips `javascript:` from rendered markdown, so direct drag from this
README won't work. Open the source, copy the file's contents, paste into a
new bookmark.

- [`page-toggle`](bookmarklets/page-toggle.js): flip a tab between its
  rendered URL on github.io and its source on github.com. From anywhere
  else, jumps to this repo's index.

The compression-helper page also generates bookmarklets on demand: paste
text in, get a self-decompressing `javascript:` URL out. Same output
format, different lifecycle.

### Popups

Pages designed to be opened in a small window from another tab, usually by
a bookmarklet or `window.open` from a specific origin. Live at
`https://mehrlander.github.io/web-tools/popups/<name>.html`:

- [`drop-file`](popups/drop-file.html): drop a file in, get its bytes on
  `window.lastFile` for inspection in the console.
- [`link-capture`](popups/link-capture.html): iframe link tracker for
  walking a site's navigation.
- [`render-engine-editor`](popups/render-engine-editor.html): editor for
  bookmarklet render-engine operations.

This is the newest output category and the one most likely to grow.

## The library

For new pages and the rest of the building-block side of the repo, two docs
cover the machinery:

- **[SCAFFOLDING.md](SCAFFOLDING.md)**: the loader contract. The canonical
  `<head>` block, what each piece contributes (`gh-api.js`, `gh-fetch.js`,
  `gh-store.js`, `gh-auth.js`, `alpine-bundle.js`), how `gh.load()` works,
  the timing rules, the footgun list.
- **[kits/README.md](kits/README.md)**: the logic libraries (`compression`,
  `fills`, `persistence`, `messaging`, `io`, `component`, `data-shelf`).
  What each one exposes on `window`, with usage examples.

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

- [`pages/data-shelf/index.html`](pages/data-shelf/index.html) for multiple
  kits and components with an importer and a FAB.
- [`pages/idb-nav.html`](pages/idb-nav.html) for kits, viewer, and a custom
  sidebar.
- [`pages/compression-helper/index.html`](pages/compression-helper/index.html)
  for the compression kits with Alpine loaded directly, not via
  `alpine-bundle.js`.

## Where to start

- **Use a tool.** Pick from the outputs above. Each page or popup is a
  single URL; each bookmarklet is a one-time install.
- **Build a tool.** Read [SCAFFOLDING.md](SCAFFOLDING.md), copy one of the
  template pages, edit the `gh.load(...)` list for the kits and components
  you need, write your `x-data` factory in an inline `<script>`. The kits
  and components are your library, not a separate path.
- **Extend the library.** When an existing kit or component doesn't cover
  what you need, add one. The file-shape rules are in
  [kits/README.md](kits/README.md). Drop the new file in `kits/` or
  `alpineComponents/` and add it to a page's `gh.load(...)` chain. No
  build step.

## A note on `archive/`

The repo's top-level `archive/` folder is reference material from earlier
iterations, kept on disk for grep value. Not part of the current library or
the menu above.
