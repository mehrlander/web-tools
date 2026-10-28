#!/usr/bin/env python3
"""Score step 2: the job list Haiku drafted and the tags it gave each unit.

    python3 research/code-jobs/tags.py [reader]     # reader defaults to haiku

Reads runs/<reader>/codebook.jsonl and runs/<reader>/tags-*.jsonl, and reports:

  coverage   units tagged, tags off the list, new: proposals
  spread     how many tags were used, and how many units and files each holds
  key        for each key group, the members that share a tag with a member in
             another file
  judge      for the pairs the blind judge read (review/), how often the two
             units share a tag, by verdict
"""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import score  # noqa: E402

reader = sys.argv[1] if len(sys.argv) > 1 else "haiku"
run = HERE / "runs" / reader
index, _ = score.load_units()
ids = [u["id"] for u in index]
file_of = {u["id"]: u["file"] for u in index}
listed = {json.loads(l)["tag"] for l in open(run / "codebook.jsonl") if l.strip()}

tags = {}
for f in sorted(run.glob("tags-*.jsonl")):
    for line in f.read_text().splitlines():
        if line.strip():
            r = json.loads(line)
            tags[r["id"]] = r.get("tags") or []

off = Counter(t for ts in tags.values() for t in ts if t not in listed and not t.startswith("new:"))
new = Counter(t for ts in tags.values() for t in ts if t.startswith("new:"))
print(f"coverage: {sum(1 for i in ids if tags.get(i))} of {len(ids)} units tagged; "
      f"{len(listed)} tags listed; {sum(off.values())} uses of {len(off)} tags off the list; "
      f"{sum(new.values())} new: proposals")
if off:
    print("  off the list:", ", ".join(f"{t} ({n})" for t, n in off.most_common(8)))

units_of = defaultdict(set)
for i, ts in tags.items():
    for t in ts:
        units_of[t].add(i)
used = {t: u for t, u in units_of.items() if t in listed}
files = {t: {file_of[i] for i in u if i in file_of} for t, u in used.items()}
per = Counter(len(u) for u in used.values())
print(f"spread: {len(used)} of {len(listed)} listed tags used; "
      f"{sum(1 for t in used if len(files[t]) > 1)} span more than one file; "
      f"{per[1]} hold a single unit; mean {sum(len(u) for u in used.values()) / max(1, len(used)):.1f} units a tag, "
      f"{sum(len(ts) for ts in tags.values()) / max(1, len(tags)):.1f} tags a unit")
print("  widest:", ", ".join(f"{t} ({len(u)} units, {len(files[t])} files)"
                             for t, u in sorted(used.items(), key=lambda kv: -len(kv[1]))[:6]))

key = json.load(open(HERE / "key.json"))
print("key: members sharing a tag with a member in another file")
hit = tot = 0
for g in key["groups"]:
    row = []
    for m in g["members"]:
        fellows = [f for f in g["members"] if f != m and file_of[f] != file_of[m]]
        if not fellows:
            continue
        shared = set(tags.get(m, [])) & set().union(*(set(tags.get(f, [])) for f in fellows))
        row.append(bool(shared))
        hit += bool(shared)
        tot += 1
    print(f"  {g['id']:20} {sum(row)} of {len(row)}")
print(f"  all {hit} of {tot}")

pool = HERE / "review" / "pool.json"
if pool.exists():
    verdict = {}
    for f in (HERE / "review").glob("judge-*.jsonl"):
        for line in f.read_text().splitlines():
            if line.strip():
                v = json.loads(line)
                verdict[int(v["pair"])] = v["verdict"]
    by = defaultdict(lambda: [0, 0])
    for p in json.load(open(pool))["pairs"]:
        v = verdict.get(p["pair"])
        if v:
            by[v][1] += 1
            by[v][0] += bool(set(tags.get(p["a"], [])) & set(tags.get(p["b"], [])))
    print("judge: pooled pairs whose two units share a tag")
    for v in ("same", "related", "different"):
        if v in by:
            print(f"  {v:9} {by[v][0]} of {by[v][1]}")
