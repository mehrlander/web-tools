# Building and Testing HTML in Claude Code on the Web — A Practical Guide

This is a working guide for what you can actually do inside this sandbox,
written after probing it directly on 2026-05-15. Where it matters I've
flagged what's confirmed vs. assumed. If something here surprises you,
re-probe — the network policy can change.

## The 30-second version

You have a Linux VM with Node 22, Python 3.11, Ruby 3.3, Go 1.24, npm, pip,
git, a real Chromium pre-installed, and unrestricted localhost networking.
You **can**:

- install any package from npm or pypi,
- write HTML/JS/CSS files and serve them locally,
- load those pages in a real headless Chromium (puppeteer or playwright),
- parse HTML in-process with jsdom, happy-dom, cheerio, or linkedom,
- pull files from GitHub, GitHub raw, GitHub release assets, S3, and Google Cloud Storage.

You **cannot** reach most of the open internet. The sandbox runs every
outbound TLS connection through a proxy that allows a curated list of hosts
(registries, GitHub, a few clouds) and returns `HTTP 403 "Host not in allowlist"`
for everything else — including the big browser CDNs (jsdelivr, esm.sh,
unpkg, cdnjs, skypack), Wikipedia, MDN, Stack Overflow, Google search,
example.com, httpbin, and effectively any random website you'd want to scrape.

Practical implication: **bundle your dependencies into your project; do not
reach for `<script src="https://cdn...">`.**

## The allowlist, as observed

I probed each of these directly. "Allowed" means the proxy let the request
through to the real origin (the origin then returned whatever it returned).
"Denied" means the proxy returned `403 x-deny-reason: host_not_allowed`.
This list is not exhaustive — it's what I tested. Anything I didn't try is
unknown.

**Allowed — package and code registries:**
`registry.npmjs.org`, `registry.yarnpkg.com`, `pypi.org`,
`files.pythonhosted.org`, `rubygems.org`, `index.crates.io`,
`static.crates.io`, `proxy.golang.org`, `sum.golang.org`, `nodejs.org`,
`archive.ubuntu.com`, `security.ubuntu.com`.

**Allowed — GitHub ecosystem (full):**
`github.com`, `api.github.com`, `raw.githubusercontent.com`,
`codeload.github.com`, `objects.githubusercontent.com`,
`release-assets.githubusercontent.com`.

**Allowed — container registries:**
`ghcr.io`, `registry-1.docker.io`, `auth.docker.io`.

**Allowed — cloud object storage and Google infra:**
`s3.amazonaws.com`, `storage.googleapis.com`, `fonts.googleapis.com`,
`fonts.gstatic.com`, `ajax.googleapis.com`, `www.googleapis.com`,
`cloud.google.com`.

**Allowed — Anthropic:**
`api.anthropic.com`, `claude.ai`. (Notably `docs.anthropic.com` and
`console.anthropic.com` are **not** allowed.)

**Denied — everything else I tried**, including: `cdn.jsdelivr.net`,
`esm.sh`, `unpkg.com`, `cdnjs.cloudflare.com`, `skypack.dev`, `jspm.dev`,
`cdn.playwright.dev`, `playwright.azureedge.net`, `huggingface.co`,
`go.dev`, `deb.debian.org`, `docs.anthropic.com`, `developer.mozilla.org`,
`en.wikipedia.org`, `stackoverflow.com`, `google.com`, `youtube.com`,
`example.com`, `httpbin.org`, `jsonplaceholder.typicode.com`,
`leg.wa.gov`, `wsdot.wa.gov`.

A few useful shortcuts that follow from this:

- **Need a JS library in a page?** `npm install` it and reference the file
  from `node_modules/`. The CDN URLs you'd normally copy off of jsdelivr
  won't load.
- **Need Google Fonts?** Works. `fonts.googleapis.com` and
  `fonts.gstatic.com` are both allowed.
- **Need a file from a project on GitHub?** `raw.githubusercontent.com`
  works for source files and `release-assets.githubusercontent.com` works
  for binaries attached to releases.
- **Need a sample REST API for testing?** `httpbin.org` and
  `jsonplaceholder.typicode.com` are blocked. Spin up your own:
  `python3 -m http.server`, a tiny `express` app, or the snippet at the
  bottom of this doc.

## Building HTML pages

Write files anywhere in the repo or under `/tmp`. To preview, serve them
locally — there's no built-in HTTP preview, but loopback works fine.

```bash
cd /path/to/your/static/files
python3 -m http.server 8000     # or: npx serve -p 8000
```

Confirmed working: curl, `requests.get`, `fetch(...)` from Node, and Chromium
(via puppeteer/playwright) can all hit `http://localhost:8000/...` with no
restrictions.

If you want the result visible to the user **outside** the sandbox, commit
the file and link to its GitHub blob URL (`https://github.com/<owner>/<repo>/blob/<branch>/<path>`).
That's the canonical "show the user a file" path for this environment.

## Testing pages in a real browser

A real Chromium is pre-installed at `/opt/pw-browsers/chromium-1194/`. You
have two ways to drive it:

### Puppeteer (simplest)

```bash
npm install puppeteer
# First run downloads chrome (~280 MB) from storage.googleapis.com.
# It's allowed and takes seconds.
```

```js
// test.mjs
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:8000/my-page.html');
const title = await page.title();
const items = await page.$$eval('li.item', els => els.map(e => e.textContent));
console.log({ title, items });
await browser.close();
```

This is the path of least friction. Works out of the box for any `file://`
or `http://localhost:.../` URL. JavaScript runs, the DOM is real.

### Playwright (use only if you specifically need it)

Playwright clients are version-pinned to a specific Chromium build. The
pre-installed browser is build **1194**, which matches **`playwright@1.56.x`**.
Any other client version will fail with "executable doesn't exist". `npx
playwright install chromium` does nothing useful here — its download CDN is
blocked, and you don't need it anyway.

```bash
npm install playwright@1.56.0
```

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8000/my-page.html');
// ...
```

### When the browser tries to hit an external URL

Two things to know:

1. **Chromium doesn't trust the sandbox's TLS proxy by default.** Any
   `https://` URL — even to an allowed host like `github.com` — will fail
   with `net::ERR_CERT_AUTHORITY_INVALID` unless you launch with
   `args: ['--no-sandbox', '--ignore-certificate-errors']`. System tools
   (`curl`, Python `requests`, Node `fetch`) don't have this problem; they
   use the system CA bundle, which already trusts the proxy.
2. **`--ignore-certificate-errors` doesn't bypass the host allowlist.**
   Denied hosts still return the proxy's 403 page; you just see it as the
   page content instead of as a TLS error.

So: for pages that load assets from your own server or from allowed hosts,
add the flag and you're done. For pages that *need* an off-allowlist asset,
you'll need to vendor that asset into your project first.

## Parsing HTML without a browser

If you don't need to *run* the JS — you just want to look at the structure
of an HTML page — you have lighter options. From fastest/simplest to
heaviest:

| Tool | Lang | Runs `<script>`? | Use when |
|---|---|---|---|
| **cheerio** | Node | No | jQuery-style traversal of static markup |
| **linkedom** | Node | No | DOM API on static markup |
| **happy-dom** | Node | Sometimes (construction-dependent) | Lighter DOM with partial JS support |
| **jsdom** | Node | Yes (with `runScripts: 'dangerously'`) | You need inline scripts to execute |
| **BeautifulSoup + lxml** | Python | No | Python-side HTML traversal |
| **selectolax / parsel** | Python | No | Faster Python HTML parsing |

In my probe, jsdom executed an inline `<script>` and set `document.body.dataset.loaded = '1'`. happy-dom did not (with the construction I used — `doc.write(html)`). cheerio and linkedom never claim to run JS; they just parse markup. If you have any doubt about whether script execution happened, use puppeteer instead — it's a real browser.

All six tools above are confirmed installable via npm/pip in this sandbox.

## Common gotchas

- **`<script src="https://cdn.jsdelivr.net/...">` will not load.** Vendor
  the script: `npm install lodash-es`, then reference
  `./node_modules/lodash-es/lodash.js` from your page (or bundle).
- **Dynamic `await import('https://...')` in Node fails** even for allowed
  hosts. That's a Node restriction (`Only URLs with a scheme in: file and
  data are supported`), not a network one. If you need to load an ESM
  module from a URL in Node, use `fetch` + `vm.Module`, or install the
  package and `import` it locally.
- **The sandbox is ephemeral.** When the session ends, everything outside
  the git repo is gone — including `/tmp/probe`, downloaded browsers (in
  `~/.cache/puppeteer/`), and any uncommitted files. Commit anything you
  want to keep before the session times out.
- **Localhost doesn't reach the user's browser.** `http://localhost:8000`
  works inside the sandbox; the user can't see it. To show a rendered page
  to the user, either take a screenshot with puppeteer (`page.screenshot()`)
  and surface the PNG, or commit the static files and link to the GitHub
  blob view.
- **`api.anthropic.com` is allowed**, but the keys/auth context for the
  agent are session-bound — don't assume you can call the API from arbitrary
  scripts without setting up auth.
- **The Chromium binary is 276 MB.** First puppeteer install adds a few
  seconds. After that it's cached for the session.

## Quick recipes

**Serve a local site and screenshot it:**

```bash
cd /tmp/site && python3 -m http.server 8000 &
node -e "
  import('puppeteer').then(async ({default: p}) => {
    const b = await p.launch({args:['--no-sandbox']});
    const pg = await b.newPage();
    await pg.setViewport({width: 1280, height: 800});
    await pg.goto('http://localhost:8000/index.html');
    await pg.screenshot({path: '/tmp/site/preview.png', fullPage: true});
    await b.close();
  })
"
```

Then commit `preview.png` and surface it to the user via its GitHub blob URL.

**Tiny mock JSON API (since httpbin/jsonplaceholder are blocked):**

```bash
cat > /tmp/mock.py <<'EOF'
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('content-type','application/json'); self.end_headers()
        self.wfile.write(json.dumps({"path": self.path, "ok": True}).encode())
HTTPServer(('127.0.0.1', 9000), H).serve_forever()
EOF
python3 /tmp/mock.py &
```

**Fetch a file from a public GitHub repo (works):**

```bash
curl -O https://raw.githubusercontent.com/torvalds/linux/master/README
```

**Install a JS library for use in a page without a CDN:**

```bash
npm install d3
# then in your HTML, reference ./node_modules/d3/dist/d3.min.js
```

---

## Appendix: what the sandbox actually is, briefly

There's a transparent TLS-inspecting proxy on the egress path. It enforces
a host allowlist and presents a CA chain signed by `Anthropic /
sandbox-egress-production TLS Inspection CA`. The system CA bundle trusts
that root, so curl/python/node treat the proxy invisibly. Chromium ships
its own trust store and doesn't, hence the `--ignore-certificate-errors`
flag for browser fetches.

Local networking (loopback, `127.0.0.1`) is not policed at all.

## Appendix: raw probe data

Logs and test scripts from the sweep that produced this guide live in
`/tmp/probe/` during the active session: `00-environment.log`,
`A-reach.log`, `A-expanded.log`, `A-headers.log`, `A-routing.log`,
`A-tls.log`, `B-install.log`, `B-pip.log`, `C-dom.log`, `D-browsers.log`,
`E-local.log`, `F-static.log`. They vanish when the sandbox is reclaimed;
re-run the probes to refresh.

## Things worth double-checking later

- **Map more of the allowlist.** I didn't try AWS S3 subdomains
  (`<bucket>.s3.amazonaws.com`), Cloudflare R2, `ghcr.io` blob storage,
  or specific GCS buckets. If you depend on one, probe it before relying
  on it: `curl -sS -o /dev/null -w "%{http_code}\n" -I https://HOST/`.
  A response without `x-deny-reason` means allowed.
- **Trust the sandbox CA in Chromium properly.** It's possible to extract
  `Anthropic / sandbox-egress-production TLS Inspection CA` from a live
  handshake and feed it to Chromium via an NSS DB or policy file, which
  would remove the need for `--ignore-certificate-errors`. Worth doing
  only if you find yourself debugging real cert problems that the flag
  is hiding.
