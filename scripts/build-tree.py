#!/usr/bin/env python3
"""Render a repository file tree as a linked markdown table for chat.

Emits the tree in one of three shapes (see docs/markdown-in-chat.md for why
these and not nested bullets):

  codespan  (default) box-drawing prefix (|-- etc.) inside an inline code
            span so it renders monospace and aligned, then a filetype icon
            and the name linked to its GitHub blob/tree URL. Corner art
            survives because the code span preserves whitespace; the icon
            and link sit outside it, so they stay tappable.
  braille   invisible U+2800 indentation (no connectors) plus filetype
            icons. Cleaner for shallow trees. Uses the braille blank because
            ASCII space, nbsp, and tab are all trimmed at the start of a
            markdown table cell.
  ascii     a plain fenced code block, aligned, no links. The pasteable
            fallback.

The script emits structure, links, and icons. It leaves the optional gloss
column to be filled by hand, since a one-line "what this is" needs judgement
the walker does not have (same split as build-board.py: the tool does the
rollup, the human writes the prose).

Usage:
  build-tree.py <root> [options]

  --repo owner/repo   repo for the blob/tree URLs (default: infer from
                      `git remote get-url origin`)
  --ref REF           branch/tag/sha the links point at (default: main)
  --depth N           levels below <root> to show (default: unlimited;
                      1 = direct children only)
  --mode MODE         codespan | braille | ascii (default: codespan)
  --all               include every file (default: tracked files only, via
                      `git ls-files`)
  --ignore GLOB       extra name to prune; repeatable. Always pruned:
                      .git node_modules dist
  --gloss             add an empty "What it is" column to fill in by hand
  --indent N          braille blanks per level in braille mode (default: 3)

Python 3 stdlib only.
"""
import argparse
import fnmatch
import os
import subprocess
import sys
from collections import defaultdict

BRAILLE = "⠀"  # printable blank; survives the table-cell trim
ALWAYS_IGNORE = {".git", "node_modules", "dist"}

ICON_DIR = "\U0001F4C1"      # folder
ICON_DEFAULT = "\U0001F4C4"  # page
ICONS = {
    ".py": "\U0001F40D",   # snake
    ".js": "\U0001F4DC", ".mjs": "\U0001F4DC", ".cjs": "\U0001F4DC",
    ".ts": "\U0001F4DC", ".tsx": "\U0001F4DC", ".jsx": "\U0001F4DC",
    ".html": "\U0001F310", ".htm": "\U0001F310",
    ".css": "\U0001F3A8",
    ".json": "⚙️", ".toml": "⚙️",
    ".yml": "⚙️", ".yaml": "⚙️",
    ".sh": "⚙️", ".bash": "⚙️",
    ".png": "\U0001F5BC️", ".jpg": "\U0001F5BC️",
    ".jpeg": "\U0001F5BC️", ".gif": "\U0001F5BC️",
    ".svg": "\U0001F5BC️", ".webp": "\U0001F5BC️",
}


def icon_for(name, is_dir):
    if is_dir:
        return ICON_DIR
    return ICONS.get(os.path.splitext(name)[1].lower(), ICON_DEFAULT)


def infer_repo():
    try:
        url = subprocess.check_output(
            ["git", "remote", "get-url", "origin"], text=True
        ).strip()
    except Exception:
        return None
    for sep in ("github.com:", "github.com/"):
        if sep in url:
            tail = url.split(sep, 1)[1]
            return tail[:-4] if tail.endswith(".git") else tail
    return None


def tracked_paths(root):
    try:
        out = subprocess.check_output(["git", "ls-files", "-z", root], text=True)
    except Exception:
        return None
    return [p for p in out.split("\0") if p]


def build_index(root, ignore, tracked_only):
    """Return (root_key, dirs_of, files_of) for the subtree under root.

    Keys are repo-relative directory paths ("." for the repo root). Depth is
    NOT applied here; the walk applies it, so the index is the full subtree.
    """
    root = root.rstrip("/") or "."
    dirs_of = defaultdict(set)
    files_of = defaultdict(list)

    def pruned(name):
        if name in ALWAYS_IGNORE:
            return True
        return any(fnmatch.fnmatch(name, g) for g in ignore)

    if tracked_only:
        paths = tracked_paths(root)
        if paths is None:
            tracked_only = False

    if tracked_only:
        for p in paths:
            segs = p.split("/")
            if any(pruned(s) for s in segs):
                continue
            parent = os.path.dirname(p) or "."
            files_of[parent].append(os.path.basename(p))
            cur = os.path.dirname(p)
            while cur and cur != root and cur != ".":
                par = os.path.dirname(cur) or "."
                dirs_of[par].add(os.path.basename(cur))
                cur = par
        files_of.setdefault(root, [])
    else:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = sorted(d for d in dirnames if not pruned(d))
            rel = dirpath.rstrip("/") or "."
            if rel.startswith("./"):
                rel = rel[2:]
            dirs_of[rel] = set(dirnames)
            files_of[rel] = sorted(f for f in filenames if not pruned(f))

    return root, dirs_of, files_of


def walk_rows(root, dirs_of, files_of, max_depth):
    """Yield (depth, name, relpath, is_dir, is_last) in display order.

    depth is 0-based below root (0 = a direct child). max_depth is the number
    of levels to show; None is unlimited.
    """
    def recurse(d, depth):
        if max_depth is not None and depth >= max_depth:
            return
        subs = sorted(dirs_of.get(d, []))
        files = sorted(files_of.get(d, []))
        entries = [(s, True) for s in subs] + [(f, False) for f in files]
        for i, (name, is_dir) in enumerate(entries):
            rel = f"{d}/{name}" if d != "." else name
            last = i == len(entries) - 1
            yield depth, name, rel, is_dir, last
            if is_dir:
                yield from recurse(rel, depth + 1)

    yield from recurse(root, 0)


def node_url(repo, ref, relpath, is_dir):
    kind = "tree" if is_dir else "blob"
    return f"https://github.com/{repo}/{kind}/{ref}/{relpath}"


def prefix_codespan(stack):
    """Classic tree prefix for the current row, from the ancestor last-flags."""
    parts = []
    for is_last in stack[:-1]:
        parts.append("   " if is_last else "│  ")
    if stack:
        parts.append("└─ " if stack[-1] else "├─ ")
    return "".join(parts)


def header(root, repo, ref):
    """(name, url) for the root row."""
    if root in (".", ""):
        name = repo.split("/")[-1] if repo else os.path.basename(os.getcwd())
        url = f"https://github.com/{repo}/tree/{ref}" if repo else None
    else:
        name = os.path.basename(root)
        url = node_url(repo, ref, root, True) if repo else None
    return name, url


def render(root, dirs_of, files_of, repo, ref, mode, gloss, indent, max_depth):
    rows = list(walk_rows(root, dirs_of, files_of, max_depth))
    hname, hurl = header(root, repo, ref)

    if mode == "ascii":
        lines = [f"{hname}/"]
        stack = []
        for depth, name, rel, is_dir, last in rows:
            stack = stack[:depth] + [last]
            lines.append(f"{prefix_codespan(stack)}{name}{'/' if is_dir else ''}")
        return "```\n" + "\n".join(lines) + "\n```"

    head = f"{ICON_DIR} [{hname}]({hurl})" if hurl else f"{ICON_DIR} {hname}/"
    out = []
    if gloss:
        out += ["| Tree | What it is |", "|---|---|"]
        tail = " |  |"
    else:
        out += ["| Tree |", "|---|"]
        tail = " |"
    out.append(f"| {head}{tail}")

    stack = []
    for depth, name, rel, is_dir, last in rows:
        stack = stack[:depth] + [last]
        link = f"[{name}]({node_url(repo, ref, rel, is_dir)})" if repo else name
        ic = icon_for(name, is_dir)
        if mode == "braille":
            cell = f"{BRAILLE * (indent * (depth + 1))}{ic} {link}"
        else:  # codespan
            cell = f"`{prefix_codespan(stack)}`{ic} {link}"
        out.append(f"| {cell}{tail}")
    return "\n".join(out)


def main(argv):
    ap = argparse.ArgumentParser(description="Render a repo tree as a chat markdown table.")
    ap.add_argument("root", nargs="?", default=".", help="directory to render")
    ap.add_argument("--repo", help="owner/repo for links (default: infer from origin)")
    ap.add_argument("--ref", default="main", help="branch/tag/sha for links")
    ap.add_argument("--depth", type=int, default=None, help="levels below root (1 = direct children)")
    ap.add_argument("--mode", choices=["codespan", "braille", "ascii"], default="codespan")
    ap.add_argument("--all", action="store_true", help="include untracked files")
    ap.add_argument("--ignore", action="append", default=[], help="extra name glob to prune")
    ap.add_argument("--gloss", action="store_true", help="add an empty gloss column")
    ap.add_argument("--indent", type=int, default=3, help="braille blanks per level")
    args = ap.parse_args(argv)

    root = args.root.rstrip("/") or "."
    if root != "." and not os.path.isdir(root):
        sys.exit(f"not a directory: {root}")
    repo = args.repo or infer_repo()

    root_key, dirs_of, files_of = build_index(root, args.ignore, tracked_only=not args.all)
    print(render(root_key, dirs_of, files_of, repo, args.ref,
                 args.mode, args.gloss, args.indent, args.depth))


if __name__ == "__main__":
    main(sys.argv[1:])
