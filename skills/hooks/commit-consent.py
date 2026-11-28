#!/usr/bin/env python3
"""commit-msg gate: a commit that files a task, or rewrites a governing
document, has to say what it rests on.

WHAT THIS IS FOR. Twice a session did something it had permission-shaped
reasons to believe it was allowed to do, and was wrong about the permission
rather than about the change. No hook can settle that from the repository,
because "did the user ask for this" is a fact about a conversation. So this
does not try to settle it. It stops the commit, states the concern in three
lines, and requires one named field to be filled. A session that already knows
the rule fills the field in its first message and never sees the prompt, which
is the property that keeps it from becoming the thing everyone dismisses.

THE TWO TRIGGERS, and both are narrow on purpose.

  a new file under tracker/tasks/    -> Task-named-by-user, or Approved
  a MODIFIED documentation file, on main -> Doc-change-approved, or Approved

On any other branch a modified or new document passes with a reminder: its
wording reaches the owner as a commit, and their approval comes before the
merge rather than before the commit. A detached HEAD counts as main, since it can be
pushed straight there.

Modified, not added: a new document retracts nothing and overrides nothing, so
there is no prior claim for a general go-ahead to have been stretched over. The
first draft of this gate fired on a new envelope contract written to spec by the
session that had just been asked to build it, which is the false positive that
sinks a gate before anyone has read its message twice.

THE TWO WAYS THE FIELD IS FILLED, and they differ in what can be checked.

  Approved: <id>            cites a verdict at <id>.verdict.json, written by
                            the reviewer's own browser through their token
                            (docs/envelopes/approval.md). Resolvable: this
                            checks the file exists, that its decision is an
                            approval, and that the paths it names cover what
                            this commit touches.

  Task-named-by-user: "…"   quotes the words approval arrived in. Not
  Doc-change-approved: "…"  resolvable against anything, and not pretending to
                            be: it is a receipt, permanent and greppable, so a
                            thin one is legible later rather than invisible.

WHAT THE FIELD IS FOR. Both forms record that the prose in this commit was seen
before it was approved. A citation carries the prose itself, so the verdict
names what it saw. A quotation does not, so quote the words that answered the
prose, not the words that authorized the task. If you have not shown the prose,
show it before you commit.

Usage, from a repo's .githooks/commit-msg:
    python3 <this> "$1"           # $1 is the message file git passes
Exit 0 to allow, 1 to reject with the prompt on stderr.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

# What counts as documentation is governing-docs.py beside this file, the one
# test the edit-time warning and the session caption also ask, read here from
# the index rather than the working tree. It already leaves out what has no
# wording to approve: chron/, the dump trays, tracker/tasks/ (which has its own
# trigger above), declared research, and a generated file, which this gate first
# stopped on its own commit when docs/README.md had just been rewritten from
# docs/docs.csv. A gate that stops a generator is the fastest way to teach a
# session that the answer is --no-verify.
def engine():
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "governing_docs", os.path.join(os.path.dirname(os.path.abspath(__file__)), "governing-docs.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(root, *args):
    return subprocess.run(["git", "-C", root, *args], capture_output=True, text=True).stdout


def is_copy(root, rel):
    """A vendored copy is not authored language either, and nothing in the file
    says so. A generated artifact usually announces itself in a banner, which
    is what is_generated reads; a copy announces nothing, because being
    byte-identical to its source is the whole point and a banner would break the
    check that holds it there.

    Found by this gate stopping its own repo's CI. web-tools ships three docs
    inside a plugin skill by copying them from docs/, main revised one of them,
    and the commit that re-ran the copier was refused: the language had been
    approved where it was written, and the commit propagating it had nothing to
    ask about. That is the third false positive of one family, after a new file
    written to spec and a regenerated index, and the comment above engine()
    already says why they matter more than they look: a gate that stops a
    generator teaches a session that the answer is --no-verify.

    Same basename and identical bytes, against the index rather than the working
    tree, so the twin is a file this commit is being measured against. Narrow on
    purpose: two unrelated documents that happen to share a name will not be
    identical, and a copy that has drifted from its source is authored again and
    is caught again."""
    name = os.path.basename(rel)
    listed = git(root, "ls-files", "--full-name", "*/" + name, name).split()
    twins = [t for t in listed if t != rel]
    if not twins:
        return False
    blob = git(root, "show", f":{rel}")
    return any(blob and git(root, "show", f"HEAD:{t}") == blob for t in twins)


# The branches a document commit must already carry approval on.
PROTECTED = ("main", "master")


def on_branch(root):
    """True on a named branch other than main, where the merge is the gate."""
    name = git(root, "symbolic-ref", "--short", "-q", "HEAD").strip()
    return bool(name) and name not in PROTECTED


def staged(root):
    """(status, path) for what this commit carries. A rename reports its new
    path, which is the one a reader will look for."""
    out = git(root, "diff", "--cached", "--name-status", "--find-renames")
    rows = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            rows.append((parts[0][0], parts[-1]))
    return rows


def trailers(msg, key):
    return [m.group(1).strip() for m in re.finditer(rf"^{key}:\s*(.+)$", msg, re.M)]


def verdict_for(root, ident):
    """The approval record a citation resolves to, or None. Searched rather than
    computed from one path, since reply_to's directory is the envelope's choice
    and a gate that hardcoded it would break the first time it moved."""
    hits = [p for p in git(root, "ls-files").splitlines()
            if os.path.basename(p) == f"{ident}.verdict.json"]
    for p in hits:
        try:
            with open(os.path.join(root, p)) as fh:
                return json.load(fh)
        except (OSError, ValueError):
            return None
    return None


def check_citation(root, ident, paths):
    v = verdict_for(root, ident)
    if v is None:
        return f'no approval record named "{ident}" is committed here'
    if v.get("decision") not in ("approved", "approved-with-edits"):
        return f'approval "{ident}" reads {v.get("decision", "no decision")}'
    covered = set(v.get("paths") or [])
    missing = [p for p in paths if p not in covered]
    if missing:
        return f'approval "{ident}" does not cover {", ".join(sorted(missing)[:4])}'
    return None


TASK_PROMPT = """Commit rejected: {what}.

This commit requires the trailer  Task-named-by-user  (or Approved).

Filing a task needs the user to name it. A general go-ahead is not sufficient,
even where it says to use your judgment. Quote their words, and say which task
they name:

  Task-named-by-user: "<their words>" -> <task title>

If you cannot quote words that name this task, do not commit it. Unstage the
file and put it to the user instead. Ask plainly and quote whatever they answer;
never tell them what words to use.

When you share the task link in discussion, use the task marker
(docs/TRACKER.md, under the board: `🎫 [title](tasks/<file>.md)`)."""

DOC_PROMPT = """Commit rejected: {what}.

On main, a documentation change needs the trailer  Doc-change-approved  (or
Approved), one per documentation file it changes. Commit it on a branch
instead, offer it to the user as the Review section of the doc-craft skill
describes, and merge after they approve it. To commit it here, quote their
approval:

  Doc-change-approved: "<their words>" -> <path>

Ask plainly and quote whatever they answer; never tell them what words to use."""

DOC_REMINDER = """Note: {what}.

File a documentation user call for each changed document now, as the Review
section of the doc-craft skill describes, rather than quoting the wording in
chat. Name this change again whenever they ask what is
open, offer it again if they ask to merge, and merge only after they approve the
wording."""


def main(argv):
    if len(argv) < 2:
        return 0
    root = git(".", "rev-parse", "--show-toplevel").strip() or "."
    try:
        with open(argv[1], encoding="utf-8") as fh:
            msg = fh.read()
    except OSError:
        return 0
    # A merge or a revert is not an authored change, and neither is a fixup.
    if re.match(r"^(Merge|Revert|fixup!|squash!)\b", msg.strip()):
        return 0

    rows = staged(root)
    tasks = [p for st, p in rows if st == "A" and "/tracker/tasks/" in f"/{p}"]
    try:
        test, cache = engine().documentation, {}
    except (OSError, ImportError, SyntaxError):
        test = None   # an engine that cannot load must never block a commit
    def doc(p):
        return bool(test and test(root, p, cache, staged=True)) and not is_copy(root, p)
    docs = [p for st, p in rows if st == "M" and doc(p)]
    new_docs = [p for st, p in rows if st == "A" and doc(p)]
    if not tasks and not docs and not new_docs:
        return 0

    cited = trailers(msg, "Approved")
    problems = []
    for ident in cited:
        bad = check_citation(root, ident, tasks + docs)
        if bad:
            problems.append(bad)
    approved = bool(cited) and not problems

    if tasks and not approved and not trailers(msg, "Task-named-by-user"):
        what = f"{len(tasks)} new task file(s): " + ", ".join(tasks[:3])
        print(TASK_PROMPT.format(what=what), file=sys.stderr)
        for p in problems:
            print(f"\n  The Approved trailer did not settle it: {p}", file=sys.stderr)
        return 1

    if (docs or new_docs) and on_branch(root) and not approved and not trailers(msg, "Doc-change-approved"):
        what = "documentation changed: " + ", ".join((docs + new_docs)[:3])
        print(DOC_REMINDER.format(what=what), file=sys.stderr)
        return 0

    if docs and not approved and not trailers(msg, "Doc-change-approved"):
        what = "documentation changed: " + ", ".join(docs[:3])
        print(DOC_PROMPT.format(what=what), file=sys.stderr)
        for p in problems:
            print(f"\n  The Approved trailer did not settle it: {p}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
