#!/usr/bin/env python3
"""Branches: the tend skill's branch tests, applied to every remote branch.

SKILL.md's Branches table names the classes; this applies them over the
checkouts beside the notes store, so a pass reads one list instead of testing
branches by hand. Read-only: it never fetches, so fetch first, and it refuses a
shallow clone, whose missing history would turn settled branches into novel
ones.

  ancestor          main contains the tip.
  content-settled   every path the branch changed holds main's bytes (at that
                    path or another), or bytes main held since the merge base,
                    or moved or was retired.
  residue-free      paths differ, but every line the branch added is in main's
                    copy, so nothing is unique.
  open              heads an open pull request (from the crawl's cache); read
                    under Pull requests, not here.
  orphan            shares no history with main, as a store branch such as
                    web-tools-private's `background` does by design; listed by
                    name, not read for residue.
  novel             the rest. Its residue is the added lines main's copy lacks.

merged-tip and closed-tip need each pull request's head commit, which the cache
does not hold. A merge-commit repo's merged tips read as ancestor anyway; the
branch of a pull request closed unmerged reads as novel here.

Usage:
  branches.py [--repo owner/repo] [--since YYYY-MM-DD] [--json]
      counts per repo, then each novel and orphan branch; --since skips branches
      whose tip is older, such as those a previous pass already classed
"""

import argparse
import collections
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import findings  # noqa: E402  (the checkout lookup and the store, shared)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "notes"))
import note  # noqa: E402


def git(co, *a):
    r = subprocess.run(["git", "-C", co, *a], capture_output=True, text=True, errors="replace")
    return r.stdout if r.returncode == 0 else ""


# A basename this common on main names no particular file: matching README.md
# proposes every README in the tree as the one that moved, so a whole new folder
# read as settled. stranded-triage.py's COMMON_BASENAME, measured there.
COMMON_BASENAME = 3


def classify(co, ref, main_files, main_blobs, basenames):
    mb = git(co, "merge-base", ref, "origin/main").strip()
    if not mb:
        return "orphan", {}
    novel, residue = [], 0
    for line in git(co, "diff", "--name-status", "--no-renames", mb, ref).splitlines():
        st, path = line.split("\t", 1)
        if st.startswith("D"):
            if path in main_files:
                novel.append(path)          # the branch deleted what main keeps
            continue
        blob = git(co, "rev-parse", f"{ref}:{path}").strip()
        if path in main_files:
            if git(co, "rev-parse", f"origin/main:{path}").strip() == blob:
                continue
            raw = git(co, "log", "--raw", "--no-abbrev", "--format=", f"{mb}..origin/main", "--", path)
            if any(blob in l.split()[2:4] for l in raw.splitlines() if l.startswith(":")):
                continue                    # main held these bytes since, then moved on
        elif blob in main_blobs:
            continue                        # landed: main holds these bytes at another path
        elif 0 < basenames[os.path.basename(path)] < COMMON_BASENAME:
            continue                        # moved: a lead, not a proof (stranded-triage.py)
        elif git(co, "log", "origin/main", "--diff-filter=D", "--format=%H", "-1", "--", path).strip():
            continue                        # retired on main
        novel.append(path)
        added = [l[1:] for l in git(co, "diff", "-U0", mb, ref, "--", path).splitlines()
                 if l.startswith("+") and not l.startswith("+++")]
        have = set(git(co, "show", f"origin/main:{path}").splitlines()) if path in main_files else set()
        residue += sum(1 for l in added if l.strip() and l not in have)
    if not novel:
        return "content-settled", {}
    if not residue and all(p in main_files for p in novel):
        return "residue-free", {}
    return "novel", {"residue": residue, "paths": novel}


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--store", help="the notes folder, when the search would not find it")
    ap.add_argument("--repo")
    ap.add_argument("--since", default="", help="skip branches whose tip commit is older (YYYY-MM-DD)")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    store_repo, _ = note.find_store(a.store)
    act = {}
    raw = git(store_repo, "show", "origin/main:state/activity.json")
    if raw:
        act = json.loads(raw).get("repos") or {}
    out = []
    for repo, co in sorted(findings.checkouts(store_repo).items()):
        if a.repo and repo != a.repo:
            continue
        if git(co, "rev-parse", "--is-shallow-repository").strip() == "true":
            raise SystemExit(f"branches.py: {co} is a shallow clone; run git fetch --unshallow origin there first")
        heads = {p.get("head") for p in (act.get(repo, {}).get("openPRs") or [])}
        tree = [l.split("\t", 1) for l in git(co, "ls-tree", "-r", "origin/main").splitlines()]
        main_files = {p for _, p in tree}
        main_blobs = {meta.split()[2] for meta, _ in tree}
        basenames = collections.Counter(os.path.basename(p) for p in main_files)
        for line in git(co, "for-each-ref", "--format=%(refname:short) %(objectname) %(committerdate:short)",
                        "refs/remotes/origin").splitlines():
            ref, sha, day = line.split(" ")
            branch = ref.split("/", 1)[1] if "/" in ref else ref
            if branch in ("HEAD", "main") or ref == "origin" or day < a.since:
                continue
            row = {"repo": repo, "branch": branch, "sha": sha, "day": day}
            if git(co, "rev-list", "--count", ref, "--not", "origin/main").strip() == "0":
                row["class"] = "ancestor"
            elif branch in heads:
                row["class"] = "open"
            else:
                row["class"], extra = classify(co, ref, main_files, main_blobs, basenames)
                row.update(extra)
                if row["class"] == "novel":
                    row["session"] = git(co, "log", "-1", "--format=%(trailers:key=Claude-Session,valueonly)", ref).strip()
            out.append(row)
    if a.json:
        print(json.dumps(out, indent=1))
        return
    counts = {}
    for r in out:
        counts.setdefault(r["repo"], {}).setdefault(r["class"], 0)
        counts[r["repo"]][r["class"]] += 1
    for repo, c in counts.items():
        print(repo, "  ".join(f"{k} {v}" for k, v in sorted(c.items())))
    for r in sorted((r for r in out if r["class"] in ("novel", "orphan")), key=lambda r: (r["class"], r["repo"], r["day"])):
        tail = f"  {r.get('residue', 0)} lines in {len(r.get('paths', []))} path(s)" if r["class"] == "novel" else ""
        print(f"{r['class']:6} {r['repo']}@{r['branch']}  {r['day']}{tail}")


if __name__ == "__main__":
    main(sys.argv[1:])
