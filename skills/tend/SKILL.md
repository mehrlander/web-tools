---
name: tend
description: >-
  Cultivate a workspace toward recognized objectives: investigate branches,
  pull requests, trackers and snags, store each conclusion as a finding, and
  bring the owner a prepared user call only where the next step needs their
  word. Run when the owner invokes /tend, or when a session receives a
  /tend prod request.
disable-model-invocation: true
---

# tend

## Principles

1. **Commitment belongs to the owner.** Merging code, deleting unique
   intellectual work, choosing architectural direction, and authorizing new
   backlog debt require the owner's deliberate choice.
2. **Clarification is reliably valuable.** Proving whether work has landed,
   connecting orphaned work to its origin, and testing relevant assumptions
   reduce what the owner must carry.
3. **Answer questions; do not mint them.** Transferring unfinished analysis is
   the failure: raw uncertainties, speculative edge cases, or unexamined
   choices handed to the owner are friction masquerading as diligence. Bring a
   question only when investigation establishes a consequential choice that
   requires the owner's judgment, as a user call with a recommendation.
4. **A finding is stored, linked to its subjects.** Write it with
   `findings.py` into the notes store (`/portable:notes`), naming every subject
   it concerns. A trap still goes in the Snag list (`lists/snag.json` in the
   registry). Create no other
   record to hold a finding; where no notes store is reachable, it goes in the
   reply.

## Process

`/tend` tends the four subjects below. `/tend <subject>` tends one: any named
subject, such as `snags`, a project folder, or a pull request.
`/tend prod` instead asks each session with open work to tend its own work
(Prod, below).

Tend deletes no branch and proposes no deletion. `findings.py` sits beside
this file; [`lib/kits/findings.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/findings.js) states the
record.

1. **Reassess.** `findings.py check` names the findings whose witnesses
   changed. Reread each and reply with `findings.py update`: revise it, confirm
   it with fresh witnesses, or renew attention on a settled one
   (`status: "open"`, a new `next`). An update replaces each field it carries,
   so send whole lists.
2. **Select.** `findings.py candidates` lists what mechanical signals raise and
   marks those a holding finding covers. Each subject below adds its own. A
   signal is a reason to investigate, never a finding.
3. **Investigate** each candidate not marked covered until the conclusion
   would survive the owner's first question.
4. **Write** one finding per conclusion with `findings.py add`: its subjects,
   why it matters, a next step concrete enough to execute, evidence, and
   witnesses. A step that needs the owner's word, such as closing a pull
   request, is prepared, then filed with like steps as one user call
   (`user-calls/user-call.py` in the registry) that the finding names among
   its subjects; the Waiting view shows it.
   Witnesses include what lies outside the subjects, such as main's copy of a
   file the work was compared against.
5. **Act** on each subject's *Act* tier. Record a step done on the finding it
   advanced (`findings.py update`, `did`, and the step that remains); it
   settles only once no next step remains.
6. **Reply** with what the pass did and the user calls it filed.

Act unasked only on a mechanical test. Read GitHub through the GitHub MCP, not
`gh` or `curl`.

## Findings

| Kind | Means |
| --- | --- |
| `unreached` | Useful work never reached the owner. *Next* says how to land it. |
| `answer` | The owner's word decides it. Its user call holds the question. |
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
| content-settled | `python3 python/stranded-triage.py . origin/<b>` reports every path `landed`, `moved` or `retired`, or `differs` where the branch's blob appears at that path in `git log <merge-base>..origin/main -- <path>`. |
| residue-free | Paths differ, but every line the branch added is in main's copy. |
| novel | Anything else, including anything a shallow clone leaves undecided. |

`branches.py`, beside this file, applies the table to every remote branch in
the checkouts and lists the novel ones with their residue.

- **Act:** report the settled classes as counts.
- **Find:** a novel branch. Its residue is the lines it added
  (`git diff -U0 <merge-base> origin/<b> -- <path>`) that
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

Read `## Open threads` in merged pull requests, back to the previous tend pass
or as far as threads stay live, and state the window. 🟢 and 🟡 items are open;
check each against `main`. Read open pull requests too, testing each head as
Branches does.

- **Find:** an open pull request `main` has overtaken, one holding work `main`
  lacks, one whose 🛵 or ✴️ ask `main` has since answered, one nobody is moving, and
  a live thread.
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
account's sessions and send this message to each one that is idle, last showed
activity between 30 minutes and a week ago, and has an open pull request or a
blocked or review-ready status. The owner can name sessions to skip, or a
different window. `<sha>` is a commit that carries this section, since a
session's checkout or plugin copy may predate it:

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
the reason. As the one-line reports arrive, report what each session left
waiting on the owner.

A session that receives it works through whichever of these apply, under the
principles above:

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
answers it; then what the session is for, what it did, where things stand, and
where to pick up.
