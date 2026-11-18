#!/usr/bin/env python3
"""governing-docs.py: the one test for whether a file is documentation, the
governing prose an edit needs the owner's permission for. warn-governing-docs.sh
asks it after each edit, and session-detail-caption.py asks it of each file a
session changed, to count the edits still waiting on the owner's sign-off.
Both load it by path, since the hyphenated name cannot be imported.

"Documentation" is the markdown globs of the repo's declared retrieval sources
(skills/ or .claude/skills/file-retrieval/sources.csv) when the repo carries
that registry, else the same shapes as a fallback: docs/**/*.md, root *.md,
skills trees, and any CLAUDE.md or SKILL.md. Never chron/, tracker/tasks/,
blog/, or dump trays, which are written freely by design, and never research
the repo declares in .web-tools.json: a declared path, or the folder of a
declared README.md (commit-consent.py's declared_research reads the same list).

    governing-docs.py ROOT REL    prints the basis and exits 0 when REL is
                                  documentation in the checkout at ROOT, else 1
"""
import csv
import json
import os
import re
import sys

FALLBACK = ["docs/**/*.md", "*.md", "skills/**/*.md", ".claude/skills/**/*.md"]


def glob_hit(rel, g):
    """`*` stays inside one folder and `**/` spans any number, none included;
    fnmatch lets `*` cross `/`, so the root-only `*.md` matched every file."""
    rx = re.escape(g).replace(r"\*\*/", "(?:[^/]+/)*").replace(r"\*", "[^/]*")
    return re.fullmatch(rx, rel) is not None


def documentation(root, rel, cache=None):
    """The basis on which `rel`, a path inside the checkout at `root`, is
    documentation ("the sources registry" or "fallback globs"), or None. A
    `cache` dict, kept across calls for one root, saves rereading its files."""
    if not rel.endswith(".md"):
        return None
    if rel.startswith(("chron/", "tracker/tasks/", "blog/")) or "/dump/" in rel or rel.startswith("dump/"):
        return None
    cache = {} if cache is None else cache
    if "declared" not in cache:
        try:
            with open(os.path.join(root, ".web-tools.json"), encoding="utf-8") as fh:
                cache["declared"] = [(e.get("path") or "").strip("/") for e in json.load(fh).get("research") or []
                                     if isinstance(e, dict)]
        except (OSError, ValueError, AttributeError):
            cache["declared"] = []
    if any(p and (rel == p or (os.path.basename(p) == "README.md" and os.path.dirname(p)
                              and rel.startswith(os.path.dirname(p) + "/"))) for p in cache["declared"]):
        return None
    if "globs" not in cache:
        globs, basis = [], "fallback globs"
        reg = next((c for c in (os.path.join(root, d, "file-retrieval/sources.csv")
                                for d in ("skills", ".claude/skills")) if os.path.exists(c)), "") if root else ""
        if reg:
            try:
                with open(reg, newline="", encoding="utf-8") as fh:
                    globs = [r["glob"] for r in csv.DictReader(fh) if (r.get("glob") or "").endswith(".md")]
            except (OSError, KeyError, csv.Error):
                globs = []
            if globs:
                basis = "the sources registry"
        cache["globs"], cache["basis"] = globs or FALLBACK, basis
    if any(glob_hit(rel, g) for g in cache["globs"]) or os.path.basename(rel) in ("CLAUDE.md", "SKILL.md"):
        return cache["basis"]
    return None


if __name__ == "__main__":
    basis = documentation(sys.argv[1], sys.argv[2]) if len(sys.argv) == 3 else None
    if basis:
        print(basis)
    sys.exit(0 if basis else 1)
