#!/usr/bin/env python3
"""Every comment block and docstring in a repository's code, as one payload.

The Map's Docs > Comments tab reads it to look up the comments that name a
document or mention a topic. Blocks are found by python/embedded-prose.py's
lexers, so a block here is the unit that script counts: one HTML comment, one
`/* */`, a run of consecutive `//` or `#` lines, or a docstring.

Each block gets a kind:

    header     a Python module docstring, or the first comment of a file
               that only a wrapper line, a doctype or `'use strict'` precedes
    docstring  a Python function or class docstring
    comment    every other block

and the documents it names: each `.md` path, and each `.csv` under `docs/`,
resolved against the tracked tree (as written, beside the file, then by a
basename only one tracked file has). A name that resolves nowhere is kept
apart as `gone`.

The payload holds one code file per line, sorted by path, each block as
[line, kind, text, refs, gone]:

    {"files": [
    ["lib/kits/look.js", [[1, "header", "look markers: ...", ["docs/..."], []]]],
    ...
    ]}

Generated files and the paths content.csv marks supplied or mechanical are
left out, as embedded-prose.py leaves them out.

Usage:
    python3 python/comment-blocks.py [ROOT] [--skip PREFIX ...] [--emit PATH] [--check]

    --skip    a path prefix to leave out (repeatable)
    --emit    write the payload to PATH instead of stdout
    --check   with --emit, exit 1 if PATH differs from what would be written
"""
import ast
import importlib.util
import inspect
import json
import os
import posixpath
import re
import subprocess
import sys
from urllib.parse import urlsplit

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("embedded_prose", os.path.join(HERE, "embedded-prose.py"))
ep = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ep)

DOC_REF = re.compile(r"(?<![\w/.@:-])((?:\.{1,2}/)*[\w@.-]+(?:/[\w@.-]+)*\.md|docs/(?:[\w.-]+/)*[\w.-]+\.csv)\b")
SHEBANG = re.compile(r"^(!|-\*-|(vim?|coding)[:=])")
PRELUDE = re.compile(
    r"""^\s*(#!.*|['"]use strict['"];?|<!doctype[^>]*>|</?(html|head|body)\b[^>]*>|<meta\b[^>]*>"""
    r"""|document\.addEventListener\(\s*['"]alpine:init['"].*\{|\(\s*(async\s*)?(function\b.*|\(\)\s*=>)\s*\{|\{)\s*$""",
    re.I,
)


def clean(body, docstring=False):
    """The block's words as written, without its delimiters or common indent."""
    if docstring:
        return inspect.cleandoc(body)
    lines = body.split("\n")
    if len(lines) > 1 and all(not l.strip() or l.lstrip().startswith("*") for l in lines[1:]):
        lines = [lines[0]] + [re.sub(r"^\s*\*( ?)", "", l) for l in lines[1:]]
    text = "\n".join(l.rstrip() for l in lines).strip("\n")
    return inspect.cleandoc(text)


def py_kinds(src):
    """Line numbers of the module docstring and of each def or class docstring."""
    try:
        tree = ast.parse(src)
    except (SyntaxError, ValueError):
        return None, set()
    module = None
    body = tree.body
    if body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], "value", None), ast.Constant) \
            and isinstance(body[0].value.value, str):
        module = body[0].lineno
    defs = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n.body:
            first = n.body[0]
            if isinstance(first, ast.Expr) and isinstance(getattr(first, "value", None), ast.Constant) \
                    and isinstance(first.value.value, str):
                defs.add(first.lineno)
    return module, defs


def blocks_of(rel, src):
    """[(line, kind, text)] for one file, in line order."""
    lines = src.split("\n")
    found = sorted((b for b in ep.comment_blocks(rel, src) if not (b[0] <= 2 and SHEBANG.match(b[1].strip()))),
                   key=lambda b: b[0])
    out = []
    if rel.endswith(".py"):
        module, defs = py_kinds(src)
        found = [b for b in found if _from_hash(lines, b) or b[0] == module or b[0] in defs]
        for i, (line, body, _n) in enumerate(found):
            quoted = not _from_hash(lines, (line, body, _n))
            if quoted:
                if line == module:
                    kind = "header"
                elif line in defs:
                    kind = "docstring"
                else:
                    continue  # a long string literal is content, not commentary
            else:
                kind = "header" if module is None and i == 0 and _only_prelude(lines, line) else "comment"
            out.append((line, kind, clean(body, docstring=quoted)))
        return out
    body_at = next((k for k, l in enumerate(lines, 1) if "<body" in l.lower()), 0) if rel.endswith(".html") else 0
    for i, (line, body, _n) in enumerate(found):
        first = i == 0 and (_only_prelude(lines, line) or (body_at and line < body_at))
        out.append((line, "header" if first else "comment", clean(body)))
    return out


def _from_hash(lines, block):
    """True when a block is a `#` run rather than a triple-quoted string."""
    line, body = block[0], block[1]
    first = body.split("\n")[0]
    return 0 < line <= len(lines) and ("#" + first) in lines[line - 1]


def _only_prelude(lines, line):
    """True when nothing but blank lines and wrapper lines sit above `line`."""
    return all(not l.strip() or PRELUDE.match(l) for l in lines[: line - 1])


def resolver(tracked, own=""):
    by_base = {}
    for p in tracked:
        if p.endswith(".md") or (p.startswith("docs/") and p.endswith(".csv")):
            by_base.setdefault(posixpath.basename(p), []).append(p)
    known = set(tracked)

    def resolve(rel, name):
        """(path, None) when found, (None, name) when nothing has it, (None, None) when several might."""
        name = name.rstrip(".")
        if own and name.startswith(own + "/"):
            name = name[len(own) + 1:]
        bare = "/" not in name
        hits = by_base.get(posixpath.basename(name), [])
        if name in known and not (bare and len(hits) > 1):
            return name, None
        d = posixpath.dirname(rel)
        while d:
            near = posixpath.normpath(posixpath.join(d, name))
            if near in known:
                return near, None
            d = posixpath.dirname(d)
        if not bare:
            return (name, None) if name in known else (None, name)
        if len(hits) == 1:
            return hits[0], None
        in_docs = [h for h in hits if h.startswith("docs/")]
        if len(in_docs) == 1:
            return in_docs[0], None
        return (None, None) if hits else (None, name)

    return resolve


def repository_name(root):
    """Use the origin's project name even when a working folder has another name."""
    try:
        remote = subprocess.run(["git", "-C", root, "remote", "get-url", "origin"],
                                capture_output=True, text=True, timeout=20)
        name = posixpath.basename(urlsplit(remote.stdout.strip()).path.rstrip("/")).removesuffix(".git")
        if remote.returncode == 0 and re.fullmatch(r"[\w.-]+", name):
            return name
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return os.path.basename(os.path.abspath(root))


def build(root, skips):
    tracked = ep.tracked_files(root)
    every = _all_tracked(root)
    resolve = resolver(every, repository_name(root))
    reg = ep.content_registry(root)
    files = []
    for rel in sorted(tracked):
        if any(rel.startswith(s) for s in skips) or rel.split("/")[0] in ep.SKIP_DIRS:
            continue
        try:
            with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as fh:
                src = fh.read()
        except OSError:
            continue
        if ep.is_generated(src) or ep.declared_mode(reg, rel) in ("supplied", "mechanical"):
            continue
        rows = []
        for line, kind, text in blocks_of(rel, src):
            refs, gone = [], []
            for name in dict.fromkeys(m.group(1) for m in DOC_REF.finditer(text)):
                hit, miss = resolve(rel, name)
                if hit and hit not in refs:
                    refs.append(hit)
                elif miss and miss not in gone:
                    gone.append(miss)
            rows.append([line, kind, text, refs, gone])
        if rows:
            files.append([rel, rows])
    return files


def _all_tracked(root):
    out = subprocess.run(["git", "-C", root, "ls-files", "-z"], capture_output=True, text=True).stdout
    return [f for f in out.split("\0") if f]


def render(files):
    body = ",\n".join(json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in files)
    return '{"files":[\n' + body + "\n]}\n"


def main(argv):
    root, skips, emit, check = ".", [], None, False
    it = iter(argv)
    for a in it:
        if a == "--skip":
            skips.append(next(it))
        elif a == "--emit":
            emit = next(it)
        elif a == "--check":
            check = True
        elif a in ("-h", "--help"):
            print(__doc__)
            return 0
        else:
            root = a
    text = render(build(root, skips))
    if not emit:
        sys.stdout.write(text)
        return 0
    path = os.path.join(root, emit)
    if check:
        try:
            with open(path, encoding="utf-8") as fh:
                same = fh.read() == text
        except OSError:
            same = False
        if not same:
            print(f"comment-blocks: {emit} is stale; run npm run comment-blocks", file=sys.stderr)
        return 0 if same else 1
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    n = sum(len(f[1]) for f in json.loads(text)["files"])
    print(f"comment-blocks: {n} blocks in {text.count(chr(10)) - 2} files -> {emit}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
