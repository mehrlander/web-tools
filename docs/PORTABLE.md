# Portable set (the to-go bag)

The docs and scripts in `mehrlander/web-tools` that are written to be used **from
any repo**, not just this one. If you want this repo's working conventions, its
recipe for building with a favorite front-end stack and testing it headless, or
its tracker board generator, without adopting the whole library, this is the menu.

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

## Staying current: refresh at session start

The skill fetches `CONVENTIONS.md` live on every run, so the *conventions* never
go stale once the skill is **invoked**. The pieces that can drift are the loader
**skill file** itself (its fetch URL, fallbacks, description) and any portable
**scripts** a consumer runs. A consuming repo that wants these kept current can
re-fetch them each session with a single fail-soft `SessionStart` hook, instead
of re-running the installer by hand whenever anything changes. The hook is the
committed mechanism; the fetched artifacts are gitignored, so they're fresh every
session and never stale copies in the tree.

> [!IMPORTANT]
> **Fetch is not invoke. This hook keeps the skill current; it does not run it.**
> A `SessionStart` hook that writes a skill file to disk makes the skill
> *available*, not *invoked*, and it emits nothing to context. On its own it
> never loads `CONVENTIONS.md`: the loader is model-invocable, so the conventions
> govern a session only if the agent judges the skill relevant, the user types
> `/web-tools-conventions`, or the repo's `CLAUDE.md` makes it always-on. **So
> this hook is not self-sufficient: pair it with the always-on CLAUDE.md line**
> (see [the skill's install section](../.claude/skills/web-tools-conventions/SKILL.md)),
> or the conventions stay fetched-but-unused: present on disk, absent from
> context, governing nothing. (This is exactly how a downstream adopter's sync
> silently no-op'd: the hook fetched faithfully every session, but nothing ever
> invoked the skill, so the conventions never reached context.) To remove the
> dependency on the agent obeying a CLAUDE.md line, use the stronger variant
> below, which injects the conventions into context directly.

1. `.claude/hooks/web-tools-sync.sh` (`chmod +x`):

```bash
#!/bin/bash
set -uo pipefail
BASE="https://raw.githubusercontent.com/mehrlander/web-tools/main"
ROOT="${CLAUDE_PROJECT_DIR:-.}"

fetch() {
  local url="$1" dest="$2"
  mkdir -p "$(dirname "$dest")" 2>/dev/null || return
  if curl -fsSL --max-time 10 "$url" -o "$dest.tmp" 2>/dev/null; then
    mv "$dest.tmp" "$dest" 2>/dev/null || rm -f "$dest.tmp"
  else
    rm -f "$dest.tmp" 2>/dev/null
  fi
}

# Skills
fetch "$BASE/.claude/skills/web-tools-conventions/SKILL.md" \
      "$ROOT/.claude/skills/web-tools-conventions/SKILL.md"
fetch "$BASE/.claude/skills/caption/SKILL.md" \
      "$ROOT/.claude/skills/caption/SKILL.md"
fetch "$BASE/.claude/skills/load-skill/SKILL.md" \
      "$ROOT/.claude/skills/load-skill/SKILL.md"

# Portable scripts
fetch "$BASE/scripts/build-board.py" \
      "$ROOT/.web-tools-scripts/build-board.py"
chmod +x "$ROOT/.web-tools-scripts/build-board.py" 2>/dev/null

exit 0
```

2. Gitignore the fetched artifacts, so the hook (not a checked-in copy) is the source of truth:

```
.claude/skills/web-tools-conventions/
.claude/skills/caption/
.claude/skills/load-skill/
.web-tools-scripts/
```

3. Register it under `SessionStart` in `.claude/settings.json`, alongside any hook already there:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/web-tools-sync.sh" }
        ]
      }
    ]
  }
}
```

Why it holds: the hook is committed and the fetched artifacts are gitignored
(fresh each session, never stale copies in the tree); it's fail-soft (10s cap
per fetch, errors swallowed, always `exit 0`), so a hiccup or a web-tools outage
degrades to "no auto-loaded conventions this session," not a blocked start; and
it fetches over `raw.githubusercontent.com`, on the web allowlist (see "How to
adopt" above), so no auth. Keep it **synchronous** (the default) so it completes
before skill discovery and the freshly-fetched skill is live in the *same*
session, not the next one. To add a new portable script, add one `fetch` line.
This is a recipe for *consuming* repos; web-tools is the source and doesn't run
it on itself.

### Stronger variant: inject the conventions, don't just fetch them

The hook above still leans on the always-on CLAUDE.md line to close the
fetch→invoke gap. A `SessionStart` hook can instead **emit the conventions
straight into context** via `additionalContext`, collapsing fetch and invoke into
one step and removing the dependency on the agent obeying any CLAUDE.md line: the
text is simply *there* at the start of every session, the same as if the skill
had run. Use this when you want the conventions unconditionally governing every
file-modifying session and don't mind paying their context cost up front.

This hook fetches `CONVENTIONS.md` itself (not the skill file) and prints the
SessionStart `additionalContext` JSON the harness reads:

```bash
#!/bin/bash
set -uo pipefail
URL="https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/CONVENTIONS.md"
BODY="$(curl -fsSL --max-time 10 "$URL" 2>/dev/null)" || exit 0
[ -n "$BODY" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
printf '%s' "$BODY" | jq -Rs \
  '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:.}}'
```

Register it under `SessionStart` exactly like the fetch hook (step 3 above). It's
fail-soft on the same principle: a failed fetch, an empty body, or a missing `jq`
each `exit 0` with no output, degrading to "no injected conventions this session"
rather than a blocked start. (No `jq`? Swap the last line for
`python3 -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":sys.stdin.read()}}))'`.)

> [!WARNING]
> That fail-soft posture has a sharp edge worth naming, because it's the same
> bug this whole doc is about. If a host has **neither** `jq` nor `python3`, the
> `command -v … || exit 0` guard makes the hook degrade *silently* to
> no-injection: the very fetch-without-invoke no-op the variant exists to
> prevent, now wearing a different hat. That's the right default for a
> *convenience* (a missing interpreter shouldn't block your session), but the
> wrong one if you adopt inject **as your guarantee** that the conventions are
> loaded. In that case make the missing-interpreter case *loud*, not `exit 0`:
> replace the guard with a branch that warns to stderr (and/or emits an
> `additionalContext` note saying "conventions failed to load"), so a
> misconfigured host fails noisily instead of quietly governing nothing.

Trade-offs versus the skill-fetch hook: this injects the conventions into **every**
session unconditionally (always-on context cost, no model judgement), it loads
`CONVENTIONS.md` raw rather than through the skill's à-la-carte "apply" framing,
and it doesn't keep the loader **skill** itself installed (so `/web-tools-conventions`
and the model-invocation path won't exist unless you also run the installer). The
two are complementary, not exclusive: a repo can run the skill-fetch hook *and*
this injector, or pick whichever matches how reliably it needs the conventions
present.

## The set

Portability is per-item, not per-directory. Most of `tools/` is web-tools-specific
machinery; most of `docs/` is portable. The tables below list what travels.

### Docs

| Doc | What it's for | How you use it |
|---|---|---|
| [`.claude/skills/web-tools-conventions/SKILL.md`](../.claude/skills/web-tools-conventions/SKILL.md) | the loader: pulls the conventions into any session, and links here for the rest | **install** (copy in, once) |
| [`docs/CONVENTIONS.md`](CONVENTIONS.md) | cross-repo working conventions in two severable layers: the universal **surfacing primitives** (the **surfacing caption**'s `[new]/[main]/[diff]` file links plus a 🥏 render line, show-pixels, branch anchor, 🧭 guide pointer, session diff) and the opt-in **surfacing course** (guide-PR/merge-guide lifecycle, wrap-up, handoff) | fetched live by the skill; adopt either layer |
| [`.claude/skills/caption/SKILL.md`](../.claude/skills/caption/SKILL.md) | `/caption`: emit the surfacing caption (full, turn, bare, or recap size; recap wraps the full caption in a fixed-form session re-entry) for the current branch; also the sync engine for a guide PR body's managed region | install or hook-fetch |
| [`.claude/skills/load-skill/SKILL.md`](../.claude/skills/load-skill/SKILL.md) | `/load-skill`: fetch a named skill from the library at [`skills/`](../skills/) (or another declared source) and apply it in the current session; discovery via `skills/manifest.json`. Explicit signal only, never opportunistic | install or hook-fetch |
| [`skills/`](../skills/) | the skill **library**: 34 personal skills published as static resources (not registered anywhere); the default source `load-skill` pulls from | fetched per skill by load-skill |
| [`docs/TRACKER.md`](TRACKER.md) | opt-in **project tracker**: cross-session work-tracking, one file per task under `tasks/` plus a generated `board.md`, the slow layer where the plan lives between sessions. Independent of the primitives and the course | fetch when adopting |
| [`docs/headless-vendoring.md`](headless-vendoring.md) | build with Tailwind / daisyUI / Alpine / Phosphor and screenshot or test them **headless** in a sandbox that blocks their CDNs (the "Playwright won't load my libraries" problem) | fetch or copy; self-contained |
| [`docs/environment/`](environment/) | dated facts about the Claude Code **web sandbox** itself: network allowlist, what persists, the testing recipes. Sandbox-level, so they apply to a session in any repo | fetch when relevant |
| [`docs/github/markdown.md`](github/markdown.md) | what GitHub's renderer does with markdown (Mermaid, math, alerts, sparklines): GitHub-level, not web-tools-level | fetch when relevant |

### Scripts

Portable scripts live in `scripts/` at the repo root: fetchable by raw URL,
runnable with no dependencies beyond python3 stdlib, and parameterized by argv so
one fetched copy serves many callers.

| Script | What it does | Interface |
|---|---|---|
| [`scripts/build-board.py`](../scripts/build-board.py) | regenerate a tracker's `board.md` from `tasks/*.md` frontmatter | `python3 build-board.py <tasks_dir> <board_out>` |

Fetching and running a script is executing hub code, a step beyond fetching and
reading a doc. That is why the hub must stay owned and trusted and the fetch stays
fail-soft: a consumer can audit the script at its raw URL, but there is no
signature or pinning beyond trusting the source repo.

### Not portable

Web-tools-specific machinery: `docs/loader.md`, `tools/**`, `CLAUDE.md`, `dist/`.
And `docs/MERGE-GUIDE.md` travels only as a *format example*: it belongs to
CONVENTIONS.md's opt-in surfacing course, so a repo keeps one of its own only if
it adopts that layer.

## Pointing a session here

To send another Claude Code session to this set, [`docs/SHARE.md`](SHARE.md) is a
ready-to-paste message that hands over the fetch command itself (a session can't
always reach another repo by git or MCP scope, but a raw HTTP GET of these public
files works). It's the pointer *to* this set, not a member of it.
