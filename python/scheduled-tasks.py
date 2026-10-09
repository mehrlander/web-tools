#!/usr/bin/env python3
"""Run the estate's scheduled tasks that are due, by progressive action.

    python3 python/scheduled-tasks.py                    # run what is due; read and write GitHub
    python3 python/scheduled-tasks.py --dry-run          # run every stage, write nothing
    python3 python/scheduled-tasks.py --task statutes-rcw --force    # past the gate's due date
    python3 python/scheduled-tasks.py --dry-run \\
        --local mehrlander/web-tools-private=../web-tools-private --local mehrlander/home=../home

THE REGISTRY is web-tools-private's data/design/scheduled-tasks.csv, one row per
task the estate runs on a clock, and data/design/scheduled-task-stages.csv, each
task's stages in order (that repo's README, "Scheduled tasks"). This script runs
the rows whose entry is its own workflow, .github/workflows/scheduled-tasks.yml,
which fires daily; every other row points at a job that keeps its own schedule.

PROGRESSIVE ACTION. A task's stages run cheapest first, and each runs only when
the one before it found a reason. The gate comes first for every task: a row
that is off, or not yet due, stops there, so a daily run with nothing due costs
a date comparison and writes nothing. The stages a task declares in the registry
and the stages its code here implements must be the same list in the same order,
or the run fails before it starts: the registry is what the Map view shows, so
it may not describe a task the code does not run.

STATUS. `on` writes state and findings; `dry` runs every stage and writes
nothing, so its next run starts from the same state; `off` stops at the gate.
--dry-run makes every task dry for one run.

STATE is web-tools-private's state/scheduled-tasks.json: per task, its last run,
outcome, next due date, consecutive failures, how many targets reached each
stage, and each target's last fingerprint; and the last RUNS_KEPT runs. FINDINGS
are notes appended to its notes/notes.jsonl, signed scheduled/<task id>, about
the kept file the finding concerns (web-tools skills/notes/SKILL.md).

TOKENS. GH_TOKEN reads the registry, the state and the files a task watches;
GH_WRITE_TOKEN writes the state and the notes, and GH_TOKEN stands in for it when
it is absent. The workflow runs in a public repo, so the log says counts and
never content.

Offline, for tests and dry runs from a checkout: --local REPO=DIR reads a repo's
files from a directory, --pages DIR reads a page from DIR/rcw-<section>.html
rather than fetching it, --state-file and --notes-file read and write local files
in place of the store's, and --now fixes the clock.
"""
import argparse
import base64
import csv
import datetime as dt
import hashlib
import io
import json
import os
import re
import string
import random
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

STORE = "mehrlander/web-tools-private"
TASKS_CSV = "data/design/scheduled-tasks.csv"
STAGES_CSV = "data/design/scheduled-task-stages.csv"
STATE_JSON = "state/scheduled-tasks.json"
NOTES_JSONL = "notes/notes.jsonl"
ENTRY = ".github/workflows/scheduled-tasks.yml"
RUNS_KEPT = 30
USER_AGENT = "mehrlander-web-tools scheduled-tasks (+https://github.com/mehrlander/web-tools)"
ADDR = re.compile(r"^([\w.-]+/[\w.-]+)@([^:]+):(.+)$")
TASK_ID = re.compile(r"^[a-z0-9-]+$")


def log(msg):
    print(msg, flush=True)


# ── Where files come from: GitHub, or a local checkout ─────────────────────────
class Files:
    def __init__(self, local, read_token, write_token):
        self.local = local                      # {repo: Path}
        self.read_token = read_token
        self.write_token = write_token or read_token

    def _api(self, method, url, token, body=None, accept="application/vnd.github+json"):
        req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode())
        req.add_header("Accept", accept)
        req.add_header("User-Agent", USER_AGENT)
        if token:
            req.add_header("Authorization", "Bearer " + token)
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.read()

    def read(self, addr):
        """The text at owner/repo@ref:path."""
        m = ADDR.match(addr)
        if not m:
            raise ValueError(f"not an estate address: {addr}")
        repo, ref, path = m.groups()
        if repo in self.local:
            return (self.local[repo] / path).read_text(encoding="utf-8")
        url = f"https://api.github.com/repos/{repo}/contents/{path}?ref={ref}"
        return self._api("GET", url, self.read_token, accept="application/vnd.github.raw").decode("utf-8")

    def read_with_sha(self, repo, path):
        """(text, sha) at main, or (None, None) when the file does not exist."""
        url = f"https://api.github.com/repos/{repo}/contents/{path}?ref=main"
        try:
            meta = json.loads(self._api("GET", url, self.read_token))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None, None
            raise
        return base64.b64decode(meta["content"]).decode("utf-8"), meta["sha"]

    def write(self, repo, path, text, sha, message):
        url = f"https://api.github.com/repos/{repo}/contents/{path}"
        body = {"message": message, "branch": "main", "content": base64.b64encode(text.encode()).decode()}
        if sha:
            body["sha"] = sha
        self._api("PUT", url, self.write_token, body)


# ── The registry ───────────────────────────────────────────────────────────────
def load_registry(files, store_ref):
    tasks = list(csv.DictReader(io.StringIO(files.read(f"{STORE}@{store_ref}:{TASKS_CSV}"))))
    stages = list(csv.DictReader(io.StringIO(files.read(f"{STORE}@{store_ref}:{STAGES_CSV}"))))
    by_task = {}
    for s in stages:
        by_task.setdefault(s["task"], []).append(s)
    for v in by_task.values():
        v.sort(key=lambda s: int(s["order"]))
    return tasks, by_task


def mine(row):
    """A row this script runs: a hosted task whose entry is this workflow."""
    return row["runner"] == "hosted" and row["entry"].split(":", 1)[-1] == ENTRY


def every_delta(text):
    m = re.fullmatch(r"(\d+)([dh])", (text or "").strip())
    if not m:
        raise ValueError(f"cadence {text!r} is not N d or N h")
    n = int(m.group(1))
    return dt.timedelta(days=n) if m.group(2) == "d" else dt.timedelta(hours=n)


# ── The statute check ──────────────────────────────────────────────────────────
# Its stages, in the order the registry must declare them.
SECTION = re.compile(r"\bRCW (\d+[A-Z]?\.\d+[A-Z]?\.\d+[A-Z]?)")
SESSION_LAW = re.compile(
    r"\b(1[89]\d\d|20\d\d)\b((?:\s+\d+(?:st|nd|rd|th))?(?:\s+(?:sp|ex)\.s\.)?)\s+c\s+(\d+)\s+(?:s|§)\s*(\d+[A-Za-z]?)")
BLOCK = {"p", "div", "br", "h1", "h2", "h3", "h4", "li", "tr", "table"}
# Elements that never take a closing tag. The pages write <br/>, which the
# parser reports as a start and an end; counting the end without the start
# closed the content element early (found by the first dry run, 2026-10-09).
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class ContentText(HTMLParser):
    """The text of the element whose class names `main-page-content`, a line
    per block, without scripts or styles: the same element the Law view's
    trimmed copies keep (home data/source/2026-10-09-pension-statutes)."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0          # > 0 inside the content element
        self.skip = 0
        self.out = []

    def handle_starttag(self, tag, attrs):
        if self.depth:
            self.depth += tag not in VOID
            if tag in ("script", "style"):
                self.skip += 1
            if tag in BLOCK:
                self.out.append("\n")
        elif "main-page-content" in (dict(attrs).get("class") or "").split():
            self.depth = 1

    def handle_startendtag(self, tag, attrs):
        if self.depth and tag in BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if self.depth and tag not in VOID:
            if tag in ("script", "style") and self.skip:
                self.skip -= 1
            if tag in BLOCK:
                self.out.append("\n")
            self.depth -= 1

    def handle_data(self, data):
        if self.depth and not self.skip:
            self.out.append(data)


def content_text(html):
    p = ContentText()
    p.feed(html)
    lines = (re.sub(r"\s+", " ", ln).strip() for ln in "".join(p.out).split("\n"))
    return "\n".join(ln for ln in lines if ln)


def session_laws(text):
    """Every session law the text's history notes cite, normalised, in order."""
    out = []
    for note in re.findall(r"\[([^\[\]]*\bc\s+\d+[^\[\]]*)\]", text):
        for m in SESSION_LAW.finditer(note):
            year, special, chapter, section = m.groups()
            law = f"{year}{re.sub(r'\s+', ' ', special)} c {chapter} s {section}"
            if law not in out:
                out.append(law)
    return out


class StatutesRcw:
    STAGES = ["gate", "probe", "classify", "report"]

    def __init__(self, row, files, pages, pause):
        self.row, self.files, self.pages, self.pause = row, files, pages, pause

    def targets(self):
        rows = csv.DictReader(io.StringIO(self.files.read(self.row["watches"])))
        found = sorted({s for r in rows for s in SECTION.findall(r.get("statutes", ""))},
                       key=lambda s: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", s)])
        return found[: int(self.row["budget"] or len(found))]

    def fetch(self, sec):
        if self.pages:
            return (Path(self.pages) / f"rcw-{sec}.html").read_text(encoding="utf-8")
        req = urllib.request.Request(f"https://app.leg.wa.gov/RCW/default.aspx?cite={sec}",
                                     headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as res:
            html = res.read().decode("utf-8", "replace")
        time.sleep(self.pause)
        return html

    def run(self, prior, now):
        """Climb the stages for each target; return (targets state, reached, outcomes, notes)."""
        seen = dict(prior)
        reached = {"probe": 0, "classify": 0, "report": 0}
        outcomes = {"baseline": 0, "unchanged": 0, "reworded": 0, "finding": 0, "failed": 0}
        notes = []
        for sec in self.targets():
            reached["probe"] += 1
            try:
                text = content_text(self.fetch(sec))
                if not text:
                    raise ValueError("no main-page-content element")
            except Exception:
                outcomes["failed"] += 1
                continue
            fp = "sha256:" + hashlib.sha256(text.encode()).hexdigest()[:16]
            laws = session_laws(text)
            was = seen.get(sec)
            seen[sec] = {"fp": fp, "head": laws[0] if laws else "", "laws": laws, "checked": now.date().isoformat()}
            if not was:
                outcomes["baseline"] += 1           # the first fingerprint: nothing to compare with
                continue
            if was.get("fp") == fp:
                outcomes["unchanged"] += 1
                continue
            reached["classify"] += 1
            new = [law for law in laws if law not in (was.get("laws") or [])]
            if not new:
                outcomes["reworded"] += 1
                continue
            reached["report"] += 1
            outcomes["finding"] += 1
            notes.append({
                "about": "mehrlander/home:projects/budget-drs/data/source/2026-10-09-pension-statutes/html/rcw-" + sec + ".html",
                "text": (f"RCW {sec} changed: its history note now cites {', '.join(new)}, which the kept copy "
                         f"does not. The page: https://app.leg.wa.gov/RCW/default.aspx?cite={sec}. "
                         "The copy wants a re-trim, and the Law view may want an event."),
            })
        return seen, reached, outcomes, notes


IMPLEMENTED = {"statutes-rcw": StatutesRcw}


# ── One run ────────────────────────────────────────────────────────────────────
def outcome_of(outcomes):
    for k in ("finding", "reworded", "baseline", "unchanged"):
        if outcomes.get(k):
            return k
    return "failed" if outcomes.get("failed") else "unchanged"


def new_note_id():
    t, digits, s = int(time.time() * 1000), string.digits + string.ascii_lowercase, ""
    while t:
        t, r = divmod(t, 36)
        s = digits[r] + s
    return "n" + s + "".join(random.choices(digits, k=4))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Run the estate's scheduled tasks that are due.")
    ap.add_argument("--task", default="", help="run only this task")
    ap.add_argument("--force", action="store_true", help="past the gate's due date (not past `off`)")
    ap.add_argument("--dry-run", action="store_true", help="run every stage, write nothing")
    ap.add_argument("--store-ref", default="main", help="the registry's ref in web-tools-private")
    ap.add_argument("--local", action="append", default=[], metavar="REPO=DIR", help="read a repo's files from a checkout")
    ap.add_argument("--pages", help="read pages from DIR/rcw-<section>.html instead of fetching")
    ap.add_argument("--state-file", help="read and write state here instead of the store")
    ap.add_argument("--notes-file", help="append notes here instead of the store")
    ap.add_argument("--now", help="the clock, as an ISO timestamp")
    ap.add_argument("--pause", type=float, default=1.0, help="seconds between fetches")
    a = ap.parse_args(argv)
    if a.task and not TASK_ID.match(a.task):
        ap.error("--task takes a registry id")
    now = dt.datetime.fromisoformat(a.now) if a.now else dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=dt.timezone.utc)
    local = {}
    for spec in a.local:
        repo, _, d = spec.partition("=")
        local[repo] = Path(d)
    files = Files(local, os.environ.get("GH_TOKEN"), os.environ.get("GH_WRITE_TOKEN"))

    tasks, stages = load_registry(files, a.store_ref)
    rows = [r for r in tasks if mine(r) and (not a.task or r["id"] == a.task)]
    if a.task and not rows:
        ap.error(f"{a.task} is not a task this workflow runs")
    for r in rows:
        impl = IMPLEMENTED.get(r["id"])
        declared = [s["stage"] for s in stages.get(r["id"], [])]
        if not impl:
            raise SystemExit(f"FAIL {r['id']}: the registry schedules it here, and no code implements it")
        if declared != impl.STAGES:
            raise SystemExit(f"FAIL {r['id']}: the registry declares stages {declared}, the code runs {impl.STAGES}")

    if a.state_file:
        p = Path(a.state_file)
        state, state_sha = (json.loads(p.read_text()) if p.exists() else None), None
    else:
        text, state_sha = files.read_with_sha(STORE, STATE_JSON)
        state = json.loads(text) if text else None
    state = state or {"tasks": {}, "runs": []}

    wrote, notes_out, summary = False, [], []
    for r in rows:
        tid, status = r["id"], r["status"]
        st = state["tasks"].get(tid, {})
        dry = a.dry_run or status == "dry"
        # Stage 0, the gate.
        if status == "off":
            log(f"{tid}: off")
            continue
        due = a.force or not st.get("next_due") or now.date().isoformat() >= st["next_due"]
        if not due:
            log(f"{tid}: not due until {st['next_due']}")
            continue
        impl = IMPLEMENTED[tid](r, files, a.pages, a.pause)
        targets, reached, outcomes, notes = impl.run(st.get("targets", {}), now)
        outcome = outcome_of(outcomes)
        all_failed = outcomes["failed"] and outcomes["failed"] == reached["probe"]
        failures = st.get("failures", 0) + 1 if all_failed else 0
        next_due = (now + (dt.timedelta(days=1) if all_failed else every_delta(r["every"]))).date().isoformat()
        counts = ", ".join(f"{k} {v}" for k, v in outcomes.items() if v)
        log(f"{tid}: due; probe {reached['probe']}, classify {reached['classify']}, report {reached['report']} "
            f"({counts}); outcome {outcome}; next due {next_due}" + ("; dry, nothing written" if dry else ""))
        summary.append(f"{tid} {outcome}")
        if dry:
            continue
        state["tasks"][tid] = {"last_run": now.isoformat(timespec="seconds"), "outcome": outcome,
                               "next_due": next_due, "failures": failures,
                               "reached": {"gate": 1, **reached}, "targets": targets}
        state["runs"] = ([{"at": now.isoformat(timespec="seconds"), "task": tid, "outcome": outcome,
                           "reached": next((s for s in ("report", "classify", "probe") if reached[s]), "gate"),
                           "targets": reached["probe"], "changed": reached["classify"]}]
                         + state.get("runs", []))[:RUNS_KEPT]
        for n in notes:
            notes_out.append({"id": new_note_id(), "at": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
                              "author": f"scheduled/{tid}", **n})
        wrote = True

    if not wrote:
        return 0
    text = json.dumps(state, indent=1, ensure_ascii=False) + "\n"
    if a.state_file:
        Path(a.state_file).write_text(text, encoding="utf-8")
    else:
        files.write(STORE, STATE_JSON, text, state_sha, "scheduled-tasks: " + "; ".join(summary))
    if notes_out:
        lines = "".join(json.dumps(n, ensure_ascii=False) + "\n" for n in notes_out)
        if a.notes_file:
            with open(a.notes_file, "a", encoding="utf-8") as f:
                f.write(lines)
        else:
            for attempt in range(3):            # another writer may land between the read and the write
                cur, sha = files.read_with_sha(STORE, NOTES_JSONL)
                try:
                    files.write(STORE, NOTES_JSONL, (cur or "") + lines, sha,
                                f"scheduled-tasks: {len(notes_out)} finding(s)")
                    break
                except urllib.error.HTTPError as e:
                    if e.code not in (409, 422) or attempt == 2:
                        raise
        log(f"filed {len(notes_out)} finding(s) as notes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
