#!/usr/bin/env python3
"""Measure how the estate's prose uses each glossary term, and propose new ones.

Reads the terms in docs/glossary/terms.csv (each with its variants) and counts
them in the tracked Markdown of this checkout, over the corpus that
duplicated-claims.py scans (the same exclusions, imported from it, so the two
measures read one population). Code fences and front matter are skipped;
tables are kept, since many definitions sit in table cells.

Per term:
  uses        occurrences of the term or a variant, plural included
  files       Markdown files with at least one use
  areas       distinct top-level folders among those files (spread)
  marked      share of uses written in bold, in a code span or in a heading,
              the forms a definition or a term of art takes (markedness)
  importance  areas * marked * ln(1 + uses), the term lab's signature score
              (home projects/text/instruments/concept-lab/termlab.py);
              provisional until a gold set scores it

  python3 python/glossary-stats.py --emit docs/glossary/stats.csv
  python3 python/glossary-stats.py --emit docs/glossary/stats.csv --check
  python3 python/glossary-stats.py --candidates 40 --also ../home

--candidates lists phrases of one to three words, bolded where a definition
puts a term ("A **term** is", a table row's first cell, a bullet's label),
that no term or variant covers, in two files or more, ranked by areas and then
files; --also adds another repository's checkout to the harvest: the harvest a reviewer cuts by the entry
bar in docs/glossary/README.md. It prints and writes nothing.
"""
import argparse
import csv
import importlib.util
import io
import math
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TERMS = ROOT / "docs" / "glossary" / "terms.csv"

spec = importlib.util.spec_from_file_location("dc", ROOT / "python" / "duplicated-claims.py")
dc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dc)

FENCE = re.compile(r"^(```|~~~)")
MARK = re.compile(r"\*\*([^*\n]+)\*\*|`([^`\n]+)`")
HEADING = re.compile(r"^#{1,6}\s")
# A bold phrase in a defining position: "A **term** is", a table row's first
# cell, or a bullet's label. Bold used for emphasis falls outside all three.
DEFINES = re.compile(
    r"\b(?:an?|the)\s+\*\*([^*\n]{2,60})\*\*\s+(?:is|are|means|holds|names|says)\b"
    r"|^\s*\|\s*\*\*([^*\n]{2,60})\*\*\s*\|"
    r"|^\s*[-*]\s+\*\*([^*\n]{2,60}?)[:.]?\*\*[:.]?\s", re.I)
PHRASE = re.compile(r"^[a-z][a-z'-]*( [a-z][a-z'-]*){0,2}$")


def corpus(root=ROOT):
    files = [f for f in subprocess.run(["git", "ls-files", "-z", "--", "*.md"], cwd=root,
                                       capture_output=True, text=True).stdout.split("\0") if f]
    skip = dc.record_paths(root) | dc.vendored_paths(root)
    # The glossary's own folder names every term by design, so counting it
    # would move every score whenever the format document is edited.
    return sorted(f for f in files
                  if not any(f.startswith(p) for p in dc.EXCLUDE_PREFIXES + ("docs/glossary/",))
                  and f not in dc.EXCLUDE_PATHS and f not in skip)


def lines(text):
    """Prose lines: front matter and fenced code dropped."""
    fence = front = False
    for i, line in enumerate(text.split("\n")):
        if i == 0 and line.strip() == "---":
            front = True
            continue
        if front:
            front = line.strip() != "---"
            continue
        if FENCE.match(line):
            fence = not fence
            continue
        if not fence:
            yield line


def pattern(forms):
    alts = sorted({re.escape(f.lower()).replace(r"\ ", r"[\s-]+") for f in forms}, key=len, reverse=True)
    return re.compile(r"(?<![\w-])(?:" + "|".join(alts) + r")(?:e?s)?(?![\w-])", re.I)


def load_terms():
    with TERMS.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    return [(r["term"], [r["term"]] + [v for v in r["variants"].split(";") if v]) for r in rows]


def area(path):
    """A file's top-level folder, prefixed by its repository when it has one."""
    repo, _, rel = path.rpartition(":")
    top = rel.split("/", 1)[0] if "/" in rel else "."
    return f"{repo}:{top}" if repo else top


def measure(files, texts):
    out = []
    for term, forms in load_terms():
        pat = pattern(forms)
        uses = marked = 0
        hit = set()
        for f in files:
            for line in texts[f]:
                found = list(pat.finditer(line))
                if not found:
                    continue
                hit.add(f)
                uses += len(found)
                if HEADING.match(line):
                    marked += len(found)
                    continue
                spans = [m.span() for m in MARK.finditer(line)]
                marked += sum(1 for m in found if any(a <= m.start() < b for a, b in spans))
        areas = len({area(f) for f in hit})
        share = marked / uses if uses else 0.0
        out.append({"term": term, "uses": uses, "files": len(hit), "areas": areas,
                    "marked": round(share, 3),
                    "importance": round(areas * share * math.log1p(uses), 2)})
    return out


def candidates(files, texts, limit):
    covered = [pattern(forms) for _, forms in load_terms()]
    seen = defaultdict(set)
    for f in files:
        for line in texts[f]:
            for m in DEFINES.finditer(line):
                p = next(g for g in m.groups() if g).strip().lower().rstrip(":.,")
                p = re.sub(r"^(?:an?|the) ", "", p)
                if PHRASE.match(p) and not any(c.fullmatch(p) for c in covered):
                    seen[p].add(f)
    seen = {p: fs for p, fs in seen.items() if len(fs) >= 2}
    ranked = sorted(seen.items(), key=lambda kv: (-len({area(f) for f in kv[1]}), -len(kv[1]), kv[0]))
    print("phrase\tareas\tfiles\texample")
    for p, fs in ranked[:limit]:
        print(f"{p}\t{len({area(f) for f in fs})}\t{len(fs)}\t{sorted(fs)[0]}")


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--emit", metavar="PATH", help="write the stats as CSV")
    ap.add_argument("--check", action="store_true", help="with --emit, compare bytes and exit 1 when stale")
    ap.add_argument("--candidates", type=int, metavar="N", help="print N candidate terms")
    ap.add_argument("--also", action="append", default=[], metavar="CHECKOUT",
                    help="with --candidates, also read another repository's checkout")
    args = ap.parse_args(argv[1:])

    files = corpus()
    texts = {}
    for f in files:
        try:
            texts[f] = list(lines((ROOT / f).read_text(encoding="utf-8")))
        except (UnicodeDecodeError, OSError):
            texts[f] = []

    if args.candidates:
        for other in map(Path, args.also):
            for f in corpus(other):
                try:
                    texts[f"{other.name}:{f}"] = list(lines((other / f).read_text(encoding="utf-8")))
                except (UnicodeDecodeError, OSError):
                    continue
        candidates(sorted(texts), texts, args.candidates)
        return 0

    rows = measure(files, texts)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    cols = ["term", "uses", "files", "areas", "marked", "importance", "scanned"]
    w.writerow(cols)
    for r in rows:
        w.writerow([r[c] for c in cols[:-1]] + [len(files)])
    data = buf.getvalue().encode("utf-8")
    if not args.emit:
        sys.stdout.write(data.decode("utf-8"))
        return 0
    out = Path(args.emit)
    if args.check:
        if not out.exists() or out.read_bytes() != data:
            print(f"{args.emit} is stale; run: npm run glossary-stats", file=sys.stderr)
            return 1
        return 0
    out.write_bytes(data)
    print(f"glossary-stats: {len(rows)} terms over {len(files)} files -> {args.emit}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
