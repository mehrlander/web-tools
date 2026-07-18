#!/usr/bin/env python3
# Regenerate board.md from tasks/*.md. Frontmatter is flat `key: value` pairs.
# Portable: python3, stdlib only, zero dependencies.
# Canonical source: mehrlander/web-tools at scripts/build-board.py
# Usage: python3 build-board.py <tasks_dir> <board_out>
import pathlib, sys

tasks_dir = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "tasks")
out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "board.md")

def meta(p):
    parts = p.read_text().split("---")
    if len(parts) < 3:
        return {}
    d = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            d[k.strip()] = v.strip()
    return d

tasks = [meta(p) for p in sorted(tasks_dir.glob("*.md"))]
buckets = {"backlog": [], "in-progress": [], "blocked": [], "done": []}
for m in tasks:
    buckets.get(m.get("status", "backlog"), buckets["backlog"]).append(m)

def row(m):
    who = f" (`{m['session']}`)" if m.get("session") else ""
    nxt = f" next: {m['next']}" if m.get("next") else ""
    # 🎫 marks a tracker task wherever one is surfaced (see CONVENTIONS.md /
    # TRACKER.md): the ticket says "this is a filed task."
    return f"- 🎫 {m.get('title', '(untitled)')}{who}{nxt}"

lines = ["# Board", "", "_Generated from tasks/. Do not hand-edit._", ""]
for head, key in [("On deck", "backlog"), ("In progress", "in-progress"),
                  ("Blocked", "blocked"), ("Done", "done")]:
    lines.append(f"## {head}")
    lines += ([row(m) for m in buckets[key]] or ["- (none)"])
    lines.append("")
out.write_text("\n".join(lines))
