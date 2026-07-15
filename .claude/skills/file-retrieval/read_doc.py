#!/usr/bin/env python3
"""read_doc.py — the "read" verb for the file-retrieval skill.

Renders one document by path or id (for file-per-document they are the same
thing): a header, then the body. The value is a uniform read verb the model
learns once. When the corpus later holds packed containers, per-format
renderers live here, behind the same interface.

Python 3.11+, stdlib only.

Usage:
    read_doc.py <path-or-id>        Header then full body.
    read_doc.py --meta <path-or-id> One-line summary, no body.

    --root DIR   Root that a relative id resolves against (default: git root, else cwd).
"""
import argparse
import pathlib
import re
import sys

HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$")


def find_root(start: pathlib.Path) -> pathlib.Path:
    p = start.resolve()
    for cand in (p, *p.parents):
        if (cand / ".git").exists():
            return cand
    return p


def title_of(text: str, path: pathlib.Path) -> str:
    for line in text.splitlines()[:40]:
        m = HEADING_RE.match(line)
        if m:
            return m.group(1).strip()
    return path.name


def resolve(arg: str, root: pathlib.Path) -> pathlib.Path:
    """Accept a direct path or a root-relative id."""
    p = pathlib.Path(arg)
    if p.is_file():
        return p
    cand = root / arg
    if cand.is_file():
        return cand
    sys.exit(f"no document at {arg!r} (tried {p} and {cand})")


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("doc")
    ap.add_argument("--meta", action="store_true")
    ap.add_argument("--root")
    args = ap.parse_args()

    here = pathlib.Path(__file__).resolve().parent
    root = pathlib.Path(args.root).resolve() if args.root else find_root(here)
    path = resolve(args.doc, root)

    try:
        text = path.read_bytes().decode("utf-8")
    except (UnicodeDecodeError, OSError) as e:
        sys.exit(f"cannot read {path}: {e}")

    title = title_of(text, path)
    try:
        shown_path = path.relative_to(root).as_posix()
    except ValueError:
        shown_path = str(path)
    nbytes = len(text.encode("utf-8"))
    nlines = text.count("\n") + (1 if text and not text.endswith("\n") else 0)

    if args.meta:
        print(f"{title}  {shown_path}  ({nbytes} bytes, {nlines} lines)")
        return

    print(f"# {title}")
    print(f"path: {shown_path}")
    print(f"size: {nbytes} bytes, {nlines} lines")
    print("---")
    print(text, end="" if text.endswith("\n") else "\n")


if __name__ == "__main__":
    main()
