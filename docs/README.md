# docs

Reference docs that don't belong at the repo root. `README.md` (the project
overview) and `CLAUDE.md` (web-session instructions) stay up top and link in
here; everything longer-form lives in this folder.

- **[loader.md](loader.md)** — the loader contract: the canonical `<head>`
  block, what each piece contributes, how `gh.load()` works, the timing rules
  and footguns, and how that same contract lets a page be frozen into an
  offline **build** (load and build as two readings of one set of rules).
- **[../tools/README.md](../tools/README.md)** — the Node harness (lives under
  `tools/`, not here): `render/` (offline jsdom + Chromium rendering, for
  screenshots and logic checks) and `build/` (the `load → build → bake →
  export` pipeline + `verify-build`). The operational companion to `loader.md`.
- **[environment/](environment/)** — what the Claude Code web environment is,
  can do, and how it's extended: [container](environment/container.md) (what
  persists across sessions), [capabilities](environment/capabilities.md)
  (toolchain, network allowlist, headless Chromium), [testing](environment/testing.md)
  (the sensible way to test HTML/JS, incl. the jsdom + Alpine recipe), and
  [extending](environment/extending.md) (the Claude Code component model + the
  `SessionStart` hook this repo runs).
- **[github/](github/)** — working with GitHub itself: what its renderer turns
  markdown into ([markdown.md](github/markdown.md) — Mermaid, math, sparklines,
  alerts), plus durable notes on how this repo treats git history and branches,
  behind the workflow rules in `CLAUDE.md`. Starts with
  [post-merge branch mutation](github/post-merge-branch-mutation.md)
  (*merged means closed*).
- **[MERGE-GUIDE.md](MERGE-GUIDE.md)** — a newest-on-top log of what each
  session shipped, keyed by PR number.

**Possibly expanding this, wiki-style.** We're weighing whether to grow `docs/`
into something closer to a small wiki — more pages, cross-linked — rather than
a flat handful of files. Not decided; noting it so the structure here is
understood as provisional. (GitHub's own repo Wiki is a separate `.wiki.git`
repo and isn't reachable from a web session — see the "two gates" note in
[capabilities.md](environment/capabilities.md) — so any wiki-style docs would
live here, in the repo.)
