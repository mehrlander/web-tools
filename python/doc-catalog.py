#!/usr/bin/env python3
"""The documentation catalog's computed codes, looked up for a path.

Each code has an owner elsewhere, and this script calls it rather than
repeating its pattern matching. It stores nothing of its own (the plan:
web-tools-private research/2026-11-22-doc-catalog-codes/README.md, Codes).

    position      python/doc-placement.py, bucket() with research()
    edit          `git check-attr edit`, one --stdin call per repo
    approval      skills/hooks/governing-docs.py, documentation()
    program       .web-tools.json programs[].governs, the program-files.sh test
    folder_kind   FOLDER_RULES below, the one rule set this script adds
    role_by_path  ROLE_RULES below: what the path decides; blank means reading does
    links_in      other tracked files in the five repos whose Markdown links or
                  GitHub blob/tree URLs name the path, from one corpus pass

    doc-catalog.py PARENT [--repo NAME] [--all-md] [--csv OUT] [repo:path ...]

PARENT holds the checkouts side by side. With repo:path arguments it prints one
row each. Otherwise it covers every tracked .md in the documentation slots
(docs, readme, contract, skill, residual), or every tracked .md with --all-md.
--repo limits coverage to one checkout and may name one outside the five. Rows
go to stdout as CSV unless --csv names a file; the summary tables follow on
stdout when rows went to a file, on stderr otherwise. python3 stdlib only.
"""
import csv
import importlib.util
import json
import os
import posixpath
import re
import subprocess
import sys
from collections import Counter, defaultdict
from urllib.parse import unquote

REPOS = ["web-tools", "home", "budget-drs", "chat-histories", "web-tools-private"]
HERE = os.path.dirname(os.path.abspath(__file__))
DOC_SLOTS = {"docs", "readme", "contract", "skill", "residual"}
COLUMNS = ["repo", "path", "position", "folder_kind", "edit", "approval",
           "program", "role_by_path", "links_in"]

DATED = re.compile(r"^\d{4}-\d{2}-\d{2}")


def folders(path):
    """The directory segments of a path, the basename left out: a dated file
    in chron/ is an entry, and only a dated folder makes a run."""
    return path.split("/")[:-1]


# Folder kind: the first rule that holds names it. `f` is the row's facts:
# path, position, and the manifest's project paths.
FOLDER_RULES = [
    # research the repo declares in .web-tools.json, the test doc-placement applies
    ("research", lambda f: f["position"] == "research"),
    # a declared project's hub README or anything inside it
    ("project", lambda f: any(f["path"].startswith(p + "/") for p in f["projects"])),
    # a source package: provenance material, dated folder or not
    ("source", lambda f: f["path"].startswith(("data/source/", "source-docs/"))
                         or "/data/source/" in f["path"] or "/source-docs/" in f["path"]),
    # retired material kept for reference
    ("archive", lambda f: "archive" in folders(f["path"])),
    # the landscape's per-state profiles
    ("profile", lambda f: f["path"].startswith("projects/wa-budget-landscape/")),
    # a run: a dated folder or a runs/ folder anywhere on the path
    ("run", lambda f: any(DATED.match(s) or s == "runs" for s in folders(f["path"]))),
    # everything else
    ("code", lambda f: True),
]

# Role by path, first rule that holds; none holding leaves the role to reading.
ROLE_RULES = [
    ("record", lambda r: r["edit"] == "write-once" or r["folder_kind"] == "run"),
    ("generated", lambda r: r["edit"] in ("regenerated", "tool-written")),
    ("subject", lambda r: r["folder_kind"] in ("profile", "source")),
]

# The link corpus: tracked text files, skipping the large and the session logs.
TEXT_EXT = {".md", ".markdown", ".json", ".jsonl", ".csv", ".tsv", ".html", ".htm",
            ".js", ".mjs", ".cjs", ".ts", ".py", ".sh", ".ps1", ".psm1", ".yml",
            ".yaml", ".txt", ".toml"}
MAX_BYTES = 2 * 1024 * 1024
# Every quantifier is bounded and no two overlap, so a long line cannot backtrack.
MD_LINK = re.compile(r"\]\(<?([^()\s#?<>]{1,400})")
GH_URL = re.compile(r"github\.com/mehrlander/([\w.-]{1,100})/(?:blob|tree)/"
                    r"[^/\s)\"'#?<>]{1,100}/([^\s)\"'#?<>\]`]{1,400})")
SCHEME = re.compile(r"^[a-zA-Z][\w+.-]{0,30}:")


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


dp = load(os.path.join(HERE, "doc-placement.py"), "doc_placement")
gd = load(os.path.join(HERE, "..", "skills", "hooks", "governing-docs.py"), "governing_docs")


def manifest(root):
    try:
        with open(os.path.join(root, ".web-tools.json"), encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def edit_attrs(root, paths):
    """{path: edit value} for `paths`, from one `git check-attr --stdin` call."""
    out = subprocess.run(["git", "-C", root, "check-attr", "-z", "--stdin", "edit"],
                         input="\0".join(paths) + "\0", capture_output=True, text=True).stdout
    parts = out.split("\0")
    attrs = {}
    for i in range(0, len(parts) - 2, 3):
        value = parts[i + 2]
        attrs[parts[i]] = "" if value in ("unspecified", "unset") else value
    return attrs


class Repo:
    """One checkout's declarations, read once."""

    def __init__(self, parent, name):
        self.name, self.root = name, os.path.join(parent, name)
        self.md = dp.tracked(self.root, "*.md")
        self.declared = dp.research(self.root)
        m = manifest(self.root)
        self.projects = [p["path"].strip("/") for p in m.get("projects") or []
                         if isinstance(p, dict) and isinstance(p.get("path"), str)]
        self.programs = [p for p in m.get("programs") or [] if isinstance(p, dict)]
        self.attrs = {}
        self.cache = {}

    def program(self, rel):
        covers = lambda g: isinstance(g, str) and (rel == g or (g.endswith("/") and rel.startswith(g)))
        return ";".join(p.get("name") or "" for p in self.programs
                        if any(covers(g) for g in p.get("governs") or []))

    def row(self, rel, links):
        position = dp.bucket(rel, self.declared)
        facts = {"path": rel, "position": position, "projects": self.projects}
        r = {"repo": self.name, "path": rel, "position": position,
             "folder_kind": next(k for k, test in FOLDER_RULES if test(facts)),
             "edit": self.attrs.get(rel, "")}
        # governing-docs.py asks git for one file's edit attribute per call; hand
        # it the value this repo's single --stdin call already returned.
        gd._edit_policy = lambda root, p, staged: self.attrs.get(p, "")
        r["approval"] = "yes" if gd.documentation(self.root, rel, self.cache) else "no"
        r["program"] = self.program(rel)
        r["role_by_path"] = next((k for k, test in ROLE_RULES if test(r)), "")
        r["links_in"] = len(links.get((self.name, rel), ()))
        return r


def link_index(parent, names):
    """{(repo, path): {(repo, file), ...}} for every file that names the path."""
    index = defaultdict(set)
    names = set(names)
    for name in names:
        root = os.path.join(parent, name)
        for f in dp.tracked(root):
            if os.path.splitext(f)[1].lower() not in TEXT_EXT:
                continue
            if name == "web-tools-private" and f.startswith("sessions/20"):
                continue
            full = os.path.join(root, f)
            try:
                if os.path.getsize(full) > MAX_BYTES:
                    continue
                with open(full, encoding="utf-8", errors="ignore") as fh:
                    text = fh.read()
            except OSError:
                continue
            src = (name, f)
            here = posixpath.dirname(f)
            for m in MD_LINK.finditer(text):
                u = unquote(m.group(1))
                if SCHEME.match(u):
                    continue
                tgt = u.lstrip("/") if u.startswith("/") else posixpath.normpath(posixpath.join(here, u))
                repo = name
                if tgt.startswith("../"):
                    parts = tgt.split("/")
                    if len(parts) < 3 or parts[1] not in names:
                        continue
                    repo, tgt = parts[1], "/".join(parts[2:])
                if (repo, tgt) != src:
                    index[(repo, tgt)].add(src)
            for m in GH_URL.finditer(text):
                tgt = (m.group(1), unquote(m.group(2)).rstrip("/.,;:"))
                if tgt != src:
                    index[tgt].add(src)
    return index


def table(rows, key, out):
    values = sorted({r[key] for r in rows})
    label = lambda v: v or "(blank)"
    repos = list(dict.fromkeys(r["repo"] for r in rows))
    count = Counter((r["repo"], r[key]) for r in rows)
    width = max(len(label(v)) for v in values) + 2
    print(f"\nrepo x {key}", file=out)
    print("%-18s" % "" + "".join("%*s" % (width, label(v)) for v in values) + "%8s" % "total", file=out)
    for repo in repos:
        print("%-18s" % repo + "".join("%*d" % (width, count[(repo, v)]) for v in values)
              + "%8d" % sum(count[(repo, v)] for v in values), file=out)
    print("%-18s" % "total" + "".join("%*d" % (width, sum(count[(x, v)] for x in repos)) for v in values)
          + "%8d" % len(rows), file=out)


def main(argv):
    args, opts, i = [], {"repo": None, "csv": None, "all": False}, 1
    while i < len(argv):
        a = argv[i]
        if a in ("--repo", "--csv") and i + 1 < len(argv):
            opts[a[2:]] = argv[i + 1]
            i += 2
            continue
        if a == "--all-md":
            opts["all"] = True
        elif a in ("-h", "--help"):
            print(__doc__)
            return 0
        else:
            args.append(a)
        i += 1
    if not args:
        print(__doc__, file=sys.stderr)
        return 2
    parent, lookups = os.path.abspath(args[0]), args[1:]
    present = [n for n in REPOS if os.path.isdir(os.path.join(parent, n, ".git"))]
    if opts["repo"] and opts["repo"] not in present:
        present.append(opts["repo"])
    repos = {n: Repo(parent, n) for n in present}

    if lookups:
        wanted = []
        for spec in lookups:
            name, _, rel = spec.partition(":")
            if name not in repos or not rel:
                print(f"doc-catalog: {spec} is not repo:path for a checkout under {parent}", file=sys.stderr)
                return 2
            wanted.append((name, rel))
    else:
        covered = [opts["repo"]] if opts["repo"] else present
        wanted = [(n, f) for n in covered for f in repos[n].md
                  if opts["all"] or dp.bucket(f, repos[n].declared) in DOC_SLOTS]

    by_repo = defaultdict(list)
    for name, rel in wanted:
        by_repo[name].append(rel)
    for name, paths in by_repo.items():
        repos[name].attrs = edit_attrs(repos[name].root, paths)
    links = link_index(parent, present)
    rows = [repos[name].row(rel, links) for name, rel in wanted]

    out = open(opts["csv"], "w", newline="", encoding="utf-8") if opts["csv"] else sys.stdout
    w = csv.DictWriter(out, fieldnames=COLUMNS, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    if opts["csv"]:
        out.close()
    if rows and not lookups:
        summary = sys.stdout if opts["csv"] else sys.stderr
        print(f"{len(rows)} files", file=summary)
        for key in ("position", "folder_kind", "role_by_path"):
            table(rows, key, summary)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
