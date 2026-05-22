# web-tools

A workshop for browser-based tools with a focus on working with data.
Pages, bookmarklets, popups, plus the parts used to build them.

Three shapes have emerged:

- **Pages.** Independent pages for related tasks. Served from GitHub
  Pages, a local file, a data URL, or a popup, as needed.
- **Bookmarklets.** Snippets for interacting with a specific domain or
  with any domain generally.
- **Popups.** A page opened as a popup window from a specific origin.
  Interacts with `window.opener` and makes HTTP requests where an
  independent page would trip over CORS restrictions.

Console snippets kept in DevTools could be considered a fourth. Popups are essentially a page launched as a bookmarklet:

```js
const launchPopup = h => {
  const p = window.open('', '', 'width=400,height=300');
  p.document.write(h);
  p.document.close();
};

launchPopup('<h1>Test</h1><button onclick="window.opener.document.body.style.background=\'red\'">Red</button>');
```

These formats are fundamentally awkward.  Challenges arise:
- Workflow (storing and updating code), given size limits and needed escapement
- Functionality (persisting data, reaching other files, and communicating between domains or windows).

The workflow constraint can be addressed with a helper page for converting to and from.

As a library, the base is a module that reads and writes against this
repo, using an API token (the `🎟️GitHubToken` sentinel or
`localStorage.ghToken`). Layered on top are helpers for fetching and
storing, and beyond those, whatever else a page needs to pull in. We've
adopted conventions for UI components and logic kits, both written to a
contract the loader understands. Drop-in libraries like Tabulator and
Vanilla JSON Editor are the polished form of the same idea; our pieces
extend them and sit alongside them.

As a workshop, we want updates to flow. Load time matters less. At
times we load from private repos. We want the cleanest path to offload
and reuse UI and logic.

## Outputs

### Pages

Live at `https://mehrlander.github.io/web-tools/pages/<name>.html`:

| Page | What it does |
|---|---|
| [index](https://mehrlander.github.io/web-tools/pages/) | Auto-generated directory of everything in `pages/`. |
| [data-shelf](https://mehrlander.github.io/web-tools/pages/data-shelf.html) | Persistent scratch shelf. Paste records, edit, view, run, export. Imports records forward from legacy IDB databases. |
| [idb-nav](https://mehrlander.github.io/web-tools/pages/idb-nav.html) | IndexedDB explorer. Every database on the origin, every store, edit records, delete what you don't want. |
| [compression-helper](https://mehrlander.github.io/web-tools/pages/compression-helper.html) | Paste text, run brotli or gzip, get back a compact blob or a self-decompressing bookmarklet. |
| [table-compress](https://mehrlander.github.io/web-tools/pages/table-compress.html) / [-multi](https://mehrlander.github.io/web-tools/pages/table-compress-multi.html) | Apply a JS transform per row, then bundle the result through brotli/gz. |
| [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/) | Browse any GitHub repo as a sidebar tree with a viewer pane. |
| [demos/](https://mehrlander.github.io/web-tools/pages/demos/) | One small demo page per kit (`fills`, `persistence`, `messaging`, `io`). Double-duty as a builder reference. |
| [bookmarklets-story](https://mehrlander.github.io/web-tools/pages/bookmarklets-story.html) | Field notes on bookmarklet packing. |

The auto-listed index at `pages/` is the full directory if you want to see
everything, including development scratchpads not curated above.

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

Live at `https://mehrlander.github.io/web-tools/popups/<name>.html`:

- [`drop-file`](popups/drop-file.html): drop a file in, get its bytes on
  `window.lastFile` for inspection in the console.
- [`link-capture`](popups/link-capture.html): iframe link tracker for
  walking a site's navigation.
- [`render-engine-editor`](popups/render-engine-editor.html): editor for
  bookmarklet render-engine operations.

This is the newest output category and the one most likely to grow.

## The library

Our intentions require flexibility. For pages we use a default stack:
Alpine, Tailwind, daisyUI, and Phosphor. These libraries support a
single-file approach we can pack into a data URL or popup. With a
bookmarklet, DOM-focused libraries are likely to be disruptive, and
shadow DOM or iframes may come into play.

The loader at the repo root (`gh-api.js` and its augmentations) pulls
everything else off this repo at runtime. Files it loads are written in
a specific shape (IIFE, `window.foo =`, no `import`/`export`) so they
can be pulled in without a build step. `alpine-bundle.js` handles
Alpine's load-order quirks and the custom-element wrapper, so a page
doesn't have to. `vanilla-bundle.js` is the Alpine-free counterpart —
lightweight DOM helpers (no framework dependency) expected to grow. A few libraries (Vanilla JSON Editor among them) get
loaded through small helpers in the repo, but the base stack is assumed
already present on the page. Reaching for kits or components without
the loader is possible but cuts across the grain.

On top of that, two collections by convention:

- **Components** in `alpineComponents/` are reusable UI pieces registered
  as `Alpine.data(...)`.
- **Kits** in `kits/` are logic libraries (compression, persistence,
  messaging, io, file shapes), not dependent on Alpine.

The same handful of concerns drove every piece of it:

- **Loading our own code into a page reliably.** Authenticated reads against
  private repos (the `🎟️GitHubToken` sentinel plus `localStorage.ghToken`
  fallback in `gh-auth.js`), and cache-busting so a freshly-edited file
  actually shows up. This is the whole reason there's a runtime loader at
  all instead of plain `<script src>` tags.
- **Persistent storage that survives reloads and keeps rich types intact.**
  `Uint8Array`, `Date`, `Map`, `Blob` round-trip without manual
  serialization. `kits/persistence.js` over idb-keyval.
- **Compressing text small enough to ship inside a bookmarklet URL.**
  Brotli/gzip plus self-decompressing packers. `kits/compression.js`.
- **Moving bytes in and out of the browser.** File picker, download,
  clipboard, with the quirks handled (devtools focus, iOS gesture chain,
  Firefox `readText` gates). `kits/io.js`.
- **Loose coupling between independent components on the same page.**
  Pub/sub keyed on opaque paths so a component can publish a selection
  without knowing who's listening. `kits/messaging.js`.
- **Composing UI without a build step.** Tailwind/daisyUI string helpers
  in `kits/fills.js`, with the custom-element wrapper now living in
  `alpine-bundle.js`.

Two docs go deeper:

- **[SCAFFOLDING.md](SCAFFOLDING.md)**: the loader contract. The canonical
  `<head>` block, what each piece contributes (`gh-api.js`, `gh-fetch.js`,
  `gh-store.js`, `gh-auth.js`, `alpine-bundle.js`), how `gh.load()` works,
  the timing rules, the footgun list.
- **[kits/README.md](kits/README.md)**: the logic libraries (`compression`,
  `fills`, `persistence`, `messaging`, `io`, `data-shelf`). What each one
  exposes on `window`, with usage examples.

The shape of a loaded page in one block:

```html
<script type="module">
  // ?use=<branch|tag|sha> overrides which ref the bundle loads from;
  // defaults to main. gh-api.js's auto-bootstrap parses owner/repo/ref
  // from its own import URL, instantiates window.gh, and chains in
  // gh-auth.js — so the page just calls gh.load() from here on.
  const ref = new URLSearchParams(location.search).get('use') || 'main';
  await import(`https://cdn.jsdelivr.net/gh/mehrlander/web-tools@${ref}/gh-api.js`);

  await gh.load('kits/persistence.js');                   // logic kits
  await gh.load('alpineComponents/viewer.js');            // UI components
  await gh.load('alpine-bundle.js');                      // boots Alpine
</script>
```

The `?use=` query parameter is the runtime ref-pinning hatch: the HTML harness is served by GitHub Pages from main, but every file the page loads at runtime comes from whatever ref `?use=` specifies (any branch name, tag, or commit SHA). Default is main, so production URLs are unchanged. Branch-pinning a page for review is a one-URL change with no per-branch hosting. Append `?use=feature-x` to any page that adopts the convention. For freshly-pushed commits, prefer the SHA, since jsDelivr caches branch tips for ~12h.

Recent pages that make good templates:

- [`pages/data-shelf.html`](pages/data-shelf.html) for multiple
  kits and components with an importer and a FAB.
- [`pages/idb-nav.html`](pages/idb-nav.html) for kits, viewer, and a custom
  sidebar.
- [`pages/compression-helper.html`](pages/compression-helper.html)
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

Components can include an opt-in `description: '...'` field on the object
returned from the factory. The FAB modal scans the page for `[x-data]`
elements and surfaces the description next to the component name, so a
one-sentence summary is enough.

## A note on `archive/`

The repo's top-level `archive/` folder is reference material from earlier
iterations, kept on disk for grep value. Not part of the current library or
the menu above.
