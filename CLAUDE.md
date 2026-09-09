@docs/SURFACING.md

## Qualified writing

Qualify noun phrases to increase clarity, strengthen claims, highlight questions, and support narrative direction. No em dashes: use colons, commas, semicolons, parentheses, or new sentences.

1. **Introduce before you refer.** Use *this*, *it*, or a definite phrase only when the immediate context identifies a single referent.
   *Not:* This exacerbated the problem. *But:* The delayed handoff increased the reporting errors.
2. **Use plain language.** Avoid in-group phrasings, and pin terms to what you mean by them.
   *Not:* The log keeps two properties. *But:* /incidents.csv has two columns.
3. **Extend from what has been established.** Develop the current point, or clearly name the earlier point you are resuming.
   *Not:* The solution is to increase funding. *But:* Since the $2M budget gap cannot be closed by contract renegotiation, we turn to increased funding.
4. **Qualify noun phrases.** Attach the words that say which one, whose, or how many of what. A bare quantifier is the common case.
   *Not:* Both are good. *But:* Both restructuring proposals are good.

## Where the rest of the system lives

[docs/SURFACING.md](docs/SURFACING.md), imported above, is the portable surfacing system; it and the section above are the whole cross-repo contract. Everything below is web-tools-specific. Delivery: a session with this repo checked out gets both through this file; a session without it runs the `web-tools` skill (`.claude/skills/web-tools/SKILL.md`), which fetches SURFACING.md from main. Four one-line defaults ride with the contract: run `/markers` before marking or editing near frozen areas; this sandbox is one venue among several ([docs/venues.md](docs/venues.md)); before adding to a doc, ask whether the app derives it, the suite enforces it, or another document owns it, and link instead; be wary of improvements addressing hypothetical problems. What travels to other repos is indexed in [`docs/portable.csv`](docs/portable.csv); the distribution channel is the plugin marketplace ([docs/MARKETPLACE.md](docs/MARKETPLACE.md)).

## The Web Tools app

[docs/APP.md](docs/APP.md) is the product frame: mission, goals, and the name split (**Web Tools** where a reader is addressed; **show-repo** on files, routes, and the tracker project).

## Showing: which link shows what

The mechanisms, what each reaches and misses, and the rule for picking one are **not restated here**. They live as data in [`docs/showing-mechanisms.csv`](docs/showing-mechanisms.csv) and render in the app's **Map view, Showing tab**; the frame and the record are in [`docs/showing.md`](docs/showing.md). This section used to be 1,589 words, 63% of this file, and it still did not stop a session with all of it in context from handing over the wrong link. The app holds it now.

**So do not decide it by reading. Run it:** `npm run showing` reads the branch's
changed files and prints the render line to paste, or an honest no-link with the
reason ([`scripts/showing.py`](scripts/showing.py)). It
happened again on 2026-08-22, with the `?use=` trap itself in context, which is
why the last rule this section stated in prose is now executable. The honesty
rule survives, since no script supplies it: only a page renders this way, for a
kit or doc ⭐ links the `[new]` blob, and where no link reaches a change, say so
and send a headless screenshot.

## Per-session refresh: thumbnails

The conventions' wrap-up step 1 means one thing here: if any `pages/*.html` changed this session (`git diff main...HEAD --name-only`), regenerate just those pages' thumbnails (`npm run pages-shots -- <page…>`) and commit. Thumbs are refreshed once per session, not per commit: screenshots are slow and not byte-deterministic, so the commit hook only nags about them (see "Build-on-commit hook" below). The catalogs need no separate step; the hook regenerates them with each commit.

## Guide-PR support: platform auto-create is on

The Claude Code web settings for this account enable "Create pull requests automatically" with "Create as draft" (turned on 2026-07-10), so a session started after that gets its draft PR on first push; a session predating the toggle, or one working in an added repo, opens the draft itself via the GitHub MCP (the toggle was probed not to fire retroactively into an in-flight session). Body sync is by hand via `/caption`; no hook or CI tracks it. `BRANCH-GUIDE.md` files are historical (retired by PR #205); delete any stray one on sight.

## gh-api.js edits

Any turn that modifies `lib/gh-api.js` must end with the jsDelivr purge link so the user can flush the CDN cache with one tap:

> [https://purge.jsdelivr.net/gh/mehrlander/web-tools/lib/gh-api.js](https://purge.jsdelivr.net/gh/mehrlander/web-tools/lib/gh-api.js)

## The pre-build & the build-on-commit hook

`dist/web-tools.js` is **the pre-build**: the whole `lib/` frozen into one self-booting offline artifact, so a page adopts the library with one import instead of a `gh.load` chain. `dist/app.js` is the app's own: only what `app/index.html` reaches. Both are tracked. See [`tools/README.md`](tools/README.md#the-pre-build).

The `gh.load` chain it replaces is the repo's default, not a legacy path: 36 page files use it, and [`docs/loader.md`](docs/loader.md) is the only statement of the contract a file must honor to be loadable that way, plus the timing invariants the boot sequence depends on. Read it before adding a file to `lib/` or changing how a page boots. Which folder the file belongs in at all is the prior question, answered once in [`docs/code-layers.md`](docs/code-layers.md) and measured by `npm run code-scan`. It is also the argument that load and build are two readings of one set of rules, which is why the pre-build works at all.

Every **deterministic** derived artifact is owned by one commit-time hook, [`.githooks/pre-commit`](.githooks/pre-commit). Before a `git commit` it regenerates and stages, in the same commit, whatever the pending changes touch. [`tools/README.md`](tools/README.md#the-refresh-model) lists the legs, the order they run in, and why that order matters.

Don't hand-edit a file the hook writes; edit the source and let the hook refresh it. Thumbnails (`pages/thumbs/*.png`) are the deliberate exception: not byte-deterministic, so the hook only *warns* when a page changes without its thumb; the actual refresh happens once per session at wrap-up (see "Per-session refresh" above).

**It is a git hook, not a Claude Code hook, deliberately:** a `PreToolUse` hook is read only when the session's project root IS this repo, so a multi-repo session ran it never and said nothing. [`.claude/hooks/session-githooks.sh`](.claude/hooks/session-githooks.sh) sets `core.hooksPath`; `--no-verify` bypasses. Why, and what it does not generalize to: [extending.md](docs/environment/extending.md).

**Best-effort still.** A clone that never set `core.hooksPath` runs nothing, so `npm test` keeps [`tools/test/derived-artifacts.test.mjs`](tools/test/derived-artifacts.test.mjs), which re-runs each generator in `--check` mode and fails if a tracked artifact is behind its source. Run the command it names and commit the result.

Regenerating by hand after touching `lib/` or `pages/` is still the fast path; the test makes forgetting loud instead of silent. Why each generator has to be byte-deterministic, and the tracker board's 2026-08-05 counterexample, are in [`tools/README.md`](tools/README.md#the-refresh-model).

**And a third owner, which does not depend on anyone remembering.** The test only speaks when the suite is run, so [`.github/workflows/test.yml`](.github/workflows/test.yml) runs `npm test` on every pull request and reports it as a check on the PR. That is the whole reason it exists: a hook that may not fire, guarded by a test that may not be run, was a chain with no link the platform enforced. It is the repo's only workflow triggered by a commit under review, so it is the only one whose result appears as a check rather than only in the Actions tab; `wsl-fetch.yml` is an errand on a cron. The suite is browser-free by construction (`node --test` globs `tools/test/**/*.test.mjs`, and every Playwright-driven check is named without `.test.`), so keep it that way or the runner grows a browser install. One caveat worth knowing: `package-lock.json` is gitignored, so CI resolves dependency ranges fresh on each run and a green check is not a claim about a pinned tree.

## Project tracker

Root-level `tracker/` scoped to repo-wide work (conventions, build tooling, docs, environment). Follows [`docs/TRACKER.md`](docs/TRACKER.md).

- **Placement:** `tracker/` (single tracker, no registry).
- **Board generator:** `npm run tracker-board` (wired into the commit hook above).

## Registries

A committed CSV that inventories or classifies part of the tree is a
**registry**; adding one means adding a row to
[`docs/registries.csv`](docs/registries.csv) in the same commit. The model,
the rules, and what its audits found are in
[`docs/registries.md`](docs/registries.md); read it before inventing a carrier,
since the answer is usually a row in one that exists. The one trap: **one
property about one target answers to one registry** (gated); resolve a
collision by declaring that one registry **inherits** the other's descriptions,
never by renaming a side, which keeps the duplicate.


## Snags

[`docs/SNAGS.md`](docs/SNAGS.md) is this repo's friction log, the store behind the conventions' "where a friction observation goes instead." Its own header carries the intake shape, the recurrence rule, the generated index, and what is still provisional; this section restated them and was the copy.

## Environment & testing

For visual changes, `npm run shot -- <page>` (`--ref` for `?use=`, `--script` for interactions) renders branch pixels headless; send the PNG into chat (conventions: "Show pixels").

[`docs/environment/`](docs/environment/) is a living, dated record of the Claude Code web environment, split by concern: [capabilities](docs/environment/capabilities.md) (network allowlist, headless browser, toolchain), [container](docs/environment/container.md) (what persists across sessions), [testing](docs/environment/testing.md) (the jsdom+Alpine recipe and page-preview constraints), and [extending](docs/environment/extending.md) (the Claude Code component model and the hooks this repo runs). Read it when a task involves testing, verifying, or reaching the network; extend it (edit in place, re-date) when you learn something new. Referenced by plain path, not `@`-imported, so it stays out of context until needed.
