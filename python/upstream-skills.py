#!/usr/bin/env python3
"""Upstream skills: the outside skills this estate watches, studies, holds or
copies, against what their authors hold now.

WHAT THIS IS FOR. An outpost (docs/outposts.md) is our material held where no
commit reaches. An upstream is the reverse: someone else's skill that we read,
keep a copy of, or ship. It has the same four parts. The declaration is the
version we pinned, by commit and folder fingerprint, in
docs/upstream-skills.csv; the observation is what the upstream holds now; the
check compares them; the upkeep is a re-pin, a refreshed copy, or a decline. On
2026-10-02 the plugin's copies of Anthropic's docx, pptx and xlsx were found to
differ from Anthropic's, and nothing had said so.

    upstream-skills.py               fetch each pinned upstream and compare
    upstream-skills.py --offline     only the local checks: every vendored or
                                     held copy still matches its pin
    upstream-skills.py --pin ID      fetch one upstream and print its commit
                                     and fingerprint; with --write, record them

Fetching is a shallow, sparse clone of each repository named, one per repo, so
only the skill folders come down. --from owner/repo=DIR reads a local directory
in place of the clone, which is how the suite runs this without the network.

A fingerprint covers every file in the folder, by relative path and bytes, the
same way skills/hooks/account-skills.py compares the account.
"""
import argparse
import csv
import hashlib
import io
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY = os.path.join(ROOT, "docs", "upstream-skills.csv")
LOCATOR = re.compile(r"^([\w.-]+)/([\w.-]+):(.+)$")
PINNED = {"studied", "held", "vendored", "adapted", "dependency"}   # statuses that carry a pin


def folder(path):
    out = {}
    for root, _, names in os.walk(path):
        for n in names:
            p = os.path.join(root, n)
            with open(p, "rb") as fh:
                out[os.path.relpath(p, path).replace(os.sep, "/")] = hashlib.sha256(fh.read()).hexdigest()
    return out


def digest(files):
    h = hashlib.sha256()
    for rel in sorted(files):
        h.update(f"{rel}\0{files[rel]}\n".encode())
    return h.hexdigest()[:12]


def read_rows(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def fetch(rows, local):
    """repo -> (commit, root dir) for every GitHub upstream the rows name."""
    repos = {}
    for r in rows:
        m = LOCATOR.match(r.get("upstream", ""))
        if m:
            repos.setdefault(f"{m[1]}/{m[2]}", set()).add(m[3])
    out, tmp = {}, tempfile.mkdtemp(prefix="upstreams-")
    for repo, paths in sorted(repos.items()):
        if repo in local:
            out[repo] = ("local", local[repo])
            continue
        dest = os.path.join(tmp, repo.replace("/", "__"))
        try:
            subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse",
                            f"https://github.com/{repo}", dest], check=True, capture_output=True, timeout=120)
            subprocess.run(["git", "-C", dest, "sparse-checkout", "set", *sorted(paths)],
                           check=True, capture_output=True, timeout=120)
            commit = subprocess.run(["git", "-C", dest, "rev-parse", "HEAD"], check=True,
                                    capture_output=True, text=True).stdout.strip()
            out[repo] = (commit, dest)
        except Exception as e:
            out[repo] = (None, str(e).splitlines()[0] if str(e) else "fetch failed")
    return out


def local_checks(r):
    """Problems a reader can find without the network."""
    # A held copy and a vendored one are the pinned version byte for byte; an
    # adapted copy differs by design, so only its existence is checked.
    found = []
    for col, exact in (("ours", r["status"] == "vendored"), ("held", True)):
        rel = r.get(col, "")
        if not rel:
            continue
        p = os.path.join(ROOT, rel)
        if not os.path.isdir(p):
            found.append(f"{col} {rel} is not a folder")
        elif exact and digest(folder(p)) != r.get("digest"):
            found.append(f"the {col} copy no longer matches the pin: re-pin it, or call it adapted")
    return found


def assess(rows, fetched):
    out = []
    for r in rows:
        problems = local_checks(r)
        m = LOCATOR.match(r.get("upstream", ""))
        state = ""
        if r["status"] in PINNED and m and fetched is not None:
            commit, where = fetched.get(f"{m[1]}/{m[2]}", (None, "not fetched"))
            path = os.path.join(where, m[3]) if commit else ""
            if not commit:
                state = f"upstream unreachable: {where}"
            elif not os.path.isdir(path):
                state = "upstream folder is gone"
            else:
                now = digest(folder(path))
                # Without a recorded commit there is no "since": the copy may
                # never have matched any commit upstream, so the label says only
                # that the two differ.
                if now == r.get("digest"):
                    state = "unchanged since the pin"
                elif r.get("pinned"):
                    state = f"upstream moved since the pin ({r['pinned']} → {commit[:12]})"
                else:
                    state = f"upstream differs from the pinned copy (no commit recorded; upstream at {commit[:12]})"
        elif r["status"] in PINNED and not m:
            state = "not on GitHub; compared by hand"
        out.append({**r, "state": state, "problems": problems})
    return out


def write_pin(path, ident, commit, dig):
    raw = open(path, newline="", encoding="utf-8").read()
    rows = list(csv.DictReader(io.StringIO(raw)))
    cols = list(rows[0].keys())
    for r in rows:
        if r["id"] == ident:
            r["pinned"], r["digest"] = commit[:12], dig
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, lineterminator="\r\n" if "\r\n" in raw else "\n")
    w.writeheader()
    w.writerows(rows)
    open(path, "w", newline="", encoding="utf-8").write(buf.getvalue())


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--registry", default=REGISTRY)
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--pin")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--from", dest="local", action="append", default=[], metavar="OWNER/REPO=DIR")
    a = ap.parse_args(argv)
    local = dict(x.split("=", 1) for x in a.local)
    rows = read_rows(a.registry)

    if a.pin:
        row = next((r for r in rows if r["id"] == a.pin), None)
        m = row and LOCATOR.match(row.get("upstream", ""))
        if not m:
            print(f"{a.pin}: no GitHub upstream to pin", file=sys.stderr)
            return 1
        commit, where = fetch([row], local)[f"{m[1]}/{m[2]}"]
        if not commit:
            print(f"{a.pin}: {where}", file=sys.stderr)
            return 1
        dig = digest(folder(os.path.join(where, m[3])))
        print(f"{a.pin}: commit {commit[:12]}, fingerprint {dig}")
        if a.write:
            write_pin(a.registry, a.pin, commit, dig)
            print(f"recorded in {os.path.relpath(a.registry, ROOT)}")
        return 0

    results = assess(rows, None if a.offline else fetch(rows, local))
    w = max(len(r["id"]) for r in results)
    bad = 0
    for r in results:
        line = f"{r['id']:<{w}}  {r['status']:<9} {r['state']}"
        for p in r["problems"]:
            line += f"\n{'':<{w}}  ! {p}"
            bad += 1
        print(line.rstrip())
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
