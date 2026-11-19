#!/usr/bin/env python3
"""Generate or check a repo's declared, tracked-CSV census.

Run from any checkout: python python/csv-census.py [--root DIR] [--check].
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
from pathlib import Path, PurePosixPath, PureWindowsPath

FIELDS = ("path", "rows", "columns", "bytes", "headers")


def valid_path(value):
    path = PurePosixPath(value)
    return (bool(value) and not path.is_absolute() and not PureWindowsPath(value).drive
            and "\\" not in value
            and "\n" not in value and "\r" not in value
            and all(part not in ("", ".", "..") for part in value.split("/"))
            and value.endswith(".csv"))


def output_path(root, rel):
    target = root / rel
    if not target.resolve().is_relative_to(root):
        raise ValueError(f"census output resolves outside repository: {rel}")
    # The output is omitted from measure(), so protect its destination too.
    # Resolve catches directory junctions on Windows; inspect each component
    # so even a symlink back into this checkout cannot redirect the write.
    for part in (target, *target.parents):
        if part == root:
            break
        if part.is_symlink():
            raise ValueError(f"linked census output: {rel}")
    return target


def tracked_csvs(root, output):
    result = subprocess.run(["git", "ls-files", "--stage", "-z", "--", "*.csv"],
                            cwd=root, check=True, capture_output=True)
    paths = {}
    for entry in result.stdout.split(b"\0"):
        if not entry:
            continue
        metadata, name = entry.split(b"\t", 1)
        mode, oid, stage = metadata.split(b" ")
        path = name.decode("utf-8")
        if not valid_path(path):
            raise ValueError(f"invalid tracked CSV path: {path!r}")
        # With core.symlinks=false Git checks a link out as a regular file
        # containing its target. Its index mode still identifies it as a link.
        if mode == b"120000":
            raise ValueError(f"linked CSV in index: {path}")
        if stage != b"0" and path != output:
            raise ValueError(f"unmerged CSV in index: {path}")
        paths[path] = oid
    return dict(sorted(paths.items()))


def measure(root, rel, oid, batch):
    path = root / rel
    if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"missing, linked, or outside repository: {rel}")
    # The index is the next committed tree. Reading its blobs avoids a census
    # that changes merely because Windows checked an LF blob out as CRLF.
    batch.stdin.write(oid + b"\n")
    batch.stdin.flush()
    header = batch.stdout.readline().rstrip(b"\n").split(b" ")
    if len(header) == 2 and header[1] == b"missing":
        raise ValueError(f"missing indexed CSV blob: {rel}")
    if (len(header) != 3 or header[0] != oid or header[1] != b"blob"
            or not header[2].isdigit()):
        raise ValueError(f"invalid Git blob response: {rel}")
    size = int(header[2])
    raw = batch.stdout.read(size)
    if len(raw) != size or batch.stdout.read(1) != b"\n":
        raise ValueError(f"incomplete Git blob response: {rel}")
    # A valid field can occupy almost the whole blob. The parser's small
    # default limit should not exclude it from an otherwise exhaustive census.
    csv.field_size_limit(max(csv.field_size_limit(), len(raw)))
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
    sources = [(rel, oid) for rel, oid in paths.items() if rel != output]
    rows = []
    if sources:
        command = ["git", "cat-file", "--batch"]
        with subprocess.Popen(command, cwd=root, stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE) as batch:
            rows = [measure(root, rel, oid, batch) for rel, oid in sources]
            batch.stdin.close()
            status = batch.wait()
            if status:
                raise subprocess.CalledProcessError(status, command)
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
    target = output_path(root, output)
    paths = tracked_csvs(root, output)
    if args.check and output not in paths:
        raise ValueError(f"declared census is not tracked: {output}")
    # Before the first git add, include the prospective output; after that, the
    # exact tracked set is used. Check mode never makes this allowance.
    paths.setdefault(output, None)
    content = expected(root, output, paths)
    if args.check:
        if not target.is_file() or target.read_bytes() != content:
            raise ValueError(f"{output} differs from the tracked CSV census; regenerate it")
        print(f"OK {output}: {len(paths)} tracked CSVs")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        print(f"Wrote {output}: {len(paths)} CSVs")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, UnicodeError, csv.Error, subprocess.CalledProcessError) as exc:
        print(f"csv-census: {exc}", file=sys.stderr)
        sys.exit(1)
