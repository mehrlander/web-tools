#!/usr/bin/env python3
"""Gold set for the Restated lens: hand-labelled passage pairs that score a cutoff.

scripts/doc-overlap.py nominates passage pairs by cosine. What it cannot say is
whether a nominated pair restates, merely shares a subject, or contradicts. This
builds the sample, blinds it, checks what the readers and skeptics return, and
scores cutoffs against their labels. The method is the portable gold-set skill;
the committed record is data/doc-overlap/gold-set/.

    sample    stratified, seeded draw of passage pairs -> run dir: sample.csv, batches
    check     validate a reader (or --skeptic) output file against its batch
    skeptic   prepare a skeptic batch from a checked reader file
    merge     join sample, readers and skeptics into gold.csv
    score     figures block for the scorecard, from gold.csv

THE LABELS, which the reader prompt quotes from here and nowhere else:

    same       Both passages make the same claim or give the same instruction,
               copied or reworded; either could stand in for the other without
               losing anything the other says.
    summary    One passage states a shorter or partial version of what the other
               says, and nothing in it contradicts the other.
    related    Same subject, but the passages make different claims or give
               different instructions, and they do not conflict.
    conflict   The passages address the same point and disagree: opposite
               instructions, reversed actors or roles, incompatible facts.
    unrelated  The likeness is vocabulary, formatting or boilerplate only; the
               passages are about different things.
    fragment   (permitted) A passage cannot be read on its own: a list stub, a
               heading remnant, a table row, a line whose meaning is elsewhere.

    reading      yes if someone reading one passage would be helped by seeing
                 the other beside it, else no.
    consolidate  yes if one passage could be replaced by a link to the other
                 without losing information; only for same or summary.

Unit: an unordered pair of passages, one row however many directions matched.
Strata: cosine band (0.05 wide from 0.75, last band 0.95+), whether the two
files share 3+ shingles in docs/themes.csv, and whether the shorter passage is
under 20 words. Seats by the square root of cell size, floor one.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / 'data' / 'doc-overlap' / 'gold-set'
MACHINE_CUT = 0.80          # the lens's default, the claim the skeptic weighs
RELATIONS = ['same', 'summary', 'related', 'conflict', 'unrelated', 'fragment']
RESTATES = {'same', 'summary'}
BATCH = 40


def cut(path, a, b, cache={}):
    """UTF-16 offsets into the file, as the lens slices it."""
    if path not in cache:
        cache[path] = (ROOT / path).read_text(encoding='utf-8').encode('utf-16-le')
    return cache[path][2 * a:2 * b].decode('utf-16-le')


def around(path, a, b, n=500):
    """The surrounding text the skeptic gets and the reader did not."""
    return cut(path, max(0, a - n), a), cut(path, b, b + n)


def band(c):
    return min(4, int(round((c - 0.75) * 1000) // 50))


def sample(args):
    rows = list(csv.DictReader(open(ROOT / 'data/doc-overlap/matches.csv', encoding='utf-8')))
    lit = {tuple(sorted((r['a'], r['b']))) for r in csv.DictReader(open(ROOT / 'docs/themes.csv', encoding='utf-8'))}
    pairs = {}
    for r in rows:
        x = (r['source'], int(r['start']), int(r['end']), int(r['line']), int(r['words']))
        y = (r['target'], int(r['target_start']), int(r['target_end']), int(r['target_line']), None)
        a, b = sorted([x, y], key=lambda t: t[:3])
        key = (a[:3], b[:3])
        p = pairs.setdefault(key, dict(a=a, b=b, cosine=0.0, words={}))
        p['cosine'] = max(p['cosine'], float(r['cosine']))
        p['words'][x[:3]] = x[4]
    universe = []
    for (ka, kb), p in sorted(pairs.items()):
        words = [p['words'].get(k) or len(cut(*k).split()) for k in (ka, kb)]
        universe.append(dict(a_path=ka[0], a_start=ka[1], a_end=ka[2], a_line=p['a'][3],
                             b_path=kb[0], b_start=kb[1], b_end=kb[2], b_line=p['b'][3],
                             cosine=f"{p['cosine']:.3f}",
                             literal='yes' if tuple(sorted((ka[0], kb[0]))) in lit else 'no',
                             short='yes' if min(words) < 20 else 'no'))
    cells = defaultdict(list)
    for u in universe:
        cells[(band(float(u['cosine'])), u['literal'], u['short'])].append(u)
    rng = random.Random(args.seed)
    weight = {k: math.sqrt(len(v)) for k, v in cells.items()}
    total = sum(weight.values())
    chosen = []
    for k in sorted(cells):
        seats = min(len(cells[k]), max(1, round(args.n * weight[k] / total)))
        pick = rng.sample(cells[k], seats)
        for u in pick:
            u['stratum'] = f'b{k[0]}-lit{k[1]}-short{k[2]}'
            u['stratum_size'] = len(cells[k])
            u['stratum_seats'] = seats
        chosen += pick
    rng.shuffle(chosen)
    for i, u in enumerate(chosen):
        u['id'] = f'g{i:03d}'
        u['audit'] = 'yes' if rng.random() < 0.1 else 'no'
    run = Path(args.run)
    run.mkdir(parents=True, exist_ok=True)
    cols = ['id', 'stratum', 'stratum_size', 'stratum_seats', 'audit', 'cosine', 'literal', 'short',
            'a_path', 'a_start', 'a_end', 'a_line', 'b_path', 'b_start', 'b_end', 'b_line']
    with (run / 'sample.csv').open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator='\n')
        w.writeheader()
        w.writerows(chosen)
    # The batch file is the blinding: no cosine, no stratum, no shingle flag.
    for bi in range(0, len(chosen), BATCH):
        with (run / f'batch-{bi // BATCH}.jsonl').open('w', encoding='utf-8') as f:
            for u in chosen[bi:bi + BATCH]:
                f.write(json.dumps(dict(id=u['id'], a_path=u['a_path'], a_line=u['a_line'],
                                        a_text=cut(u['a_path'], u['a_start'], u['a_end']),
                                        b_path=u['b_path'], b_line=u['b_line'],
                                        b_text=cut(u['b_path'], u['b_start'], u['b_end'])),
                                   ensure_ascii=False) + '\n')
    print(f'universe {len(universe)} pairs in {len(cells)} cells; sampled {len(chosen)}; '
          f'{sum(u["audit"] == "yes" for u in chosen)} audit; batches {math.ceil(len(chosen) / BATCH)}')


def load(path):
    return [json.loads(l) for l in open(path, encoding='utf-8') if l.strip()]


def check(args):
    ids = [r['id'] for r in load(args.batch)]
    out, bad = load(args.output), []
    seen = Counter(r.get('id') for r in out)
    for i in ids:
        if seen[i] != 1:
            bad.append(f'{i}: appears {seen[i]} times')
    for r in out:
        i = r.get('id')
        if i not in ids:
            bad.append(f'{i}: not in the batch')
            continue
        if args.skeptic:
            if r.get('verdict') not in ('confirm', 'overturn'):
                bad.append(f'{i}: verdict must be confirm or overturn')
            if r.get('relation') not in RELATIONS:
                bad.append(f'{i}: relation must be one of {RELATIONS}')
            reader = next(x for x in load(args.batch) if x['id'] == i)['reader']['relation']
            if r.get('verdict') == 'confirm' and r.get('relation') != reader:
                bad.append(f'{i}: a confirm keeps the reader relation ({reader})')
            if r.get('verdict') == 'overturn' and r.get('relation') == reader:
                bad.append(f'{i}: an overturn changes the relation')
            if '"' not in (r.get('note') or ''):
                bad.append(f'{i}: note must quote the deciding words in double quotes')
        else:
            if r.get('relation') not in RELATIONS:
                bad.append(f'{i}: relation must be one of {RELATIONS}')
            if r.get('confidence') not in ('high', 'medium', 'low'):
                bad.append(f'{i}: confidence must be high, medium or low')
            if not (r.get('rationale') or '').strip():
                bad.append(f'{i}: rationale is empty')
        for k in ('reading', 'consolidate'):
            if r.get(k) not in ('yes', 'no'):
                bad.append(f'{i}: {k} must be yes or no')
        if r.get('consolidate') == 'yes' and r.get('relation') not in RESTATES:
            bad.append(f'{i}: consolidate is yes only for same or summary')
    print('OK' if not bad else '\n'.join(bad))
    sys.exit(1 if bad else 0)


def skeptic(args):
    run = Path(args.run)
    sample_rows = {u['id']: u for u in csv.DictReader(open(run / 'sample.csv', encoding='utf-8'))}
    batch = {r['id']: r for r in load(run / f'batch-{args.batch}.jsonl')}
    reader = {r['id']: r for r in load(run / f'reader-{args.batch}.jsonl')}
    out = []
    for i, r in reader.items():
        u = sample_rows[i]
        machine = float(u['cosine']) >= MACHINE_CUT
        says = r['relation'] in RESTATES
        why = ('disagree' if r['relation'] not in ('fragment', 'conflict') and says != machine else
               'conflict' if r['relation'] == 'conflict' else
               'fragment' if r['relation'] == 'fragment' else
               'audit' if u['audit'] == 'yes' else None)
        if not why:
            continue
        b = batch[i]
        a_pre, a_post = around(u['a_path'], int(u['a_start']), int(u['a_end']))
        b_pre, b_post = around(u['b_path'], int(u['b_start']), int(u['b_end']))
        out.append(dict(id=i, sent=why, machine='restates' if machine else 'does not restate',
                        reader={k: r[k] for k in ('relation', 'reading', 'consolidate', 'rationale')},
                        a_path=b['a_path'], a_line=b['a_line'], a_text=b['a_text'], a_before=a_pre, a_after=a_post,
                        b_path=b['b_path'], b_line=b['b_line'], b_text=b['b_text'], b_before=b_pre, b_after=b_post))
    with (run / f'skeptic-in-{args.batch}.jsonl').open('w', encoding='utf-8') as f:
        for o in out:
            f.write(json.dumps(o, ensure_ascii=False) + '\n')
    print(f'batch {args.batch}: {len(out)} rows for the skeptic ({Counter(o["sent"] for o in out)})')


GOLD_COLS = ['id', 'stratum', 'stratum_size', 'stratum_seats', 'audit', 'cosine', 'literal', 'short',
             'a_path', 'a_start', 'a_end', 'a_line', 'a_hash', 'b_path', 'b_start', 'b_end', 'b_line', 'b_hash',
             'reader_relation', 'reader_confidence', 'rationale', 'sent', 'verdict', 'note',
             'relation', 'reading', 'consolidate']


def merge(args):
    import hashlib
    run = Path(args.run)
    rows = list(csv.DictReader(open(run / 'sample.csv', encoding='utf-8')))
    reader, skep = {}, {}
    for p in sorted(run.glob('reader-*.jsonl')):
        reader.update({r['id']: r for r in load(p)})
    for p in sorted(run.glob('skeptic-in-*.jsonl')):
        sent = {r['id']: r['sent'] for r in load(p)}
        outp = run / p.name.replace('skeptic-in-', 'skeptic-out-')
        for r in load(outp):
            skep[r['id']] = dict(r, sent=sent[r['id']])
    h = lambda t: hashlib.sha256(t.encode('utf-8')).hexdigest()[:12]
    for u in rows:
        r, s = reader[u['id']], skep.get(u['id'])
        u['a_hash'] = h(cut(u['a_path'], int(u['a_start']), int(u['a_end'])))
        u['b_hash'] = h(cut(u['b_path'], int(u['b_start']), int(u['b_end'])))
        u.update(reader_relation=r['relation'], reader_confidence=r['confidence'], rationale=r['rationale'],
                 sent=s['sent'] if s else '', verdict=s['verdict'] if s else '', note=s['note'] if s else '')
        final = s or r
        u.update(relation=final['relation'], reading=final['reading'], consolidate=final['consolidate'])
    rows.sort(key=lambda u: u['id'])
    GOLD.mkdir(parents=True, exist_ok=True)
    with (GOLD / 'gold.csv').open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=GOLD_COLS, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    print(f'gold.csv: {len(rows)} rows, {len(skep)} reviewed by a skeptic')


def score(args):
    g = list(csv.DictReader(open(GOLD / 'gold.csv', encoding='utf-8')))
    # Horvitz-Thompson: a row stands for stratum_size / stratum_seats pairs.
    wt = lambda u: int(u['stratum_size']) / int(u['stratum_seats'])
    out = []
    P = lambda s: f'{100 * s:.0f}%'
    total = sum(wt(u) for u in g)
    out.append(f'{len(g)} labelled pairs standing for {total:.0f} (every passage pair at cosine >= 0.75).\n')
    out.append('Weighted share of each relation, by cosine band:\n')
    out.append('| band | pairs | ' + ' | '.join(RELATIONS) + ' | reading | consolidate |')
    out.append('|' + '---|' * (len(RELATIONS) + 4))
    for b in range(5):
        rows = [u for u in g if band(float(u['cosine'])) == b]
        W = sum(wt(u) for u in rows) or 1
        lo = 0.75 + 0.05 * b
        name = f'{lo:.2f}+' if b == 4 else f'{lo:.2f}-{lo + 0.05:.2f}'
        cells = [P(sum(wt(u) for u in rows if u['relation'] == r) / W) for r in RELATIONS]
        out.append(f'| {name} | {len(rows)} (~{W:.0f}) | ' + ' | '.join(cells) +
                   f" | {P(sum(wt(u) for u in rows if u['reading'] == 'yes') / W)}"
                   f" | {P(sum(wt(u) for u in rows if u['consolidate'] == 'yes') / W)} |")
    out.append('\nAt each cutoff, of the pairs it shows (weighted):\n')
    out.append('| cutoff | shown | restates (same/summary) | worth reading | could consolidate | conflict |')
    out.append('|---|---|---|---|---|---|')
    for t in (0.75, 0.78, 0.80, 0.82, 0.85, 0.88, 0.90, 0.95):
        rows = [u for u in g if float(u['cosine']) >= t]
        W = sum(wt(u) for u in rows) or 1
        f = lambda cond: P(sum(wt(u) for u in rows if cond(u)) / W)
        out.append(f'| {t:.2f} | ~{W:.0f} | {f(lambda u: u["relation"] in RESTATES)} | '
                   f'{f(lambda u: u["reading"] == "yes")} | {f(lambda u: u["consolidate"] == "yes")} | '
                   f'{f(lambda u: u["relation"] == "conflict")} |')
    out.append('\nBy whether the two files also share 3+ shingles (weighted):\n')
    out.append('| literal | pairs | restates | worth reading | could consolidate |')
    out.append('|---|---|---|---|---|')
    for L in ('yes', 'no'):
        rows = [u for u in g if u['literal'] == L]
        W = sum(wt(u) for u in rows) or 1
        f = lambda cond: P(sum(wt(u) for u in rows if cond(u)) / W)
        out.append(f'| {L} | {len(rows)} | {f(lambda u: u["relation"] in RESTATES)} | '
                   f'{f(lambda u: u["reading"] == "yes")} | {f(lambda u: u["consolidate"] == "yes")} |')
    rev = [u for u in g if u['verdict']]
    by = defaultdict(lambda: [0, 0])
    for u in rev:
        by[u['sent']][0] += 1
        by[u['sent']][1] += u['verdict'] == 'overturn'
    out.append(f'\nSkeptic: {len(rev)} rows reviewed, {sum(v[1] for v in by.values())} overturned. '
               + '; '.join(f'{k} {v[1]}/{v[0]}' for k, v in sorted(by.items())) + '.')
    trans = Counter((u['reader_relation'], u['relation']) for u in rev if u['verdict'] == 'overturn')
    if trans:
        out.append('Overturns, reader -> final: ' + ', '.join(f'{a} -> {b} ({n})' for (a, b), n in trans.most_common()) + '.')
    print('\n'.join(out))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('sample'); s.add_argument('--run', required=True); s.add_argument('--n', type=int, default=160)
    s.add_argument('--seed', type=int, default=20260929)
    c = sub.add_parser('check'); c.add_argument('batch'); c.add_argument('output'); c.add_argument('--skeptic', action='store_true')
    k = sub.add_parser('skeptic'); k.add_argument('--run', required=True); k.add_argument('--batch', type=int, required=True)
    m = sub.add_parser('merge'); m.add_argument('--run', required=True)
    sub.add_parser('score')
    args = ap.parse_args()
    dict(sample=sample, check=check, skeptic=skeptic, merge=merge, score=score)[args.cmd](args)


if __name__ == '__main__':
    main()
