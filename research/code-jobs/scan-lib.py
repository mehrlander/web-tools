#!/usr/bin/env python3
"""The code-text method over every lib/ file: no model, only the units' identifiers.

    node research/code-jobs/unitize.mjs <units.jsonl> $(git ls-files 'lib/*.js' 'lib/**/*.js' | grep -v -E '/demos/|/vendor/|\\.min\\.js')
    python3 research/code-jobs/scan-lib.py <units.jsonl> [--top N]

Ranks cross-file function pairs by TF-IDF cosine of their identifiers, the
`code` method score.py scores against the key, keeping each unit's three
nearest partners in other files. Prints the top N pairs and how many clear
0.99, 0.9 and 0.8. Needs numpy, for the one matrix product that makes a pass
over five thousand units take seconds.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import score  # noqa: E402

path = sys.argv[1]
top = int(sys.argv[sys.argv.index("--top") + 1]) if "--top" in sys.argv else 30
units = list({u["id"]: u for u in map(json.loads, open(path))}.values())
ids = [u["id"] for u in units]
files = np.array([u["file"] for u in units])
vec = score.tfidf({u["id"]: score.code_tokens(u["text"]) for u in units})
vocab = {w: i for i, w in enumerate(sorted({w for v in vec.values() for w in v}))}
M = np.zeros((len(ids), len(vocab)), dtype=np.float32)
for r, i in enumerate(ids):
    for w, x in vec[i].items():
        M[r, vocab[w]] = x

best = []
for s in range(0, len(ids), 500):
    block = M[s:s + 500] @ M.T
    for r in range(block.shape[0]):
        g, row = s + r, block[r]
        row[files == files[g]] = 0
        row[:g + 1] = 0
        best += [(float(row[k]), g, int(k)) for k in np.argsort(row)[-3:] if row[k] > 0]
best.sort(reverse=True)

print(f"{len(ids)} units in {len(set(files))} files")
for sc, a, b in best[:top]:
    name = lambda i: units[i]["name"].split(" > ")[-1][:24]
    print(f"{sc:.2f}  {ids[a]} {name(a)}  <->  {ids[b]} {name(b)}")
for t in (0.99, 0.9, 0.8):
    sel = [(a, b) for sc, a, b in best if sc >= t]
    print(f">= {t}: {len(sel)} pairs touching {len({files[a] for a, _ in sel} | {files[b] for _, b in sel})} files")
print(">= 0.9 with both units 8+ lines:",
      sum(1 for sc, a, b in best if sc >= 0.9 and units[a]["own_lines"] >= 8 and units[b]["own_lines"] >= 8))
