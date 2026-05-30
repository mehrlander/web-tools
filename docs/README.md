# docs

Reference docs that don't belong at the repo root. `README.md` (the project
overview) and `CLAUDE.md` (web-session instructions) stay up top and link in
here; everything longer-form lives in this folder.

- **[SCAFFOLDING.md](SCAFFOLDING.md)** — the loader contract: the canonical
  `<head>` block, what each piece contributes, how `gh.load()` works, the
  timing rules and footguns.
- **[ENVIRONMENT.md](ENVIRONMENT.md)** — a living, dated record of what the
  Claude Code web sandbox can and can't do: network allowlist, headless
  Chromium, the jsdom + Alpine test recipe.
- **[MERGE-GUIDE.md](MERGE-GUIDE.md)** — a newest-on-top log of what each
  session shipped, keyed by PR number.

**Possibly expanding this, wiki-style.** We're weighing whether to grow `docs/`
into something closer to a small wiki — more pages, cross-linked — rather than
a flat handful of files. Not decided; noting it so the structure here is
understood as provisional. (GitHub's own repo Wiki is a separate `.wiki.git`
repo and isn't reachable from a web session — see the "two gates" note in
[ENVIRONMENT.md](ENVIRONMENT.md) — so any wiki-style docs would live here, in
the repo.)
