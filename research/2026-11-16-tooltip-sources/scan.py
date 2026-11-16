#!/usr/bin/env python3
"""List every tooltip in a checkout, with its form and, optionally, the commit that
introduced its words. The probe's instrument; its README reports a run.

    python3 scan.py <repo> <out.csv> [--provenance] [--exclude PREFIX ...] PATH ...

PATH names the folders or files to scan (only .html and .js files are read).
--exclude drops paths that start with a prefix. --provenance adds, for each row,
the oldest commit in which `git log -S` sees the row's text or expression enter
the file (following renames), with that commit's date, its Co-Authored-By agent
and its claude.ai session, and beside it what `git blame -w -M` names for the
line. It needs full history: on a shallow clone every answer is the cutoff.

The classification matches budget-drs's data/design/catalog/tools/build-tooltips.py:
`literal` (fixed words), `template` (fixed words around a runtime slot) and
`expression` (a computed value, which may be borrowed from data or a readout).
"""
import argparse
import csv
import re
import subprocess
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ATTRS = [
    ("title-tip", "bound", re.compile(r'(?:^|[\s<])(?::|x-bind:)data-title-tip="(?P<v>[^"]*)"')),
    ("title-tip", "attr", re.compile(r'(?:^|[\s<\'"`])data-title-tip="(?P<v>[^"]*)"')),
    ("title-tip", "js", re.compile(r'dataset\.titleTip\s*=\s*(?P<v>[^;]+)')),
    ("title-tip", "js", re.compile(r'setAttribute\([\'"]data-title-tip[\'"],\s*(?P<v>[^;]+?)\)\s*;')),
    ("title", "bound", re.compile(r'(?:^|\s)(?::|x-bind:)title="(?P<v>[^"]*)"')),
    ("title", "attr", re.compile(r'(?:^|\s)title="(?P<v>[^"]*)"')),
    ("data-tip", "attr", re.compile(r'(?:^|\s)data-tip="(?P<v>[^"]*)"')),
]
NOT_A_TOOLTIP = re.compile(r"<(iframe|title|svg|link|meta)\b")
QUOTED = re.compile(r"""^\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1\s*$""")
STRINGS = re.compile(r"""(['"`])((?:(?!\1)[^\\]|\\.){2,}?)\1""")
CONCAT = re.compile(r"""['"]\s*\+|\+\s*['"]""")


def skeleton(expr):
    if re.search(r"\?(?![.?])", expr):     # a conditional, not ?. or ??
        return ""
    parts = STRINGS.findall(expr)
    if not parts:
        return ""
    words = "{…}".join(p[1] for p in parts)
    if not expr.strip().startswith(("'", '"', "`")):
        words = "{…}" + words
    if not expr.strip().endswith(("'", '"', "`")):
        words += "{…}"
    return re.sub(r"\s+", " ", words).strip()


def _classify(how, v):
    v = v.strip()
    if how == "attr":
        if "${" in v:
            return "template", re.sub(r"\$\{[^}]*\}", "{…}", v), v
        if CONCAT.search(v):
            return "template", skeleton(v), v
        return "literal", v, ""
    m = QUOTED.match(v)
    if m and "${" not in m.group(2):
        return "literal", m.group(2), ""
    if m and m.group(1) == "`":
        return "template", re.sub(r"\$\{[^}]*\}", "{…}", m.group(2)), v
    if STRINGS.search(v):
        return "template", skeleton(v), v
    return "expression", "", v


def classify(how, v):
    form, text, expr = _classify(how, v)
    if form == "template" and not re.search(r"[A-Za-z]{2}", text.replace("{…}", "")):
        return "expression", "", expr
    return form, text, expr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo")
    ap.add_argument("out")
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--exclude", nargs="*", default=[])
    ap.add_argument("--provenance", action="store_true")
    a = ap.parse_args()
    repo = Path(a.repo)

    def git(*args):
        return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True).stdout

    files = [f for f in git("ls-files", *a.paths).split()
             if f.endswith((".html", ".js")) and not any(f.startswith(x) for x in a.exclude)]
    rows = []
    for f in files:
        lines = (repo / f).read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            if len(line) > 3000:
                continue
            taken = []
            for mech, how, pat in ATTRS:
                for m in pat.finditer(line):
                    if any(s <= m.start("v") < e for s, e in taken):
                        continue
                    if mech == "title" and NOT_A_TOOLTIP.search(line):
                        continue
                    taken.append((m.start(), m.end()))
                    form, text, expr = classify(how, m.group("v"))
                    rows.append({"file": f, "line": i + 1, "mechanism": mech, "form": form,
                                 "text": text, "expression": expr})

    if a.provenance:
        meta = {}

        def commit(sha):
            if sha not in meta:
                date, msg = (git("show", "-s", "--format=%as%x1f%B", sha).split("\x1f") + [""])[:2]
                s = re.search(r"claude\.ai/code/(session_\w+)", msg)
                co = re.search(r"^Co-Authored-By:\s*([^<\n]+)", msg, re.M)
                meta[sha] = (date, co.group(1).strip() if co else "", s.group(1) if s else "",
                             msg.split("\n")[0][:100])
            return meta[sha]

        blames = defaultdict(dict)
        for f in {r["file"] for r in rows}:

            for ln in git("blame", "-w", "-M", "--line-porcelain", "HEAD", "--", f).splitlines():
                m = re.match(r"^([0-9a-f]{40}) \d+ (\d+)", ln)
                if m:
                    blames[f][int(m.group(2))] = m.group(1)

        def introduced(r):
            needle = r["expression"] or r["text"]
            if len(needle) < 4:
                return ""
            shas = git("log", "--follow", "-S", needle, "--format=%H", "--", r["file"]).split()
            return shas[-1] if shas else ""

        with ThreadPoolExecutor(8) as ex:
            intro = list(ex.map(introduced, rows))
        for r, sha in zip(rows, intro):
            d, co, s, subj = commit(sha) if sha else ("", "", "", "")
            b = blames[r["file"]].get(r["line"], "")
            r.update(introduced=sha[:9], introduced_date=d, agent=co, session=s,
                     blamed=b[:9], blamed_subject=commit(b)[3] if b and b != sha else "")

    with open(a.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} rows from {len(files)} files:",
          ", ".join(f"{k} {v}" for k, v in sorted(Counter(r["form"] for r in rows).items())))
    if a.provenance:
        found = [r for r in rows if r["introduced"]]
        agree = sum(1 for r in found if r["blamed"] == r["introduced"])
        print(f"introduced commit found for {len(found)}; blame names the same commit for {agree}")


if __name__ == "__main__":
    main()
