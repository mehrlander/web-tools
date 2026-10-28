#!/usr/bin/env python3
"""Score each reader's descriptions against the key, beside the code-text baseline.

    python3 research/code-jobs/score.py [--pairs N] [--json out.json]

For every unit, every unit in another file is ranked by cosine similarity of
TF-IDF vectors: of the code's own tokens (identifiers split at case and
underscores) for the `code` baseline, and of the reader's jobs (weighted twice)
and summary for
each reader under runs/. For each key member with a fellow member in another
file, the score is the rank of the best such fellow. A group's related units
are left out of its members' rankings, so they count neither for nor against.

  recall@k  share of members whose best fellow ranks k or better
  mrr       mean of 1/rank

--pairs N lists the N most similar cross-file pairs per method that the key
does not already hold, the candidates a reviewer reads for new findings.
--embed adds a row per text embedded with model2vec, the model
python/doc-overlap.py uses, run from a venv that has it.
"""
import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
KS = (1, 5, 10)

STOP = set("""
a an the of to and or in on for by with from into onto as at is are be been it its
this that these those each every any all one two than then so such not no only
also which what when where who how if else while do does done can may will would
given giving gives give using use uses used based new returns return value values
""".split())
JS = set("""
const let var function return if else for while do switch case break continue new
this true false null undefined typeof instanceof in of try catch finally throw async
await class extends super import export default yield delete void
""".split())


def words(text):
    out = []
    for w in re.findall(r"[a-z]+", text.lower()):
        if len(w) < 3 or w in STOP:
            continue
        if len(w) > 4 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


def code_tokens(text):
    out = []
    for ident in re.findall(r"[A-Za-z_$][A-Za-z0-9_$]*", text):
        if ident in JS:
            continue
        parts = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", ident).replace("_", " ").replace("$", " ")
        out.extend(p.lower() for p in parts.split() if len(p) >= 3 and p.lower() not in JS)
    return out


def tfidf(docs):
    n = len(docs)
    df = Counter(w for d in docs.values() for w in set(d))
    vecs = {}
    for k, d in docs.items():
        tf = Counter(d)
        v = {w: (1 + math.log(c)) * math.log(n / df[w]) for w, c in tf.items() if df[w] < n}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs[k] = {w: x / norm for w, x in v.items()}
    return vecs


def cos(a, b):
    if len(a) > len(b):
        a, b = b, a
    return sum(x * b.get(w, 0.0) for w, x in a.items())


def load_units():
    # Six one-line wrappers in the 2026-10-24 batches share an id with the
    # function they wrap (unitize.mjs now drops them). The later row of each
    # pair is the inner function, so keeping the last row, here, in the batch
    # text and in a reader's answers, keeps the unit that has content.
    index = list({u["id"]: u for u in map(json.loads, open(HERE / "units.jsonl"))}.values())
    text, cur = {}, None
    for f in sorted((HERE / "batches").glob("batch-*.txt")):
        for line in f.read_text().split("\n"):
            m = re.match(r"^=== UNIT (\S+) \| ", line)
            if m:
                cur = m.group(1)
                text[cur] = []
            elif cur:
                text[cur].append(line)
    return index, {k: "\n".join(v) for k, v in text.items()}


def load_reader(name):
    out = {}
    for f in sorted((HERE / "runs" / name).glob("batch-*.jsonl")):
        for line in f.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(r, dict) and r.get("id"):
                jobs = r.get("jobs") or []
                if isinstance(jobs, str):
                    jobs = [jobs]
                out[r["id"]] = {"jobs": [str(j) for j in jobs], "summary": str(r.get("summary") or "")}
    return out


def embedder():
    """model2vec's potion-base-8M at the revision python/doc-overlap.py pins, or
    None where model2vec is not installed (doc-overlap.py's docstring has the
    venv recipe)."""
    try:
        import numpy as np
        from huggingface_hub import snapshot_download
        from model2vec import StaticModel
    except ImportError:
        return None
    model = StaticModel.from_pretrained(snapshot_download(
        "minishlab/potion-base-8M", revision="bf8b056651a2c21b8d2565580b8569da283cab23",
        allow_patterns=["config.json", "tokenizer.json", "model.safetensors"]))

    def encode(texts):
        v = np.asarray(model.encode(texts, show_progress_bar=False), dtype=np.float32)
        return v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-12)
    return encode


def reader_text(r):
    return "; ".join(r["jobs"]) + ". " + r["summary"]


def build_methods(ids, text, embed=False):
    """Each method as {"has": ids it can rank, "sim": (a, b) -> similarity,
    "reader": the reader's answers or None}. TF-IDF always; embeddings of the
    same texts when embed is set and model2vec loads."""
    out = {}
    readers = {}
    if (HERE / "runs").exists():
        for d in sorted(p.name for p in (HERE / "runs").iterdir() if p.is_dir()):
            r = load_reader(d)
            if r:
                readers[d] = r

    def sparse(name, docs, reader=None):
        vecs = tfidf(docs)
        out[name] = {"has": {i for i in ids if docs[i]}, "sim": lambda a, b, v=vecs: cos(v[a], v[b]), "reader": reader}

    sparse("code", {i: code_tokens(text.get(i, "")) for i in ids})
    for d, r in readers.items():
        # The jobs are counted twice: they are the reader's answer, the summary its gloss.
        sparse(d, {i: words((" ".join(r[i]["jobs"]) + " ") * 2 + r[i]["summary"]) if i in r else [] for i in ids}, r)
    encode = embedder() if embed else None
    if encode:
        def dense(name, texts, reader=None):
            have = [i for i in ids if texts.get(i)]
            at = {i: n for n, i in enumerate(have)}
            mat = encode([texts[i] for i in have])
            out[name] = {"has": set(have), "sim": lambda a, b: float(mat[at[a]] @ mat[at[b]]), "reader": reader}
        dense("code+emb", {i: text.get(i, "") for i in ids})
        for d, r in readers.items():
            dense(d + "+emb", {i: reader_text(r[i]) for i in ids if i in r}, r)
    return out


def top_pairs(ids, file_of, group_of, meth, n):
    """The n most similar cross-file pairs the key does not already hold."""
    has, sim, best = meth["has"], meth["sim"], []
    for i, a in enumerate(ids):
        if a not in has:
            continue
        for b in ids[i + 1:]:
            if b in has and file_of[a] != file_of[b] and not (group_of.get(a, set()) & group_of.get(b, set())):
                best.append((sim(a, b), a, b))
    best.sort(reverse=True)
    return best[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", type=int, default=0)
    ap.add_argument("--json")
    ap.add_argument("--embed", action="store_true", help="add model2vec rows (needs model2vec)")
    args = ap.parse_args()

    index, text = load_units()
    file_of = {u["id"]: u["file"] for u in index}
    name_of = {u["id"]: u["name"].split(" > ")[-1] for u in index}
    ids = [u["id"] for u in index]
    key = json.load(open(HERE / "key.json"))
    group_of = {}
    for g in key["groups"]:
        for m in g["members"]:
            group_of.setdefault(m, set()).add(g["id"])

    def related(g, uid):
        return any(uid == r or (":" not in r and file_of.get(uid) == r) for r in g["related"])

    methods = build_methods(ids, text, args.embed)
    report = {"units": len(ids), "methods": {}}
    for mname, meth in methods.items():
        sim, has, reader = meth["sim"], meth["has"], meth["reader"]
        covered = len(has)
        rows, per_group = [], {}
        for g in key["groups"]:
            ranks = []
            for m in g["members"]:
                fellows = [f for f in g["members"] if f != m and file_of[f] != file_of[m]]
                if not fellows or m not in has:
                    continue
                cands = [c for c in ids if file_of[c] != file_of[m] and not related(g, c)]
                scored = sorted(cands, key=lambda c: -sim(m, c) if c in has else 1.0)
                rank = min(scored.index(f) + 1 for f in fellows)
                ranks.append(rank)
                rows.append({"group": g["id"], "member": m, "rank": rank})
            per_group[g["id"]] = ranks
        all_ranks = [r["rank"] for r in rows]
        summary = {f"recall@{k}": round(sum(r <= k for r in all_ranks) / len(all_ranks), 2) if all_ranks else None for k in KS}
        summary["mrr"] = round(sum(1 / r for r in all_ranks) / len(all_ranks), 2) if all_ranks else None
        summary["members_scored"] = len(all_ranks)
        summary["units_described"] = covered
        summary["by_group"] = {g: ranks for g, ranks in per_group.items()}
        if args.pairs:
            summary["top_pairs"] = [
                {"score": round(s, 3), "a": a, "b": b, "a_name": name_of[a], "b_name": name_of[b],
                 **({"a_jobs": reader[a]["jobs"], "b_jobs": reader[b]["jobs"]} if reader else {})}
                for s, a, b in top_pairs(ids, file_of, group_of, meth, args.pairs)
            ]
        report["methods"][mname] = summary

    if args.json:
        Path(args.json).write_text(json.dumps(report, indent=1) + "\n")
    print(f"{'method':10} {'described':>9} {'scored':>6} " + " ".join(f"{'@' + str(k):>5}" for k in KS) + f" {'mrr':>5}")
    for mname, s in report["methods"].items():
        print(f"{mname:10} {s['units_described']:>9} {s['members_scored']:>6} "
              + " ".join(f"{s['recall@' + str(k)] if s['recall@' + str(k)] is not None else '-':>5}" for k in KS)
              + f" {s['mrr'] if s['mrr'] is not None else '-':>5}")
        print("           " + "  ".join(f"{g}:{r}" for g, r in s["by_group"].items()))


if __name__ == "__main__":
    main()
