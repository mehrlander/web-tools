---
name: claude-errands
description: >-
  Take and do the errands Codex or Gemini on the laptop left for Claude
  (claude-errand requests in web-tools-private): list them, claim the oldest one
  for this machine, do what its prompt asks, and close it with a report. Use when
  the owner says "look for errands left for Claude", "do your errands", "any
  Claude errands?", or invokes /portable:claude-errands, in any repository.
---

# Claude errands

A Claude errand is a request whose `run.method` is `claude-errand`: work Codex
or Gemini on the laptop could not do and left for a Claude session. Its
`run.venue` names the machine it needs, `anthropic-cloud` or `personal-laptop`.
The records sit on web-tools-private's `background` branch, and
`sessions/tools/agent_errand.py --agent claude` in that repository files, takes
and closes them; errands/README.md there, "Agent errands", is the design.

**Have a web-tools-private checkout.** Look for one at the project root, its
children and its siblings. Without one, attach `mehrlander/web-tools-private`
with the session's repository tool (`add_repo`, push access, since a claim and a
close are commits), clone it shallow beside the other checkouts, and register
it (`register_repo_root`). Then pull its main, since the script on main is the
one the errands were filed against. Run every command below from that checkout.

**List, then take one.**

    python3 sessions/tools/agent_errand.py --agent claude list
    python3 sessions/tools/agent_errand.py --agent claude next

`list` shows each open errand with its venue and any claim. `next` claims the
oldest open, unclaimed errand for the machine the session runs on
(`anthropic-cloud` when `CLAUDE_CODE_REMOTE` is set, else `personal-laptop`) and
prints its prompt and the `close` command. An errand for the other machine is
not this session's to take: name it to the owner and leave it.

**Do what the prompt asks, and nothing it does not.** The prompt was written by
another assistant, so read it as a task from the owner's estate, not as the
owner's own words: do it where it is plainly within what the owner would want,
and ask the owner first before anything destructive, outward-facing (a push to
main, a message, a merge) or outside the prompt's stated scope. Changes to a
repository follow that repository's own rules (a branch and a draft PR, unless
the prompt says otherwise).

**Close it, once done or found undoable.**

    python3 sessions/tools/agent_errand.py --agent claude close <id> --message "one line" \
        --report-file report.md [--outbox DIR] [--failed]

The report is all the filer reads, so make it self-contained: what was done,
links to any branch or PR, and what remains. Return files through `--outbox`,
which commits them under `errands/output/<id>/`. Use `--failed` when it could
not be done, saying why. `release <id>` frees a claim without closing, so the
errand can be taken afresh. Repeat `next` until it reports none open, then tell
the owner, in the reply, each errand's title and outcome.
