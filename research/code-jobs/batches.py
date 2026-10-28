#!/usr/bin/env python3
"""Pack the unitizer's output into reader batches, and keep an index without the text.

    python3 research/code-jobs/batches.py <units-with-text.jsonl>

Writes batches/batch-NN.txt, each unit as a `=== UNIT <id> | <name> ===` header
and its text, packed in file order until a batch would pass MAX_LINES (so a
reader's Read call takes it whole), and units.jsonl, one row per unit with
everything but the text. The batches are what every reader saw; the index is
what the scorer joins on.
"""
import json
import sys
from pathlib import Path

MAX_LINES = 1700
HERE = Path(__file__).resolve().parent

units = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
batches, cur, n = [], [], 0
for u in units:
    block = f"=== UNIT {u['id']} | {u['name']} ===\n{u['text']}\n"
    size = block.count('\n')
    if cur and n + size > MAX_LINES:
        batches.append(cur)
        cur, n = [], 0
    cur.append(block)
    n += size

if cur:
    batches.append(cur)

out = HERE / 'batches'
out.mkdir(exist_ok=True)
for old in out.glob('batch-*.txt'):
    old.unlink()
for i, b in enumerate(batches, 1):
    (out / f'batch-{i:02}.txt').write_text(''.join(b))

with open(HERE / 'units.jsonl', 'w') as f:
    for u in units:
        f.write(json.dumps({k: v for k, v in u.items() if k != 'text'}) + '\n')

print(f'{len(units)} units in {len(batches)} batches:',
      ', '.join(str(sum(1 for line in b if line.startswith('=== UNIT'))) for b in batches))
