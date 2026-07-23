---
name: web-tools
description: >-
  Load the portable working conventions from mehrlander/web-tools
  (docs/CONVENTIONS.md plus docs/SURFACING.md) into the current session:
  the general-behavior hub plus the surfacing system (universal primitives
  and the guide-PR/merge-guide course they engage once you open a PR). Use
  in any repo when the user mentions
  "my conventions", "house rules", surfacing/per-file link format, "file
  card"/"file chip"/"send the file", show-pixels/screenshot-it, "hand over
  the artifact"/SendUserFile, "lead with the live view", branch anchor,
  merge-guide entries, wrap-up, or PR body shape, or when invoked explicitly
  as /web-tools.
---

# web-tools conventions loader

The user's cross-repo working conventions live in two canonical, repo-agnostic
files in the public repo `mehrlander/web-tools`, loaded together as one set:

- `docs/CONVENTIONS.md` — the **hub**: general behavior and scope (prose style,
  standing decisions, leave-it-nicer, make-work, the session/repository/workstream
  vocabulary).
- `docs/SURFACING.md` — the **surfacing system**: the primitives (explicit-markdown
  links, reference-is-a-link, the per-file `[new]/[main]/[diff]` list, show-pixels,
  the render forms, branch anchor, the caption) and the surfacing course (guide PR
  body → merge-guide entry, wrap-up, post-merge handoff).

This skill fetches both fresh so any session in any repo follows the same
conventions without keeping a stale copy.

## Fetch (primary path)

```bash
for f in CONVENTIONS SURFACING; do
  echo "===== docs/$f.md ====="
  curl -fsSL "https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/$f.md"
done
```

`raw.githubusercontent.com` is on the Claude Code web sandbox allowlist, and
the repo is public, so this needs no auth. Fetch both: surfacing lives in
`SURFACING.md`, so `CONVENTIONS.md` alone loses every surfacing rule.

## Apply

Apply the two files as one set, substituting the current repo into the URL
templates. `CONVENTIONS.md` is the general-behavior hub. `SURFACING.md` holds
the **surfacing primitives** (universal, no setup) and the **surfacing course**
(the guide-PR/merge-guide lifecycle, wrap-up, and handoff), which does nothing
until the repo opens a PR. Pages render one way, the 🥏 toss, so there is no
preview mechanism to configure. The one per-repo setting is per-session
refreshes, normally none (`SURFACING.md` explains it). Where the current repo's
own CLAUDE.md conflicts on a point, the current repo wins.

## Fallbacks

If `curl` to `raw.githubusercontent.com` is denied (restrictive network
policy), in order:

1. **GitHub MCP:** add `mehrlander/web-tools` to the session scope if needed
   (`mcp__claude-code-remote__list_repos`, then `add_repo`), then
   `mcp__github__get_file_contents` with owner `mehrlander`, repo
   `web-tools`, for each of `docs/CONVENTIONS.md` and `docs/SURFACING.md`.
2. **WebFetch** on the same raw URLs.

## The rest of the portable set: the manifest

This skill is just the loader. The full catalog of what travels from
`mehrlander/web-tools` to any repo, and how each piece is consumed, lives in one
surfaced file:

- **[`docs/PORTABLE.md`](https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/PORTABLE.md)** — the manifest. Fetch it the same way (raw URL) to see the menu.

Highlights it lists, fetchable directly by raw URL when relevant:

- `docs/headless-vendoring.md` — build with Tailwind / daisyUI / Alpine /
  Phosphor and screenshot or test them headless in a sandbox that blocks their
  CDNs. Self-contained; usable without any other web-tools machinery.
- `docs/environment/*.md` — dated notes on the Claude Code web sandbox (network
  allowlist, persistence, testing recipes). Sandbox-level, so they apply in any
  repo.
- `docs/MERGE-GUIDE.md` — web-tools' own merge-guide log, a worked example of the
  entry format (each repo keeps its own).

## Installing this skill into another repo

From a session in the target repo:

```bash
mkdir -p .claude/skills/web-tools
curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/.claude/skills/web-tools/SKILL.md \
  -o .claude/skills/web-tools/SKILL.md
```

Then commit and push. Skills register at session start, so the skill becomes
invocable in sessions started from a branch that contains it (the session
that installs it can still read the file directly). Optionally, make adoption
always-on by adding one line to the target repo's own CLAUDE.md:

> Run the `web-tools` skill at the start of any session that will modify files.

`mehrlander/web-tools` holds the canonical copy of both this skill and the
conventions; the conventions are fetched live, so target repos only need to
re-run the installer when the *skill itself* changes. A repo can automate even
that with a fail-soft `SessionStart` hook that re-fetches this file each session
(see [`docs/PORTABLE.md`](https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/PORTABLE.md),
"Staying current: refresh at session start").

**Fetch is not invoke.** Installing this skill, or re-fetching it (by hand or via
that hook), only makes it *available*; it does not *run* it, and writing a skill
file emits nothing to context. So the conventions govern a session only when the
skill is actually invoked: by model judgement, by `/web-tools`, or by
the always-on CLAUDE.md line above. Pair any install path with that line, or the
conventions stay fetched-but-unused. To drop the dependency on the agent obeying
the line entirely, use the stronger `SessionStart` variant in `docs/PORTABLE.md`
("Stronger variant: inject the conventions") that fetches both `CONVENTIONS.md`
and `SURFACING.md` and emits them as `additionalContext`, so they're in context
every session without anyone having to invoke anything.
