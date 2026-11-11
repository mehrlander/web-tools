#!/usr/bin/env python3
"""Check a repository's probe registries: one row per probe, in a probes.csv
beside a probes folder's declared README.

Run from any checkout: python python/probes.py [--root DIR] [--new FOLDER].
DIR defaults to the current directory. The folders are the `research` entries
in that checkout's .web-tools.json whose kind is probe and whose path is a
README.md; a folder joins when it holds a probes.csv. docs/probes.md is the
contract. --new FOLDER writes an empty registry, its header only.

A registry fails when a required column (probe, date, title, question,
summary) is missing or a row leaves one empty; when two rows share an id or an
id is not lowercase letters, digits and hyphens; when a date is not
YYYY-MM-DD, or a dated id or path names another date than its row's; when a
path names nothing in the folder; when a dated file or folder beside the
registry is named by no row's path; and when a standing is not worked, mixed,
failed or open. A declared folder with no probes.csv is counted and passes.

Ported on 2026-11-10 from home's projects/budget-drs/data/design/tools/
verify-probes.py, whose registry passes unchanged.
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

REQUIRED = ["probe", "date", "title", "question", "summary"]
STANDING = {"worked", "mixed", "failed", "open"}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATED = re.compile(r"^(\d{4}-\d{2}-\d{2})-")


def folders(root):
    """The folders .web-tools.json declares as probe research, by README."""
    try:
        entries = json.loads((root / ".web-tools.json").read_text(encoding="utf-8")).get("research") or []
    except (OSError, ValueError, AttributeError):
        return []
    return sorted({Path(e["path"]).parent for e in entries
                   if isinstance(e, dict) and e.get("kind") == "probe"
                   and isinstance(e.get("path"), str) and Path(e["path"]).name == "README.md"})


def check(folder):
    """Every problem with folder's probes.csv, and its row count."""
    with (folder / "probes.csv").open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        rows, cols = list(reader), reader.fieldnames or []
    errs = [f"probes.csv has no {c} column" for c in REQUIRED if c not in cols]
    if errs:
        return errs, len(rows)
    seen, named = set(), set()
    for n, r in enumerate(rows, 2):
        at = f"probes.csv:{n}"
        pid, date, path = (r["probe"] or "").strip(), (r["date"] or "").strip(), (r.get("path") or "").strip()
        errs += [f"{at}: {c} is empty" for c in REQUIRED if not (r[c] or "").strip()]
        if pid in seen:
            errs.append(f"{at}: {pid} is listed twice")
        seen.add(pid)
        if pid and not SLUG.match(pid):
            errs.append(f"{at}: {pid} is not lowercase letters, digits and hyphens")
        if date and not DATE.match(date):
            errs.append(f"{at}: date {date} is not YYYY-MM-DD")
        for name, value in (("probe", pid), ("path", Path(path).parts[0] if path else "")):
            m = DATED.match(value)
            if m and DATE.match(date) and m.group(1) != date:
                errs.append(f"{at}: {name} {value} is dated {m.group(1)}, not {date}")
        if path:
            target = (folder / path).resolve()
            if not target.exists() or folder.resolve() not in target.parents:
                errs.append(f"{at}: path {path} names nothing in the folder")
            named.add(Path(path).parts[0])
        standing = (r.get("standing") or "").strip()
        if standing and standing not in STANDING:
            errs.append(f"{at}: standing {standing} is not one of {', '.join(sorted(STANDING))}")
    for p in sorted(folder.iterdir()):
        if DATED.match(p.name) and p.name not in named:
            errs.append(f"{p.name} is a dated probe that no row's path names")
    return errs, len(rows)


def main():
    ap = argparse.ArgumentParser(description="Check a repository's probe registries.")
    ap.add_argument("--root", default=".")
    ap.add_argument("--new", metavar="FOLDER", help="write an empty probes.csv into FOLDER")
    a = ap.parse_args()
    root = Path(a.root)
    if a.new:
        reg = root / a.new / "probes.csv"
        if reg.exists():
            sys.exit(f"probes: {reg} exists")
        reg.parent.mkdir(parents=True, exist_ok=True)
        reg.write_text(",".join(REQUIRED) + "\n", encoding="utf-8")
        print(f"probes: wrote {reg}; declare the folder's README.md under research in .web-tools.json, kind probe")
        return
    failed, without = False, 0
    for f in folders(root):
        if not (root / f / "probes.csv").exists():
            without += 1
            continue
        errs, n = check(root / f)
        failed |= bool(errs)
        print(f"probes: {f.as_posix()}/ {'FAILED' if errs else 'ok'}, {n} probes")
        for e in errs:
            print(f"  {e}")
    print(f"probes: {without} declared probe README(s) with no probes.csv beside them")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
