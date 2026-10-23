# Project tracker

Cross-session memory for the work of a workspace: what is planned, in flight, blocked, and done, in a form the next session can read. Tracker state lives on `main`: one shared place every session knows to check. Each repo's own `CLAUDE.md` sets placement and the registry.

**This file is the contract, not the instructions.** Read it to adopt a tracker, to write a second implementation of the generator, or to change the design. Every rule about *operating* a tracker (when to file, how to claim, how to close, how to push) has one owner, the [`tasks` skill](../skills/tasks/SKILL.md), which is what a session loads at the moment it acts.

Prose style: no em dashes. Use colons, commas, semicolons, or new sentences.

## The model

Three kinds of file, all on `main`:

- `tasks/<id>.md`: one file per task, the source of truth.
- `board.md`, with `board.csv` and `board-tags.csv` beside it: rollups generated from the task files, never hand-edited.
- `assessments/YYYY-MM-DD.json`: optional dated assessment records, authored judgment about the tracker as a whole (see Assessment and refinement below).

Feature work follows GitHub flow on a branch as usual. Tracker changes operate in Real-time mode: task files, assessment records, and the generated rollups are committed directly to `main` and pushed to GitHub as you go, which is what makes the tracker shared. That path is the standing exception to an instruction to keep commits on the feature branch, and nothing else about a repo's branch or PR flow changes; the skill carries the push recipe.

Scope a tracker to a workspace, a bounded area you keep coherent across sessions. A repo may have several (nested or sibling), each in its own directory; a repo whose work is coherent uses one.

## Task file schema

Two layers. A small closed set of recognized keys drives the tooling; an open set of arbitrary scalar tags rides along, preserved and human-readable, ignored by the generator until promoted.

**Recognized keys.** `id`, `title`, and `status` are required. `project`, `depends-on`, `opened`, `closed`, and `session` are optional and recognized: the generator acts on them when present. The body is the task.

```markdown
---
id: <slug>-<rrrrrr>    # interpretable slug + 6 random base36 chars; see Task id
title: <short imperative>
status: backlog | in-progress | blocked | done | dormant
project: <workspace or partition>   # optional, recognized
depends-on: <id>[, <id>...]         # optional, recognized; absent means none
opened: YYYY-MM-DD
closed: YYYY-MM-DD    # set when done
session: <branch>     # set while in-progress
size: XS | S | M | L | XL | ?   # optional, recognized
awaiting: <free text>           # optional, recognized
priority: high        # example open tag: not acted on until promoted
---
# <title>

<what the task is, why, and what "done" means>

## Related

- `path/to/file`: why this file matters for the task

## Done when

<observable condition>

## Progress log
- YYYY-MM-DD: <what happened, and the intended next step>
```


**Conventional body section: `## Related`.** After the opening problem statement (and after Scope / Notes if present), before `## Done when`, list the high-signal pointers a future session should open first. Keep `## Progress log` last. Each bullet is one pointer and one short clause of why it matters:

```markdown
## Related

- `path/to/file`: role in this task (edit surface, premise, test, hook)
- task `other-task-id`: sequencing or shared surface
- PR #123: change that restamped the premise
```

Rules: high-signal only (skip "might be related"); one line per pointer; grooming may append without rewriting the body; do not encode a product decision here (`awaiting:` and open questions stay elsewhere). Filing may omit Related when nothing is known yet; refining should add it when the connections are found.

**A path here must resolve, and a check enforces it.** The shape it keys on is the one the example shows: where a bullet opens with backticked tokens before its first colon, each is read as a repository path and must exist. A bullet opening with `task ` or `PR ` is a reference of another kind, and backticks after the colon are prose, so neither is path-checked; a path that does not exist yet can still be named after the colon. `node/test/tracker-tasks.test.mjs` holds this, and the same file holds the no-em-dash line above.

**A pointer leaving the prose moves here rather than disappearing.** A cross-reference can go stale in one sense and stay live in another: a sibling task that closed is no longer a dependency, and is still where the reasoning happened. Refinement that cuts such a reference out of a paragraph puts it in Related with its new status.

**Conventional body section: `## Done when`.** One or two sentences naming the observable condition that closes the task, stated so a later session can check it without rebuilding the argument. Because it is the exit and not a summary, **a task folded into another sends its exit condition along**, as a clause of the host's `## Done when`; a fold that leaves the exit behind retires a question nobody decided to retire.

**`## Progress log` is last, and appends at the bottom,** oldest entry first, so the end of the file is the newest state and "append-only" below means what it says. A file that still runs newest-first is migrated when next touched, rather than in a sweep. **Do not rewrite a dated entry** to restamp a fact; add a new entry that corrects it, so the log stays a record of what was believed when.

**Status carries two companion fields.** `session` names the owning branch while a task is `in-progress`; `closed` dates it when it goes `done`. A `done` task keeps `session` set to the branch that completed it, so the board can say where the work happened after the fact.

**`size` and `awaiting` answer questions `status` does not.** `status` says whether a session can start a task. `size` says how much work it is, and `awaiting` says what is holding it. The three are independent, which is why `awaiting` renders on a `backlog` row and not only on a `blocked` one: a task can be startable in part and still be waiting on someone for the rest. Both are silent on a `done` task, since a finished task's estimate and its old blocker are history.

Calibrate `size` to the session, the real unit of execution: **XS** folds into another task's pass, **S** is one session with room to spare, **M** is one full session, **L** is several, **XL** is a project. **`?`** means not specifiable yet, which is a state rather than a magnitude: the task needs a design pass before it can be sized, and saying so is more useful than guessing. Treat **XL as a smell** rather than a value, since a task that large is usually several outcomes under one title and wants a phase carved off; the `tasks` skill's rule against fragmenting one outcome runs both directions.

`awaiting` is free text and cleared by hand. Its natural values carry colons ("awaiting: OFM ruling: candidate 1"); the parser splits on the first colon, so they survive. When an open user call holds the decision, the line names it: `awaiting: user-call <call id>`. The Web Tools app's Board then links the task to that call in the Waiting view, and the call names the task back as a `task` link (web-tools-private `user-calls/user-call.py`). The line is cleared by hand once the call is answered, like any other value.

**Task id.** The `id` is a filing handle: it names the task file (`<id>.md`). Mint it as a short interpretable slug plus a random suffix, `<slug>-<rrrrrr>`, mirroring how a working branch is named (`fn-data-tracker-assessment-npjxbj`). The slug is a few lowercase hyphen-separated words drawn from the title, kept under about 40 characters, so a directory listing reads as a table of contents and a `depends-on` reference reads as a phrase. The six-character base36 suffix is what keeps two sessions filing at the same moment from colliding. Do not use a sequential integer (see Conflicts). The slug is frozen at filing: it is a handle, not a live summary, so if the title later changes, leave the filename and `id` as they are.

A tracker that still carries legacy ids (integers like `0001`, or the earlier dated form `20260716-8p0`) migrates them when a session next touches it: rename each `tasks/<old-id>.md` to a slug, set the file's `id` to match, update any `depends-on` reference to it, regenerate the rollups, and commit the renames to `main`. The generator keys on the filename, so a mixed directory works in the meantime.

**Parser contract.** Frontmatter is flat `key: value` pairs, split on the first colon, scalars only. No YAML library, no lists, no nesting, no multi-line values. Unknown keys are preserved and ignored, never errors. This is deliberate: a file arriving from any channel (a web edit, a paste) needs no valid YAML to parse, so imperfect input degrades to an ignored tag rather than a failure.

**Open tags.** A session may add any scalar key it likes (`priority: high`, `owner: marcus`, `risk: high`) with no predefinition. Open tags are preserved, shown to a human, and not acted on by the generator.

**Graduation rule.** A tag starts open. It becomes recognized only when it earns it: when grouping or sorting the board by it is worth the code. Then you teach the generator that one key. Define only what the machine needs; leave the rest open.

**Where comments go.** Current-state facts (a priority, a size, a one-line flag) are scalar frontmatter tags, overwritten in place, so the file always shows the present value. Narrative is body prose: the description for standing context, the `## Progress log` for the append-only dated thread. Lists and threads stay out of frontmatter, since that is the one thing that would force a real YAML parser, and the body already does it better.

### Two conventional open tags: `venue` and `action`

Both are open tags in the sense above, unrecognized by the generator and carried into `board-tags.csv`, so a consumer can select on either today. Promote either when grouping the board by it is worth the code, not before.

**`venue: <channel>` says where the session happens** (`cli`, `cowork`, `dispatch` or `daemon`). A task is parked on a venue when the work needs something only that machine has, such as data that must not leave it, a local model, a runtime, or an hour of unattended time. Absent means anywhere. It is a routing hint only; a parked task is claimed, discussed and closed like any other.

**`action: <name>` says the method is already settled.** Its value names a procedure the claiming session executes rather than designs, resolved the way an invocation of the same name resolves: the repo's own skills first, then the plugin's, with the `namespace:` prefix to disambiguate. There is no separate registry of actions. Such a task is written thin, and its parameters live in the body, not in frontmatter, since the parser takes scalars only and a parameter set is routinely a list.

Neither tag is a queue: nothing reads them to pick work up. A one-off piece of work for a machine is an errand ([manifest.md](manifest.md#errands-errandsrequests--errandsresults)), which names the task it serves in `for`. The [`tasks` skill](../skills/tasks/SKILL.md#file-a-runnable-task) carries the rules for filing a runnable task and its template.

## Board format

`board.md` is generated from the task files, four sections in order:

- **On deck** (`status: backlog`)
- **In progress** (`status: in-progress`), each line naming the owning branch from `session`
- **Blocked** (`status: blocked`)
- **Done** (`status: done`)

`status: dormant` renders on **no section at all**. It is preserved-but-not-surfaced: the task file and its history stay in `tasks/`, and the row still reaches `board.csv` so a consumer asked for it can find it, but a reader of the board never meets it. `blocked` and a parked `awaiting:` both say "not now" to a session while still asking to be read every pass; `dormant` says "do not bring this up". The operating rule that follows from it belongs to the skill, not here.

One line per task, each prefixed with the 🎫 task marker, keyed by title (not id); in-progress lines also show the owning branch. Nothing else: an open tag is never rendered, per the two-layer rule above.

**The title is a link to the task file**, `🎫 [title](tasks/<file>.md)`, so the board is a table of contents: the row says what the work is and one tap reaches the file. The href is relative to the **board's** folder, the one base both consumers resolve against (GitHub rendering `board.md` in place, and the Web Tools app's board pane), and it targets the file on disk rather than the `id` field, so a task whose id drifted from its filename still links to something that exists. A task's next step belongs in its Progress log, never in a frontmatter key. The board is a faithful projection of the task files. Regenerate and commit both rollups with any commit that changes what the board shows: status, owning branch, or an unmet dependency.

**Dependencies render only while they bite.** A task carrying `depends-on: <id>[, <id>...]` shows ` (needs: <blocker title>)`, resolved to each blocker's title because the id means nothing to a reader who did not write the task. Several unmet blockers join with `; `. The line is suppressed once a dependency is settled (`done` or `dormant`) and on a settled task, whose dependency is history either way. A `depends-on` pointing at an id no task file defines renders as such rather than silently vanishing, since a dangling reference is the one case worth interrupting for.

The value is a **comma-separated scalar, not a YAML list**, per the parser contract above. **Absence means no dependency**, so there is no value meaning "independent".

### The typed projection

The same run writes **`board.csv`** and **`board-tags.csv`** beside `board.md`.

| | Reader | Carries |
| --- | --- | --- |
| `board.md` | a session reading files, GitHub, a diff, a clone, chat | the human list, portable, no token needed |
| `board.csv` | the Web Tools app, and anything else machine-side | every recognized field per task, unrendered |
| `board-tags.csv` | the same, for anything selecting on an unpromoted key | one row per (task, tag) pair |

`board.md` is not optional and does not go away.

The two-layer split survives as the file split: `board.csv` holds one row per task with a fixed column for each recognized key, and `board-tags.csv` holds one row per (task, tag) pair, joined on the task's `id`. Promoting a tag means giving it a column in `board.csv` and taking it out of the bag.

The board adds three derived values the task file does not state:

- **`href`**, the same board-relative link the markdown row uses.
- **`lastActivity`**, the newest date in the progress log. Empty when a task has no log rather than falling back to `opened:`, since a guess here reads as a fact.
- **`logEntries`**, the count beside it. The count is mechanical; classifying an entry as work or maintenance is judgment and stays out.

No artifact carries a timestamp, so the same input produces the same bytes and the gates that re-run the generator against a clean tree do not fail on every run. `board-tags.csv` is written even when nothing is tagged, header and no rows, since a check that compares bytes needs the file to exist either way.

The generator ships with the `portable` plugin as `tasks/build-board.py` (python3, stdlib only, zero dependencies). It is one canonical implementation, so every tracker's board comes out the same shape and a repo does not write its own. A repo running without the plugin fetches that same tracked script from its [raw GitHub path](https://raw.githubusercontent.com/mehrlander/web-tools/main/skills/tasks/build-board.py) into a gitignored location; it is the same file reached by a different transport, not a reimplementation. The skill carries the invocation.

## Assessment and refinement

Two operations read the whole tracker rather than one task, and they are distinct on purpose:

- **Assessment interprets.** It reads the tracker as a whole and renders judgment: the workstreams the open tasks form, framing that has fallen behind the work, decisions hiding inside tasks, differences in scale and readiness, bundles that would travel together, and good next-session candidates. It recommends and does not mutate.
- **Refinement mutates.** It restores scope truth in the task files: closing stale or superseded tasks, reframing inaccurate ones, narrowing residual work, splitting or consolidating where justified.

Neither obligates the other: a refinement pass does not owe an assessment record, and an assessment commits no one to acting on it. The [`tasks` skill](../skills/tasks/SKILL.md) carries the operating rules for both, including the permission boundary between them; what belongs here is the record.

### The assessment record

An assessment worth keeping is written to `assessments/YYYY-MM-DD.json` beside `tasks/`, committed to `main` like all tracker state. Add a `-slug` suffix only when a second record lands the same day.

The record is **authored judgment anchored to a repository state, and it is a historical record**: not task truth, not a generated projection, never regenerated. Task ids it names may close, rename, or change meaning after it is written, and that is aging, not error: read a past assessment against `basis.commit`, and supersede it with a newer assessment rather than editing it.

**The `tracker-assessment/1` contract** is small, and stays small the way the task schema does: by graduation, not anticipation. Four keys are required:

```json
{
  "schema": "tracker-assessment/1",
  "assessedAt": "<ISO 8601 timestamp>",
  "basis": { "repository": "<owner/repo>", "commit": "<sha of main as read>" },
  "summary": "<the assessment in one paragraph>"
}
```

Everything else is an open, authored section, the record-level analogue of an open tag. The sections in use so far: `workstreams` (task groupings, each with an assessment and a next move), `hygiene` (per-task scope-truth findings, each naming an action and a reason; refinement's natural worklist), `decisions` (rulings tasks are waiting on), `dispatch` (ready-to-launch session briefs, each with a why and a full prompt), and `watch` (tasks noted without action). These are conventions, not contract: a reader tolerates their absence and their variation, and a key hardens into the contract only when a consumer earns it. Judgment stays prose inside whatever structure a section needs; do not add fields because JSON permits them.

**Do not copy what the task files and `board.csv` already carry.** Titles, statuses, sizes, and logs live in the tasks; the record cites ids and states judgment about them. `basis` may carry the open counts as read (`onDeck`, `inProgress`, `blocked`) to fix the scale of what was assessed; that is an anchor, not data for a consumer.

The board generator does not read `assessments/`, the board does not render them, and no gate owns them: an authored record has no source to be held to. What is checked is only the identity and the four required keys (web-tools: `node/test/tracker-assessments.test.mjs`).

## Conflicts

Each session should edit only the task file it owns, so task conflicts should be rare. If two sessions edit the same task file, resolve that file as real content.

The collision that is not rare is two sessions **filing** at once. With sequential integer ids both create the same filename with different content; nothing warns the first pusher, and the add/add surfaces only at the second session's merge, where the earlier task drops from `main`. The random suffix in the id prevents it: concurrent filings land as two separate files.

`board.md` is generated. If it conflicts, take either side and regenerate it. A concurrent filing still leaves the board stale (each side regenerated it against a partial set of task files), so rerun the generator after resolving; that is the same benign generated-file case.

## Across repositories

Trackers are scoped to a workspace and sessions to a repository, so a session working in one repo routinely learns something that makes a task in another repo's tracker wrong. The [`tasks` skill](../skills/tasks/SKILL.md#another-repos-tracker) carries the rules for correcting and filing there and for naming another repo's material.

`depends-on` does not cross a tracker. It resolves against task files in one `tasks/` directory, so a dependency on another repo's task is named in prose, by repo and title, not by id.

## One logging axis

A PR body logs by PR (a unit of delivery); the tracker logs by task (a unit of intent). Pick one as the primary log. Running both produces two records that drift. For solo, topic-driven work the task is the more natural unit. The tracker is independent of the conversation rules; adopt it alone or alongside them.

## Extension points (set in local CLAUDE.md)

- **Placement:** where trackers live (e.g. `projects/<name>/tracker/`, with an optional repo-root `tracker/` for repo-wide meta-work that belongs to no single project).
- **Registry:** an optional generated index of all trackers, for multi-tracker repos; single-tracker repos omit it.

The board generator is not an extension point: it ships with the plugin as one canonical script (above), so placement is the only per-repo choice about the board.
