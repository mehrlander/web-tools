## Where the rest of the system lives

[docs/CONVERSATION.md](docs/CONVERSATION.md) and [docs/QUALIFIED-WRITING.md](docs/QUALIFIED-WRITING.md) are the whole cross-repo contract: how a session's work reaches a reader, and how the prose carrying it is written. Everything below is web-tools-specific.

**Delivery is the plugin, here as everywhere.** At startup, resume and compaction, the `portable` plugin's `invoke-default` hook adds one instruction to the session's context, to invoke `/portable:default`, which loads both, unless a checkout's CLAUDE.md already imports them. This file imports neither, on purpose: an import would make the hub the one repo that could not notice the plugin path failing. If the conventions are missing from a session here, either the hook did not add its instruction or the session did not act on it, and that is worth knowing rather than papering over. Three one-line defaults: this sandbox is one venue among several ([docs/venues.md](docs/venues.md)); before adding to a doc, ask whether the app derives it, the suite enforces it, or another document owns it, and link instead; be wary of improvements addressing hypothetical problems. What travels to other repos is indexed in [`docs/portable.csv`](docs/portable.csv); the distribution channel is the plugin marketplace ([docs/MARKETPLACE.md](docs/MARKETPLACE.md)).

## The Web Tools app

[docs/APP.md](docs/APP.md) is the product frame and the app's reference: mission, goals, boundary, addresses, and what every view shares. The product is **Web Tools**, or the Web Tools app.

## Showing: which link shows what

The mechanisms, what each reaches and misses, and the rule for picking one are **not restated here**. They live as data in [`docs/showing-mechanisms.csv`](docs/showing-mechanisms.csv) and render in the app's **Map view, Showing tab**; the frame and the record are in [`docs/showing.md`](docs/showing.md).

**So do not decide it by reading. Run it:** `npm run showing` reads the branch's
changed files and prints the render line to paste, or an honest no-link with the
reason ([`python/showing.py`](python/showing.py)). No script supplies the honesty
rule: where no link reaches a change, say so and send a headless screenshot.

## Per-session refresh: thumbnails

Before a merge, if any `pages/*.html` changed this session (`git diff main...HEAD --name-only`), regenerate just those pages' thumbnails (`npm run pages-shots -- <page…>`) and commit. Thumbs are refreshed once per session, not per commit, because screenshots are slow and not byte-deterministic; the commit hook only warns about them. The hook regenerates the catalogs with each commit.

## Guide-PR support: platform auto-create is on

The account's Claude Code web settings ("Create pull requests automatically" with "Create as draft") create a draft PR on a session's first push. A session working in an added repo opens the draft itself through the GitHub MCP. Body sync is manual and follows the guide pointer in [docs/CONVERSATION.md](docs/CONVERSATION.md); no hook or CI tracks it. `BRANCH-GUIDE.md` files are retired; delete any stray one on sight.

## The pre-build & the build-on-commit hook

`dist/web-tools.js` is **the pre-build**: the whole `lib/` frozen into one self-booting offline artifact, so a page adopts the library with one import instead of a `gh.load` chain. `dist/app.js` is the app's own: only what `app/index.html` reaches. Both are tracked. See [`node/README.md`](node/README.md#the-pre-build).

The `gh.load` chain it replaces is the repo's default, not a legacy path. [`docs/loader.md`](docs/loader.md) is the only statement of the contract a file must honor to be loadable that way, plus the timing invariants the boot sequence depends on. Read it before adding a file to `lib/` or changing how a page boots. Which folder the file belongs in is answered in [`docs/code-layers.md`](docs/code-layers.md) and measured by `npm run code-scan`.

Every **deterministic** derived artifact is owned by one commit-time hook, [`.githooks/pre-commit`](.githooks/pre-commit). Before a `git commit` it regenerates and stages, in the same commit, whatever the pending changes touch. [`node/README.md`](node/README.md#the-refresh-model) lists the legs, the order they run in, and why that order matters.

Don't hand-edit a file the hook writes; edit the source and let the hook refresh it. Thumbnails (`pages/thumbs/*.png`) are the exception (see "Per-session refresh" above).

**Git owns the hook, not Claude:** a `PreToolUse` hook disappears when the session root sits above this repo. Run `npm run setup` once per checkout for hooks, the CSV merge driver, and dependencies; `npm run ready` checks without writing. Claude's startup scripts delegate to that shared path. `--no-verify` bypasses it. Details: [extending.md](docs/environment/extending.md).

**Verification stays independent.** Setup never regenerates tracked artifacts, and API, MCP, or server-side writes cannot run local hooks. [`node/test/derived-artifacts.test.mjs`](node/test/derived-artifacts.test.mjs) therefore checks every generator under `npm test`. Repair hook-owned output with `npm run artifacts:refresh`, then run any additional command the test names. A local merge that restamps its combined index pauses for the gated `git -c core.editor=true merge --continue` path.

[`.github/workflows/test.yml`](.github/workflows/test.yml) runs `npm test` on every pull request and reports it as a check on the PR, so the test speaks even when no session runs the suite. `page-measures.yml` also runs on pull requests that touch a page, but only reports: a finding never fails it, so a red run is a fault in the pass, not in a page. The suite is browser-free by construction (`node --test` globs `node/test/**/*.test.mjs`, and every Playwright-driven check is named without `.test.`), so keep it that way or the runner grows a browser install. `package-lock.json` is gitignored, so CI resolves dependency ranges fresh on each run and a green check is not a claim about a pinned tree.

## Project tracker

Root-level `tracker/` scoped to repo-wide work (conventions, build tooling, docs, environment). Follows [`docs/TRACKER.md`](docs/TRACKER.md).

- **Placement:** `tracker/` (single tracker, no registry).
- **Board generator:** `npm run tracker-board` (wired into the commit hook above).

## Registries

A committed CSV that inventories or classifies part of the tree is a
**registry**; adding one means adding a row to
[`docs/registries.csv`](docs/registries.csv) in the same commit. The model
and the rules are in
[`docs/registries.md`](docs/registries.md); read it before inventing a registry,
since the answer is usually a row in one that exists. The one trap: **one
property about one target answers to one registry** (gated); resolve a
collision by declaring that one registry **inherits** the other's descriptions,
never by renaming a side, which keeps the duplicate.

## Snags

Snags go in the Lists view's Snag list, `lists/snag.json` in web-tools-private, which holds every repo's. A session adds one, or a date to the item a repeat belongs to, by editing that file and committing to the registry's main. A citation names a snag by its `id`.

## Environment & testing

For visual changes, `npm run shot -- <page>` (`--ref` for `?use=`, `--script` for interactions, `--measure` for phone-width overflow and render health) renders branch pixels headless; send the PNG into chat (conventions: "A screenshot").

[`docs/environment/`](docs/environment/) is a living, dated record of the Claude Code web environment, split by concern: [capabilities](docs/environment/capabilities.md) (network allowlist, headless browser, toolchain), [container](docs/environment/container.md) (what persists across sessions), [testing](docs/environment/testing.md) (the jsdom+Alpine recipe and page-preview constraints), and [extending](docs/environment/extending.md) (the Claude Code component model and the hooks this repo runs). Read it when a task involves testing, verifying, or reaching the network; extend it (edit in place, re-date) when you learn something new.
