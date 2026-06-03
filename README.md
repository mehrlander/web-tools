# web-tools

A workshop for browser-based tools with a focus on working with data.
[Pages](#pages), [bookmarklets](#bookmarklets), [popups](#popups), [console snippets](#console-snippets), plus the parts used to build them.

Four shapes have emerged:

- **Pages.** Independent pages for related tasks. Served from GitHub
  Pages, a local file, a data URL, or a popup, as needed.
- **Bookmarklets.** Snippets for interacting with a specific domain or
  with any domain generally.
- **Popups.** A host-coupled page, opened in a new window. The shared
  origin lets it reach that origin's storage and make the cross-origin
  requests CORS would block, while `window.opener` gives a live handle to
  the host page.
- **Console.** Snippets stored in DevTools, designed for a CLI
  experience — when you'd rather type a command and read the result than
  click a bookmark.

Popups are essentially a page launched as a bookmarklet:

```js
const launchPopup = h => {
  const p = window.open('', '', 'width=400,height=300');
  p.document.write(h);
  p.document.close();
};

launchPopup('<h1>Test</h1><button onclick="window.opener.document.body.style.background=\'red\'">Red</button>');
```
The working surfaces are powerful, but constrained. Challenges arise:
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
| [compression-helper](https://mehrlander.github.io/web-tools/pages/compression-helper.html) | Paste text, run brotli or gzip, get back a compact blob or a self-decompressing bookmarklet. |
| [table-compress](https://mehrlander.github.io/web-tools/pages/table-compress.html) / [-multi](https://mehrlander.github.io/web-tools/pages/table-compress-multi.html) | Apply a JS transform per row, then bundle the result through brotli/gz. |
| [show-repo](https://mehrlander.github.io/web-tools/pages/show-repo/) | Browse any GitHub repo as a sidebar tree with a viewer pane. |
| [demos/](https://mehrlander.github.io/web-tools/lib/kits/demos/) | One small demo page per kit (`persistence`, `messaging`, `io`, `compression`). Double-duty as a builder reference. |
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
- [`data-shelf`](popups/data-shelf.html): persistent shelf for code and
  data, scoped to the domain you run it on. Store, edit, view, run, and
  export records where you want them; imports records forward from legacy
  IDB databases. (On github.io it runs against its own origin, which is a
  bench, not the job.)
- [`idb-nav`](popups/idb-nav.html): IndexedDB explorer for the origin it
  runs on. Every database, every store, edit records, delete what you
  don't want.

This is the newest output category and the one most likely to grow.

**Launcher.** One bookmarklet opens any of the above on whatever page you're
on. It opens a single blank window from the host page — which inherits the
host's origin — fetches [`launch.js`](popups/launch.js) as text **through the
GitHub API** and runs it inside that window. There's no GitHub Pages or CDN in
the path: the launcher arrives the same way the popups do, by API. `launch.js`
lists `popups/` and paints a menu *in the window*; picking an item
`document.write`s the chosen popup's HTML into that **same** window, so it flops
from menu to tool without ever changing the window object. The host origin and
`window.opener` survive the flop, which is the whole point — the popup runs
coupled to the host. The menu rebuilds itself from the folder, so new popups
appear with no edit to the bookmarklet.

```js
javascript:(async()=>{const t='',R='mehrlander/web-tools',F='main';const w=open('','','width=980,height=740');w.__ghToken=t;w.__ghRepo=R;w.__ghRef=F;const H={Accept:'application/vnd.github.raw'};if(t)H.Authorization='Bearer '+t;const c=await fetch(`https://api.github.com/repos/${R}/contents/popups/launch.js?ref=${F}`,{headers:H}).then(r=>r.text());const s=w.document.createElement('script');s.textContent=c;w.document.body.appendChild(s)})()
```

The bookmarklet is only the irreducible bootstrap: open a blank window (must
happen on a host click, so the popup inherits the host origin), carry the token,
fetch `launch.js`, and inject it. It can't be shorter without giving up something
— `launch.js` can't fetch itself, so that load lives here; everything after it is
already in the repo. The `Accept: application/vnd.github.raw` header returns the
file's text directly, which is why there's no base64 decode.

The token lives in the bookmarklet — the `const t=''` at the very front. Paste a
GitHub token between those quotes (a fine-grained PAT, read-only contents on this
repo, is plenty); that's the only thing you normally edit. It rides onto the popup
as `w.__ghToken`, and the same token fetches both `launch.js` and each popup. The
token has to travel with the bookmarklet because each host page is a different
origin — there's no shared storage to stash it in. On a public repo you can leave
it blank and it still works at the unauthenticated rate limit; the token is for
private repos and the higher limit, and because it's an API load (not Pages or a
CDN) the private case needs no other change. `R` and `F` are the repo and ref —
point `F` at a branch to test launcher changes before they reach `main`. Behavior
lives in `launch.js`, so it updates on the repo with no change to the bookmarklet.

### Console snippets

Code you paste into DevTools and run against the page in front of you — no
file to host, no bookmark to install. The reusable ones live in `console/`:

- [`base.js`](console/base.js): a DOM-query and element-inspection toolkit
  (`ea`, `glom`, `look`, `pop`, `copy`, …) for poking at a page from the
  console.
- [`to-canvas.js`](console/to-canvas.js): opens a window and renders the
  current page into a scrollable canvas via html2canvas.

## The library

Our intentions require flexibility. For pages we use a default stack:
Alpine, Tailwind, daisyUI, and Phosphor. These libraries support a
single-file approach we can pack into a data URL or popup. With a
bookmarklet, DOM-focused libraries are likely to be disruptive, and
shadow DOM or iframes may come into play.

The loader in `lib/` (`lib/gh-api.js` and its augmentations) pulls
everything else off this repo at runtime. Files it loads are written in
a specific shape (IIFE, `window.foo =`, no `import`/`export`) so they
can be pulled in without a build step. `gh-api.js`'s auto-bootstrap sets a
`loadBase` of `lib/`, so a page's `gh.load('kits/x.js')` resolves under
`lib/` without spelling out the prefix. `alpine-bundle.js` handles
Alpine's load-order quirks and the custom-element wrapper, so a page
doesn't have to. `vanilla-bundle.js` is the Alpine-free counterpart —
lightweight DOM helpers (no framework dependency) expected to grow. A few libraries (Vanilla JSON Editor among them) get
loaded through small helpers in the repo, but the base stack is assumed
already present on the page. Reaching for kits or components without
the loader is possible but cuts across the grain.

On top of that, two collections by convention:

- **Components** in `lib/alpineComponents/` are reusable UI pieces registered
  as `Alpine.data(...)`.
- **Kits** in `lib/kits/` are logic libraries (compression, persistence,
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
  hang off `window.html` as methods (`html.tip`, `html.btn`, …) in
  `vanilla-bundle.js`, alongside the Alpine directive equivalents
  (`x-tip`, `x-btn`, …) in `alpine-bundle.js`.

Two docs go deeper:

- **[SCAFFOLDING.md](docs/SCAFFOLDING.md)**: the loader contract. The canonical
  `<head>` block, what each piece contributes (`lib/gh-api.js`, `lib/gh-fetch.js`,
  `lib/gh-store.js`, `lib/gh-auth.js`, `lib/alpine-bundle.js`), how `gh.load()`
  works, the timing rules, the footgun list.
- **[lib/kits/README.md](lib/kits/README.md)**: the logic libraries (`compression`,
  `persistence`, `messaging`, `io`, `data-shelf`). What each one
  exposes on `window`, with usage examples.

The shape of a loaded page in one block:

```html
<script type="module">
  // ?use=<branch|tag|sha> overrides which ref the bundle loads from;
  // defaults to main. gh-api.js's auto-bootstrap parses owner/repo/ref
  // from its own import URL, instantiates window.gh, and chains in
  // gh-auth.js — so the page just calls gh.load() from here on.
  const ref = new URLSearchParams(location.search).get('use') || 'main';
  await import(`https://cdn.jsdelivr.net/gh/mehrlander/web-tools@${ref}/lib/gh-api.js`);

  await gh.load('kits/persistence.js');                   // logic kits (resolved under lib/)
  await gh.load('alpineComponents/viewer.js');            // UI components
  await gh.load('alpine-bundle.js');                      // boots Alpine
</script>
```

The `?use=` query parameter is the runtime ref-pinning hatch: the HTML harness is served by GitHub Pages from main, but every file the page loads at runtime comes from whatever ref `?use=` specifies (any branch name, tag, or commit SHA). Default is main, so production URLs are unchanged. Branch-pinning a page for review is a one-URL change with no per-branch hosting. Append `?use=feature-x` to any page that adopts the convention. For freshly-pushed commits, prefer the SHA, since jsDelivr caches branch tips for ~12h.

`?use=` covers the *loaded code* but not the page's own HTML/boot script, which is pinned to whatever main serves. To preview branch edits to the HTML shell itself, the FAB's "Render page" box fetches the current page's HTML as text via the contents API at the branch you pick from the dropdown — private-safe, and dodging jsDelivr's `text/plain` Content-Type on `/gh/` HTML — then hosts it in an overlay iframe via `srcdoc`. Because an `srcdoc` document's `location` has no query string, the host stamps a small prelude into the fetched HTML so the embedded page's runtime tracks the chosen ref: it sets `window.__ref` (read it directly if you like) and patches `URLSearchParams.get('use')` to return that ref, so any page already following the `?use=` convention picks it up unmodified. A `<base>` is stamped in too so the page's relative links resolve against its real directory.

Recent pages that make good templates:

- [`popups/data-shelf.html`](popups/data-shelf.html) for multiple
  kits and components with an importer and a FAB.
- [`popups/idb-nav.html`](popups/idb-nav.html) for kits, viewer, and a custom
  sidebar.
- [`pages/compression-helper.html`](pages/compression-helper.html)
  for the compression kits with Alpine loaded directly, not via
  `alpine-bundle.js`.

## Where to start

- **Use a tool.** Pick from the outputs above. Each page or popup is a
  single URL; each bookmarklet is a one-time install.
- **Build a tool.** Read [SCAFFOLDING.md](docs/SCAFFOLDING.md), copy one of the
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
