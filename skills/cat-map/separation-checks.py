"""Separation checks for a category map.

Reads a catmap/1 JSON file (every run in it) or a CSV whose first column is
`instance` and whose other columns are characteristics, one value per cell
(`n/a` where the characteristic does not apply), and reports what each check
finds:

  constant      a characteristic with one value wherever it applies
  same split    two characteristics that divide the instances identically
  fixed by      a characteristic whose value is fixed once another's is known
  identical     instances no characteristic separates
  unseparated   an unsure pair that nothing separates
  empty         value combinations of two characteristics that no instance has
  reducts       the smallest sets of characteristics that keep apart every
                pair the whole table keeps apart, and the core: those a pair
                depends on alone (report only)

For JSON, the unsure pairs are the run's `pairs` and the crosses its `field`
plus `crosses`. For CSV, arguments after the file are pairs, written "a|b",
and crosses, written "x:c1,c2"; with no cross named, every pair of
characteristics with two to four values is crossed.

--write puts the findings into each run of a JSON file as `findings`, which
pages/cat-map.html draws.

python3 separation-checks.py map.json --write
python3 separation-checks.py coded.csv "writers.csv|direct-to-main.csv" x:stands_for,after_written
"""
import csv, itertools, json, sys
from collections import defaultdict

NA = 'n/a'


def check(rows, chars, pairs, crosses):
    """rows: [{'instance': id, char: value, ...}]. Returns a list of findings."""
    by = {r['instance']: r for r in rows}
    out = []

    def split(c):
        groups = defaultdict(set)
        for r in rows: groups[r[c]].add(r['instance'])
        return frozenset(frozenset(g) for g in groups.values())

    def separating(a, b, cs=chars):
        return [c for c in cs if by[a][c] != by[b][c]]

    for c in chars:
        applies = {r[c] for r in rows if r[c] != NA}
        if len(applies) == 1:
            out.append({'kind': 'constant', 'chars': [c], 'text': f'{c} is {next(iter(applies))} wherever it applies, so it separates nothing'})
    for a, b in itertools.combinations(chars, 2):
        if split(a) == split(b):
            out.append({'kind': 'same', 'chars': [a, b], 'text': f'{a} and {b} divide the instances identically'})
    for a, b in itertools.permutations(chars, 2):
        seen = defaultdict(set)
        for r in rows: seen[r[a]].add(r[b])
        constant_b = len({r[b] for r in rows if r[b] != NA}) <= 1
        if all(len(v) == 1 for v in seen.values()) and split(a) != split(b) and not constant_b:
            out.append({'kind': 'fixed', 'chars': [b, a], 'text': f'{b} is fixed once {a} is known'})
    groups = defaultdict(list)
    for r in rows: groups[tuple(r[c] for c in chars)].append(r['instance'])
    for g in groups.values():
        if len(g) > 1:
            out.append({'kind': 'identical', 'instances': g, 'text': 'no characteristic separates ' + ', '.join(g)})
    for a, b in pairs:
        if a in by and b in by and not separating(a, b):
            out.append({'kind': 'unseparated', 'instances': [a, b], 'text': f'nothing separates {a} from {b}'})
    for a, b in crosses:
        va = sorted({r[a] for r in rows} - {NA}); vb = sorted({r[b] for r in rows} - {NA})
        have = {(r[a], r[b]) for r in rows}
        for x in va:
            for y in vb:
                if (x, y) not in have:
                    out.append({'kind': 'empty', 'chars': [a, b], 'values': [x, y], 'text': f'no instance is {x} and {y}'})
    return out


def reducts(rows, chars):
    by = {r['instance']: r for r in rows}
    sep = lambda a, b, cs: [c for c in cs if by[a][c] != by[b][c]]
    kept = [(a['instance'], b['instance']) for a, b in itertools.combinations(rows, 2) if sep(a['instance'], b['instance'], chars)]
    for k in range(1, len(chars) + 1):
        found = [s for s in itertools.combinations(chars, k) if all(sep(a, b, s) for a, b in kept)]
        if found:
            core = {c: [f'{a} | {b}' for a, b in kept if sep(a, b, chars) == [c]] for c in chars}
            return found, {c: v for c, v in core.items() if v}
    return [], {}


def report(name, rows, chars, findings):
    print(f'== {name}')
    for f in findings:
        print(f"  {f['kind']}: {f['text']}")
    found, core = reducts(rows, chars)
    for s in found:
        print('  reduct: ' + ', '.join(s))
    for c, v in core.items():
        print(f'  core {c}: ' + '; '.join(v))


def main(argv):
    path, rest = argv[1], argv[2:]
    if path.endswith('.json'):
        doc = json.load(open(path, encoding='utf-8'))
        for run in doc['runs']:
            chars = [c['id'] for c in run['characteristics']]
            rows = [{'instance': i['id'], **{c: i['values'].get(c, NA) for c in chars}} for i in run['instances']]
            field = run.get('field') or {}
            crosses = [tuple(x) for x in run.get('crosses', [])] or ([(field['x'], field['y'])] if field.get('x') and field.get('y') else [])
            findings = check(rows, chars, [tuple(p) for p in run.get('pairs', [])], crosses)
            report(run.get('by', 'run'), rows, chars, findings)
            run['findings'] = findings
        if '--write' in rest:
            json.dump(doc, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('wrote findings into', path)
        return
    rows = list(csv.DictReader(open(path, encoding='utf-8')))
    chars = [c for c in rows[0] if c != 'instance']
    pairs = [tuple(p.split('|')) for p in rest if '|' in p]
    crosses = [tuple(p[2:].split(',')) for p in rest if p.startswith('x:')]
    if not crosses:
        small = [c for c in chars if 2 <= len({r[c] for r in rows if r[c] != NA}) <= 4]
        crosses = list(itertools.combinations(small, 2))
    report(path, rows, chars, check(rows, chars, pairs, crosses))


if __name__ == '__main__':
    main(sys.argv)
