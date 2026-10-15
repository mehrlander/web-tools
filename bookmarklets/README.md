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
| [`launcher.js`](launcher.js) | Puts the off-site FAB, a Web Tools button and drawer, on a page that has none of its own. | `userscripts/lib/launcher.js` from GitHub Pages |
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
the iPhone runs the off-site FAB as a userscript. What remains for a bookmarklet is
acting on a page from a browser that cannot run extensions, the work laptop
first among them.

**On a desktop, the general bookmarklet opens the app.**
[`courier-stage.js`](courier-stage.js) opens the Web Tools app in a popup at its
own address and stays in the page to answer it: it sends the page's title,
address, selection and links by `postMessage`, and runs code the app sends back.
Everything else is the app's: the sign-in, which view the popup shows, and where
a capture goes. The popup runs under Web Tools' rules rather than the page's, so
it opens on strict pages too, and a change to what it does is a change in the
repo, never a new bookmark. Nesting belongs in the app's views: a bookmark-bar
folder of bookmarklets is a menu the app should draw instead, and the bar keeps
a few flat buttons.

**On the iPhone, the off-site FAB runs as a userscript.** [`launcher.js`](launcher.js)
is the same program as a bookmarklet: a one-line loader for
`userscripts/lib/launcher.js`, which the iPhone userscript also runs. It draws
a fab and its drawer in the page itself, so it is the phone's route and the
in-page alternative on a desktop.

**Site-specific code lives by host.** Code that knows one site's URLs and DOM
goes in [`../sites/<hostname>/`](../sites/README.md), as a bookmarklet, a console
snippet, or a courier script the Stage sends to the page. The courier's
per-origin errands carry the old data shelf's idea, scripts chosen by the domain
they run on, with the scripts versioned in git rather than kept in one
browser's IndexedDB.

**A strict page refuses a loaded script.** A page whose `script-src` names only
its own hosts refuses the `<script src>` that `launcher.js` injects
([`../userscripts/README.md`](../userscripts/README.md) has the first
measurement). In headless Chrome on 2026-10-13, github.com and en.wikipedia.org
refused it, while example.com, app.leg.wa.gov and lawfilesext.leg.wa.gov set no
policy and accepted it. A blank popup opened from the page, the route
[`popup-launcher.js`](popup-launcher.js) takes, inherits the page's policy, so on
github.com the script it writes into that popup is refused as well. A popup at
a Web Tools address, the courier's route, kept its link with the page on
github.com, en.wikipedia.org and app.leg.wa.gov, messages passing both ways.

A page that sends `Cross-Origin-Opener-Policy: same-origin` cuts that link: the
popup opens but can neither read the page nor message it. The Cloudflare check
page wsldocs.sos.wa.gov serves to an unverified client sends that header; the
real page behind it sends none (observed 2026-10-14), so there it is the check,
not the site, that would cut the link. The errand `test-2026-09-26-bookmarklet-routes` in
`mehrlander/web-tools-private` asks a computer-use session on the home laptop to
try these routes on the sites in use.

**Synchronization is deferred.** A loader bookmarklet has nothing to keep in
sync while its URL stays fixed. Only self-contained bookmarklets can drift from
this folder, and the planned source for what a browser holds is Chrome's
bookmarks export. Nothing reads that export yet.
