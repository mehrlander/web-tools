"""Hold terms.csv to its sources: each row's definition must still appear in the
file its `home` names, on origin/main of the sibling checkout its `repo` names.

  python3 research/2026-11-20-provenance-map/check.py [--root DIR]

DIR holds the checkouts side by side (default: the parent of this repository);
a checkout may also sit under DIR/mehrlander/.
Markdown emphasis and backticks are dropped and whitespace collapsed on both
sides before matching, so a quote may span wrapped lines. A row passes when its
quote is found within 12 lines of the cited line; a quote found elsewhere in the
file is reported as moved, and one found nowhere as missing. A checkout that is
absent is named on the last line, and its rows did not run.
"""
import csv, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
root = sys.argv[sys.argv.index("--root") + 1] if "--root" in sys.argv else os.path.dirname(REPO)


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[*`]", "", s)).strip()


def where(repo):
    """The checkout for repo: a sibling, or under an owner folder as public clones land."""
    for d in (os.path.join(root, repo), os.path.join(root, "mehrlander", repo)):
        if os.path.isdir(d):
            return d
    return None


def show(repo, path):
    r = subprocess.run(["git", "-C", where(repo), "show", f"origin/main:{path}"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.stdout if r.returncode == 0 else None


rows = list(csv.DictReader(open(os.path.join(HERE, "terms.csv"), encoding="utf-8")))
bad, skipped, cache = [], set(), {}
for i, row in enumerate(rows, 2):
    repo, (path, line) = row["repo"], row["home"].rsplit(":", 1)
    if where(repo) is None:
        skipped.add(repo)
        continue
    if (repo, path) not in cache:
        cache[repo, path] = show(repo, path)
    text, quote = cache[repo, path], norm(row["definition"])
    if text is None:
        bad.append(f"row {i}: {repo}:{path} not on origin/main")
        continue
    lines, n = text.splitlines(), int(line)
    near = norm("\n".join(lines[max(0, n - 13):n + 12]))
    if quote in near:
        continue
    bad.append(f"row {i}: {row['term']}: " + ("moved from line " + line if quote in norm(text) else "missing") + f" in {repo}:{path}")

print("\n".join(bad) or f"{len(rows)} rows: every quote found near its cited line")
if skipped:
    print("skipped, checkout absent: " + ", ".join(sorted(skipped)))
sys.exit(1 if bad else 0)
