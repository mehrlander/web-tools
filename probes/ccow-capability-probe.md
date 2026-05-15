# CCOW Capability Probe

Date: 2026-05-15. Sandbox: Claude Code on the web, cloud_default environment.
Each test run from `/tmp/probe/`; raw logs preserved under `/tmp/probe/*.log`.

## 0. Environment

| Item | Value |
|---|---|
| Kernel | Linux 6.18.5 x86_64 |
| Node | v22.22.2 |
| Python | 3.11.15 |
| Ruby | 3.3.6 |
| Go | go1.24.7 linux/amd64 |
| `http_proxy` / `https_proxy` | not set |
| DNS | nameserver 8.8.8.8 |
| Suggestive env | `CLAUDE_CODE_PROXY_RESOLVES_HOSTS=true`, `CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE=cloud_default` |

No standard proxy env vars are set, yet outbound TLS connections present a cert chain signed by `O=Anthropic, CN=sandbox-egress-production TLS Inspection CA` (confirmed via `openssl s_client` against both allowed and denied hosts). The system CA bundle at `/etc/ssl/certs/ca-certificates.crt` trusts that root, which is why curl/python/node work without complaint. The interception happens transparently — likely via iptables redirect and DNS rewriting, not via HTTP\_PROXY env. Calling this "Limited" is consistent with what I see, but I'm describing observations, not claiming the label.

## A. Reachability matrix

Probes: HEAD via curl, `urllib.request.urlopen` via python, `fetch` via node. Each host hit 3 times. Numbers below are the curl HTTP code (the three tools agreed in every case).

| Host | curl/py/node | Notes |
|---|---|---|
| registry.npmjs.org | 200 | allowed |
| pypi.org | 200 | allowed |
| github.com | 200 | allowed |
| raw.githubusercontent.com | 301→200 | allowed (curl HEAD got 301, follow-throughs work) |
| api.anthropic.com | 405 on `/v1/messages` HEAD | allowed (origin returns 405 for HEAD; that's not a block) |
| storage.googleapis.com | 400 on `/` (proxy passed it through; origin requires bucket) | **allowed** (not on the original "expected denied" mental model) |
| cdn.jsdelivr.net | 403 `host_not_allowed` | denied |
| esm.sh | 403 `host_not_allowed` | denied |
| unpkg.com | 403 `host_not_allowed` | denied |
| cdn.playwright.dev | 403 `host_not_allowed` | denied |
| playwright.azureedge.net | 403 `host_not_allowed` | denied |
| en.wikipedia.org | 403 `host_not_allowed` | denied |
| leg.wa.gov | 403 `host_not_allowed` | denied |
| app.leg.wa.gov | 403 `host_not_allowed` | denied |
| wsdot.wa.gov | 403 `host_not_allowed` | denied |

Denied responses share the signature `HTTP/2 403 + x-deny-reason: host_not_allowed + body "Host not in allowlist"`. No curl-vs-node-vs-python divergence: all three tools used the same proxy and saw the same result.

## B. Package installs

| Manager | Packages | Time | Outcome |
|---|---|---|---|
| npm | jsdom, happy-dom, cheerio, linkedom, parse5 | 7.7 s | OK (versions: jsdom@29.1.1, happy-dom@20.9.0, cheerio@1.2.0, linkedom@0.18.12, parse5@8.0.1) |
| pip | requests, httpx, beautifulsoup4, lxml, parsel, selectolax | 5.0 s | OK |

Registry-backed installs are fast and reliable. No package needed to fetch a non-allowed CDN at install time.

## C. In-process DOM

Fixture: `<h1>`, three `<li class="item">`, and an inline `<script>` that sets `document.body.dataset.loaded = '1'`.

| Engine | `data-loaded` after parse | Item count | CSS query | Inline script ran? |
|---|---|---|---|---|
| happy-dom (via `Window` + `document.write(html)`) | `null` | 3 | works | No (with this construction) |
| jsdom (`new JSDOM(html, {runScripts:'dangerously'})`) | `"1"` | 3 | works | Yes |
| cheerio | `null` | 3 | works | N/A (no JS) |
| linkedom | `null` | 3 | works | N/A (no JS) |

`await import('https://esm.sh/...')` and `await import('https://cdn.jsdelivr.net/.../+esm')` both fail in **both** happy-dom and jsdom runs with `Only URLs with a scheme in: file and data are supported by the default ESM loader`. That's a Node ESM-loader restriction (would block even with no firewall), independent of the host allowlist. To pull an ESM module from a URL you'd need a loader hook or to fetch+`vm.Module` manually. Since the relevant CDNs are also denied at the proxy, this is moot in this environment.

`win.fetch('https://leg.wa.gov')` inside happy-dom: `Cross-Origin Request Blocked` (happy-dom enforces same-origin against the fake `http://localhost/` URL I gave it). `dom.window.fetch` in jsdom: undefined (jsdom doesn't ship a `fetch` on its window by default).

Caveat for happy-dom: I parsed via `doc.write(html)`. Inline scripts may execute when an HTML page is constructed via the higher-level loader API (`Window.fetch` + `Document.open()`/`Document.close()`) or by going through `new Browser().newPage().goto(file://…)`. The result above is specific to the construction path I used. If inline-script execution matters, use jsdom or test the alternative happy-dom path.

## D. Browser binaries

This is where the original assumption ("expected to fail") was wrong.

| Action | Outcome |
|---|---|
| `npx playwright install chromium` | Silent no-op. Pre-installed at `/opt/pw-browsers/chromium-1194` (build 1194, chromium 141). Headless shell, firefox, webkit also listed but the headless-shell binary I saw on disk is `chromium-1194`'s `chrome` only. |
| `npx puppeteer browsers install chrome` | Succeeds: downloads `chrome-linux64.zip` from `https://storage.googleapis.com/chrome-for-testing-public/148.0.7778.167/...` and unpacks to `/root/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome` (276 MB). Download itself reported by puppeteer as 950 ms — fast enough that a proxy-side cache is plausible, but I didn't isolate that. |
| Puppeteer launch + `file:///tmp/probe/fixture.html` | `data_loaded="1"`, `item_count=3`. Inline script runs. |
| Playwright (`playwright@1.55.0`) launch | Fails — client expects build 1187, finds 1194. |
| Playwright pinned to `playwright@1.56.0` launch | `data_loaded="1"`, `item_count=3`. Works. |

So the practical pattern for playwright is: pin to the version whose chromium build matches `/opt/pw-browsers/chromium-*`. For build 1194 that's `playwright@1.56.x`. For puppeteer there's no pin needed — the matching chrome downloads from a host that turns out to be allowed.

TLS behaviour with Chromium: by default Chromium does **not** trust the Anthropic sandbox CA, so even fetching an allowed host (`https://github.com/`) errors `net::ERR_CERT_AUTHORITY_INVALID`. Passing `--ignore-certificate-errors` lets allowed hosts load (github.com → 200). Denied hosts still return the proxy's 403 page even with that flag — the deny is upstream of the TLS handshake from Chrome's perspective.

## E. Local server roundtrip

`python3 -m http.server 8000` serving the fixture; bound to `0.0.0.0:8000` (visible in `/proc/net/tcp`). All three clients reached it cleanly:

| Client | HTTP | Bytes | Time |
|---|---|---|---|
| curl | 200 | 319 | 13 ms |
| python requests | 200 | 319 | 197 ms |
| node fetch | 200 | 319 | 138 ms |

Localhost networking is unrestricted (the proxy doesn't sit in front of loopback).

## F. Static fetch + parse for a denied host

| Path | Outcome |
|---|---|
| `requests.get('https://app.leg.wa.gov/...')` | HTTP 403, 21 bytes, 0.32 s |
| `fetch('https://app.leg.wa.gov/...')` + cheerio/linkedom | HTTP 403, 39 ms (parse never reached) |
| Puppeteer `page.goto(...)` (no flags) | `net::ERR_CERT_AUTHORITY_INVALID` |
| Puppeteer `page.goto(...)` with `--ignore-certificate-errors` | HTTP 403, body `Host not in allowlist` |

The browser path doesn't get around the allowlist — the proxy denies it the same way it denies curl. The CA error from the no-flag Chromium case is a Chrome-trust-store detail, not a separate block.

## Summary

What works: package installs (npm, pip), local file parsing with happy-dom/jsdom/cheerio/linkedom/parse5/bs4/lxml/parsel/selectolax, local TCP servers and loopback HTTP, headless **Chromium** (both via the puppeteer-installed chrome and via the pre-staged `/opt/pw-browsers/chromium-1194` when playwright is pinned to a matching client version), and any TLS request to a host the proxy's allowlist permits (npm, pypi, github, raw.githubusercontent, api.anthropic, storage.googleapis among those tested). System tools (curl/python/node) trust the sandbox MITM CA out of the box.

What's blocked: arbitrary internet hosts not on the allowlist. The denial is enforced by an egress proxy that returns `HTTP 403 + x-deny-reason: host_not_allowed` regardless of client. CDNs that "feel essential" like cdn.jsdelivr.net, esm.sh, unpkg.com, en.wikipedia.org, and the WA gov hosts I tested all hit this. Browser automation doesn't change that — the proxy sits upstream of Chromium.

Surprises:
- `storage.googleapis.com` is allowed, which is what makes `puppeteer browsers install chrome` work despite cdn.playwright.dev being denied. This was opposite to my prior of "all third-party CDNs are blocked."
- Playwright browsers are pre-staged at `/opt/pw-browsers/`, so `playwright install` is unnecessary if the client version matches the staged build.
- The sandbox's egress is a transparent TLS-inspecting proxy, not a CONNECT proxy. Anything that uses Chrome's bundled trust store needs `--ignore-certificate-errors` or an injected CA, even for allowed hosts.

These conclusions cover only what I tested in this session.

## Follow-up tests worth running

1. **What's on the allowlist that I didn't try?** Probe pypi-mirror, cdn.npmjs.com, deb.debian.org, security.ubuntu.com, googleapis.com subdomains, fonts.gstatic.com, sentry.io, huggingface.co, anthropic.com (root vs api.). The list of allowed hosts shapes which workflows are feasible without a proxy escape hatch.

2. **Does NODE_EXTRA_CA_CERTS / a Chromium policy file let me trust the sandbox CA cleanly?** Extract the CA from a live handshake (`openssl s_client -showcerts` against github.com), feed it to Chromium via `--ignore-certificate-errors-spki-list` or a NSS DB and confirm allowed hosts load without `--ignore-certificate-errors`. That would make automated browser flows safer (`--ignore-certificate-errors` also hides real cert mistakes).

3. **Speed of `storage.googleapis.com` — is there a transparent cache?** Re-download a large known-good asset two ways: cold (different object) vs warm (same object after a sleep). If the warm hit is dramatically faster than wire speed, the proxy is caching; if not, the network is just fast. Result tells you whether one-shot CI installs will be reliably quick.
