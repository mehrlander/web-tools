#!/usr/bin/env python3
"""check-edit-policy.py: hold each changed file to the edit policy .gitattributes declares.

Each policy's meaning is a row of web-tools docs/vocabularies.csv (registry
gitattributes, property edit). This checks append-only, write-once and
by-status; regenerated files answer to their builders' checks. A repo that
declares no `edit` attribute passes, since every file is then in place.

WHAT IS COMPARED. Each path changed between BASE and the target, where BASE is
the merge base of HEAD and origin/main, and the target is the index (--staged,
from .githooks/commit-msg) or HEAD (--range, from CI: home's
tools/verify-artifacts.sh, web-tools' edit-policy job). A file that does not
exist at BASE is new on this branch and goes unchecked, so a branch may revise
what it wrote until it merges. Each file's policy is read from BASE's
.gitattributes, so a change cannot grant itself a looser policy in the same
branch. A pure rename passes.

EXCEPTIONS are deliberate and named: a line `Edit-policy-exception: <path>` in
the commit message (--staged) or in any commit message between BASE and HEAD
(--range).

Usage:
  check-edit-policy.py --staged --message <file>   the commit-msg hook
  check-edit-policy.py --range                     CI
  check-edit-policy.py --self-test
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile

CHECKED = {"append-only", "write-once", "by-status"}
EXCEPTION = re.compile(r"^Edit-policy-exception:\s*(\S+)\s*$", re.M)
INLINE_LINK = re.compile(r"\]\((?:[^()\s]|\([^()\s]*\))*(?:\s+\"[^\"]*\")?\)")
REF_DEF = re.compile(r"^(\s{0,3}\[[^\]]+\]:)\s*\S+.*$")
STATUS = re.compile(r"^status:\s*(\S+)\s*$", re.M)


def git(cwd, *args, check=True):
    res = subprocess.run(["git", *args], cwd=cwd, capture_output=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {res.stderr.decode(errors='replace').strip()}")
    return res.stdout


def blob(cwd, spec):
    res = subprocess.run(["git", "show", spec], cwd=cwd, capture_output=True)
    return res.stdout if res.returncode == 0 else None


def base_of(cwd):
    if subprocess.run(["git", "rev-parse", "-q", "--verify", "origin/main"], cwd=cwd,
                      capture_output=True).returncode != 0:
        return None
    res = subprocess.run(["git", "merge-base", "HEAD", "origin/main"], cwd=cwd, capture_output=True)
    return res.stdout.decode().strip() if res.returncode == 0 else None


def changes(cwd, base, staged):
    """(status, old path, new path) for each path that differs from BASE."""
    args = ["diff", "-M", "--name-status", "-z"]
    args += ["--cached", base] if staged else [base, "HEAD"]
    parts = git(cwd, *args).decode("utf-8", errors="surrogateescape").split("\0")
    out, i = [], 0
    while i < len(parts) and parts[i]:
        status = parts[i]
        if status[0] in "RC":
            out.append((status, parts[i + 1], parts[i + 2]))
            i += 3
        else:
            out.append((status, parts[i + 1], parts[i + 1]))
            i += 2
    return out


def policies(cwd, base, paths):
    """Each path's `edit` attribute as BASE's .gitattributes declares it."""
    if not paths:
        return {}
    out = git(cwd, "check-attr", "--source", base, "-z", "edit", "--", *paths).decode(
        "utf-8", errors="surrogateescape").split("\0")
    found = {}
    for k in range(0, len(out) - 2, 3):
        path, _, value = out[k], out[k + 1], out[k + 2]
        found[path] = "in-place" if value in ("unspecified", "unset", "set") else value
    return found


def links_only(old, new):
    """True when the two texts differ only inside link targets."""
    try:
        a, b = old.decode("utf-8").splitlines(), new.decode("utf-8").splitlines()
    except UnicodeDecodeError:
        return False
    if len(a) != len(b):
        return False

    def bare(line):
        return INLINE_LINK.sub("]()", REF_DEF.sub(r"\1", line))

    return all(x == y or bare(x) == bare(y) for x, y in zip(a, b))


def judge(policy, status, old, new):
    """The violation, in words, or None."""
    if status.startswith("D"):
        return "deleted"
    if status == "R100":
        return None
    if policy == "append-only":
        return None if new is not None and new.startswith(old) else "changed before its end"
    if policy == "write-once":
        return None if new is not None and links_only(old, new) else "changed after it reached main"
    return None


def check(cwd, staged, message=""):
    base = base_of(cwd)
    if base is None:
        return [], "no origin/main to compare against; nothing checked"
    merge_head = git(cwd, "rev-parse", "--git-path", "MERGE_HEAD").decode().strip()
    if staged and os.path.exists(os.path.join(cwd, merge_head)):
        return [], "a merge in progress is checked in CI, against the merged base"
    if not staged:
        message = git(cwd, "log", "--format=%B", f"{base}..HEAD").decode(errors="replace")
    allowed = set(EXCEPTION.findall(message))
    # An added file is new on this branch, and a copy leaves its source as it was.
    items = [c for c in changes(cwd, base, staged) if c[0][0] not in "AC"]
    pol = policies(cwd, base, [old for _, old, _ in items])
    found = []
    for status, old_path, new_path in items:
        policy = pol.get(old_path, "in-place")
        if policy not in CHECKED or old_path in allowed or new_path in allowed:
            continue
        old = blob(cwd, f"{base}:{old_path}")
        if old is None:
            continue
        if policy == "by-status":
            m = STATUS.search(old.decode("utf-8", errors="replace").split("\n---", 1)[0])
            if not (m and m.group(1) == "done"):
                continue
            policy = "write-once"
        new = None if status.startswith("D") else blob(cwd, (":" if staged else "HEAD:") + new_path)
        why = judge(policy, status, old, new)
        if why:
            found.append(f"{old_path}: {policy}: {why}")
    return found, f"{len(items)} changed file(s) checked against {base[:12]}"


def report(found, summary):
    if not found:
        print(f"edit policy: clean ({summary})")
        return 0
    print("edit policy: a change breaks the policy .gitattributes declares", file=sys.stderr)
    for line in found:
        print(f"  {line}", file=sys.stderr)
    print("A correction to a write-once file goes in a note addressed to it (the portable notes skill).\n"
          "For a deliberate exception, add the line `Edit-policy-exception: <path>` to the commit message.",
          file=sys.stderr)
    return 1


def self_test():
    failures = []

    def expect(name, cond):
        if not cond:
            failures.append(name)

    with tempfile.TemporaryDirectory() as tmp:
        g = ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"]

        def sh(*args):
            git(tmp, *g, *args)

        def write(path, text):
            full = os.path.join(tmp, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)

        def staged(msg=""):
            sh("add", "-A")
            return check(tmp, True, msg)[0]

        sh("init", "-q", "-b", "main")
        write(".gitattributes", "* edit=in-place\nlog/*.jsonl edit=append-only\nchron/** edit=write-once\n"
              "tasks/*.md edit=by-status\n")
        write("log/a.jsonl", '{"n":1}\n')
        write("chron/e.md", "# E\n\nA claim, with [a link](old/path.md).\n")
        write("tasks/done.md", "---\nstatus: done\n---\n# Done\n")
        write("tasks/open.md", "---\nstatus: in-progress\n---\n# Open\n")
        write("README.md", "readme\n")
        sh("add", "-A")
        sh("commit", "-q", "-m", "base")
        sh("update-ref", "refs/remotes/origin/main", "HEAD")
        sh("checkout", "-q", "-b", "work")

        def reset():
            sh("reset", "-q", "--hard", "origin/main")

        write("log/a.jsonl", '{"n":1}\n{"n":2}\n')
        expect("an append at the end passes", staged() == [])
        reset()
        write("log/a.jsonl", '{"n":9}\n')
        expect("an earlier line changed fails", len(staged()) == 1)
        reset()
        write("chron/e.md", "# E\n\nA different claim, with [a link](old/path.md).\n")
        expect("a write-once edit fails", len(staged()) == 1)
        reset()
        write("chron/e.md", "# E\n\nA claim, with [a link](new/path.md).\n")
        expect("a link-target repoint passes", staged() == [])
        reset()
        sh("mv", "chron/e.md", "chron/f.md")
        expect("a pure rename passes", staged() == [])
        reset()
        os.remove(os.path.join(tmp, "chron/e.md"))
        expect("a deletion fails", len(staged()) == 1)
        reset()
        write("tasks/done.md", "---\nstatus: done\n---\n# Done\n\nMore.\n")
        expect("an edit to a done task fails", len(staged()) == 1)
        reset()
        write("tasks/open.md", "---\nstatus: done\n---\n# Open\n\nClosed.\n")
        expect("closing an open task passes", staged() == [])
        reset()
        write(".gitattributes", "* edit=in-place\n")
        write("chron/e.md", "# E\n\nRewritten.\n")
        expect("a branch cannot grant itself a looser policy", len(staged()) == 1)
        reset()
        write("chron/e.md", "# E\n\nRewritten.\n")
        expect("a named exception passes", staged("x\n\nEdit-policy-exception: chron/e.md\n") == [])
        reset()
        write("chron/new.md", "# New\n")
        sh("add", "-A")
        sh("commit", "-q", "-m", "new entry")
        write("chron/new.md", "# New\n\nRevised before merge.\n")
        expect("a file new on the branch stays editable", staged() == [])
        sh("add", "-A")
        sh("commit", "-q", "-m", "revise")
        expect("range mode passes the same branch", check(tmp, False)[0] == [])
        write("chron/e.md", "# E\n\nRewritten.\n")
        sh("add", "-A")
        sh("commit", "-q", "-m", "rewrite")
        expect("range mode catches a committed write-once edit", len(check(tmp, False)[0]) == 1)
        sh("commit", "-q", "--allow-empty", "-m", "note\n\nEdit-policy-exception: chron/e.md")
        expect("range mode honors an exception in any commit", check(tmp, False)[0] == [])

    if failures:
        print("check-edit-policy self-test FAILED: " + "; ".join(failures), file=sys.stderr)
        return 1
    print("check-edit-policy self-test: 14 cases pass")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--staged", action="store_true", help="check the index (commit-msg hook)")
    mode.add_argument("--range", action="store_true", help="check BASE..HEAD (CI)")
    mode.add_argument("--self-test", action="store_true")
    ap.add_argument("--message", help="the commit message file, for exceptions")
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    root = git(".", "rev-parse", "--show-toplevel").decode().strip()
    message = ""
    if a.message and os.path.exists(a.message):
        with open(a.message, encoding="utf-8", errors="replace") as f:
            message = f.read()
    return report(*check(root, a.staged, message))


if __name__ == "__main__":
    sys.exit(main())
