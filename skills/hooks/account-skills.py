#!/usr/bin/env python3
"""The account outpost: what the claude.ai account's skills are, against what
they should be.

WHAT THIS IS FOR. The account carries skills to chat, Cowork and cloud
sessions, and nothing in git can write to it: every change is a step in the
claude.ai app. Its uploads were copies of plugin skills on the day they were
uploaded, and nothing told anyone when the plugin moved on. On 2026-10-02 ten of
the twenty-three uploads with a plugin twin differed from it, one retired skill
was still on, and the prose record of the account was wrong twice over.

WHAT IT READS, and none of it costs a fetch.

  observed   ~/.claude/skills/synced/<org>_<user>/, the copy of the account
             Claude Code downloads at session start: manifest.json (name,
             source, updatedAt) and each skill's folder
  twins      the portable plugin's own skills, the folders beside hooks/
  declared   docs/account-skills.csv in web-tools, read from the marketplace
             checkout every session already has, or from this checkout

docs/outposts.md is the pattern this instance follows; docs/account-skills.csv
says what each declared row means.

    account-skills.py             one row per account skill, with its state
    account-skills.py --hook      the SessionStart line: silent unless
                                  something needs attention
    account-skills.py --write P   write the observation CSV to P
    account-skills.py --zip DIR   an upload-ready zip of the plugin's copy, for
                                  each upload that differs from it

The comparison is folder-wide (every file's bytes, by relative path), and it
says "differs", never "older" or "newer": which copy is ahead is a claim about
dates, and a sandbox clone's history is too shallow to make it.

Never fails into a session: --hook exits 0 on every path.
"""
import argparse
import csv
import glob
import hashlib
import json
import os
import sys
import zipfile
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN_ROOT = os.path.dirname(HERE)
MARKETPLACE = os.path.expanduser("~/.claude/plugins/marketplaces/web-tools")
SOURCES = {"anthropic": "anthropic", "anthropic-example": "anthropic-example", "plugin": "upload"}

# One label per state, and the wording is the contract: what was compared and
# what it found, never a bare "synced". `drift` marks the states the hook
# reports; the rest are the declared shape of the account.
STATES = {
    "matches":         ("matches the plugin's copy", False),
    "upload-differs":  ("upload differs from the plugin's copy", True),
    "anthropic-same":  ("plugin's copy matches Anthropic's", False),
    "vendored-differs": ("plugin's copy differs from Anthropic's", True),
    "on":              ("on, no plugin copy", False),
    "off-but-on":      ("declared off, still on", True),
    "undeclared":      ("on the account, not declared", True),
    "missing":         ("declared on, not on the account", True),
    "off":             ("off, as declared", False),
    "twin-missing":    ("declared twin not in the plugin", True),
}
# The hook's phrasing of each drift state, singular and plural, in the order
# it reports them: what needs a step in the app first, repo-side fixes last.
HOOK = [
    ("off-but-on",       "skill declared off is still on", "skills declared off are still on"),
    ("undeclared",       "skill on the account is not declared", "skills on the account are not declared"),
    ("missing",          "declared skill is not on the account", "declared skills are not on the account"),
    ("upload-differs",   "upload differs from the plugin", "uploads differ from the plugin"),
    ("vendored-differs", "plugin copy differs from Anthropic's", "plugin copies differ from Anthropic's"),
    ("twin-missing",     "declared twin is not in the plugin", "declared twins are not in the plugin"),
]
# The observation carries each state's label and whether it needs attention,
# so a reader of the file (the Map view's Outposts tab) keeps no second copy
# of the wording above.
OBS_COLS = ["name", "source", "updated", "files", "digest", "twin", "state", "label", "attention", "detail", "observed"]


def folder(path):
    """relative path -> sha256 of the bytes, for every file under path."""
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


def find_synced(explicit):
    if explicit:
        return explicit if os.path.isfile(os.path.join(explicit, "manifest.json")) else None
    hits = sorted(glob.glob(os.path.expanduser("~/.claude/skills/synced/*/manifest.json")))
    return os.path.dirname(hits[0]) if hits else None


def find_declared(explicit):
    if explicit:
        return explicit
    for base in (MARKETPLACE, os.path.dirname(PLUGIN_ROOT)):
        p = os.path.join(base, "docs", "account-skills.csv")
        if os.path.isfile(p):
            return p
    return None


def read_declared(path):
    if not path:
        return None
    with open(path, newline="", encoding="utf-8") as fh:
        return {r["name"]: r for r in csv.DictReader(fh)}


def observe(synced):
    with open(os.path.join(synced, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)
    seen = {}
    for s in manifest.get("skills", []):
        name = s.get("name", "")
        path = os.path.join(synced, name)
        files = folder(path) if os.path.isdir(path) else {}
        seen[name] = {"name": name, "source": SOURCES.get(s.get("source", ""), s.get("source", "")),
                      "updated": (s.get("updatedAt") or "")[:10], "files": files}
    return seen


def assess(seen, declared, plugin_root):
    """One row per skill on the account or in the declaration."""
    rows = []
    for name in sorted(set(seen) | set(declared or {})):
        obs, dec = seen.get(name), (declared or {}).get(name)
        want = (dec or {}).get("want", "")
        twin = (dec or {}).get("twin", "") if dec else (name if os.path.isdir(os.path.join(plugin_root, name)) else "")
        twin_path = os.path.join(plugin_root, twin) if twin else ""
        row = {"name": name, "source": obs["source"] if obs else (dec or {}).get("source", ""),
               "updated": obs["updated"] if obs else "", "files": len(obs["files"]) if obs else "",
               "digest": digest(obs["files"]) if obs else "", "twin": twin, "detail": ""}
        if obs is None:
            row["state"] = "off" if want == "off" else "missing"
        elif want == "off":
            row["state"] = "off-but-on"
        elif declared is not None and dec is None:
            row["state"] = "undeclared"
        elif not twin:
            row["state"] = "on"
        elif not os.path.isdir(twin_path):
            row["state"] = "twin-missing"
        else:
            mine = folder(twin_path)
            same = mine == obs["files"]
            anthropic = row["source"].startswith("anthropic")
            row["state"] = ("anthropic-same" if same else "vendored-differs") if anthropic \
                else ("matches" if same else "upload-differs")
            if not same:
                only_acct = sorted(set(obs["files"]) - set(mine))
                only_plug = sorted(set(mine) - set(obs["files"]))
                changed = [k for k in set(mine) & set(obs["files"]) if mine[k] != obs["files"][k]]
                bits = [f"{len(changed)} changed"] if changed else []
                if only_acct: bits.append(f"{len(only_acct)} only on the account")
                if only_plug: bits.append(f"{len(only_plug)} only in the plugin")
                row["detail"] = ", ".join(bits)
        rows.append(row)
    return rows


def hook_line(rows, declared_found):
    groups = {}
    for r in rows:
        if STATES[r["state"]][1]:
            groups.setdefault(r["state"], []).append(r["name"])
    if not groups:
        return ""
    parts = []
    for st, one, many in HOOK:
        names = groups.get(st)
        if not names:
            continue
        named = f" ({', '.join(names)})" if len(names) <= 3 else ""
        parts.append(f"{len(names)} {one if len(names) == 1 else many}{named}")
    tail = "" if declared_found else " No declaration was found, so each skill was compared with its plugin namesake."
    return ("Outpost check, claude.ai account skills: " + "; ".join(parts) + "." + tail +
            f" Details: python3 {os.path.join(HERE, 'account-skills.py')}")


def write_obs(rows, path, observed):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=OBS_COLS, lineterminator="\n", extrasaction="ignore")
        w.writeheader()
        for r in rows:
            label, attention = STATES[r["state"]]
            w.writerow({**r, "label": label, "attention": "yes" if attention else "", "observed": observed})


def write_zips(rows, plugin_root, out):
    os.makedirs(out, exist_ok=True)
    made = []
    for r in rows:
        if r["state"] != "upload-differs":
            continue
        src = os.path.join(plugin_root, r["twin"])
        dest = os.path.join(out, f"{r['name']}.zip")
        # The skill folder itself at the archive root: claude.ai looks for
        # <skill-name>/SKILL.md and ignores a bare SKILL.md (claude.com
        # docs/skills/how-to, "Package your skill").
        with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
            for rel in sorted(folder(src)):
                z.write(os.path.join(src, rel), f"{r['name']}/{rel}")
        made.append(dest)
    return made


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--hook", action="store_true")
    ap.add_argument("--write")
    ap.add_argument("--zip")
    ap.add_argument("--synced")
    ap.add_argument("--plugin", default=PLUGIN_ROOT)
    ap.add_argument("--declared")
    a = ap.parse_args(argv)
    # Drain the hook payload, which this check does not need, so the harness
    # never meets a closed pipe.
    if a.hook and not sys.stdin.isatty():
        sys.stdin.read()

    synced = find_synced(a.synced)
    if not synced:
        if not a.hook:
            print("No synced account skills here: this session is not signed in to a claude.ai account with sync.")
        return 0
    declared_path = find_declared(a.declared)
    declared = read_declared(declared_path)
    rows = assess(observe(synced), declared, a.plugin)

    if a.hook:
        line = hook_line(rows, declared is not None)
        if line:
            print(line)
        return 0
    if a.write:
        write_obs(rows, a.write, datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        print(f"wrote {len(rows)} rows to {a.write}")
    if a.zip:
        for p in write_zips(rows, a.plugin, a.zip):
            print(p)
    if not a.write and not a.zip:
        print(f"declared: {declared_path or 'none found'}\nobserved: {synced}\n")
        w = max(len(r["name"]) for r in rows)
        for r in rows:
            extra = f"  [{r['detail']}]" if r["detail"] else ""
            print(f"{r['name']:<{w}}  {r['source']:<17} {STATES[r['state']][0]}{extra}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception:
        if "--hook" in sys.argv:
            sys.exit(0)
        raise
