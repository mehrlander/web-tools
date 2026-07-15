#!/usr/bin/env python3
"""corpus_search.py — the "find" verb for the file-retrieval skill.

Scans the corpus named in sources.toml and prints one block per matching
document, with match snippets in a fixed schema. Behavior (ranking, snippet
window, stop condition, output shape) is fixed here so a run is one auditable,
rerunnable command instead of an improvised grep.

Python 3.11+ (tomllib), stdlib only, zero dependencies.

Usage:
    corpus_search.py <pattern> [options]

Options:
    --regex          Treat <pattern> as a regular expression (default: substring).
    --case           Case-sensitive (default: case-insensitive).
    --max N          Stop after N matched documents (default 100). A capped run
                     prints an explicit note so it never reads as exhaustive.
    --meta-only      One line per hit, no snippets.
    --source NAME    Restrict to one named source from sources.toml (repeatable).
    --root DIR       Corpus root the globs resolve against (default: git root, else cwd).
    --config FILE    Path to sources.toml (default: alongside this script).
    --since YYYY-MM-DD / --until YYYY-MM-DD
                     Filter by a document's date, for extractors that carry one.
                     The file-per-document default carries none, so these are
                     inert for it (nothing is dropped); documented, not silent.
"""
import argparse
import pathlib
import re
import sys
import tomllib

SNIPPET_PAD = 90          # chars of context on each side of a match
MAX_SNIPPETS = 3          # snippets shown per document before "... N more"
MAX_FILE_BYTES = 5_000_000  # skip files larger than this; they are not documents
DEFAULT_MAX = 100

HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$")
WS_RE = re.compile(r"\s+")


def find_root(start: pathlib.Path) -> pathlib.Path:
    """Nearest ancestor holding a .git, else the start dir."""
    p = start.resolve()
    for cand in (p, *p.parents):
        if (cand / ".git").exists():
            return cand
    return p


def load_sources(config: pathlib.Path):
    """Return [{name, globs:[...]}]. sources.toml is a list of [[source]] tables."""
    if not config.exists():
        sys.exit(f"no config at {config}; copy sources.toml and list your globs")
    data = tomllib.loads(config.read_text())
    srcs = data.get("source", [])
    if not srcs:
        sys.exit(f"{config} defines no [[source]] tables")
    out = []
    for s in srcs:
        out.append({"name": s.get("name", "?"), "globs": s.get("globs", [])})
    return out


def title_of(text: str, path: pathlib.Path) -> str:
    """First markdown heading in the head of the file, else the filename."""
    for line in text.splitlines()[:40]:
        m = HEADING_RE.match(line)
        if m:
            return m.group(1).strip()
    return path.name


def file_per_document(root: pathlib.Path, source: dict):
    """The one built-in units extractor: a document is a file.

    Yields unit dicts {source, id, path, title, text, date}. Title is the first
    heading or the filename; no parsing, no date. This is the units seam: a
    container format (NDJSON, mbox, SQLite) would ship as another generator with
    the same output shape.
    """
    seen = set()
    for pattern in source["globs"]:
        for path in sorted(root.glob(pattern)):
            if not path.is_file() or path in seen:
                continue
            seen.add(path)
            try:
                if path.stat().st_size > MAX_FILE_BYTES:
                    continue
                text = path.read_bytes().decode("utf-8")
            except (UnicodeDecodeError, OSError):
                continue  # binary or unreadable: not a document
            rel = path.relative_to(root).as_posix()
            yield {
                "source": source["name"],
                "id": rel,
                "path": path,
                "title": title_of(text, path),
                "text": text,
                "date": None,
            }


def snippet(text: str, start: int, end: int) -> str:
    """~90 chars of context each side, whitespace collapsed, ellipses when clipped."""
    lo = max(0, start - SNIPPET_PAD)
    hi = min(len(text), end + SNIPPET_PAD)
    frag = WS_RE.sub(" ", text[lo:hi]).strip()
    return ("..." if lo > 0 else "") + frag + ("..." if hi < len(text) else "")


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def search_unit(unit: dict, rx: re.Pattern):
    matches = list(rx.finditer(unit["text"]))
    if not matches:
        return None
    return {"unit": unit, "matches": matches}


def in_range(unit, since, until):
    d = unit.get("date")
    if d is None:
        return True  # extractor carries no date; --since/--until are inert
    return (since is None or d >= since) and (until is None or d <= until)


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("pattern")
    ap.add_argument("--regex", action="store_true")
    ap.add_argument("--case", action="store_true")
    ap.add_argument("--max", type=int, default=DEFAULT_MAX)
    ap.add_argument("--meta-only", action="store_true")
    ap.add_argument("--source", action="append", default=[])
    ap.add_argument("--root")
    ap.add_argument("--config")
    ap.add_argument("--since")
    ap.add_argument("--until")
    args = ap.parse_args()

    here = pathlib.Path(__file__).resolve().parent
    config = pathlib.Path(args.config) if args.config else here / "sources.toml"
    root = pathlib.Path(args.root).resolve() if args.root else find_root(here)

    sources = load_sources(config)
    if args.source:
        want = set(args.source)
        sources = [s for s in sources if s["name"] in want]
        if not sources:
            sys.exit(f"no source matched {sorted(want)}; have "
                     f"{[s['name'] for s in load_sources(config)]}")

    flags = 0 if args.case else re.IGNORECASE
    try:
        rx = re.compile(args.pattern if args.regex else re.escape(args.pattern), flags)
    except re.error as e:
        sys.exit(f"bad regex: {e}")

    hits = []
    for source in sources:
        for unit in file_per_document(root, source):
            if not in_range(unit, args.since, args.until):
                continue
            h = search_unit(unit, rx)
            if h:
                hits.append(h)

    # Fixed ranking: most matches first, then path. Stable across runs.
    hits.sort(key=lambda h: (-len(h["matches"]), h["unit"]["id"]))

    total = len(hits)
    capped = total > args.max
    shown = hits[: args.max]

    for h in shown:
        u, ms = h["unit"], h["matches"]
        print(f'[{u["source"]}] {u["id"]}  {u["title"]}  ({len(ms)} matches)')
        if args.meta_only:
            continue
        for m in ms[:MAX_SNIPPETS]:
            print(f'    L{line_of(u["text"], m.start())}: {snippet(u["text"], m.start(), m.end())}')
        if len(ms) > MAX_SNIPPETS:
            print(f"    ... {len(ms) - MAX_SNIPPETS} more")

    print()
    print(f"{total} documents matched" + (f", showing {len(shown)}" if capped else ""))
    if capped:
        print(f"(stopped at --max={args.max}; results are not exhaustive)")


if __name__ == "__main__":
    main()
