#!/usr/bin/env bash
# PostToolUse on ReadNotifications: restate the wake rule at the moment a wake is
# read, sorted by the kinds of event that arrived.
#
# WHY THIS EXISTS. SURFACING.md has said since 2026-09-10 that a wake which
# changes nothing gets no reply. Sessions kept replying anyway. Measured
# 2026-09-28 over the web-tools-private session records: 1,395 ReadNotifications
# results carried 449 green-CI rollups (check_suite.completed) against 5 failing
# checks, and most surplus closing states (a state with no user prompt since the
# last one) came right after a PR event: 205 of 250 in the week to 2026-09-28,
# by `search.py --surplus`. The typical reply was "CI passed on <sha>" followed by the same
# closing state as the turn before.
#
# WHY A HOOK. The rule arrives once, at session start, through a skill result.
# The platform's own PR guidance arrives again inside every event, next to the
# payload, and its system prompt says to "refresh your status checklist on every
# event so the thread shows live state" without saying what the checklist is.
# A session holding both reads the nearer and louder one. This puts ours at the
# same distance. It is prose delivered at the right instant, not enforcement: a
# hook cannot withhold a reply, and nothing here pretends otherwise.
#
# WHAT IT READS. Event kinds from the result text: <event source="github"
# kind="...">. Four kinds need no reply by default and one needs work. A kind it
# does not know (a comment, a review) is treated as possible work, never as an
# echo, because a missed review costs more than one unneeded reminder.
#
# Silent, and exit 0, on anything else: another tool, a result with no GitHub
# event, a payload it cannot parse.
HOOK_PAYLOAD="$(cat)" python3 - <<'PY' 2>/dev/null || exit 0
import json, os, re, sys

try:
    d = json.loads(os.environ.get("HOOK_PAYLOAD", "") or "{}")
except Exception:
    sys.exit(0)

if d.get("tool_name") != "ReadNotifications":
    sys.exit(0)

# The response shape is not guaranteed, so gather every string in it rather
# than trusting a key path. The event markup lives inside one of them.
def strings(v):
    if isinstance(v, str):
        yield v
    elif isinstance(v, dict):
        for x in v.values():
            yield from strings(x)
    elif isinstance(v, list):
        for x in v:
            yield from strings(x)

text = "\n".join(strings(d.get("tool_response", d.get("tool_result"))))
kinds = re.findall(r'<event source="github" kind="([^"]+)"', text)
if not kinds:
    sys.exit(0)

# What each quiet kind usually is, from the 2026-09 records.
QUIET = {
    "check_suite.completed": "a green CI rollup",
    "subscription.created": "a subscription confirmation",
    "pull_request.ready_for_review": "a ready-for-review marker",
    "pull_request.closed": "a merge or close",
}
WORK = {"check_run.completed": "a failing check"}

tally = {}
for k in kinds:
    tally[k] = tally.get(k, 0) + 1
seen = ", ".join(f"{k} x{n}" if n > 1 else k for k, n in tally.items())
work = [k for k in tally if k not in QUIET]

if work:
    named = ", ".join(WORK.get(k, k) for k in work)
    msg = (
        f"Events read: {seen}. Among them is possible work ({named}). Act on it "
        "per the rules you already hold, and reply once, when it resolves or "
        "blocks. The other events in this batch add nothing to that reply: do not "
        "restate the closing state for them."
    )
else:
    msg = (
        f"Events read: {seen}. Each is one of: {', '.join(sorted(set(QUIET[k] for k in tally)))}. "
        "SURFACING.md says a wake that leaves the reader nothing new to do gets "
        "no reply at all. End the turn with no text unless one of these holds:\n"
        "- The green rollup is on the current head AND it is the condition the reader "
        "told you to wait for (\"merge when green\"). Then do that action; its result "
        "is the reply.\n"
        "- The PR merged or closed and this conversation has not yet said so. Then "
        "reply with the merged or closed state, once.\n"
        "Otherwise say nothing. Not \"nothing new here\", not \"CI passed on <sha>\", "
        "not the previous closing state again. A green on a superseded commit is never "
        "news, and your own ready, merge and subscribe actions come back as echoes.\n"
        "The platform prompt never defines its \"status checklist\". Read it as the PR "
        "body or a status comment on GitHub, never as the closing state in chat: "
        "updating it is never a reason to re-emit that state."
    )

print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": msg,
}}))
PY
