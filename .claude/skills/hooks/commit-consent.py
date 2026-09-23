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
  a MODIFIED documentation file      -> Doc-change-approved, or Approved

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

import csv
import fnmatch
import json
import os
import re
import subprocess
import sys

# Written freely by design, and named here rather than inferred. chron/ and the
# dump trays are records, tracker/tasks/ has its own trigger above, and a blog
# post is nobody's governing statement.
FREE = ("chron/", "blog/", "dump/")
FALLBACK_GLOBS = ("docs/**/*.md", "*.md", "skills/**/*.md", ".claude/skills/**/*.md")
ALWAYS = ("CLAUDE.md", "SKILL.md", "AGENTS.md")


def git(root, *args):
    return subprocess.run(["git", "-C", root, *args], capture_output=True, text=True).stdout


def doc_globs(root):
    """The repo's own declared retrieval sources where it has them, else the
    shapes documentation takes here. Reading the registry keeps one repo's idea
    of what counts as documentation in one place."""
    reg = os.path.join(root, ".claude/skills/file-retrieval/sources.csv")
    if os.path.exists(reg):
        with open(reg, newline="") as fh:
            globs = [r["glob"] for r in csv.DictReader(fh) if r["glob"].endswith(".md")]
        if globs:
            return globs
    return list(FALLBACK_GLOBS)


# A generated file is not authored language, so there is nothing to have
# approved and nobody to quote. Found by running this gate on its own first
# commit, which stopped on docs/README.md: a file the commit hook had just
# rewritten from docs/docs.csv three lines earlier. A gate that stops a
# generator is the fastest way to teach a session that the answer is
# --no-verify.
GENERATED = re.compile(r"generated\b.*\b(from|by)\b|do not hand-edit", re.I)


# A LOG SAYS SO ITSELF. Some documents are records of what happened rather than
# claims about the world: a friction log, a session diary, a run sheet. Nobody
# has to endorse an entry, and stopping one to ask costs a cycle for nothing.
# chron/, blog/ and dump/ are exempt by path because whole trees of a repo are
# that kind; a single file inside docs/ is not reachable that way, and naming it
# here would put one repo's filenames in a portable gate.
#
# So the document says it, in the sentence a reader sees, and this reads the
# same sentence. One statement, one owner, which is the estate's own rule about
# where a fact lives. The shape is the instruction as a person writes it, "do
# not ask ... to approve", rather than a machine token: a reader who has never
# heard of this gate still learns the intake rule from it.
DO_NOT_ASK = re.compile(r"\bdo not ask\b[^.]{0,40}\bapprove\b", re.I)


def declares_free(root, rel):
    try:
        with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as fh:
            head = "".join(next(fh, "") for _ in range(12))
    except OSError:
        return False
    return bool(DO_NOT_ASK.search(head))


def is_generated(root, rel):
    try:
        with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as fh:
            head = "".join(next(fh, "") for _ in range(8))
    except OSError:
        return False
    return bool(GENERATED.search(head))


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
    written to spec and a regenerated index, and the comment above GENERATED
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


def is_doc(rel, globs):
    if rel.startswith(FREE) or "/dump/" in rel or rel.startswith("tracker/tasks/"):
        return False
    if os.path.basename(rel) in ALWAYS:
        return True
    if not rel.endswith(".md"):
        return False
    return any(fnmatch.fnmatch(rel, g) or fnmatch.fnmatch(rel, g.replace("**/", "")) for g in globs)


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
file and put it to the user instead.

When you share the task link in discussion, use the task marker
(docs/SURFACING.md; display form in docs/surfacing-extended.md)."""

DOC_PROMPT = """Commit rejected: {what}.

This commit requires the trailer  Doc-change-approved  (or Approved), one per
documentation file it changes.

A documentation file changes only on new or revised language the user has
directly approved. Quote the user's specific words approving this update:

  Doc-change-approved: "<their words>" -> <path>

If the words you would quote do not approve this file's language, restore the
file and ask before changing it."""


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
    globs = doc_globs(root)
    tasks = [p for st, p in rows if st == "A" and "/tracker/tasks/" in f"/{p}"]
    docs = [p for st, p in rows if st == "M" and is_doc(p, globs)
            and not is_generated(root, p) and not is_copy(root, p)
            and not declares_free(root, p)]
    if not tasks and not docs:
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

    if docs and not approved and not trailers(msg, "Doc-change-approved"):
        what = "documentation changed: " + ", ".join(docs[:3])
        print(DOC_PROMPT.format(what=what), file=sys.stderr)
        for p in problems:
            print(f"\n  The Approved trailer did not settle it: {p}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
