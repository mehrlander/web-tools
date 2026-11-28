#!/usr/bin/env python3
"""session-render-links.py - the render links a reply closes with, for every branch this session has.

A session works on one branch name in each repo it touches, and each checkout
sits beside the others under the project root. This runs showing.py once per
checkout whose branch is ahead of origin/main and prints only what the reader
gets: ONE link, a walkthrough with a step for every changed file, plus a line
for each change no link reaches. showing.py's working notes (why:, look:, !
warnings) are for the session, so they print only with --notes.

The walkthrough opens on a card naming the branches, then steps through the
files in showing.py's order, one note step each, its message the file's path.
A document's step is its data-view address and a page's is the toss as the tab
(?top), the two routes whose addresses the look kit can tell apart
(lib/kits/look.js, matches()), so the dock's Go link reaches the next file in
any repo. A link showing.py printed in another shape (a merge preview, the
renderer itself) has no such address and prints on its own line after the
walkthrough. The owner asked for one link on 2026-11-27: a list of links, each
with a gloss, made the close of every reply long and the files hard to review.

    python3 python/session-render-links.py            # the one link
    python3 python/session-render-links.py --each     # showing's links, one per line
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
LOOK = Path(__file__).resolve().parent / "look-link.py"
SITE = "https://mehrlander.github.io/web-tools/"
NOTE = re.compile(r"^(why: |look: |! |\()")
LINK = re.compile(r"\[([^\]]*)\]\((https://[^)\s]+)\)")


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


def look_link():
    import importlib.util
    spec = importlib.util.spec_from_file_location("look_link", LOOK)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def stop_of(url):
    """A walkthrough stop's page for one of showing.py's links, read from the
    site root, or None for a link of another shape. A page's own fragment (an
    --at address) does not survive: the walkthrough's keys take the fragment."""
    u = url.split("%23")[0]
    m = re.search(r"toss-render\.html#data=([^#]+)", u)
    if m:
        return "pages/data-view.html?src=" + m.group(1)
    m = re.search(r"pages/data-view\.html\?src=[^#]+", u)
    if m:
        return m.group(0)
    m = re.search(r"toss-render\.html(?:\?top)?#gh=([^#?]+)(?:\?([^#]*))?$", u)
    if m and "refs=" not in u:
        return "pages/toss-render.html?top&gh=" + m.group(1) + ("&" + m.group(2) if m.group(2) else "")
    return None


def one_link(found):
    """(the walkthrough line or None, the lines it could not take)."""
    many = len(found) > 1
    steps, rest = [], []
    for f in found:
        for l in f["lines"]:
            m = LINK.search(l)
            page = stop_of(m.group(2)) if m else None
            if not page:
                rest.append(l if not many else (re.sub(r"\[", "[" + f["repo"] + ": ", l, count=1)
                                                if "](" in l else f["repo"] + ": " + l))
                continue
            steps.append({"at": page + "!", "say": (f["repo"] + ": " if many else "") + m.group(1)})
    if not steps:
        return None, rest
    branches = sorted({f["branch"] for f in found})
    intro = f"{len(steps)} changed file{'s' * (len(steps) != 1)} on " + ", ".join(branches)
    first = steps[0]["at"][:-1]
    url = SITE + first + "#" + look_link().fragment(steps=steps, intro=intro)
    return f"🥏 [Walk through {len(steps)} changed file{'s' * (len(steps) != 1)}]({url})", rest


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", help="the folder holding the checkouts (default: the parent of "
                                   "the current checkout, or the current folder)")
    ap.add_argument("--each", action="store_true", help="print showing.py's links one per line, "
                                                       "as before the one link")
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
    if not a.each:
        line, rest = one_link(found)
        for l in ([line] if line else []) + rest:
            print(l)
        if a.notes:
            for f in found:
                for n in f["notes"]:
                    print(f["repo"] + ": " + n)
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
