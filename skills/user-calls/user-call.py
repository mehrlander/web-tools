#!/usr/bin/env python3
"""user-call.py: writes, closes and reads user calls. The format is web-tools
docs/envelopes/user-call.md; SKILL.md beside this script says how to run it.

    user-call.py add < call.json [--store D]              write (validates, stamps)
    user-call.py close <id> <answer> [note] [--store D]   mark it decided
    user-call.py answers <id> [--store D]                 what the owner answered, and notes on the call
    user-call.py list [session] [--store D]               open user calls, newest first
    user-call.py held [--store D]                         open documentation calls on docs-held branches, by branch
    user-call.py edits --old A --new B                    a documentation call's edits, from two copies
    user-call.py edits --base REF FILE                    the same, from FILE against its text at REF
                                                          (of a list, FILE.json: one edit per entry whose
                                                          text or note changed)
    user-call.py link <id> [--store D] [--at REPO@REF]    the address of the call's page, where it is answered
    user-call.py patch <id> [--store D]                   the latest answer's recorded patch, for git apply
    user-call.py review DRAFT FILE --spans [OUT]          the call's edits as line ranges of FILE, E1, E2, ..., the
                                                          block for the critic's prompt (to OUT, or printed)
    user-call.py review DRAFT FILE [REPORT]               a peeves-critic run on FILE, added to a documentation
                                                          call's draft; REPORT is the critic's text (default stdin)
    user-call.py review DRAFT --answers [RUN.]cN T[,T]    change N after the latest changed run (or RUN) answers
                                                          those trips of that run
    user-call.py review DRAFT --kept [RUN.]N WHY          trip N of the latest run (or of RUN) set aside, and why
    user-call.py review DRAFT --note TEXT                 one line on the latest run: what the session did about it

A documentation call's `review` is the peeves critic's runs on its document, in
order; the contract's Review section states what a run and a trip hold. `review`
refreshes the draft's edits from FILE against its `base` (or --base REF), parses
the report, keeps the document's text in the draft, and on the next run works
out the changes from it and marks the trips inside an edit still unanswered as
changed. `add` refuses a call whose edits
the critic's last run did not read, or with a trip left unanswered, maps each
run's spans onto the call's edits, and drops the kept texts.

A documentation call may edit entries of a list instead of a document: its
file names lists/<name>.json, with #<id> for one entry, and each edit names its
entry in `item`, with `from` and `to` the entry's {text, note} before and after.
`add` reads the list at the call's base (else its file's ref) in a checkout of
its repo in or beside the project root, and refuses an edit whose entry is not
there as `from` reads. `review` on a list call gives the critic the call's
entries as text, the term in bold then the note, and each edit's span is its
entry by id ({item, edit}) rather than a line range.

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

# A peeves-critic run's verdict, and how the session answered each trip in it.
VERDICTS = {"pass", "fail", "unknown"}
TRIP_ANSWERS = {"changed", "kept"}
PEEVE = r"P\d{2,3}"
# A trip's edit tag: E2 for the second span the critic was given, E- (or
# `outside`) for a trip outside every edit.
EDIT_TAG = r"\**(?:E(\d{1,2})|E\s?[-\u2013\u2014]|E0|outside)\**"


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
        listed = is_list(c)
        if not re.fullmatch(r"[^/\s]+/[^@:\s]+(@[^:\s]+)?:\S+", str(c.get("file") or "")):
            errs.append("file must read owner/repo[@ref]:path")
        elif not listed and not re.search(r"\.(md|csv)$", c["file"], re.I):
            errs.append("a documentation call edits a markdown or CSV file, or entries of a list (lists/x.json); "
                        "prose inside code is reviewed on its PR")
        if "base" in c and not re.fullmatch(r"[^\s:@]+", str(c.get("base") or "")):
            errs.append("base is the ref the edits were made against, such as main")
        edits = c.get("edits") or []
        if listed:
            errs += entry_errors(c)
            edits = []
        if c.get("new") is not None and c.get("new") is not True:
            errs.append("new is true or absent")
        if c.get("new"):
            if edits:
                errs.append("a new document carries no edits: the page shows it whole")
        elif not listed and not 1 <= len(edits) <= 40:
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
        if "review" in c:
            errs += review_errors(c["review"])
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
    if "review" in c and c.get("kind") != "documentation":
        errs.append("review is the peeves critic's runs on a documentation call's document")
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


# A list call's file: a lists/ JSON file, with #<id> when it edits one entry.
LIST_FILE = r"[^/\s]+/[^@:\s]+(@[^:\s]+)?:(\S+/)?lists/[^/\s#]+\.json(#[^\s#]+)?"
ENTRY_FIELDS = {"text", "note"}


def is_list(c):
    return bool(re.fullmatch(LIST_FILE, str(c.get("file") or "")))


def list_target(c):
    """(repo, ref, path, item) of a list call's file; item is None without #<id>."""
    spec, frag = (str(c.get("file") or "").split("#", 1) + [None])[:2]
    head, path = spec.split(":", 1)
    repo, ref = (head.split("@", 1) + [None])[:2]
    return repo, ref or "main", path, frag


def entry_errors(c):
    """A list call's edits: each names its entry and gives the entry's text and
    note before and after, one edit per entry."""
    errs, edits, one = [], c.get("edits") or [], list_target(c)[3]
    if c.get("new"):
        errs.append("a list call edits entries the list holds; a new entry needs no call")
    if not 1 <= len(edits) <= 40:
        errs.append("edits is 1 to 40 entries")
    if one and len(edits) > 1:
        errs.append(f"file names the one entry {one}: a call on several entries names the list alone")
    seen = set()
    for i, e in enumerate(edits):
        if not isinstance(e, dict):
            errs.append(f"edits[{i}] is an object")
            continue
        item = e.get("item") or one
        if not isinstance(item, str) or not item.strip():
            errs.append(f"edits[{i}] names its entry's id in item")
        elif one and item != one:
            errs.append(f"edits[{i}].item is {item!r}, but file names entry {one}")
        elif item in seen:
            errs.append(f"edits[{i}]: entry {item} has an edit already; one edit per entry")
        seen.add(item)
        sides = [e.get("from"), e.get("to")]
        if not all(isinstance(x, dict) and set(x) <= ENTRY_FIELDS and isinstance(x.get("text"), str) and x["text"].strip()
                   and isinstance(x.get("note", ""), str) for x in sides):
            errs.append(f"edits[{i}].from and .to are the entry before and after, each {{text, note?}}")
        elif sides[0] == sides[1]:
            errs.append(f"edits[{i}] changes nothing")
        elif len(str(e.get("why") or "")) > 100:
            errs.append(f"edits[{i}].why is one clause, 100 characters at most")
        elif bool(str(e.get("background") or "").strip()) != bool(str(e.get("proposal") or "").strip()):
            errs.append(f"edits[{i}] gives a background and a proposal together, or neither")
        elif any(len(str(e.get(k) or "")) > 160 for k in ("background", "proposal")):
            errs.append(f"edits[{i}].background and .proposal are 160 characters at most")
        else:
            errs += notes(e.get("notes"), f"edits[{i}]")
    return errs


def checkout_of(repo):
    """A checkout of owner/repo in or beside the project root, found by its
    origin's address, or None."""
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    cands = [root]
    for base in (root, os.path.dirname(root)):
        try:
            cands += [os.path.join(base, d) for d in sorted(os.listdir(base))]
        except OSError:
            pass
    for d in cands:
        r = git(d, "remote", "get-url", "origin", check=False) if os.path.isdir(d) else None
        url = r.stdout.decode().strip() if r is not None and r.returncode == 0 else ""
        if re.search(r"[/:]" + re.escape(repo) + r"(\.git)?/?$", url):
            return d
    return None


def list_at(repo, ref, path):
    """The list's items at ref, as {id: item}, read from a checkout of repo
    (origin's ref first); or an error string."""
    d = checkout_of(repo)
    if not d:
        return f"no checkout of {repo} in or beside the project root to read {path} in"
    for r in (f"origin/{ref}", ref):
        shown = git(d, "show", f"{r}:{path}", check=False)
        if shown.returncode == 0:
            try:
                doc = json.loads(shown.stdout.decode("utf-8"))
            except ValueError:
                return f"{path} at {ref} is not JSON"
            items = doc.get("items") if isinstance(doc, dict) else None
            if not isinstance(items, list):
                return f"{path} at {ref} is not a list: it has no items"
            return {it["id"]: it for it in items if isinstance(it, dict) and isinstance(it.get("id"), str)}
    return f"{repo} has no {path} at {ref}"


def entry_base_errors(c, items):
    """Each edit's entry, as the list holds it at the call's base: there, and
    reading as the edit's `from`."""
    errs, one = [], list_target(c)[3]
    for i, e in enumerate(c.get("edits") or []):
        item, frm = e.get("item") or one, e.get("from") or {}
        it = items.get(item)
        if it is None:
            errs.append(f"edits[{i}]: the list holds no entry {item}")
        elif any((it.get(k) or "") != (frm.get(k) or "") for k in ENTRY_FIELDS):
            errs.append(f"edits[{i}].from is not entry {item} as the list holds it")
    return errs


def list_edits(old, new):
    """A list call's edits from two copies of a list: one per entry both hold
    whose text or note differs. Entries added or removed are not edits."""
    items = lambda t: [x for x in (json.loads(t).get("items") or []) if isinstance(x, dict) and x.get("id")]
    was = {x["id"]: x for x in items(old)}
    side = lambda x: {k: x[k] for k in ("text", "note") if x.get(k)}
    return [{"item": x["id"], "from": side(was[x["id"]]), "to": side(x)}
            for x in items(new) if x["id"] in was and side(was[x["id"]]) != side(x)]


ENTRY_RULE = "\n\n* * *\n\n"


def entry_text(item, f, show_id=False):
    """An entry read as text, as kits/call-answer.js reads it: its term,
    `**<text>**`, the id after it as code where the list's header says show_id,
    then its note."""
    f = f if isinstance(f, dict) else {}
    return (f"**{f.get('text') or ''}**" + (f" · `{item}`" if show_id else "")
            + (f"\n\n{f['note']}" if f.get("note") else ""))


def entry_ids(c):
    one = list_target(c)[3] if is_list(c) else None
    return [e.get("item") or one for e in c.get("edits") or [] if isinstance(e, dict)]


def list_reading(json_text, ids):
    """The entries `ids` names, read as one document in that order; and which
    of them the list holds."""
    doc = json.loads(json_text)
    items = {x["id"]: x for x in (doc.get("items") or []) if isinstance(x, dict) and x.get("id")}
    show = doc.get("show_id") is True
    return ENTRY_RULE.join(entry_text(i, items[i], show) for i in ids if i in items), [i in items for i in ids]


def list_spans_text(path, ids, reading):
    """The block for the critic's prompt on a list call: each edit's span is
    its entry, by id, and the entries follow as the critic is to read them."""
    out = [f"The edits to {path}, one entry each, by id:"]
    out += [f"E{k}  entry {i}" for k, i in enumerate(ids, 1)]
    out += ["", "The entries, each its term in bold and then its note:", "", reading, ""]
    out.append('Tag each trip with its edit, as P<id> · E<n> · <where> · "<quote>" · <clause>, and a trip '
               "outside every edit with E-. Quote the words exactly as the entry has them. End with "
               "`Verdict: PASS` when no trip falls inside an edit, and `Verdict: FAIL` otherwise.")
    return "\n".join(out)


def refresh_entries(draft, found):
    """refresh_edits for a list call: what the session wrote on an edit is
    carried by the entry it names."""
    one = list_target(draft)[3]
    by_item = {e["item"]: e for e in found}
    dropped = []
    for k, e in enumerate(draft.get("edits") or [], 1):
        hit, carry = by_item.get(e.get("item") or one), {x: e[x] for x in CARRY if x in e}
        if hit is not None:
            hit.update(carry)
        elif carry:
            dropped.append(k)
    draft["edits"] = found
    return dropped


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


def flat(s):
    return " ".join(str(s or "").split())


def review_errors(r):
    """A documentation call's review: the peeves critic's runs, each checked
    against the report it was parsed from."""
    if not isinstance(r, dict) or not isinstance(r.get("runs"), list) or not 1 <= len(r["runs"]) <= 30:
        return ["review is {runs: [...]}, 1 to 30 critic runs in order"]
    errs, runs = [], r["runs"]
    for i, run in enumerate(runs):
        at = f"review.runs[{i}]"
        if not isinstance(run, dict):
            errs.append(f"{at} is a run"); continue
        v, report, trips = run.get("verdict"), run.get("report"), run.get("trips") or []
        if v not in VERDICTS:
            errs.append(f"{at}.verdict is one of {sorted(VERDICTS)}")
        if not isinstance(report, str) or not report.strip() or len(report) > 20000:
            errs.append(f"{at}.report is the critic's text as it came back, 20000 characters at most"); continue
        if not isinstance(trips, list):
            errs.append(f"{at}.trips is a list"); trips = []
        spans = run.get("edits")
        if spans is not None and (not isinstance(spans, list) or len(spans) > 40 or not all(
                isinstance(s, dict) and (isinstance(s.get("item"), str) and s["item"] if "item" in s else
                isinstance(s.get("lines"), list) and len(s["lines"]) == 2
                and all(isinstance(x, int) and x > 0 for x in s["lines"]) and s["lines"][0] <= s["lines"][1])
                and (s.get("edit") is None or isinstance(s["edit"], int) and s["edit"] > 0) for s in spans)):
            errs.append(f"{at}.edits are up to 40 spans the critic was given, each {{lines: [first, last], edit}}, "
                        "or for a list {item, edit}")
            spans = None
        inside = [t for t in trips if not (isinstance(t, dict) and t.get("edit") == 0)]
        if (v == "fail") != bool(inside) or (v == "unknown" and trips):
            errs.append(f"{at}: a failed run has a trip inside an edit, a passed one none, and an unknown one no trips")
        changes = run.get("changes") or []
        if not isinstance(changes, list) or len(changes) > 40 or not all(
                isinstance(x, dict) and isinstance(x.get("from"), str) and isinstance(x.get("to"), str)
                and x["from"] != x["to"] for x in changes):
            errs.append(f"{at}.changes are up to 40 {{from, to}} pairs, each a change")
            changes = []
        reflow = run.get("reflow", 0)
        if not isinstance(reflow, int) or reflow < 0:
            errs.append(f"{at}.reflow is a count of blocks rewrapped")
            reflow = 0
        if (changes or reflow) and i == len(runs) - 1:
            errs.append(f"{at} has changes after it: run the critic again on the text as filed")
        if len(str(run.get("note") or "")) > 200:
            errs.append(f"{at}.note is one line, 200 characters at most")
        answered = set()
        for k, x in enumerate(changes):
            a = x.get("answers")
            if a is None:
                continue
            if not isinstance(a, list) or not a or not all(isinstance(n, int) and 1 <= n <= len(trips) for n in a):
                errs.append(f"{at}.changes[{k}].answers are trip numbers of run {i + 1}, 1 to {len(trips)}")
                continue
            answered.update(a)
        for j, t in enumerate(trips):
            tat = f"{at}.trips[{j}]"
            if not isinstance(t, dict) or not re.fullmatch(PEEVE, str(t.get("peeve") or "")):
                errs.append(f"{tat} names its peeve, as P05"); continue
            if t["peeve"] not in report:
                errs.append(f"{tat}: {t['peeve']} is not in the run's report")
            if t.get("quote") and flat(t["quote"]) not in flat(report):
                errs.append(f"{tat}: its quote is not in the run's report")
            if any(len(str(t.get(k) or "")) > n for k, n in (("where", 300), ("quote", 1000), ("clause", 600))):
                errs.append(f"{tat}: where, quote and clause are 300, 1000 and 600 characters at most")
            e = t.get("edit")
            if e is not None:
                if not isinstance(e, int) or isinstance(e, bool) or e < 0 or (spans is not None and e > len(spans)):
                    errs.append(f"{tat}.edit is the span it was tagged with, 1 to {len(spans) if spans else 40}, or 0 for E-")
                elif not (spans and e and spans[e - 1].get("item") and f"`{spans[e - 1]['item']}`" in report) and not (
                        e == 0 and t.get("where") and f"`{t['where']}`" in report) and not (
                        re.match(r"lines?\s+\d+", str(t.get("where") or "")) and flat(t["where"]) in flat(report)) and not re.search(
                        rf"\bE{e}\b" if e else r"\bE\s?[-–—]|\bE0\b|\boutside\b", report, re.I):
                    errs.append(f"{tat}: its tag {f'E{e}' if e else 'E-'} is not in the run's report")
            if "misquoted" in t and not isinstance(t["misquoted"], bool):
                errs.append(f"{tat}.misquoted is true or false")
            a = t.get("answer")
            if a is None and e == 0:
                pass
            elif a not in TRIP_ANSWERS:
                errs.append(f"{tat} ({t['peeve']}) has no answer: changed, or kept with why "
                            f"(user-call.py review DRAFT --kept {i + 1}.{j + 1} WHY)")
            elif a == "kept" and not 0 < len(str(t.get("why") or "").strip()) <= 200:
                errs.append(f"{tat} is kept, so it says why in one line, 200 characters at most")
            elif a == "changed" and not (changes or reflow):
                errs.append(f"{tat} is answered changed, but nothing changed after run {i + 1}")
            if j + 1 in answered and a != "changed":
                errs.append(f"{tat} is answered by a change, so its answer is changed")
        if not isinstance(run.get("clear", []), list) or not all(re.fullmatch(PEEVE, str(x)) for x in run.get("clear") or []):
            errs.append(f"{at}.clear is a list of peeve ids")
        cands = run.get("candidates") or []
        if not isinstance(cands, list) or len(cands) > 10 or not all(isinstance(x, str) and 0 < len(x) <= 800 for x in cands):
            errs.append(f"{at}.candidates are up to 10 proposals, 800 characters each")
        pre = run.get("preexisting") or []
        if not isinstance(pre, list) or not all(isinstance(x, dict) and re.fullmatch(PEEVE, str(x.get("peeve") or "")) for x in pre):
            errs.append(f"{at}.preexisting are {{peeve, text}}, trips the critic found in text the edits leave alone")
        if run.get("text") is not None and not isinstance(run["text"], str):
            errs.append(f"{at}.text is the document as the critic read it")
    return errs


# A section of a critic's report: its heading on a line of its own, bold or a
# Markdown heading or followed by a colon, with whatever follows on that line.
SECTION = re.compile(r"^\s*(?:#{1,6}\s*)?(\*\*|__)?\s*(Trips|Clear|Candidates|Pre-?existing)\b\s*(:)?\s*(\*\*|__)?\s*:?\s*(.*)$", re.I)
BULLET = re.compile(r"^\s*(?:[-*+•]|\d+[.)])\s+")
VERDICT_LINE = re.compile(r"^\s*\**\s*VERDICT\s*\**\s*:\s*\**\s*(PASS|FAIL)\b", re.I)


def sections(text):
    """{name: [lines]} for each section the report heads, and the stated verdict."""
    out, cur, stated = {}, None, None
    for line in text.splitlines():
        # A session's detail caption, which a headless run appends after its
        # last section: a stamp in code, after a linked ⌂ in code on
        # 2026-11-20 and 2026-11-21, then the record's mark.
        if re.match(r"^\s*(?:\[`[^`]*`\]\([^)\s]*\))?`[^`]+`\s*💬", line):
            continue
        m = SECTION.match(line)
        # "Trips, most costly first:" copies the critic's definition, which
        # heads that section the same way.
        if m and (m.group(1) or m.group(3) or line.lstrip().startswith("#") or not m.group(5)
                  or m.group(5).startswith(("(", ","))):
            cur = m.group(2).lower().replace("-", "")
            out.setdefault(cur, [])
            rest = m.group(5).strip()
            if rest and not rest.startswith(("(", ",")):
                out[cur].append(rest)
            continue
        v = VERDICT_LINE.match(line)
        if v:
            stated, cur = v.group(1).lower(), None
            continue
        if cur:
            out[cur].append(line)
    return out, stated


def first_paragraph(lines):
    out = []
    for line in lines:
        if line.strip():
            out.append(line)
        elif out:
            break
    return out


def ids(text):
    return list(dict.fromkeys(re.findall(r"\b" + PEEVE + r"\b", text)))


def trip_of(line):
    """`P<id> · E<n> · <where> · "<quote>" · <one clause>`, the critic's own
    form, or the same without the edit tag; None for any other line."""
    s = BULLET.sub("", line, count=1).strip()
    m = re.match(r"\**(" + PEEVE + r")\**\s*·\s*(.*)$", s)
    if not m:
        return None
    parts = [p.strip() for p in uncoded_split(m.group(2), " · ")]
    tag = re.fullmatch(EDIT_TAG, parts[0], re.I) if parts else None
    if tag:
        parts = parts[1:]
    where = parts[0] if parts else ""
    rest = parts[1:]
    q = next((k for k, p in enumerate(rest) if p[:1] in "\"“'‘"), None)
    quote, clause = "", " · ".join(rest)
    if q is not None:
        quote = rest[q]
        # The clause run on after the quote with no separator, as in
        # `"words." This sentence ...`: the quote ends at the first closing
        # quote that a new sentence follows.
        if quote[-1:] not in "\"”'’":
            end = re.search(r'["”](?=[.;:,]?\s+["“A-Z])', uncoded(quote[1:]))
            if end:
                rest = rest[:q] + [quote[:end.end() + 1], quote[end.end() + 1:].lstrip(".;:, ")] + rest[q + 1:]
                quote = rest[q]
        if len(quote) > 1 and quote[0] in "\"“" and quote[-1] in "\"”" and not re.search(r'["“”]', uncoded(quote[1:-1])):
            quote = quote[1:-1]
        clause = " · ".join(rest[q + 1:])
        where = " · ".join([where, *rest[:q]])
    out = {"peeve": m.group(1)}
    if tag:
        out["edit"] = int(tag.group(1)) if tag.group(1) else 0
    out.update(where=where, quote=quote, clause=clause)
    return out


def uncoded(s):
    """s with its code spans blanked, so a mark inside one is not read."""
    return re.sub(r"`[^`]*`", lambda m: " " * len(m.group(0)), s)


def uncoded_split(s, sep):
    """s split on sep where sep is outside a code span: a trip quoting the trip
    format keeps its ` · ` inside backticks."""
    out, at, bare = [], 0, uncoded(s)
    for m in re.finditer(re.escape(sep), bare):
        out.append(s[at:m.start()]); at = m.end()
    return out + [s[at:]]


def items(lines):
    """A section's bulleted items, each with its continuation lines; prose with
    no bullets is one item. A section that says only None has none."""
    out = []
    for line in lines:
        if not line.strip():
            continue
        if BULLET.match(line) or not out:
            out.append(BULLET.sub("", line, count=1).strip())
        else:
            out[-1] += " " + line.strip()
    return [x for x in out if not re.fullmatch(r"none\b.*", x, re.I)]


def parse_report(text):
    """One critic run from its report: the verdict, trips, clear ids, candidates
    and trips outside the edit. A run fails on a trip inside an edit, or on one
    with no tag; trips tagged E- alone pass it. A report in neither of the
    critic's forms is kept whole with the verdict unknown."""
    text = str(text or "").replace("\r\n", "\n").strip()
    secs, stated = sections(text)
    run = {"verdict": "unknown", "trips": [], "clear": [], "candidates": [], "preexisting": [], "report": text}
    if "trips" not in secs:
        # Trip lines in the critic's own form, with no Trips heading over
        # them (a report on several files, headed by file), are its trips.
        loose = [x for x in text.split("\n") if trip_of(x)]
        if loose:
            secs = {**secs, "trips": loose}
    if "trips" not in secs:
        # A stated PASS from a report that names no peeve anywhere has no
        # trips to list, so it passes; any other report without the section
        # has no verdict to read.
        if stated == "pass" and not re.search(r"\b" + PEEVE + r"\b", text):
            run["verdict"] = "pass"
        return run
    trips, prose, entry = [], [], None
    for line in secs["trips"]:
        t = trip_of(line) if line.strip() else None
        if t:
            trips.append(t)
            continue
        # A list's form: an entry's id in code on a bullet of its own, and
        # under it a bullet per peeve, `P05: "<quote>". <clause>`, the entry
        # standing for the edit tag (add_run maps it to its span).
        head = ENTRY_HEAD.match(line)
        if head:
            entry = head.group(1)
            continue
        t = entry_trip(line, entry) if entry else None
        if t:
            trips.append(t)
        elif line.strip():
            prose.append(line)
    said_none = any(re.match(r"\s*\**none\b", x, re.I) for x in prose)
    if any(t.get("edit") != 0 for t in trips):
        run["verdict"] = "fail"
    elif trips:
        run["verdict"] = "pass"
    elif said_none or not ids(" ".join(prose)):
        # Trips the critic wrote in some other shape read as no trips here, so
        # a section naming peeves without saying None is not taken as a pass.
        run["verdict"] = "unknown" if stated == "fail" else "pass"
    run["trips"] = trips
    run["clear"] = ids(" ".join(first_paragraph(secs.get("clear", []))))
    run["candidates"] = items(secs.get("candidates", []))[:10]
    for x in items(secs.get("preexisting", [])):
        found = ids(x)
        if found:
            run["preexisting"].append({"peeve": found[0], "text": re.sub(r"^\**(" + PEEVE + r")(/" + PEEVE + r")*\**\s*[·:]?\s*", "", x)})
    if stated and stated != run["verdict"] and run["verdict"] != "unknown":
        run["stated"] = stated
    return run


ENTRY_HEAD = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+`([^`\s]+)`")
ENTRY_TRIP = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+\**(" + PEEVE + r")\**(?:\s*\([^)]*\))?\s*:\s*(.*)$")


def entry_trip(line, entry):
    """A trip in a list's form, on the entry `entry`, or None."""
    m = ENTRY_TRIP.match(line)
    if not m:
        return None
    rest, quote = m.group(2).strip(), ""
    q = re.match(r'^["“](.+?)["”](?=[.;:,]?(?:\s|$))[.;:,]?\s*(.*)$', rest)
    if q:
        quote, rest = q.group(1), q.group(2)
    return {"peeve": m.group(1), "item": entry, "where": entry, "quote": quote, "clause": rest}


LISTY = re.compile(r"^\s*(?:[-*+]|\d+[.)]|\|)\s")


def run_diff(old, new):
    """What changed between two drafts: ({from, to} pairs, blocks rewrapped).
    The pairs are the blocks one has and the other does not, paired in order
    where their counts match and joined into one pair where they do not; a
    list or a table is cut to the lines that differ, so one changed bullet is
    not its whole list. A block whose words are the same and only its line
    breaks or spacing moved is a reflow, counted apart and never a change."""
    a, b = blocks(old), blocks(new)
    left = {}
    for x in b:
        left[x] = left.get(x, 0) + 1
    gone = []
    for x in a:
        if left.get(x):
            left[x] -= 1
        else:
            gone.append(x)
    left = {}
    for x in a:
        left[x] = left.get(x, 0) + 1
    came = []
    for x in b:
        if left.get(x):
            left[x] -= 1
        else:
            came.append(x)
    reflow, words = 0, {}
    for k, x in enumerate(came):
        words.setdefault(flat(x), []).append(k)
    kept, used = [], set()
    for x in gone:
        if words.get(flat(x)):
            used.add(words[flat(x)].pop(0)); reflow += 1
        else:
            kept.append(x)
    gone, came = kept, [x for k, x in enumerate(came) if k not in used]
    if not gone and not came:
        return [], reflow
    pairs = list(zip(gone, came)) if len(gone) == len(came) else [("\n\n".join(gone), "\n\n".join(came))]
    out = []
    for f, t in pairs:
        fl, tl = f.split("\n"), t.split("\n")
        if all(LISTY.match(x) for x in fl + tl if x.strip()):
            while fl and tl and fl[0] == tl[0]:
                fl, tl = fl[1:], tl[1:]
            while fl and tl and fl[-1] == tl[-1]:
                fl, tl = fl[:-1], tl[:-1]
        f, t = "\n".join(fl).strip("\n"), "\n".join(tl).strip("\n")
        if f == t:
            continue
        if flat(f) == flat(t):
            reflow += 1
            continue
        out.append({"from": f, "to": t})
    return out, reflow


def run_changes(old, new):
    """The changes between two drafts, reflow left out (run_diff)."""
    return run_diff(old, new)[0]


# ── A quote held to the text, and an edit's place in it ──────────────────

def norm_q(s):
    """Text as a quote is compared with it: curly quotes straightened, a link
    reduced to its words, code ticks, bold and brackets dropped, and every run
    of whitespace one space."""
    s = str(s or "").translate(str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"'}))
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = s.replace("`", "").replace("**", "").replace("[", "").replace("]", "")
    return " ".join(s.split())


def quote_parts(q):
    """The quoted strings in a quote, as in `"a" (row) against "b"`, or the
    quote whole when it is not made of quoted strings."""
    qq = str(q or "").replace("“", '"').replace("”", '"')
    bare = uncoded(qq)
    parts = [qq[m.start(1):m.end(1)] for m in re.finditer(r'"([^"]+)"', bare)]
    return parts if parts and qq.strip().startswith('"') else [str(q or "")]


def quote_re(s):
    """A pattern for one quoted string: an ellipsis is a gap (a whole paragraph
    quoted by its ends spans one), ` / ` a line break, and a link's elided
    target `(…)` nothing."""
    s = norm_q(re.sub(r"\(…\)", "", s))
    frags = [f.strip(" :;,") for f in re.split(r"…|\.\.\.", s)]
    frags = [f for f in frags if f]
    if not frags:
        return None
    return r".{0,2000}?".join(r"\s?/?\s?".join(re.escape(b) for b in f.split(" / ")) for f in frags)


def quote_in(q, text):
    """Whether every quoted string of q is in text; True for no quote."""
    t = norm_q(text)
    pats = [quote_re(p) for p in quote_parts(q)] if str(q or "").strip() else []
    return all(re.search(p, t) for p in pats if p)


FENCE = re.compile(r"---[ \t]*\r?")
FRONT_KEY = re.compile(r"[A-Za-z0-9_.-]+:")


def front_end(lines):
    """The index of the line closing a text's leading frontmatter, or 0 for
    none: a first line `---`, a `key:` line under it and a closing `---`, as
    lib/kits/md-doc.js reads it, so a document opening with a rule has none."""
    if len(lines) > 2 and FENCE.fullmatch(lines[0]) and FRONT_KEY.match(lines[1]):
        return next((n for n in range(2, len(lines)) if FENCE.fullmatch(lines[n])), 0)
    return 0


def line_blocks(lines):
    """A text's blocks as [first, last] line indexes: its runs of non-blank
    lines, except that in leading frontmatter each fence and each top-level
    property is a block, and the line after the closing fence starts one, so
    one changed field is one block and the title under it is another.
    lib/kits/md-diff.js's blocks() splits the same way."""
    out, start, close = [], None, front_end(lines)
    for n, line in enumerate(lines):
        cut = close and n <= close + 1 and (n in (close, close + 1) or FRONT_KEY.match(line))
        if not line.strip():
            if start is not None:
                out.append([start, n - 1]); start = None
        elif start is None:
            start = n
        elif cut:
            out.append([start, n - 1]); start = n
    if start is not None:
        out.append([start, len(lines) - 1])
    return out


def doc_blocks(text):
    """The text's blocks (line_blocks), each (text, first line, last line)."""
    lines = text.split("\n")
    return [("\n".join(lines[a:z + 1]), a + 1, z + 1) for a, z in line_blocks(lines)]


def front_lines(text):
    """How many lines a text's leading frontmatter takes, fences included; 0 for none."""
    close = front_end(text.split("\n"))
    return close + 1 if close else 0


def pieces(frag, db):
    """An edit's side as the blocks of the text it is in: the run of `db`
    (doc_blocks) it is, joined as edits() joins them, or else its blocks()."""
    frag = str(frag or "")
    for s in range(len(db)):
        at, k = 0, s
        while k < len(db):
            sep = "" if k == s else "\n" if db[k][1] == db[k - 1][2] + 1 else "\n\n"
            if not frag.startswith(sep + db[k][0], at):
                break
            at, k = at + len(sep) + len(db[k][0]), k + 1
            if at == len(frag):
                return [b for b, _, _ in db[s:k]]
    return blocks(frag)


def context(fb, tb):
    """How many blocks an edit's from and to share at the start and the end:
    the context an insertion or a removal anchors on."""
    lead = 0
    while lead < min(len(fb), len(tb)) and fb[lead] == tb[lead]:
        lead += 1
    tail = 0
    while tail < min(len(fb), len(tb)) - lead and fb[-1 - tail] == tb[-1 - tail]:
        tail += 1
    return lead, tail


def run_of(seq, sub):
    """Where the blocks `sub` first sit in `seq`, in a row, or None."""
    n = len(sub)
    return next((s for s in range(len(seq) - n + 1) if n and seq[s:s + n] == sub), None)


def edit_span(e, dblocks, base_blocks=None):
    """Where an edit's new text sits: [first, last] lines of the blocks it adds
    or rewrites, the context it anchors on left out, and a rewrite cut to the
    lines that differ, so one changed bullet is not its whole list; for a
    removal, the block beside the gap. None when its text is not in the
    document. Both blocks lists are doc_blocks(), the base's when given."""
    fb, tb = pieces(e.get("from"), base_blocks or dblocks), pieces(e.get("to"), dblocks)
    lead, tail = context(fb, tb)
    s = run_of([b for b, _, _ in dblocks], tb)
    if s is None:
        return None
    body = dblocks[s + lead:s + len(tb) - tail]
    if not body:
        body = dblocks[s:s + len(tb)]
        return [body[0][1], body[-1][2]]
    first, last = body[0][1], body[-1][2]
    old_lines = "\n".join(fb[lead:len(fb) - tail]).split("\n")
    new_lines = "\n".join(b for b, _, _ in body).split("\n")
    if lead == tail == 0 and len(fb) == len(tb) == 1 and old_lines != new_lines:
        a = 0
        while a < min(len(old_lines), len(new_lines)) - 1 and old_lines[a] == new_lines[a]:
            a += 1
        z = 0  # at least one new line stays, so an inserted table row or bullet is its own span
        while z < min(len(old_lines) - a, len(new_lines) - 1 - a) and old_lines[-1 - z] == new_lines[-1 - z]:
            z += 1
        first, last = first + a, max(first + a, last - z)
    return [first, last]


def base_range(e, base_blocks, dblocks):
    """The base's blocks an edit replaces, [first, end) by index, the context
    left out; empty, as [p, p], for an insertion at p. None when absent. Both
    blocks lists are doc_blocks(), the base's and the document's."""
    fb, tb = pieces(e.get("from"), base_blocks), pieces(e.get("to"), dblocks)
    lead, tail = context(fb, tb)
    s = run_of([b for b, _, _ in base_blocks], fb)
    return None if s is None else [s + lead, s + len(fb) - tail]


def meets(a, b):
    """Whether two base ranges touch the same text: they overlap, or one is an
    insertion point inside or at the edge of the other."""
    if a[0] == a[1] or b[0] == b[1]:
        return b[0] <= a[0] <= b[1] if a[0] == a[1] else a[0] <= b[0] <= a[1]
    return a[0] < b[1] and b[0] < a[1]


def spans_of(c, text, base=None):
    """The call's edits as spans of text, in order: {lines, from} each, and the
    base blocks each replaces when the base is given; None for an edit whose
    text is not there. A new document is one span, whole."""
    db = doc_blocks(text)
    if c.get("new"):
        return [{"lines": [db[0][1], db[-1][2]], "from": ""}] if db else []
    bb = doc_blocks(base) if base is not None else None
    out = []
    for e in c.get("edits") or []:
        s = edit_span(e, db, bb)
        span = {"lines": s, "from": str(e.get("from") or "")} if s else None
        if span and bb is not None:
            r = base_range(e, bb, db)
            if r is not None:
                span["base"] = r
        out.append(span)
    return out


def spans_text(path, spans):
    """The block a session pastes into the critic's prompt: the spans, then
    apart from them, how to tag a trip with one (a critic read the line right
    under the last span as that edit's text)."""
    out = [f"The edits to {path}, as lines of the file as you read it:"]
    for k, s in enumerate(spans, 1):
        if s:
            a, b = s["lines"]
            out.append(f"E{k}  {'line ' + str(a) if a == b else f'lines {a}-{b}'}")
    out.append("")
    out.append('Tag each trip with its edit, as P<id> · E<n> · <where> · "<quote>" · <clause>, and a trip '
               "outside every edit with E-. Quote the words exactly as the file has them. End with "
               "`Verdict: PASS` when no trip falls inside an edit, and `Verdict: FAIL` otherwise.")
    return "\n".join(out)


def where_quote(q, dblocks):
    """The first block holding the quote's first string, as (first, last) lines."""
    parts = quote_parts(q) if str(q or "").strip() else []
    p = quote_re(parts[0]) if parts else None
    if not p:
        return None
    for b, a, z in dblocks:
        if re.search(p, norm_q(b)):
            return (a, z)
    return None


def tag_warnings(run, n, text):
    """Trips whose quote sits in another span than the one they were tagged with."""
    spans, db, out = run.get("edits") or [], doc_blocks(text), []
    if not spans:
        return out
    for j, t in enumerate(run.get("trips") or []):
        e = t.get("edit")
        at = where_quote(t.get("quote"), db) if e is not None and not t.get("misquoted") else None
        if not at:
            continue
        hit = [k for k, s in enumerate(spans, 1) if s and s["lines"][0] <= at[1] and at[0] <= s["lines"][1]]
        if hit and e not in hit or not hit and e:
            tag = f"E{e}" if e else "E-"
            out.append(f"{n}.{j + 1} is tagged {tag}, but its quote is at line {at[0]}, "
                       + (f"in E{hit[0]}" if hit else "outside every edit"))
    return out


PROSE_NOT = re.compile(r"^\s*(?:#|\||[-*+] |\d+[.)] |>|<|```|~~~)|^ {4}")


def wrap_warnings(c, text, spans):
    """A changed paragraph wrapped unlike the rest of the document, and an edit
    that only rewraps: settled before the critic's first run, since a rewrap
    after it is reflow and makes a whole paragraph read as changed.
    Frontmatter is no paragraph: its fields are left out."""
    db, fenced, inside = doc_blocks(text), False, set()
    prose, front = [], front_lines(text)
    for b, a, z in db:
        if a <= front:
            continue
        lines = b.split("\n")
        starts = fenced
        for line in lines:
            if re.match(r"\s*(```|~~~)", line):
                fenced = not fenced
        if starts or fenced or any(re.match(r"\s*(```|~~~)", x) for x in lines) or PROSE_NOT.match(b):
            continue
        prose.append((lines, a, z))
    for k, s in enumerate(spans or [], 1):
        if s:
            inside.update((k, n) for n in range(s["lines"][0], s["lines"][1] + 1))
    span_of_line = {n: k for k, n in inside}
    rest = [p for p in prose if p[1] not in span_of_line]
    wrapped = [p for p in rest if len(p[0]) > 1]
    long_one = [p for p in rest if len(p[0]) == 1 and len(p[0][0]) > 100]
    out = []
    for k, e in enumerate(c.get("edits") or [], 1):
        if flat(e.get("from")) == flat(e.get("to")):
            out.append(f"E{k} changes only line breaks or spacing; a rewrap is not an edit")
    # The width the rest wraps at: the 90th percentile of its lines that end
    # a wrap (a paragraph's last line ends short), so one long link line does
    # not set it.
    ends = sorted(len(x) for p in wrapped for x in p[0][:-1])
    width = ends[int(len(ends) * 0.9)] if ends else 0
    style = ("wrapped" if len(wrapped) >= 2 and len(wrapped) > len(long_one)
             else "one line" if len(long_one) >= 2 and len(long_one) > len(wrapped) else None)
    seen = set()
    for lines, a, z in prose:
        k = span_of_line.get(a)
        if not k or k in seen:
            continue
        if style == "wrapped" and any(len(x) > width + 10 for x in lines):
            out.append(f"E{k} has lines longer than the {width} columns the rest of the document wraps at")
            seen.add(k)
        elif style == "one line" and len(lines) > 1:
            out.append(f"E{k} wraps a paragraph the rest of the document keeps on one line")
            seen.add(k)
    if out:
        out.append("settle the wrapping before the critic's first run: a later rewrap is reflow, "
                   "and it makes a whole paragraph read as changed")
    return out


def add_run(draft, doc_text, report_text, when=None, spans=None):
    """The draft with one more critic run: the run before it given the changes
    from its text to this one's, and its unanswered trips inside an edit
    answered changed; this run's trips held to the text it read."""
    review = draft.setdefault("review", {"runs": []})
    runs = review.setdefault("runs", [])
    prev = runs[-1] if runs else None
    if prev is not None and isinstance(prev.get("text"), str):
        changes, reflow = run_diff(prev["text"], doc_text)
        prev["changes"] = changes
        if reflow:
            prev["reflow"] = reflow
        else:
            prev.pop("reflow", None)
        for t in prev.get("trips") or []:
            if (changes or reflow) and t.get("answer") not in TRIP_ANSWERS and t.get("edit") != 0:
                t["answer"] = "changed"
    run = parse_report(report_text)
    if spans is not None:
        run["edits"] = [s if s else {"lines": None, "from": ""} for s in spans]
    # A trip named by its entry takes that entry's span, or E- for an entry
    # outside every edit; with no spans it stays untagged, inside.
    items = [s.get("item") for s in spans or [] if s]
    lined = [s.get("lines") if s else None for s in spans or []]
    for t in run["trips"]:
        item = t.pop("item", None)
        if item is not None and items:
            t["edit"] = items.index(item) + 1 if item in items else 0
        # A trip placed by line rather than tagged takes the span holding
        # that line, or E- for a line outside every span.
        at = re.match(r"lines?\s+(\d+)", str(t.get("where") or ""))
        if "edit" not in t and at and any(lined):
            n = int(at.group(1))
            t["edit"] = next((k for k, ln in enumerate(lined, 1) if ln and ln[0] <= n <= ln[1]), 0)
    if run["trips"] and any(t.get("edit") != 0 for t in run["trips"]):
        run["verdict"] = "fail"
    elif run["trips"] and run["verdict"] == "fail":
        run["verdict"] = "pass"
    mark_misquotes(run, doc_text)
    run["at"] = when or stamp()
    run["text"] = doc_text
    runs.append(run)
    return draft


def mark_misquotes(run, text):
    """Each trip whose quote is not in the text the run read is misquoted."""
    for t in run.get("trips") or []:
        if t.get("quote") and not quote_in(t["quote"], text):
            t["misquoted"] = True
        else:
            t.pop("misquoted", None)


def keep_trip(draft, which, why):
    """Mark a trip set aside: `which` is N for the latest run's trip N, or RUN.N."""
    runs = (draft.get("review") or {}).get("runs") or []
    m = re.fullmatch(r"(?:(\d+)\.)?(\d+)", str(which))
    if not runs or not m:
        raise ValueError("--kept takes N, or RUN.N, a trip of a run the draft holds")
    run = runs[int(m.group(1)) - 1] if m.group(1) else runs[-1]
    trips = run.get("trips") or []
    n = int(m.group(2))
    if not 1 <= n <= len(trips):
        raise ValueError(f"that run has {len(trips)} trips")
    trips[n - 1].update(answer="kept", why=why)
    for ch in run.get("changes") or []:
        if n in (ch.get("answers") or []):
            ch["answers"] = [x for x in ch["answers"] if x != n] or None
            if not ch["answers"]:
                ch.pop("answers")
    return draft


def answer_change(draft, which, trips):
    """Record which trips a change answers: `which` is cN (or N) for change N
    after the latest run that has changes, or RUN.cN; `trips` is 1,3 or 2.1,2.3,
    trips of that same run. Each one it names is answered changed."""
    runs = (draft.get("review") or {}).get("runs") or []
    m = re.fullmatch(r"(?:(\d+)\.)?c?(\d+)", str(which), re.I)
    if not m:
        raise ValueError("--answers takes the change, as c1 or 2.c1, and the trips it answers, as 1,3")
    if m.group(1):
        if not 1 <= int(m.group(1)) <= len(runs):
            raise ValueError(f"the draft holds {len(runs)} runs")
        n = int(m.group(1))
    else:
        n = next((k for k in range(len(runs), 0, -1) if runs[k - 1].get("changes")), 0)
        if not n:
            raise ValueError("no run has changes after it yet: record the next run first")
    run = runs[n - 1]
    changes, ts = run.get("changes") or [], run.get("trips") or []
    k = int(m.group(2))
    if not 1 <= k <= len(changes):
        raise ValueError(f"run {n} has {len(changes)} change{'s' if len(changes) != 1 else ''} after it")
    nums = []
    for x in str(trips).split(","):
        t = re.fullmatch(r"\s*(?:(\d+)\.)?(\d+)\s*", x)
        if not t or (t.group(1) and int(t.group(1)) != n) or not 1 <= int(t.group(2)) <= len(ts):
            raise ValueError(f"the trips are of run {n}, 1 to {len(ts)}: {x.strip()!r} is not one")
        nums.append(int(t.group(2)))
    changes[k - 1]["answers"] = sorted(set(nums))
    for j in nums:
        ts[j - 1]["answer"] = "changed"
        ts[j - 1].pop("why", None)
    return n


def shared(a, b):
    """How much two texts share: the 20-character stretches of a found in b."""
    w, n = min(20, len(a)), 0
    for x in range(0, len(a) - w + 1, 5) if a and b else ():
        n += a[x:x + w] in b
    return n


def follow(runs, k, lines):
    """Where a span of run k's text went: {block index: weight} in the last
    run's text, followed through each text in turn. A block kept stays itself;
    a rewritten or removed one goes to the block that replaced it and to any
    new or rewritten block that shares its words (a sentence moved to another
    paragraph), weighted by how much it shares."""
    db = doc_blocks(runs[k]["text"])
    at = {i: float("inf") for i, (_, a, z) in enumerate(db) if a <= lines[1] and lines[0] <= z}
    prev = [b for b, _, _ in db]
    for r in runs[k + 1:]:
        nb = [b for b, _, _ in doc_blocks(r["text"])]
        ops = difflib.SequenceMatcher(a=prev, b=nb, autojunk=False).get_opcodes()
        fresh = [j for op, _, _, j1, j2 in ops if op != "equal" for j in range(j1, j2)]
        nxt = {}
        for op, i1, i2, j1, j2 in ops:
            for i in set(at) & set(range(i1, i2)):
                if op == "equal":
                    nxt[i - i1 + j1] = max(nxt.get(i - i1 + j1, 0), at[i])
                    continue
                for j in fresh:
                    w = shared(flat(prev[i]), flat(nb[j])) or (0.5 if op == "replace" and j1 <= j < j2 else 0)
                    if w:
                        nxt[j] = max(nxt.get(j, 0), min(at[i], w))
        at, prev = nxt, nb
    return at


def file_edits(c):
    """Before `add` files a call: each trip's misquote mark settled against the
    text its run read, each run's spans mapped onto the call's edits, and the
    kept texts dropped. The last run's spans are the call's edits worked out
    from the same text, so they map by the text they replace. An earlier run's
    span is followed through the texts to the last run's, and maps to the span
    it lands in; without the texts, to the last run's span that replaces the
    same base blocks, and else by the text it replaces."""
    froms = [flat(e.get("from")) for e in c.get("edits") or []]
    runs = [r for r in (c.get("review") or {}).get("runs") or [] if isinstance(r, dict)]

    def by_from(f):
        hit = ([k for k, x in enumerate(froms, 1) if x == f]
               or [k for k, x in enumerate(froms, 1) if f and x and (f in x or x in f)])
        return hit[0] if hit else None

    li = next((i for i in range(len(runs) - 1, -1, -1) if isinstance(runs[i].get("edits"), list)), None)
    last = runs[li]["edits"] if li is not None else []
    anchors = [(s.get("base"), s["lines"], by_from(flat(s.get("from")))) for s in last if isinstance(s, dict) and s.get("lines")]
    texts = li is not None and all(isinstance(r.get("text"), str) for r in runs[:li + 1])
    final = doc_blocks(runs[li]["text"]) if texts else []
    for k, r in enumerate(runs):
        if isinstance(r.get("text"), str):
            mark_misquotes(r, r["text"])
        spans = r.get("edits")
        if isinstance(spans, list):
            for s in spans:
                if not isinstance(s, dict):
                    continue
                f, base = flat(s.pop("from", None)), s.pop("base", None)
                if "edit" in s:
                    continue
                if "item" in s:
                    ids = entry_ids(c)
                    s["edit"] = ids.index(s["item"]) + 1 if s["item"] in ids else None
                    continue
                if c.get("new"):
                    s["edit"] = 1; continue
                hit = None
                if texts and k <= li and s.get("lines"):
                    to = follow(runs, k, s["lines"])
                    went = [final[i] for i in sorted(to, key=lambda i: -to[i])]
                    hit = next((e for _, ln, e in anchors for _, a, z in went if e and a <= ln[1] and ln[0] <= z), None)
                if hit is None:
                    hit = next((e for b, _, e in anchors if base and b and e and meets(base, b)), None)
                s["edit"] = hit or by_from(f)
        r.pop("text", None)
    return c


def unread_edits(c):
    """The call's edits the critic's last run did not read: each edit's `to`
    must be in the text that run kept."""
    runs = (c.get("review") or {}).get("runs") or []
    text = runs[-1].get("text") if runs else None
    if not isinstance(text, str):
        return []
    if is_list(c):
        return [i + 1 for i, (e, item) in enumerate(zip(c.get("edits") or [], entry_ids(c)))
                if not any(flat(entry_text(item, e.get("to"), sid)) in flat(text) for sid in (False, True))]
    return [i + 1 for i, e in enumerate(c.get("edits") or []) if flat(e.get("to")) not in flat(text)]


def trip_line(t, n, j):
    tag = "" if t.get("edit") is None else f" · E{t['edit']}" if t["edit"] else " · E-"
    ans = f"  [{t['answer']}{': ' + t['why'] if t.get('why') else ''}]" if t.get("answer") else ""
    return (f"  {n}.{j + 1} {t['peeve']}{tag} · {t['where']} · \"{t['quote']}\"{ans}"
            + ("  (misquoted: not in the text this run read)" if t.get("misquoted") else ""))


def run_lines(run, n):
    """A run as `review` prints it: the verdict, then each trip numbered."""
    trips = run.get("trips") or []
    out = [f"run {n}: {run['verdict']}" + (f", {len(trips)} trip{'s' if len(trips) != 1 else ''}" if trips else "")]
    out += [trip_line(t, n, j) for j, t in enumerate(trips)]
    if run.get("stated"):
        out.append(f"  the report says {run['stated'].upper()}; its trips inside an edit make it {run['verdict']}")
    if run["verdict"] == "unknown":
        out.append("  the report is in neither of the critic's forms; it is kept whole")
    return out


def change_lines(run, n, nxt):
    """The changes after a run, numbered, each with the trips whose quotes it
    holds, so the session can say which it answers (--answers)."""
    changes, reflow = run.get("changes") or [], run.get("reflow") or 0
    if not changes and not reflow:
        return []
    out = [f"  then {len(changes)} change{'s' if len(changes) != 1 else ''} before run {n + 1}"
           + (f", and {reflow} block{'s' if reflow != 1 else ''} rewrapped (reflow, not a change)" if reflow else "")]
    db = doc_blocks(nxt.get("text") or "") if isinstance(nxt, dict) else []
    spans = (nxt or {}).get("edits") or []
    hint = None
    for k, ch in enumerate(changes, 1):
        held = [f"{n}.{j + 1}" for j, t in enumerate(run.get("trips") or [])
                if t.get("quote") and t.get("answer") != "kept" and quote_in(t["quote"], ch["from"])]
        if not ch.get("answers") and not hint:
            hint = f"{n}.c{k} {','.join(x.split('.')[1] for x in held) or '<trips>'}"
        first = (blocks(ch["to"]) or [""])[0]
        at = next(((a, z) for b, a, z in db if b == first), None) if first else None
        e = next((s for s, x in enumerate(spans, 1) if x and (f"`{x['item']}`" in ch["to"] + ch["from"] if x.get("item")
                  else x.get("lines") and at and x["lines"][0] <= at[1] and at[0] <= x["lines"][1])), None)
        words = " ".join(str(ch["to"] or ch["from"]).split())
        out.append(f"    c{k}{f' · E{e}' if e else ''}{f' · line {at[0]}' if at else ''} · \"{words[:60]}{'…' if len(words) > 60 else ''}\""
                   + (f"  answers {', '.join(f'{n}.{x}' for x in ch['answers'])}" if ch.get("answers")
                      else f"  quotes {', '.join(held)}" if held else ""))
    if hint:
        out.append(f"  record what each answers: user-call.py review DRAFT --answers {hint}")
    return out


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


def tight_blocks(text):
    """The text's blocks (line_blocks), each with whether it sits on the line
    right after the block before it, as frontmatter's blocks do."""
    lines = text.splitlines()
    spans = line_blocks(lines)
    return [("\n".join(lines[a:z + 1]), k > 0 and a == spans[k - 1][1] + 1) for k, (a, z) in enumerate(spans)]


def blocks(text):
    return [b for b, _ in tight_blocks(text)]


def joined(run):
    """A run of one text's tight_blocks() as one string: a blank line between
    two blocks, and a line break alone before a block that sat on the next line."""
    return "".join(("\n" if tight else "\n\n") + b if k else b for k, (b, tight) in enumerate(run))


def edits(old, new):
    """A documentation call's edits from two copies of a document: home's
    propose.py pairing, kept the same so a pass filed either way pairs alike,
    except that frontmatter pairs by property (line_blocks)."""
    A, B = tight_blocks(old), tight_blocks(new)
    a, b = [x for x, _ in A], [x for x, _ in B]
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "equal":
            continue
        if op == "replace":
            if i2 - i1 == j2 - j1:
                out.extend({"from": x, "to": y} for x, y in zip(a[i1:i2], b[j1:j2]))
            else:
                out.append({"from": joined(A[i1:i2]), "to": joined(B[j1:j2])})
            continue
        if i1 > 0:
            ctx, before = a[i1 - 1], True
        elif i2 < len(a):
            ctx, before = a[i2], False
        else:
            raise ValueError("the old copy has no unchanged block to anchor this change on")
        if op == "insert":
            out.append({"from": ctx, "to": joined(B[j1 - 1:j2] if before else B[j1:j2 + 1])})
        else:
            out.append({"from": joined(A[i1 - 1:i2] if before else A[i1:i2 + 1]), "to": ctx})
    return out


def text_at(path, ref):
    """A file's text at a ref of its checkout: (text, None), or (None, why),
    why being "new" when the ref does not hold it."""
    f = Path(path).resolve()
    sh = lambda *a: subprocess.run(["git", *a], cwd=f.parent, capture_output=True, text=True)
    top = sh("rev-parse", "--show-toplevel")
    if top.returncode:
        return None, f"{path} is not in a git checkout"
    rel = f.relative_to(top.stdout.strip()).as_posix()
    shown = sh("show", f"{ref}:{rel}")
    if shown.returncode:
        return None, "new" if sh("rev-parse", "--verify", "-q", ref).returncode == 0 else shown.stderr.strip()
    return shown.stdout.replace("\r\n", "\n"), None


# What a session writes on an edit, carried onto the same edit worked out again.
CARRY = ("why", "background", "proposal", "notes")


def refresh_edits(draft, found):
    """The draft's edits as `found` (edits(), against the base), each keeping
    what the session wrote on the edit with the same `from`. Returns the
    numbers of the old edits whose writing matched none and was dropped."""
    old = draft.get("edits") or []
    by_from = {flat(e.get("from")): e for e in found}
    dropped = []
    for k, e in enumerate(old, 1):
        hit = by_from.get(flat(e.get("from")))
        carry = {x: e[x] for x in CARRY if x in e}
        if hit is not None:
            hit.update(carry)
        elif carry:
            dropped.append(k)
    draft["edits"] = found
    return dropped


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

    def notes(self):
        """Every note on main in this checkout's notes store, the folder its
        .web-tools.json declares as "notes" (skills/notes/note.py reads it the same way)."""
        r = git(self.repo, "show", "origin/main:.web-tools.json", check=False)
        try:
            folder = json.loads(r.stdout).get("notes") if r.returncode == 0 else None
        except ValueError:
            folder = None
        folder = folder.strip("/") if isinstance(folder, str) and folder.strip("/") else "notes"
        r = git(self.repo, "show", f"origin/main:{folder}/notes.jsonl", check=False)
        out = []
        for l in (r.stdout.decode("utf-8") if r.returncode == 0 else "").splitlines():
            try:
                out.append(json.loads(l))
            except ValueError:
                pass
        return out

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
        frm = e.get("from")
        what = e.get("why") or (f"entry {e.get('item', '')}" if isinstance(frm, dict) else " ".join(str(frm or "").split())[:60])
        out.append(f"  {n}. {d.get('decision', '')}" + (f"  ({what})" if what else ""))
        if d.get("note"):
            out += ["       " + line for line in d["note"].splitlines()]
    for x in r.get("notes") or []:
        out.append(f'  on "{x.get("on", "")}": ' + " ".join(str(x.get("note", "")).split()))
    for x in r.get("picks") or []:
        out.append(f"  {x.get('id', '')}  {x.get('href', '')}".rstrip())
    return out


VOTED = {"up": "votes up", "down": "votes down", "": "withdraws a vote"}


def note_lines(notes, cid, folder="user-calls"):
    """The notes whose subject is call `cid`, in any repo and at any ref, oldest
    first, as printed by `answers` after the answer lines: a FAB note on the
    call's page (lib/alpineComponents/fab.js) is the owner's usual answer."""
    tail = f":{folder}/{cid}.json"
    mine = sorted((n for n in notes if isinstance(n, dict) and str(n.get("about", "")).endswith(tail)),
                  key=lambda n: str(n.get("at", "")))
    out = []
    for n in mine:
        vote = f"  {VOTED[n['vote']]}" if n.get("vote") in VOTED else ""
        out.append(f"Note  ({n.get('author', '')} {n.get('at', '')}){vote}")
        out += ["  " + line for line in str(n.get("text", "")).splitlines()]
    return out


def main(argv):
    argv, at_store = flag(argv, "--store")
    if len(argv) < 2 or argv[1] not in {"add", "close", "answers", "list", "held", "edits", "link", "patch", "review"}:
        sys.exit(__doc__)
    cmd = argv[1]
    if cmd == "review":
        argv, base_ref = flag(argv, "--base")
        out_path, want_spans = None, "--spans" in argv
        if want_spans:
            k = argv.index("--spans")
            out_path = argv[k + 1] if len(argv) > k + 1 else None
            argv = argv[:k]
        if len(argv) < 4:
            sys.exit("user-call: review DRAFT FILE --spans [OUT], review DRAFT FILE [REPORT], "
                     "review DRAFT --answers [RUN.]cN T[,T], review DRAFT --kept [RUN.]N WHY, or review DRAFT --note TEXT")
        draft_path = Path(argv[2])
        draft = json.loads(draft_path.read_text(encoding="utf-8")) if draft_path.exists() else {}
        runs = (draft.get("review") or {}).get("runs") or []
        warn = lambda lines: [print("warning: " + x, file=sys.stderr) for x in lines]
        if argv[3] == "--kept":
            if len(argv) < 6 or not argv[5].strip():
                sys.exit("user-call: --kept takes the trip, as 2 or 1.2, and why it is kept")
            try:
                keep_trip(draft, argv[4], argv[5].strip())
            except ValueError as e:
                sys.exit(f"user-call: {e}")
            shown = [(n, r) for n, r in enumerate(runs, 1)]
        elif argv[3] == "--answers":
            if len(argv) < 6:
                sys.exit("user-call: --answers takes the change, as c1 or 2.c1, and the trips it answers, as 1,3")
            try:
                n = answer_change(draft, argv[4], argv[5])
            except ValueError as e:
                sys.exit(f"user-call: {e}")
            shown = [(n, runs[n - 1])]
        elif argv[3] == "--note":
            if not runs or len(argv) < 5 or not argv[4].strip():
                sys.exit("user-call: --note takes one line on the latest run, for a draft that holds one")
            runs[-1]["note"] = argv[4].strip()
            shown = [(len(runs), runs[-1])]
        elif is_list(draft) or argv[3].endswith(".json"):
            # A list call: the critic reads the call's entries as text, and an
            # edit's span is its entry, by id.
            raw = Path(argv[3]).read_text(encoding="utf-8").replace("\r\n", "\n")
            ref = base_ref or draft.get("base")
            try:
                if ref:
                    old, why = text_at(argv[3], ref)
                    if old is None:
                        sys.exit(f"user-call: could not read {argv[3]} at {ref}: "
                                 + ("a new list has no entries to edit" if why == "new" else why))
                    dropped = refresh_entries(draft, list_edits(old, raw))
                    warn(f"edit {k}'s why, background, proposal or notes matched no edit now, so they were dropped"
                         for k in dropped)
                ids = entry_ids(draft)
                text, held = list_reading(raw, ids)
            except (ValueError, AttributeError) as e:
                sys.exit(f"user-call: {argv[3]} is not a list: {e}")
            missing = [k for k, h in enumerate(held, 1) if not h]
            spans = [{"item": i} for i in ids]
            if want_spans:
                if not ids or missing:
                    sys.exit("user-call: " + (f"edit {', '.join(map(str, missing))} names an entry {argv[3]} does not hold"
                                              if missing else "the draft holds no edits: give it a base, as \"base\": \"main\", or its edits"))
                draft_path.write_text(json.dumps(draft, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                block = list_spans_text(argv[3], ids, text)
                if out_path:
                    Path(out_path).write_text(block + "\n", encoding="utf-8")
                    print(f"wrote the spans of {len(ids)} edit{'s' if len(ids) != 1 else ''} to {out_path}")
                else:
                    print(block)
                return
            report = Path(argv[4]).read_text(encoding="utf-8") if len(argv) > 4 else sys.stdin.read()
            if missing:
                warn([f"edit {', '.join(map(str, missing))} names an entry {argv[3]} does not hold, so this run keeps no spans"])
            add_run(draft, text, report, spans=None if missing or not ids else spans)
            runs = draft["review"]["runs"]
            shown = [(n, r) for n, r in enumerate(runs, 1)][-2:]
        else:
            text = Path(argv[3]).read_text(encoding="utf-8").replace("\r\n", "\n")
            ref, old = base_ref or draft.get("base"), None
            if ref and not draft.get("new"):
                old, why = text_at(argv[3], ref)
                if old is None:
                    sys.exit(f"user-call: could not read {argv[3]} at {ref}: "
                             + ("it is new there, so the call is \"new\": true" if why == "new" else why))
                try:
                    dropped = refresh_edits(draft, edits(old, text))
                except ValueError as e:
                    sys.exit(f"user-call: {e}")
                warn(f"edit {k}'s why, background, proposal or notes matched no edit now, so they were dropped"
                     for k in dropped)
            spans = spans_of(draft, text, old if ref and not draft.get("new") else None)
            missing = [k for k, s in enumerate(spans, 1) if s is None]
            if want_spans:
                if not spans or missing:
                    sys.exit("user-call: " + (f"edit {', '.join(map(str, missing))} is not in {argv[3]} as it stands: "
                                              "give the draft its base, or refresh its edits" if missing else
                                              "the draft holds no edits: give it a base, as \"base\": \"main\", or its edits"))
                draft_path.write_text(json.dumps(draft, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                if not runs:
                    warn(wrap_warnings(draft, text, spans))
                block = spans_text(argv[3], spans)
                if out_path:
                    Path(out_path).write_text(block + "\n", encoding="utf-8")
                    print(f"wrote the spans of {len(spans)} edit{'s' if len(spans) != 1 else ''} to {out_path}")
                else:
                    print(block)
                return
            report = Path(argv[4]).read_text(encoding="utf-8") if len(argv) > 4 else sys.stdin.read()
            if missing:
                warn([f"edit {', '.join(map(str, missing))} is not in {argv[3]}, so this run keeps no spans"])
            if not runs:
                warn(wrap_warnings(draft, text, spans))
            add_run(draft, text, report, spans=None if missing or not spans else spans)
            runs = draft["review"]["runs"]
            warn(tag_warnings(runs[-1], len(runs), text))
            shown = [(n, r) for n, r in enumerate(runs, 1)][-2:]
        draft_path.write_text(json.dumps(draft, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        for n, r in shown:
            print("\n".join(run_lines(r, n)))
            nxt = runs[n] if n < len(runs) else None
            if r.get("changes") or r.get("reflow"):
                print("\n".join(change_lines(r, n, nxt)))
        return
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
            name = argv[2]
        else:
            argv, old = flag(argv, "--old")
            argv, new = flag(argv, "--new")
            if not old or not new:
                sys.exit("user-call: edits needs --old and --new, or --base and a file")
            old_text, new_text = Path(old).read_text(encoding="utf-8"), Path(new).read_text(encoding="utf-8")
            name = new
        try:
            found = list_edits(old_text, new_text) if name.endswith(".json") else edits(old_text, new_text)
        except ValueError as e:
            sys.exit(f"user-call: {e}")
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
        if c.get("kind") == "documentation" and not (c.get("review") or {}).get("runs"):
            sys.exit("user-call: a documentation call is filed with the peeves critic's runs on its document: "
                     "run review DRAFT FILE --spans, the critic, then review DRAFT FILE REPORT, and add the draft")
        unread = unread_edits(c)
        if unread:
            sys.exit(f"user-call: the critic's last run did not read edit{'s' if len(unread) > 1 else ''} "
                     f"{', '.join(map(str, unread))} as filed: run it again on the document as it stands")
        file_edits(c)
        errs = check(c)
        if not errs and c.get("kind") == "documentation" and is_list(c):
            repo, ref, path, _ = list_target(c)
            items = list_at(repo, c.get("base") or ref, path)
            errs = [items] if isinstance(items, str) else entry_base_errors(c, items)
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
        noted = note_lines(store.notes(), argv[2], store.path)
        if noted:
            print("\n".join(noted))
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
    elif cmd == "held":
        store = Store(at_store)
        held = {}
        for c in (json.loads(t) for t in store.calls().values()):
            m = re.match(r"([\w.-]+/[\w.-]+)@([^:]*/docs-[^:]+):", str(c.get("file", "")))
            if c.get("status") == "open" and c.get("kind") == "documentation" and m:
                held.setdefault(m.group(1) + "@" + m.group(2), []).append(c)
        for where in sorted(held):
            print(f"{where}  https://mehrlander.github.io/web-tools/pages/branch.html#gh={where}&base=main")
            for c in sorted(held[where], key=lambda c: c["id"]):
                print(f"  {c['id']}: {c['question']}  https://mehrlander.github.io/web-tools/pages/user-call.html"
                      f"#src=mehrlander/web-tools-private:{store.path}/{c['id']}.json")


if __name__ == "__main__":
    main(sys.argv)
