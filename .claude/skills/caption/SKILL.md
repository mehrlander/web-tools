---
name: caption
description: Emit the surfacing caption for the current branch: the uniform file list with [new]/[main]/[diff] links plus ⭐/🥏 render lines, at full (everything since main), turn (this turn's files), bare (just the 🧭 guide link), or recap (the full caption wrapped in a fixed-form session re-entry) size. Also the engine for syncing a guide PR body's managed region. Use when the user says "caption" or asks for the file-link list, when a guide PR body needs a sync after a push, or when the user says "reorient", "recap", "catch me up", or "where are we".
---

# Caption

Emit a surfacing caption per the conventions (`docs/CONVENTIONS.md` in
`mehrlander/web-tools`, or the copy loaded in this session). Substitute the
current repo into all URL templates.

## Sizes

- **full** (default): every file changed since main, from
  `git diff origin/main...HEAD --name-status`.
- **turn**: only the files this turn changed, taken from the conversation
  context (git cannot see turn boundaries); the default closer for a
  file-modifying reply.
- **bare**: no list, just the 🧭 guide link; for turns that changed nothing.
- **recap**: the re-entry size: the full caption wrapped in the session's
  story, in the fixed form below. For "where are we", "catch me up", or a
  long gap in the conversation.

## Rows

One bullet per file, filename plain, link words tappable, rows uniform (no
bullet swaps, no per-row icons), a file's links not repeated within a turn:

```
- <path> ([new](https://github.com/<owner>/<repo>/blob/<branch>/<path>), [main](https://github.com/<owner>/<repo>/blob/main/<path>), [diff](https://github.com/<owner>/<repo>/commit/<sha>))
```

- `[new]` is the branch tip; omit `[main]` for an added file; a deleted file
  gets `[main]` and `[diff]` only.
- `[diff]` is the newest branch commit touching the file
  (`git log main..HEAD -1 --format=%h -- <path>`).
- Add `#L120` or `#L120-L145` to a blob link when a specific change is the point.
- Add an indented `renders on: [<consumer>](…)` line under a shared component.

## Render lines

After the list, a blank line, then one 🥏 or ⭐ line per changed renderable HTML
page, link text the page path. Honesty gate: a kit, doc, or asset gets none.
Choose per the repo's preview mechanism; in web-tools: lib/dist change → ⭐
`?use=<sha>` on the deployed page URL; page-shell change on an un-deployed
branch → 🥏 toss `#gh=<owner>/<repo>@<sha>:<path>`. With no preview mechanism,
the portable fallback is the 🥏 `#gz=` toss.

## Tail

When the branch has a guide PR (or a branch-guide file), close with the
pointer: `🧭 [PR #N](<url>)`.

## The recap form

The recap size wraps the caption in a fixed-form re-entry summary, kept to
one screen. The fixed form is the point: every recap reads the same way, so
the user can scan by section.

1. **Goal:** one sentence: what this session set out to do and why.
2. **Decisions:** the choices settled so far, one line each, in the order
   they were made. State the decision, not the deliberation.
3. **State:** the full caption: branch anchor, the file list per Rows above,
   render lines, PRs and tracker tasks touched, the 🧭 tail.
4. **Open:** questions raised but not settled, one line each.
5. **Next:** the immediate next actions, in order.

Rules: plain, dry register; no em dashes; a recap introduces nothing new (no
proposals, no analysis); when a section is empty, write "none" rather than
omitting it, so the form stays fixed.

## Syncing a guide PR body

The full caption is the core of the guide PR body's managed region
(`<!-- guide -->` … `<!-- /guide -->`). To sync after a push: regenerate the
region (⭐ Look line, Changed list, Next steps / open threads, Notes / Risk),
rewrite only that region via the GitHub API (`update_pull_request`), and leave
everything outside the fences untouched. Narrative goes in PR comments, not
the body.
