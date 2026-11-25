#!/bin/bash
# PostToolUse hook on Edit|Write: when the edited file is documentation, exit 2
# so the warning on stderr reaches Claude immediately after the edit lands.
# What counts as documentation is governing-docs.py beside this file, the one
# test session-detail-caption.py also asks of a session's changed files.
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" \
HOOK_PAYLOAD="$(cat)" python3 <<'PY'
import importlib.util, json, os, subprocess, sys

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
basis = engine.documentation(root, rel)
if basis:
    craft = "doc-craft and skill-prefs skills" if os.path.basename(rel) == "SKILL.md" else "doc-craft skill"
    print(f"{rel} is documentation ({basis}). Edit it only with the user's specific "
          "permission for this file; adjacent work does not imply it. If this edit "
          f"was not specifically asked for, say so and offer to revert. Follow the {craft} "
          "for the wording.", file=sys.stderr)
    sys.exit(2)
PY
