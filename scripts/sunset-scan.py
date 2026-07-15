#!/usr/bin/env python3
"""Scan a repo for SUNSET(YYYY-MM-DD) markers and report the ones now due.

A SUNSET marker flags code kept only for backward compatibility, with the date
it can probably be removed:

    // SUNSET(2026-08-15): reads the legacy .show-repo.json name. Remove once
    // consumer repos are migrated to .web-tools.json.

By default this prints only markers whose date is today or earlier (the ones
worth acting on) and stays silent otherwise, so it is safe to run warn-only from
a commit hook. `--all` lists upcoming markers too; `--strict` exits non-zero when
anything is due (for CI). Portable: python3 stdlib only, argv-driven, run from
any repo root.

Usage:
    python3 sunset-scan.py [--all] [--strict] [root]
"""
import datetime
import os
import re
import subprocess
import sys

MARKER = re.compile(r"SUNSET\((\d{4}-\d{2}-\d{2})\)")
SKIP_DIRS = {".git", "node_modules", "dist", ".venv", "__pycache__"}


def tracked_files(root):
    """Prefer git's file list (respects .gitignore); fall back to a walk."""
    try:
        out = subprocess.run(
            ["git", "-C", root, "ls-files"],
            capture_output=True, text=True, check=True,
        ).stdout
        return [os.path.join(root, p) for p in out.splitlines() if p]
    except Exception:
        files = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            files.extend(os.path.join(dirpath, f) for f in filenames)
        return files


def scan(root):
    """Yield (date, rel_path, lineno, snippet) for every marker found."""
    for path in tracked_files(root):
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                for lineno, line in enumerate(fh, 1):
                    m = MARKER.search(line)
                    if not m:
                        continue
                    try:
                        when = datetime.date.fromisoformat(m.group(1))
                    except ValueError:
                        continue
                    rel = os.path.relpath(path, root)
                    yield when, rel, lineno, line.strip()
        except (OSError, UnicodeError):
            continue


def main(argv):
    show_all = "--all" in argv
    strict = "--strict" in argv
    positional = [a for a in argv if not a.startswith("--")]
    root = positional[0] if positional else "."
    today = datetime.date.today()

    due, upcoming = [], []
    for when, rel, lineno, snippet in scan(root):
        (due if when <= today else upcoming).append((when, rel, lineno, snippet))

    due.sort()
    upcoming.sort()

    if due:
        print(f"SUNSET: {len(due)} marker(s) due (on/before {today}):")
        for when, rel, lineno, snippet in due:
            print(f"  {when}  {rel}:{lineno}  {snippet}")
    if show_all and upcoming:
        print(f"SUNSET: {len(upcoming)} upcoming marker(s):")
        for when, rel, lineno, snippet in upcoming:
            print(f"  {when}  {rel}:{lineno}  {snippet}")

    return 1 if (strict and due) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
