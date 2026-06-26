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

## Staying current: refresh at session start

The skill fetches `CONVENTIONS.md` live on every run, so the *conventions* never
go stale once the skill is **invoked**. The one piece that can drift is the
loader **skill file** itself (its fetch URL, fallbacks, description). A consuming
repo that wants that kept current too can re-fetch the skill each session with a
fail-soft `SessionStart` hook, instead of re-running the installer by hand
whenever the skill changes. The hook is the committed mechanism; the fetched
skill is gitignored, so it's fresh every session and never a stale copy in the
tree.

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
DEST="${CLAUDE_PROJECT_DIR:-.}/.claude/skills/web-tools-conventions"
URL="https://raw.githubusercontent.com/mehrlander/web-tools/main/.claude/skills/web-tools-conventions/SKILL.md"
mkdir -p "$DEST" 2>/dev/null || exit 0
if curl -fsSL --max-time 10 "$URL" -o "$DEST/SKILL.md.tmp" 2>/dev/null; then
  mv "$DEST/SKILL.md.tmp" "$DEST/SKILL.md" 2>/dev/null || rm -f "$DEST/SKILL.md.tmp"
else
  rm -f "$DEST/SKILL.md.tmp" 2>/dev/null
fi
exit 0
```

2. Gitignore the fetched skill, so the hook (not a checked-in copy) is the source of truth:

```
.claude/skills/web-tools-conventions/
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

Why it holds: the hook is committed and the skill is gitignored (fresh each
session, never a stale checked-in copy); it's fail-soft (10s cap, errors
swallowed, always `exit 0`), so a hiccup or a web-tools outage degrades to "no
auto-loaded conventions this session," not a blocked start; and it fetches over
`raw.githubusercontent.com`, on the web allowlist (see "How to adopt" above), so
no auth. Keep it **synchronous** (the default) so it completes before skill
discovery and the freshly-fetched skill is live in the *same* session, not the
next one. This is a recipe for *consuming* repos; web-tools is the source and
doesn't run it on itself.

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

Trade-offs versus the skill-fetch hook: this injects the conventions into **every**
session unconditionally (always-on context cost, no model judgement), it loads
`CONVENTIONS.md` raw rather than through the skill's à-la-carte "apply" framing,
and it doesn't keep the loader **skill** itself installed (so `/web-tools-conventions`
and the model-invocation path won't exist unless you also run the installer). The
two are complementary, not exclusive: a repo can run the skill-fetch hook *and*
this injector, or pick whichever matches how reliably it needs the conventions
present.

## The set

| Doc | What it's for | How you use it |
|---|---|---|
| [`.claude/skills/web-tools-conventions/SKILL.md`](../.claude/skills/web-tools-conventions/SKILL.md) | the loader: pulls the conventions into any session, and links here for the rest | **install** (copy in, once) |
| [`docs/CONVENTIONS.md`](CONVENTIONS.md) | cross-repo working conventions in two severable layers: the universal **surfacing primitives** (per-file `[new]/[main]/[diff]` links, show-pixels, branch anchor, session diff) and the opt-in **surfacing course** (branch-guide/PR-body/merge-guide lifecycle, wrap-up, handoff) | fetched live by the skill; adopt either layer |
| [`docs/headless-vendoring.md`](headless-vendoring.md) | build with Tailwind / daisyUI / Alpine / Phosphor and screenshot or test them **headless** in a sandbox that blocks their CDNs (the "Playwright won't load my libraries" problem) | fetch or copy; self-contained |
| [`docs/environment/`](environment/) | dated facts about the Claude Code **web sandbox** itself: network allowlist, what persists, the testing recipes. Sandbox-level, so they apply to a session in any repo | fetch when relevant |
| [`docs/github/markdown.md`](github/markdown.md) | what GitHub's renderer does with markdown (Mermaid, math, alerts, sparklines): GitHub-level, not web-tools-level | fetch when relevant |

**Not portable** (web-tools-specific machinery): `docs/loader.md`, `tools/**`,
`CLAUDE.md`, `dist/`. And `docs/MERGE-GUIDE.md` travels only as a *format
example*: it belongs to CONVENTIONS.md's opt-in surfacing course, so a repo keeps
one of its own only if it adopts that layer.

## Pointing a session here

To send another Claude Code session to this set, [`docs/SHARE.md`](SHARE.md) is a
ready-to-paste message that hands over the fetch command itself (a session can't
always reach another repo by git or MCP scope, but a raw HTTP GET of these public
files works). It's the pointer *to* this set, not a member of it.
