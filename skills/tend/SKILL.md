---
name: tend
description: >-
  Cultivate a workspace toward recognized objectives: investigate branches,
  pull requests, trackers and snags, store each conclusion as a finding, and
  list in the reply each prepared step that needs the owner's word. Run when
  the owner invokes /tend, or when a session receives a /tend prod request.
disable-model-invocation: true
---

# tend

## Principles

1. **Highlight options.** Significant decisions deserve preparation and
   attention, so that the owner can continue to recognize options for
   addressing problems.
2. **Prepare the calls.** Tending advances toward moments of commitment, where
   paths diverge and it is time to choose. It is time to choose once work
   reasonably helpful to all paths, or to the decision itself, is exhausted.
3. **Clarification is reliably valuable.** Proving whether work has landed,
   connecting orphaned work to its origin, and testing relevant assumptions
   reduce what the owner must carry.
4. **Resolve loose ends.** Tending aims to simplify, not expand, what remains
   to wrap up a session.

## Process

`/tend` tends the four subjects below. `/tend <subject>` tends one: any named
subject, such as `snags`, a project folder, or a pull request.
`/tend prod` instead asks each session with open work to tend its own work
(Prod, below).

Tend deletes no branch and proposes no deletion. `findings.py` sits beside
this file; [`lib/kits/findings.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/findings.js) states the
record.

1. **Reassess.** Reread each open finding. `findings.py check` lists them,
   each with the subjects that changed since its last update. Pull request
   updates and branch pushes come from web-tools-private's
   `state/activity.json`. File commits come from the checkouts beside
   web-tools-private. `check` names any checkout too shallow to read. Reply
   with `findings.py update` where a finding changed, or where a subject did
   and the finding still holds (`"finding": {}` confirms it). Send each list
   whole: an update replaces every field it includes.
2. **Select.** `findings.py candidates` lists what mechanical signals raise.
   It marks a candidate covered when a finding names its branch or pull
   request. It marks a covered one for reassessment when that subject
   changed after the finding's last update. Give a settled finding that needs
   work again `status: "open"` and a new `next`. Each subject section below
   adds its own signals.
3. **Investigate** each candidate not marked covered until the conclusion
   would survive the owner's first question.
4. **Write** one finding per conclusion with `findings.py add`: its subjects,
   why it matters, a next step concrete enough to execute, and evidence.
   Prepare a step that needs the owner's word, such as closing a pull
   request, for the list in step 6. For a next step that is new work, rather
   than landing work that exists, ask in the reply whether to file it as a
   task or drop it; either answer settles the finding.
   Name as subjects the files the conclusion rests on, including those
   outside the work, such as main's copy of a file the work was compared
   against. Name the narrowest file that holds the claim.
5. **Act** on each subject's *Act* tier. Record a step done on the finding it
   advanced (`findings.py update`, `did`, and the step that remains); it
   settles only once no next step remains.
6. **Reply** with what the pass did and its sidesteps: where the work did
   something other than what the owner asked. List each step that needs the
   owner's word with its recommendation and, for a pull request, a link to
   its branch view, and offer one answer that accepts every recommendation.

Act unasked only on a mechanical test. Read GitHub through the GitHub MCP, not
`gh` or `curl`.

## Findings

| Kind | Means |
| --- | --- |
| `unreached` | Useful work never reached the owner. *Next* says how to land it. |
| `answer` | The owner's word decides it; ask for it in the reply. |
| `overlap` | Separate efforts could be brought together. *Next* says how. |
| `superseded` | The work landed or was overtaken elsewhere. *Evidence* names where. |

The kinds are provisional; add one to `KINDS` in `findings.py` when none fits.

## Branches

If `git rev-parse --is-shallow-repository` prints `true`, run
`git fetch --unshallow origin` first. Then `git fetch origin --prune`. The first test a branch passes names
its class:

| Class | Test |
| --- | --- |
| open | `head.ref` of an open pull request. Read under Pull requests. |
| merged-tip | Tip SHA equals `head.sha` of a merged pull request. |
| closed-tip | Tip SHA equals `head.sha` of a pull request closed without merging. |
| ancestor | `git rev-list --count origin/<b> --not origin/main` prints `0`. |
| orphan | `git merge-base origin/<b> origin/main` prints nothing. |
| content-settled | `python3 python/stranded-triage.py . origin/<b>` reports every path `landed`, `moved` or `retired`, or `differs` where the branch's blob appears at that path in `git log <merge-base>..origin/main -- <path>`. |
| residue-free | Paths differ, but every line the branch added is in main's copy. |
| novel | Anything else, including anything a shallow clone leaves undecided. |

[`branches.py`](branches.py), beside this file, applies the table to every
remote branch in the checkouts, old ones included. Its list names the novel and orphan branches,
each novel one with its residue. It marks a novel branch covered or for
reassessment as step 2 describes, matching a finding's `owner/repo@branch`
subject.

- **Act:** report the settled classes as counts, and orphan branches by name.
- **Find:** a novel branch not marked covered. Its residue is the lines it
  added (`git diff -U0 <merge-base> origin/<b> -- <path>`) that
  `git show origin/main:<path>` lacks. Name its origin (`Claude-Session`
  trailer, session record, or pull request) as a subject. Branches share a
  finding when they share its conclusion, whichever session made them.

## Trackers

The `tasks` skill owns every tracker rule. Read tasks from `origin/main`, and read each open task's
premises against the tree, not only its body.

- **Act:** close a task whose `## Done when` a merged pull request meets; add
  `## Related` entries; drop a `depends-on:` id that is done or missing.
- **Find:** a stale `in-progress` claim (`in-flight` skill), a task the tree
  already satisfies, two tasks after one outcome.
- **Propose:** reframe, split, or supersede a task; file a new one.

## Pull requests

Read the open topics of sessions that ended since the previous tend pass, and
state the window. Each row of the registry's
[`state/session-topics.json`](https://github.com/mehrlander/web-tools-private/blob/background/state/session-topics.json)
is one session. Its `topic_status` holds the session's topics, with fields that
web-tools-private
[`sessions/topics/README.md`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/topics/README.md)
defines. Check
each open topic against `main` and against the pull requests its agenda lists
under `prs`. Read open pull requests too, testing each head as Branches does.

- **Act:** mark an open topic done when all three hold:
  1. its `basis` is `closing` or `model`;
  2. its agenda lists at least one pull request, and each has merged;
  3. no such pull request's body lists an item under `## Open threads`.

  Append the status with [`topic_correct.py`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/tools/topic_correct.py) from
  a web-tools-private checkout. The row's key is `<short>`, and the topic's
  name is `<name>`:
  `python3 sessions/tools/topic_correct.py status <short> --by tend --topic "<name>" --status done`.
- **Find:** an open pull request `main` has overtaken, one holding work `main`
  lacks, one whose 🛵 or ✴️ ask `main` has since answered, one nobody is moving,
  and one that sidesteps an ask.
- **Find:** an open topic whose pull requests have no commit since the previous
  pass, and an open topic that lists no pull request.
- **Propose:** in the pass's user call, `dropped` for an open topic whose work
  `main` or another session's topic has since done.
- **Owner only:** design direction; closing or merging any pull request. Do
  not edit merged bodies.

## Snags

Snags are the Lists view's Snag list (`lists/snag.json` in the registry). How many dates an item's `seen` holds orders the
reading and triggers nothing.

- **Act:** log a trap this pass hits, as an item or as a date on the item that
  owns it.
- **Find:** a snag that still bites (no task cites its id, its entry records no
  fix in place), and items whose titles name the same trap.
- **Propose:** a task for a snag that still bites.

## Prod

`/tend prod` asks each session with open work to tend its own work. List the
account's sessions and take each one that is idle, last showed activity
between 30 minutes and a week ago, and has an open pull request, a blocked
or review-ready status, or a last reply that closed on
[❇️ or 🟢](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#every-reply).
A message to
a session idle for more than 55 minutes
makes it write its whole context to the prompt cache again
([`docs/environment/container.md`](https://github.com/mehrlander/web-tools/blob/main/docs/environment/container.md#the-prompt-cache)).
Leave out a session idle that long whose usage record (`sessions/usage/` in
the session archive) puts `context_now` at 150,000 tokens or more, and list it
for the owner with that figure. Send every other session this message. The
owner can name sessions to skip, or a different window. `<sha>` is a commit
that carries this section, since a session's checkout or plugin copy may
predate it:

> The user in session <id> ran /tend prod. Tend this session's own work as
> the Prod section of the tend skill defines it (mehrlander/web-tools,
> skills/tend/SKILL.md at commit <sha>). Please proceed using your judgment.
> When finished, send session <id> one line: what changed, and what waits on
> the owner.

Add these lines where they apply. Show the owner the text of any other note
before sending it.

- **Main's checks:** a check failing on main's head, and where it is
  reported.
- **Reference:** `For reference: <paths>.`, documents that bear on the
  session's open work.
- **Connected work:** `Connected work: <session link> (<title>, <pull
  request>).`, another session's open work on the same files or question.
- **Restore:** the line below, for a session whose link is missing from every
  record's `agent_session` field in the session-record store
  (`/portable:sessions`).

> This session is missing from the session records in <store>. Invoke
> /portable:sessions. If that skill is unknown, recover the portable plugin as
> mehrlander/web-tools docs/environment/container.md describes under "If the
> installed plugin fails to load".

Then reply with the sessions messaged and the sessions skipped, each with its
title, its open work and the lines added to its message, and for a skipped one
the reason; then the sessions left out for their context, each with its
title, its open work and its `context_now`. As the one-line reports arrive,
report what each session left waiting on the owner.

A session that receives it works through whichever of these apply, under the
principles above:

- **Take the step a ❇️ or 🟢 closing named,** if the owner has not written since.
- **Land what is already approved,** up to a pull request ready to merge:
  merge main into the branch, fix conflicts and failing checks, sync the
  body.
- **Ripen the open decision:** one question, a recommendation, the evidence.
  Where cheap and reversible, build the recommended option on the branch as a
  commit of its own, so the owner's answer is keep or revert. Ripen only
  decisions already open.
- **Review documentation edits again,** even after an earlier pass: revise
  each against doc-craft and show it as its Review section directs.
- **Stand in for a hand check** the session asked the owner to make: a
  headless screenshot, a measurement at phone width, a test.
- **Mark where to pick up** when the work continues until the owner is
  satisfied, such as a page refined over many turns: what was built, how it
  stands against the latest request, and the next steps in order.
- **Write the resume point** in a long session, while the detail is still in
  context: in the pull request body if there is one, complete enough for a
  fresh session to continue from.

End the session's own reply with a recap for a reader coming back cold: what
waits on the owner, one question per decision, each linked to where the owner
answers it; then what the session is for, what it did and what it sidestepped,
where things stand, and where to pick up.
