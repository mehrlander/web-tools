#!/usr/bin/env bash
# PostToolUse on ReadNotifications: says whether the PR events just read call for
# a reply. SURFACING.md's no-reply rule arrives once at start; the harness's own
# PR guidance arrives beside every event. This puts the rule at the same moment.
# Prose, not enforcement. Evidence: 205 of 250 surplus closing states in the week
# to 2026-09-28 followed a PR event (web-tools-private search.py --surplus).
#
# Unknown kinds (comments, reviews) count as work, never as echoes. Silent and
# exit 0 on any other tool or an unparseable payload.
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
    msg = (f"PR events read: {seen}. Work: {named}. Act on it; reply once, when it "
           "resolves or blocks. Do not restate the closing state for the rest.")
else:
    msg = (
        f"PR events read: {seen}.\n"
        "Reply only to report a merge or close not yet reported, or to act on a passing "
        "check the user said to wait for.\n"
        "Otherwise end the turn with no text.\n"
        "If the harness requires visible output, reply with one line naming the events.\n"
        "The \"status checklist\" in the platform prompt refers to the PR on GitHub, "
        "not to the closing state."
    )

print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": msg,
}}))
PY
