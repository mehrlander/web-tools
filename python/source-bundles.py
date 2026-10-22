#!/usr/bin/env python3
"""Write or check a repo's two source-bundle tables: one row per bundle, one
row per file.

Run from any checkout: python python/source-bundles.py [--root DIR] [--check].
DIR defaults to the current directory. The bundle sets are the `bundles` array
in that checkout's .web-tools.json; docs/source-bundles.md is the contract.

A **source bundle** is a folder of material from outside the repository, kept
because we need to know where it came from, with a README whose frontmatter
carries what a person states about it. Two things are worth recording about a
bundle, and they have opposite maintenance costs, which is why they are two
tables rather than one file per bundle:

  bundle table   one row per bundle, from the README's frontmatter. Authored:
                 a person types these and nothing derives them.
  file table     one row per file, read from the Git index every run. Derived:
                 nobody can maintain a checksum by hand, and this is the only
                 thing that catches a file changing underneath the repository.

Membership is the index, as in python/csv-census.py: a bundle is a tracked
README.md one folder below a declared root, and its files are the tracked files
beside and below it. Sizes and checksums are the index blobs', so an untracked
cache and a Windows CRLF checkout move nothing. Stage a bundle before writing.

Ported on 2026-10-22 from home's projects/budget-drs/data/design/tools/
build-bundle-tables.py, which replaced 35 per-bundle source.json manifests on
2026-09-10; its tables reproduce byte for byte under the declaration that
project makes.
"""
import argparse
import csv
import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path, PurePosixPath, PureWindowsPath

BUNDLE_COLS = ("bundle", "root", "title", "publisher", "source_page",
               "acquired", "arrival", "note", "not_taken", "files", "bytes")
FILE_COLS = ("bundle", "path", "bytes", "sha256")
REQUIRED = ("title", "acquired")
FILLED = ("publisher", "source_page", "note", "not_taken", "arrival")

# A dot-prefixed path part is skipped wherever it sits, directory or file, and
# so is any part a declaration's `skip` names. __pycache__ is always skipped.
ALWAYS_SKIP = {"__pycache__"}

# Past this many files the list stops being a description and becomes a second
# copy of the folder, so the file table gives the bundle's totals on one row and
# the bundle owes an inventory of its own. A declaration may set `enumerateMax`.
ENUMERATE_MAX = 300


def valid_path(value, suffix=""):
    path = PurePosixPath(value) if isinstance(value, str) else None
    return (path is not None and bool(value) and not path.is_absolute()
            and not PureWindowsPath(value).drive and "\\" not in value
            and "\n" not in value and "\r" not in value
            and all(part not in ("", ".", "..") for part in value.split("/"))
            and value.endswith(suffix))


def join(base, rel):
    return f"{base}/{rel}" if base else rel


def declarations(config):
    sets = config.get("bundles")
    if not isinstance(sets, list) or not sets:
        raise ValueError(".web-tools.json declares no `bundles`")
    out = []
    for i, d in enumerate(sets):
        where = f"bundles[{i}]"
        if not isinstance(d, dict):
            raise ValueError(f"{where} is not an object")
        base = d.get("base", "")
        if base and not valid_path(base):
            raise ValueError(f"{where}.base is not a relative path: {base!r}")
        roots = d.get("roots")
        if not isinstance(roots, list) or not roots or not all(valid_path(r) for r in roots):
            raise ValueError(f"{where}.roots must be a list of relative paths")
        for key in ("table", "fileTable"):
            if not valid_path(d.get(key), ".csv"):
                raise ValueError(f"{where}.{key} must be a relative .csv path")
        sources = d.get("fileSources")
        if sources is not None and not valid_path(sources, ".csv"):
            raise ValueError(f"{where}.fileSources must be a relative .csv path")
        skip = d.get("skip", [])
        if not isinstance(skip, list) or not all(isinstance(s, str) and s for s in skip):
            raise ValueError(f"{where}.skip must be a list of folder or file names")
        cap = d.get("enumerateMax", ENUMERATE_MAX)
        if not isinstance(cap, int) or cap < 1:
            raise ValueError(f"{where}.enumerateMax must be a positive integer")
        out.append({"base": base, "roots": roots, "table": d["table"],
                    "fileTable": d["fileTable"], "fileSources": sources,
                    "skip": ALWAYS_SKIP | set(skip), "enumerateMax": cap})
    return out


def tracked(root, prefixes):
    """Tracked regular files under the prefixes, path -> blob id."""
    result = subprocess.run(["git", "ls-files", "--stage", "-z", "--", *prefixes],
                            cwd=root, check=True, capture_output=True)
    files = {}
    for entry in result.stdout.split(b"\0"):
        if not entry:
            continue
        metadata, name = entry.split(b"\t", 1)
        mode, blob, _stage = metadata.split(b" ")
        path = name.decode("utf-8")
        if mode == b"120000":
            raise ValueError(f"linked file in a bundle: {path}")
        if mode == b"160000":
            continue                                   # a submodule is not a file
        files[path] = blob.decode("ascii")
    return files


class Blobs:
    """Two `git cat-file` processes for every blob a run reads: one returns
    content, the other only sizes, for a bundle past the enumeration cap."""

    def __init__(self, root):
        self.content, self.check = (
            subprocess.Popen(["git", "cat-file", mode], cwd=root,
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE)
            for mode in ("--batch", "--batch-check"))

    @staticmethod
    def ask(proc, blob):
        proc.stdin.write(blob.encode("ascii") + b"\n")
        proc.stdin.flush()
        header = proc.stdout.readline().split()
        if len(header) != 3 or header[1] != b"blob":
            raise ValueError(f"unreadable blob {blob}")
        return int(header[2])

    def read(self, blob):
        data = self.content.stdout.read(self.ask(self.content, blob))
        self.content.stdout.read(1)
        return data

    def size(self, blob):
        return self.ask(self.check, blob)

    def close(self):
        for proc in (self.content, self.check):
            proc.stdin.close()
            proc.wait()


def read_frontmatter(text):
    """The README's frontmatter as a dict, stdlib only.

    Handles the shape the contract asks for: `key: "quoted scalar"`, a block
    list of quoted scalars, and a block list of mappings. Anything else is left
    as the raw string, which is the honest outcome for a hand-edited value the
    contract did not ask for.
    """
    text = text.replace("\r\n", "\n")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}

    def scalar(v):
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] == '"':
            return v[1:-1].replace('\\"', '"').replace("\\\\", "\\")
        return v

    out, key, items = {}, None, None
    for line in text[3:end].strip("\n").splitlines():
        if not line.strip():
            continue
        if line.startswith("  "):                      # inside a block list
            if items is None:
                continue
            body = line.strip()
            if body.startswith("- "):
                body = body[2:]
                if ":" in body and not body.startswith('"'):
                    k, _, v = body.partition(":")
                    items.append({k.strip(): scalar(v)})
                else:
                    items.append(scalar(body))
            elif items and isinstance(items[-1], dict):
                k, _, v = body.partition(":")
                items[-1][k.strip()] = scalar(v)
            continue
        if key is not None and items is not None:      # a list just ended
            out[key] = items
        key, items = None, None
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        if v.strip() == "":
            key, items = k.strip(), []
        else:
            out[k.strip()] = scalar(v)
    if key is not None and items is not None:
        out[key] = items
    return out


def flatten_not_taken(v):
    """`not_taken` is a list, which is the one field genuinely better in
    frontmatter than in a CSV cell. Here it is flattened to `what (why)`,
    semicolon separated; the frontmatter stays the record."""
    if not v:
        return ""
    if isinstance(v, str):
        return v
    parts = []
    for item in v:
        if isinstance(item, dict):
            what = item.get("what", "")
            why = item.get("why", "")
            parts.append(f"{what} ({why})" if why else what)
        else:
            parts.append(str(item))
    return "; ".join(parts)


def parts_key(path):
    # Sort by path parts, so a folder's files come before a sibling that only
    # shares its prefix (raw/x before raw-data.csv), whatever the filesystem.
    return tuple(path.split("/"))


def build(root, d, blobs):
    base = d["base"]
    roots = [join(base, r) for r in d["roots"]]
    files = tracked(root, roots)
    brows, frows, missing = [], [], []
    for r in roots:
        names = sorted({p[len(r) + 1:].split("/", 1)[0] for p in files
                        if p.startswith(r + "/") and p[len(r) + 1:].count("/") >= 1})
        for name in names:
            bdir = f"{r}/{name}"
            if f"{bdir}/README.md" not in files:
                continue
            bundle = bdir[len(base) + 1:] if base else bdir
            mine = []
            for p in files:
                if not p.startswith(bdir + "/"):
                    continue
                rel = p[len(bdir) + 1:]
                if any(part in d["skip"] or part.startswith(".") for part in rel.split("/")):
                    continue
                mine.append(rel)
            mine.sort(key=parts_key)
            readme = blobs.read(files[f"{bdir}/README.md"]).decode("utf-8")
            fm = read_frontmatter(readme)
            for k in REQUIRED:
                if not fm.get(k):
                    missing.append(f"{bdir}: frontmatter has no `{k}`")
            if len(mine) <= d["enumerateMax"]:
                sizes = []
                for rel in mine:
                    data = blobs.read(files[f"{bdir}/{rel}"])
                    sizes.append(len(data))
                    frows.append({"bundle": bundle, "path": rel, "bytes": len(data),
                                  "sha256": hashlib.sha256(data).hexdigest()})
                total = sum(sizes)
            else:
                total = sum(blobs.size(files[f"{bdir}/{rel}"]) for rel in mine)
                frows.append({"bundle": bundle,
                              "path": f"({len(mine)} files, past the {d['enumerateMax']} "
                                      f"enumeration cap; the bundle inventories itself)",
                              "bytes": total, "sha256": ""})
            brows.append({"bundle": bundle,
                          "root": r[len(base) + 1:] if base else r,
                          "title": fm.get("title", ""),
                          "publisher": fm.get("publisher", ""),
                          "source_page": fm.get("source_page", ""),
                          "acquired": fm.get("acquired", ""),
                          "arrival": fm.get("arrival", ""),
                          "note": fm.get("note", ""),
                          "not_taken": flatten_not_taken(fm.get("not_taken")),
                          "files": len(mine),
                          "bytes": total})
    if d["fileSources"]:
        # Every authored per-file row must name a file the file table lists.
        path = root / join(base, d["fileSources"])
        if path.exists():
            have = {(r["bundle"], r["path"]) for r in frows}
            with path.open(newline="", encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    if (row["bundle"], row["path"]) not in have:
                        missing.append(f"{d['fileSources']}: {row['bundle']}/{row['path']} "
                                       f"is not a file in that bundle")
    return brows, frows, missing


def render(rows, cols):
    buf = io.StringIO(newline="")
    w = csv.DictWriter(buf, fieldnames=cols, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue().encode("utf-8")


def output(root, rel):
    target = root / rel
    if not target.resolve().is_relative_to(root):
        raise ValueError(f"table resolves outside the repository: {rel}")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--check", action="store_true",
                        help="fail if either table of any bundle set is behind the index")
    args = parser.parse_args()
    root = args.root.resolve()
    config = json.loads((root / ".web-tools.json").read_text(encoding="utf-8"))
    blobs = Blobs(root)
    try:
        results = [(d, *build(root, d, blobs)) for d in declarations(config)]
    finally:
        blobs.close()

    failed = [m for _, _, _, missing in results for m in missing]
    if failed:
        for m in failed:
            print(f"FAIL: {m}", file=sys.stderr)
        return 1

    bad = []
    for d, brows, frows, _ in results:
        want = {join(d["base"], d["table"]): render(brows, BUNDLE_COLS),
                join(d["base"], d["fileTable"]): render(frows, FILE_COLS)}
        for rel, content in want.items():
            target = output(root, rel)
            if args.check:
                have = target.read_bytes().replace(b"\r\n", b"\n") if target.is_file() else None
                if have != content:
                    bad.append(rel)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        if args.check:
            continue
        filled = ", ".join(f"{c} {sum(1 for r in brows if str(r[c]).strip())}/{len(brows)}"
                           for c in FILLED)
        print(f"wrote {join(d['base'], d['table'])}: {len(brows)} bundles; "
              f"{join(d['base'], d['fileTable'])}: {len(frows)} file rows, "
              f"{sum(r['bytes'] for r in brows):,} bytes")
        print(f"  authored fill: {filled}")
    if args.check:
        for rel in bad:
            print(f"FAIL: {rel} is behind the index; run: python3 "
                  f"<web-tools>/python/source-bundles.py --root {root.name}", file=sys.stderr)
        if bad:
            return 1
        print("source bundles: ok (" + "; ".join(
            f"{len(b)} bundles, {len(f)} file rows" for _, b, f, _ in results) + ")")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, UnicodeError, csv.Error, subprocess.CalledProcessError) as exc:
        print(f"source-bundles: {exc}", file=sys.stderr)
        sys.exit(1)
