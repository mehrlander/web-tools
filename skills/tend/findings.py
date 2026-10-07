#!/usr/bin/env python3
"""Findings: what a tending pass concluded, stored as notes, and when to look again.

docs/views/tending.md states the record and its lifecycle; lib/kits/findings.js
folds and compares the same way, held to it by tools/test/findings.test.mjs.
`check` observes witnesses from the checkouts beside the store and the crawl's
cache, settled findings included.

Usage:
  findings.py candidates [--json]          mechanical selection: what to investigate
  findings.py add <file.json|->            one finding object, or a list of them
  findings.py update <id> <file.json|->    {"text": "what changed", "finding": {...}}
  findings.py list [--all] [--json]        folded findings, open unless --all
  findings.py check [--open] [--json]      witness verdicts for every finding (open only with --open)
  findings.py vectors <file.json>          compare() over shared cases, for the parity test
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
FIELDS = ("kind", "subjects", "why", "next", "choice", "evidence", "witnesses")
CLOSED = {"settled", "resolved"}
DONE_STATES = {"merged", "done", "clean"}
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
        assessed, comments, updates, title, did, acks = root["at"], 0, 0, root["text"], "", {}
        for r in sorted(flat(root["id"]), key=lambda n: n["at"]):
            u = r.get("finding")
            if not isinstance(u, dict):
                comments += 1
                continue
            for k in FIELDS:
                if k in u:
                    cur[k] = u[k]
            explicit = u.get("status") or explicit
            if "witnesses" in u:
                assessed, acks = r["at"], {}
            for a in u.get("ack") or []:
                if isinstance(a, dict) and a.get("ref"):
                    acks[a["ref"]] = a.get("seen")
            if u.get("title"):
                title = u["title"]
            if u.get("did"):
                did = u["did"]
            updates += 1
        status = explicit or derived(cur)
        subjects = list(dict.fromkeys([root["about"], *cur.get("subjects", [])]))
        is_open = status not in CLOSED
        if isinstance(cur.get("witnesses"), list):
            cur["witnesses"] = [{**w, "ack": acks[w.get("ref")]} if isinstance(w, dict) and acks.get(w.get("ref")) else w
                                for w in cur["witnesses"]]
        found.append({"id": root["id"], "at": root["at"], "author": root["author"], "title": title,
                      **cur, "subjects": subjects, "status": status, "explicit": explicit, "open": is_open,
                      "outstanding": is_open and bool(cur.get("next") or cur.get("choice")),
                      "did": did, "assessedAt": assessed, "updates": updates, "comments": comments})
    return found


# ── Writing ──────────────────────────────────────────────────────────────────
def witness_errors(w):
    ref = str(w.get("ref", ""))
    if not note.LOCATOR.match(ref):
        return [f"witness ref is not a locator: {ref!r}"]
    kind, repo, at, path = parse_ref(ref)
    if kind == "pr" and not w.get("state"):
        return [f"{ref}: a pull request witness records its state"]
    if kind == "path" and not w.get("sha"):
        return [f"{ref}: pin the object (git rev-parse origin/<ref>:<path>), so a change made before recording still shows"]
    if kind == "branch" and not (w.get("sha") or w.get("contains")):
        return [f"{ref}: pin the tip with sha, or what it must contain with contains"]
    if kind == "branch" and w.get("sha") and at in ("main", "master"):
        return [f"{ref}: main moves on every merge; pin what it must contain with contains, not its tip"]
    return []


USER_CALL = re.compile(r"^[\w.-]+/[\w.-]+(?:@[^\s:]+)?:user-calls/[\w.-]+\.json$")


def decision_errors(f):
    """A decision the owner must make is a user call, read and answered in the
    Waiting view; a finding names it as a subject and never asks it itself."""
    errs = []
    if str(f.get("choice") or "").strip():
        errs.append("a finding does not ask: file the decision as a user call (user-calls/user-call.py in the "
                    "registry) and name it among the subjects")
    if f.get("kind") == "answer" and not any(USER_CALL.match(s) for s in f.get("subjects") or []):
        errs.append("an answer finding names its user call among its subjects")
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
        if not note.LOCATOR.match(s):
            errs.append(f"subject is not a locator: {s!r}")
    if not str(f.get("why", "")).strip():
        errs.append("a finding needs a why")
    errs += decision_errors(f)
    if f.get("kind") != "superseded" and not str(f.get("next", "")).strip():
        errs.append("an open finding needs a next step")
    if f.get("kind") == "superseded" and not (f.get("evidence") or f.get("witnesses")):
        errs.append("a superseded finding needs evidence or witnesses, so it can be checked")
    for w in f.get("witnesses") or []:
        errs += witness_errors(w)
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
    body = u.get("finding") or {}
    if not text or not isinstance(body, dict) or not body:
        raise SystemExit('findings.py: an update is {"text": "what changed", "finding": {...}}')
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
    errs += [e for w in body.get("witnesses") or [] for e in witness_errors(w)]
    if body.get("kind") and body["kind"] not in KINDS:
        errs.append(f"kind {body['kind']!r} is not one of {', '.join(KINDS)}")
    if errs:
        raise SystemExit("findings.py: " + "\n  ".join(errs))
    n = {"id": note.new_id(), "at": now(), "author": author, "about": f"note:{fid}", "text": text, "finding": body}
    note.append(repo, store, n)
    return n["id"]


# ── Witnesses: observe, then compare ─────────────────────────────────────────
def parse_ref(ref):
    m = re.match(r"^([\w.-]+/[\w.-]+)#(\d+)$", ref)
    if m:
        return "pr", m.group(1), int(m.group(2)), ""
    m = re.match(r"^([\w.-]+/[\w.-]+)(?:@([^\s:]+))?(?::(\S+))?$", ref)
    if not m:
        return "unknown", "", "", ""
    repo, at, path = m.group(1), m.group(2) or "", (m.group(3) or "").split("#")[0]
    return ("path" if path else "branch"), repo, at or "main", path


def same(a, b):
    return bool(a) and bool(b) and (a.startswith(b) or b.startswith(a))


def compare(w, seen):
    """The rule lib/kits/findings.js compare() states, line for line."""
    v = pinned(w, seen)
    if v[0] in ("changed", "broken") and acknowledged(w, seen):
        return "ok", "as it was when handled"
    return v


def acknowledged(w, seen):
    a = w.get("ack")
    if not isinstance(a, dict) or not seen or seen.get("error"):
        return False
    if a.get("missing") or seen.get("missing"):
        return bool(a.get("missing")) and bool(seen.get("missing"))
    kind = parse_ref(str(w.get("ref", "")))[0]
    if kind == "branch" and w.get("contains"):
        return a.get("contained") == bool(seen.get("contained"))
    if kind == "pr":
        return a.get("state") == seen.get("state") and (
            seen.get("state") != "open" or not seen.get("updated") or not a.get("updated") or seen["updated"] <= a["updated"])
    now = seen.get("sha") or ((seen.get("commits") or [{}])[0] or {}).get("sha")
    return same(a.get("sha") or "", now or "")


def pinned(w, seen):
    kind, repo, at, path = parse_ref(str(w.get("ref", "")))
    if kind == "branch" and w.get("contains"):
        kind = "contains"
    if not seen or seen.get("error"):
        return "unverifiable", (seen or {}).get("error", "")
    if kind == "branch":
        if seen.get("missing"):
            return "broken", "the branch is gone"
        if not w.get("sha") or not seen.get("sha"):
            return "unverifiable", "no pinned tip"
        return ("ok", "") if same(w["sha"], seen["sha"]) else ("changed", "tip is now " + seen["sha"][:7])
    if kind == "contains":
        if seen.get("missing"):
            return "broken", "the ref or commit is gone"
        return ("ok", "") if seen.get("contained") else ("changed", f"{at} no longer contains {str(w['contains'])[:7]}")
    if kind == "path":
        if seen.get("missing"):
            return "broken", "the path is gone"
        if w.get("sha"):
            if not seen.get("sha"):
                return "unverifiable", "no current object"
            if same(w["sha"], seen["sha"]):
                return "ok", ""
            return "changed", "now " + seen["sha"][:7] + (", " + seen["detail"] if seen.get("detail") else "")
        c = (seen.get("commits") or [None])[0]
        return ("changed", "changed by " + str(c["sha"])[:7] + (": " + c["message"] if c.get("message") else "")) if c else ("ok", "")
    if kind == "pr":
        if not seen.get("state"):
            return "unverifiable", ""
        if w.get("state") and w["state"] != seen["state"]:
            return "changed", "now " + seen["state"]
        if seen["state"] == "open" and w.get("updated") and seen.get("updated") and seen["updated"] > w["updated"]:
            return "changed", "updated " + seen["updated"][:10]
        return "ok", ""
    return "unverifiable", "unreadable ref"


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


def activity(repo, store_repo):
    if store_repo not in _activity:
        r = note.git(store_repo, "show", "origin/main:state/activity.json", check=False)
        try:
            _activity[store_repo] = (json.loads(r.stdout).get("repos") or {}) if r.returncode == 0 else {}
        except ValueError:
            _activity[store_repo] = {}
    return _activity[store_repo].get(repo)


def fetch(co, at):
    if (co, at) not in _fetched:
        note.git(co, "fetch", "-q", "origin", at, check=False)
        _fetched.add((co, at))


def observe(w, assessed, local, store_repo):
    """What holds now for one witness, in the shape the browser observes."""
    kind, repo, at, path = parse_ref(str(w.get("ref", "")))
    co = local.get(repo)
    if kind == "pr":
        a = activity(repo, store_repo)
        if a is None:
            return {"error": "repo not in the activity cache"}
        hit = next((p for p in (a.get("openPRs") or []) if p.get("number") == at), None)
        if hit:
            return {"state": "open", "updated": hit.get("updatedAt", "")}
        hit = next((p for p in (a.get("branchPRs") or []) if p.get("number") == at and p.get("state") != "open"), None)
        if hit:
            return {"state": hit.get("state"), "updated": hit.get("updatedAt", "")}
        # Absence from the cache establishes nothing about the current state:
        # the view reads it from GitHub, and a session through the GitHub MCP.
        return {"error": "not in the crawl cache"}
    if not co:
        if kind == "branch" and not w.get("contains"):
            r = subprocess.run(["git", "ls-remote", f"https://github.com/{repo}", f"refs/heads/{at}"],
                               capture_output=True, text=True)
            if r.returncode == 0:
                sha = (r.stdout.split() or [""])[0]
                return {"sha": sha} if sha else {"missing": True}
        return {"error": f"{repo} is not checked out beside the store"}
    if kind == "branch" and not w.get("contains"):
        r = subprocess.run(["git", "-C", co, "ls-remote", "origin", f"refs/heads/{at}"], capture_output=True, text=True)
        if r.returncode:
            return {"error": r.stderr.strip()[:80]}
        sha = (r.stdout.split() or [""])[0]
        return {"sha": sha} if sha else {"missing": True}
    fetch(co, at)
    if note.git(co, "rev-parse", "--verify", "-q", f"origin/{at}", check=False).returncode:
        return {"missing": True}
    if kind == "branch":   # contains
        if note.git(co, "cat-file", "-e", f"{w['contains']}^{{commit}}", check=False).returncode:
            # A shallow clone never fetched the older commits, so an absent one
            # there means "cannot see", not "gone" (docs/SNAGS.md
            # shallow-clone-reads-as-gone).
            if note.git(co, "rev-parse", "--is-shallow-repository", check=False).stdout.strip() == "true":
                return {"error": f"{repo} is a shallow clone; run git fetch --unshallow origin in it"}
            return {"missing": True}
        anc = note.git(co, "merge-base", "--is-ancestor", w["contains"], f"origin/{at}", check=False).returncode
        return {"contained": anc == 0}
    if kind == "path":
        if not w.get("sha"):
            log = note.git(co, "log", "--format=%H%x09%s", f"--since={assessed}", f"origin/{at}", "--", path, check=False)
            rows = [l.split("\t", 1) for l in log.stdout.splitlines() if l.strip()]
            return {"commits": [{"sha": s, "message": m} for s, m in rows]}
        r = note.git(co, "rev-parse", f"origin/{at}:{path}", check=False)
        if r.returncode:
            return {"missing": True}
        sha = r.stdout.strip()
        detail = ""
        if not same(sha, w["sha"]):
            last = note.git(co, "log", "-1", "--format=%h %s", f"origin/{at}", "--", path, check=False).stdout.strip()
            detail = ("last touched by " + last[:80]) if last else ""
        return {"sha": sha, "detail": detail}
    return {"error": "unreadable ref"}


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
    return out, act


def subject_moved(s, since, act):
    """When a subject itself moved after `since`, per the activity cache, else ''."""
    m = re.match(r"^([\w.-]+/[\w.-]+)(?:#(\d+)|@([^\s:]+))$", s)
    if not m or m.group(1) not in act:
        return ""
    e = act[m.group(1)]
    if m.group(2):
        n = int(m.group(2))
        p = next((p for p in (e.get("openPRs") or []) + (e.get("branchPRs") or []) if p.get("number") == n), None)
        return p.get("updatedAt", "") if p and p.get("updatedAt", "") > since else ""
    b = next((b for b in (e.get("scan") or {}).get("branches") or [] if b["name"] == m.group(3)), None)
    return b.get("date", "") if b and b.get("date", "") > since else ""


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--store", help="the notes folder, when the search would not find it")
    ap.add_argument("--author")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("candidates"); c.add_argument("--json", action="store_true")
    a = sub.add_parser("add"); a.add_argument("file")
    u = sub.add_parser("update"); u.add_argument("id"); u.add_argument("file")
    li = sub.add_parser("list"); li.add_argument("--all", action="store_true"); li.add_argument("--json", action="store_true")
    ch = sub.add_parser("check"); ch.add_argument("--open", action="store_true"); ch.add_argument("--json", action="store_true")
    v = sub.add_parser("vectors"); v.add_argument("file")
    args = ap.parse_args(argv)

    if args.cmd == "vectors":
        cases = load_json(args.file)["cases"]
        print(json.dumps([{"name": x["name"], "verdict": compare(x["witness"], x["seen"])[0]} for x in cases]))
        return

    repo, store = note.find_store(args.store)
    if args.cmd == "candidates":
        # A candidate some finding already names is covered only while that
        # finding still holds: if a subject moved after the assessment, the
        # finding is due again, settled or not. `check` covers witnesses.
        found = fold(note.read_notes(repo, store))
        cs, act = candidates(repo)
        for x in cs:
            x["covered"], x["moved"] = "", ""
            for f in found:
                hit = [s for s in x["subjects"] if s in f["subjects"]]
                if hit:
                    x["covered"] = f["id"]
                    x["moved"] = next((m for s in hit for m in [subject_moved(s, f["assessedAt"], act)] if m), "")
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
        if args.cmd == "list":
            fs = [f for f in found if args.all or f["open"]]
        else:
            fs = [f for f in found if f["open"] or not args.open]
            local = checkouts(repo)
            for f in fs:
                f["verdicts"] = []
                for w in f.get("witnesses") or []:
                    verdict, detail = compare(w, observe(w, f["assessedAt"], local, repo))
                    f["verdicts"].append({"ref": w.get("ref"), "verdict": verdict, "detail": detail})
                f["moved"] = [v for v in f["verdicts"] if v["verdict"] in ("changed", "broken")]
        if args.json:
            print(json.dumps(fs, indent=1, ensure_ascii=False))
            return
        for f in fs:
            due = " REASSESS" if f.get("moved") else ""
            print(f"{f['id']}  {f['status']:8} {f.get('kind', ''):10}{due}  {f['title']}")
            for v in f.get("verdicts", []):
                if v["verdict"] != "ok":
                    print(f"    {v['verdict']:12} {v['ref']}  {v['detail']}")


if __name__ == "__main__":
    main(sys.argv[1:])
