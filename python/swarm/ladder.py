#!/usr/bin/env python3
"""Edit ladder: one passage, single edits per paragraph, judged, then ordered
from safest to boldest into a path a reader can swipe through.

    ladder.py init <run> <file> <first-line> <last-line> [--title T]
    ladder.py context <run> <role>         write a proposer's or judge's brief, print its paths
    ladder.py check <run> <output>         validate a proposer's or judge's .jsonl
    ladder.py merge <run> edits|ratings     fold the proposers' or the judges' files into the ledger
    ladder.py path <run>                   order each paragraph's edits and apply them in turn
    ladder.py gz <run>                     the ledger as a #gz= payload

The ledger is <run>/ledger.json (kind ladder/1), read by pages/swarm.html.
Proposers are trimmer, pincher and caveman; judges are named judge-<x>. Their
briefs are the ladder sections of roles.md.
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import swarm  # noqa: E402  (shared: load, save, where, roles, words)

TIERS = ['green', 'yellow', 'red']
PROPOSERS = {'trimmer': 'green', 'pincher': 'yellow', 'caveman': 'red'}
words = swarm.words


def kind(block):
    if block.startswith('#'):
        return 'heading'
    if block.startswith('```'):
        return 'code'
    if re.match(r'\s*(?:[-*+]|\d+\.)\s', block):
        return 'list'
    return 'para'


def init(run, path, l0, l1, title=None):
    run = Path(run); run.mkdir(parents=True, exist_ok=True)
    raw = Path(path).read_text(encoding='utf-8').split('\n')
    chunk = '\n'.join(raw[l0 - 1:l1])
    blocks = []
    for b in re.split(r'\n\s*\n', chunk.strip()):
        k = kind(b)
        text = b if k in ('list', 'code') else ' '.join(b.split())
        blocks.append({'id': f'P{len(blocks) + 1}', 'kind': k, 'text': text, 'words': words(text)})
    head = re.sub(r'^#+\s*', '', blocks[0]['text']) if blocks and blocks[0]['kind'] == 'heading' else None
    led = {'kind': 'ladder/1', 'title': title or head or Path(path).name,
           'source': {'path': path, 'lines': [l0, l1], **swarm.where(path, l0, l1), 'heading': head,
                      'words': words(chunk), 'text': chunk},
           'blocks': blocks, 'edits': [], 'ratings': [], 'paths': {}}
    swarm.save(run, led)
    print(f'{run}/ledger.json: {len(blocks)} paragraphs, {words(chunk)} words')


def loose(words_from):
    """An edit's from-words as a pattern that tolerates any run of whitespace."""
    return re.compile(r'\s+'.join(re.escape(p) for p in words_from.split()))


def apply(text, find, rep):
    m = loose(find).search(text)
    return None if not m else text[:m.start()] + rep + text[m.end():]


def context(run, role):
    run, led, br = Path(run).resolve(), swarm.load(run), swarm.roles()
    judge = role.startswith('judge')
    out = run / f'{role}.jsonl'
    ctx = run / f'{role}.ctx.md'
    L = [f'# Edit ladder: {role}', '', br['ladder'], '', f'## Your role: {role}', '',
         br['judge' if judge else role], '', '## Paths', '', f'- Output: `{out}`',
         f'- Check: `python3 {Path(__file__).resolve()} check {run} {out}`', '',
         f"## The passage, by paragraph ({led['source']['words']} words)", '']
    for b in led['blocks']:
        L += [f"### {b['id']} ({b['kind']}, {b['words']} words)", '', '```text', b['text'], '```', '']
    if judge:
        L += ['## The edits to rate', '']
        for e in led['edits']:
            L += [f"- {e['id']} in {e['block']} ({e['by']}): replace \"{e['from']}\" with \"{e['text']}\". Why: {e['why']}"]
    ctx.write_text('\n'.join(L) + '\n', encoding='utf-8')
    print(ctx); print(out)


def check_edits(led, lines):
    blocks = {b['id']: b for b in led['blocks']}
    errs = []
    for i, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except ValueError as ex:
            errs.append(f'line {i}: not JSON ({ex})'); continue
        b = blocks.get(o.get('block'))
        if not b: errs.append(f"line {i}: unknown block {o.get('block')}"); continue
        f, r = o.get('from', ''), o.get('text')
        if not f.strip() or r is None: errs.append(f'line {i}: needs from and text'); continue
        if f == r: errs.append(f'line {i}: text equals from'); continue
        if apply(b['text'], f, r) is None: errs.append(f"line {i}: from is not in {b['id']}: \"{f[:60]}\"")
        if not str(o.get('why', '')).strip(): errs.append(f'line {i}: why is empty')
    return errs


def check_ratings(led, lines):
    ids = {e['id'] for e in led['edits']}
    seen, errs = set(), []
    for i, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except ValueError as ex:
            errs.append(f'line {i}: not JSON ({ex})'); continue
        if o.get('edit') not in ids: errs.append(f"line {i}: unknown edit {o.get('edit')}"); continue
        if o['edit'] in seen: errs.append(f"line {i}: {o['edit']} rated twice")
        seen.add(o['edit'])
        if o.get('risk') not in TIERS: errs.append(f'line {i}: risk must be green, yellow or red')
        c = o.get('confidence')
        if not isinstance(c, int) or not 0 <= c <= 100: errs.append(f'line {i}: confidence must be a whole number 0 to 100')
    missing = sorted(ids - seen, key=lambda x: int(x[1:]))
    if missing: errs.append(f"not rated: {', '.join(missing)}")
    return errs


def check(run, out):
    led, p = swarm.load(run), Path(out)
    lines = p.read_text(encoding='utf-8').splitlines()
    errs = (check_ratings if p.stem.startswith('judge') else check_edits)(led, lines)
    print('\n'.join(errs) if errs else f'{p.name}: ok')
    return not errs


def merge(run, phase):
    run, led = Path(run), swarm.load(run)
    if phase == 'edits':
        files = sorted(f for f in run.glob('*.jsonl') if f.stem in PROPOSERS)
        led['edits'] = []
        for f in files:
            errs = check_edits(led, f.read_text(encoding='utf-8').splitlines())
            if errs: sys.exit(f'{f.name}:\n' + '\n'.join(errs))
            for line in f.read_text(encoding='utf-8').splitlines():
                if line.strip():
                    o = json.loads(line)
                    led['edits'].append({'id': f"e{len(led['edits']) + 1}", 'block': o['block'], 'by': f.stem,
                                         'aim': PROPOSERS[f.stem], 'from': o['from'], 'text': o['text'], 'why': o['why']})
        print(f"{len(led['edits'])} edits from " + ', '.join(f.stem for f in files))
    else:
        files = sorted(run.glob('judge*.jsonl'))
        led['ratings'] = []
        for f in files:
            errs = check_ratings(led, f.read_text(encoding='utf-8').splitlines())
            if errs: sys.exit(f'{f.name}:\n' + '\n'.join(errs))
            for line in f.read_text(encoding='utf-8').splitlines():
                if line.strip():
                    o = json.loads(line)
                    led['ratings'].append({'edit': o['edit'], 'by': f.stem, 'risk': o['risk'], 'confidence': o['confidence'],
                                           **{k: o[k] for k in ('brilliancy', 'brutality', 'note') if str(o.get(k, '')).strip()}})
        print(f"{len(led['ratings'])} ratings from " + ', '.join(f.stem for f in files))
    swarm.save(run, led)


def span(text, find):
    m = loose(find).search(text)
    return (m.start(), m.end()) if m else None


def compose(text, chosen):
    """The paragraph with every chosen edit applied; their spans in the original never overlap."""
    out, at = [], 0
    for _, (a, b), rep in sorted(chosen, key=lambda c: c[1][0]):
        out += [text[at:a], rep]; at = b
    return ''.join(out + [text[at:]])


def path(run):
    """Per paragraph: the edits ordered safest first (tier, then confidence, then
    words saved), each added in turn. An edit that overlaps steps already taken
    replaces them when it sits in a riskier tier than all of them and leaves the
    paragraph shorter; otherwise it is set aside as an alternative."""
    run, led = Path(run), swarm.load(run)
    by = {}
    for r in led['ratings']:
        by.setdefault(r['edit'], []).append(r)
    led['paths'] = {}
    for b in led['blocks']:
        scored = []
        for e in (e for e in led['edits'] if e['block'] == b['id']):
            rs, sp = by.get(e['id'], []), span(b['text'], e['from'])
            if not rs or not sp:
                continue
            risk = max((r['risk'] for r in rs), key=TIERS.index)   # the warier judge decides the tier
            conf = round(sum(r['confidence'] for r in rs) / len(rs))
            saved = words(e['from']) - words(e['text'])
            scored.append((TIERS.index(risk), -conf, -saved, e, risk, conf, sp))
        scored.sort(key=lambda t: t[:3])
        chosen, steps, aside = [], [], []          # chosen: (edit id, span, replacement)
        tier_of = {}
        cur_words = b['words']
        for t, _, _, e, risk, conf, sp in scored:
            hit = [c for c in chosen if c[1][0] < sp[1] and sp[0] < c[1][1]]
            if hit and not all(tier_of[c[0]] < t for c in hit):
                aside.append({'edit': e['id'], 'beside': [c[0] for c in hit]}); continue
            trial = [c for c in chosen if c not in hit] + [(e['id'], sp, e['text'])]
            text = compose(b['text'], trial)
            if hit and words(text) >= cur_words:
                aside.append({'edit': e['id'], 'beside': [c[0] for c in hit]}); continue
            chosen, tier_of[e['id']] = trial, t
            steps.append({'edit': e['id'], 'risk': risk, 'confidence': conf, 'text': text, 'words': words(text),
                          **({'replaces': [c[0] for c in hit]} if hit else {})})
            cur_words = words(text)
        led['paths'][b['id']] = {'steps': steps, 'aside': aside}
    swarm.save(run, led)
    total = led['source']['words']
    for t in TIERS:
        w = 0
        for b in led['blocks']:
            ok = [s for s in led['paths'][b['id']]['steps'] if TIERS.index(s['risk']) <= TIERS.index(t)]
            w += ok[-1]['words'] if ok else b['words']
        print(f'through {t}: {total} -> {w} words')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('init', 'context', 'check', 'merge', 'path', 'gz'):
        sys.exit(__doc__)
    if a[0] == 'init':
        t = a[a.index('--title') + 1] if '--title' in a else None
        init(a[1], a[2], int(a[3]), int(a[4]), t)
    elif a[0] == 'check':
        sys.exit(0 if check(a[1], a[2]) else 1)
    elif a[0] == 'gz':
        swarm.gz(a[1])
    else:
        {'context': context, 'merge': merge, 'path': path}[a[0]](*a[1:])
