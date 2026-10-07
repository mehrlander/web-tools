#!/usr/bin/env python3
"""Write and read notes: short, signed, dated observations about a subject.

A note is one JSON line in <store>/notes.jsonl:

  {"id": "n…", "at": "<UTC ISO>", "author": "…", "about": "<locator>", "text": "…"}

plus an optional "anchor" (a text-quote anchor from lib/kits/annotate.js) and
an optional "vote" on a note about a user call: "up" or "down" on its
recommendation, "" to withdraw. An author's latest vote counts, as in the Text
collection's reviews.
Notes are never edited or deleted. A correction or an addition is a new note
whose `about` is `note:<id>`.

The store is found the way the session recorder finds its own: a checkout whose
.web-tools.json on origin/main declares "notes" (a path relative to that
checkout), searched in the project root, its children and its siblings.
--store overrides.

Writes land on the store's origin/main by git plumbing, never through the
working tree, so the checkout can sit on any branch. A push that loses a race
refetches and retries on the new tip. Reads come from origin/main after a fetch,
not from the working tree, which may be days behind.

Usage:
  note.py add <about> <text> [--author A] [--anchor JSON] [--vote up|down|withdraw]
  note.py reply <note-id> <text> [--author A] [--vote up|down|withdraw]
  note.py show <about>        notes about a subject, replies nested
  note.py list [--author A]   every note, newest first
"""

import argparse
import json
import os
import random
import re
import string
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

# A vote on a user call's recommendation (lib/kits/notes.js); withdraw writes "".
VOTES = ("up", "down", "withdraw")
LOCATOR = re.compile(
    r"^(?:note:n[0-9a-z]+"                      # another note
    r"|[\w.-]+/[\w.-]+"                         # owner/repo
    r"(?:#\d+"                                  #   #N  pull request
    r"|(?:@[^\s:]+)?(?::[^\s#]+(?:#\S+)?)?))$"  #   [@ref][:path[#fragment]]
)
ASSISTANT_PREFIXES = ("claude/", "codex/", "gemini/", "grok/")
NOTES_FILE = "notes.jsonl"


def git(repo, *args, env=None, check=True):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True,
                       env={**os.environ, **(env or {})})
    if check and r.returncode:
        raise SystemExit(f"note.py: git {' '.join(args)} failed: {r.stderr.strip()}")
    return r


def find_store(explicit):
    """(checkout, store path relative to it). The store is a folder in a checkout."""
    if explicit:
        path = os.path.abspath(explicit)
        probe = path
        while not os.path.isdir(probe):   # the folder may not exist before the first note
            probe = os.path.dirname(probe)
        top = git(probe, "rev-parse", "--show-toplevel").stdout.strip()
        return top, os.path.relpath(path, top)
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    cands = [root]
    for base in (root, os.path.dirname(root)):
        try:
            cands += [os.path.join(base, d) for d in sorted(os.listdir(base))]
        except OSError:
            pass
    for repo in cands:
        # main holds the declaration, as it holds the notes; the checkout may sit
        # on a branch cut before either existed.
        r = subprocess.run(["git", "-C", repo, "show", "origin/main:.web-tools.json"],
                           capture_output=True, text=True)
        try:
            if r.returncode == 0:
                declared = json.loads(r.stdout).get("notes")
            else:
                with open(os.path.join(repo, ".web-tools.json"), encoding="utf-8") as fh:
                    declared = json.load(fh).get("notes")
        except (OSError, ValueError):
            continue
        if isinstance(declared, str) and declared:
            return repo, declared.strip("/")
    raise SystemExit("note.py: no checkout declares a notes store (.web-tools.json \"notes\"); "
                     "attach the store repo or pass --store")


def default_author():
    r = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True)
    branch = r.stdout.strip()
    if branch.startswith(ASSISTANT_PREFIXES):
        return branch
    raise SystemExit("note.py: cannot tell who is writing; pass --author")


def new_id():
    t = int(time.time() * 1000)
    digits = string.digits + string.ascii_lowercase
    s = ""
    while t:
        t, r = divmod(t, 36)
        s = digits[r] + s
    return "n" + s + "".join(random.choices(digits, k=4))


def read_notes(repo, store):
    git(repo, "fetch", "-q", "origin", "main")
    r = git(repo, "show", f"origin/main:{store}/{NOTES_FILE}", check=False)
    if r.returncode:
        return []
    return [json.loads(line) for line in r.stdout.splitlines() if line.strip()]


def append(repo, store, note, attempts=5):
    """Commit one appended line onto origin/main without touching the working tree."""
    path = f"{store}/{NOTES_FILE}"
    for _ in range(attempts):
        git(repo, "fetch", "-q", "origin", "main")
        tip = git(repo, "rev-parse", "origin/main").stdout.strip()
        cur = git(repo, "show", f"{tip}:{path}", check=False)
        body = cur.stdout if cur.returncode == 0 else ""
        if body and not body.endswith("\n"):
            body += "\n"
        body += json.dumps(note, ensure_ascii=False) + "\n"
        blob = subprocess.run(["git", "-C", repo, "hash-object", "-w", "--stdin"], input=body,
                              capture_output=True, text=True, check=True).stdout.strip()
        with tempfile.TemporaryDirectory() as tmp:
            env = {"GIT_INDEX_FILE": os.path.join(tmp, "index")}
            git(repo, "read-tree", tip, env=env)
            git(repo, "update-index", "--add", "--cacheinfo", f"100644,{blob},{path}", env=env)
            tree = git(repo, "write-tree", env=env).stdout.strip()
        msg = f"note: {note['about']}\n\n{note['text'][:200]}"
        commit = git(repo, "commit-tree", tree, "-p", tip, "-m", msg).stdout.strip()
        if git(repo, "push", "-q", "origin", f"{commit}:refs/heads/main", check=False).returncode == 0:
            return
        time.sleep(1)
    raise SystemExit("note.py: push to main kept losing the race; nothing was written")


def thread(notes, about, depth=0):
    for n in sorted((n for n in notes if n["about"] == about), key=lambda n: n["at"]):
        pad = "  " * depth
        print(f"{pad}{n['id']}  {n['at'][:16]}  {n['author']}")
        for line in n["text"].splitlines() or [""]:
            print(f"{pad}  {line}")
        thread(notes, f"note:{n['id']}", depth + 1)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--store", help="the notes folder, when the search would not find it")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add"); a.add_argument("about"); a.add_argument("text")
    a.add_argument("--author"); a.add_argument("--anchor"); a.add_argument("--vote", choices=VOTES)
    r = sub.add_parser("reply"); r.add_argument("id"); r.add_argument("text"); r.add_argument("--author")
    r.add_argument("--vote", choices=VOTES)
    s = sub.add_parser("show"); s.add_argument("about")
    l = sub.add_parser("list"); l.add_argument("--author")
    args = ap.parse_args(argv)

    repo, store = find_store(args.store)
    if args.cmd in ("add", "reply"):
        about = args.about if args.cmd == "add" else f"note:{args.id}"
        if not LOCATOR.match(about):
            raise SystemExit(f"note.py: not a locator: {about!r}")
        if not args.text.strip():
            raise SystemExit("note.py: a note needs text")
        if about.startswith("note:") and about[5:] not in {n["id"] for n in read_notes(repo, store)}:
            raise SystemExit(f"note.py: no note {about[5:]} on main")
        note = {"id": new_id(), "at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                "author": args.author or default_author(), "about": about, "text": args.text.strip()}
        if getattr(args, "anchor", None):
            note["anchor"] = json.loads(args.anchor)
        if args.vote:
            note["vote"] = "" if args.vote == "withdraw" else args.vote
        append(repo, store, note)
        print(note["id"])
    elif args.cmd == "show":
        thread(read_notes(repo, store), args.about)
    else:
        for n in sorted(read_notes(repo, store), key=lambda n: n["at"], reverse=True):
            if args.author and n["author"] != args.author:
                continue
            print(f"{n['id']}  {n['at'][:16]}  {n['author']}  {n['about']}\n  {n['text']}")


if __name__ == "__main__":
    main(sys.argv[1:])
