#!/bin/bash
# PostToolUse hook on Edit|Write: when the edited file is governed by a program
# the repo declares (.web-tools.json "programs"[].governs, where an entry ending
# in / covers everything under it), exit 2 so the line on
# stderr reaches Claude: the file's program, its charter, and the skill that
# reviews a change against them. Once per program per session, so a run of
# edits to one standard hears it once. A governed file may also be
# documentation, in which case warn-governing-docs.sh speaks for the wording.
HOOK_PAYLOAD="$(cat)" python3 <<'PY'
import json, os, subprocess, sys, tempfile

data = json.loads(os.environ.get("HOOK_PAYLOAD") or "{}")
path = (data.get("tool_input") or {}).get("file_path") or ""
if not path:
    sys.exit(0)
try:
    root = subprocess.run(["git", "-C", os.path.dirname(path) or ".", "rev-parse",
                           "--show-toplevel"], capture_output=True, text=True).stdout.strip()
except OSError:
    sys.exit(0)
if not root or not os.path.abspath(path).startswith(root + os.sep):
    sys.exit(0)
rel = os.path.relpath(os.path.abspath(path), root)
try:
    with open(os.path.join(root, ".web-tools.json"), encoding="utf-8") as fh:
        programs = json.load(fh).get("programs") or []
except (OSError, ValueError, AttributeError):
    sys.exit(0)
def covers(g, rel):
    return rel == g or (g.endswith("/") and rel.startswith(g))
prog = next((p for p in programs if isinstance(p, dict)
             and any(isinstance(g, str) and covers(g, rel) for g in p.get("governs") or [])), None)
if not prog or not prog.get("name"):
    sys.exit(0)
session = str(data.get("session_id") or "nosession").replace(os.sep, "_")
mark = os.path.join(tempfile.gettempdir(), "program-files", f"{session}-{prog['name']}")
if os.path.exists(mark):
    sys.exit(0)
os.makedirs(os.path.dirname(mark), exist_ok=True)
open(mark, "w").close()
label = prog.get("label") or prog["name"]
print(f"{rel} is governed by the {label} program (charter {prog.get('path', '')}/README.md). "
      f"Before handing the change over, run /portable:programs {prog['name']} to report "
      "the change against the charter's measures and send it to the program's reviewers.",
      file=sys.stderr)
sys.exit(2)
PY
