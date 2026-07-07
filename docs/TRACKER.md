# Project tracker (portable)

The cross-session memory layer for the *work* of a workspace: what is planned, in flight, blocked, and done, in a form the next branch can read. Opt-in and independent of the surfacing primitives and the surfacing course; adopt it alone or alongside either. Canonical source `mehrlander/web-tools` at `docs/TRACKER.md`; local `CLAUDE.md` sets the extension points and overrides these defaults. Substitute the current repo into all path examples.

**Prose style:** zero em dashes. Use colons, commas, semicolons, parentheses, or new sentences.

## Purpose

Short-lived branches and sessions cannot see each other. Without a durable list, every session re-derives the plan from chat, and progress evaporates when the context window closes. The tracker is the slow layer where the plan lives between sessions, so the next branch starts where the last one stopped. It is to *work* what a voice or identity doc is to *style*.

## The model

One file per task under `tasks/` is the source of truth; a generated `board.md` is the rollup and is never hand-edited. The shape is deliberately a folder of source files plus a generated index.

Scope a tracker to a **workspace**: a bounded area you actively develop and keep coherent across sessions, not the whole repo. Several workspaces means several trackers, each in its own directory. A tracker never grows to cover the repo.

## Task file schema

Frontmatter (fields optional when not relevant); the body is the task.

```markdown
---
id: NNNN
title: <short imperative>
status: backlog | in-progress | blocked | done
project: <workspace or partition>
track: anchor | independent | depends-on:NNNN
opened: YYYY-MM-DD
closed: YYYY-MM-DD    # set when done
session: <branch>     # set while in-progress; names the owning branch
next: <the intended next step>
---
# <title>

<what the task is, why, and what "done" means>

## Progress log
- YYYY-MM-DD: <what happened this session>
```

## Board format

`board.md` is generated from the task files, four sections in order:

- **On deck** (`status: backlog`)
- **In progress** (`status: in-progress`), each line naming the owning branch from `session`
- **Blocked** (`status: blocked`)
- **Done** (`status: done`)

One line per task, keyed by **title** (not id); in-progress lines also show the owning branch, and any line may carry its `next`. The board is a faithful projection of the task files: any generator that emits these four sections from the frontmatter is a correct implementation.

Reference generator (python3, stdlib only; reference, reimplement freely):

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

## The durable-status rule (the crux)

In-flight status must land on a **durable shared surface**, so the board is authoritative across branches, not just within one. Claiming a task means: set `status: in-progress` and `session: <branch>`, append a progress-log line, and commit *that claim* to the shared surface **out of band**, separately from the feature work. The feature work rides its branch as usual; only the tracker status lands on the shared surface, so one place shows what is in flight and which branch owns it. Where that surface is (the default branch, a dedicated branch) is an extension point, not fixed here.

## The conflict rule

Each session edits only its own task file, so parallel branches never collide on task content. The one shared file is the generated `board.md`; a merge conflict there is not a real conflict, take either side and regenerate. Generated files are regenerated, never hand-merged.

## Referencing tasks

Refer to a task by its **title** (the work) in prose and handoffs, not its `NNNN` id. The id is a filing handle for filenames and the board; it means nothing to a reader who did not write the task.

## When to make a task

For work that must be remembered across sessions, not a quick edit you are finishing now. The backlog is for work that needs remembering, not a ledger of everything done.

## Relation to the surfacing course

The merge guide keys on the **PR** (a unit of delivery); the tracker keys on the **task** (a unit of intent). They cover the same logging need from different angles. Adopt **one** primary logging axis: running both in parallel produces two logs that drift. For solo, topic-driven work the task is the more natural unit. A repo can take the surfacing primitives and the tracker without the course, or the course without the tracker; all three layers are independent.

## Relation to the post-merge handoff

The post-merge handoff prompt (HP) is the trackerless form of this same cross-session handoff: it carries the next steps forward in chat because nothing durable holds them. When a tracker exists, follow-ups become tasks instead, and the HP collapses to "check the tracker and assess how to proceed." Keep the full diagnostic HP for repos without a tracker, and for one-off issues not worth a task.

## Extension points (set in local CLAUDE.md)

- **Status-claim channel:** the durable shared surface in-flight status lands on (the default branch out of band, a dedicated branch, and so on).
- **Placement:** where trackers live in the repo (e.g. `projects/<name>/tracker/`, with an optional repo-root `tracker/` for repo-wide meta-work that belongs to no single project).
- **Registry:** an optional generated index of all trackers in the repo, for multi-tracker repos; single-tracker repos omit it.
- **Board generator:** the command that regenerates the board.
