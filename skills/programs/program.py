#!/usr/bin/env python3
"""What a declared program's manager reports from, gathered the same way each run.

A program is declared under `programs` in a checkout's .web-tools.json
(docs/CONSTELLATION.md, "Projects and research"). This reads the declaration
and collects what needs no judgment: commits to the governed files since the
program's last note, its open tasks, the snags whose targets include a governed
file, the notes addressed to the charter (the README.md of the program's folder)
or a governed file, and each measure's
summary. Reading it is the session's job.

  python3 program.py list
  python3 program.py report <name> [--since YYYY-MM-DD]

The declaring checkout is the working directory's repository when it declares
programs, else the first child or sibling that does. The notes store, and the
snag list in the same checkout, are found as note.py finds the store.

A measure is a repo-root-relative path or an 'owner/repo[@ref]:path' locator
into a checkout beside this one, read at origin's ref (main by default). A JSON measure may carry "summary" ({"columns": [...],
"rows": [[...]]}) and "caveats" ([...]); those are printed, so the program that
writes a measure decides what its reader sees first.
"""
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "notes"))
import note  # noqa: E402  (skills/notes/note.py, the notes store's one reader and writer)


def git(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)


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


def table(columns, rows):
    out = ["| " + " | ".join(columns) + " |", "| " + " | ".join("---" for _ in columns) + " |"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def report(repo, prog, since):
    me = slug(repo)
    governs = prog.get("governs") or []
    charter_path = f"{prog['path']}/README.md"
    charter = f"{me}:{charter_path}"
    subjects = {charter} | {f"{me}:{g}" for g in governs}

    def about_program(locator):
        # A locator names the program when it is the charter or a governed
        # path, or sits under a governed folder (an entry ending in /).
        loc = (locator or "").split("#")[0]
        return loc in subjects or any(s.endswith("/") and loc.startswith(s) for s in subjects)
    print(f"# {prog.get('label') or prog['name']} program\n")
    print(f"Charter: `{charter_path}` · {len(governs)} governed paths\n")

    try:
        store_repo, store = note.find_store(None)
        notes = sorted((n for n in note.read_notes(store_repo, store)
                        if about_program(n.get("about"))), key=lambda n: n["at"])
    except SystemExit as e:
        store_repo, notes = None, None
        print(f"Notes: unavailable ({e})\n")
    if not since:
        last = [n["at"] for n in notes or [] if n.get("about", "").split("#")[0] == charter]
        since = last[-1][:10] if last else (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    print(f"## Changes to governed files since {since}\n")
    log = git(repo, "log", "--no-merges", f"--since={since}", "--format=%h %ad %s", "--date=short", "origin/main", "--", *governs).stdout.strip()
    print(log and "\n".join("- " + l for l in log.splitlines()) or "None.")

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
        print(f"### `{m}`" + (f" (generated {data['generated']})" if data.get("generated") else "") + "\n")
        s = data.get("summary") or {}
        if s.get("columns") and s.get("rows"):
            print(table(s["columns"], s["rows"]) + "\n")
        for c in data.get("caveats") or []:
            print(f"- {c}")
        print()

    print("## Open tasks\n")
    tracker = ""
    try:
        with open(os.path.join(repo, ".web-tools.json"), encoding="utf-8") as fh:
            tracker = json.load(fh).get("tracker") or ""
    except (OSError, ValueError):
        pass
    board = git(repo, "show", "origin/main:" + tracker.removesuffix(".md") + ".csv").stdout if tracker.endswith(".md") else ""
    import csv, io
    open_rows = [r for r in csv.DictReader(io.StringIO(board))
                 if r.get("project") == prog["name"] and r.get("status") not in ("done", "dormant")]
    print(table(["id", "status", "awaiting", "title"],
                [[r["id"], r["status"], r.get("awaiting", ""), r["title"]] for r in open_rows]) if open_rows else "None.")

    print("\n## Snags on governed files\n")
    snag_file = os.path.join(store_repo, "lists", "snag.json") if store_repo else ""
    try:
        items = json.loads(git(store_repo, "show", "origin/main:lists/snag.json").stdout)["items"] if store_repo else []
    except (ValueError, KeyError, TypeError):
        items = []
    hits = [i for i in items if any(about_program(t) for t in i.get("targets") or [])]
    print("\n".join(f"- `{i['id']}` · {len(i.get('seen') or [])} dates · {i['text']}" for i in hits) if hits
          else ("None." if snag_file else "Unavailable: no snag list beside this checkout."))

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
            print(f"{p['name']}\t{p.get('label', '')}\t{p['path']}\t{len(p.get('governs') or [])} paths")
        return
    prog = next((p for p in progs if p.get("name") == a.name), None)
    if not prog:
        raise SystemExit(f"program.py: {slug(repo)} declares no program named {a.name!r}")
    report(repo, prog, a.since)


if __name__ == "__main__":
    main(sys.argv[1:])
