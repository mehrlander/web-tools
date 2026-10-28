#!/usr/bin/env python3
"""Pool each method's most similar new pairs for a blind judge, then score the verdicts.

    python3 research/code-jobs/pool.py build [--top N] [--embed]   # writes review/pool.json and review/pairs-*.txt
    python3 research/code-jobs/pool.py score <verdicts.jsonl>...

`build` takes each method's N most similar cross-file pairs that the key does
not already hold (score.py's ranking), pools them, and shuffles the pool with a
fixed seed so a judge cannot tell which method proposed a pair. pairs-*.txt show
each pair's two units as code only, under a pair number. `score` reads a
judge's verdicts ({"pair", "verdict": same|related|different, "why"}) and
reports, per method, how many of its N pairs were judged the same job.
"""
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import score  # noqa: E402

SEED = "code-jobs-2026-10-24"
REVIEW = HERE / "review"


def build(top, embed):
    index, text = score.load_units()
    file_of = {u["id"]: u["file"] for u in index}
    name_of = {u["id"]: u["name"] for u in index}
    ids = [u["id"] for u in index]
    key = json.load(open(HERE / "key.json"))
    group_of = {}
    for g in key["groups"]:
        for m in g["members"]:
            group_of.setdefault(m, set()).add(g["id"])
    methods = score.build_methods(ids, text, embed)
    methods = {k: m for k, m in methods.items() if len(m["has"]) == len(ids)}
    pool = {}
    for mname, meth in methods.items():
        for rank, (s, a, b) in enumerate(score.top_pairs(ids, file_of, group_of, meth, top), 1):
            pool.setdefault((a, b), {})[mname] = rank
    pairs = sorted(pool)
    random.Random(SEED).shuffle(pairs)
    REVIEW.mkdir(exist_ok=True)
    meta = [{"pair": n, "a": a, "b": b, "proposed_by": pool[(a, b)]} for n, (a, b) in enumerate(pairs, 1)]
    (REVIEW / "pool.json").write_text(json.dumps({"top": top, "methods": sorted(methods), "pairs": meta}, indent=1) + "\n")
    out = []
    for m in meta:
        out.append(f"##### PAIR {m['pair']}\n")
        for side in ("a", "b"):
            uid = m[side]
            out.append(f"=== {side.upper()}: {uid} | {name_of[uid]} ===\n{text[uid]}\n")
    # One file per judge, cut at a pair boundary so a Read takes each whole.
    for old in REVIEW.glob("pairs-*.txt"):
        old.unlink()
    files, cur, n = [], [], 0
    for block in "".join(out).split("##### PAIR ")[1:]:
        block = "##### PAIR " + block
        if cur and n + block.count("\n") > 1800:
            files.append(cur)
            cur, n = [], 0
        cur.append(block)
        n += block.count("\n")
    files.append(cur)
    for k, f in enumerate(files, 1):
        (REVIEW / f"pairs-{k}.txt").write_text("".join(f))
    print(f"{len(meta)} pairs pooled from {', '.join(sorted(methods))}, top {top} each")


def score_verdicts(paths):
    meta = json.load(open(REVIEW / "pool.json"))
    verdict = {}
    for p in paths:
        for line in Path(p).read_text().splitlines():
            if line.strip():
                v = json.loads(line)
                verdict[int(v["pair"])] = v["verdict"]
    print(f"{'method':8} {'same':>5} {'related':>8} {'different':>10} {'unjudged':>9}  of top {meta['top']}")
    for mname in meta["methods"]:
        mine = [m for m in meta["pairs"] if mname in m["proposed_by"]]
        counts = {k: sum(1 for m in mine if verdict.get(m["pair"]) == k) for k in ("same", "related", "different")}
        print(f"{mname:8} {counts['same']:>5} {counts['related']:>8} {counts['different']:>10} {len(mine) - sum(counts.values()):>9}")
    only = {}
    for m in meta["pairs"]:
        if verdict.get(m["pair"]) == "same" and len(m["proposed_by"]) == 1:
            only.setdefault(next(iter(m["proposed_by"])), []).append(m["pair"])
    for mname, ps in sorted(only.items()):
        print(f"same-job pairs only {mname} proposed: {ps}")


if __name__ == "__main__":
    if sys.argv[1:2] == ["build"]:
        build(int(sys.argv[sys.argv.index("--top") + 1]) if "--top" in sys.argv else 25, "--embed" in sys.argv)
    elif sys.argv[1:2] == ["score"]:
        score_verdicts(sys.argv[2:])
    else:
        sys.exit(__doc__)
