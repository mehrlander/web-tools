#!/usr/bin/env python3
"""Staged changes to vendored copies: files whose source is in another repo.

data/vendored-copies.txt lists them, one path per line; web-tools-private's
vendored.py writes it from its registry. An edit to a copy here is overwritten
the next time the copy is refreshed from its source, so the commit hook runs
this and names each staged copy. It never blocks: the refresh itself is a
commit that stages copies.

    python3 python/vendored-copies.py --staged
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIST = ROOT / "data" / "vendored-copies.txt"


def copies():
    if not LIST.is_file():
        return set()
    lines = LIST.read_text(encoding="utf-8").splitlines()
    return {l.strip() for l in lines if l.strip() and not l.startswith("#")}


def main(argv):
    if argv[1:] != ["--staged"]:
        sys.exit(__doc__.strip().splitlines()[-1].strip())
    staged = subprocess.run(["git", "-C", str(ROOT), "diff", "--cached", "--name-only"],
                            capture_output=True, text=True).stdout.split("\n")
    for path in sorted(copies() & set(staged)):
        print(f"{path} is a vendored copy: edit its source, or the next refresh "
              "overwrites this (fine if this commit is that refresh)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
