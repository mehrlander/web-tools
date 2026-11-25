#!/usr/bin/env python3
"""session-render-links.py - the render links a reply closes with, for every branch this session has.

A session works on one branch name in each repo it touches, and each checkout
sits beside the others under the project root. This runs showing.py once per
checkout whose branch is ahead of origin/main and prints only what the reader
gets: one link per line, or the line saying why none reaches the change.
showing.py's working notes (why:, look:, ! warnings) are for the session, so
they print only with --notes.

With more than one checkout in play, each link's label is prefixed with its
repo, so `🥏 [home: projects/wps/README.md](…)` and a web-tools link can sit
on adjacent lines without ambiguity.

    python3 python/session-render-links.py            # links, one per line
    python3 python/session-render-links.py --notes    # plus showing's notes
    python3 python/session-render-links.py --json     # [{repo, branch, lines, notes}]
    python3 python/session-render-links.py --root DIR # the folder holding the checkouts

A single checkout, a look link (--at) or an arbitrary file (--path) is
showing.py's job; run it directly for those.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SHOWING = Path(__file__).resolve().parent / "showing.py"
NOTE = re.compile(r"^(why: |look: |! |\()")


def git(cwd, *args):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def project_root():
    top = git(Path.cwd(), "rev-parse", "--show-toplevel")
    return Path(top).parent if top else Path.cwd()


def active(root):
    """Checkouts under root whose branch has commits origin/main lacks, by name."""
    out = []
    for d in sorted(p for p in root.iterdir() if (p / ".git").exists()):
        branch = git(d, "branch", "--show-current")
        if not branch or branch in ("main", "master"):
            continue
        ahead = git(d, "rev-list", "--count", "origin/main..HEAD")
        if ahead and ahead != "0":
            out.append((d, branch))
    return out


def showing(checkout):
    r = subprocess.run([sys.executable, str(SHOWING), "--root", str(checkout)],
                       capture_output=True, text=True)
    text = r.stdout.strip() or ("CANNOT TELL: showing.py failed here: " + r.stderr.strip()[-300:])
    rows = text.splitlines()
    return [l for l in rows if not NOTE.match(l)], [l for l in rows if NOTE.match(l)]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", help="the folder holding the checkouts (default: the parent of "
                                   "the current checkout, or the current folder)")
    ap.add_argument("--notes", action="store_true", help="also print showing.py's why:, look: and ! lines")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    root = Path(a.root).resolve() if a.root else project_root()

    found = []
    for checkout, branch in active(root):
        lines, notes = showing(checkout)
        found.append({"repo": checkout.name, "branch": branch, "lines": lines, "notes": notes})

    if a.json:
        print(json.dumps(found, indent=2, ensure_ascii=False))
        return
    if not found:
        print("No render link: no checkout under " + str(root) + " has commits origin/main lacks.")
        return
    many = len(found) > 1
    for f in found:
        for l in f["lines"]:
            if many:
                l = re.sub(r"\[", "[" + f["repo"] + ": ", l, count=1) if "](" in l else f["repo"] + ": " + l
            print(l)
        if a.notes:
            for n in f["notes"]:
                print(("  " if many else "") + n)


if __name__ == "__main__":
    main()
