#!/usr/bin/env python3
"""rename-by-language.py: rename web-tools' code folders by language, re-runnably.

The owner decided on 2026-10-06 that tools/ becomes node/ and scripts/ becomes
python/. This script performs that rename on whatever main is when it runs, so
the PR can be rebuilt on a fresh main instead of merging main into ~880 renamed
files. Run it from the root of a clean web-tools checkout:

    python3 rename-by-language.py            # move, rewrite, restamp
    python3 rename-by-language.py --dry      # report the rewrite, change nothing

What it does, in order:
  1. git mv tools node, git mv scripts python. Node files left in python/ go
     to node/; Python files left in node/ go to python/ (by basename; none
     since #895). scripts/environment-setup.sh goes to .claude/, with the other
     files Claude Code runs, so the environment settings line must follow it.
  2. Rewrite every living reference: bare root paths, relative links (resolved
     from the file's old location, recomputed from its new one) and URLs into
     mehrlander/web-tools. Records and captures listed in EXCLUDE stay as
     written. Tracker files: Related blocks everywhere, plus every section but
     the progress log in open tasks.
  3. Hand edits the path rewrite cannot reach (HAND), each applied once and
     reported if its text is no longer there.
  4. Restamp: the launcher userscript, the checkout's merge driver, and every
     hook-owned generator (git hook run pre-commit -- --all).
It then writes review.tsv (folder-only and prefixed tokens for a hand look) and
trailers.txt (the Doc-change-approved lines the commit-msg gate wants), and
stops before committing.
"""
import os, re, subprocess, sys, pathlib, json

DRY = "--dry" in sys.argv
ROOT = pathlib.Path.cwd()
OUT = pathlib.Path(os.environ.get("RENAME_OUT", ROOT / ".rename-out"))

def sh(*args, check=True):
    r = subprocess.run(args, capture_output=True, text=True)
    if check and r.returncode:
        sys.exit(f"failed: {' '.join(args)}\n{r.stderr}")
    return r.stdout

# ── 1. the moves ──────────────────────────────────────────────────────────────

if sh("git", "status", "--porcelain").strip():
    sys.exit("working tree is not clean")
old_files = [f for f in sh("git", "ls-files").split("\n") if f]
old_set = set(old_files)
old_dirs = {str(a) for f in old_files for a in pathlib.PurePosixPath(f).parents}

SPECIAL = {"scripts/environment-setup.sh": ".claude/environment-setup.sh"}
NODE_EXT = (".mjs", ".js", ".cjs")
for f in old_files:
    if f.startswith("scripts/") and f.endswith(NODE_EXT):
        SPECIAL[f] = "node/" + f[len("scripts/"):]
    if (f.startswith("tools/") and f.endswith(".py")
            and "/fixtures/" not in f):
        SPECIAL[f] = "python/" + pathlib.PurePosixPath(f).name

def map_path(p):
    if p in SPECIAL: return SPECIAL[p]
    if p == "tools": return "node"
    if p == "scripts": return "python"
    if p.startswith("tools/"): return "node/" + p[6:]
    if p.startswith("scripts/"): return "python/" + p[8:]
    return p

INV = {v: k for k, v in SPECIAL.items()}
def unmap_path(p):
    if p in INV: return INV[p]
    if p.startswith("node/"): return "tools/" + p[5:]
    if p.startswith("python/"): return "scripts/" + p[7:]
    return p

def old_exists(p):
    p = p.rstrip("/")
    if p == "tools/.preview" or p.startswith("tools/.preview/"): return True
    return p in old_set or p in old_dirs

if not DRY:
    sh("git", "mv", "tools", "node")
    sh("git", "mv", "scripts", "python")
    for old, new in SPECIAL.items():
        src = map_path(old.split("/")[0]) + old[len(old.split("/")[0]):]
        if src == new: continue
        os.makedirs(os.path.dirname(new) or ".", exist_ok=True)
        sh("git", "mv", src, new)

# ── 2. the reference rewrite ─────────────────────────────────────────────────

EXCLUDE_PREFIX = (
    "archive/", "approvals/", "data/checks-reading/2026-", "dump/", "outside/",
    "skills/docx/", "skills/pptx/", "skills/xlsx/", "skills/pdf/", "skills/skill-creator/",
    "dist/", "node_modules/", "data/doc-overlap/gold-set/", "data/doc-overlap/docs.csv",
    "data/doc-overlap/matches.csv", "data/doc-growth/",
)
EXCLUDE_FILE = {
    "data/checks-reading/README.md",          # describes the dated reading
    "data/ui-units/coded.csv",                # citations against a commit
    "gold-set/RESULTS.md",
    "python/annotate/LOG.md",
    "pages/guides/code-layers.html",          # the 2026-08-07 decision document
    "node/render/fixtures/tree-web-tools.json",  # a 2026-07-30 capture
    "pages/wsl-sync/IMPORT.md",
}
def record_docs():
    out = set()
    try:
        import csv
        with open("docs/docs.csv", newline="") as fh:
            out = {r["path"] for r in csv.DictReader(fh) if r.get("status") == "record"}
    except OSError:
        pass
    return out
RECORDS = record_docs()

def excluded(path):
    if path in EXCLUDE_FILE or path in RECORDS: return True
    if path == "data/doc-overlap/gold-set/README.md": return False
    if path.startswith("tracker/"): return True   # handled by the tracker pass
    return path.startswith(EXCLUDE_PREFIX)

LEFT = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-/~@:%+=#?&$")
RIGHT = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-/~@%+")
WORD = re.compile(r"(?:tools|scripts)")
URL = re.compile(r"(?:github\.com/mehrlander/web-tools/(?:blob|tree|raw|edit|commits|blame)/[^/]+/"
                 r"|raw\.githubusercontent\.com/mehrlander/web-tools/[^/]+/"
                 r"|mehrlander\.github\.io/web-tools/"
                 r"|cdn\.jsdelivr\.net/gh/mehrlander/web-tools@[^/]+/"
                 r"|mehrlander/web-tools@[^:]+:"
                 r"|mehrlander/web-tools:)((?:tools|scripts)(?:/.*)?)$")
TRAIL = ".,:;)'\"`"

def split_path(s):
    m = re.match(r"([^#?]*)(.*)$", s)
    path, rest = m.group(1), m.group(2)
    core = path.rstrip(TRAIL)
    return core, path[len(core):] + rest

def tokens(line):
    """Each run of path characters around a folder word, once, at its longest:
    `mehrlander/web-tools:scripts/x.sh` holds two folder words and one path."""
    best = {}
    for w in WORD.finditer(line):
        a, b = w.start(), w.end()
        while a > 0 and line[a - 1] in LEFT: a -= 1
        if b < len(line) and line[b] == "/":
            b += 1
            while b < len(line) and line[b] in RIGHT: b += 1
        best[a] = max(b, best.get(a, b))
    for a in sorted(best):
        yield a, best[a]

def mapped_with_slash(core):
    return map_path(core.rstrip("/")) + ("/" if core.endswith("/") else "")

review = []

def rewrite_line(path_new, path_old, ln, line):
    edits = []
    base_old = pathlib.PurePosixPath(path_old).parent
    base_new = pathlib.PurePosixPath(path_new).parent
    for a, b in tokens(line):
        tok = line[a:b]
        seg = re.search(r"(^|[/@:=#?&$~])((?:tools|scripts)(?:/.*)?)$", tok)
        if not seg: continue
        tail = seg.group(2)
        head = tok[: len(tok) - len(tail)]
        if tail in ("tools", "scripts"): continue
        um = URL.search(tok)
        if um:
            core, suf = split_path(um.group(1))
            if old_exists(core):
                edits.append((a, b, tok[: len(tok) - len(um.group(1))] + mapped_with_slash(core) + suf))
            continue
        if head == "":
            core, suf = split_path(tail)
            if core in ("tools/", "scripts/"):
                review.append((path_new, ln, tok, "folder")); continue
            if old_exists(core):
                edits.append((a, b, mapped_with_slash(core) + suf))
            continue
        if head.startswith("./") or head.startswith("../"):
            core, suf = split_path(tok)
            target = os.path.normpath(os.path.join(str(base_old), core))
            if target.split("/")[0] not in ("tools", "scripts"): continue
            if not old_exists(target):
                review.append((path_new, ln, tok, "rel-missing")); continue
            rel = os.path.relpath(map_path(target), str(base_new))
            if core.endswith("/"): rel += "/"
            if not rel.startswith("."): rel = "./" + rel
            edits.append((a, b, rel + suf))
            continue
        review.append((path_new, ln, tok, "prefixed"))
    for a, b, new in sorted(edits, reverse=True):
        line = line[:a] + new + line[b:]
    return line

changed = {}
def write(fp, text):
    if not DRY: fp.write_text(text, encoding="utf-8")

files = [f for f in sh("git", "ls-files", "-z").split("\0") if f]
for f in files:
    if excluded(f): continue
    fp = ROOT / f
    try: text = fp.read_text(encoding="utf-8")
    except Exception: continue
    if "tools" not in text and "scripts" not in text: continue
    old = unmap_path(f) if not DRY else f
    lines = text.split("\n")
    new_lines = [rewrite_line(f, old, i + 1, l) if ("tools" in l or "scripts" in l) else l
                 for i, l in enumerate(lines)]
    if new_lines != lines:
        changed[f] = sum(1 for x, y in zip(lines, new_lines) if x != y)
        write(fp, "\n".join(new_lines))

# Tracker: Related blocks in every task; every section but the progress log in
# an open task. node/test/tracker-tasks.test.mjs holds Related paths to the tree,
# so these ride with the rename rather than landing on main first.
for fp in sorted(pathlib.Path("tracker/tasks").glob("*.md")):
    text = fp.read_text(encoding="utf-8")
    m = re.search(r"^status:\s*(\S+)", text, re.M)
    done = bool(m) and m.group(1) == "done"
    lines = text.split("\n")
    out, section, fm_open, n = [], None, bool(lines) and lines[0] == "---", 0
    for i, l in enumerate(lines):
        if fm_open:
            out.append(l)
            if i > 0 and l == "---": fm_open = False
            continue
        h = re.match(r"^##\s+(.*)", l)
        if h: section = h.group(1).strip().lower()
        allowed = (section == "related") if done else (section != "progress log")
        if allowed and ("tools" in l or "scripts" in l):
            nl = rewrite_line(str(fp), str(fp), i + 1, l)
            n += nl != l
            out.append(nl)
        else:
            out.append(l)
    if n:
        changed[str(fp)] = n
        write(fp, "\n".join(out))

# ── 3. hand edits ────────────────────────────────────────────────────────────

missed = []
def rep(path, a, b):
    fp = ROOT / path
    if not fp.exists(): missed.append(f"{path}: file absent"); return
    s = fp.read_text(encoding="utf-8")
    if s.count(a) != 1:
        missed.append(f"{path}: {s.count(a)} matches for {a[:70]!r}"); return
    write(fp, s.replace(a, b))

def rep_re(path, pattern, repl):
    fp = ROOT / path
    if not fp.exists(): missed.append(f"{path}: file absent"); return
    s = fp.read_text(encoding="utf-8")
    t, k = re.subn(pattern, repl, s)
    if not k: missed.append(f"{path}: no match for /{pattern}/")
    write(fp, t)

if not DRY:
    # The harness registry: its subject filter and the folder it describes.
    rep("node/build/tools-index.mjs",
        "// the app's Tools view, and has nothing to do with the tools/ folder.)\n//\n// tools/ and scripts/ are the two code layers",
        "// the app's Tools view.)\n//\n// node/ and python/ are the two code layers")
    rep("node/build/tools-index.mjs",
        "((f.startsWith('tools/') || f.startsWith('scripts/') ||\n      f.startsWith('.claude/hooks/') || f.startsWith('skills/hooks/')) &&",
        "((f.startsWith('node/') || f.startsWith('python/') ||\n      f.startsWith('.claude/') || f.startsWith('skills/hooks/')) &&")
    # Its layer domain and glossary.
    rep("docs/properties.csv",
        "scripts;python/annotate;tools;node/build;node/render;node/render/scenarios;.githooks;.claude/hooks;",
        "python;python/annotate;node;node/build;node/render;node/render/scenarios;.githooks;.claude;.claude/hooks;")
    rep_re("docs/vocabularies.csv", r'harness,layer,scripts,,"[^"\n]*"\n',
           'harness,layer,python,,Python scripts\n')
    rep_re("docs/vocabularies.csv", r"harness,layer,tools,,[^\n]*\n",
           'harness,layer,node,,Node files at the folder root\n')
    # The Map view's Harness rail.
    rep("lib/alpineComponents/map.js",
        "// docs/code-layers.md names tools/ and scripts/ as layers but could not",
        "// docs/code-layers.md names node/ and python/ as layers but could not")
    rep("lib/alpineComponents/map.js",
        "<!-- The folder rail: the tree as it exists on disk, scripts/\n                       and tools/ as the two roots,",
        "<!-- The folder rail: the tree as it exists on disk, python/\n                       and node/ as the two roots,")
    rep("lib/alpineComponents/map.js",
        "// Distributed tools under scripts/ are real repository automation and",
        "// Distributed tools under python/ are real repository automation and")
    rep("lib/alpineComponents/map.js",
        "if (it.path.startsWith('scripts/')) this.harnessDir = 'scripts';",
        "if (it.path.startsWith('python/')) this.harnessDir = 'python';")
    rep("lib/alpineComponents/map.js", "harnessDir: 'tools',", "harnessDir: 'node',")
    # Bare folder words in commands and code.
    rep("package.json", '"code-scan": "python3 python/unclaimed-code.py lib scripts tools"',
        '"code-scan": "python3 python/unclaimed-code.py lib python node scripts"')
    rep("python/code-shape.py", '["lib", "scripts", "tools"]', '["lib", "python", "node", "scripts"]')
    rep(".githooks/pre-commit", "if changed tools scripts skills/hooks", "if changed node python .claude skills/hooks")
    rep(".githooks/pre-commit", "# --- leg harness-census: tools/ or scripts/ ->", "# --- leg harness-census: node/, python/ or .claude/ ->")
    rep_re("python/doc-overlap.py", r"ROOT / 'scripts' /", "ROOT / 'python' /")
    rep("node/test/claude-mark.test.mjs", "new Set(['node_modules', '.git', 'dist', 'tools'])",
        "new Set(['node_modules', '.git', 'dist', 'node'])")
    rep("node/test/csv-census.test.mjs", "mkdirSync(path.join(root, 'scripts'));", "mkdirSync(path.join(root, 'python'));")
    rep("node/render/page-measures.mjs", r"/^tools\/render\//", r"/^node\/render\//")
    # The setup script's readers: the plugin hook and its test.
    rep("skills/hooks/environment-report.sh",
        'CUR="$HOME/.claude/plugins/marketplaces/web-tools/scripts/environment-setup.sh"',
        'CUR="$HOME/.claude/plugins/marketplaces/web-tools/.claude/environment-setup.sh"')
    rep("node/test/environment-report.test.mjs", "'marketplaces', 'web-tools', 'scripts');", "'marketplaces', 'web-tools', '.claude');")
    rep("node/test/environment-report.test.mjs", r"/scripts\/environment-setup\.sh/", r"/\.claude\/environment-setup\.sh/")
    # A path inside a regex literal, where escaped slashes split the token.
    rep("node/test/anchors.test.mjs", r"\(scripts\/annotate\/reanchor\.py\)", r"\(python\/annotate\/reanchor\.py\)")
    # A moved Python file whose root sits one level nearer.
    if (ROOT / "python/audit-payload.py").exists():
        rep("python/audit-payload.py", "parents[2] / \"skills/doc-craft", "parents[1] / \"skills/doc-craft")
    # Prefixed paths the tokenizer leaves alone.
    for f in files:
        fp = ROOT / f
        if excluded(f) or not fp.exists(): continue
        try: s = fp.read_text(encoding="utf-8")
        except Exception: continue
        t = (s.replace("$DIR/tools/", "$DIR/node/")
              .replace("/home/user/web-tools/tools/", "/home/user/web-tools/node/")
              .replace("${BLOB}/tools/", "${BLOB}/node/")
              .replace("suite=tools/", "suite=node/")
              .replace("../web-tools/scripts/", "../web-tools/python/")
              .replace("../web-tools/tools/", "../web-tools/node/"))
        if t != s: write(fp, t)
    # Folder segments in path.join and friends: 'tools', '<next>' and 'scripts', '<next>'.
    SEG = re.compile(r"(['\"])(tools|scripts)\1(\s*,\s*)(['\"])([^'\"]+)\4")
    SKIP_NEXT = {"first tap opens", "and a third opens it again",
                 "no ref and no directory leaves only the repo", "on-stop.sh"}
    for f in files:
        if not re.search(r"\.(mjs|js|cjs)$", f) or excluded(f): continue
        fp = ROOT / f
        if not fp.exists(): continue
        s = fp.read_text(encoding="utf-8")
        def seg(m):
            if m.group(5) in SKIP_NEXT: return m.group(0)
            to_node = m.group(2) == "tools" or m.group(5).endswith(NODE_EXT)
            new = "node" if to_node else "python"
            return f"{m.group(1)}{new}{m.group(1)}{m.group(3)}{m.group(4)}{m.group(5)}{m.group(4)}"
        t = SEG.sub(seg, s)
        if t != s: write(fp, t)
    # Prose that names a folder, not a file.
    rep("README.md", "the Node harness under `tools/` —", "the Node harness under `node/` —")
    rep("docs/loader.md", "under [`tools/`](../node/README.md).", "under [`node/`](../node/README.md).")
    rep("docs/registries.md", "The `harness` scope covers `tools/`\nand `scripts/` and excludes `node/test/`, which `tests` owns.",
        "The `harness` scope covers `node/`\nand `python/` and excludes `node/test/`, which `tests` owns.")
    rep("docs/registries.csv", "every executable the repo runs on itself: tools/ and scripts/ (node/test/ excluded; the Tests registry owns it), .githooks/, .claude/hooks/,",
        "every executable the repo runs on itself: node/ and python/ (node/test/ excluded; the Tests registry owns it), .githooks/, .claude/,")
    rep("docs/registries.csv", "Every code file under tools/ and scripts/,", "Every code file under node/ and python/,")
    rep("docs/tests.csv", "the harness registry matches tools/ and scripts/;", "the harness registry matches node/ and python/;")
    rep("node/test/derived-artifacts.test.mjs", "test('the harness registry matches tools/ and scripts/',",
        "test('the harness registry matches node/ and python/',")
    rep("node/build/docs-reach.mjs", "// The corpora are deliberately narrow. tools/ is excluded:",
        "// The corpora are deliberately narrow. node/ is excluded:")
    rep("skills/hooks/reading-column.py", "LIVING IN scripts/.", "LIVING IN python/.")
    rep("skills/hooks/reading-column.py", "a second copy under scripts/ would be", "a second copy under python/ would be")
    rep("skills/file-retrieval/sources.csv", "tools,tools/**/*.md\ntools,tools/**/*.py\ntools,scripts/**/*.py\n",
        "tools,node/**/*.md\ntools,python/**/*.py\n")
    rep("docs/repetitions.csv", "it owns the tools/ folder split", "it owns the node/ folder split")
    rep("docs/docs.csv", "every tools/ and scripts/ file,", "every node/ and python/ file,")
    rep("data/design/content.csv", "tools/,hybrid-authored,exclude,Build and test tooling; code register",
        "node/,hybrid-authored,exclude,Node tooling and scripts; code register")
    rep("data/design/content.csv", "scripts/,hybrid-authored,exclude,Utility scripts; code register",
        "python/,hybrid-authored,exclude,Python scripts; code register")
    rep("node/README.md", "# tools/ — headless render + build harness\n", "# node/ — headless render + build harness\n")
    rep("node/README.md", "*format* itself lives outside `tools/`,", "*format* itself lives outside `node/`,")
    rep("node/README.md", "| `tools/`, `scripts/` | `npm run tools-index` |", "| `node/`, `python/` | `npm run tools-index` |")
    # docs/code-layers.md: the layer table (approved as "docs/code-layers.md's
    # layer table changes with this") and the folder names around it.
    rep_re("docs/code-layers.md", r"\| `scripts/` \*\*\w+\*\* [^\n]*\n\| `tools/` \*\*\w+\*\* [^\n]*\n",
        lambda m: "| `python/` **Python** | is Python | a `python3` invocation |\n"
                  "| `node/` **Node** | is Node, never shipped to a page | a `node`/`npm` invocation |\n")
    rep("docs/code-layers.md", "the Python script folder (`scripts/`)", "the Python script folder (`python/`)")
    rep("docs/code-layers.md", "the Node script folder (`tools/`)", "the Node script folder (`node/`)")
    rep("docs/code-layers.md", "one skill lives in that skill's folder.",
        "one skill lives in that skill's folder; a script a platform runs lives with\n   that platform's files (`.githooks/`, `.github/workflows/`, `.claude/`,\n   `skills/hooks/`).")
    rep("docs/code-layers.md", "## tools/, which is the weak layer", "## node/, which is the weak layer")
    rep("docs/code-layers.md", "under `tools/` and `scripts/` (`node/test/` stays with the test registry).",
        "under `node/` and `python/` (`node/test/` stays with the test registry).")

# ── 4. restamp ───────────────────────────────────────────────────────────────

if not DRY:
    if subprocess.run(["git", "diff", "--quiet", "--", "userscripts/lib/launcher.js"]).returncode:
        sh("python3", "python/userscript-stub.py", "launcher", "--ref", "main", "--name", "wt launcher",
           "--description", "The Web Tools launcher and swipe deck", "--match", "*://*/*",
           "--run-at", "document-end")
    sh("node", "node/checkout-setup.mjs", "--git-only", "--quiet", check=False)
    subprocess.run(["git", "add", "-A"])
    subprocess.run(["git", "hook", "run", "pre-commit", "--", "--all"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["git", "add", "-A"])

# ── report ───────────────────────────────────────────────────────────────────

OUT.mkdir(parents=True, exist_ok=True)
with (OUT / "review.tsv").open("w") as o:
    for r in review: o.write("\t".join(map(str, r)) + "\n")
if not DRY:
    import importlib.util
    spec = importlib.util.spec_from_file_location("cc", "skills/hooks/commit-consent.py")
    cc = importlib.util.module_from_spec(spec); spec.loader.exec_module(cc)
    rows, globs = cc.staged("."), cc.doc_globs(".")
    docs = [p for st, p in rows if st == "M" and cc.is_doc(p, globs) and not cc.is_generated(".", p)
            and not cc.is_copy(".", p) and not cc.declares_free(".", p)]
    with (OUT / "trailers.txt").open("w") as o:
        for d in docs:
            q = ("docs/code-layers.md's layer table changes with this." if d == "docs/code-layers.md"
                 else "a scripted rewrite of every living reference")
            o.write(f'Doc-change-approved: "{q}" -> {d}\n')
print(f"rewrite: {len(changed)} files, {sum(changed.values())} lines; review rows: {len(review)} -> {OUT}/review.tsv")
for m in missed: print("hand edit not applied:", m)
print("moves:", ", ".join(f"{k} -> {v}" for k, v in SPECIAL.items() if k != v) or "none special")
