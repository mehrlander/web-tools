#!/usr/bin/env python3
"""Status markers and path declarations: inventory, resolve, and check.

A marker and a declaration, split by subject (the full statement is the markers
skill, .claude/skills/markers/SKILL.md):

  * A **marker** annotates a claim in prose. It lives inline in markdown or as
    the bold lead-in of a GFM alert, and it says that one passage is preserved,
    aged, or incorrect. Markdown only, because a GFM alert renders nowhere else.

  * A **declaration** records the status of a path. It lives in a `.paths.json`
    file, which may sit at a repo root or any workspace root, with entries
    relative to its own directory. Any file type.

They are not two spellings of one thing, and since 2026-09-20 they do not
overlap either. A marker answers to a claim in a sentence; a declaration answers
to a whole path. `Frozen` was the one word that answered to the path, which is
why it left the vocabulary: a whole file being preserved is what a `record`
declaration already says, in a form that reaches `.html`, `.js`, and `.csv` as
well as markdown.

Usage:
  status.py inventory [--root DIR]   markers and declarations, as tables
  status.py declared  [--root DIR]   just the declared paths
  status.py check     [--root DIR]   findings only; exit 1 if any
  status.py is PATH   [--root DIR]   what status PATH carries, and who says so
  status.py gate      [--root DIR]   refuse a staged Wrong marker on a non-record

Exit codes: 0 clean, 1 findings (check only), 2 usage error.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# Three, and the set is closed. A `Corrected` fourth was added 2026-09-16 and
# A marker's kind describes one passage. `Corrected` was removed 2026-09-19 (a note
# saying the text was already fixed is not a marker: in a living document the
# move is to fix the sentence and leave no note) and `Frozen` on 2026-09-20.
#
# Frozen went for a structural reason rather than a stylistic one. A census of
# all 21 in the estate found two doing what a marker does, annotating a section
# inside a live document, and both of those were one file whose real repair is a
# split. Twelve asserted that a WHOLE file was preserved, which is a property of
# the path; six more sat in a live README and described a frozen NEIGHBOUR,
# which is a false statement in marker grammar and the one case the check could
# not catch, since it only ever ran declaration -> banner. All of those are now
# `record` or `frozen` entries in a `.paths.json`.
KINDS = ("Stale", "Wrong")

# **Kind YYYY[-MM[-DD]] [(note)] [-> target]:**
#
# Two deliberate widenings over the first draft of this pattern, each made
# because the stricter form silently dropped markers people had actually
# written, which is the convention's bug rather than the author's:
#
#   * the parenthetical, reached for twice to cite the tracker task that made
#     the call (`**Stale 2026-07-06 (tracker task 0032):**`);
#   * a target that is prose, inline code, or a markdown link with spaces in
#     its label, not only a bare path (`-> [the app's Funding view](...)`,
#     `-> two successors below.`). Five markers in the estate use one of those.
#
# The close is `:**` or `.**`, since a prose target ends its own sentence.
MARKER = re.compile(
    r"\*\*(" + "|".join(KINDS) + r")\s+"      # kind
    r"(\d{4}(?:-\d{2}){0,2})"                  # date, to whatever precision
    r"(?:\s*\(([^)]*)\))?"                     # optional note
    r"(?:\s*→\s*(.+?))?"                  # optional living-copy target
    r"(?:\s*[:.]\*\*"                          # close, or...
    r"|[,:]\s)"                                # ...a lead-in clause, below
)

# Anything that opens like a marker but did not parse. Two conditions, and both
# are load-bearing:
#
#   * the kind is followed by whitespace, which separates an attempted marker
#     from ordinary bold prose (`**Stale**: aged out of truth`, a definition
#     list in the convention's own worked-examples entry, or
#     `**Stale-branch piggybacking**`);
#   * a digit follows, inside the same bold span. A marker's shape mandates a
#     date, so an attempt at one has a date in it however badly formed
#     (`**Stale July 2026:**`), while a bold lead-in that merely opens with the
#     word has none. Without this the detector fired on `**Stale claims.**` and
#     `**Wrong references**`, ordinary prose in two skill files, and a check
#     whose every finding is a false positive is one nobody reads.
NEAR_MISS = re.compile(r"\*\*(" + "|".join(KINDS) + r")\s+[^*]*\d")

# `status: <kind> YYYY-MM-DD; note` in frontmatter.
STATUS_LINE = re.compile(
    r"^status:\s*(stale|wrong)\s+(\d{4}(?:-\d{2}){0,2})", re.IGNORECASE
)

# A markdown link target: [text](path). Markers may write either form.
MD_LINK = re.compile(r"^\[[^\]]*\]\(([^)]+)\)$")

# Generated aggregations inline the bodies of their sources, so a marker in a
# source entry would otherwise be counted twice. Handled by deduplication in
# scan_markers, not by skipping filenames: an `index.md` is as often a
# hand-authored entry point as a generated roll-up, and skipping the name
# silently dropped real markers written correctly by any reasonable reading
# (chat-histories `annotations/code/powershell/index.md`, home `repos/index.md`).
# A dropped marker is worse than a double-counted one, because the audit is the
# only thing that makes the set auditable rather than merely greppable.
SKIP_NAMES: set[str] = set()
SKIP_DIRS = {".git", "node_modules", "dist", "__pycache__", ".venv"}


# --------------------------------------------------------------------------
# walking


def repo_root(start: Path) -> Path:
    try:
        out = subprocess.run(
            ["git", "-C", str(start), "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        )
        return Path(out.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return start


def walk_files(root: Path, suffix: str | None = None, name: str | None = None):
    """Tracked and new-but-not-ignored files where git is available, else a
    filtered walk. `--others --exclude-standard` matters: a declaration written
    this session is not yet tracked, and a tool that cannot see it until it is
    committed is useless at exactly the moment someone is declaring something.
    """
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z",
             "--cached", "--others", "--exclude-standard"],
            capture_output=True, text=True, check=True,
        )
        rels = sorted(set(r for r in out.stdout.split("\0") if r))
    except (subprocess.CalledProcessError, FileNotFoundError):
        rels = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fn in filenames:
                rels.append(str(Path(dirpath, fn).relative_to(root)))
    for rel in sorted(rels):
        if suffix and not rel.endswith(suffix):
            continue
        if name and Path(rel).name != name:
            continue
        yield rel


# --------------------------------------------------------------------------
# declarations


class Declaration:
    """One declared entry, resolved against the repo root.

    `key` is which property the entry asserts: `frozen` (do not edit this file
    at all) or `record` (append to it, but its existing text stays as written).
    They are separate properties about the same kind of target, so one file can
    carry both lists and an entry belongs to exactly one.
    """

    def __init__(self, source: str, base: str, raw, key: str = "frozen"):
        self.key = key
        self.source = source          # repo-relative path of the .paths.json
        if isinstance(raw, str):
            raw = {"path": raw}
        if not isinstance(raw, dict) or "path" not in raw:
            raise ValueError(f"{source}: entry is not a string or {{path: ...}}")
        self.entry = raw["path"]
        self.is_dir = self.entry.endswith("/")
        self.path = os.path.normpath(os.path.join(base, self.entry)) if base else self.entry.rstrip("/")
        if self.is_dir:
            self.path = self.path.rstrip("/") + "/"
        self.since = raw.get("since", "")
        self.why = raw.get("why", "")
        self.excepts = raw.get("except", []) or []

    def covers(self, rel: str) -> bool:
        if self.is_dir:
            if not rel.startswith(self.path):
                return False
            inner = rel[len(self.path):]
        else:
            if rel != self.path:
                return False
            inner = Path(rel).name
        return not any(fnmatch.fnmatch(inner, p) for p in self.excepts)

    @property
    def depth(self) -> int:
        return self.path.count("/")


def load_declarations(root: Path) -> tuple[list[Declaration], list[str]]:
    """Every `.paths.json` in the tree, entries resolved to repo-relative."""
    decls, problems = [], []
    for rel in walk_files(root, name=".paths.json"):
        base = str(Path(rel).parent)
        base = "" if base == "." else base
        try:
            data = json.loads((root / rel).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            problems.append(f"{rel}: unreadable ({exc})")
            continue
        for key in ("frozen", "record"):
            for raw in data.get(key, []):
                try:
                    decls.append(Declaration(rel, base, raw, key))
                except ValueError as exc:
                    problems.append(str(exc))
    # Deepest declaration first, so nearest-wins is just "take the first match".
    decls.sort(key=lambda d: (-d.depth, d.path))
    return decls, problems


def status_of(rel: str, decls: list[Declaration], key: str | None = None) -> Declaration | None:
    """The nearest declaration covering `rel`, optionally of one key only.

    `frozen` and `record` are separate properties, so one path can carry both and
    a caller asking about one must not be answered with the other. Without a key
    this returns whichever declaration is nearest, which is what `is` wants.
    """
    for d in decls:
        if key is not None and d.key != key:
            continue
        if d.covers(rel):
            return d
    return None


# --------------------------------------------------------------------------
# markers


class Marker:
    def __init__(self, rel, line, kind, date, note, target):
        self.rel, self.line = rel, line
        self.kind, self.date = kind, date
        self.note, self.target = note or "", target or ""

    def resolved_target(self, root: Path) -> Path | None:
        """The arrow target as a path on disk, or None when there is nothing
        to check: no target at all, an external URL, or a prose target such as
        `two successors below`, which points a reader rather than a filesystem.
        """
        if not self.target:
            return None
        t = self.target.strip()
        m = MD_LINK.match(t)
        if m:
            t = m.group(1)                       # a link's URL is always a path
        else:
            t = t.strip("`")
            if " " in t or not ("/" in t or re.search(r"\.\w{1,6}$", t)):
                return None                      # prose, not a path
        t = t.split("#", 1)[0]
        if not t or t.startswith(("http://", "https://", "mailto:")):
            return None
        # A bare path may be written repo-relative or relative to the marker.
        for cand in ((root / t), (root / Path(self.rel).parent / t)):
            if cand.exists():
                return cand
        return root / Path(self.rel).parent / t


def scan_text(text: str, rel: str):
    """Parse one document's markers. Split out of scan_markers so the gate can
    read a blob out of the index rather than a file off disk: what a commit
    would carry is not always what the working tree holds."""
    markers, malformed, status_lines = [], [], []
    in_frontmatter = False
    in_fence = False
    for n, line in enumerate(text.splitlines(), 1):
        if n == 1 and line.strip() == "---":
            in_frontmatter = True
            continue
        if in_frontmatter:
            if line.strip() == "---":
                in_frontmatter = False
            else:
                sm = STATUS_LINE.match(line.strip())
                if sm:
                    status_lines.append((rel, line.strip()))
            continue
        # A marker inside a code fence is an illustration of the shape, not
        # a claim about this file. The convention docs show a worked example
        # with a real date and a target that deliberately does not exist
        # (`-> ../timeline.md`), and it was reported as a broken target in
        # every repo that carries the docs.
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        found = list(MARKER.finditer(line))
        for m in found:
            mk = Marker(rel, n, m.group(1), m.group(2), m.group(3), m.group(4))
            # The line verbatim, for identity in dedupe_inlined. An inlined
            # copy is byte-identical to its source; two markers that merely
            # share a kind and date are not the same marker.
            mk.text = line.strip()
            markers.append(mk)
        if not found and NEAR_MISS.search(line):
            # Placeholders in the convention docs themselves use YYYY-MM-DD.
            if "YYYY" not in line:
                malformed.append((rel, n, line.strip()[:110]))
    return markers, malformed, status_lines


def scan_markers(root: Path) -> tuple[list[Marker], list[tuple[str, int, str]], list[tuple[str, str]]]:
    markers, malformed, status_lines = [], [], []
    for rel in walk_files(root, suffix=".md"):
        if Path(rel).name in SKIP_NAMES:
            continue
        try:
            text = (root / rel).read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        mk, mal, st = scan_text(text, rel)
        markers += mk
        malformed += mal
        status_lines += st
    return markers, malformed, status_lines


def duplicate_lines(markers: list["Marker"]) -> list[tuple[str, list["Marker"]]]:
    """Markers whose source line is byte-identical, grouped.

    Reported rather than dropped. A generated roll-up that inlines its sources
    (home's `chron/blog/index.md`) produces one such pair, and so do two frozen
    workspaces carrying the same banner and one file marking two claims the same
    way. Only the first is a double-count, and nothing in the text distinguishes
    them, so collapsing on content silently deletes real markers. An explained
    duplicate costs a line of output; a dropped marker costs the audit.
    """
    groups: dict[str, list[Marker]] = {}
    for m in markers:
        groups.setdefault(getattr(m, "text", ""), []).append(m)
    return sorted(((t, g) for t, g in groups.items() if len(g) > 1),
                  key=lambda kv: kv[1][0].rel)


# --------------------------------------------------------------------------
# reporting


def fmt_table(rows, headers):
    if not rows:
        return "  (none)"
    widths = [max(len(str(r[i])) for r in [headers] + rows) for i in range(len(headers))]
    out = ["  " + "  ".join(str(h).ljust(widths[i]) for i, h in enumerate(headers)).rstrip()]
    for r in rows:
        out.append("  " + "  ".join(str(c).ljust(widths[i]) for i, c in enumerate(r)).rstrip())
    return "\n".join(out)


def collect_findings(root, decls, decl_problems, markers, malformed):
    findings = []
    for p in decl_problems:
        findings.append(("declaration", p))
    for d in decls:
        target = root / d.path.rstrip("/")
        if not target.exists():
            findings.append(("declaration", f"{d.source}: declared path does not exist: {d.path}"))
        elif d.is_dir:
            if not any(target.rglob("*")):
                findings.append(("declaration", f"{d.source}: declared directory is empty: {d.path}"))
        elif target.stat().st_size == 0:
            # A pinned artifact truncated to nothing still "exists". This is the
            # `[ -s "$f" ]` the two hardcoded loops in home's verify suite ran.
            findings.append(("declaration", f"{d.source}: declared path is empty: {d.path}"))
    for rel, n, snippet in malformed:
        findings.append(("marker", f"{rel}:{n}: marker does not parse: {snippet}"))
    for m in markers:
        t = m.resolved_target(root)
        if t is not None and not t.exists():
            findings.append(("marker", f"{m.rel}:{m.line}: arrow target missing: {m.target}"))
    # There was a crosscheck here until 2026-09-20: a markdown file declared
    # frozen had to carry a `Frozen` banner, so a reader opening it could see so.
    # It went with `Frozen`, and the measurement is why it went quietly. Every
    # `frozen` entry in the estate is a directory or a non-markdown artifact, so
    # the rule reached zero paths and had never once fired. What a reader sees is
    # now an ordinary sentence in the neighbouring README, which no check can
    # verify and which was doing the real work anyway.
    return findings


def cmd_inventory(root, args):
    decls, decl_problems = load_declarations(root)
    markers, malformed, status_lines = scan_markers(root)

    print(f"Markers: {len(markers)} inline, {len(status_lines)} frontmatter status lines")
    nfrozen = sum(1 for d in decls if d.key == "frozen")
    print(f"Declared: {nfrozen} frozen, {len(decls) - nfrozen} record, "
          f"from {len(set(d.source for d in decls))} .paths.json file(s)")
    print()

    print("MARKERS")
    rows = [(m.kind, m.date, m.target or "-", f"{m.rel}:{m.line}")
            for m in sorted(markers, key=lambda m: (m.kind, m.date, m.rel))]
    print(fmt_table(rows, ("KIND", "DATE", "SEE-TARGET", "LOCATION")))
    print()

    dups = duplicate_lines(markers)
    if dups:
        print("DUPLICATE LINES (counted once each; a roll-up that inlines a source")
        print("produces these, and so do two files marking a claim the same way)")
        for text, group in dups:
            print(f"  {len(group)}x  {text[:88]}")
            for m in group:
                print(f"       {m.rel}:{m.line}")
        print()

    # The key is a column rather than the heading: this table listed `record`
    # entries under the word FROZEN until 2026-09-20, which is the two-property
    # confusion showing up in the one place a reader would look to resolve it.
    print("DECLARED PATHS")
    rows = [(d.key, d.path, d.since or "-", (d.why or "-")[:40], d.source)
            for d in sorted(decls, key=lambda d: (d.key, d.path))]
    print(fmt_table(rows, ("KEY", "PATH", "SINCE", "WHY", "DECLARED IN")))

    if status_lines:
        print()
        print("FRONTMATTER STATUS")
        print(fmt_table([(rel, line) for rel, line in status_lines], ("FILE", "LINE")))

    findings = collect_findings(root, decls, decl_problems, markers, malformed)
    print()
    if findings:
        print(f"FINDINGS ({len(findings)})")
        for kind, msg in findings:
            print(f"  [{kind}] {msg}")
    else:
        print("FINDINGS: none")
    return 0


def cmd_declared(root, args):
    decls, problems = load_declarations(root)
    for d in sorted(decls, key=lambda d: d.path):
        print(d.path)
    for p in problems:
        print(f"# {p}", file=sys.stderr)
    return 0


def cmd_check(root, args):
    decls, decl_problems = load_declarations(root)
    markers, malformed, _ = scan_markers(root)
    findings = collect_findings(root, decls, decl_problems, markers, malformed)
    if not findings:
        frozen = sum(1 for d in decls if d.key == "frozen")
        print(f"status: clean ({len(markers)} markers, {frozen} declared frozen, "
              f"{len(decls) - frozen} declared record)")
        return 0
    print(f"status: {len(findings)} finding(s)", file=sys.stderr)
    for kind, msg in findings:
        print(f"  [{kind}] {msg}", file=sys.stderr)
    return 1


def cmd_is(root, args):
    rel = os.path.relpath(os.path.abspath(args.path), root)
    rel = rel.replace(os.sep, "/")
    decls, _ = load_declarations(root)
    d = status_of(rel, decls)
    if d is None:
        print(f"{rel}: live (no declaration)")
        return 0
    bits = [f"{rel}: {d.key.upper()}"]
    if d.since:
        bits.append(f"since {d.since}")
    print(" ".join(bits))
    print(f"  declared by: {d.source} (entry: {d.entry})")
    if d.why:
        print(f"  why: {d.why}")
    if d.excepts:
        print(f"  except: {', '.join(d.excepts)}")
    return 0


def cmd_gate(root, args):
    """Refuse a `Wrong` marker added to a file no declaration calls a record.

    The whole check, and why it is worth having, in one paragraph. A `Wrong`
    marker says "this claim stands here, go elsewhere for the truth", which is
    correct in a dated record and wrong in a living document, where the move is
    to fix the sentence and leave no note behind. So the only thing to refuse is
    a `Wrong` on a path nothing declares a record, and the refusal is a fact
    lookup rather than a question: no advice, no reflection prompt, no chance
    for a session to write a plausible wrong justification and pass.

    It reads the STAGED content, not the working tree, so what it judges is what
    the commit would carry. Markers already present on HEAD are left alone: the
    gate exists to stop a new one, not to make an existing file uncommittable.
    """
    decls, _ = load_declarations(root)
    staged = subprocess.run(
        ["git", "-C", str(root), "diff", "--cached", "--name-only", "--diff-filter=ACM"],
        capture_output=True, text=True,
    ).stdout.split()
    bad = []
    for rel in staged:
        if not rel.endswith(".md"):
            continue
        if status_of(rel, decls, key="record") is not None:
            continue
        before = subprocess.run(["git", "-C", str(root), "show", f"HEAD:{rel}"],
                                capture_output=True, text=True).stdout
        after = subprocess.run(["git", "-C", str(root), "show", f":{rel}"],
                               capture_output=True, text=True).stdout
        was = {m.text for m in scan_text(before, rel)[0] if m.kind == "Wrong"}
        for m in scan_text(after, rel)[0]:
            if m.kind == "Wrong" and m.text not in was:
                bad.append((rel, m.line))
    if not bad:
        return 0
    where = ", ".join(f"{r}:{n}" for r, n in bad[:8])
    print(
        f"Commit rejected: a Wrong marker was added to a file no declaration calls a record "
        f"({where}).\n\n"
        "Wrong preserves a claim in a dated record, which is why it needs the declaration.\n"
        "In a living document, fix the sentence and leave no note: git holds what it said.\n\n"
        "If the file really is a record, declare it in .paths.json under \"record\".",
        file=sys.stderr,
    )
    return 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("command", choices=("inventory", "declared", "check", "is", "gate"))
    ap.add_argument("path", nargs="?", help="for `is`: the path to look up")
    ap.add_argument("--root", default=".", help="repo root (default: git toplevel of cwd)")
    args = ap.parse_args(argv)

    root = repo_root(Path(args.root).resolve())
    if args.command == "is" and not args.path:
        ap.error("`is` needs a path")
    return {
        "inventory": cmd_inventory,
        "declared": cmd_declared,
        "check": cmd_check,
        "is": cmd_is,
        "gate": cmd_gate,
    }[args.command](root, args)


if __name__ == "__main__":
    sys.exit(main())
