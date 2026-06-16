# Portable docs (the to-go set)

The docs in `mehrlander/web-tools` that are written to be used **from any repo**,
not just this one. If you want this repo's working conventions, or its recipe for
building with a favorite front-end stack and testing it headless, without
adopting the whole library, this is the menu.

The loader skill is the front door; this file is the catalog it points at, and it
points back. The skill is *how* you adopt; this is *what* there is.

## How to adopt

You don't copy these in (except one). Install the loader **skill** once; it
fetches the conventions live and points back here for the rest:

```bash
mkdir -p .claude/skills/web-tools-conventions
curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/.claude/skills/web-tools-conventions/SKILL.md \
  -o .claude/skills/web-tools-conventions/SKILL.md
```

Then invoke `/web-tools-conventions`, or make it always-on with one line in the
target repo's CLAUDE.md (see the skill). Everything below can also be fetched
directly, no skill needed, from
`https://raw.githubusercontent.com/mehrlander/web-tools/main/<path>` (the repo is
public and that host is on the Claude Code web allowlist).

## The set

| Doc | What it's for | How you use it |
|---|---|---|
| [`.claude/skills/web-tools-conventions/SKILL.md`](../.claude/skills/web-tools-conventions/SKILL.md) | the loader: pulls the conventions into any session, and links here for the rest | **install** (copy in, once) |
| [`docs/CONVENTIONS.md`](CONVENTIONS.md) | cross-repo working conventions in two severable layers: the universal **surfacing primitives** (per-file `[new]/[main]/[diff]` links, show-pixels, branch anchor, session diff) and the opt-in **spine** (branch-guide/PR-body/merge-guide lifecycle, wrap-up, handoff) | fetched live by the skill; adopt either layer |
| [`docs/headless-vendoring.md`](headless-vendoring.md) | build with Tailwind / daisyUI / Alpine / Phosphor and screenshot or test them **headless** in a sandbox that blocks their CDNs (the "Playwright won't load my libraries" problem) | fetch or copy; self-contained |
| [`docs/environment/`](environment/) | dated facts about the Claude Code **web sandbox** itself: network allowlist, what persists, the testing recipes. Sandbox-level, so they apply to a session in any repo | fetch when relevant |
| [`docs/github/markdown.md`](github/markdown.md) | what GitHub's renderer does with markdown (Mermaid, math, alerts, sparklines): GitHub-level, not web-tools-level | fetch when relevant |

**Not portable** (web-tools-specific machinery): `docs/loader.md`, `tools/**`,
`CLAUDE.md`, `dist/`. And `docs/MERGE-GUIDE.md` travels only as a *format
example*: it belongs to CONVENTIONS.md's opt-in spine layer, so a repo keeps one
of its own only if it adopts that layer.

## Pointing a session here

To send another Claude Code session to this set, [`docs/SHARE.md`](SHARE.md) is a
ready-to-paste message that hands over the fetch command itself (a session can't
always reach another repo by git or MCP scope, but a raw HTTP GET of these public
files works). It's the pointer *to* this set, not a member of it.
