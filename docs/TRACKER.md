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

**Parser contract.** Frontmatter is flat `key: value` pairs, split on the first colon, scalars only. No YAML library, no lists, no nesting, no multi-line values. Unknown keys are preserved and ignored, never errors. This is deliberate: a file arriving from any channel (a web edit, a paste) needs no valid YAML to parse, so imperfect input degrades to an ignored tag rather than a failure. It is a feature, not a limitation to fix.

**Open tags.** A session may add any scalar key it likes (`priority: high`, `size: L`, `owner: marcus`) with no predefinition. Open tags are preserved, shown to a human, and not acted on by the generator.

**Graduation rule.** A tag starts open. It becomes recognized only when it earns it: when grouping or sorting the board by it is worth the code. Then you teach the generator that one key. The schema grows by evidence, not up front. Define only what the machine needs; leave the rest open.

```markdown
---
id: NNNN
title: <short imperative>
status: backlog | in-progress | blocked | done
project: <workspace or partition>   # optional, recognized
track: anchor | independent | depends-on:NNNN   # optional, recognized
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

Reference generator (python3, stdlib only; reimplement freely):

```python
#!/usr/bin/env python3
# Regenerate board.md from tasks/*.md. Frontmatter is flat `key: value` pairs.
import pathlib, sys

tasks_dir = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "tasks")
out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "board.md")

def meta(p):
    parts = p.read_text().split("---")
    if len(parts) < 3:
        return {}
    d = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            d[k.strip()] = v.strip()
    return d

tasks = [meta(p) for p in sorted(tasks_dir.glob("*.md"))]
buckets = {"backlog": [], "in-progress": [], "blocked": [], "done": []}
for m in tasks:
    buckets.get(m.get("status", "backlog"), buckets["backlog"]).append(m)

def row(m):
    who = f" (`{m['session']}`)" if m.get("session") else ""
    nxt = f" next: {m['next']}" if m.get("next") else ""
    return f"- {m.get('title', '(untitled)')}{who}{nxt}"

lines = ["# Board", "", "_Generated from tasks/. Do not hand-edit._", ""]
for head, key in [("On deck", "backlog"), ("In progress", "in-progress"),
                  ("Blocked", "blocked"), ("Done", "done")]:
    lines.append(f"## {head}")
    lines += ([row(m) for m in buckets[key]] or ["- (none)"])
    lines.append("")
out.write_text("\n".join(lines))
```

## Conflicts

Each session should edit only the task file it owns, so task conflicts should be rare. If two sessions edit the same task file, resolve that file as real content.

`board.md` is generated. If it conflicts, take either side and regenerate it.

## Conventions

- Refer to a task by its title, not its `NNNN` id. The id is a filing handle for filenames and the board; it means nothing to a reader who did not write the task.
- Make a task for work that must survive across sessions, not for every edit.
- When a tracker exists, the post-merge handoff collapses to "check the tracker and assess how to proceed." Follow-ups become tasks instead of riding forward in chat. Keep the full diagnostic handoff for repos without a tracker, and for one-off issues not worth a task.

## One logging axis

The surfacing course logs by PR (a unit of delivery); the tracker logs by task (a unit of intent). Pick one as the primary log. Running both produces two records that drift. For solo, topic-driven work the task is the more natural unit. The tracker is independent of the surfacing primitives and the course; adopt it alone or alongside either.

## Extension points (set in local CLAUDE.md)

- **Placement:** where trackers live (e.g. `projects/<name>/tracker/`, with an optional repo-root `tracker/` for repo-wide meta-work that belongs to no single project).
- **Board generator:** the command that regenerates `board.md`.
- **Registry:** an optional generated index of all trackers, for multi-tracker repos; single-tracker repos omit it.
