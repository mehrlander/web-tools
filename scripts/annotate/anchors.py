#!/usr/bin/env python3
"""Annotations that point into a document, checked against the document now.

Two kinds are stored, each pointing its own way (docs/locators.md, "Kinds"):

  a note's anchor  in the notes store (the checkout whose .web-tools.json
                   declares "notes"): a note whose `about` is a file,
                   owner/repo[@ref]:path, quoting its passage as a W3C text
                   quote selector (`exact`, `prefix`, `suffix`). Found again by
                   its words, so it survives edits anywhere but the passage.
  a standoff       a JSON file of `"kind": "standoff/1"` in any checkout:
                   character spans into its target, valid while the target's
                   bytes still hash to `target.sha256` (lib/kits/standoff.js).

Each gets one of docs/locators.md's verdicts:

  ok            the quote is found once, or several times with its context
                picking one; the standoff's hash matches
  changed       the quoted words were edited and a close match remains
                (reanchor.py's FUZZY tier); the standoff's target changed
  broken        the quoted words are gone, or the file is
  unverifiable  the repo is not checked out beside this one, the note pins a
                ref that is not here, or the standoff pins no hash

    anchors.py              every stored annotation, against each working tree
    anchors.py --staged     only those pointing into files this commit changes,
                            against the staged text, printing only what is not
                            ok (the pre-commit hook's warning). A standoff whose
                            target was unchanged at HEAD is re-anchored from
                            HEAD to the staged text and its lost units counted.
    anchors.py --json       one JSON object per annotation
    anchors.py --strict     exit 1 when anything is changed or broken

The quote matching is reanchor.py's: exact, exact with context, then a fuzzy
match against the document's segments. Checkouts are found beside this one (the
estate's sibling layout); a repo not there reads as unverifiable, never broken.
Everything is read locally: the notes store at its origin/main as last fetched.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reanchor import CTX, resolve  # noqa: E402
from segment import units as segment_units  # noqa: E402

FILE = re.compile(r"^([\w.-]+/[\w.-]+)(?:@([^\s:]+))?:([^\s#]+)(?:#\S+)?$")
# A fixed string, twice as fast as a pattern over a large checkout; the parsed
# `kind` is what decides.
STANDOFF = "standoff/1"
BAD = ("changed", "broken")


def git(d, *args):
    """stdout as bytes, or None when git refuses."""
    r = subprocess.run(["git", "-C", str(d), *args], capture_output=True)
    return r.stdout if r.returncode == 0 else None


def show(d, path, refs=("origin/main", "HEAD")):
    for ref in refs:
        out = git(d, "show", f"{ref}:{path}")
        if out is not None:
            return out
    return None


def slug_of(d):
    url = (git(d, "remote", "get-url", "origin") or b"").decode().strip()
    m = re.search(r"([\w.-]+)/([\w.-]+?)(?:\.git)?/?$", url)
    return f"{m.group(1)}/{m.group(2)}" if m else ""


def checkouts(root):
    """owner/repo -> checkout, for this repo and its siblings."""
    out = {}
    for d in sorted([root, *root.parent.iterdir()]):
        if d.is_dir() and (d / ".git").exists():
            s = slug_of(d)
            if s and s not in out:
                out[s] = d
    return out


def notes(repos):
    """Every note that quotes a passage of a file, from each declared store."""
    out = []
    for d in repos.values():
        try:
            folder = json.loads(show(d, ".web-tools.json") or b"{}").get("notes")
        except ValueError:
            folder = None
        raw = show(d, f"{folder}/notes.jsonl") if folder else None
        for line in (raw or b"").decode("utf-8", "replace").splitlines():
            try:
                n = json.loads(line)
            except ValueError:
                continue
            a = n.get("anchor")
            if isinstance(a, dict) and a.get("exact") and FILE.match(str(n.get("about", ""))):
                out.append(n)
    return out


def standoffs(repos):
    """(checkout slug, path, parsed) for every standoff tracked in a checkout."""
    out = []
    for slug, d in repos.items():
        found = git(d, "grep", "-l", "-F", STANDOFF, "--", "*.json")
        for path in (found or b"").decode().splitlines():
            try:
                so = json.loads((d / path).read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if so.get("kind") == "standoff/1":
                out.append((slug, path, so))
    return out


def target_of(slug, so):
    t = so.get("target") or {}
    repo = t.get("repo") or t.get("repository") or (so.get("self") or {}).get("repo") or slug
    return repo, t.get("path") or ""


def row(verdict, kind, at, what, detail):
    return {"verdict": verdict, "kind": kind, "at": at, "what": what, "detail": detail}


def check_quote(anchor, text):
    """(verdict, detail) for a quote against the document's text, or None text."""
    if text is None:
        return "broken", "the file is gone"
    tier, pos, conf = resolve({"exact": anchor["exact"], "prefix": anchor.get("prefix", ""),
                               "suffix": anchor.get("suffix", "")}, text, segment_units(text, 0))
    line = text.count("\n", 0, pos) + 1 if pos is not None else 0
    if tier == "EXACT":
        return "ok", f"found once, line {line}"
    if tier == "EXACT-CTX":
        return "ok", f"found {text.count(anchor['exact'])} times; its context picks line {line}"
    if tier == "FUZZY":
        return "changed", f"the quoted words were edited; the closest passage is line {line}, {conf:.0%} alike"
    return "broken", "the quoted words are gone"


def check_standoff(so, text, old=None):
    if text is None:
        return "broken", "its target is gone"
    want = (so.get("target") or {}).get("sha256")
    if not want:
        return "unverifiable", "it pins no hash of its target"
    if hashlib.sha256(text.encode("utf-8")).hexdigest() == want:
        return "ok", "its target is unchanged"
    detail = "its target changed since it was annotated"
    if old is not None and hashlib.sha256(old.encode("utf-8")).hexdigest() == want:
        units = [u for u in so.get("units") or [] if isinstance(u.get("start"), int) and isinstance(u.get("end"), int)]
        new_units = segment_units(text, 0)
        lost = sum(1 for u in units if resolve({"exact": old[u["start"]:u["end"]],
                                                 "prefix": old[max(0, u["start"] - CTX):u["start"]],
                                                 "suffix": old[u["end"]:u["end"] + CTX]}, text, new_units)[0] == "ORPHANED")
        detail += f"; {len(units) - lost} of {len(units)} units are found again, {lost} would need annotating again"
    return "changed", detail + " (scripts/annotate/reanchor.py)"


def staged(root):
    """path -> how this commit changes it: 'M', 'D', or 'R <new path>'."""
    out = {}
    raw = (git(root, "diff", "--cached", "--name-status", "-M") or b"").decode()
    for line in raw.splitlines():
        f = line.split("\t")
        if f[0].startswith("R") and len(f) == 3:
            out[f[1]] = "R " + f[2]
        elif len(f) == 2 and f[0][:1] in "MDT":
            out[f[1]] = f[0][:1]
    return out


def run(root, only_staged=False):
    changes = staged(root) if only_staged else None
    if changes == {}:
        return []
    repos = checkouts(root)
    here = slug_of(root)

    def read(repo, path, ref=None):
        """(text or None, why unverifiable or None)."""
        d = repos.get(repo)
        if d is None:
            return None, f"{repo} is not checked out beside this repo"
        if changes is not None:
            how = changes.get(path, "")
            if how == "D" or how.startswith("R "):
                return None, None
            raw = git(d, "show", f":{path}")
        elif ref and ref not in ("main", "HEAD"):
            raw = show(d, path, (ref, f"origin/{ref}"))
            if raw is None:
                return None, f"{ref} is not here"
        else:
            p = d / path
            raw = p.read_bytes() if p.is_file() else None
        return (raw.decode("utf-8", "replace") if raw is not None else None), None

    rows = []
    for n in notes(repos):
        repo, ref, path = FILE.match(n["about"]).groups()
        if changes is not None and (repo != here or path not in changes or (ref and ref not in ("main", "HEAD"))):
            continue
        what = f'note {n.get("id", "?")} "{" ".join(n["anchor"]["exact"].split())[:60]}"'
        text, why = read(repo, path, ref)
        if why:
            rows.append(row("unverifiable", "note", f"{repo}:{path}", what, why))
            continue
        v, detail = check_quote(n["anchor"], text)
        if text is None and changes and changes.get(path, "").startswith("R "):
            detail = "the file was renamed to " + changes[path][2:]
        rows.append(row(v, "note", f"{repo}:{path}", what, detail))
    for slug, where, so in standoffs(repos):
        repo, path = target_of(slug, so)
        if changes is not None and (repo != here or path not in changes):
            continue
        what = f"standoff {slug}:{where} ({len(so.get('units') or [])} units)"
        text, why = read(repo, path)
        if why:
            rows.append(row("unverifiable", "standoff", f"{repo}:{path}", what, why))
            continue
        old = None
        if changes is not None:
            raw = git(repos[repo], "show", f"HEAD:{path}")
            old = raw.decode("utf-8", "replace") if raw is not None else None
        v, detail = check_standoff(so, text, old)
        rows.append(row(v, "standoff", f"{repo}:{path}", what, detail))
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--staged", action="store_true", help="only what this commit changes, against the staged text")
    ap.add_argument("--json", action="store_true", help="one JSON object per annotation")
    ap.add_argument("--strict", action="store_true", help="exit 1 when anything is changed or broken")
    a = ap.parse_args(argv)
    top = git(Path.cwd(), "rev-parse", "--show-toplevel")
    if top is None:
        sys.exit("anchors.py: run it inside a checkout")
    rows = run(Path(top.decode().strip()), a.staged)
    shown = [r for r in rows if r["verdict"] != "ok"] if a.staged else rows
    for r in shown:
        print(json.dumps(r, ensure_ascii=False) if a.json
              else f'{r["verdict"]:<12} {r["at"]}  {r["what"]}: {r["detail"]}')
    if a.staged and shown and not a.json:
        print(f"{len(shown)} annotation(s) point into what this commit changes and no longer line up as they did")
    if not a.staged and not a.json:
        n = {v: sum(1 for r in rows if r["verdict"] == v) for v in ("ok", "changed", "broken", "unverifiable")}
        print(f'{len(rows)} annotation(s): ' + ", ".join(f"{k} {v}" for k, v in n.items() if v) if rows
              else "no stored annotation points into a document")
    sys.exit(1 if a.strict and any(r["verdict"] in BAD for r in rows) else 0)


if __name__ == "__main__":
    main()
