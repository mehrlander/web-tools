#!/usr/bin/env python3
"""The wording audit's own steps, around web-tools' python/annotate tools.

    run.py slices <run-dir> [--parts 2]
        units.jsonl -> slice-A.tsv, slice-B.tsv, ...: contiguous parts of near
        equal word count, one row per unit (uid, kind, text), for the readers.

    run.py merge <run-dir> [--vocab <vocab.tsv>]
        read-*.tsv -> labels.tsv and notes.json, by the merge rule below.

    run.py link <payload.json>
        the audit-render link carrying the payload in its fragment, opening on
        Review. The standoff's `self` is left out: a payload in a link has no
        committed file to save an edit to, so the page offers the patch instead.

    run.py provenance <sessions-store> "<phrase>" ["<phrase>" ...]
        the owner's recorded prompts that share the most of a phrase's
        distinctive words, for a phrase a reader would cut, rarer words
        counting for more. <sessions-store> is the checkout the sessions skill
        attaches. Words match by stem, so a rewording of the phrase can still
        find the prompt; a prompt relayed from outside the session (it has an
        `origin`) is not the owner's and is skipped. The hits are candidates:
        read them before calling a phrase the owner's.

A reader's file has the columns uid, label, verdict, confidence, note, one row
per unit of its slice, and is named read-<part>-<n>.tsv.

THE MERGE RULE. Every unit is read by at least two readers. A unit every reader
flags takes the label of the most confident one (the first, on a tie) and is
DROP only if every reader said DROP. A unit fewer readers flag stays OK and
KEEP. Every flagged reader's note is kept on the unit, so a single reader's
flag still reaches the page as a note.
"""
import base64, csv, gzip, json, math, pathlib, re, subprocess, sys
from collections import Counter

HERE = pathlib.Path(__file__).resolve().parent
VOCAB = HERE.parent / "vocab.tsv"
PAGE = "https://mehrlander.github.io/web-tools/pages/audit-render.html"
RANK = {"high": 2, "low": 1}
COUNT = {2: "two", 3: "three", 4: "four"}


def tsv(path):
    return list(csv.DictReader(open(path, encoding="utf-8"), delimiter="\t",
                               quoting=csv.QUOTE_NONE))


def units(run):
    return [json.loads(l) for l in open(run / "units.jsonl", encoding="utf-8") if l.strip()]


def slices(run, parts):
    us = units(run)
    total = sum(u["words"] for u in us)
    cut, acc, out = 1, 0, [[]]
    for u in us:
        if acc >= total * cut / parts and len(out) < parts:
            out.append([]); cut += 1
        out[-1].append(u); acc += u["words"]
    for i, part in enumerate(out):
        f = run / f"slice-{chr(65 + i)}.tsv"
        rows = ["uid\tkind\ttext"] + [f"{u['uid']}\t{u['kind']}\t{' '.join(u['text'].split())}"
                                      for u in part]
        f.write_text("\n".join(rows) + "\n", encoding="utf-8")
        print(f"wrote {f.name}: {len(part)} units, {part[0]['uid']} to {part[-1]['uid']}, "
              f"{sum(u['words'] for u in part)} words")


def merge(run, vocab):
    labels = {r["label"] for r in tsv(vocab)}
    reads = sorted(run.glob("read-*.tsv"))
    if not reads:
        sys.exit(f"no read-*.tsv in {run}")
    by = {}
    for f in reads:
        for r in tsv(f):
            bad = [k for k, ok in (("label", r["label"] in labels),
                                   ("verdict", r["verdict"] in ("KEEP", "DROP")),
                                   ("confidence", r["confidence"] in RANK)) if not ok]
            if bad:
                sys.exit(f"{f.name} {r['uid']}: {', '.join(bad)} not recognized")
            by.setdefault(r["uid"], []).append(r)
    out, notes, tally = ["uid\tlabel\tverdict"], [], Counter()
    for u in units(run):
        rows = by.get(u["uid"], [])
        if len(rows) < 2:
            sys.exit(f"{u['uid']}: read by {len(rows)} reader(s); the rule needs two")
        flagged = [r for r in rows if r["label"] != "OK"]
        label, verdict = "OK", "KEEP"
        if len(flagged) == len(rows):
            label = max(flagged, key=lambda r: RANK[r["confidence"]])["label"]
            verdict = "DROP" if all(r["verdict"] == "DROP" for r in rows) else "KEEP"
        out.append(f"{u['uid']}\t{label}\t{verdict}")
        tally[label] += 1; tally[verdict] += verdict == "DROP"
        said = lambda r: f"({r['label']}, {r['confidence']}): {r['note'].strip()}"
        if len(flagged) == len(rows):
            text = "Both readers." if len(rows) == 2 else "Every reader."
            text += "".join(f"\nReader {i} {said(r)}" for i, r in enumerate(rows, 1))
        elif flagged:
            text = "\n".join(f"One reader of {COUNT.get(len(rows), len(rows))} {said(r)}"
                             for r in flagged)
        else:
            continue
        notes.append({"op": "note", "uid": u["uid"], "text": text})
    (run / "labels.tsv").write_text("\n".join(out) + "\n", encoding="utf-8")
    (run / "notes.json").write_text(json.dumps(notes, ensure_ascii=False, indent=1) + "\n",
                                    encoding="utf-8")
    print(f"wrote labels.tsv and notes.json from {len(reads)} readers: "
          + ", ".join(f"{k} {v}" for k, v in sorted(tally.items()) if v)
          + f", {len(notes)} noted")


def link(payload):
    p = json.loads(pathlib.Path(payload).read_text(encoding="utf-8"))
    p["standoff"].pop("self", None)
    raw = gzip.compress(json.dumps(p, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0)
    print(f"{PAGE}#gz={base64.urlsafe_b64encode(raw).decode().rstrip('=')}&view=review")


STOP = set("about above after again also always among another because before being "
           "between could does doing during every first their there these those "
           "through under until where which while whose would should other".split())


def stem(w):
    for suf in ("ings", "ing", "ers", "er", "es", "ed", "ly", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[:-len(suf)]
    return w


def provenance(store, phrases):
    # search.py owns reading the records, including the older ones whose
    # prompts still hold injected skill bodies, so one call loads them all.
    out = subprocess.run([sys.executable, str(pathlib.Path(store) / "sessions/tools/search.py"),
                          "--json", "--limit", "1000000"], capture_output=True, text=True, check=True)
    prompts = [(r.get("session_id", "")[:8], p.get("at", "")[:10], p.get("text", ""))
               for r in json.loads(out.stdout) for p in r.get("prompts") or [] if not p.get("origin")]
    lows = [t.lower() for _, _, t in prompts]
    for phrase in phrases:
        stems = sorted({stem(w) for w in re.findall(r"[a-z]+", phrase.lower())
                        if len(w) >= 5 and w not in STOP})
        idf = {w: math.log(len(lows) / (1 + sum(w in t for t in lows))) for w in stems}
        need = min(2, len(stems))
        hits = []
        for (sid, day, text), low in zip(prompts, lows):
            found = [w for w in stems if w in low]
            if found and len(found) >= need:
                at = low.find(max(found, key=idf.get))
                hits.append((round(sum(idf[w] for w in found), 1), day, sid, found, at, text))
        hits.sort(key=lambda h: (h[0], h[1]), reverse=True)
        print(f'"{phrase}": {len(hits)} prompt(s) share {need} or more of {", ".join(stems) or "no distinctive word"}')
        for score, day, sid, found, at, text in hits[:5]:
            print(f"  {day} {sid} {score} ({', '.join(found)}) …{' '.join(text[max(0, at - 100):at + 120].split())}…")

if __name__ == "__main__":
    a = sys.argv[1:]
    def opt(flag, default):
        if flag in a:
            i = a.index(flag); v = a[i + 1]; del a[i:i + 2]; return v
        return default
    parts, vocab = int(opt("--parts", 2)), pathlib.Path(opt("--vocab", VOCAB))
    if a[:1] == ["provenance"] and len(a) >= 3:
        provenance(a[1], a[2:]); sys.exit()
    if len(a) != 2 or a[0] not in ("slices", "merge", "link"):
        sys.exit(__doc__)
    cmd, arg = a
    if cmd == "slices":
        slices(pathlib.Path(arg), parts)
    elif cmd == "merge":
        merge(pathlib.Path(arg), vocab)
    else:
        link(arg)
