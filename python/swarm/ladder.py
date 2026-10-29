#!/usr/bin/env python3
"""Edit ladder: one passage, edits judged and ordered from safest to boldest
into a path a reader can swipe through.

    ladder.py init <run> <file> <first-line> <last-line> [--bold] [--title T]
    ladder.py context <run> <role>       write an agent's brief, print its paths
    ladder.py check <run> <output>       validate an agent's .jsonl
    ladder.py merge <run> <what>         fold agents' files into the ledger
    ladder.py path <run>                 order the edits and apply them in turn
    ladder.py gz <run>                   the ledger as a #gz= payload

A plain run (kind ladder/1) has proposers trimmer, pincher and caveman, then
judges judge-<x>; its briefs are the ladder sections of roles.md, and <what>
is edits, then ratings. A bold run (kind ladder/2) has a reader, scouts
scout-<lens>, builders builder-<name> and judges judge-<x>; its briefs are
bold.md, and <what> is repairs, ideas, edits, then ratings. Either ledger is
<run>/ledger.json, read by pages/swarm.html.
"""
import csv, json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import swarm  # noqa: E402  (shared: load, save, where, words, gz)

TIERS = ['repair', 'green', 'yellow', 'red']
PROPOSERS = {'trimmer': 'green', 'pincher': 'yellow', 'caveman': 'red'}
QW = HERE.parent.parent / 'docs' / 'QUALIFIED-WRITING.md'
PEEVES = HERE.parent.parent / 'skills' / 'peeves' / 'peeves.csv'
words = swarm.words


def peeves():
    """The owner's active writing peeves, by id, each with the look-for
    examples of the rows merged into it (the peeves skill's rule)."""
    rows = list(csv.DictReader(PEEVES.open(encoding='utf-8')))
    out = {}
    for r in rows:
        if r['area'] == 'writing' and r['status'] == 'active' and not r['merged_into'].strip():
            looks = [x['look_for'] for x in [r] + [x for x in rows if x['merged_into'].strip() == r['id']] if x['look_for'].strip()]
            out[r['id']] = {'name': r['name'], 'peeve': r['peeve'], 'look_for': '; '.join(looks)}
    return out


def peeves_md():
    return ['## The owner\'s writing peeves', ''] + [
        f"- **{i} {p['name']}**: {p['peeve']} Look for: {p['look_for']}" for i, p in peeves().items()] + ['']


def check_peeve(o, i):
    return [f"line {i}: peeve {o['peeve']} is not one of {', '.join(peeves())}"] if 'peeve' in o and o['peeve'] not in peeves() else []


def sections(name):
    out, cur = {}, None
    for line in (HERE / name).read_text(encoding='utf-8').split('\n'):
        m = re.match(r'## ([\w-]+)$', line)
        if m:
            cur = m.group(1); out[cur] = []
        elif cur:
            out[cur].append(line)
    return {k: '\n'.join(v).strip() for k, v in out.items()}


def listed(text):
    """'- name: instruction' lines as a dict."""
    return dict(re.findall(r'^- ([\w-]+): (.+)$', text, re.M))


def kind(block):
    if block.startswith('#'):
        return 'heading'
    if block.startswith('```'):
        return 'code'
    if re.match(r'\s*(?:[-*+]|\d+\.)\s', block):
        return 'list'
    return 'para'


def init(run, path, l0, l1, bold=False, title=None):
    run = Path(run); run.mkdir(parents=True, exist_ok=True)
    raw = Path(path).read_text(encoding='utf-8').split('\n')
    chunk = '\n'.join(raw[l0 - 1:l1])
    blocks = []
    for b in re.split(r'\n\s*\n', chunk.strip()):
        k = kind(b)
        text = b if k in ('list', 'code') else ' '.join(b.split())
        blocks.append({'id': f'P{len(blocks) + 1}', 'kind': k, 'text': text, 'words': words(text)})
    head = re.sub(r'^#+\s*', '', blocks[0]['text']) if blocks and blocks[0]['kind'] == 'heading' else None
    led = {'kind': 'ladder/2' if bold else 'ladder/1', 'title': title or head or Path(path).name,
           'source': {'path': path, 'lines': [l0, l1], **swarm.where(path, l0, l1), 'heading': head,
                      'words': words(chunk), 'text': chunk},
           'blocks': blocks, 'edits': [], 'ratings': [], 'path': []}
    if bold:
        led.update(problems=[], repairs=[], ideas=[], rblocks=blocks)
    swarm.save(run, led)
    print(f"{run}/ledger.json: {len(blocks)} paragraphs, {words(chunk)} words{' (bold)' if bold else ''}")


# --- spans: an edit names consecutive paragraphs and, optionally, words in them

def loose(words_from):
    """An edit's from-words as a pattern that tolerates any run of whitespace."""
    return re.compile(r'\s+'.join(re.escape(p) for p in words_from.split()))


def full(blocks):
    return '\n\n'.join(b['text'] for b in blocks)


def region(blocks, ids):
    """(start, end) of consecutive paragraphs ids in full(blocks), or None."""
    order = [b['id'] for b in blocks]
    if not ids or any(i not in order for i in ids):
        return None
    idx = [order.index(i) for i in ids]
    if idx != list(range(idx[0], idx[0] + len(idx))):
        return None
    at, starts = 0, []
    for b in blocks:
        starts.append(at); at += len(b['text']) + 2
    return starts[idx[0]], starts[idx[-1]] + len(blocks[idx[-1]]['text'])


def span(blocks, e):
    r = region(blocks, e['blocks'])
    if not r:
        return None
    if not str(e.get('from', '')).strip():
        return r
    m = loose(e['from']).search(full(blocks), r[0], r[1])
    return (m.start(), m.end()) if m else None


def compose(text, chosen):
    """text with every chosen edit applied; their spans never overlap."""
    out, at = [], 0
    for _, (a, b), rep in sorted(chosen, key=lambda c: c[1][0]):
        out += [text[at:a], rep]; at = b
    return ''.join(out + [text[at:]])


def blocks_of(text, like):
    """Split text back into paragraphs, keeping ids while the count holds."""
    parts = text.split('\n\n')
    if len(parts) == len(like):
        return [{**b, 'text': t, 'words': words(t)} for b, t in zip(like, parts)]
    return [{'id': f'P{i + 1}', 'kind': kind(t), 'text': t, 'words': words(t)} for i, t in enumerate(parts)]


# --- briefs

def passage_md(blocks):
    L = []
    for b in blocks:
        L += [f"### {b['id']} ({b['kind']}, {b['words']} words)", '', '```text', b['text'], '```', '']
    return L


def context(run, role):
    run, led = Path(run).resolve(), swarm.load(run)
    bold = led['kind'] == 'ladder/2'
    br = sections('bold.md' if bold else 'roles.md')
    base, *rest = role.split('-', 1)
    out, ctx = run / f'{role}.jsonl', run / f'{role}.ctx.md'
    check = f'`python3 {Path(__file__).resolve()} check {run} {out}`'
    if not bold:
        brief = br['judge' if base == 'judge' else role]
        L = [f'# Edit ladder: {role}', '', br['ladder'], '', f'## Your role: {role}', '', brief, '']
    else:
        L = [f'# Edit ladder, bold run: {role}', '', br['bold'], '', f'## Your role: {base}', '', br[base], '']
        if base == 'scout':
            L += ['### Your lens', '', f"**{rest[0]}**: {listed(br['lenses'])[rest[0]]}", '']
        if base == 'builder':
            L += ['### Your assignment', '', f"**{rest[0]}**: {listed(br['builders'])[rest[0]]}", '']
        L += ['## The Qualified writing rules', '', QW.read_text(encoding='utf-8'), ''] + peeves_md()
    L += ['## Paths', '', f'- Output: `{out}`', f'- Check: {check}', '']
    if bold and base == 'reader':
        L += [f'- Reading: `{run / "reading.json"}`', '']
    shown = led.get('rblocks') if bold and base != 'reader' else led['blocks']
    title = 'after the reader\'s repairs' if bold and base != 'reader' else 'by paragraph'
    L += [f"## The passage, {title} ({words(full(shown))} words)", ''] + passage_md(shown)
    L += [f"The passage is lines {led['source']['lines'][0]} to {led['source']['lines'][1]} of `{led['source']['path']}`.", '']
    if bold and base in ('scout', 'builder', 'judge') and led.get('problems'):
        L += ['## What the reader found', ''] + [f"- {p['problem']} in {', '.join(p['blocks'])}: \"{p['quote']}\". {p['note']}" for p in led['problems']] + ['']
    if bold and base in ('builder', 'judge'):
        L += ['## The scouts\' ideas', ''] + [f"- {i['id']} ({i['kind']}, {', '.join(i['blocks'])}, saves {i['saves']}): {i['idea']}" + (f" Draft: \"{i['text']}\"" if i.get('text') else '') + f" Why: {i['why']}" for i in led['ideas']] + ['']
    if base == 'judge':
        if bold:
            L += ['## The repairs to rate (applied to the original before the passage above)', '']
            L += [f"- {r['id']} in {', '.join(r['blocks'])}: replace \"{r['from']}\" with \"{r['text']}\". Why: {r['why']}" for r in led['repairs']] + ['']
        L += ['## The edits to rate', '']
        for e in led['edits']:
            what = f"replace \"{e['from']}\" with \"{e['text']}\"" if e.get('from') else f"replace {'–'.join(e['blocks'])} with: \"{e['text']}\""
            L += [f"- {e['id']} in {', '.join(e['blocks'])} ({e['by']}): {what}. Why: {e['why']}"]
    ctx.write_text('\n'.join(L) + '\n', encoding='utf-8')
    print(ctx); print(out)


# --- checks

def lines_of(p):
    out = []
    for i, line in enumerate(Path(p).read_text(encoding='utf-8').splitlines(), 1):
        if line.strip():
            try:
                out.append((i, json.loads(line)))
            except ValueError as ex:
                out.append((i, ex))
    return out


def check_edit(blocks, o, i, need_from=True):
    errs = []
    bl = o.get('blocks') or ([o['block']] if o.get('block') else None)
    if not bl or not region(blocks, bl):
        return [f'line {i}: blocks must name consecutive paragraphs that exist']
    if 'text' not in o:
        errs.append(f'line {i}: needs text')
    if need_from and not str(o.get('from', '')).strip():
        errs.append(f'line {i}: needs from')
    if str(o.get('from', '')).strip() and not span(blocks, {**o, 'blocks': bl}):
        errs.append(f"line {i}: from is not in {', '.join(bl)}: \"{o['from'][:60]}\"")
    if o.get('from') is not None and o.get('from') == o.get('text'):
        errs.append(f'line {i}: text equals from')
    if not str(o.get('why', '')).strip():
        errs.append(f'line {i}: why is empty')
    return errs


def check(run, out):
    led, p = swarm.load(run), Path(out)
    bold, role = led['kind'] == 'ladder/2', p.stem
    errs = []
    rows = lines_of(p)
    for i, o in rows:
        if isinstance(o, Exception):
            errs.append(f'line {i}: not JSON ({o})'); continue
        if role == 'reader':
            if 'problem' in o:
                if o['problem'] not in ('unintroduced', 'names', 'connection', 'premise'): errs.append(f'line {i}: problem kind unknown')
                if not o.get('blocks') or not region(led['blocks'], o['blocks']): errs.append(f'line {i}: blocks unknown')
                if not str(o.get('quote', '')).strip(): errs.append(f'line {i}: quote is empty')
            elif 'repair' in o:
                errs += check_edit(led['blocks'], o, i)
            else:
                errs.append(f'line {i}: a reader line is a problem or a repair')
        elif role.startswith('scout'):
            if not str(o.get('idea', '')).strip(): errs.append(f'line {i}: idea is empty')
            if o.get('kind') not in ('cut', 'merge', 'reorder', 'delegate', 'qualify', 'connect', 'premise', 'restructure'): errs.append(f'line {i}: kind unknown')
            if not isinstance(o.get('saves'), int): errs.append(f'line {i}: saves must be a whole number')
            if not o.get('blocks') or any(b not in [x['id'] for x in led['rblocks']] for b in o['blocks']): errs.append(f'line {i}: blocks unknown')
            errs += check_peeve(o, i)
        elif role.startswith('builder'):
            ideas = {x['id'] for x in led.get('ideas', [])}
            errs += check_edit(led['rblocks'], o, i, need_from=False) + check_peeve(o, i)
            bad = [x for x in o.get('ideas', []) if x not in ideas]
            if bad: errs.append(f'line {i}: unknown ideas {bad}')
        elif role.startswith('judge'):
            pass
        elif role in PROPOSERS:
            errs += check_edit(led['blocks'], o, i)
        else:
            errs.append(f'unknown role {role}'); break
    if role.startswith('judge'):
        ids = {e['id'] for e in led['edits']} | {r['id'] for r in led.get('repairs', [])}
        seen = set()
        for i, o in rows:
            if isinstance(o, Exception): continue
            if o.get('edit') not in ids: errs.append(f"line {i}: unknown edit {o.get('edit')}"); continue
            if o['edit'] in seen: errs.append(f"line {i}: {o['edit']} rated twice")
            seen.add(o['edit'])
            if o.get('risk') not in (TIERS if bold else TIERS[1:]): errs.append(f'line {i}: risk must be one of {", ".join(TIERS if bold else TIERS[1:])}')
            c = o.get('confidence')
            if not isinstance(c, int) or not 0 <= c <= 100: errs.append(f'line {i}: confidence must be a whole number 0 to 100')
            if bold and o.get('clarity') not in ('ok', 'loses'): errs.append(f'line {i}: clarity must be ok or loses')
        missing = sorted(ids - seen)
        if missing: errs.append(f"not rated: {', '.join(missing)}")
    print('\n'.join(errs) if errs else f'{p.name}: ok')
    return not errs


# --- merges

def merge(run, what):
    run, led = Path(run), swarm.load(run)

    def files(pat):
        fs = sorted(run.glob(pat))
        for f in fs:
            if not check(run, f):
                sys.exit(f'{f.name} does not pass its check')
        return fs

    if what == 'edits' and led['kind'] == 'ladder/1':
        led['edits'] = []
        for f in (f for f in files('*.jsonl') if f.stem in PROPOSERS):
            for _, o in lines_of(f):
                led['edits'].append({'id': f"e{len(led['edits']) + 1}", 'blocks': [o['block']] if 'block' in o else o['blocks'],
                                     'by': f.stem, 'aim': PROPOSERS[f.stem], 'from': o['from'], 'text': o['text'], 'why': o['why']})
    elif what == 'repairs':
        led['problems'], led['repairs'] = [], []
        cur = [dict(b) for b in led['blocks']]
        for _, o in lines_of(files('reader.jsonl')[0]):
            if 'problem' in o:
                led['problems'].append({k: o[k] for k in ('problem', 'blocks', 'quote', 'note') if k in o})
                continue
            r = {'id': f"r{len(led['repairs']) + 1}", 'kind': o['repair'], 'blocks': o['blocks'], 'from': o['from'], 'text': o['text'], 'why': o['why']}
            sp = span(cur, r)
            if sp:
                cur = blocks_of(compose(full(cur), [(r['id'], sp, r['text'])]), cur)
                led['repairs'].append(r)
        led['rblocks'] = cur
        if (run / 'reading.json').exists():
            led['reading'] = json.loads((run / 'reading.json').read_text(encoding='utf-8'))
    elif what == 'ideas':
        led['ideas'] = []
        for f in files('scout-*.jsonl'):
            lens = f.stem.split('-', 1)[1]
            for n, (_, o) in enumerate(lines_of(f), 1):
                # A scout's draft is its `rewrite`; the ledger calls drafted words `text`, as in an edit.
                led['ideas'].append({'id': f'{lens}.{n}', 'lens': lens, **{k: o.get(k, '') for k in ('idea', 'kind', 'blocks')},
                                     'text': o.get('rewrite', ''), **{k: o.get(k, '') for k in ('saves', 'why')},
                                     **({'peeve': o['peeve']} if o.get('peeve') else {})})
        led['peeves'] = {k: v['name'] for k, v in peeves().items()}
    elif what == 'edits':
        led['edits'] = []
        for f in files('builder-*.jsonl'):
            name = f.stem.split('-', 1)[1]
            for _, o in lines_of(f):
                e = {'id': f"e{len(led['edits']) + 1}", 'blocks': o['blocks'], 'by': name, 'text': o['text'], 'why': o['why'], 'ideas': o.get('ideas', [])}
                if str(o.get('from', '')).strip():
                    e['from'] = o['from']
                if o.get('peeve'):
                    e['peeve'] = o['peeve']
                if name.startswith('architect'):
                    e['whole'] = True
                led['edits'].append(e)
        # A scout's draft of the whole passage (or all of it below the heading)
        # stands beside the architects', so the judges rate the boldest drafts too.
        last = led['rblocks'][-1]['id']
        for i in led.get('ideas', []):
            if i.get('text') and i['blocks'][0] in ('P1', 'P2') and i['blocks'][-1] == last:
                led['edits'].append({'id': f"e{len(led['edits']) + 1}", 'blocks': i['blocks'], 'by': f"scout-{i['lens']}",
                                     'text': i['text'], 'why': i['why'], 'ideas': [i['id']], 'whole': True})
    elif what == 'ratings':
        led['ratings'] = []
        for f in files('judge-*.jsonl'):
            for _, o in lines_of(f):
                r = {'edit': o['edit'], 'by': f.stem, 'risk': o['risk'], 'confidence': o['confidence'],
                     **{k: o[k] for k in ('clarity', 'note') if str(o.get(k, '')).strip()}}
                # A judge writes each honour under its own name; the ledger keeps the
                # honour as a value and the judge's line as its `why`.
                hs = [{'honour': k, 'why': o[k]} for k in ('brilliancy', 'brutality') if str(o.get(k, '')).strip()]
                led['ratings'].append({**r, **({'honours': hs} if hs else {})})
    else:
        sys.exit(f'merge what? {what}')
    swarm.save(run, led)
    counts = {k: len(led.get(k, [])) for k in ('problems', 'repairs', 'ideas', 'edits', 'ratings') if k in led}
    print(f'{what}: ' + ', '.join(f'{v} {k}' for k, v in counts.items()))


# --- the path

def scored(led, edits, by):
    for e in edits:
        rs = by.get(e['id'], [])
        if not rs:
            continue
        risk = max((r['risk'] for r in rs), key=TIERS.index)   # the warier judge decides the tier
        conf = round(sum(r['confidence'] for r in rs) / len(rs))
        yield e, risk, conf


def path(run):
    """The whole passage, step by step: the reader's repairs first, in the
    order they were written; then the edits, safest first (tier, then
    confidence, then words saved). An edit must leave the passage shorter,
    except in a bold run a green one that no judge says loses clarity. An
    edit that overlaps steps already taken replaces them when it sits in a
    riskier tier than all of them and leaves the passage shorter; otherwise it
    waits as an alternative. A whole-passage rewrite is an alternative to the
    path, not a step on it."""
    run, led = Path(run), swarm.load(run)
    for e in led['edits']:                       # a plain run's edits name one paragraph
        if 'block' in e:
            e['blocks'] = [e.pop('block')]
    by = {}
    for r in led['ratings']:
        by.setdefault(r['edit'], []).append(r)
    steps, cur = [], [dict(b) for b in led['blocks']]
    for r, risk, conf in scored(led, led.get('repairs', []), by):
        sp = span(cur, r)
        if not sp:
            continue
        cur = blocks_of(compose(full(cur), [(r['id'], sp, r['text'])]), cur)
        steps.append({'edit': r['id'], 'risk': 'repair', 'confidence': conf, 'blocks': r['blocks'], 'text': full(cur), 'words': words(full(cur))})
    base = cur if led['kind'] == 'ladder/1' else led.get('rblocks', cur)
    text0 = full(base)
    order = []
    for e, risk, conf in scored(led, [e for e in led['edits'] if not e.get('whole')], by):
        sp = span(base, e)
        if sp:
            order.append((TIERS.index(risk), -conf, -(words(text0[sp[0]:sp[1]]) - words(e['text'])), e, risk, conf, sp))
    order.sort(key=lambda t: t[:3])
    chosen, tier_of, aside, now = [], {}, [], words(text0)
    for t, _, _, e, risk, conf, sp in order:
        hit = [c for c in chosen if c[1][0] < sp[1] and sp[0] < c[1][1]]
        if hit and not all(tier_of[c[0]] < t for c in hit):
            aside.append({'edit': e['id'], 'beside': [c[0] for c in hit]}); continue
        trial = [c for c in chosen if c not in hit] + [(e['id'], sp, e['text'])]
        text = compose(text0, trial)
        # In a bold run, a green edit every judge calls clear is taken on its merits,
        # longer or not; a yellow or red one costs the reader something, so it must
        # buy words. A plain run's proposers only shorten, so there every edit must.
        merit = (led['kind'] != 'ladder/1' and risk in ('repair', 'green')
                 and not any(r.get('clarity') == 'loses' for r in by[e['id']]))
        if words(text) >= now and not hit and not merit:
            aside.append({'edit': e['id'], 'beside': []}); continue
        if hit and words(text) >= now:
            aside.append({'edit': e['id'], 'beside': [c[0] for c in hit]}); continue
        chosen, tier_of[e['id']], now = trial, t, words(text)
        steps.append({'edit': e['id'], 'risk': risk, 'confidence': conf, 'blocks': e['blocks'], 'text': text, 'words': now,
                      **({'replaces': [c[0] for c in hit]} if hit else {})})
    led['path'] = steps
    led['aside'] = aside
    led['wholes'] = []
    for e, risk, conf in scored(led, [e for e in led['edits'] if e.get('whole')], by):
        if span(base, e):
            t = compose(text0, [(e['id'], span(base, e), e['text'])])
            led['wholes'].append({'edit': e['id'], 'by': e['by'], 'risk': risk, 'confidence': conf, 'text': t, 'words': words(t)})
    led.pop('paths', None)
    swarm.save(run, led)
    total = led['source']['words']
    for t in TIERS:
        ok = [s for s in steps if TIERS.index(s['risk']) <= TIERS.index(t)]
        print(f"through {t}: {total} -> {ok[-1]['words'] if ok else total} words")
    for w in led['wholes']:
        print(f"whole rewrite {w['edit']}: {w['words']} words, {w['risk']} {w['confidence']}%")


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('init', 'context', 'check', 'merge', 'path', 'gz'):
        sys.exit(__doc__)
    if a[0] == 'init':
        t = a[a.index('--title') + 1] if '--title' in a else None
        init(a[1], a[2], int(a[3]), int(a[4]), '--bold' in a, t)
    elif a[0] == 'check':
        sys.exit(0 if check(a[1], a[2]) else 1)
    elif a[0] == 'gz':
        swarm.gz(a[1])
    else:
        {'context': context, 'merge': merge, 'path': path}[a[0]](*a[1:])
