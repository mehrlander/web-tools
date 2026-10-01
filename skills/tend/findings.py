#!/usr/bin/env python3
"""Findings: what a tending pass concluded, stored as notes, and when to look again.

A finding is a note (skills/notes/note.py) carrying a `finding` object:

  {"id": "n…", "at": "…", "author": "…", "about": "<first subject>", "text": "<title>",
   "finding": {"kind": "unreached|answer|overlap|settled|…", "subjects": [...],
               "why": "…", "next": "…", "choice": "…", "evidence": [...],
               "witnesses": [{"ref": "<locator>", "sha"|"state"|"updated": "…", "why": "…"}]}}

A finding changes only through a reply that carries `finding` (`update` below,
or the owner's resolution from the Tending view). A reply without it is a
comment and never changes status. lib/kits/findings.js is the browser's half
and folds the same way.

Witnesses are what the conclusion rests on, pinned (docs/locators.md): a branch
tip, a file or folder on a ref, a pull request's state. `check` compares each
with what holds now, so a pass knows which findings to reassess even when the
subject branch has not moved.

Usage:
  findings.py candidates [--json]          mechanical selection: what to investigate
  findings.py add <file.json|->            one finding object, or a list of them
  findings.py update <id> <file.json|->    {"text": "what changed", "finding": {...}}; "title" in it retitles
  findings.py list [--all] [--json]        folded findings, open unless --all
  findings.py check [--all] [--json]       witness verdicts: ok, changed, broken, unverifiable
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

KINDS = ("answer", "unreached", "overlap", "settled")
FIELDS = ("kind", "subjects", "why", "next", "choice", "evidence", "witnesses")
CLOSED = {"settled", "resolved"}
DONE_STATES = {"merged", "done", "clean"}
NON_CLAUDE = ("codex/", "gemini/", "grok/", "agent/", "feat/", "copilot/", "fix/")


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_json(arg):
    return json.load(sys.stdin if arg == "-" else open(arg, encoding="utf-8"))


# ── Fold: the same reading as lib/kits/findings.js ────────────────────────────
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
        status = f0.get("status") or ("settled" if cur.get("kind") == "settled" else "open")
        assessed, comments, updates, title = root["at"], [], [], root["text"]
        for r in sorted(flat(root["id"]), key=lambda n: n["at"]):
            u = r.get("finding")
            if not isinstance(u, dict):
                comments.append(r)
                continue
            for k in FIELDS:
                if k in u:
                    cur[k] = u[k]
            status = u.get("status") or ("settled" if u.get("kind") == "settled" else status)
            if "witnesses" in u:
                assessed = r["at"]
            if u.get("title"):
                title = u["title"]
            updates.append(r)
        subjects = list(dict.fromkeys([root["about"], *cur.get("subjects", [])]))
        found.append({"id": root["id"], "at": root["at"], "author": root["author"], "title": title,
                      **cur, "subjects": subjects, "status": status, "open": status not in CLOSED,
                      "assessedAt": assessed, "updates": len(updates), "comments": len(comments)})
    return found


# ── Writing ──────────────────────────────────────────────────────────────────
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
        if not note.LOCATOR.match(s):
            errs.append(f"subject is not a locator: {s!r}")
    if not str(f.get("why", "")).strip():
        errs.append("a finding needs a why")
    if f.get("kind") != "settled" and not str(f.get("next", "")).strip():
        errs.append("an open finding needs a recommended next step")
    if f.get("kind") == "settled" and not (f.get("evidence") or f.get("witnesses")):
        errs.append("a settled finding needs evidence or witnesses, so it can be checked")
    for w in f.get("witnesses") or []:
        if not note.LOCATOR.match(str(w.get("ref", ""))):
            errs.append(f"witness ref is not a locator: {w.get('ref')!r}")
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
    if fid not in {n["id"] for n in note.read_notes(repo, store)}:
        raise SystemExit(f"findings.py: no note {fid} on main")
    text = str(u.get("text", "")).strip()
    body = u.get("finding") or {}
    if not text or not isinstance(body, dict) or not body:
        raise SystemExit('findings.py: an update is {"text": "what changed", "finding": {...}}')
    n = {"id": note.new_id(), "at": now(), "author": author, "about": f"note:{fid}", "text": text, "finding": body}
    note.append(repo, store, n)
    return n["id"]


# ── Witnesses ────────────────────────────────────────────────────────────────
def checkouts(store_repo):
    """owner/repo -> local checkout, for the checkouts beside the store."""
    out, base = {}, os.path.dirname(os.path.abspath(store_repo))
    for d in sorted(os.listdir(base)):
        p = os.path.join(base, d)
        r = subprocess.run(["git", "-C", p, "remote", "get-url", "origin"], capture_output=True, text=True)
        m = re.search(r"github\.com[/:]([\w.-]+/[\w.-]+?)(?:\.git)?/?$", r.stdout.strip())
        if r.returncode == 0 and m:
            out[m.group(1)] = p
    return out


def activity(repo, store_repo):
    r = note.git(store_repo, "show", "origin/main:state/activity.json", check=False)
    try:
        return (json.loads(r.stdout).get("repos") or {}).get(repo, {}) if r.returncode == 0 else {}
    except ValueError:
        return {}


def parse_ref(ref):
    m = re.match(r"^([\w.-]+/[\w.-]+)#(\d+)$", ref)
    if m:
        return "pr", m.group(1), int(m.group(2)), ""
    m = re.match(r"^([\w.-]+/[\w.-]+)(?:@([^\s:]+))?(?::(\S+))?$", ref)
    if not m:
        return "unknown", "", "", ""
    repo, at, path = m.group(1), m.group(2) or "", (m.group(3) or "").split("#")[0]
    return ("path" if path else "branch"), repo, at or "main", path


def check_witness(w, assessed, local, store_repo):
    kind, repo, at, path = parse_ref(str(w.get("ref", "")))
    co = local.get(repo)
    if kind == "pr":
        a = activity(repo, store_repo)
        hit = next((p for p in (a.get("openPRs") or []) if p.get("number") == at), None)
        state = ("open" if hit else None)
        hit = hit or next((p for p in (a.get("branchPRs") or []) if p.get("number") == at), None)
        if not hit:
            # Merged is the one state a pull request never leaves, so a witness
            # that recorded it holds even past the cache's PR index.
            if w.get("state") == "merged":
                return "ok", "merged, which is final"
            return "unverifiable", "not in the activity cache's PR index"
        state = state or hit.get("state")
        if w.get("state") and state and w["state"] != state:
            return "changed", f"now {state}"
        if w.get("updated") and hit.get("updatedAt", "") > w["updated"]:
            return "changed", f"updated {hit['updatedAt'][:10]}"
        return "ok", ""
    if kind == "branch":
        target = co or f"https://github.com/{repo}"
        r = subprocess.run(["git", "-C", co, "ls-remote", "origin", f"refs/heads/{at}"] if co
                           else ["git", "ls-remote", target, f"refs/heads/{at}"], capture_output=True, text=True)
        if r.returncode:
            return "unverifiable", r.stderr.strip()[:80]
        sha = (r.stdout.split() or [""])[0]
        if not sha:
            return "broken", "the branch is gone"
        if w.get("sha") and not (sha.startswith(w["sha"]) or w["sha"].startswith(sha)):
            return "changed", f"tip is now {sha[:7]}"
        return "ok", ""
    if kind == "path":
        if not co:
            return "unverifiable", f"{repo} is not checked out beside the store"
        note.git(co, "fetch", "-q", "origin", at, check=False)
        r = note.git(co, "rev-parse", f"origin/{at}:{path}", check=False)
        if r.returncode:
            return "broken", "the path is gone"
        if w.get("sha"):
            sha = r.stdout.strip()
            return ("ok", "") if sha.startswith(w["sha"]) or w["sha"].startswith(sha) else ("changed", f"now {sha[:7]}")
        log = note.git(co, "log", "-1", "--format=%h %s", f"--since={assessed}", f"origin/{at}", "--", path, check=False)
        return ("changed", log.stdout.strip()) if log.stdout.strip() else ("ok", "")
    return "unverifiable", "unreadable ref"


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
            if "✴️" in (p.get("body") or "") and (idle or 0) >= 7:
                add_c("waiting-on-you", [loc], f"✴️ ask in the description, idle {idle}d")
            if (idle or 0) >= 30:
                add_c("sinking", [loc], f"idle {idle}d, {p.get('behindBy')} commits behind")
            if p["head"].startswith(NON_CLAUDE) and not p.get("draft") and (idle or 0) >= 3:
                add_c("unreviewed-laptop", [loc], f"{p['head'].split('/')[0]} PR marked ready, idle {idle}d")
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--store", help="the notes folder, when the search would not find it")
    ap.add_argument("--author")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("candidates"); c.add_argument("--json", action="store_true")
    a = sub.add_parser("add"); a.add_argument("file")
    u = sub.add_parser("update"); u.add_argument("id"); u.add_argument("file")
    li = sub.add_parser("list"); li.add_argument("--all", action="store_true"); li.add_argument("--json", action="store_true")
    ch = sub.add_parser("check"); ch.add_argument("--all", action="store_true"); ch.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    repo, store = note.find_store(args.store)

    if args.cmd == "candidates":
        # A candidate some finding already names is covered: reassess it through
        # `check`, not by investigating it again from scratch.
        cover = {}
        for f in fold(note.read_notes(repo, store)):
            for s in f["subjects"]:
                cover.setdefault(s, f["id"])
        cs = candidates(repo)
        for x in cs:
            x["covered"] = next((cover[s] for s in x["subjects"] if s in cover), "")
        if args.json:
            print(json.dumps(cs, indent=1, ensure_ascii=False))
        else:
            for x in cs:
                mark = f"  [covered by {x['covered']}]" if x["covered"] else ""
                print(f"{x['signal']:18} {x['subjects'][0]}  {x['why']}{mark}")
            print(f"{len(cs)} candidates, {sum(1 for x in cs if not x['covered'])} not yet covered by a finding")
    elif args.cmd == "add":
        author = args.author or note.default_author()
        data = load_json(args.file)
        for f in data if isinstance(data, list) else [data]:
            print(add(repo, store, f, author), f["title"])
    elif args.cmd == "update":
        print(update(repo, store, args.id, load_json(args.file), args.author or note.default_author()))
    else:
        fs = [f for f in fold(note.read_notes(repo, store)) if args.all or f["open"]]
        if args.cmd == "check":
            local = checkouts(repo)
            for f in fs:
                f["verdicts"] = [dict(zip(("ref", "verdict", "detail"), (w.get("ref"), *check_witness(w, f["assessedAt"], local, repo))))
                                 for w in f.get("witnesses") or []]
        if args.json:
            print(json.dumps(fs, indent=1, ensure_ascii=False))
            return
        for f in fs:
            print(f"{f['id']}  {f['status']:8} {f.get('kind', ''):9}  {f['title']}")
            for v in f.get("verdicts", []):
                if v["verdict"] != "ok":
                    print(f"    {v['verdict']:12} {v['ref']}  {v['detail']}")


if __name__ == "__main__":
    main(sys.argv[1:])
