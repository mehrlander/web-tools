---
name: web-tools-conventions
description: Load the portable working conventions from mehrlander/web-tools (docs/CONVENTIONS.md) into the current session. Use in any repo when the user mentions "my conventions", "house rules", surfacing/per-file link format, merge-guide entries, wrap-up, or PR body shape — or when invoked explicitly as /web-tools-conventions.
---

# web-tools conventions loader

The user's cross-repo working conventions — surfacing rules, explicit-markdown
links, the per-file `[new]/[main]/[diff]` list, the surfacing spine (PR body +
merge-guide entry), wrap-up ritual, post-merge handoff — live in one canonical,
repo-agnostic file: `docs/CONVENTIONS.md` in the public repo
`mehrlander/web-tools`. This skill fetches it fresh so any session in any repo
follows the same conventions without keeping a stale copy.

## Fetch (primary path)

```bash
curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/CONVENTIONS.md
```

`raw.githubusercontent.com` is on the Claude Code web sandbox allowlist, and
the repo is public, so this needs no auth.

## Apply

The file is written to be followed as-is in any repo: substitute the current
repo into its URL templates and follow it like the current repo's own
CLAUDE.md. It defines two extension points (preview mechanism, per-session
refreshes) that the current repo's CLAUDE.md may fill; if it doesn't, the
documented defaults apply. If the current repo's own CLAUDE.md conflicts on a
point, the current repo wins.

## Fallbacks

If `curl` to `raw.githubusercontent.com` is denied (restrictive network
policy), in order:

1. **GitHub MCP:** add `mehrlander/web-tools` to the session scope if needed
   (`mcp__claude-code-remote__list_repos`, then `add_repo`), then
   `mcp__github__get_file_contents` with owner `mehrlander`, repo
   `web-tools`, path `docs/CONVENTIONS.md`.
2. **WebFetch** on the same raw URL.

## Related web-tools files (fetch the same way when relevant)

- `docs/MERGE-GUIDE.md` — web-tools' own merge-guide log, a worked example of
  the entry format (each repo keeps its own `docs/MERGE-GUIDE.md`).
- `docs/environment/*.md` — dated notes on the Claude Code web sandbox
  (network allowlist, persistence, testing recipes). These describe the
  sandbox itself, so they apply to sessions in any repo.

## Installing this skill into another repo

From a session in the target repo:

```bash
mkdir -p .claude/skills/web-tools-conventions
curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/.claude/skills/web-tools-conventions/SKILL.md \
  -o .claude/skills/web-tools-conventions/SKILL.md
```

Then commit and push. Skills register at session start, so the skill becomes
invocable in sessions started from a branch that contains it (the session
that installs it can still read the file directly). Optionally, make adoption
always-on by adding one line to the target repo's own CLAUDE.md:

> Run the `web-tools-conventions` skill at the start of any session that will modify files.

`mehrlander/web-tools` holds the canonical copy of both this skill and the
conventions; the conventions are fetched live, so target repos only need to
re-run the installer when the *skill itself* changes.
