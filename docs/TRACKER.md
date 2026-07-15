# Project tracker

Cross-session memory for the work of a workspace: what is planned, in flight, blocked, and done, in a form the next session can read. Tracker state lives on `main`. That is the point: one shared place every session knows to check. Canonical source `mehrlander/web-tools` at `docs/TRACKER.md`; local `CLAUDE.md` sets placement and the board command.

Prose style: no em dashes. Use colons, commas, semicolons, or new sentences.

## Why

Short-lived branches and sessions cannot see each other. Without a durable list on `main`, every session re-derives the plan from chat, and progress is lost when the context window closes. The tracker is where the plan lives between sessions, so the next session starts where the last one stopped.

## The model

Two kinds of file, both on `main`:

- `tasks/NNNN.md`: one file per task, the source of truth.
- `board.md`: a rollup generated from the task files, never hand-edited.

Feature work rides its branch as usual. Do not carry tracker changes on feature branches: task files and `board.md` are committed directly to `main`. That is what makes the tracker shared: every session knows where to look.

Scope a tracker to a workspace, a bounded area you keep coherent across sessions. A repo may have several (nested or sibling), each in its own directory; a repo whose work is coherent uses one.

## Task file schema

Two layers. A small closed set of recognized keys drives the tooling; an open set of arbitrary scalar tags rides along, preserved and human-readable, ignored by the generator until promoted.

**Recognized keys.** `id`, `title`, and `status` are required. `project`, `track`, `opened`, `closed`, and `session` are optional and recognized: the generator acts on them when present. The body is the task.

**Task id.** The `id` is a filing handle: it names the task file (`<id>.md`) and nothing reads it as a number, since tasks are referred to by title. Mint it as a date plus a short random suffix, `YYYYMMDD-rrr` (three lowercase base36 characters), for example `20260715-k4p`. The date sorts files roughly chronologically; the random suffix is what keeps two sessions from colliding when they file at the same time. Do not use a sequential integer: two sessions each reading `main` and picking "the next free number" pick the same one, and the merge that lands second silently drops one task (see Conflicts). Mint one with:

```
python3 -c "import random,string,datetime;print(datetime.date.today().strftime('%Y%m%d')+'-'+''.join(random.choices(string.digits+string.ascii_lowercase,k=3)))"
```

Legacy integer ids (`0001`) are left as they are: still valid handles, keyed by title like any other. Only new tasks take the dated form.

**Parser contract.** Frontmatter is flat `key: value` pairs, split on the first colon, scalars only. No YAML library, no lists, no nesting, no multi-line values. Unknown keys are preserved and ignored, never errors. This is deliberate: a file arriving from any channel (a web edit, a paste) needs no valid YAML to parse, so imperfect input degrades to an ignored tag rather than a failure. It is a feature, not a limitation to fix.

**Open tags.** A session may add any scalar key it likes (`priority: high`, `size: L`, `owner: marcus`) with no predefinition. Open tags are preserved, shown to a human, and not acted on by the generator.

**Graduation rule.** A tag starts open. It becomes recognized only when it earns it: when grouping or sorting the board by it is worth the code. Then you teach the generator that one key. The schema grows by evidence, not up front. Define only what the machine needs; leave the rest open.

```markdown
---
id: YYYYMMDD-rrr    # date + 3 random base36 chars; see Task id
title: <short imperative>
status: backlog | in-progress | blocked | done
project: <workspace or partition>   # optional, recognized
track: anchor | independent | depends-on:<id>   # optional, recognized
opened: YYYY-MM-DD
closed: YYYY-MM-DD    # set when done
session: <branch>     # set while in-progress
priority: high        # example open tag: not acted on until promoted
---
# <title>

<what the task is, why, and what "done" means>

## Progress log
- YYYY-MM-DD: <what happened, and the intended next step>
```

## Comments

A comment on a task splits by append vs. overwrite. Current-state comments (a priority, a size, a one-line flag) are scalar frontmatter tags, overwritten in place, so the file always shows the present value. Narrative and accumulating comments are body prose: the description for standing context, the `## Progress log` for the append-only dated thread, including what is next. There is no separate note file, and lists and threads stay out of frontmatter: that is the one thing that would force a real YAML parser, and the body already does it better.

## Claiming a task

To take a task, edit its file on `main`: set `status: in-progress`, set `session: <your branch>`, and add a progress-log line. Regenerate `board.md` and commit the task file and board to `main`. `main` now shows the task is in flight and which branch owns it. Do the feature work on your branch. Update the task file on `main` when the status, owning branch, or progress log changes, and set `status: done` with `closed:` when it lands.

## Board format

`board.md` is generated from the task files, four sections in order:

- **On deck** (`status: backlog`)
- **In progress** (`status: in-progress`), each line naming the owning branch from `session`
- **Blocked** (`status: blocked`)
- **Done** (`status: done`)

One line per task, keyed by title (not id); in-progress lines also show the owning branch. The reference generator also renders an optional `next` tag if a task carries one, an open tag it tolerates but the schema does not feature. The board is a faithful projection of the task files: any generator that emits these four sections from the frontmatter is a correct implementation. Regenerate and commit `board.md` with any commit that changes what the board shows: status or owning branch.

The canonical generator is [`scripts/build-board.py`](../scripts/build-board.py) (python3, stdlib only, zero dependencies). Any implementation that emits the four sections from the frontmatter is correct; reimplement freely.

```
python3 scripts/build-board.py <tasks_dir> <board_out>
```

A consuming repo can fetch the script by raw URL into a gitignored path and run it against each tracker (see [PORTABLE.md](PORTABLE.md) for the fetch pattern).

## Conflicts

Each session should edit only the task file it owns, so task conflicts should be rare. If two sessions edit the same task file, resolve that file as real content.

The collision that is not rare is two sessions **filing** at once. With sequential integer ids they pick the same next number, so each creates the same filename with different content. Nothing warns the first pusher: a fast-forward push raises no conflict, and the add/add only surfaces at the second session's merge, where it is resolved in that session's favor and the earlier task drops from `main`. The dated random-suffix id above is the fix: two independently minted ids do not collide, so concurrent filings land as two separate files with no contact.

`board.md` is generated. If it conflicts, take either side and regenerate it. A concurrent filing still leaves the board stale (each side regenerated it against a partial set of task files), so rerun the generator after resolving; that is the same benign generated-file case.

## Conventions

- Refer to a task by its title, not its id. The id is a filing handle for filenames and the board; it means nothing to a reader who did not write the task.
- Make a task for work that must survive across sessions, not for every edit.
- When a tracker exists, the post-merge handoff collapses to "check the tracker and assess how to proceed." Follow-ups become tasks instead of riding forward in chat. Keep the full diagnostic handoff for repos without a tracker, and for one-off issues not worth a task.

## One logging axis

The surfacing course logs by PR (a unit of delivery); the tracker logs by task (a unit of intent). Pick one as the primary log. Running both produces two records that drift. For solo, topic-driven work the task is the more natural unit. The tracker is independent of the surfacing primitives and the course; adopt it alone or alongside either.

## Extension points (set in local CLAUDE.md)

- **Placement:** where trackers live (e.g. `projects/<name>/tracker/`, with an optional repo-root `tracker/` for repo-wide meta-work that belongs to no single project).
- **Board generator:** the command that regenerates `board.md`.
- **Registry:** an optional generated index of all trackers, for multi-tracker repos; single-tracker repos omit it.
