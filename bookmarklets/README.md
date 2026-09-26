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
