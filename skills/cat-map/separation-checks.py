"""Separation checks for an instance-by-characteristic table.

Reads a CSV whose first column is `instance` and whose other columns are
characteristics, one value per cell (`n/a` where the characteristic does not
apply), and prints what each check finds:

  constant      a characteristic with one value wherever it applies
  same split    two characteristics that divide the instances identically
  fixed by      a characteristic whose value is fixed once another's is known
  identical     instances no characteristic separates
  pairs         for each pair named on the command line, what separates it
  reducts       the smallest sets of characteristics that keep apart every
                pair the whole table keeps apart, and the core: those a pair
                depends on alone
  empty cells   value combinations of two characteristics that no instance has

Arguments after the CSV are pairs to report on, written "a|b", and crosses to
search for empty cells, written "x:c1,c2"; with no cross named, every pair of
characteristics with two to four values is crossed.

python3 separation-checks.py coded.csv "writers.csv|direct-to-main.csv" x:stands_for,after_written
"""
import csv, itertools, sys
from collections import defaultdict

rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
chars = [c for c in rows[0] if c != 'instance']
by = {r['instance']: r for r in rows}
named_pairs = [tuple(p.split('|')) for p in sys.argv[2:] if '|' in p]
crosses = [tuple(p[2:].split(',')) for p in sys.argv[2:] if p.startswith('x:')]
NA = 'n/a'

def split(c):
    groups = defaultdict(set)
    for r in rows: groups[r[c]].add(r['instance'])
    return frozenset(frozenset(g) for g in groups.values())

def separating(a, b, cs=chars): return [c for c in cs if by[a][c] != by[b][c]]

print('constant')
for c in chars:
    applies = {r[c] for r in rows if r[c] != NA}
    if len(applies) == 1: print(f'  {c}: {applies.pop()} wherever it applies')

print('same split')
for a, b in itertools.combinations(chars, 2):
    if split(a) == split(b): print(f'  {a} = {b}')

print('fixed by')
for a, b in itertools.permutations(chars, 2):
    seen = defaultdict(set)
    for r in rows: seen[r[a]].add(r[b])
    if all(len(v) == 1 for v in seen.values()) and split(a) != split(b):
        print(f'  {b} is fixed by {a}')

print('identical')
groups = defaultdict(list)
for r in rows: groups[tuple(r[c] for c in chars)].append(r['instance'])
for g in groups.values():
    if len(g) > 1: print('  ' + ', '.join(g))

print('pairs')
for a, b in named_pairs:
    print(f'  {a} | {b}: {", ".join(separating(a, b)) or "NOTHING SEPARATES THEM"}')

kept_apart = [(a['instance'], b['instance']) for a, b in itertools.combinations(rows, 2)
              if separating(a['instance'], b['instance'])]
print('reducts')
for k in range(1, len(chars) + 1):
    found = [s for s in itertools.combinations(chars, k)
             if all(separating(a, b, s) for a, b in kept_apart)]
    if found:
        for s in found: print('  ' + ', '.join(s))
        break
for c in chars:
    alone = [f'{a} | {b}' for a, b in kept_apart if separating(a, b) == [c]]
    if alone: print(f'  core {c}: ' + '; '.join(alone))

print('empty cells')
small = [c for c in chars if 2 <= len({r[c] for r in rows if r[c] != NA}) <= 4]
for a, b in crosses or itertools.combinations(small, 2):
    va = sorted({r[a] for r in rows} - {NA}); vb = sorted({r[b] for r in rows} - {NA})
    have = {(r[a], r[b]) for r in rows}
    empty = [f'({x}, {y})' for x in va for y in vb if (x, y) not in have]
    if empty: print(f'  {a} x {b}: ' + ', '.join(empty))
