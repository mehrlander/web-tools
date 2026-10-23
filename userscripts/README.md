# Userscripts

Scripts for the [Userscripts](https://github.com/quoid/userscripts) Safari
extension, the third way to run JavaScript on a page in iOS Safari beside a
bookmarklet and a Shortcuts "Run JavaScript on Web Page" action. It runs on
every matching URL with no tap and has no length limit; what it lacks on its own
is a way back, which is what the `Log-Repo` shortcut supplies.

**Install:** open the raw `.user.js` file in Safari and take the Install sheet.
Then, on a page the script matches, open the extension menu once and allow
Userscripts on every site: an iOS extension is silent on a site until it is
allowed there, and Safari only asks when the menu is opened.

**Edit, without reinstalling.** The stub is pinned to a **branch** and includes an
auto-updating loader. When installed once with GM storage permissions (`@grant GM.getValue`,
`@grant GM.setValue`, `@grant GM.xmlHttpRequest`), the stub caches and dynamically evaluates
the latest `launcher.js` body from GitHub. Updates are fetched silently in the background
(with a 5-minute cooldown) or immediately when tapping the refresh `[ ⟳ ]` button inside the
off-site FAB's drawer.

In addition, `@version {build}` and `@require ...?v={build}` bust the Userscripts Safari
extension's internal `@require` cache if manual re-installation is ever triggered.

Editing workflow:

```bash
vim userscripts/lib/launcher.js
python3 python/userscript-stub.py launcher --ref main --name 'wt launcher' \
    --description '...' --match '*://*/*'      # re-stamps body and stub
git commit && git push
```

The next time a webpage loads, the background loader detects the new build in `builds.json`,
downloads the new body into GM storage, and runs it on the subsequent page load or reload, with
no manual extension sheet.

**The bookmarklet cannot follow it there**, so the two routes read different
hosts on purpose. Raw serves `text/plain` with `nosniff`, which a browser
refuses to execute from a script tag; GitHub Pages serves it as JavaScript,
with a ten-minute cache and no purge step, but only as main has it. The test
holds the two to the same path, which is what decides which body runs.

**A branch pin costs the one thing a commit pin gave free**, knowing which copy
ran, and any cache between a push and the phone widens the gap. So the drawer
header answers the freshness question three ways, each weaker than the next but
each available where the others are not:

| Shown | Answers |
| --- | --- |
| `107ebdd` | which copy ran, always |
| `built 3h ago` | roughly how old it is, without a second number to compare |
| a warning line | that a different build is current, where the fetch is allowed |

The warning comes from [`builds.json`](builds.json), read from
raw.githubusercontent with a cache-buster rather than from the CDN, since a
manifest served by the cache it describes can be stale in exactly the case it
exists to detect. It **stays silent on failure**, because a strict `connect-src`
refuses that fetch and an unlooked-up answer reading as a good one is worse than
no verdict. `node/test/userscript-stubs.test.mjs` holds the manifest to the
body and the stamp to the file it was computed from, and holds the stub and its
bookmarklet twin to one address. A body must define `window.wt<Lib>` and do nothing on load;
the stub calls it, so one body serves both routes.

**Which route reaches a page** is in
[`bookmarklets/README.md`](../bookmarklets/README.md#which-route-reaches-a-page):
under `script-src 'self'` only the userscript mounts. That is why the off-site
FAB is a userscript, and why its styles are a constructed stylesheet rather
than a `<style>` element, which `style-src` would refuse.

- [`launcher.user.js`](launcher.user.js): **the off-site FAB**, the app's own
  button and drawer carried onto pages that have none, from
  [`lib/launcher.js`](lib/launcher.js). Renaming that file stops updates to every
  installed stub, which fetches it by path. It yields to a page that already
  has a fab; the launcher's header says how it decides.

  The drawer is a swipe deck over the page's own content. Its slides are
  `ALL_SLIDES` in [`lib/launcher.js`](lib/launcher.js) (Markdown, Selection,
  Sandbox, Text, Links, HTML, JSON, Image, Details; Selection and Sandbox show
  only when they hold something), and that file is the reference for each
  slide's actions. The head menu's **Auto-collect on scroll** keeps blocks a
  virtual-scroll feed removes as you pass them, so scrolling accumulates rather
  than replaces.

  **Two routes out, matched to size.** Send hands the capture to `Log-Repo`
  inside a `shortcuts://` URL, capped well under the 14,190 characters known to
  work and saying `Copy only` when it stands down; Copy takes anything. The cap
  is on the delivery, never on the selection.

## What the probe settled (2026-09-05)

- The iOS build **does** fetch a remote `@require` (Userscripts 1.8.6, iOS 18.7),
  which is what makes the stub-and-body split above work at all.
- A `shortcuts://` link **tapped** inside a page reaches the shortcut, so a page
  has a return channel into `shortcuts/log/`. It has to be an anchor the finger
  lands on; assigning `location.href` is a navigation with no user gesture.
- `github.com` never reaches Safari on the phone, since the GitHub app claims
  the address. Test on a `github.io` page.
