# Headless rendering with CDN libraries in a locked-down sandbox

*A portable recipe, usable on its own. For when you want to build with a favorite
front-end stack (Tailwind, daisyUI, Alpine, Phosphor, or similar) and screenshot
or test those pages headless, but you're in a sandbox that blocks the libraries'
CDNs: the "my headless browser won't load my libraries" wall. You don't need the
rest of web-tools to use this; it's one of the [portable docs](PORTABLE.md).*

> **Render to see, not just to show.** The point of this setup is a feedback
> loop: render, *look at the image yourself*, and let what you see drive the next
> edit, the way you'd glance at a browser while building. It isn't only a way to
> produce a PNG to hand off. And while iterating, drop the in-progress shots into
> the chat too: seeing the tries (this layout vs. that, before vs. after) is
> especially welcome, not noise.

## The problem in one paragraph

Cloud coding sandboxes (Claude Code on the web and similar) route outbound
traffic through an allowlist proxy. `registry.npmjs.org` and `github.com` are
typically reachable, but the **JS CDNs pages load at runtime are not**:
`cdn.jsdelivr.net`, `unpkg.com`, `esm.sh`, `cdnjs.cloudflare.com` all return a
denial. So a page whose `<head>` pulls Tailwind/daisyUI/Alpine off jsDelivr
**cannot boot as-is** headless: those `<script>`/`<link>` requests fail and you
get an unstyled, inert page. The fix is two moves: **vendor** the libraries, then
**intercept** the page's CDN requests and answer them from the vendored copies.

## Two concepts, kept separate

These are routinely conflated. They are not the same thing, and the distinction
is the whole point.

- **Vendoring** = obtain the *real* library locally instead of from its remote
  home. `npm i -D tailwindcss` drops the genuine library bytes into
  `node_modules`. There is no mock, no fake, no simulated substitute: the
  browser runs the authentic library. That is *why* the resulting screenshot is
  trustworthy. The block is **per-host, not per-package**: jsDelivr and unpkg
  serve the same npm-published files `registry.npmjs.org` does, so anything the
  page loads from a CDN can be fetched from npm instead.

- **Interception** = reroute the page's network requests to the vendored copy.
  The page still says `<script src="https://cdn.jsdelivr.net/...">`. A request
  router catches that blocked request and serves the matching file out of
  `node_modules`. Only the *delivery path* is swapped; the bytes on the wire are
  identical.

> **Vendoring captures the real dependency; interception reroutes the request to
> it. The library is real; only its source is swapped.**

A third concept sometimes rides along but is **out of scope** here: *emulating a
service's behavior* (faking jsDelivr's server-side value-adds, or impersonating a
data API). You only need that if you depend on those behaviors; see "Edge cases"
at the end. The core recipe is just vendor + intercept.

## Step 1 — Vendor

Install, as dev dependencies, every library your pages load off a CDN:

```bash
npm i -D tailwindcss @tailwindcss/browser daisyui alpinejs \
         @alpinejs/collapse @alpinejs/sort @phosphor-icons/web
```

That is sufficient. The files now exist under `node_modules/<pkg>/...`; the only
remaining question is *which* file inside each package the CDN URL maps to, which
the interceptor handles next.

## Step 2 — Intercept

Playwright's `page.route()` lets you answer matched requests yourself. The
mapping from a CDN URL to a local file is mechanical:

- jsDelivr serves npm packages at `cdn.jsdelivr.net/npm/<pkg>@<ver>/<subpath>`.
- unpkg serves them at `unpkg.com/<pkg>@<ver>/<subpath>`.
- Strip the host and version, and `<pkg>/<subpath>` is the path under
  `node_modules`.

Two wrinkles that bite, both handled below:

1. **No subpath in the URL** (e.g. `.../npm/alpinejs@3`). The CDN picks a default
   file, and the two CDNs pick it from *different* `package.json` fields: unpkg
   reads `unpkg`, jsDelivr reads `jsdelivr`. They can disagree (Alpine ships
   `"unpkg": "dist/cdn.min.js"` but no `jsdelivr` field, so bare
   `unpkg.com/alpinejs` works while bare `cdn.jsdelivr.net/npm/alpinejs` falls
   back to its CJS `main` and throws in a `<script>`). The resolver below reads
   the field matching the host; for the handful of browser-global builds it also
   keeps a `CDN_DEFAULT` table that pins the right file outright. With an explicit
   subpath, both CDNs map to the same file and the field doesn't matter.
2. **`.min.js` requested but the tarball ships only the unminified file.**
   jsDelivr auto-minifies; npm doesn't. Fall back to the non-`.min` file.

**Prefer one tag per library; avoid `/combine/`.** jsDelivr can bundle several
packages into one `cdn.jsdelivr.net/combine/a,b,c` request. Don't author pages
that way. Separate `<script>`/`<link>` tags are more transparent (you see and can
vendor each library independently) and they map one-to-one under *any*
interception strategy, including text/DOM-rewrite harnesses (e.g. jsdom) where a
single URL standing for many packages is awkward. Combine only saves request
*count* in production, which is moot when every request is served locally.

The interceptor below still handles `/combine/` so a page you didn't write
renders without changes. Note *how*: the package list lives in the URL path
(`/combine/a,b,c`), and the interceptor never reaches jsDelivr (it's blocked), so
it splits *that URL* on commas, reads each package from `node_modules`, and
concatenates them to reproduce the bundle jsDelivr would have returned. It parses
a structured URL, not a downloaded response body. Still, new pages should use
plain tags. (Alpine is always its own deferred tag regardless, since it must init
after the DOM; loading it from unpkg is a fine convention.)

A complete, dependency-free interceptor:

```js
// render.mjs — screenshot a local HTML file, serving CDN libs from node_modules.
// Usage: node render.mjs page.html out.png
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

// Packages whose CDN default file differs from npm's package.json main/module.
// jsDelivr/unpkg serve the browser-global build; npm main is a module entry
// that won't run from a classic <script>. Add to this as you hit new libs.
const CDN_DEFAULT = {
  'alpinejs': 'dist/cdn.min.js',
  '@alpinejs/collapse': 'dist/cdn.min.js',
  '@alpinejs/sort': 'dist/cdn.min.js',
  '@tailwindcss/browser': 'dist/index.global.js',
  'daisyui': 'daisyui.css',
  'tabulator-tables': 'dist/js/tabulator.min.js',
};

const TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};
const typeFor = p => TYPES[path.extname(p)] || 'application/octet-stream';

// Parse a jsDelivr `npm/<spec>` or unpkg `<spec>` path into { pkg, sub }.
// Handles @scoped packages and the trailing version.
function parseSpec(spec) {
  spec = spec.replace(/^\/?(npm\/)?/, '').replace(/\/$/, '');
  let scope = '', rest = spec;
  if (spec.startsWith('@')) {
    const i = spec.indexOf('/');
    scope = spec.slice(0, i) + '/';
    rest = spec.slice(i + 1);
  }
  const slash = rest.indexOf('/');
  const nameVer = slash < 0 ? rest : rest.slice(0, slash);
  const sub = slash < 0 ? '' : rest.slice(slash + 1);
  const pkg = scope + nameVer.replace(/@.*/, '');
  return { pkg, sub };
}

// Resolve a package + optional subpath to a real file under node_modules.
// `field` is the package.json key the requesting CDN uses to pick a default
// file when the URL has no subpath: unpkg reads "unpkg", jsDelivr reads
// "jsdelivr". They can differ (e.g. alpine ships `unpkg` but no `jsdelivr`,
// which is why bare `unpkg.com/alpinejs` works but bare jsDelivr doesn't).
function nodeFile(pkg, sub, field) {
  const dir = path.join(ROOT, 'node_modules', pkg);
  if (sub) return path.join(dir, sub);                       // explicit subpath: same file on either CDN
  if (CDN_DEFAULT[pkg]) return path.join(dir, CDN_DEFAULT[pkg]); // pinned browser-global build
  try {
    const j = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return path.join(dir, j[field] || j.browser || j.module || j.main || 'index.js');
  } catch { return path.join(dir, 'index.js'); }
}

function localBody(fp) {
  // jsDelivr auto-minifies: a `.min.js`/`.min.css` URL works even when the npm
  // tarball ships only the unminified file. Fall back to it.
  if (!existsSync(fp) && /\.min\.(js|css)$/.test(fp)) {
    const plain = fp.replace(/\.min\.(js|css)$/, '.$1');
    if (existsSync(plain)) fp = plain;
  }
  return existsSync(fp) ? { body: readFileSync(fp), contentType: typeFor(fp) } : null;
}

// One CDN spec ("npm/pkg@ver/sub") -> local bytes, or null if not vendored.
const readLocal = (spec, field) => { const { pkg, sub } = parseSpec(spec); return localBody(nodeFile(pkg, sub, field)); };

const [, , htmlArg = 'page.html', outArg = 'out.png'] = process.argv;

const browser = await chromium.launch({
  args: ['--no-sandbox', '--ignore-certificate-errors'], // see "Gotchas"
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

await page.route('**/*', route => {
  const url = new URL(route.request().url());

  // jsDelivr /combine/<spec>,<spec>,... bundles several packages in one request.
  // Prefer plain tags in pages you author (see above); this branch is only so a
  // page that already uses combine renders unchanged. The package list is in the
  // URL path (we never fetch jsDelivr): split it on commas and concatenate the
  // local files (all share a type: JS or CSS).
  if (url.host === 'cdn.jsdelivr.net' && url.pathname.startsWith('/combine/')) {
    const specs = decodeURIComponent(url.pathname.slice('/combine/'.length)).split(',');
    const parts = [];
    let contentType;
    for (const s of specs) {
      const hit = readLocal(s, 'jsdelivr');
      if (!hit) { console.warn('MISS combine', s); continue; }
      parts.push(hit.body);
      contentType = hit.contentType;
    }
    if (!parts.length) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ body: Buffer.concat(parts.map(Buffer.from)), contentType });
  }

  let spec = null, field = 'jsdelivr';
  if (url.host === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/'))
    spec = url.pathname.slice('/npm/'.length);
  else if (url.host === 'unpkg.com')
    { spec = url.pathname.slice(1); field = 'unpkg'; }
  if (spec == null) return route.continue(); // not a CDN lib: fonts, APIs, etc.

  const hit = readLocal(spec, field);
  if (hit) return route.fulfill(hit);
  console.warn('MISS', url.href); // unvendored: run `npm i -D` it
  return route.fulfill({ status: 404, body: '' });
});

await page.goto(pathToFileURL(path.resolve(htmlArg)).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: outArg, fullPage: true });
await browser.close();
console.log('wrote', outArg);
```

## Worked example

A self-contained page exercising all four libraries. Note each library is its
own tag (no `/combine/`, see below) and Alpine loads from unpkg. Save as
`page.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2/src/bold/style.css" rel="stylesheet">
  <script defer src="https://unpkg.com/alpinejs@3"></script>
</head>
<body class="min-h-screen grid place-items-center p-6"
      style="background-color:#f4f6fb;background-image:radial-gradient(900px 520px at 50% -12%, oklch(0.86 0.07 270 / .7), transparent 60%)">
  <div x-data="{ n: 3 }"
       class="card w-80 bg-base-100 border border-base-300 shadow-xl">
    <div class="card-body items-center text-center gap-3">
      <i class="ph-bold ph-check-circle text-5xl text-success"></i>
      <h2 class="card-title">Headless OK</h2>
      <p class="text-sm text-base-content/60">
        Tailwind, daisyUI, Phosphor and Alpine, all served from
        <code class="text-base-content/80">node_modules</code>.
      </p>
      <div class="text-5xl font-bold tabular-nums my-1" x-text="n"></div>
      <button class="btn btn-primary w-full gap-2" @click="n++">
        <i class="ph-bold ph-plus"></i> Count up
      </button>
    </div>
  </div>
</body>
</html>
```

Then:

```bash
npm i -D playwright @tailwindcss/browser daisyui alpinejs @phosphor-icons/web
node render.mjs page.html out.png
```

`out.png` is a card centered on a soft light gradient, filling the frame: a
daisyUI card and button, the Phosphor check + plus glyphs, and Alpine's count.
The page is `min-h-screen` so `fullPage` equals the viewport and the composition
fills the image (see "Designing for the frame"). To prove Alpine ran (not just
loaded), drive it before the shot, e.g. insert
`await page.click('text=Count up')` before `page.screenshot`.

## Showing the result in chat

A web coding session surfaces an image to the user through a **dedicated
file-send mechanism**, not markdown. In Claude Code on the web that's the
`SendUserFile` tool; the screenshot script just writes a `.png` to disk and you
hand that path to the tool. A markdown image link to a local path
(`![x](/tmp/out.png)`) does **not** render in the chat UI: it shows as inert
text or a broken thumbnail. So: write the PNG, then send the file. Don't embed it
with markdown.

## Designing for the frame

A screenshot looks like a finished product or looks broken depending entirely on
whether the page fills the frame. Three habits make it the former:

- **Render at the viewport, not `fullPage`, for a "hero" shot.** `fullPage: true`
  captures the whole scroll height; a small widget then floats in a sea of white.
  Design the page `min-h-screen` and screenshot the viewport so the composition
  fills the image edge to edge. (`fullPage` is right when you genuinely want the
  whole long document.)
- **`deviceScaleFactor: 2`** renders at 2x for crisp text and icons; worth it for
  anything you'll show someone.
- **Anchor the page background explicitly.** A standalone `daisyui.css` doesn't
  always wire `data-theme` through to every `bg-base-*` utility (`bg-base-300` in
  particular can generate no rule), so a page background built only from those can
  fall back to transparent (white). Set an explicit background color on `<body>`
  (`style="background-color:#f4f6fb"` for light, `#0a0e1a` for dark) under any
  decorative gradient. daisyUI *components* (cards, buttons, tabs, progress) theme
  correctly; it's the raw page-level `base-*` background that's the soft spot.
- **Avoid `bg-clip-text` gradient text** in this setup; it often paints
  transparent (invisible). A solid accent color is reliable.

[`docs/examples/theme-explorer.html`](examples/theme-explorer.html), described
next, is a full-bleed example built this way: render it with the `render.mjs`
above (viewport `1280x832`, `deviceScaleFactor: 2`).

## A richer example: theme switching + tokens from source

[`docs/examples/theme-explorer.html`](examples/theme-explorer.html) is a second
example that stresses more of the harness. It's a daisyUI **theme picker**:
clicking a theme (or a row of the matrix) sets `data-theme` on `<html>` to
recolor the whole page live, and each option in the dropdown previews in its own
theme's colors (each list item carries its own `data-theme`). The body is a
Tabulator grid of every built-in theme against its design tokens, parsed at
runtime out of daisyUI's own `themes.css`, nothing hardcoded: each cell is a pill
in its fill color with "Aa" in its content color (so the swatch previews the
contrast it exists to provide), under grouped Surfaces / Brand / Status /
Geometry headers, with little shape previews for the radius and border tokens. It
demonstrates three things the minimal example doesn't:

- **A runtime `fetch` of a vendored file.** The page `fetch`es
  `daisyui@5/themes.css` and parses it. `page.route` intercepts `fetch` the same
  as a tag, so it's served from `node_modules` and the table is the library's
  real source.
- **Phosphor as one script tag.** `npm/@phosphor-icons/web`'s package `main` is a
  tiny loader that injects a `<link>` per icon weight; the interceptor then serves
  each weight's CSS and its font files. Loading the one package is enough, no
  separate icon-CSS links needed.
- **Tabulator**, another vendored UMD global, mounting and rendering. The grid is
  styled to follow the active theme via `var(--color-base-*)`, so recoloring the
  page recolors the table too.

It's a full-screen layout (`h-screen`, the grid fills the remaining flex slot),
so screenshot the viewport, not `fullPage`. Each library is a separate tag (no
`/combine/`), the recommended style.

## Gotchas

- **Chromium and the TLS proxy.** A sandbox that inspects TLS presents a custom
  CA that Chromium's bundled trust store rejects, so any `https://` request fails
  with `net::ERR_CERT_AUTHORITY_INVALID`. Launch with
  `--ignore-certificate-errors`. (curl/Node/Python use the system bundle and
  don't need it.) The flag does **not** bypass the allowlist; denied hosts still
  fail, which is fine here since the interceptor answers them before they leave.
- **Alpine import style.** When loading Alpine as an ES module (jsdom/unit tests
  rather than a `<script>`), import `alpinejs/dist/module.esm.js`, never bare
  `alpinejs`: the package has no `exports` map, CJS interop double-wraps the
  default export, and the symptom is `Alpine.start is not a function`. For a
  classic `<script>` (as above) use `dist/cdn.min.js` — that's what `CDN_DEFAULT`
  encodes.
- **The browser binary may be pre-installed.** Many sandboxes bake Chromium in
  and set `PLAYWRIGHT_BROWSERS_PATH`, so `chromium.launch()` finds it with no
  download. `npx playwright install` may be blocked (its CDN is denied) yet
  unnecessary. Check the env var and `ls` the path before concluding it's
  missing; pin your `playwright` client to the baked build's version.
- **A `MISS` log means "not vendored yet,"** not a resolver bug: `npm i -D` that
  package and re-run. Extend `CDN_DEFAULT` only when a *subpath-less* URL maps to
  the wrong default file.

## Edge cases (the parts this recipe deliberately omits)

- **`esm.sh` / `cdnjs` modules** aren't plain npm files; `esm.sh` does
  server-side CJS→ESM bundling that a raw tarball doesn't reproduce. Libraries
  loaded that way (e.g. CodeMirror 6 via `esm.sh`) won't resolve from
  `node_modules` alone. They usually load lazily, so the page still boots and
  screenshots; the component just won't mount until used.
- **`/+esm` imports.** A jsDelivr `...@x/+esm` URL wants the package's ESM entry,
  not the browser-global default. If your pages use these, resolve such specs to
  `package.json` `exports["."].import` (or `module`). CJS-only packages still
  miss, since the server-side ESM bundling can't be reproduced locally.
- **Impersonating a data API.** If a page fetches its *own* data from an API
  (e.g. the GitHub contents API for the same repo), you can answer those requests
  from the working tree in the same `page.route` handler. That's app-specific and
  beyond this generic recipe.

## jsdom variant (logic, no pixels)

For "did the components mount and is the state right" without rendering pixels,
load the page under jsdom with the real Alpine runtime and rewrite its CDN
`import()`s to the vendored copies (same node-file resolution as above). It's
faster than a browser and good for unit tests, but it runs no module `<script>`
and no dynamic `import()` unmodified, so the boot block needs rewriting to a
classic IIFE. Reach for the browser path above when you need real layout or
gestures; reach for jsdom when you only need state.
