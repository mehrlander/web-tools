#!/bin/bash
# PostToolUse hook on Edit|Write: when the edited file is documentation, exit 2
# so the warning on stderr reaches Claude immediately after the edit lands.
# "Documentation" is the markdown globs of the repo's declared retrieval
# sources (skills/ or .claude/skills/file-retrieval/sources.csv) when the repo carries
# that registry, else the same shapes as a fallback: docs/**/*.md, root *.md,
# skills trees, and any CLAUDE.md or SKILL.md. Never chron/, tracker/tasks/,
# blog/, or dump trays, which are written freely by design, and never research
# the repo declares in .web-tools.json: a declared path, or the folder of a
# declared README.md (commit-consent.py's declared_research reads the same list).
HOOK_PAYLOAD="$(cat)" python3 <<'PY'
import csv, json, os, re, subprocess, sys

data = json.loads(os.environ.get("HOOK_PAYLOAD") or "{}")
path = (data.get("tool_input") or {}).get("file_path") or ""
if not path.endswith(".md"):
    sys.exit(0)
try:
    root = subprocess.run(["git", "-C", os.path.dirname(path) or ".", "rev-parse",
                           "--show-toplevel"], capture_output=True, text=True).stdout.strip()
except OSError:
    root = ""
rel = os.path.relpath(path, root) if root and path.startswith(root) else path
if rel.startswith(("chron/", "tracker/tasks/", "blog/")) or "/dump/" in rel or rel.startswith("dump/"):
    sys.exit(0)
try:
    with open(os.path.join(root, ".web-tools.json"), encoding="utf-8") as fh:
        declared = [(e.get("path") or "").strip("/") for e in json.load(fh).get("research") or [] if isinstance(e, dict)]
except (OSError, ValueError, AttributeError):
    declared = []
if any(p and (rel == p or (os.path.basename(p) == "README.md" and os.path.dirname(p)
                          and rel.startswith(os.path.dirname(p) + "/"))) for p in declared):
    sys.exit(0)

globs, basis = [], "fallback globs"
reg = next((c for c in (os.path.join(root, d, "file-retrieval/sources.csv") for d in ("skills", ".claude/skills")) if os.path.exists(c)), "") if root else ""
if reg and os.path.exists(reg):
    with open(reg, newline="") as fh:
        globs = [r["glob"] for r in csv.DictReader(fh) if r["glob"].endswith(".md")]
    basis = "the sources registry"
if not globs:
    globs = ["docs/**/*.md", "*.md", "skills/**/*.md", ".claude/skills/**/*.md"]

# `*` stays inside one folder and `**/` spans any number, none included; fnmatch
# lets `*` cross `/`, so the root-only `*.md` matched every Markdown file.
def glob_hit(rel, g):
    rx = re.escape(g).replace(r"\*\*/", "(?:[^/]+/)*").replace(r"\*", "[^/]*")
    return re.fullmatch(rx, rel) is not None

hit = any(glob_hit(rel, g) for g in globs) \
      or os.path.basename(rel) in ("CLAUDE.md", "SKILL.md")
if hit:
    print(f"{rel} is documentation ({basis}). Edit it only with the user's specific "
          "permission for this file; adjacent work does not imply it. If this edit "
          "was not specifically asked for, say so and offer to revert.", file=sys.stderr)
    sys.exit(2)
PY
