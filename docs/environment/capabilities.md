# Capabilities: what the box can run and reach

What the Claude Code web sandbox can *do* — its toolchain, what hosts it can
reach, and the browser it ships with. For what the box *is* and what persists,
see [container.md](container.md); for how to use these to test HTML/JS, see
[testing.md](testing.md).

> **Probing discipline (read first).** Most of the errors this doc has carried
> came from one habit: letting a *status code* or a *failed command* stand in for
> a fact you can observe directly. Three rules that would have caught every past
> mistake:
> 1. **Allowed vs. denied is told by a header, not a status.** A real proxy
>    denial carries `x-deny-reason: host_not_allowed`. A bare 400/403/404 with no
>    such header means the origin was *reached* and answered: the host is allowed.
>    Always probe with `curl -D -` and look at the header, not just `%{http_code}`.
> 2. **A failed download does not mean a thing is absent.** `npx playwright
>    install` failing (its CDN is blocked) says nothing about whether the binary
>    is already on disk. `ls` the path and read the env before concluding absence.
> 3. **One path's refusal is not the whole host's.** A 403 on a specific bucket
>    path (e.g. a GCS listing) is the origin's, not the proxy's. Don't table the
>    host as blocked from a single path.

## Runtime basics

*(verified 2026-05-30)*

- `node` **v22.22.2**.
- `git` works; GitHub actions go through the GitHub MCP tools, not `gh`.
- A real **Chromium is pre-installed** (see Browsers below). Headless rendering
  and screenshots *are* available in-sandbox.

## Toolchain: `check-tools`, and what it omits

*(verified 2026-05-30)*

`check-tools` (a cloud-only command) prints a dated version table for the
language/build toolchain: the fastest way to read versions. But it's a **version
probe, not a capability manifest**, and its checklist is incomplete. It silently
omits things that *are* installed. Verified present though unlisted: **Ruby
3.3.6**, **PHP 8.4.19** + Composer, **PostgreSQL 16.13** and **Redis 7.0.15**
(installed, not running; start with `service postgresql start` /
`service redis-server start`), and **bun** (`~/.bun/bin/bun`, but it has known
proxy issues fetching packages; use npm/pip to install). Absent: `mongod`,
`deno`, `bundler`. Treat a `check-tools` omission as "unchecked," not "absent."
Confirm with `command -v`.

```bash
for t in ruby php composer psql redis-server bun; do command -v "$t" || echo "missing: $t"; done
```

## Network access: a curated allowlist, not open egress

*(verified 2026-05-30)*

Outbound traffic goes through a TLS-inspecting proxy that enforces a host
allowlist. **The tell for a true denial is the `x-deny-reason: host_not_allowed`
response header, not the HTTP status.** A blocked host returns that header (with a
403); an *allowed* host returns whatever the origin says (200, 301, 400, 404, even
a 403 of the origin's own) and carries **no** deny header. Probe with `curl -D -`
so you see it.

**Two gates, not one.** The allowlist above is the *general* proxy. GitHub git
traffic goes through a **separate** GitHub proxy that scopes operations to the one
authorized repo. (Push is *not* limited to the session branch: a normal commit
push to any existing branch in the repo works, e.g. `git push origin
local:other-branch`, verified 2026-06-15. What it refuses is ref *deletion*, see
below.) So a sibling repo like
`<repo>.wiki.git` returns `Proxy error: repository not authorized` (502) even
though `github.com` itself is allowed: a different failure mode than
`x-deny-reason: host_not_allowed`.

**Branches cannot be deleted from in-session** *(verified 2026-06-14)*. A branch
is a *ref*: a single named pointer to one commit, not a sequence of commits. So
deleting one is **not** a commit (there is no "commit that deletes a branch");
it is a ref-update push that sets the pointer to nothing (`git push origin
--delete X`). That push is what is refused here, on two paths: the git proxy
returns a 403 on `git push --delete`, and the GitHub MCP toolset has
`create_branch` but no delete verb. The branch you currently have checked out is
irrelevant: deleting some *other* branch never touches it, so switching branches
is not a workaround. (PRs *can* be closed, via `update_pull_request`; and the
user can always delete a branch from the GitHub UI or their own machine's CLI,
which do not pass through this proxy.) Asymmetric consequence: a session can
create a remote branch it then has no way to remove, so stray branches need
cleanup outside the session.

**Capture before you delete, and mind the order.** Because we cannot delete a
branch (let alone undo a deletion), and a branch's commits are
garbage-collected once no ref reaches them, deletion is effectively
irreversible. When a branch is headed for the bin, first salvage anything worth
keeping (copy the file, link the blob, confirm it landed elsewhere); only then
ask the user to delete. Never do it out of order.

**Mark a stray branch instead.** Since you can push commits to any existing
branch (just not delete one), the way to flag a branch you can't remove is to
*push a marker commit onto it*: rewrite its `BRANCH-GUIDE.md` with a
"SUPERSEDED, safe to delete" banner and a one-line commit message saying the
same. The commit message then shows as the branch's tip in the GitHub branches
list, so the intent is legible at a glance when the user comes back to delete
it. (Done this way for `claude/busy-carson-x1mufj` on 2026-06-15.)

| Host | Reachable? | Notes |
|---|---|---|
| `registry.npmjs.org`, `registry.yarnpkg.com` | ✅ | `npm install` works |
| `pypi.org`, `files.pythonhosted.org` | ✅ | pip works |
| `rubygems.org`, `proxy.golang.org` | ✅ | gem / go module fetches |
| `github.com`, `api.github.com`, `codeload.github.com` | ✅ | `api.github.com` 403s without auth/UA, but no deny header → reachable |
| `raw.githubusercontent.com` | ✅ | raw source files: the reliable fetch path |
| `objects.githubusercontent.com`, `release-assets.githubusercontent.com` | ✅ | release-asset binaries |
| `storage.googleapis.com`, `s3.amazonaws.com` | ✅ | object storage. 400 at root = reached; a 403 on a *bucket path* is GCS's own, not a denial |
| `fonts.googleapis.com`, `fonts.gstatic.com` | ✅ | Google Fonts load |
| `api.anthropic.com` | ✅ | but auth is session-bound; don't assume arbitrary scripts can call it |
| `cdn.jsdelivr.net`, `unpkg.com`, `esm.sh`, `cdnjs.cloudflare.com` | ❌ | `x-deny-reason: host_not_allowed`. The JS CDNs our pages use at runtime |
| `cdn.playwright.dev`, chrome-for-testing download CDNs | ❌ | browser-binary download hosts (moot: binary is pre-installed) |
| `docs.anthropic.com`, `console.anthropic.com` | ❌ | denied (the API host is allowed; the docs host isn't) |
| `developer.mozilla.org`, `en.wikipedia.org`, `stackoverflow.com`, `example.com` | ❌ | the open web is not reachable |

**Implication that bites:** our pages load Alpine / Tailwind / daisyUI / Phosphor
from **jsDelivr + unpkg at runtime**, both denied. So a repo page **cannot be
booted as-is**, but it *can* be rendered if you vendor those deps first (see
[Rendering a repo page](testing.md)). npm and GitHub-raw are the reliable fetch
paths. *(2026-06-11)* Note the block is **per-host, not per-package**: those CDNs
serve the same npm-published files that `registry.npmjs.org` does, so any page
dep can be vendored with `npm i -D` and served to the browser by the render
harness's interceptor (`tools/render/cdn.mjs`). What the raw tarball *doesn't*
include are jsDelivr's value-adds — default-entry selection, auto-generated
`.min.*` files, server-side CJS→ESM bundling — which `cdn.mjs` emulates (its
remaining gaps are catalogued in [testing.md](testing.md)).

Re-check (note the `-D -` and the deny-header grep, that's the whole point):

```bash
probe () { echo "== $1 =="; curl -sS -o /dev/null -D - --max-time 12 "$1" \
  | grep -iE '^HTTP/|x-deny-reason' | tr -d '\r'; }
for h in https://registry.npmjs.org/alpinejs \
  https://raw.githubusercontent.com/mehrlander/web-tools/main/lib/gh-api.js \
  https://storage.googleapis.com/ https://cdn.jsdelivr.net/ https://esm.sh/ ; do
  probe "$h"; done
```

## Browsers / headless rendering: available

*(verified 2026-05-30)*

A real Chromium is **pre-installed and works**, no download needed, despite the
download CDNs being blocked. The image bakes the binary in precisely so the
blocked download doesn't matter.

- Binary: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. **Chromium
  141.0.7390.37**, build **1194**.
- **`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is set in the env.** This is the
  canonical pointer: Playwright auto-discovers the binary through it, so a plain
  `chromium.launch()` finds it with no `executablePath` and no download.
- Playwright clients are version-pinned to a Chromium build. Build 1194 matches
  **`playwright@1.56.x`**; other client versions error with "executable doesn't
  exist". `npx playwright install chromium` is unnecessary here (and its CDN is
  blocked anyway).
- No `PUPPETEER_*` var is set, so puppeteer needs `PUPPETEER_EXECUTABLE_PATH`
  (or an explicit `executablePath`) pointed at the binary above. Playwright is
  the frictionless driver.

Smoke-test the binary directly (no npm needed):

```bash
B="$PLAYWRIGHT_BROWSERS_PATH/chromium-1194/chrome-linux/chrome"
"$B" --version
"$B" --headless --no-sandbox --disable-gpu \
  --dump-dom 'data:text/html,<h1>ok</h1>' 2>/dev/null | grep -o '<h1>ok</h1>'
```

**Driving it** — launching Playwright, screenshotting, the TLS-proxy launch flag,
and rendering a full repo page — is in [testing.md](testing.md).
