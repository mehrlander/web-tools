#!/usr/bin/env python3
"""Measure how each probe or research write-up holds its sources.

Reads the trees extracted under ./trees/ (gitignored) and writes measures.csv
beside this script. Build the trees from sibling checkouts of the four repos:

  for r in budget-drs web-tools home web-tools-private; do
    mkdir -p trees/$r && git -C ../../../../$r archive origin/main | tar -x -C trees/$r; done
  mkdir -p trees/budget-drs-branch && git -C ../../../../budget-drs archive \
    origin/claude/great-ramanujan-9enimt | tar -x -C trees/budget-drs-branch

The committed measures.csv was read at budget-drs ddfabe1 (branch 2f7be04),
web-tools 5f0e12e, home 50639db and web-tools-private 1b330a6.

Columns:
  words           words in the main write-up, frontmatter and fenced code removed
                  (an HTML write-up: visible text, script and style removed)
  source_links    unique link targets (markdown links, bare URLs, backticked
                  paths) pointing into a store of fetched outside material
  external_urls   unique http(s) targets outside the estate (not github.com/mehrlander,
                  mehrlander.github.io, claude.ai, raw.githubusercontent.com/mehrlander)
                  and not already counted as source_links
  analysis_links  unique targets pointing to other analysis: probes, research,
                  findings, runs, chron entries, library studies (self-folder excluded)
  own_files_*     files in the write-up's own folder (none for a write-up filed
                  loose in a collection folder): fetched source / script / table
  bundle          probes.csv bundle column, or an own sources.csv / manifest found
  long_quotes     blockquote groups and quoted strings of more than 15 words
"""
import csv, json, os, re, subprocess, sys, html
from pathlib import Path

HERE = Path(__file__).resolve().parent
T = HERE / "trees"
SIBLINGS = HERE.parents[3]
REPO_DIR = {t: str(SIBLINGS / t.removesuffix("-branch")) for t in
            ("budget-drs", "budget-drs-branch", "web-tools", "home", "web-tools-private")}

# Collection folders: a write-up filed loose in one of these has no folder of its own.
COLLECTIONS = {
    "data/design/probes", "research/deep-research", "data/findings", "research",
    "probes", "chron/2026/10", "projects/library", "projects/text/probes",
    "projects/library/data-warehouse-toolkit", "projects/library/diataxis",
    "projects/library/semiology-of-graphics", "projects/library/automating-graphical-presentations",
}
# The library's per-work folders hold only the studies, so they are collections too.

def entries():
    rows = []
    # budget-drs probes, merged
    with open(T / "budget-drs/data/design/probes/probes.csv") as f:
        for r in csv.DictReader(f):
            rows.append(dict(tree="budget-drs", repo="budget-drs", path="data/design/probes/" + r["path"],
                             date=r["date"], merged="yes", bundle=r["bundle"]))
    main_ids = {r["path"] for r in rows}
    with open(T / "budget-drs-branch/data/design/probes/probes.csv") as f:
        for r in csv.DictReader(f):
            p = "data/design/probes/" + r["path"]
            if p not in main_ids:
                rows.append(dict(tree="budget-drs-branch", repo="budget-drs", path=p, date=r["date"],
                                 merged="no (claude/great-ramanujan-9enimt)", bundle=r["bundle"]))
    for p in sorted((T / "budget-drs/research/deep-research").glob("2026-*.md")):
        rows.append(dict(tree="budget-drs", repo="budget-drs", path=str(p.relative_to(T / "budget-drs")), merged="yes"))
    rows.append(dict(tree="budget-drs", repo="budget-drs", path="research/deep-research/appendix-b-determinations/README.md", merged="yes"))
    rows.append(dict(tree="budget-drs", repo="budget-drs", path="data/findings/2025-27-reduction-round.csv", merged="yes"))
    # manifests
    for tree in ("web-tools", "home", "web-tools-private"):
        d = json.load(open(T / tree / ".web-tools.json"))
        for e in d.get("research", []):
            rows.append(dict(tree=tree, repo=tree, path=e["path"], merged="yes", kind=e.get("kind")))
    # home text runs registered in projects/text/probes/probes.csv but not declared as research
    declared = {r["path"] for r in rows if r["tree"] == "home"}
    with open(T / "home/projects/text/probes/probes.csv") as f:
        runs = set()
        for r in csv.DictReader(f):
            for a in r["artifacts"].split(";"):
                a = a.strip()
                if not a: continue
                p = os.path.normpath(os.path.join("projects/text/probes", a))
                m = re.match(r"projects/text/(runs|doc-audit/runs)/[^/]+", p)
                if m: runs.add(m.group(0) + "/README.md")
    for p in sorted(runs - declared):
        rows.append(dict(tree="home", repo="home", path=p, merged="yes", kind="probe (text run, undeclared)"))
    # web-tools-private probes not declared
    declared = {r["path"] for r in rows if r["tree"] == "web-tools-private"}
    for p in ["probes/2026-11-17-antigravity-worker-auth.md", "probes/2026-11-17-gemini-summary-length/page.html"]:
        if p not in declared:
            rows.append(dict(tree="web-tools-private", repo="web-tools-private", path=p, merged="yes", kind="probe (undeclared)"))
    return rows

def strip_md(text):
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end > 0: text = text[end + 4:]
    out, fence = [], False
    for line in text.splitlines():
        if re.match(r"^\s*(```|~~~)", line):
            fence = not fence; continue
        if not fence: out.append(line)
    return "\n".join(out)

def html_text(text):
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", text)
    text = re.sub(r"(?s)<!--.*?-->", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(text)

def words(s):
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'’.,%$/-]*", s))

ESTATE = re.compile(r"https?://(github\.com/mehrlander|mehrlander\.github\.io|raw\.githubusercontent\.com/mehrlander|claude\.ai|gist\.github\.com/mehrlander)", re.I)
SOURCE = re.compile(r"(data/source/|budget-wa/(sources|normalized)/|(^|/)source/20\d\d-|\.\./source/|(^|/)kept/|(^|/)raw/|sources\.csv|wayback|"
                    r"budget-drs-acfr|legal-data|fn-data|spend-wa|source-docs/|experiment/sources|source\.txt|doc-craft-specimens)", re.I)
SOURCE_URL = re.compile(r"(web\.archive\.org|github\.com/mehrlander/[^/]+/(blob|tree)/[^/]+/(data/source|sources|source-docs)/|"
                        r"github\.com/mehrlander/(budget-drs-acfr|legal-data|fn-data|spend-wa))", re.I)
CHAT = re.compile(r"https?://(chatgpt\.com/c/|gemini\.google\.com/|claude\.ai/)", re.I)
ANALYSIS = re.compile(r"(probes/|research/|FINDINGS|findings|/runs/|chron/20\d\d|chron/blog|deep-research|projects/library|library/|"
                      r"doc-audit/|EXPLANATIONS|reconciliation|explorations|STORY\.md|BRIEFING\.md|20\d\d-\d\d-\d\d-[a-z])", re.I)

_b = subprocess.run(["git", "-C", REPO_DIR["budget-drs"], "ls-tree", "--name-only", "origin/main", "data/source/"],
                    capture_output=True, text=True).stdout.split()
BUNDLE_NAMES = [os.path.basename(x) for x in _b if not x.endswith(".md")]
BUNDLE_RE = re.compile("|".join(re.escape(b) for b in BUNDLE_NAMES))
DATA = re.compile(r"(data/derived/|data/authored/|/authored/|/derived/|marts/|dims/)")

def targets(text):
    t = []
    for m in re.finditer(r"\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\)", text): t.append(m.group(1))
    for m in re.finditer(r"(?m)^\s*\[[^\]]+\]:\s*(\S+)", text): t.append(m.group(1))
    scrub = re.sub(r"\]\([^)]*\)", "]", text)
    for m in re.finditer(r"https?://[^\s)>\]\"'`|,]+", scrub): t.append(m.group(0).rstrip(".;:"))
    for m in re.finditer(r"`([^`\s]+)`", scrub):
        s = m.group(1)
        if ("/" in s or re.search(r"\.(md|csv|py|json|txt|pdf|xlsx|html)$", s)) and not s.startswith("http") and not re.search(r"[(){}=<>]", s):
            t.append("`" + s)
    return t

def classify(target, writeup, own):
    """Return 'source', 'external', 'analysis' or None."""
    tick = target.startswith("`")
    tgt = target.lstrip("`").split("#")[0]
    if not tgt or "<" in tgt: return None
    if tgt.startswith("http"):
        if SOURCE_URL.search(tgt): return "source"
        if CHAT.search(tgt) or not re.match(r"https?://[^/]*\.", tgt): return None
        if not ESTATE.search(tgt): return "external"
        if "claude.ai" in tgt: return None
        return "analysis" if ANALYSIS.search(tgt) else None
    if SOURCE.search(tgt) or BUNDLE_RE.search(tgt): return "source"
    # relative path: resolve against the write-up's folder, exclude self-folder and self
    base = os.path.dirname(writeup)
    if tgt.startswith("/"): res = tgt.lstrip("/")
    elif tick and not tgt.startswith("."): res = tgt   # a backticked path is read as repo-root-relative
    else: res = os.path.normpath(os.path.join(base, tgt))
    if res == writeup: return None
    if own and (res == own or res.startswith(own + "/")): return None
    if ANALYSIS.search(tgt) or (tgt.startswith("..") and ANALYSIS.search(res)): return "analysis"
    return "data" if DATA.search(res) or DATA.search(tgt) else None

def long_quotes(text):
    n = 0
    body = re.sub(r"`[^`]*`", " ", text)
    group = []
    for line in body.splitlines() + [""]:
        if line.lstrip().startswith(">"):
            group.append(line.lstrip()[1:])
        else:
            if group and words(" ".join(group)) > 15: n += 1
            group = []
    nb = "\n".join(l for l in body.splitlines() if not l.lstrip().startswith(">"))
    for m in re.finditer(r"\"([^\"\n]{20,})\"|“([^”]{20,})”", nb):
        if words(m.group(1) or m.group(2)) > 15: n += 1
    return n

SRC_DIRS = {"kept", "raw", "content", "sources", "specimens", "source-cache"}
CODE = {".py", ".js", ".mjs", ".sh", ".ps1", ".ts", ".cjs"}
TABLE = {".csv", ".tsv", ".json", ".jsonl", ".xml"}

def own_folder(path):
    d = os.path.dirname(path)
    if d in COLLECTIONS: return None
    return d

def own_counts(root, own, writeup):
    if not own: return 0, 0, 0, []
    src = code = tab = 0; seen = []
    for p in sorted((root / own).rglob("*")):
        if not p.is_file() or "__pycache__" in p.parts or p.name.startswith("."): continue
        rel = str(p.relative_to(root))
        if rel == writeup: continue
        parts = set(Path(rel).relative_to(own).parts[:-1])
        ext = p.suffix.lower()
        if parts & SRC_DIRS or p.name == "source.txt" or ext in {".pdf", ".docx"}:
            src += 1
        elif ext in CODE: code += 1
        elif ext in TABLE: tab += 1
        seen.append(rel)
    return src, code, tab, seen

def git_date(tree, path):
    repo = REPO_DIR[tree]
    ref = "FETCH_HEAD" if tree == "budget-drs-branch" else "origin/main"
    out = subprocess.run(["git", "-C", repo, "log", ref, "--diff-filter=A", "--format=%ad", "--date=short", "--", path],
                         capture_output=True, text=True).stdout.split()
    return out[-1] if out else ""

def main():
    rows = entries(); out = []
    for e in rows:
        root = T / e["tree"]; f = root / e["path"]
        if not f.exists():
            print("missing", e["tree"], e["path"], file=sys.stderr); continue
        raw = f.read_text(errors="replace")
        if f.suffix == ".html": text = html_text(raw)
        elif f.suffix == ".csv": text = " ".join(" ".join(r) for r in csv.reader(raw.splitlines()))
        else: text = strip_md(raw)
        own = own_folder(e["path"])
        if e["path"] == "research/DOC_CRAFT_STUDY.md": own = "research/doc-craft-specimens"
        # the findings CSV: its `from` column is the citation; treat each cell as a target too
        tg = targets(text if f.suffix != ".csv" else raw)
        if f.suffix == ".csv":
            for r in csv.DictReader(raw.splitlines()):
                for k in ("from",):
                    if r.get(k): tg.append(r[k])
        cls = {}
        for t in tg:
            c = classify(t, e["path"], own)
            if c: cls.setdefault(c, set()).add(t.lstrip("`").split("#")[0])
        src, code, tab, _ = own_counts(root, own, e["path"])
        bundle = e.get("bundle", "")
        if not bundle and own:
            for cand in ("sources.csv", "manifest.csv", "MANIFEST.md", "source/README.md", "experiment/sources"):
                if (root / own / cand).exists(): bundle = "own:" + cand; break
        m = re.search(r"(20\d\d-\d\d-\d\d)", e["path"])
        fm = re.search(r"(?m)^(?:date|as_of|asof|run|created):\s*\"?(20\d\d-\d\d-\d\d)", raw[:2000])
        body = re.search(r"(20\d\d-\d\d-\d\d)", text[:3000])
        date = e.get("date") or (m.group(1) if m else (fm.group(1) + " (frontmatter)" if fm else
                (body.group(1) + " (first in text)" if body else git_date(e["tree"], e["path"]) + " (git add)")))
        out.append(dict(repo=e["repo"], path=e["path"], date=date, merged=e["merged"], words=words(text),
                        source_links=len(cls.get("source", ())), external_urls=len(cls.get("external", ())),
                        analysis_links=len(cls.get("analysis", ())), own_files_source=src, own_files_script=code,
                        own_files_table=tab, bundle=bundle, long_quotes=long_quotes(text if f.suffix != ".csv" else ""),
                        _data=len(cls.get("data", ())), _own=own or ""))
    cols = ["repo", "path", "date", "merged", "words", "source_links", "external_urls", "analysis_links",
            "own_files_source", "own_files_script", "own_files_table", "bundle", "long_quotes", "_data", "_own"]
    with open(HERE / "measures.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, lineterminator="\n"); w.writeheader(); w.writerows(out)
    if "-v" in sys.argv:
        for r in out:
            print(",".join(str(r[c]) for c in cols))

if __name__ == "__main__":
    main()
