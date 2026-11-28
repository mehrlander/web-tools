#!/bin/bash
# PostToolUse hook on Edit|Write: when the edited file is documentation, exit 2
# so the warning on stderr reaches Claude immediately after the edit lands.
# What counts as documentation is governing-docs.py beside this file, the one
# test session-detail-caption.py also asks of a session's changed files.
#
# A list (lists/*.json) whose header says "critic": true is one sessions write
# into, and the peeves critic reviews what they write. After an edit that adds
# or changes entries there (against the file at HEAD), it also exits 2 with a
# reminder: run the critic on those entries, and file a user call instead of
# committing when an existing entry changed or the list says "edit": "propose".
# Once per session for the same entries. The reminder's wording is here, in
# code: no hook in this folder reads its text from a file.
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" \
HOOK_PAYLOAD="$(cat)" python3 <<'PY'
import hashlib, importlib.util, json, os, subprocess, sys, tempfile

data = json.loads(os.environ.get("HOOK_PAYLOAD") or "{}")
path = (data.get("tool_input") or {}).get("file_path") or ""
if not path.endswith((".md", ".json")):
    sys.exit(0)
try:
    root = subprocess.run(["git", "-C", os.path.dirname(path) or ".", "rev-parse",
                           "--show-toplevel"], capture_output=True, text=True).stdout.strip()
except OSError:
    root = ""
rel = os.path.relpath(path, root) if root and path.startswith(root) else path

# Loaded by path, not imported: the name is hyphenated, and inside a heredoc
# `__file__` is stdin, so the bash wrapper supplies the directory.
spec = importlib.util.spec_from_file_location(
    "governing_docs", os.path.join(os.environ.get("HOOK_DIR", ""), "governing-docs.py"))
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
said = False
basis = engine.documentation(root, rel)
if basis:
    craft = "doc-craft and skill-prefs skills" if os.path.basename(rel) == "SKILL.md" else "doc-craft skill"
    print(f"{rel} is documentation ({basis}). Edit it only with the user's specific "
          "permission for this file; adjacent work does not imply it. If this edit "
          f"was not specifically asked for, say so and offer to revert. Follow the {craft} "
          "for the wording and for its Review, which ends in a user call.", file=sys.stderr)
    said = True


def entries(text):
    try:
        doc = json.loads(text or "null")
    except ValueError:
        return None, {}
    items = doc.get("items") if isinstance(doc, dict) else None
    return doc, {x["id"]: x for x in items or [] if isinstance(x, dict) and isinstance(x.get("id"), str)}


if root and rel.endswith(".json") and ("/" + rel).rsplit("/", 1)[0].endswith("/lists"):
    try:
        with open(path, encoding="utf-8") as fh:
            doc, now = entries(fh.read())
    except OSError:
        doc, now = None, {}
    if isinstance(doc, dict) and doc.get("critic") is True:
        head = subprocess.run(["git", "-C", root, "show", f"HEAD:{rel}"], capture_output=True, text=True)
        was = entries(head.stdout)[1] if head.returncode == 0 else {}
        changed = [k for k in now if k in was and now[k] != was[k]]
        ids = [k for k in now if k not in was] + changed
        propose = doc.get("edit") == "propose"
        session = str(data.get("session_id") or "nosession").replace(os.sep, "_")
        key = hashlib.sha1(json.dumps([rel, sorted(ids), propose]).encode()).hexdigest()[:16]
        mark = os.path.join(tempfile.gettempdir(), "list-critic", f"{session}-{key}")
        if ids and not os.path.exists(mark):
            os.makedirs(os.path.dirname(mark), exist_ok=True)
            open(mark, "w").close()
            shown = ", ".join(ids[:6]) + (f" and {len(ids) - 6} more" if len(ids) > 6 else "")
            print(f"Run the portable:peeves-critic agent on the entries this edit added or changed in {rel} "
                  f"({shown}), and fix what it finds before committing.", file=sys.stderr)
            if changed or propose:
                why = "changes an existing entry" if changed else 'is to a list that says "edit": "propose"'
                print(f"This edit {why}, so file a user call for it instead of committing it directly.", file=sys.stderr)
            said = True
sys.exit(2 if said else 0)
PY
