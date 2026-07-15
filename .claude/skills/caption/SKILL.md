---
name: caption
description: >-
  Emit the surfacing caption for the current branch: the uniform file list
  with [new]/[main]/[diff] links plus ⭐/🥏/📦 render lines, at full
  (everything since main), turn (this turn's files), bare (just the 🧭 guide
  link), or recap (the full caption wrapped in a fixed-form session re-entry)
  size. Also the engine for syncing a guide PR body's managed region. Use
  when the user says "caption" or asks for the file-link list, when a guide
  PR body needs a sync after a push, or when the user says "reorient",
  "recap", "catch me up", or "where are we".
---

# Caption

The caption is a fixed, predictable way to surface files in chat: one uniform
row per file, filename plain, link words tappable. This skill emits that
format. Two questions are separable: which files (selection) and how each row
reads (format). The sizes below are selection presets over the session's
changes; a caption can also be requested on a topic (see Topical captions),
where the user names the file set and change state is beside the point.

Formats follow the conventions (`docs/CONVENTIONS.md` in `mehrlander/web-tools`,
or the copy loaded in this session). Substitute the current repo into all URL
templates.

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

## Dense variant: folder tables (optional)

When a turn's changes cluster under folders, especially several new files in one
folder (a new skill, a component dir), a markdown table can beat the bullet
list: it carries each folder path once, links it to the tree, and drops the
`[new]` scaffolding. Reach for it on that clustered case; for a short or
scattered list the bullets stay clearer. Specials (🥏, ⭐, 🧭) stay outside the
tables as their own lines.

Shape: two tables, `New` and `Changed`. The word is the first header cell, the
second header is blank. Column one is the folder, linked to its tree; column two
lists the files. A filename always links to its `[new]` blob, so a `New` row
stops there and a `Changed` row appends `([main], [diff])` in parens.

```
| New | |
|---|---|
| [<dir>/](…/tree/<branch>/<dir>) | [<file>](…/blob/<branch>/<dir>/<file>), … |

| Changed | |
|---|---|
| [<dir>/](…/tree/<branch>/<dir>) | [<file>](…/blob/<branch>/<dir>/<file>) ([main](…/blob/main/<dir>/<file>), [diff](…/commit/<sha>)) |
```

Worked example (a turn that added a skill folder and edited one doc):

| New | |
|---|---|
| [.claude/skills/task-tracker/](https://github.com/<owner>/<repo>/tree/<branch>/.claude/skills/task-tracker) | [SKILL.md](https://github.com/<owner>/<repo>/blob/<branch>/.claude/skills/task-tracker/SKILL.md) |
| [.claude/skills/file-retrieval/](https://github.com/<owner>/<repo>/tree/<branch>/.claude/skills/file-retrieval) | [SKILL.md](https://github.com/<owner>/<repo>/blob/<branch>/.claude/skills/file-retrieval/SKILL.md), [corpus_search.py](https://github.com/<owner>/<repo>/blob/<branch>/.claude/skills/file-retrieval/corpus_search.py), [read_doc.py](https://github.com/<owner>/<repo>/blob/<branch>/.claude/skills/file-retrieval/read_doc.py), [sources.toml](https://github.com/<owner>/<repo>/blob/<branch>/.claude/skills/file-retrieval/sources.toml) |

| Changed | |
|---|---|
| [docs/](https://github.com/<owner>/<repo>/tree/<branch>/docs) | [TRACKER.md](https://github.com/<owner>/<repo>/blob/<branch>/docs/TRACKER.md) ([main](https://github.com/<owner>/<repo>/blob/main/docs/TRACKER.md), [diff](https://github.com/<owner>/<repo>/commit/<sha>)) |

A file deeper than its folder carries the sub-path in the link text
(`searches/README.md`). The sizes, render lines, and tail above are unchanged;
only the file list swaps shape.

**Other grouping axes.** Folder-then-files is one instance of a general move:
group by whatever axis clusters the rows, one bold or header line per group,
members below it. The `tasks` skill applies this to tracker tasks grouped by
owning branch (single-column table, bold branch row, `↳`-prefixed task rows),
a longer-not-wider layout that reads better on a narrow screen than packing
several items into one wide cell. Reach for that shape whenever rows cluster
by an owner (branch, folder, author) rather than files under a folder
specifically.

## Topical captions

When the request names a subject rather than the session's changes ("caption
the portable docs"), select by enumerating the topic, not by git diff. An
unchanged file gets one link, the main blob:

```
- <path> ([main](https://github.com/<owner>/<repo>/blob/main/<path>))
```

The `[new]/[main]/[diff]` triple encodes change state, so for an unchanged
file the extra links would be noise; omit them. A changed file caught in a
topical caption keeps the full triple.

## Render lines

After the list, a blank line, then one 🥏 or ⭐ line per changed renderable HTML
page, link text the page path. Honesty gate: a kit, doc, or asset gets none.
Choose per the repo's preview mechanism; in web-tools: lib/dist change → ⭐
`?use=<sha>` on the deployed page URL; page-shell change on an un-deployed
branch → 🥏 toss `#gh=<owner>/<repo>@<sha>:<path>`. With no preview mechanism,
the portable fallback is the 🥏 `#gz=` toss.

A page published as an artifact this session gets a 📦 line: link text the
page path, URL the claude.ai artifact URL. Pick by where the link opens: the
Claude app's in-app browser holds no token, so `#gh=` fails there, while 📦
and `#gz=` both work (matrix in `docs/artifacts.md`). Record an artifact URL
in a durable place (README, PR body, task file) or later sessions cannot
find it.

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
