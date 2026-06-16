# Headless rendering with CDN libraries in a locked-down sandbox

*A portable recipe. Drop this into any repo whose pages load Tailwind, daisyUI,
Alpine, Phosphor (or similar) from a CDN, when you need to screenshot or test
those pages inside an environment that blocks the CDN.*

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
   file; npm's `package.json` `main`/`module` often points at a CommonJS/ESM
   entry that throws inside a plain `<script>`. For browser-global builds you
   must hardcode the right default file (the `CDN_DEFAULT` table below).
2. **`.min.js` requested but the tarball ships only the unminified file.**
   jsDelivr auto-minifies; npm doesn't. Fall back to the non-`.min` file.

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
function nodeFile(pkg, sub) {
  const dir = path.join(ROOT, 'node_modules', pkg);
  if (sub) return path.join(dir, sub);
  if (CDN_DEFAULT[pkg]) return path.join(dir, CDN_DEFAULT[pkg]);
  try {
    const j = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return path.join(dir, j.browser || j.module || j.main || 'index.js');
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

const [, , htmlArg = 'page.html', outArg = 'out.png'] = process.argv;

const browser = await chromium.launch({
  args: ['--no-sandbox', '--ignore-certificate-errors'], // see "Gotchas"
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

await page.route('**/*', route => {
  const url = new URL(route.request().url());
  let spec = null;
  if (url.host === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/'))
    spec = url.pathname.slice('/npm/'.length);
  else if (url.host === 'unpkg.com')
    spec = url.pathname.slice(1);
  if (spec == null) return route.continue(); // not a CDN lib: fonts, APIs, etc.

  const { pkg, sub } = parseSpec(spec);
  const hit = localBody(nodeFile(pkg, sub));
  if (hit) return route.fulfill(hit);
  console.warn('MISS', url.href, '->', pkg, sub); // unvendored: run `npm i -D` it
  return route.fulfill({ status: 404, body: '' });
});

await page.goto(pathToFileURL(path.resolve(htmlArg)).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: outArg, fullPage: true });
await browser.close();
console.log('wrote', outArg);
```

## Worked example

A self-contained page exercising all four libraries. Save as `page.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2/src/regular/style.css" rel="stylesheet">
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
</head>
<body class="p-10 bg-base-200">
  <div x-data="{ open: false, n: 0 }" class="card bg-base-100 shadow-xl w-96">
    <div class="card-body">
      <h2 class="card-title"><i class="ph ph-rocket-launch"></i> Headless OK</h2>
      <p>Count: <span x-text="n" class="font-mono"></span></p>
      <div class="card-actions">
        <button class="btn btn-primary" @click="n++">
          <i class="ph ph-plus"></i> Increment
        </button>
        <button class="btn btn-ghost" @click="open = !open" x-text="open ? 'Hide' : 'Show'"></button>
      </div>
      <div x-show="open" class="alert alert-success mt-2">Alpine reactivity works.</div>
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

`out.png` shows the daisyUI card, Tailwind layout, and Phosphor glyphs fully
rendered. To prove Alpine ran (not just loaded), drive it before the shot, e.g.
insert `await page.click('text=Increment'); await page.click('text=Show');`
before `page.screenshot`.

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
