---
name: caption
description: Emit the surfacing caption for the current branch: the uniform file list with [new]/[main]/[diff] links plus ⭐/🥏 render lines, at full (everything since main), turn (this turn's files), or bare (just the 🧭 guide link) size. Also the engine for syncing a guide PR body's managed region. Use when the user says "caption" or asks for the file-link list, or when a guide PR body needs a sync after a push.
---

# Caption

Emit a surfacing caption per the conventions (`docs/CONVENTIONS.md` in
`mehrlander/web-tools`, or the copy loaded in this session). Substitute the
current repo into all URL templates.

## Sizes

- **full** (default): every file changed since main, from
  `git diff origin/main...HEAD --name-status`.
- **turn**: only the files this turn changed; the default closer for a
  file-modifying reply.
- **bare**: no list, just the 🧭 guide link; for turns that changed nothing.

## Rows

One bullet per file, filename plain, link words tappable, rows uniform (no
bullet swaps, no per-row icons), a file's links not repeated within a turn:

```
- <path> ([new](https://github.com/<owner>/<repo>/blob/<branch>/<path>), [main](https://github.com/<owner>/<repo>/blob/main/<path>), [diff](https://github.com/<owner>/<repo>/commit/<sha>))
```

- `[new]` is the branch tip; omit `[main]` for an added file; a deleted file
  gets `[main]` and `[diff]` only.
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

## Syncing a guide PR body

The full caption is the core of the guide PR body's managed region
(`<!-- guide -->` … `<!-- /guide -->`). To sync after a push: regenerate the
region (⭐ Look line, Changed list, Next steps / open threads, Notes / Risk),
rewrite only that region via the GitHub API (`update_pull_request`), and leave
everything outside the fences untouched. Narrative goes in PR comments, not
the body.
