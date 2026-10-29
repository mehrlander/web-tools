#!/usr/bin/env python3
"""Dome: one paragraph, bouts of fighters, every edit landing on one text.

    dome.py init <run> <file> <first-line> <last-line> [--title T]
    dome.py context <run> <bout> <fighter>   write a fighter's brief, print its paths
    dome.py check <run> <output>             validate a fighter's .jsonl
    dome.py smash <run> <bout> [--model M]   land the bout's edits, biggest first
    dome.py gz <run>                         the ledger as a #gz= payload

A fighter's file is <run>/b<bout>-<fighter>.jsonl, and its brief is dome.md
with one of its temperaments. A bout's edits land on the text the last bout
left: first the repairs, each answering a fighter's complaint that the reader
lost something the original said, then the rest biggest swing first (the most
words claimed, then the most saved). An edit whose words are no longer there
exactly once is knocked out. Each landed edit
is a step on the path, so the paragraph can be read edit by edit. The ledger is
<run>/ledger.json (kind dome/1), read by pages/swarm.html.
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import swarm  # noqa: E402  (shared: load, save, where, words, gz)
from ladder import sections, listed, loose, QW  # noqa: E402

words = swarm.words
MAX_EDITS = 3


def init(run, path, l0, l1, title=None):
    run = Path(run); run.mkdir(parents=True, exist_ok=True)
    raw = Path(path).read_text(encoding='utf-8').split('\n')
    text = ' '.join('\n'.join(raw[l0 - 1:l1]).split())
    led = {'kind': 'dome/1', 'title': title or Path(path).name,
           'source': {'path': path, 'lines': [l0, l1], **swarm.where(path, l0, l1),
                      'words': words(text), 'text': text},
           'blocks': [{'id': 'P1', 'kind': 'para', 'text': text, 'words': words(text)}],
           'bouts': [], 'edits': [], 'path': []}
    swarm.save(run, led)
    print(f'{run}/ledger.json: one paragraph, {words(text)} words')


def before(led, n):
    """The paragraph as bout n finds it."""
    prior = [b for b in led['bouts'] if b['n'] < n]
    return prior[-1]['text'] if prior else led['blocks'][0]['text']


def context(run, n, fighter):
    run, led = Path(run).resolve(), swarm.load(run)
    br = sections('dome.md')
    temper = listed(br['temperaments'])
    if fighter not in temper:
        sys.exit(f'no temperament {fighter}; one of: {", ".join(temper)}')
    cur, orig = before(led, n), led['blocks'][0]['text']
    out = run / f'b{n}-{fighter}.jsonl'
    ctx = run / f'b{n}-{fighter}.ctx.md'
    L = [f'# Dome, bout {n}: {fighter}', '', br['dome'], '',
         '## Your temperament', '', f'**{fighter}**: {temper[fighter]}', '',
         '## Paths', '', f'- Output: `{out}`',
         f'- Check: `python3 {HERE / "dome.py"} check {run} {out}`', '',
         f'## The original ({words(orig)} words)', '', '```text', orig, '```', '',
         f'## The paragraph now ({words(cur)} words)', '']
    L += ['It is still the original: this is the first bout.', ''] if cur == orig else ['```text', cur, '```', '']
    L += ['## The Qualified writing rules', '', QW.read_text(encoding='utf-8').split('---', 1)[-1].strip(), '']
    ctx.write_text('\n'.join(L), encoding='utf-8')
    print(ctx); print(out)


def lines_of(p):
    out = []
    for i, line in enumerate(Path(p).read_text(encoding='utf-8').splitlines(), 1):
        if line.strip():
            try:
                out.append((i, json.loads(line)))
            except json.JSONDecodeError as e:
                out.append((i, {'_bad': str(e)}))
    return out


def bout_of(out):
    m = re.match(r'b(\d+)-([\w-]+)\.jsonl$', Path(out).name)
    if not m:
        sys.exit(f'{out}: name it b<bout>-<fighter>.jsonl')
    return int(m.group(1)), m.group(2)


def check(run, out):
    led = swarm.load(run)
    n, _ = bout_of(out)
    cur, errs = before(led, n), []
    ls = lines_of(out)
    if not ls:
        errs.append('no edits')
    if len(ls) > MAX_EDITS:
        errs.append(f'{len(ls)} edits; at most {MAX_EDITS}')
    for i, o in ls:
        if '_bad' in o:
            errs.append(f'line {i}: not JSON ({o["_bad"]})'); continue
        f, t = str(o.get('from', '')), o.get('text')
        if not f.strip() or not isinstance(t, str):
            errs.append(f'line {i}: needs "from" (non-empty) and "text" (a string)'); continue
        hits = len(loose(f).findall(cur))
        if hits != 1:
            errs.append(f'line {i}: "from" appears {hits} times in the current paragraph; it must appear exactly once')
        if words(f) > words(cur) / 2:
            errs.append(f'line {i}: "from" is {words(f)} words, more than half the paragraph')
        if ' '.join(f.split()) == ' '.join(t.split()):
            errs.append(f'line {i}: "text" is the same as "from"')
        if 'lost' in o and not (isinstance(o['lost'], str) and o['lost'].strip()):
            errs.append(f'line {i}: "lost" must say what the reader lost')
    if sum('lost' in o for _, o in ls) > 1:
        errs.append('more than one repair; a fighter may complain once a bout')
    print(f'{Path(out).name}: ' + ('ok' if not errs else '\n  ' + '\n  '.join(errs)))
    return not errs


def smash(run, n, model=''):
    run, led = Path(run), swarm.load(run)
    # A bout smashed again replaces itself and every bout after it.
    led['bouts'] = [b for b in led['bouts'] if b['n'] < n]
    led['edits'] = [e for e in led['edits'] if e['bout'] < n]
    led['path'] = [s for s in led['path'] if s['bout'] < n]
    text = before(led, n)
    files = sorted(run.glob(f'b{n}-*.jsonl'))
    edits = []
    for f in files:
        if not check(run, f):
            sys.exit(f'{f.name} does not pass its check')
        _, who = bout_of(f)
        for k, (_, o) in enumerate(lines_of(f), 1):
            e = {'id': f'b{n}.{who}.{k}', 'bout': n, 'by': who, 'from': o['from'], 'text': o['text']}
            # A complaint: the words the reader lost are the repair's reason.
            if str(o.get('lost', '')).strip():
                e.update(repair=True, why=o['lost'])
            edits.append(e)
    # Repairs first, so a complaint is heard before the cuts land; then the
    # biggest swing: the most words claimed, then the most words saved, so on
    # one span a cut beats a rewrite. A tie goes to the fighter named first.
    order = sorted(edits, key=lambda e: (not e.get('repair'), -words(e['from']), words(e['text']), e['id']))
    for e in order:
        ms = list(loose(e['from']).finditer(text))
        if len(ms) != 1:
            e['landed'] = False
            continue
        a, b = ms[0].span()
        text = re.sub(r'  +', ' ', text[:a] + e['text'] + text[b:]).strip()
        e['landed'] = True
        led['path'].append({'edit': e['id'], 'bout': n, 'blocks': ['P1'], 'text': text, 'words': words(text)})
    led['edits'] += order
    landed = sum(e['landed'] for e in order)
    led['bouts'].append({'n': n, 'model': model, 'fighters': [bout_of(f)[1] for f in files],
                         'landed': landed, 'knocked': len(order) - landed, 'text': text, 'words': words(text)})
    swarm.save(run, led)
    print(f'bout {n}: {landed} landed, {len(order) - landed} knocked out, {words(before(led, n))} -> {words(text)} words')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('init', 'context', 'check', 'smash', 'gz'):
        sys.exit(__doc__)
    if a[0] == 'init':
        t = a[a.index('--title') + 1] if '--title' in a else None
        init(a[1], a[2], int(a[3]), int(a[4]), t)
    elif a[0] == 'context':
        context(a[1], int(a[2]), a[3])
    elif a[0] == 'check':
        sys.exit(0 if check(a[1], a[2]) else 1)
    elif a[0] == 'smash':
        smash(a[1], int(a[2]), a[a.index('--model') + 1] if '--model' in a else '')
    else:
        swarm.gz(a[1])
