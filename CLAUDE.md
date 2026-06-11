@docs/CONVENTIONS.md

## How these instructions are split

The import above is the portable half: surfacing conventions that apply in any repo. Its canonical copy lives here ([docs/CONVENTIONS.md](docs/CONVENTIONS.md)); other repos load it via the `web-tools-conventions` skill (`.claude/skills/web-tools-conventions/SKILL.md`), which fetches it from main. Everything below is web-tools-specific, layered on top — including the repo's answers to the conventions' three extension points (preview mechanism, per-session refreshes, branch-guide enforcement). Portable guidance goes in CONVENTIONS.md; web-tools machinery goes here.

## Preview mechanism: test page on a branch via `?use=`

GitHub Pages serves from one branch, typically main, so to render branch code through the canonical URL `lib/gh-api.js` honors a `?use=<branch|tag|sha>` query parameter: pages that adopt the convention read it at boot and load the rest of their code from that ref. Useful when linking the user to a test page that exercises work on a branch. See `README.md` for the canonical boot block; for freshly-pushed commits, pass the SHA, since jsDelivr caches branch tips for ~12h.

This is the repo's **preview mechanism** for the conventions' ⭐ links: a changed page (or a component a page loads) previews live at

> `https://mehrlander.github.io/web-tools/pages/<page>.html?use=<ref>`

The honesty rule still applies: only a page renders this way; for a kit or doc, ⭐ links the `[new]` blob.

## Per-session refresh: thumbnails

The conventions' wrap-up step 1 means one thing here: if any `pages/*.html` changed this session (`git diff main...HEAD --name-only`), regenerate just those pages' thumbnails (`npm run pages-shots -- <page…>`) and commit. Thumbs are refreshed once per session, not per commit — screenshots are slow and not byte-deterministic, so the commit hook only nags about them (see "Build-on-commit hook" below). The catalogs need no separate step; the hook regenerates them with each commit.

## Branch-guide enforcement: none yet

The branch-guide lifecycle (create+push first thing, accurate per push, fold+delete at wrap-up) runs convention-only here for now — the build-on-commit hook doesn't track `BRANCH-GUIDE.md`, and there's no CI guard against one leaking to main. If a stray guide is found on main (a merge bypassed wrap-up), delete it as cleanup.

## gh-api.js edits

Any turn that modifies `lib/gh-api.js` must end with the jsDelivr purge link so the user can flush the CDN cache with one tap:

> [https://purge.jsdelivr.net/gh/mehrlander/web-tools/lib/gh-api.js](https://purge.jsdelivr.net/gh/mehrlander/web-tools/lib/gh-api.js)

## The pre-build & the build-on-commit hook

`dist/web-tools.js` is **the pre-build**: the whole `lib/` frozen into one self-booting offline artifact, so a page can adopt the entire library with one import instead of a `gh.load` chain. It's generated (`npm run build:lib`) and it's the one tracked file under the otherwise-gitignored `dist/`. Full story in [`tools/README.md`](tools/README.md#the-pre-build).

Every **deterministic** derived artifact is owned by one commit-time hook (`.claude/hooks/build-on-commit.sh`, a `PreToolUse(Bash)` hook wired in `.claude/settings.json`). Before a `git commit` it regenerates and stages, in the same commit, whatever the pending changes touch:

- `lib/` changed → `npm run build:lib` → `dist/web-tools.js`
- `pages/**/*.html` changed → `npm run pages-index` → `pages/README.md` + `pages/index.html`

Don't hand-edit any of those three files — edit the source and let the hook refresh them. Thumbnails (`pages/thumbs/*.png`) are the deliberate exception: not byte-deterministic, so the hook only *warns* when a page changes without its thumb; the actual refresh happens once per session at wrap-up (see "Per-session refresh" above).

## Environment & testing

[`docs/environment/`](docs/environment/) is a living, dated record of the Claude Code web environment, split by concern: [capabilities](docs/environment/capabilities.md) (network allowlist, headless browser, toolchain), [container](docs/environment/container.md) (what persists across sessions), [testing](docs/environment/testing.md) (the jsdom+Alpine recipe and page-preview constraints), and [extending](docs/environment/extending.md) (the Claude Code component model and the hooks this repo runs). Read it when a task involves testing, verifying, or reaching the network; extend it (edit in place, re-date) when you learn something new. Referenced by plain path, not `@`-imported, so it stays out of context until needed.
