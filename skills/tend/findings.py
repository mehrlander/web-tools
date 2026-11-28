#!/usr/bin/env python3
"""Findings: what a tending pass concluded, stored as notes, and when to look again.

lib/kits/findings.js states the record and folds it the same way. A finding is
due for rereading when one of its subjects changed after its last assessment:
a pull request updated or a branch pushed, per the crawl's cache, or a file
committed to, per the checkouts beside the store.

Usage:
  findings.py candidates [--json]          mechanical selection: what to investigate
  findings.py add <file.json|->            one finding object, or a list of them
  findings.py update <id> <file.json|->    {"text": "what changed", "finding": {...}}
  findings.py list [--all] [--json]        folded findings, open unless --all
  findings.py check [--json]               each open finding, with the subjects changed since its last assessment
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "notes"))
import note  # noqa: E402  (skills/notes/note.py, the store's one writer)

KINDS = ("answer", "unreached", "overlap", "superseded")
LEGACY_KINDS = ("settled",)          # the first records' word for superseded
FIELDS = ("kind", "subjects", "why", "next", "choice", "evidence")
CLOSED = {"settled", "resolved"}
DONE_STATES = {"merged", "clean"}  # 🟣 and ⚫; ⚪ (standby) claims no finished work
NON_CLAUDE = ("codex/", "gemini/", "grok/", "agent/", "feat/", "copilot/", "fix/")


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_json(arg):
    return json.load(sys.stdin if arg == "-" else open(arg, encoding="utf-8"))


# ── Fold: the same reading as lib/kits/findings.js ────────────────────────────
def derived(cur):
    return "open" if (cur.get("next") or cur.get("choice")) else "settled"


def fold(notes):
    kids = {}
    for n in notes:
        if n.get("about", "").startswith("note:"):
            kids.setdefault(n["about"][5:], []).append(n)

    def flat(i):
        out = []
        for r in kids.get(i, []):
            out += [r] + flat(r["id"])
        return out

    found = []
    for root in notes:
        f0 = root.get("finding")
        if not isinstance(f0, dict) or root["about"].startswith("note:"):
            continue
        cur = {k: f0[k] for k in FIELDS if k in f0}
        explicit = f0.get("status") or ""
        assessed, comments, updates, title, did = root["at"], 0, 0, root["text"], ""
        for r in sorted(flat(root["id"]), key=lambda n: n["at"]):
            u = r.get("finding")
            if not isinstance(u, dict):
                comments += 1
                continue
            for k in FIELDS:
                if k in u:
                    cur[k] = u[k]
            explicit = u.get("status") or explicit
            assessed = r["at"]
            if u.get("title"):
                title = u["title"]
            if u.get("did"):
                did = u["did"]
            updates += 1
        status = explicit or derived(cur)
        subjects = list(dict.fromkeys([root["about"], *cur.get("subjects", [])]))
        is_open = status not in CLOSED
        found.append({"id": root["id"], "at": root["at"], "author": root["author"], "title": title,
                      **cur, "subjects": subjects, "status": status, "explicit": explicit, "open": is_open,
                      "outstanding": is_open and bool(cur.get("next") or cur.get("choice")),
                      "did": did, "assessedAt": assessed, "updates": updates, "comments": comments})
    return found


# ── Writing ──────────────────────────────────────────────────────────────────
def decision_errors(f):
    """A decision the owner must make goes to the owner in the reply (step 6 of
    the tend skill); a finding never asks it itself."""
    errs = []
    if str(f.get("choice") or "").strip():
        errs.append("a finding does not ask: put the decision to the owner in the reply (step 6 of the "
                    "tend skill)")
    return errs


def validate(f):
    errs = []
    if f.get("kind") not in KINDS:
        errs.append(f"kind {f.get('kind')!r} is not one of {', '.join(KINDS)} (extend KINDS to add one)")
    if not str(f.get("title", "")).strip():
        errs.append("a finding needs a title")
    subs = f.get("subjects") or []
    if not subs:
        errs.append("a finding needs at least one subject")
    for s in subs:
        if not note.is_locator(s):
            errs.append(f"subject is not a locator: {s!r}")
    if not str(f.get("why", "")).strip():
        errs.append("a finding needs a why")
    errs += decision_errors(f)
    if f.get("kind") != "superseded" and not str(f.get("next", "")).strip():
        errs.append("an open finding needs a next step")
    if f.get("kind") == "superseded" and not f.get("evidence"):
        errs.append("a superseded finding needs evidence: where the work landed or what overtook it")
    return errs


def add(repo, store, f, author):
    errs = validate(f)
    if errs:
        raise SystemExit("findings.py: " + f.get("title", "?") + "\n  " + "\n  ".join(errs))
    body = {k: f[k] for k in FIELDS if f.get(k) not in (None, "", [])}
    n = {"id": note.new_id(), "at": now(), "author": author, "about": f["subjects"][0],
         "text": f["title"].strip(), "finding": body}
    note.append(repo, store, n)
    return n["id"]


def update(repo, store, fid, u, author):
    prior = next((f for f in fold(note.read_notes(repo, store)) if f["id"] == fid), None)
    if not prior:
        raise SystemExit(f"findings.py: no finding {fid} on main")
    text = str(u.get("text", "")).strip()
    body = u.get("finding")
    if not text or not isinstance(body, dict):
        raise SystemExit('findings.py: an update is {"text": "what changed", "finding": {...}}; '
                         '"finding": {} confirms it as it stands')
    # Judge the finding this update leaves, inherited fields included: a step
    # done is progress, and the finding settles only when nothing remains.
    res = {**{k: prior.get(k) for k in FIELDS}, **{k: body[k] for k in FIELDS if k in body}}
    status = body.get("status") or prior["explicit"] or derived(res)
    left = [f"{k}: {str(res[k])[:60]!r}" for k in ("next", "choice") if res.get(k)]
    errs = []
    if status == "settled" and left:
        errs.append("this leaves the finding settled with work outstanding (" + "; ".join(left) + "). "
                    "Keep it open (status: \"open\") with `did` and the step that remains; "
                    "settle once next and choice are \"\"")
    if status == "resolved" and any(body.get(k) for k in ("next", "choice")):
        errs.append("the owner resolved this finding; renew attention with status: \"open\" to give it new work")
    if status not in CLOSED:
        errs += decision_errors({**res, "choice": body.get("choice")})
    if body.get("kind") and body["kind"] not in KINDS:
        errs.append(f"kind {body['kind']!r} is not one of {', '.join(KINDS)}")
    if errs:
        raise SystemExit("findings.py: " + "\n  ".join(errs))
    n = {"id": note.new_id(), "at": now(), "author": author, "about": f"note:{fid}", "text": text, "finding": body}
    note.append(repo, store, n)
    return n["id"]


# ── Subjects: what changed since the last assessment ─────────────────────────
def parse_ref(ref):
    """A subject as (kind, repo, at, path), read through note.py's patterns, as
    lib/kits/findings.js parse() reads it: a bare owner/repo is a repo."""
    m = note.PULL_RE.fullmatch(ref)
    if m:
        return "pr", m.group(1), int(m.group(2)), ""
    m = None if re.search(r"\s", ref) else note.REPO_RE.fullmatch(ref) or note.ADDR_RE.fullmatch(ref)
    if not m:
        return "unknown", "", "", ""
    repo, at = m.group(1), m.group(2) or ""
    if m.re is note.REPO_RE and not at:
        return "repo", repo, "", ""
    pin = note.PIN_RE.fullmatch(at)
    at = pin.group(2) if pin else at
    path = (m.group(3) if m.re is note.ADDR_RE else "").split("#")[0]
    return ("path" if path else "branch"), repo, at or "main", path


def stamp(t):
    """An ISO time as a comparable UTC datetime; a missing or unreadable one sorts first."""
    try:
        return datetime.fromisoformat(str(t).replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def checkouts(store_repo):
    """owner/repo -> local checkout, for the checkouts beside the store.
    FINDINGS_CHECKOUTS ({"owner/repo": "/path"}) names others, as a test does."""
    if os.environ.get("FINDINGS_CHECKOUTS"):
        return json.loads(os.environ["FINDINGS_CHECKOUTS"])
    out, base = {}, os.path.dirname(os.path.abspath(store_repo))
    for d in sorted(os.listdir(base)):
        p = os.path.join(base, d)
        r = subprocess.run(["git", "-C", p, "remote", "get-url", "origin"], capture_output=True, text=True)
        m = re.search(r"github\.com[/:]([\w.-]+/[\w.-]+?)(?:\.git)?/?$", r.stdout.strip())
        if r.returncode == 0 and m:
            out[m.group(1)] = p
    return out


_activity, _fetched = {}, set()


def activity(store_repo):
    """The crawl's cache, owner/repo -> its entry, read once from the store."""
    if store_repo not in _activity:
        r = note.git(store_repo, "show", "origin/main:state/activity.json", check=False)
        try:
            _activity[store_repo] = (json.loads(r.stdout).get("repos") or {}) if r.returncode == 0 else {}
        except ValueError:
            _activity[store_repo] = {}
    return _activity[store_repo]


def fetch(co, at):
    if (co, at) not in _fetched:
        note.git(co, "fetch", "-q", "origin", at, check=False)
        _fetched.add((co, at))


# ── Candidates: the mechanical half ──────────────────────────────────────────
def candidates(store_repo):
    act = json.loads(note.git(store_repo, "show", "origin/main:state/activity.json").stdout).get("repos") or {}
    ses = json.loads(note.git(store_repo, "show", "origin/main:state/sessions.json").stdout)
    rows = ses if isinstance(ses, list) else ses.get("rows") or []
    t = datetime.now(timezone.utc)
    age = lambda s: (t - datetime.fromisoformat(s.replace("Z", "+00:00"))).days if s else None
    pr_of, rows_of, reach, out = {}, {}, {}, []
    for repo, e in act.items():
        reach[repo] = e.get("prReach") or ""
        for p in e.get("branchPRs") or []:
            pr_of[(repo, p["head"])] = (p["state"], p["number"])
        for p in e.get("openPRs") or []:
            pr_of[(repo, p["head"])] = ("open", p["number"])
        for b in (e.get("scan") or {}).get("branches") or []:
            rows_of[(repo, b["name"])] = b
    full = {r.split("/")[1]: r for r in act}

    def add_c(signal, subjects, why):
        out.append({"signal": signal, "subjects": subjects, "why": why})

    def unlanded(repo, x, st):
        """Why this branch's work may not have landed, or None. "No PR" is a fact
        only inside the PR index's reach; past it, only a stranded scan speaks."""
        b = rows_of.get((repo, x["branch"]))
        if not b or not (x.get("lines") or 0) or st in ("merged", "closed"):
            return None
        if st == "open":
            return "its PR is still open"
        if b.get("date", "") >= reach.get(repo, ""):
            return "it never had a PR"
        if b.get("group") == "stranded" and b.get("nMissing"):
            return f"the scan finds {b['nMissing']} file(s) main lacks (PR history out of reach)"
        return None

    for r in rows:
        sid = f"mehrlander/web-tools-private:sessions/{r['day'][:4]}/{r['day'][5:7]}/{r['day']}-{r['id']}.json"
        branches = [x for x in r.get("repos") or [] if x.get("branch") and x["branch"] != "main"]
        states = {x["name"]: pr_of.get((full.get(x["name"], ""), x["branch"]), (None, None)) for x in branches}
        merged_somewhere = any(s == "merged" for s, _ in states.values())
        for x in branches:
            repo = full.get(x["name"], "mehrlander/" + x["name"])
            st, num = states[x["name"]]
            why = unlanded(repo, x, st)
            if not why:
                continue
            subjects = [f"{repo}@{x['branch']}", sid] + ([f"{repo}#{num}"] if num else [])
            if r.get("state") in DONE_STATES:
                add_c("said-finished", subjects, f"session ended {r['state']}, but {why}")
            elif merged_somewhere:
                add_c("half-landed", subjects, f"the session merged in another repo, but here {why}")
    for repo, e in act.items():
        for p in e.get("openPRs") or []:
            idle, loc = age(p.get("updatedAt")), f"{repo}#{p['number']}"
            if any(g in (p.get("body") or "") for g in ("🛵", "✴️")) and (idle or 0) >= 7:
                add_c("waiting-on-you", [loc], f"🛵 ask in the description, idle {idle}d")
            if (idle or 0) >= 30:
                add_c("sinking", [loc], f"idle {idle}d, {p.get('behindBy')} commits behind")
            if p["head"].startswith(NON_CLAUDE) and not p.get("draft") and (idle or 0) >= 3:
                add_c("unreviewed-lenovo", [loc], f"{p['head'].split('/')[0]} PR marked ready, idle {idle}d")
    return out, act


def subject_moved(s, since, act, local):
    """When subject `s` last changed after `since`, else ''. A pull request by
    its update time and a branch by its last commit, from the crawl's cache; a
    file, a user call or a session record by the last commit touching it, from
    a checkout beside the store. Anything else, or out of reach, reads ''. None
    means a shallow checkout cannot tell: its oldest commit seems to touch
    every file."""
    kind, repo, at, path = parse_ref(s)
    e, t = act.get(repo) or {}, ""
    if kind == "pr":
        p = next((p for p in (e.get("openPRs") or []) + (e.get("branchPRs") or []) if p.get("number") == at), None)
        t = (p or {}).get("updatedAt", "")
    elif kind == "branch":
        b = next((b for b in (e.get("scan") or {}).get("branches") or [] if b.get("name") == at), None)
        t = (b or {}).get("date", "")
    elif kind == "path" and local.get(repo):
        if note.git(local[repo], "rev-parse", "--is-shallow-repository", check=False).stdout.strip() == "true":
            return None
        fetch(local[repo], at)
        t = note.git(local[repo], "log", "-1", "--format=%cI", f"--since={since}", f"origin/{at}", "--", path,
                     check=False).stdout.strip()
    return t if t and stamp(t) > stamp(since) else ""


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--store", help="the notes folder, when the search would not find it")
    ap.add_argument("--author")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("candidates"); c.add_argument("--json", action="store_true")
    a = sub.add_parser("add"); a.add_argument("file")
    u = sub.add_parser("update"); u.add_argument("id"); u.add_argument("file")
    li = sub.add_parser("list"); li.add_argument("--all", action="store_true"); li.add_argument("--json", action="store_true")
    ch = sub.add_parser("check"); ch.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    repo, store = note.find_store(args.store)
    if args.cmd == "candidates":
        # A candidate is covered by a finding that names its branch or pull
        # request, settled or not, until that subject changes after the
        # finding's last assessment. A shared session record covers nothing:
        # one session's branches in two repos are two candidates.
        found = fold(note.read_notes(repo, store))
        cs, act = candidates(repo)
        for x in cs:
            x["covered"], x["moved"] = "", ""
            mine = [s for s in x["subjects"] if parse_ref(s)[0] in ("pr", "branch")]
            for f in found:
                hit = [s for s in mine if s in f["subjects"]]
                if hit:
                    x["covered"] = f["id"]
                    x["moved"] = next((m for s in hit for m in [subject_moved(s, f["assessedAt"], act, {})] if m), "")
                    break
        if args.json:
            print(json.dumps(cs, indent=1, ensure_ascii=False))
        else:
            for x in cs:
                mark = (f"  [reassess {x['covered']}: moved {x['moved'][:10]}]" if x["moved"]
                        else f"  [covered by {x['covered']}]" if x["covered"] else "")
                print(f"{x['signal']:18} {x['subjects'][0]}  {x['why']}{mark}")
            due = sum(1 for x in cs if not x["covered"] or x["moved"])
            print(f"{len(cs)} candidates, {due} to investigate or reassess")
    elif args.cmd == "add":
        author = args.author or note.default_author()
        data = load_json(args.file)
        for f in data if isinstance(data, list) else [data]:
            print(add(repo, store, f, author), f["title"])
    elif args.cmd == "update":
        print(update(repo, store, args.id, load_json(args.file), args.author or note.default_author()))
    else:
        found = fold(note.read_notes(repo, store))
        fs = [f for f in found if args.all or f["open"]] if args.cmd == "list" else [f for f in found if f["open"]]
        if args.cmd == "check":
            act, local = activity(repo), checkouts(repo)
            for f in fs:
                seen = {s: subject_moved(s, f["assessedAt"], act, local) for s in f["subjects"]}
                f["moved"] = [{"subject": s, "at": t} for s, t in seen.items() if t]
                f["unread"] = [s for s, t in seen.items() if t is None]
        if args.json:
            print(json.dumps(fs, indent=1, ensure_ascii=False))
            return
        for f in fs:
            due = " CHANGED" if f.get("moved") else ""
            print(f"{f['id']}  {f['status']:8} {f.get('kind', ''):10}{due}  {f['title']}")
            for m in f.get("moved", []):
                print(f"    {m['at'][:16]}  {m['subject']}")
        shallow = sorted({parse_ref(s)[1] for f in fs for s in f.get("unread", [])})
        if shallow:
            print("unread: file subjects in shallow clones of " + ", ".join(shallow)
                  + "; run git fetch --unshallow origin there and check again")


if __name__ == "__main__":
    main(sys.argv[1:])
