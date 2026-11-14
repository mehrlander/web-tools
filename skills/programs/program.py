#!/usr/bin/env python3
"""What a declared program's manager reports from, gathered the same way each run.

A program is declared under `programs` in a checkout's .web-tools.json
(docs/CONSTELLATION.md, "Projects and research"). This reads the declaration
and collects what needs no judgment: commits to the governed files since the
program's last note (a generator-written registry left out, and a warning
where the checkout's history is shallower than the window), its open tasks, the snags whose targets include a governed
file, the notes addressed to the charter (the README.md of the program's folder,
or of a folder the declaration's `formerly` names) or a governed file, and each measure's
summary. Reading it is the session's job.

  python3 program.py list
  python3 program.py report <name> [--since YYYY-MM-DD]

The declaring checkout is the working directory's repository when it declares
programs, else the first child or sibling that does. The notes store, and the
snag list in the same checkout, are found as note.py finds the store.

A measure is a repo-root-relative path or an 'owner/repo[@ref]:path' locator
into a checkout beside this one, read at origin's ref (main by default). A JSON measure may hold "summary" ({"columns": [...],
"rows": [[...]]} or a flat {metric: value} object) and "caveats" ([...]); those are printed first.
"""
import argparse
import csv
import io
import json
import os
import posixpath
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "notes"))
import note  # noqa: E402  (skills/notes/note.py, the notes store's one reader and writer)


def git(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, encoding="utf-8", errors="replace")


def git_blobs(repo, specs):
    if not specs:
        return {}
    res = subprocess.run(["git", "-C", repo, "cat-file", "--batch"],
                         input=("\n".join(specs) + "\n").encode("utf-8"), capture_output=True)
    buf, pos, out = res.stdout, 0, {}
    for spec in specs:
        nl = buf.find(b"\n", pos)
        if nl == -1:
            break
        hdr = buf[pos:nl].decode("utf-8", errors="replace")
        pos = nl + 1
        if hdr.endswith(" missing"):
            out[spec] = ""
            continue
        size = int(hdr.split()[2])
        out[spec] = buf[pos:pos + size].decode("utf-8", errors="replace")
        pos += size + 1
    return out


def declared(repo):
    try:
        with open(os.path.join(repo, ".web-tools.json"), encoding="utf-8") as fh:
            progs = json.load(fh).get("programs")
    except (OSError, ValueError):
        return None
    return progs if isinstance(progs, list) and progs else None


def find_checkout():
    here = git(os.getcwd(), "rev-parse", "--show-toplevel").stdout.strip() or os.getcwd()
    cands = [here]
    for base in (here, os.path.dirname(here)):
        try:
            cands += [os.path.join(base, d) for d in sorted(os.listdir(base))]
        except OSError:
            pass
    for repo in cands:
        if os.path.isdir(repo) and declared(repo):
            return repo
    raise SystemExit("program.py: no checkout here or beside it declares programs in .web-tools.json")


def slug(repo):
    url = git(repo, "remote", "get-url", "origin").stdout.strip().removesuffix(".git")
    parts = [p for p in url.replace(":", "/").split("/") if p]
    return "/".join(parts[-2:]) if len(parts) >= 2 else os.path.basename(repo)


def sibling(repo, name):
    path = os.path.join(os.path.dirname(repo), name.split("/")[-1])
    return path if os.path.isdir(path) else None


def parse_time(text):
    try:
        t = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def complete_from(repo):
    """The date from which a shallow checkout holds every commit on origin/main,
    or None for a full one: the newest commit at which its history was cut."""
    if git(repo, "rev-parse", "--is-shallow-repository").stdout.strip() != "true":
        return None
    try:
        with open(os.path.join(repo, git(repo, "rev-parse", "--git-path", "shallow").stdout.strip())) as fh:
            cuts = fh.read().split()
    except OSError:
        return None
    dates = [parse_time(git(repo, "log", "-1", "--format=%cI", c).stdout.strip()) for c in cuts
             if git(repo, "merge-base", "--is-ancestor", c, "origin/main").returncode == 0]
    return max((d for d in dates if d), default=None)


def generator_written(repo, governs):
    """The governed files a generator writes whole: registries whose every
    column is `computed` in docs/properties.csv (docs/registries.md). A commit
    to one records another file's change, so it is no change to the program."""
    def rows(path):
        return list(csv.DictReader(io.StringIO(git(repo, "show", f"origin/main:{path}").stdout)))
    modes = {}
    for r in rows("docs/properties.csv"):
        modes.setdefault(r.get("registry"), set()).add(r.get("mode"))
    paths = {r.get("path") for r in rows("docs/registries.csv") if modes.get(r.get("id")) == {"computed"}}
    return [g for g in governs if g in paths]


def target_matcher(me, paths):
    """Compiled regex matching repo-relative governed paths (or me:path), while
    ignoring URL path segments, other repos' locators, and sibling prefixes."""
    alts = []
    for p in paths:
        if not p:
            continue
        if p.endswith("/"):
            stem = p.rstrip("/")
            if "/" in stem:
                alts.append(re.escape(stem) + r"(?:/|(?![A-Za-z0-9_.-]))")
            else:
                alts.append(re.escape(p))
        else:
            alts.append(re.escape(p) + r"(?![A-Za-z0-9_.-])")
    if not alts:
        return None
    prefix = rf"(?:(?<![A-Za-z0-9_./:-])|(?<=\.\./)|(?<={re.escape(me)}:))"
    return re.compile(prefix + "(?:" + "|".join(alts) + ")")


def open_program_tasks(repo, me, prog, governs, charter_path):
    tracker = ""
    try:
        with open(os.path.join(repo, ".web-tools.json"), encoding="utf-8") as fh:
            tracker = json.load(fh).get("tracker") or ""
    except (OSError, ValueError):
        pass
    if not tracker.endswith(".md"):
        return []
    stem = tracker.removesuffix(".md")
    tdir = posixpath.dirname(tracker)
    blobs = git_blobs(repo, [f"origin/main:{stem}.csv", f"origin/main:{stem}-tags.csv"])
    board = blobs.get(f"origin/main:{stem}.csv") or ""
    if not board:
        return []
    prog_names = {prog["name"]} | {old.rstrip("/").split("/")[-1] for old in prog.get("formerly") or [] if old.strip("/")}
    tagged = set()
    for tr in csv.DictReader(io.StringIO(blobs.get(f"origin/main:{stem}-tags.csv") or "")):
        if (tr.get("tag") or "").strip() in ("program", "programs"):
            vals = {v for v in re.split(r"[,\s;]+", (tr.get("value") or "").strip()) if v}
            if vals & prog_names and tr.get("task"):
                tagged.add(tr["task"])
    candidates = [r for r in csv.DictReader(io.StringIO(board)) if r.get("status") not in ("done", "dormant")]
    rx = target_matcher(me, [charter_path, *(f"{old.rstrip('/')}/README.md" for old in prog.get("formerly") or []), *governs])
    need_body = []
    for r in candidates:
        if (r.get("project") or "").strip() in prog_names or r.get("id") in tagged:
            continue
        href = (r.get("href") or "").strip()
        if rx and href:
            rel = posixpath.normpath(posixpath.join(tdir, href)) if tdir else posixpath.normpath(href)
            need_body.append((r["id"], f"origin/main:{rel}"))
    task_blobs = git_blobs(repo, [spec for _, spec in need_body]) if need_body else {}
    body_by_id = {tid: task_blobs.get(spec, "") for tid, spec in need_body}
    matched = []
    for r in candidates:
        if (r.get("project") or "").strip() in prog_names or r.get("id") in tagged:
            matched.append(r)
        elif rx:
            haystack = "\n".join([r.get("title") or "", r.get("awaiting") or "", body_by_id.get(r.get("id"), "")])
            if rx.search(haystack):
                matched.append(r)
    return matched


def table(columns, rows):
    out = ["| " + " | ".join(columns) + " |", "| " + " | ".join("---" for _ in columns) + " |"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def report(repo, prog, since):
    me = slug(repo)
    governs = prog.get("governs") or []
    charter_path = f"{prog['path']}/README.md"
    charter = f"{me}:{charter_path}"
    # A program that moved folders keeps its notes: a note addressed to the
    # charter under a folder `formerly` names counts as addressed to this one.
    charters = {charter} | {f"{me}:{old.rstrip('/')}/README.md" for old in prog.get("formerly") or []}
    subjects = charters | {f"{me}:{g}" for g in governs}

    def about_program(locator):
        # A locator names the program when it is the charter or a governed
        # path, or sits under a governed folder (an entry ending in /).
        loc = (locator or "").split("#")[0]
        return loc in subjects or any(s.endswith("/") and loc.startswith(s) for s in subjects)
    print(f"# {prog.get('label') or prog['name']}: program report\n")
    print(f"Charter: `{charter_path}` · {len(governs)} governed paths\n")

    try:
        store_repo, store = note.find_store(None)
        notes = sorted((n for n in note.read_notes(store_repo, store)
                        if about_program(n.get("about"))), key=lambda n: n["at"])
    except SystemExit as e:
        store_repo, notes = None, None
        print(f"Notes: unavailable ({e})\n")
    if not since:
        last = [n["at"] for n in notes or [] if n.get("about", "").split("#")[0] in charters]
        # The note's full timestamp: git reads a bare date as that day at the
        # current clock time, which drops the commits made earlier that day.
        since = last[-1] if last else (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    print(f"## Changes to governed files since {since}\n")
    # Each commit with the files it touched, so the count can be read per
    # governed entry: a month of a broad program runs to hundreds of commits.
    cut, start = complete_from(repo), parse_time(since)
    if cut and start and start < cut:
        print(f"This checkout's history is shallow and complete only from {cut.date()}, so earlier "
              f"commits are missing from the counts below. `git fetch --shallow-since={since[:10]} origin main` deepens it.\n")
    generated = generator_written(repo, governs)
    counted = [g for g in governs if g not in generated]
    commits, per_entry = [], {}
    log = git(repo, "log", "--no-merges", f"--since={since}", "--format=@%h %ad %s", "--date=short",
              "--name-only", "origin/main", "--", *counted).stdout if counted else ""
    for line in log.splitlines():
        if line.startswith("@"):
            commits.append(line[1:])
        elif line and commits:
            for g in counted:
                if line == g or (g.endswith("/") and line.startswith(g)):
                    per_entry.setdefault(g, set()).add(commits[-1])
    if not commits:
        print("None.")
    else:
        top = sorted(per_entry.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        print(f"{len(commits)} commits. By governed path, a commit counting once for each it touched:\n")
        print(table(["path", "commits"], [[f"`{g}`", len(c)] for g, c in top[:12]]))
        if len(top) > 12:
            print(f"\n{len(top) - 12} more paths with fewer commits.")
        print("\nLatest:\n")
        print("\n".join("- " + c for c in commits[:10]))
    if generated:
        print("\nNot counted, as a generator writes each whole: " + ", ".join(f"`{g}`" for g in generated) + ".")

    print("\n## Measures\n")
    for m in prog.get("measures") or []:
        owner, _, path = m.partition(":") if ":" in m else ("", "", m)
        owner, _, ref = owner.partition("@")
        ref = ref or "main"
        base = sibling(repo, owner) if owner else repo
        if base and ref != "main":
            git(base, "fetch", "-q", "origin", ref)
        raw = git(base, "show", f"origin/{ref}:{path}").stdout if base else ""
        if not raw:
            print(f"- `{m}`: not readable from this checkout\n")
            continue
        try:
            data = json.loads(raw)
        except ValueError:
            print(f"- `{m}`: present, not JSON\n")
            continue
        stamp = f"generated {data['generated']}" if data.get("generated") else (
            f"checked {data['checked_at']}" if data.get("checked_at") else "")
        print(f"### `{m}`" + (f" ({stamp})" if stamp else "") + "\n")
        s = data.get("summary") or {}
        if isinstance(s, dict) and s.get("columns") and s.get("rows"):
            print(table(s["columns"], s["rows"]) + "\n")
        elif isinstance(s, dict) and s and all(not isinstance(v, (dict, list)) for v in s.values()):
            print(table(list(s.keys()), [list(s.values())]) + "\n")
        for c in data.get("caveats") or []:
            print(f"- {c}")
        print()

    print("## Open tasks\n")
    open_rows = open_program_tasks(repo, me, prog, governs, charter_path)
    print(table(["id", "status", "awaiting", "title"],
                [[r["id"], r["status"], r.get("awaiting", ""), r["title"]] for r in open_rows]) if open_rows else "None.")

    print("\n## Snags on governed files\n")
    snag_file = os.path.join(store_repo, "lists", "snag.json") if store_repo else ""
    try:
        items = json.loads(git(store_repo, "show", "origin/main:lists/snag.json").stdout)["items"] if store_repo else []
    except (ValueError, KeyError, TypeError):
        items = []
    hits = sorted((i for i in items if any(about_program(t) for t in i.get("targets") or [])),
                  key=lambda i: -len(i.get("seen") or []))
    print("\n".join(f"- `{i['id']}` · {len(i.get('seen') or [])} dates · {i['text']}" for i in hits[:12]) if hits
          else ("None." if snag_file else "Unavailable: no snag list beside this checkout."))
    if len(hits) > 12:
        print(f"\n{len(hits) - 12} more, seen on fewer dates.")

    print("\n## Notes\n")
    if notes is None:
        print("Unavailable.")
    else:
        print("\n".join(f"- {n['at'][:10]} · {n.get('author', '')} · `{n['about']}` · {n['text']}" for n in notes[-10:]) or "None.")


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    r = sub.add_parser("report"); r.add_argument("name"); r.add_argument("--since")
    a = ap.parse_args(argv)
    repo = find_checkout()
    git(repo, "fetch", "-q", "origin", "main")
    progs = declared(repo)
    if a.cmd == "list":
        for p in progs:
            print(f"{p['name']}\t{p.get('label', '')}\t{p['path']}\t{p.get('status') or len(p.get('governs') or [])}"
                  + ("" if p.get("status") else " paths"))
        return
    prog = next((p for p in progs if p.get("name") == a.name), None)
    if not prog:
        raise SystemExit(f"program.py: {slug(repo)} declares no program named {a.name!r}")
    if prog.get("status") == "proposed":
        raise SystemExit(f"program.py: {a.name} is proposed; it has no charter or governed files to report on")
    report(repo, prog, a.since)


if __name__ == "__main__":
    main(sys.argv[1:])
