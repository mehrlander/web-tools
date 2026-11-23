#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit): refuse a daisyUI stat card (html-style
# rule 1) at the moment it would be written. Engine: stat-cards.py beside this
# file. Same shape as reading-column-guard.sh, whose header gives the argument:
# the hook judges the RESULT of the pending edit, so a file that already carries
# a stat card cannot be edited until it is clean, a fixing edit always passes,
# and `stat-card-ok` on the line is the countable opt-out.
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" \
HOOK_PAYLOAD="$(cat)" python3 - <<'PY'
import importlib.util, json, os, sys

engine = os.path.join(os.environ.get("HOOK_DIR", ""), "stat-cards.py")
try:
    spec = importlib.util.spec_from_file_location("stat_cards", engine)
    sc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sc)
except Exception:
    sys.exit(0)  # engine missing or broken: never block on our own fault

try:
    d = json.loads(os.environ.get("HOOK_PAYLOAD", "") or "{}")
except Exception:
    sys.exit(0)

tool = d.get("tool_name", "")
inp = d.get("tool_input") or {}
path = inp.get("file_path") or ""
if tool not in ("Edit", "Write", "MultiEdit") or not path:
    sys.exit(0)
if os.path.splitext(path)[1] not in sc.EXTENSIONS:
    sys.exit(0)


def current():
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return ""


def apply_one(text, edit):
    old, new = edit.get("old_string", ""), edit.get("new_string", "")
    if not old:
        return text
    return text.replace(old, new) if edit.get("replace_all") else text.replace(old, new, 1)


if tool == "Write":
    result = inp.get("content", "")
elif tool == "Edit":
    result = apply_one(current(), inp)
else:
    result = current()
    for edit in inp.get("edits") or []:
        result = apply_one(result, edit)

hits = sc.scan_text(result, path)
if not hits:
    sys.exit(0)

lines = sorted({line for _, line, _, _ in hits})
where = ", ".join(f"line {n}" for n in lines[:8]) + (f", and {len(lines) - 8} more" if len(lines) > 8 else "")
reason = (
    f"{os.path.basename(path)} would still carry a stat card after this edit ({where}).\n\n"
    + hits[0][3]
    + f"\n\nFix every line above in this edit; the check reads the whole resulting file. "
      f"A genuine exception takes a `{sc.OPT_OUT}` comment on the line or the line above."
)

print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": reason,
}}))
PY
