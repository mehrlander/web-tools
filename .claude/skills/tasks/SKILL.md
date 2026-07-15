---
name: tasks
description: >-
  Operate the project tracker in mehrlander/web-tools: file a task, claim a
  task, update or close one, and regenerate the board, following the
  docs/TRACKER.md schema and the rule that task files and board.md commit
  straight to main (not a feature branch). Invoking this skill bare (no
  further ask) surfaces a caption of the current board. Use when the user
  says "add a task", "file a task", "make a tracker task", "claim a task",
  "check the tracker", "what's on the board", "regenerate the board", or
  "close task X", or when a follow-up needs to survive across sessions.
  Owns the tracker's file format and main-branch workflow; the
  web-tools-conventions skill owns PR bodies, surfacing links, and the
  merge guide, so route those there.
---

# tasks

The tracker is cross-session memory on `main`: `tracker/tasks/<id>.md` is the
source of truth, `tracker/board.md` is a generated rollup. Canonical spec is
[`docs/TRACKER.md`](../../../docs/TRACKER.md); this skill carries the operations
so a session need not hand-read it. Substitute the current repo into URL
templates.

## Bare invocation: caption the board

Called with no further ask (e.g. `/tasks` on its own), show a caption of the
current board before doing anything else, one single-column table per status
section, in the format below. Read `tracker/tasks/*.md` directly rather than
parsing `board.md`'s prose, so the rows can link. Close with a one-line offer
of the next action (file, claim, update, close, regenerate). When the ask
names an action instead ("file a task", "claim X"), skip the caption and go
straight to that operation.

**Format:** one single-column table per section, the header the section name
in caps (`IN PROGRESS`, `BACKLOG`, `BLOCKED`); no header row above the table,
the column header is the label. In-progress groups by owning branch: the full
branch name **bold** as its own row, then every task under it on its own row
prefixed `↳` (always, even for a single task). Backlog and blocked have no
branch to group by, so each is a flat one-row-per-task table, no arrow. This
is a longer-not-wider layout: one task per line rather than packing several
into a cell, which reads better on a narrow screen. Omit a section with no
tasks (e.g. no `BLOCKED` table when nothing is blocked).

```
| IN PROGRESS |
|---|
| **claude/some-branch-abc123** |
| ↳ [Task title](<blob url>) |
| ↳ [Second task on the same branch](<blob url>) |
| **claude/other-branch-xyz789** |
| ↳ [Solo task on its own branch](<blob url>) |

| BACKLOG |
|---|
| [Task title](<blob url>) |
| [Another task title](<blob url>) |
```

## The one rule that is easy to miss

**Task files and `board.md` commit directly to `main`, never to a feature
branch.** That is what makes the tracker shared: every session knows to look at
`main`. Feature work rides its branch as usual; the task file that tracks it
does not. Practically, do the tracker edit on a scratch branch cut fresh from
`origin/main` and push it to `main`, then return to your working branch:

```
git fetch origin main
git checkout -B tmp-tracker origin/main
#   ... edit tracker/tasks/*.md ...
python3 scripts/build-board.py tracker/tasks tracker/board.md   # or: npm run tracker-board
git add tracker/ && git commit -m "tracker: <what>"
git push origin tmp-tracker:main
git checkout <your-branch> && git branch -D tmp-tracker
```

In this repo the commit hook regenerates `board.md` when `tracker/tasks/`
changes, so the explicit generator call is belt-and-suspenders; run it anyway
when working outside the hook.

If the push is rejected as non-fast-forward, another session advanced `main`:
`git fetch origin main`, `git rebase origin/main`, regenerate the board, and
push again. Task files with distinct ids do not conflict; `board.md` may, and
it is generated, so take either side and rerun the generator.

## Minting an id

Ids are a date plus a short random suffix, `YYYYMMDD-rrr`, so two sessions
filing at once do not collide (a sequential integer would: both pick the same
next number and the later merge silently drops one task). Mint one:

```
python3 -c "import random,string,datetime;print(datetime.date.today().strftime('%Y%m%d')+'-'+''.join(random.choices(string.digits+string.ascii_lowercase,k=3)))"
```

The filename is `<id>.md`. Legacy integer ids (`0001`) stay as they are.

## File a task

Write `tracker/tasks/<id>.md` with flat `key: value` frontmatter (split on the
first colon, scalars only, no YAML nesting or lists) and a body:

```markdown
---
id: <minted id>
title: <short imperative>
status: backlog
opened: <YYYY-MM-DD>
project: <optional workspace>
next: <optional one-line next step; the board renders it>
---
# <title>

<what the task is, why, and what "done" means>

## Progress log
- <YYYY-MM-DD>: <what happened, and the intended next step>
```

Recognized keys: `id`, `title`, `status` (required); `project`, `track`,
`opened`, `closed`, `session` (optional, acted on). Any other scalar (`priority:
high`, `size: L`) is an open tag: preserved, shown, not acted on. Status is one
of `backlog | in-progress | blocked | done`.

## Claim a task

Set `status: in-progress`, add `session: <your working branch>`, and append a
progress-log line. This marks the task in flight and names the owning branch.
Do the feature work on that branch; update the task file on `main` when status,
owning branch, or the progress log changes.

## Close a task

A task is done when its work **lands** (merges to `main`), not when the branch
is pushed. Then set `status: done` and `closed: <YYYY-MM-DD>`, and add a final
progress-log line.

## Comments split by append vs overwrite

Current-state facts (a priority, a size, a flag) are frontmatter tags,
overwritten in place. Narrative is body prose: the description for standing
context, `## Progress log` for the append-only dated thread. Never put lists or
threads in frontmatter; that is the one thing that would force a real YAML
parser.

## Board

`tracker/board.md` is generated, four sections (On deck, In progress, Blocked,
Done), one line per task keyed by title, in-progress lines naming the branch.
Never hand-edit it. Regenerate with `python3 scripts/build-board.py
tracker/tasks tracker/board.md` (or `npm run tracker-board`) and commit it
alongside the task change.

## Boundary with web-tools-conventions

This skill owns the tracker: the task-file format, the id scheme, and the
main-branch workflow. The `web-tools-conventions` skill owns the surfacing
layer: PR bodies, `[new]/[main]/[diff]` links, the merge guide, wrap-up. Both
touch post-merge handoff language ("follow-ups become tasks"); when the ask is
about a task file or the board, stay here; when it is about a PR, a caption, or
a merge-guide entry, use conventions (or `caption`).
