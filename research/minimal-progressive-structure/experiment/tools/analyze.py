"""Unblind the judgments and tabulate them by arm.

Usage: python3 analyze.py <experiment-dir>
Reads judgments/*.json, judgments/blind-key.json and judgments/measures.json;
prints Markdown tables to stdout. Arms: bare, house, mps, house-mps; a
replicate suffix (wacares-mps2) folds into its arm.
"""
import itertools
import json
import os
import re
import sys
from collections import defaultdict

E = sys.argv[1]
J = os.path.join(E, 'judgments')
key = json.load(open(os.path.join(J, 'blind-key.json')))
measures = json.load(open(os.path.join(J, 'measures.json')))
ARMS = ['bare', 'house', 'mps', 'house-mps']
LOCS = ['first-screen', 'scroll', '1-step', '2-steps', 'absent', 'wrong']


def arm(page):
    return re.sub(r'\d+$', '', page.split('-', 1)[1])


def load(name):
    p = os.path.join(J, name + '.json')
    return json.load(open(p)) if os.path.exists(p) else None


def mean(xs):
    return sum(xs) / len(xs) if xs else float('nan')


subjects = sorted({k.split('/')[0] for k in key})

print('## Designer scores (1 to 10), by page\n')
print('| Source | Page | Arm | Judge A | Judge B | Mean | Rank A | Rank B |')
print('|---|---|---|---|---|---|---|---|')
arm_scores = defaultdict(list)
for s in subjects:
    a, b = load(f'{s}-designera'), load(f'{s}-designerb')
    if not (a and b):
        continue
    rows = []
    for code in a['pages']:
        page = key[f'{s}/{code}']
        sa, sb = a['pages'][code]['score'], b['pages'][code]['score']
        rows.append((-(sa + sb), page, arm(page), sa, sb, a['ranking'].index(code) + 1, b['ranking'].index(code) + 1))
        arm_scores[(s, arm(page))].append((sa + sb) / 2)
    for r in sorted(rows):
        print(f'| {s} | {r[1]} | {r[2]} | {r[3]} | {r[4]} | {(r[3] + r[4]) / 2:.1f} | {r[5]} | {r[6]} |')

print('\n## Designer mean score by arm\n')
print('| Source | ' + ' | '.join(ARMS) + ' |')
print('|---|' + '---|' * len(ARMS))
for s in subjects:
    cells = [f'{mean(arm_scores[(s, x)]):.1f}' if arm_scores[(s, x)] else '' for x in ARMS]
    print(f'| {s} | ' + ' | '.join(cells) + ' |')

print('\n## Where the answers sit (locator judge), by page\n')
print('| Source | Page | Arm | ' + ' | '.join(LOCS) + ' | Scent false |')
print('|---|---|---|' + '---|' * (len(LOCS) + 1))
for s in subjects:
    loc = load(f'{s}-locator')
    if not loc:
        continue
    for code, v in sorted(loc['pages'].items(), key=lambda kv: key[f'{s}/{kv[0]}']):
        page = key[f'{s}/{code}']
        n = defaultdict(int)
        scent_false = 0
        for ans in v['answers'].values():
            n[ans['loc']] += 1
            scent_false += ans.get('scent') is False
        print(f'| {s} | {page} | {arm(page)} | ' + ' | '.join(str(n[x]) for x in LOCS) + f' | {scent_false} |')

print('\n## Mechanical measures at 1440x900, by page\n')
print('| Page | Visible words | Words on first screen | Controls | Page height (px) |')
print('|---|---|---|---|---|')
for page in sorted(measures):
    d = measures[page]['desktop']
    print(f"| {page} | {d['words_visible']} | {d['words_first_screen']} | {d['controls_visible']} | {d['scroll_height']} |")

st = load('wacares-structure')
if st:
    P, things = st['pages'], [t['id'] for t in st['things']]
    by_page = {key[f'wacares/{c}']: c for c in P}

    def agree(a, b):
        return mean([P[a]['treatment'][t] == P[b]['treatment'][t] for t in things])

    def views(c):
        return {t for t in things if P[c]['treatment'][t] == 'view'}

    print(f'\n## WA Cares structure ({len(things)} named things)\n')
    print('| Pages compared | Same treatment | Same views (Jaccard) |')
    print('|---|---|---|')
    for label, names in [('bare replicates', ['wacares-bare1', 'wacares-bare2', 'wacares-bare3']),
                         ('mps replicates', ['wacares-mps1', 'wacares-mps2', 'wacares-mps3'])]:
        cs = [by_page[n] for n in names]
        pairs = list(itertools.combinations(cs, 2))
        t = mean([agree(a, b) for a, b in pairs])
        j = mean([len(views(a) & views(b)) / len(views(a) | views(b)) for a, b in pairs])
        print(f'| {label}, three pairs | {t:.2f} | {j:.2f} |')
    cross = [(by_page[a], by_page[b]) for a in ['wacares-bare1', 'wacares-bare2', 'wacares-bare3']
             for b in ['wacares-mps1', 'wacares-mps2', 'wacares-mps3']]
    print(f"| bare against mps, nine pairs | {mean([agree(a, b) for a, b in cross]):.2f} | |")
    print('\n| Page | Root, as the judge described it | Things with a view |')
    print('|---|---|---|')
    for name in sorted(by_page):
        c = by_page[name]
        print(f"| {name} | {P[c]['root']} | {', '.join(sorted(views(c)))} |")
