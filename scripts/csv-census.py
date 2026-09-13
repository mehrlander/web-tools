#!/usr/bin/env python3
"""Generate or check a repo's declared, tracked-CSV census.

Run from any checkout: python scripts/csv-census.py [--root DIR] [--check].
The output path is the `data.census` path in that checkout's .web-tools.json.
Only paths returned by git ls-files enter the population. The inventory is
itself a tracked CSV, so its own byte count is solved as a fixed point.
"""
import argparse
import csv
import io
import json
import subprocess
import sys
from pathlib import Path, PurePosixPath

FIELDS = ("path", "rows", "columns", "bytes", "headers")


def valid_path(value):
    path = PurePosixPath(value)
    return (bool(value) and not path.is_absolute() and "\\" not in value
            and "\n" not in value and "\r" not in value
            and all(part not in ("", ".", "..") for part in value.split("/"))
            and value.endswith(".csv"))


def tracked_csvs(root):
    result = subprocess.run(["git", "ls-files", "-z", "--", "*.csv"],
                            cwd=root, check=True, capture_output=True)
    paths = [p.decode("utf-8") for p in result.stdout.split(b"\0") if p]
    for path in paths:
        if not valid_path(path):
            raise ValueError(f"invalid tracked CSV path: {path!r}")
    return sorted(paths)


def measure(root, rel):
    path = root / rel
    if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"missing, linked, or outside repository: {rel}")
    # The index is the next committed tree. Reading its blobs avoids a census
    # that changes merely because Windows checked an LF blob out as CRLF.
    raw = subprocess.run(["git", "cat-file", "blob", ":" + rel], cwd=root,
                         check=True, capture_output=True).stdout
    with io.StringIO(raw.decode("utf-8-sig"), newline="") as stream:
        records = csv.reader(stream, strict=True)
        header = next(records, [])
        rows = sum(1 for _ in records)
    return [rel, rows, len(header), len(raw), json.dumps(header, ensure_ascii=True, separators=(",", ":"))]


def emit(rows):
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(FIELDS)
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8")


def expected(root, output, paths):
    rows = [measure(root, p) for p in paths if p != output]
    if output in paths:
        own = [output, len(paths), len(FIELDS), 0,
               json.dumps(list(FIELDS), separators=(",", ":"))]
        rows.append(own)
        rows.sort(key=lambda r: r[0])
        for _ in range(20):
            content = emit(rows)
            if own[3] == len(content):
                return content
            own[3] = len(content)
        raise ValueError("inventory byte count did not converge")
    return emit(sorted(rows, key=lambda r: r[0]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    config = json.loads((root / ".web-tools.json").read_text(encoding="utf-8"))
    output = (config.get("data") or {}).get("census")
    if not isinstance(output, str) or not valid_path(output):
        raise ValueError(".web-tools.json must declare data.census as a relative .csv path")
    paths = tracked_csvs(root)
    if args.check and output not in paths:
        raise ValueError(f"declared census is not tracked: {output}")
    # Before the first git add, include the prospective output; after that, the
    # exact tracked set is used. Check mode never makes this allowance.
    content = expected(root, output, sorted(set(paths) | {output}))
    target = root / output
    if args.check:
        if not target.is_file() or target.read_bytes() != content:
            raise ValueError(f"{output} differs from the tracked CSV census; regenerate it")
        print(f"OK {output}: {len(paths)} tracked CSVs")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        print(f"Wrote {output}: {len(set(paths) | {output})} CSVs")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, UnicodeError, csv.Error, subprocess.CalledProcessError) as exc:
        print(f"csv-census: {exc}", file=sys.stderr)
        sys.exit(1)
