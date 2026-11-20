#!/usr/bin/env python3
"""user-call.py: writes, closes and reads user calls. The format is in
SKILL.md beside this script.

    user-call.py add < call.json [--store D]              write (validates, stamps)
    user-call.py close <id> <answer> [note] [--store D]   mark it decided
    user-call.py answers <id> [--store D]                 what the owner answered
    user-call.py list [session] [--store D]               open user calls, newest first
    user-call.py edits --old A --new B                    a documentation call's edits, from two copies
    user-call.py edits --base REF FILE                    the same, from FILE against its text at REF
    user-call.py link <id> [--store D] [--at REPO@REF]    the address of the call's page, where it is answered
    user-call.py patch <id> [--store D]                   the latest answer's recorded patch, for git apply

The store is found the way the notes skill's note.py finds its own: a checkout
whose .web-tools.json on origin/main declares "user-calls" (a path relative to
that checkout), searched in the project root, its children and its siblings.
--store names the folder instead. Reads come from origin/main after a fetch, and
writes land on origin/main by git plumbing, so the checkout may sit on any branch.
"""
import datetime
import difflib
import io
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import time
from pathlib import Path

KINDS = {"decision", "merge", "documentation", "pick"}
PICK_SOURCES = {"icons", "commons"}
PICK_GROUPS = {"off", "tight", "medium", "loose"}
MERGE = ["Merge", "Message"]
TAKE_ADJUST = ["Take", "Adjust"]
THEN = {"go": "make the change and carry on", "return": "draft the change and file a new call before acting"}
LINKS = {"pr", "branch", "file", "card", "url", "view", "task"}
SIZES = ("XS", "S", "M", "L", "XL", "?")
CONFIDENCE = {"firm", "lean"}
# What an edit's note says it is for: the text is wrong, or it reads poorly.
NOTE_KINDS = {"correct", "clarify"}
# A tracker task file, a PR, and another call's id: the three things a call
# can name as a task link or wait on.
TASK_REF = r"[^/\s]+/[^@:\s]+(@[^:\s]+)?:(\S+/)?tracker/tasks/[a-z0-9-]+\.md"
PR_REF = r"[^/\s]+/[^#\s]+#\d+"
CALL_ID = r"[0-9a-f]{8}-[a-z0-9-]+"
# A file or folder at a ref, the form a chain names its design and theme in.
CHAIN_REF = r"[^/\s]+/[^@:\s]+@[^:\s]+:[^\s#]+"

# The kind of a shipped change, and the detail each one carries: Keep a
# Changelog's verbs (Deprecated and Security dropped as unused here) plus
# `recorded`, for work that writes something down and alters no behaviour.
CHANGES = {"added": {"new"}, "changed": {"old", "new"}, "fixed": {"old", "new"},
           "removed": {"old"}, "recorded": {"new"}}


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()


def check(c):
    errs = []
    if not re.fullmatch(r"[0-9a-f]{8}", str(c.get("session") or "")):
        errs.append("session must be the eight-hex short id")
    if not re.fullmatch(r"[a-z0-9-]+", str(c.get("slug") or "")):
        errs.append("slug must be a lowercase slug")
    if c.get("kind", "decision") not in KINDS:
        errs.append(f"kind must be one of {sorted(KINDS)}")
    if c.get("background"):
        errs.append("no background: put depth in materials")
    if c.get("kind", "decision") == "merge":
        if not c.get("pr"):
            errs.append("a merge call names its pr")
        shipped, loose = c.get("shipped") or [], c.get("loose") or []
        texts = [x if isinstance(x, str) else (x or {}).get("text") or (x or {}).get("new") or (x or {}).get("old") or ""
                 for x in shipped]
        if not 1 <= len(shipped) <= 3 or not all(isinstance(t, str) and 0 < len(t) <= 120 for t in texts):
            errs.append("shipped is 1 to 3 lines, 120 characters each")
        for x in shipped:
            p = x.get("proof") if isinstance(x, dict) else None
            k = x.get("kind") if isinstance(x, dict) else None
            if k is not None:
                if k not in CHANGES:
                    errs.append(f"a shipped kind is one of {sorted(CHANGES)}")
                else:
                    have = {f for f in ("old", "new") if x.get(f)}
                    if have != CHANGES[k]:
                        errs.append(f"a {k} line carries {' and '.join(sorted(CHANGES[k]))}, not {' and '.join(sorted(have)) or 'neither'}")
                    for f in have:
                        if len(str(x[f])) > 60:
                            errs.append(f"{f} is a short phrase, 60 characters at most")
            if isinstance(x, dict) and len(str(x.get("head") or "")) > 28:
                errs.append("a shipped head is a topic, 28 characters at most")
            if p and (p.get("kind") not in LINKS or not str(p.get("ref") or "").strip()):
                errs.append(f"proof {p!r} needs a kind in {sorted(LINKS)} and a ref")
        if len(loose) > 3 or not all(isinstance(x, str) and 0 < len(x) <= 120 for x in loose):
            errs.append("loose is up to 3 lines, 120 characters each, or empty")
        if len(str(c.get("effect") or "")) > 140:
            errs.append("effect is one line, 140 characters at most")
        if c.get("options") and c["options"] != MERGE:
            errs.append("a merge call's answers are fixed: Merge / Message")
    elif c.get("kind") == "documentation":
        q, brief, rec, why = (str(c.get(k) or "").strip() for k in ("question", "brief", "recommend", "why"))
        if not q or len(q) > 80:
            errs.append("question is required, 80 characters at most")
        if not brief or len(brief) > 200:
            errs.append("brief is required, 200 characters at most: one line of what the edits do")
        if len(rec) > 80 or len(why) > 100:
            errs.append("recommend is 80 characters at most and why 100")
        if not re.fullmatch(r"[^/\s]+/[^@:\s]+(@[^:\s]+)?:\S+", str(c.get("file") or "")):
            errs.append("file must read owner/repo[@ref]:path")
        elif not re.search(r"\.(md|csv)$", c["file"], re.I):
            errs.append("a documentation call edits a markdown or CSV file; prose inside code is reviewed on its PR")
        if "base" in c and not re.fullmatch(r"[^\s:@]+", str(c.get("base") or "")):
            errs.append("base is the ref the edits were made against, such as main")
        edits = c.get("edits") or []
        if c.get("new") is not None and c.get("new") is not True:
            errs.append("new is true or absent")
        if c.get("new"):
            if edits:
                errs.append("a new document carries no edits: the page shows it whole")
        elif not 1 <= len(edits) <= 40:
            errs.append("edits is 1 to 40 entries")
        for i, e in enumerate(edits):
            if not isinstance(e, dict) or not str(e.get("from") or "").strip() or not isinstance(e.get("to"), str):
                errs.append(f"edits[{i}] needs a non-empty from and a to")
            elif e["from"] == e["to"]:
                errs.append(f"edits[{i}] changes nothing")
            elif len(str(e.get("why") or "")) > 100:
                errs.append(f"edits[{i}].why is one clause, 100 characters at most")
            elif bool(str(e.get("background") or "").strip()) != bool(str(e.get("proposal") or "").strip()):
                errs.append(f"edits[{i}] gives a background and a proposal together, or neither")
            elif any(len(str(e.get(k) or "")) > 160 for k in ("background", "proposal")):
                errs.append(f"edits[{i}].background and .proposal are 160 characters at most")
            elif any("](" in str(e.get(k) or "") or "http" in str(e.get(k) or "") for k in ("background", "proposal")):
                errs.append(f"edits[{i}].background and .proposal carry no links")
            else:
                errs += notes(e.get("notes"), f"edits[{i}]")
        if c.get("options"):
            errs.append("a documentation call has no options: each edit is answered on its card")
    elif c.get("kind") == "pick":
        q, brief = (str(c.get(k) or "").strip() for k in ("question", "brief"))
        if not q or len(q) > 80:
            errs.append("question is required, 80 characters at most")
        if not brief or len(brief) > 200:
            errs.append("brief is required, 200 characters at most: one line of what the picks are for")
        b = c.get("board") if isinstance(c.get("board"), dict) else {}
        qs = b.get("q") or []
        if "ideas" in b:
            if not re.fullmatch(r"[^/\s]+/[^@:\s]+@[0-9a-f]{7,40}:\S+\.json", str(b["ideas"])) or len(b) > 1:
                errs.append("board.ideas is an idea board's address, owner/repo@<commit>:path.json, and stands alone")
        elif not isinstance(qs, list) or not 1 <= len(qs) <= 12 or not all(isinstance(x, str) and 0 < len(x.strip()) <= 40 and "," not in x for x in qs):
            errs.append("board.q is 1 to 12 searches, 40 characters each, with no commas")
        if b.get("src", "icons") not in PICK_SOURCES:
            errs.append(f"board.src is one of {sorted(PICK_SOURCES)}")
        if not all(isinstance(x, str) and re.fullmatch(r"[a-z0-9-]+", x) for x in b.get("sets") or []):
            errs.append("board.sets are Iconify set prefixes")
        if b.get("color") and not re.fullmatch(r"[0-9a-fA-F]{6}", str(b["color"])):
            errs.append("board.color is six hex digits, without the #")
        if b.get("group", "medium") not in PICK_GROUPS:
            errs.append(f"board.group is one of {sorted(PICK_GROUPS)}")
        if c.get("options") or c.get("recommend"):
            errs.append("a pick call has no options or recommendation: the answer is the picks")
    else:
        q, brief, why = (str(c.get(k) or "").strip() for k in ("question", "brief", "why"))
        if not q or len(q) > 80:
            errs.append("question is required, 80 characters at most")
        if not brief or len(brief) > 200:
            errs.append("brief is required, 200 characters at most: one line of what is at stake")
        if len(why) > 100:
            errs.append("why is one clause, 100 characters at most")
        opts = c.get("options")
        if opts is None:
            if not 0 < len(str(c.get("recommend") or "").strip()) <= 20:
                errs.append("a decision recommends its answer in recommend, 20 characters at most: the owner takes it or adjusts it")
        else:
            if not 2 <= len(opts) <= 4 or not all(isinstance(o, str) and 0 < len(o) <= 20 for o in opts):
                errs.append("options are 2 to 4 plain answers, 20 characters each, with no explanation attached")
            if c.get("recommend") and c["recommend"] not in opts:
                errs.append("recommend must be one of the options")
    if c.get("pr") and not re.fullmatch(r"[^/\s]+/[^#\s]+#\d+", c["pr"]):
        errs.append("pr must read owner/repo#n")
    for l in c.get("materials") or []:
        if l.get("kind") not in LINKS or not str(l.get("ref") or "").strip():
            errs.append(f"material {l!r} needs a kind in {sorted(LINKS)} and a ref")
        elif l["kind"] == "task" and not re.fullmatch(TASK_REF, l["ref"]):
            errs.append(f"task {l['ref']!r} must read owner/repo[@ref]:<path>/tracker/tasks/<id>.md")
        elif l.get("answer") is not None and l["answer"] not in (c.get("options") or TAKE_ADJUST[:1]):
            errs.append(f"material {l['ref']!r} names answer {l['answer']!r}: "
                        + ("one of the options" if c.get("options") else "a Take or Adjust call's is Take"))
        elif l.get("field") is not None and not re.fullmatch(r"[a-z][a-z0-9_-]*(\.[a-z0-9_-]+|\[\d+\])*", str(l["field"])):
            errs.append(f"material {l['ref']!r}: field is a block's path prefix, as chain.at is")
    ch = c.get("chain")
    if ch is not None:
        if not isinstance(ch, dict) or not re.fullmatch(CHAIN_REF, str(ch.get("design") or "")):
            errs.append("chain.design must read owner/repo@ref:path, a folder with template.html and content.json")
        elif not re.fullmatch(r"[a-z][a-z0-9_-]*", str(ch.get("at") or "")):
            errs.append("chain.at names the block the call decides: the first part of its fields' paths")
        elif ch.get("theme") and not re.fullmatch(CHAIN_REF + r"\.json#[a-z0-9-]+", str(ch["theme"])):
            errs.append("chain.theme must read owner/repo@ref:path.json#name")
        elif ch.get("words") and not re.fullmatch(CHAIN_REF + r"\.json", str(ch["words"])):
            errs.append("chain.words must read owner/repo@ref:path.json")
    if c.get("glossary") is not None and not re.fullmatch(CHAIN_REF + r"\.json", str(c["glossary"])):
        errs.append("glossary must read owner/repo@ref:path.json")
    if c.get("views") is not None and not re.fullmatch(CHAIN_REF + r"\.json", str(c["views"])):
        errs.append("views must read owner/repo@ref:path.json")
    if c.get("tree") is not None and not re.fullmatch(CHAIN_REF + r"\.json", str(c["tree"])):
        errs.append("tree must read owner/repo@ref:path.json")
    errs += shape(c)
    return errs


def notes(ns, at):
    """An edit's notes: what it is for, each a correction or a clarification."""
    if ns is None:
        return []
    if not isinstance(ns, list) or not 1 <= len(ns) <= 6:
        return [f"{at}.notes is a list of 1 to 6 notes"]
    errs = []
    for j, n in enumerate(ns):
        if not isinstance(n, dict) or not 0 < len(str(n.get("text") or "").strip()) <= 100:
            errs.append(f"{at}.notes[{j}] needs a text of one clause, 100 characters at most")
        elif n.get("kind") is not None and n["kind"] not in NOTE_KINDS:
            errs.append(f"{at}.notes[{j}].kind is one of {sorted(NOTE_KINDS)}, or left off")
    return errs


def shape(c):
    """The five optional fields that say what sort of call it is."""
    errs = []
    if "name" in c and not (isinstance(c["name"], str) and 0 < len(c["name"].strip()) <= 24):
        errs.append("name is a handle of 24 characters at most")
    if "size" in c and c["size"] not in SIZES:
        errs.append(f"size is one of {' '.join(SIZES)}")
    if "confidence" in c:
        if c["confidence"] not in CONFIDENCE:
            errs.append("confidence is firm or lean")
        elif c.get("kind", "decision") != "merge" and not c.get("recommend"):
            errs.append("confidence rates a recommendation, so it needs one")
        elif c["confidence"] == "lean" and c.get("kind", "decision") != "merge" and not str(c.get("why") or "").strip():
            errs.append("a lean recommendation says why in `why`")
    if "reversible" in c and not isinstance(c["reversible"], bool):
        errs.append("reversible is true or false")
    deps = c.get("depends_on")
    if deps is not None:
        if not isinstance(deps, list) or not 1 <= len(deps) <= 6:
            errs.append("depends_on is a list of 1 to 6 entries")
        else:
            for x in deps:
                if not isinstance(x, str) or not any(re.fullmatch(r, x) for r in (PR_REF, CALL_ID, TASK_REF)):
                    errs.append(f"depends_on {x!r} is a PR (owner/repo#n), a call id or a task path")
    return errs


def name_taken(c, calls, cid):
    """Another open call among `calls` ({id: text}) already answering to this call's name."""
    name = str(c.get("name") or "").strip().lower()
    if not name:
        return ""
    for other, text in calls.items():
        if other == cid:
            continue
        try:
            o = json.loads(text)
        except ValueError:
            continue
        if o.get("status") == "open" and str(o.get("name") or "").strip().lower() == name:
            return o.get("id") or other
    return ""


def blocks(text):
    out, cur = [], []
    for line in text.splitlines():
        if line.strip():
            cur.append(line)
        elif cur:
            out.append("\n".join(cur)); cur = []
    if cur:
        out.append("\n".join(cur))
    return out


def edits(old, new):
    """A documentation call's edits from two copies of a document: home's
    propose.py pairing, kept the same so a pass filed either way pairs alike."""
    a, b = blocks(old), blocks(new)
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "equal":
            continue
        if op == "replace":
            if i2 - i1 == j2 - j1:
                out.extend({"from": x, "to": y} for x, y in zip(a[i1:i2], b[j1:j2]))
            else:
                out.append({"from": "\n\n".join(a[i1:i2]), "to": "\n\n".join(b[j1:j2])})
            continue
        if i1 > 0:
            ctx, before = a[i1 - 1], True
        elif i2 < len(a):
            ctx, before = a[i2], False
        else:
            raise ValueError("the old copy has no unchanged block to anchor this change on")
        moved = b[j1:j2] if op == "insert" else a[i1:i2]
        joined = "\n\n".join([ctx, *moved] if before else [*moved, ctx])
        out.append({"from": ctx, "to": joined} if op == "insert" else {"from": joined, "to": ctx})
    return out


def flag(argv, name):
    if name not in argv:
        return argv, None
    i = argv.index(name)
    return argv[:i] + argv[i + 2:], argv[i + 1]


def git(repo, *a, env=None, check=True, data=None):
    r = subprocess.run(["git", "-C", repo, *a], capture_output=True, input=data,
                       env={**os.environ, **(env or {})})
    if check and r.returncode:
        sys.exit(f"user-call: git {' '.join(a[:2])} failed: {r.stderr.decode('utf-8', 'replace').strip()}")
    return r


class Store:
    """The calls folder: `path` inside the checkout `repo`, read and written on origin/main."""

    def __init__(self, explicit):
        self.repo, self.path = self.find(explicit)
        git(self.repo, "fetch", "-q", "origin", "main")

    @staticmethod
    def find(explicit):
        if explicit:
            path = os.path.abspath(explicit)
            probe = path
            while not os.path.isdir(probe):   # the folder may not exist before the first call
                probe = os.path.dirname(probe)
            top = git(probe, "rev-parse", "--show-toplevel").stdout.decode().strip()
            return top, os.path.relpath(path, top)
        root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
        cands = [root]
        for base in (root, os.path.dirname(root)):
            try:
                cands += [os.path.join(base, d) for d in sorted(os.listdir(base))]
            except OSError:
                pass
        for repo in cands:
            r = git(repo, "show", "origin/main:.web-tools.json", check=False)
            try:
                if r.returncode == 0:
                    declared = json.loads(r.stdout).get("user-calls")
                else:
                    with open(os.path.join(repo, ".web-tools.json"), encoding="utf-8") as fh:
                        declared = json.load(fh).get("user-calls")
            except (OSError, ValueError):
                continue
            if isinstance(declared, str) and declared:
                return repo, declared.strip("/")
        sys.exit('user-call: no checkout declares a user-call store (.web-tools.json "user-calls"); '
                 "attach the store repo or pass --store")

    def read(self, name):
        """A file in the store on main, or None."""
        r = git(self.repo, "show", f"origin/main:{self.path}/{name}", check=False)
        return r.stdout.decode("utf-8") if r.returncode == 0 else None

    def call(self, cid):
        text = self.read(f"{cid}.json")
        if text is None:
            sys.exit(f"user-call: no call {cid} on main")
        return json.loads(text)

    def answers(self, cid):
        text = self.read(f"{cid}.answers.jsonl") or ""
        return [json.loads(l) for l in text.splitlines() if l.strip()]

    def calls(self, prefix=""):
        """Every call on main whose id starts with prefix, as {id: text}, from one archive."""
        r = git(self.repo, "archive", "--format=tar", "origin/main", f"{self.path}/", check=False)
        if r.returncode:
            return {}
        out = {}
        with tarfile.open(fileobj=io.BytesIO(r.stdout)) as tf:
            for m in tf.getmembers():
                name = m.name[len(self.path) + 1:]
                if m.isfile() and "/" not in name and name.startswith(prefix) and name.endswith(".json"):
                    out[name[:-5]] = tf.extractfile(m).read().decode("utf-8")
        return out

    def write(self, name, text, msg, attempts=5):
        """Commit one file onto origin/main without touching the working tree."""
        path = f"{self.path}/{name}"
        blob = git(self.repo, "hash-object", "-w", "--stdin", data=text.encode("utf-8")).stdout.decode().strip()
        for _ in range(attempts):
            tip = git(self.repo, "rev-parse", "origin/main").stdout.decode().strip()
            with tempfile.TemporaryDirectory() as tmp:
                env = {"GIT_INDEX_FILE": os.path.join(tmp, "index")}
                git(self.repo, "read-tree", tip, env=env)
                git(self.repo, "update-index", "--add", "--cacheinfo", f"100644,{blob},{path}", env=env)
                tree = git(self.repo, "write-tree", env=env).stdout.decode().strip()
            commit = git(self.repo, "commit-tree", tree, "-p", tip, "-m", msg).stdout.decode().strip()
            if git(self.repo, "push", "-q", "origin", f"{commit}:refs/heads/main", check=False).returncode == 0:
                git(self.repo, "fetch", "-q", "origin", "main", check=False)
                return path
            time.sleep(1)
            git(self.repo, "fetch", "-q", "origin", "main")
        sys.exit("user-call: push to main kept losing the race; nothing was written")


def answer_lines(r, call=None):
    """One answer line as printed by `answers`: its summary, and for a
    documentation answer each decision, the edit it is on, and the notes."""
    note = f'  "{r["note"]}"' if r.get("note") else ""
    then = f", then {r['then']} ({THEN.get(r['then'], '?')})" if r.get("then") else ""
    out = [f"{r['answer']}{then}  ({r.get('by', '')} {r.get('at', '')}){note}"]
    if r.get("commit") or r.get("target"):
        out.append(f"  committed to {r.get('target') or 'the file'}: {r.get('commit', '')}".rstrip(": "))
    elif r.get("patch"):
        n = sum(1 for l in r["patch"].splitlines() if l[:1] in "+-" and l[:3] not in ("+++", "---"))
        what = "takes the discarded edits back out of the branch, for" if r.get("base") else "waits for"
        out.append(f"  not committed: a patch of {n} changed lines {what} a session (user-call.py patch {r.get('call', '').rsplit('/', 1)[-1].removesuffix('.json') or '<id>'})")
    edits = (call or {}).get("edits") or []
    for d in r.get("decisions") or []:
        n = d.get("edit")
        e = edits[n - 1] if isinstance(n, int) and 0 < n <= len(edits) else {}
        what = e.get("why") or " ".join(str(e.get("from", "")).split())[:60]
        out.append(f"  {n}. {d.get('decision', '')}" + (f"  ({what})" if what else ""))
        if d.get("note"):
            out += ["       " + line for line in d["note"].splitlines()]
    for x in r.get("notes") or []:
        out.append(f'  on "{x.get("on", "")}": ' + " ".join(str(x.get("note", "")).split()))
    for x in r.get("picks") or []:
        out.append(f"  {x.get('id', '')}  {x.get('href', '')}".rstrip())
    return out


def main(argv):
    argv, at_store = flag(argv, "--store")
    if len(argv) < 2 or argv[1] not in {"add", "close", "answers", "list", "edits", "link", "patch"}:
        sys.exit(__doc__)
    cmd = argv[1]
    if cmd == "edits":
        argv, base = flag(argv, "--base")
        if base:
            if len(argv) < 3:
                sys.exit("user-call: edits --base needs the file, as in edits --base main docs/x.md")
            f = Path(argv[2]).resolve()
            sh = lambda *a: subprocess.run(["git", *a], cwd=f.parent, capture_output=True, text=True)
            top = sh("rev-parse", "--show-toplevel")
            shown = sh("show", f"{base}:{f.relative_to(top.stdout.strip()).as_posix()}") if top.returncode == 0 else top
            if shown.returncode != 0:
                if top.returncode == 0 and sh("cat-file", "-e", f"{base}:{f.relative_to(top.stdout.strip()).as_posix()}").returncode != 0 and f.exists():
                    sys.exit(f"user-call: {argv[2]} is new at {base}: file the call with \"new\": true and no edits")
                sys.exit(f"user-call: could not read {argv[2]} at {base}: {shown.stderr.strip()}")
            old_text, new_text = shown.stdout, f.read_text(encoding="utf-8")
        else:
            argv, old = flag(argv, "--old")
            argv, new = flag(argv, "--new")
            if not old or not new:
                sys.exit("user-call: edits needs --old and --new, or --base and a file")
            old_text, new_text = Path(old).read_text(encoding="utf-8"), Path(new).read_text(encoding="utf-8")
        found = edits(old_text, new_text)
        if not found:
            sys.exit("user-call: no change between the two copies")
        print(json.dumps(found, indent=2, ensure_ascii=False))
        return
    if cmd == "link":
        argv, at = flag(argv, "--at")
        store = Store(at_store)
        c = store.call(argv[2])
        where = at or "mehrlander/web-tools-private"
        rel = f"{store.path}/{argv[2]}.json"
        board = c.get("board") if isinstance(c.get("board"), dict) else {}
        page = ("user-call.html#src=" if c.get("kind") != "pick"
                else "idea-board.html#user-call=" if "ideas" in board else "image-board.html#user-call=")
        print("https://mehrlander.github.io/web-tools/pages/" + page + where + ":" + rel)
        return
    if cmd == "add":
        c = json.load(sys.stdin)
        if c.get("kind") == "merge":
            sys.exit("user-call: a merge is not a call; list the pull requests ready to merge in the "
                     "reply, each linked to its branch view")
        errs = check(c)
        if errs:
            sys.exit("user-call: " + "; ".join(errs))
        cid = f"{c['session']}-{c['slug']}"
        store = Store(at_store)
        other = name_taken(c, store.calls(), cid)
        if other:
            sys.exit(f"user-call: the name {c['name']!r} is already {other}'s")
        old = json.loads(store.read(f"{cid}.json") or "{}")
        c = {"schema": "user-call/1", "id": cid, "kind": "decision", "status": "open",
             "created": old.get("created") or stamp(), "updated": stamp(), **c}
        print(store.write(f"{cid}.json", json.dumps(c, indent=2, ensure_ascii=False) + "\n",
                          f"user call {cid}: " + ("refiled" if old else "filed")))
    elif cmd == "close":
        store = Store(at_store)
        c = store.call(argv[2])
        c.update(status="closed", updated=stamp(),
                 closed={"at": stamp(), "answer": argv[3], "note": argv[4] if len(argv) > 4 else ""})
        print(store.write(f"{argv[2]}.json", json.dumps(c, indent=2, ensure_ascii=False) + "\n",
                          f"user call {argv[2]}: closed, {argv[3]}"))
    elif cmd == "answers":
        store = Store(at_store)
        rows = store.answers(argv[2])
        text = store.read(f"{argv[2]}.json")
        call = json.loads(text) if text else None
        for r in rows:
            print("\n".join(answer_lines(r, call)))
        if not rows:
            print(f"user-call: no answers for {argv[2]}")
    elif cmd == "patch":
        rows = Store(at_store).answers(argv[2])
        last = rows[-1] if rows else {}
        if not last.get("patch"):
            sys.exit(f"user-call: the latest answer to {argv[2]} carries no patch"
                     + (" (it was committed)" if last.get("commit") else ""))
        sys.stdout.write(last["patch"] if last["patch"].endswith("\n") else last["patch"] + "\n")
    elif cmd == "list":
        pre = argv[2] + "-" if len(argv) > 2 else ""
        calls = [json.loads(t) for t in Store(at_store).calls(pre).values()]
        for c in sorted(calls, key=lambda c: c.get("created", ""), reverse=True):
            if c.get("status") == "open":
                print(f"{c['id']}: {c['question']}")


if __name__ == "__main__":
    main(sys.argv)
