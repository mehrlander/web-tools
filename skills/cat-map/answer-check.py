"""Answer check for a category map: does the answer agree with the coding?

The answer is what the page draws as a poster, so every placement on it has to
follow from the coded instances of one run, its `basis`. Checked:

  grid       each example is an instance of the basis run, has the values of
             its cell on the grid's two characteristics, and meets no add-on
             word's condition, so a cell shows only plain cases
  add        each example meets its word's condition: `requires`, a map of
             characteristic to value (or list of values), and `called`, senses
             of which it must be called by at least one
  renames    each thing is called by a sense of the word it is renamed from,
             and meets the condition of the word it becomes, when that word is
             one the answer defines
  runs       every `runs` index names a run

It also lists the basis instances the answer places nowhere: in no cell and
under no add-on word. That list is information, not a failure; an instance can
fall outside the grid on purpose.

Exit status 1 when any check fails.

python3 answer-check.py map.json [map.json ...]
"""
import json, sys

NA = 'n/a'


def check(doc):
    """Returns (errors, unplaced) for one catmap/1 document."""
    a = doc.get('answer')
    if not a:
        return [], []
    errs = []
    nruns = len(doc['runs'])
    run = doc['runs'][a.get('basis', 0)]
    inst = {i['id']: i for i in run['instances']}
    word_of = {c['id']: c['word'] for c in run['categories']}

    def val(i, char):
        return (i.get('values') or {}).get(char, NA)

    def meets(i, requires=None, called=None):
        for char, want in (requires or {}).items():
            if val(i, char) not in (want if isinstance(want, list) else [want]):
                return False
        return not called or any(c in (i.get('called') or []) for c in called)

    def known(where, ident):
        if ident not in inst:
            errs.append(f'{where}: {ident} is not an instance of the basis run')
            return False
        return True

    adds = a.get('add', [])
    grid = a.get('grid')
    cells = {}
    if grid:
        ax, dn = grid['across'], grid['down']
        for r, row in enumerate(grid['cells']):
            for c, cell in enumerate(row):
                cond = {ax['char']: ax['values'][c]['is'], dn['char']: dn['values'][r]['is']}
                name = cell.get('word') or f'empty cell {r + 1},{c + 1}'
                if cell.get('word'):
                    cells[cell['word']] = cond
                for e in cell.get('examples', []):
                    if not known(f'grid {name}', e):
                        continue
                    if not meets(inst[e], cond):
                        errs.append(f'grid {name}: {e} is not coded {cond}')
                    for w in adds:
                        if meets(inst[e], w.get('requires'), w.get('called')):
                            errs.append(f'grid {name}: {e} is also a {w["word"]}, so it is not a plain case')
    for w in adds:
        for e in w.get('examples', []):
            if known(f'add {w["word"]}', e) and not meets(inst[e], w.get('requires'), w.get('called')):
                errs.append(f'add {w["word"]}: {e} does not meet {w.get("requires") or {}} {w.get("called") or ""}'.rstrip())
    conds = {**cells, **{w['word']: (w.get('requires'), w.get('called')) for w in adds}}
    for n in a.get('renames', []):
        for t in n.get('things', []):
            if not known(f'rename {n["from"]}', t):
                continue
            if n['from'] not in [word_of.get(c) for c in inst[t].get('called') or []]:
                errs.append(f'rename {n["from"]}: {t} is not called {n["from"]} in the basis run')
            target = conds.get(n.get('becomes'))
            if target is not None:
                ok = meets(inst[t], target) if isinstance(target, dict) else meets(inst[t], *target)
                if not ok:
                    errs.append(f'rename to {n["becomes"]}: {t} does not meet its condition')
    rows = [grid] if grid else []
    for row in rows + adds + a.get('renames', []) + a.get('open', []):
        for k in row.get('runs', []):
            if not 0 <= k < nruns:
                errs.append(f'runs: {k} names no run')

    placed = set()
    for i in run['instances']:
        if grid and any(meets(i, cond) for cond in cells.values()) or any(meets(i, w.get('requires'), w.get('called')) for w in adds):
            placed.add(i['id'])
        elif grid:
            ax, dn = grid['across'], grid['down']
            if any(meets(i, {ax['char']: x['is'], dn['char']: y['is']}) for x in ax['values'] for y in dn['values']):
                placed.add(i['id'])
    return errs, [i['id'] for i in run['instances'] if i['id'] not in placed]


def main(paths):
    bad = 0
    for p in paths:
        errs, unplaced = check(json.load(open(p, encoding='utf-8')))
        print(f'== {p}: {"ok" if not errs else f"{len(errs)} problem(s)"}')
        for e in errs:
            print('  ' + e)
        if unplaced:
            print('  placed nowhere: ' + ', '.join(unplaced))
        bad += bool(errs)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
