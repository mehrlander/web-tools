# bookmarklets

Code you run **on someone else's page**, from your own bookmarks bar. That is
the whole category: each file here reaches a page this repo does not serve and
could not fetch, because the browser is already there and the sandbox is not.

Install by making a bookmark whose URL is the file's contents. Chrome stores a
`javascript:` URL parsed and percent-decodes it before running, so an encoded
bookmark still works, and the first `?` starts a query component where an
apostrophe comes back as `%27`. That is cosmetic, not broken.

| File | What it does | Loads |
| --- | --- | --- |
| [`courier-stage.js`](courier-stage.js) | The courier. Opens the Stage as a popup and sends it the page's links and selection by `postMessage`; if the Stage finds an open `courier-bookmark` errand for the page's origin, it sends the errand's script back and this runs it. | nothing; the Stage reads the errand |
| [`launcher.js`](launcher.js) | Puts the Web Tools fab and drawer on a page that has none of its own. | `userscripts/lib/launcher.js` from GitHub Pages |
| [`popup-launcher.js`](popup-launcher.js) | Opens one blank popup that inherits the host's origin, then runs the launcher menu inside it, with `window.opener` still live. | `popups/launch.js` over `api.github.com` |
| [`page-toggle.js`](page-toggle.js) | Swaps between a rendered `github.io` page and its `github.com` blob, in either direction. | nothing |
| [`toss-render.js`](toss-render.js) | From a `github.com` blob page, takes the file's text and mints its 🥏 toss link. | nothing |
| [`beam-in.js`](beam-in.js) | Draws a paste field over the page and, on paste, either evals the text, replaces `body`, or `document.write`s it. The iOS paste-and-run route. | nothing |

`beam-in.js` is the odd one: a plain IIFE rather than a `javascript:` URL, so it
is pasted or carried in rather than bookmarked.

**These are outside the harness registry on purpose.** [`docs/harness.csv`](../docs/harness.csv)
inventories every executable the repo runs **on itself**; these run on pages it
does not control, so its walker does not reach here and this table is the
inventory instead.

## Where bookmarklets fit

Bookmarklets were once the repo's general-purpose tool. The Web Tools app now
carries general utility work, sessions fetch most public pages themselves, and
the iPhone runs the launcher as a userscript. What remains for a bookmarklet is
acting on a page from a browser that cannot run extensions, the work laptop
first among them.

**One general bookmarklet, behavior in the repo.** [`launcher.js`](launcher.js)
is a one-line loader for `userscripts/lib/launcher.js`, the same body the iPhone
userscript runs, so one program serves both triggers. Its menu is where nesting
belongs: a bookmark-bar folder of bookmarklets is a menu the launcher should
draw instead. The bar keeps a few flat buttons.

**Site-specific code lives by host.** Code that knows one site's URLs and DOM
goes in [`../sites/<hostname>/`](../sites/README.md), as a bookmarklet, a console
snippet, or a courier script the Stage sends to the page. The courier's
per-origin errands carry the old data shelf's idea, scripts chosen by the domain
they run on, with the scripts versioned in git rather than kept in one
browser's IndexedDB.

**A strict page refuses the loader.** Against `script-src 'self'` the launcher
bookmarklet is refused, because it injects a `<script src>` the page's policy
blocks ([`../userscripts/README.md`](../userscripts/README.md) has the
measurement). Two routes remain on such a page: a self-contained bookmarklet
written for that site, or a popup on the Web Tools origin fed by `postMessage`,
which is the courier's pattern. Which of the sites in use are strict is not
yet measured; the errand `test-2026-09-26-bookmarklet-routes` in
`mehrlander/web-tools-private` asks a computer-use session on the home laptop
to find out.

**Synchronization is deferred.** A loader bookmarklet has nothing to keep in
sync while its URL stays fixed. Only self-contained bookmarklets can drift from
this folder, and the planned source for what a browser holds is Chrome's
bookmarks export. Nothing reads that export yet.
