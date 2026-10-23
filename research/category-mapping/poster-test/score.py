"""Score the poster readers against a key recomputed from the map's coding.

The key passes each collection's coded values (the answer's basis run) through
the answer's own grid and add-on conditions, so it moves when the coding does.

python3 research/category-mapping/poster-test/score.py
"""
import json, glob, os, sys
_repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
_d = json.load(open(os.path.join(_repo, 'research', 'category-mapping', 'collections-map.json')))
_A = _d['answer']; _run = _d['runs'][_A.get('basis', 0)]; _inst = {i['id']: i for i in _run['instances']}
def _meets(i, req=None, called=None):
    for c, w in (req or {}).items():
        if i['values'].get(c, 'n/a') not in (w if isinstance(w, list) else [w]): return False
    return not called or any(x in i.get('called', []) for x in called)
def _key(iid):
    i, g, box = _inst[iid], _A['grid'], 'none'
    for r, dv in enumerate(g['down']['values']):
        for c, av in enumerate(g['across']['values']):
            if _meets(i, {g['across']['char']: av['is'], g['down']['char']: dv['is']}): box = g['cells'][r][c]['word'] or 'no word yet'
    return box, [w['word'] for w in _A['add'] if _meets(i, w.get('requires'), w.get('called'))]
# The key, recomputed from the current coding through the answer's own rules.
KEY = {n: (iid, *_key(iid)) for n, iid in enumerate(['aims-reading', 'trackers-md', 'outpost-observations', 'traffic-ledger', 'sessions-cache', 'source-bundle', 'decision-ledger', 'errands'], 1)}
here = os.path.dirname(os.path.abspath(__file__))
runs = {}
for p in sorted(glob.glob(os.path.join(here, 'reader-*.json'))):
    d = json.load(open(p)); runs[d.get('by', os.path.basename(p))] = {a['n']: a for a in d['answers']}
rows, box_hits, full_hits, n_scored = [], {r: 0 for r in runs}, {r: 0 for r in runs}, 7
for n, (iid, box, adds) in KEY.items():
    cells = []
    for r, ans in runs.items():
        a = ans.get(n, {})
        b_ok = a.get('box') == box
        f_ok = b_ok and sorted(a.get('adds', [])) == sorted(adds)
        if n <= n_scored: box_hits[r] += b_ok; full_hits[r] += f_ok
        cells.append(f"{a.get('box','?')}{'+' + '+'.join(a.get('adds', [])) if a.get('adds') else ''}{' ✓' if f_ok else (' ~' if b_ok else ' ✗')} ({a.get('confidence','?')})")
    rows.append((n, iid, box + ('+' + '+'.join(adds) if adds else ''), cells))
print('readers:', ', '.join(runs))
for n, iid, k, cells in rows:
    print(f"{n}. {iid:22} key {k:24} | " + ' | '.join(cells))
for r in runs:
    print(f"{r}: box right {box_hits[r]}/{n_scored}, box and adds right {full_hits[r]}/{n_scored}")
