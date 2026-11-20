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
    user-call.py review DRAFT FILE [REPORT]               a peeves-critic run on FILE, added to a documentation
                                                          call's draft; REPORT is the critic's text (default stdin)
    user-call.py review DRAFT --kept [RUN.]N WHY          trip N of the latest run (or of RUN) set aside, and why
    user-call.py review DRAFT --note TEXT                 one line on the latest run: what the session did about it

A documentation call's `review` is the peeves critic's runs on its document, in
order, so the owner sees what the critic found and how the wording moved in
answer. Each run is {verdict, trips, clear, candidates, preexisting, changes,
note, report}: verdict is pass (no trips), fail or unknown (a report in neither
of the critic's forms); each trip is {peeve, where, quote, clause, answer, why},
answered `changed` or `kept` with why; changes are {from, to}, the text the
session changed after the run, before the next one; report is the critic's text
as it came back, which every trip's id and quote are checked against. `review`
parses the report, keeps the document's text in the draft, and on the next run
works out the changes from it and marks the trips still unanswered as changed;
`add` refuses a call whose edits the critic's last run did not read, or with a
trip left unanswered, and drops the kept texts.

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
        if not isinstance(trips, list) or (v == "fail") != bool(trips):
            errs.append(f"{at}: a failed run has trips, and a passed or unknown one none")
            trips = trips if isinstance(trips, list) else []
        changes = run.get("changes") or []
        if not isinstance(changes, list) or len(changes) > 40 or not all(
                isinstance(x, dict) and isinstance(x.get("from"), str) and isinstance(x.get("to"), str)
                and x["from"] != x["to"] for x in changes):
            errs.append(f"{at}.changes are up to 40 {{from, to}} pairs, each a change")
            changes = []
        if changes and i == len(runs) - 1:
            errs.append(f"{at} has changes after it: run the critic again on the text as filed")
        if len(str(run.get("note") or "")) > 200:
            errs.append(f"{at}.note is one line, 200 characters at most")
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
            a = t.get("answer")
            if a not in TRIP_ANSWERS:
                errs.append(f"{tat} ({t['peeve']}) has no answer: changed, or kept with why "
                            f"(user-call.py review DRAFT --kept {i + 1}.{j + 1} WHY)")
            elif a == "kept" and not 0 < len(str(t.get("why") or "").strip()) <= 200:
                errs.append(f"{tat} is kept, so it says why in one line, 200 characters at most")
            elif a == "changed" and not changes:
                errs.append(f"{tat} is answered changed, but nothing changed after run {i + 1}")
        for k in ("clear",):
            if not isinstance(run.get(k, []), list) or not all(re.fullmatch(PEEVE, str(x)) for x in run.get(k) or []):
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
        # last section: a stamp in code, then the record's mark.
        if re.match(r"^\s*`[^`]+`\s*💬", line):
            continue
        m = SECTION.match(line)
        if m and (m.group(1) or m.group(3) or line.lstrip().startswith("#") or not m.group(5)
                  or m.group(5).startswith("(")):
            cur = m.group(2).lower().replace("-", "")
            out.setdefault(cur, [])
            rest = m.group(5).strip()
            if rest and not rest.startswith("("):
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
    """`P<id> · <where> · "<quote>" · <one clause>`, the critic's own form, or None."""
    s = BULLET.sub("", line, count=1).strip()
    m = re.match(r"\**(" + PEEVE + r")\**\s*·\s*(.*)$", s)
    if not m:
        return None
    parts = [p.strip() for p in m.group(2).split(" · ")]
    where = parts[0] if parts else ""
    rest = parts[1:]
    q = next((k for k, p in enumerate(rest) if p[:1] in "\"“'‘"), None)
    quote, clause = "", " · ".join(rest)
    if q is not None:
        quote = rest[q]
        if len(quote) > 1 and quote[0] in "\"“" and quote[-1] in "\"”" and quote.count('"') <= 2:
            quote = quote[1:-1]
        clause = " · ".join(rest[q + 1:])
        where = " · ".join([where, *rest[:q]])
    return {"peeve": m.group(1), "where": where, "quote": quote, "clause": clause}


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
    and trips outside the edit. A report in neither of the critic's forms is
    kept whole with the verdict unknown."""
    text = str(text or "").replace("\r\n", "\n").strip()
    secs, stated = sections(text)
    run = {"verdict": "unknown", "trips": [], "clear": [], "candidates": [], "preexisting": [], "report": text}
    if "trips" not in secs:
        return run
    trips, prose = [], []
    for line in secs["trips"]:
        t = trip_of(line) if line.strip() else None
        if t:
            trips.append(t)
        elif line.strip():
            prose.append(line)
    said_none = any(re.match(r"\s*\**none\b", x, re.I) for x in prose)
    if trips:
        run["verdict"] = "fail"
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
    return run


LISTY = re.compile(r"^\s*(?:[-*+]|\d+[.)]|\|)\s")


def run_changes(old, new):
    """What changed between two drafts, as {from, to} pairs: the blocks one has
    and the other does not, paired in order where their counts match and joined
    into one pair where they do not. A list or a table is cut to the lines that
    differ, so one changed bullet is not its whole list."""
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
    if not gone and not came:
        return []
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
        if f != t:
            out.append({"from": f, "to": t})
    return out


def add_run(draft, doc_text, report_text, when=None):
    """The draft with one more critic run: the run before it given the changes
    from its text to this one's, and its unanswered trips answered changed."""
    review = draft.setdefault("review", {"runs": []})
    runs = review.setdefault("runs", [])
    prev = runs[-1] if runs else None
    if prev is not None and isinstance(prev.get("text"), str):
        changes = run_changes(prev["text"], doc_text)
        prev["changes"] = changes
        for t in prev.get("trips") or []:
            if changes and t.get("answer") not in TRIP_ANSWERS:
                t["answer"] = "changed"
    run = parse_report(report_text)
    run["at"] = when or stamp()
    run["text"] = doc_text
    runs.append(run)
    return draft


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
    return draft


def unread_edits(c):
    """The call's edits the critic's last run did not read: each edit's `to`
    must be in the text that run kept."""
    runs = (c.get("review") or {}).get("runs") or []
    text = runs[-1].get("text") if runs else None
    if not isinstance(text, str):
        return []
    return [i + 1 for i, e in enumerate(c.get("edits") or []) if flat(e.get("to")) not in flat(text)]


def run_lines(run, n):
    """A run as `review` prints it: the verdict, then each trip numbered."""
    out = [f"run {n}: {run['verdict']}" + (f", {len(run['trips'])} trip{'s' if len(run['trips']) != 1 else ''}" if run["trips"] else "")]
    for j, t in enumerate(run["trips"]):
        ans = f"  [{t['answer']}{': ' + t['why'] if t.get('why') else ''}]" if t.get("answer") else ""
        out.append(f"  {n}.{j + 1} {t['peeve']} · {t['where']} · \"{t['quote']}\"{ans}")
    if run["verdict"] == "unknown":
        out.append("  the report is in neither of the critic's forms; it is kept whole")
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
    if len(argv) < 2 or argv[1] not in {"add", "close", "answers", "list", "edits", "link", "patch", "review"}:
        sys.exit(__doc__)
    cmd = argv[1]
    if cmd == "review":
        if len(argv) < 4:
            sys.exit("user-call: review DRAFT FILE [REPORT], review DRAFT --kept [RUN.]N WHY, or review DRAFT --note TEXT")
        draft_path = Path(argv[2])
        draft = json.loads(draft_path.read_text(encoding="utf-8")) if draft_path.exists() else {}
        runs = (draft.get("review") or {}).get("runs") or []
        if argv[3] == "--kept":
            if len(argv) < 6 or not argv[5].strip():
                sys.exit("user-call: --kept takes the trip, as 2 or 1.2, and why it is kept")
            try:
                keep_trip(draft, argv[4], argv[5].strip())
            except ValueError as e:
                sys.exit(f"user-call: {e}")
            shown = [(n, r) for n, r in enumerate(runs, 1)]
        elif argv[3] == "--note":
            if not runs or len(argv) < 5 or not argv[4].strip():
                sys.exit("user-call: --note takes one line on the latest run, for a draft that holds one")
            runs[-1]["note"] = argv[4].strip()
            shown = [(len(runs), runs[-1])]
        else:
            report = Path(argv[4]).read_text(encoding="utf-8") if len(argv) > 4 else sys.stdin.read()
            add_run(draft, Path(argv[3]).read_text(encoding="utf-8"), report)
            runs = draft["review"]["runs"]
            shown = [(n, r) for n, r in enumerate(runs, 1)][-2:]
        draft_path.write_text(json.dumps(draft, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        for n, r in shown:
            print("\n".join(run_lines(r, n)))
            if r.get("changes"):
                print(f"  then {len(r['changes'])} change{'s' if len(r['changes']) != 1 else ''} before run {n + 1}")
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
        unread = unread_edits(c)
        if unread:
            sys.exit(f"user-call: the critic's last run did not read edit{'s' if len(unread) > 1 else ''} "
                     f"{', '.join(map(str, unread))} as filed: run it again on the document as it stands")
        for r in (c.get("review") or {}).get("runs") or []:
            if isinstance(r, dict):
                r.pop("text", None)
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
