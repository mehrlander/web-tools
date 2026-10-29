#!/usr/bin/env python3
"""Reduction swarm: a ledger of reader entries over one passage, round by round.

    swarm.py init <run> <file> <first-line> <last-line> [--title T]
    swarm.py context <run> <round> <role>    write a reader's brief, print its paths
    swarm.py check <run> <output>            validate a reader's .jsonl or a harvest .json
    swarm.py merge <run> <round>             fold r<round>-<role>.jsonl into the ledger
    swarm.py harvest <run> <round>           fold r<round>-harvest.json and score it
    swarm.py status <run>                    one line per round
    swarm.py gz <run>                        the ledger as a #gz= payload

The ledger is <run>/ledger.json (kind swarm/1), read by pages/swarm.html. Roles
and their briefs are in roles.md beside this file.
"""
import base64, gzip, hashlib, json, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEGMENT = HERE.parent / 'annotate' / 'segment.py'
TAGS = {'core': 'c', 'tactic': 't', 'draft': 'd', 'word': 'w'}
# What each role may write; 'vote' is a vote line. A role not listed may write anything.
LANES = {'distiller': {'core'}, 'tactician': {'tactic'}, 'drafter': {'draft', 'word'},
         'challenger': {'draft', 'tactic'}, 'builder': {'draft', 'word', 'vote'}}
words = lambda s: len(s.split())


def load(run):
    return json.loads((Path(run) / 'ledger.json').read_text(encoding='utf-8'))


def save(run, led):
    (Path(run) / 'ledger.json').write_text(json.dumps(led, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def roles():
    out, cur = {}, None
    for line in (HERE / 'roles.md').read_text(encoding='utf-8').split('\n'):
        m = re.match(r'## (\w+)$', line)
        if m:
            cur = m.group(1); out[cur] = []
        elif cur:
            out[cur].append(line)
    return {k: '\n'.join(v).strip() for k, v in out.items()}


def net(e):
    return sum(v['v'] for v in e.get('votes', []))


def live_core(led):
    return [e for e in led['entries'] if e['tag'] == 'core' and net(e) >= 0]


def best(led, before):
    hs = [r for r in led['rounds'] if r.get('harvest') and r['n'] < before]
    return hs[-1] if hs else None


def init(run, path, l0, l1, title=None):
    run = Path(run); run.mkdir(parents=True, exist_ok=True)
    raw = Path(path).read_text(encoding='utf-8').split('\n')
    base = sum(len(x) + 1 for x in raw[:l0 - 1])
    chunk = '\n'.join(raw[l0 - 1:l1])
    seg = subprocess.run([sys.executable, str(SEGMENT), path, str(l0), str(l1)],
                         capture_output=True, text=True, check=True).stdout
    units = []
    for i, line in enumerate(seg.splitlines(), 1):
        u = json.loads(line)
        units.append({'id': f'S{i}', 'kind': u['kind'], 'start': u['start'] - base,
                      'end': u['end'] - base, 'words': u['words'], 'text': ' '.join(u['text'].split())})
    led = {'kind': 'swarm/1', 'title': title or Path(path).name,
           'source': {'path': path, 'lines': [l0, l1], 'words': words(chunk),
                      'sha256': hashlib.sha256(chunk.encode()).hexdigest(), 'text': chunk},
           'units': units, 'rounds': [], 'entries': []}
    save(run, led)
    print(f'{run}/ledger.json: {len(units)} units, {words(chunk)} words')


def fmt_entry(e):
    body = f"\"{e['from']}\" -> \"{e['to']}\"" if e['tag'] == 'word' else e['text']
    ups = sum(1 for v in e.get('votes', []) if v['v'] > 0)
    downs = [v for v in e.get('votes', []) if v['v'] < 0]
    s = f"- {e['id']} [{','.join(e['anchors'])}] ({e['role']}, +{ups} -{len(downs)})"
    if e.get('builds_on'):
        s += f" builds on {','.join(e['builds_on'])}"
    s += f": {body}"
    for v in downs:
        s += f"\n  - -1 from {v['role']} (round {v['round']}): {v['why']}"
    return s


def context(run, n, role):
    run, n, led, br = Path(run).resolve(), int(n), load(run), roles()
    out = run / (f'r{n}-harvest.json' if role == 'harvester' else f'r{n}-{role}.jsonl')
    ctx = run / f'r{n}-{role}.ctx.md'
    L = [f"# Reduction swarm: round {n}, role {role}", '', br['common'], '',
         f"## Your role: {role}", '', br[role], '',
         '## Paths', '', f'- Output: `{out}`',
         f'- Check: `python3 {Path(__file__).resolve()} check {run} {out}`', '',
         f"## Source ({led['source']['words']} words)", '']
    L += [f"- {u['id']} ({u['words']}w): {u['text']}" for u in led['units']]
    for tag in TAGS:
        es = [e for e in led['entries'] if e['tag'] == tag]
        if es:
            L += ['', f'## Ledger: {tag} ({len(es)})', ''] + [fmt_entry(e) for e in es]
    b = best(led, n)
    if b:
        h = b['harvest']
        L += ['', f"## Current best: round {b['n']}, {h['words']} words, core {h['core_carried']}/{h['core_total']}", '',
              h['text'], '', f"Dropped units: {', '.join(h['dropped']) or 'none'}"]
        L += [f"Lost core: {c['id']}: {c['lost']}" for c in h['core'] if 'lost' in c]
    elif led['entries']:
        L += ['', '## Current best', '', 'None yet: this is the first harvest.']
    ctx.write_text('\n'.join(L) + '\n', encoding='utf-8')
    print(ctx); print(out)


def unit_text(led, anchors):
    if anchors == ['ALL']:
        return led['source']['text']
    by = {u['id']: u['text'] for u in led['units']}
    return ' '.join(by[a] for a in anchors)


def check_reader(led, lines, role=None):
    ids = {e['id'] for e in led['entries']}
    uids = [u['id'] for u in led['units']]
    lane = LANES.get(role)
    errs = []
    for i, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except ValueError as ex:
            errs.append(f'line {i}: not JSON ({ex})'); continue
        kind = 'vote' if 'vote' in o else o.get('tag')
        if lane and kind not in lane:
            errs.append(f'line {i}: a {role} writes only {", ".join(sorted(lane))}, not {kind}'); continue
        if 'vote' in o:
            if o['vote'] not in ids: errs.append(f"line {i}: vote on unknown entry {o['vote']}")
            if o.get('v') not in (1, -1): errs.append(f'line {i}: v must be 1 or -1')
            if o.get('v') == -1 and not str(o.get('why', '')).strip(): errs.append(f'line {i}: a -1 needs why')
            continue
        tag, an = o.get('tag'), o.get('anchors')
        if tag not in TAGS: errs.append(f'line {i}: tag must be one of {", ".join(TAGS)}'); continue
        if not isinstance(an, list) or not an: errs.append(f'line {i}: anchors must be a non-empty list'); continue
        if an != ['ALL']:
            bad = [a for a in an if a not in uids]
            if bad: errs.append(f'line {i}: unknown anchors {bad}'); continue
            if an != sorted(an, key=uids.index): errs.append(f'line {i}: anchors out of source order')
        for b in o.get('builds_on', []):
            if b not in ids: errs.append(f'line {i}: builds_on unknown entry {b}')
        if tag == 'word':
            if 'from' not in o or 'to' not in o: errs.append(f'line {i}: a word entry needs from and to'); continue
            if o['from'] not in unit_text(led, an): errs.append(f"line {i}: from \"{o['from']}\" is not in {','.join(an)}")
        elif not str(o.get('text', '')).strip():
            errs.append(f'line {i}: text is empty')
        elif tag == 'core' and words(o['text']) > 20:
            errs.append(f'line {i}: a core item runs {words(o["text"])} words; keep it to 15 or fewer')
    return errs


def check_harvest(led, o):
    errs, text = [], o.get('text', '')
    uids = {u['id'] for u in led['units']}
    ids = {e['id'] for e in led['entries']}
    if not text.strip():
        return ['text is empty']
    pos, covered = 0, 0
    for k, m in enumerate(o.get('map', []), 1):
        q = m.get('quote', '')
        at = text.find(q, pos) if q else -1
        if at < 0: errs.append(f'map {k}: quote not found in text after the previous quote: "{q[:60]}"'); continue
        pos = at + len(q); covered += len(re.sub(r'\W', '', q))
        bad = [a for a in m.get('from', []) if a not in uids]
        if bad: errs.append(f'map {k}: unknown units {bad}')
        bad = [u for u in m.get('uses', []) if u not in ids]
        if bad: errs.append(f'map {k}: unknown entries {bad}')
    total = len(re.sub(r'\W', '', text))
    if total and covered < 0.95 * total:
        errs.append(f'map covers {covered} of {total} letters of text; quote every sentence or list item')
    want = {e['id'] for e in live_core(led)}
    got = [c.get('id') for c in o.get('core', [])]
    if set(got) != want or len(got) != len(set(got)):
        miss, extra = sorted(want - set(got)), sorted(set(got) - want)
        errs.append(f'core must list each live core item once; missing {miss}, not live {extra}')
    for c in o.get('core', []):
        if 'quote' in c and c['quote'] not in text: errs.append(f"core {c.get('id')}: quote not in text: \"{c['quote'][:60]}\"")
        if 'quote' not in c and not str(c.get('lost', '')).strip(): errs.append(f"core {c.get('id')}: needs a quote or a lost reason")
    return errs


def check(run, out):
    led, p = load(run), Path(out)
    if p.suffix == '.json':
        errs = check_harvest(led, json.loads(p.read_text(encoding='utf-8')))
    else:
        errs = check_reader(led, p.read_text(encoding='utf-8').splitlines(), p.stem.split('-', 1)[1])
    print('\n'.join(errs) if errs else f'{p.name}: ok')
    return not errs


def merge(run, n):
    run, n, led = Path(run), int(n), load(run)
    if any(r['n'] == n for r in led['rounds']):
        sys.exit(f'round {n} is already merged')
    files = sorted(f for f in run.glob(f'r{n}-*.jsonl'))
    if not files:
        sys.exit(f'no r{n}-*.jsonl in {run}')
    for f in files:
        errs = check_reader(led, f.read_text(encoding='utf-8').splitlines(), f.stem.split('-', 1)[1])
        if errs:
            sys.exit(f'{f.name}:\n' + '\n'.join(errs))
    rnd, seq = {'n': n, 'readers': []}, {t: 0 for t in TAGS}
    for f in files:
        role, made, cast = f.stem.split('-', 1)[1], [], 0
        for line in f.read_text(encoding='utf-8').splitlines():
            if not line.strip():
                continue
            o = json.loads(line)
            if 'vote' in o:
                tgt = next(e for e in led['entries'] if e['id'] == o['vote'])
                tgt.setdefault('votes', []).append({'round': n, 'role': role, 'v': o['v'], **({'why': o['why']} if o['v'] < 0 else {})})
                cast += 1
                continue
            seq[o['tag']] += 1
            e = {'id': f"{n}.{TAGS[o['tag']]}{seq[o['tag']]}", 'round': n, 'role': role,
                 'tag': o['tag'], 'anchors': o['anchors']}
            e.update({k: o[k] for k in ('text', 'from', 'to', 'builds_on') if k in o})
            led['entries'].append(e); made.append(e['id'])
        rnd['readers'].append({'role': role, 'entries': made, 'votes': cast})
    led['rounds'].append(rnd)
    save(run, led)
    print(f"round {n}: " + '; '.join(f"{r['role']} {len(r['entries'])} entries, {r['votes']} votes" for r in rnd['readers']))


def harvest(run, n):
    run, n, led = Path(run), int(n), load(run)
    rnd = next((r for r in led['rounds'] if r['n'] == n), None)
    if not rnd:
        sys.exit(f'merge round {n} first')
    o = json.loads((run / f'r{n}-harvest.json').read_text(encoding='utf-8'))
    errs = check_harvest(led, o)
    if errs:
        sys.exit('\n'.join(errs))
    carried = {a for m in o['map'] for a in m['from']}
    h = {'text': o['text'], 'words': words(o['text']), 'map': o['map'], 'core': o['core'],
         'note': o.get('note', ''), 'dropped': [u['id'] for u in led['units'] if u['id'] not in carried],
         'core_carried': sum(1 for c in o['core'] if 'quote' in c), 'core_total': len(o['core'])}
    rnd['harvest'] = h
    save(run, led)
    print(f"round {n}: {led['source']['words']} -> {h['words']} words, core {h['core_carried']}/{h['core_total']}, dropped {', '.join(h['dropped']) or 'none'}")


def status(run):
    led = load(run)
    print(f"{led['title']}: {led['source']['words']} words, {len(led['units'])} units")
    for r in led['rounds']:
        es = [e for e in led['entries'] if e['round'] == r['n']]
        tally = ' '.join(f"{t} {sum(1 for e in es if e['tag'] == t)}" for t in TAGS)
        h = r.get('harvest')
        hs = f"{h['words']} words, core {h['core_carried']}/{h['core_total']}" if h else 'no harvest'
        print(f"round {r['n']}: {tally}, votes {sum(x['votes'] for x in r['readers'])}; {hs}")


def gz(run):
    raw = (Path(run) / 'ledger.json').read_text(encoding='utf-8')
    print(base64.urlsafe_b64encode(gzip.compress(raw.encode())).decode().rstrip('='))


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('init', 'context', 'check', 'merge', 'harvest', 'status', 'gz'):
        sys.exit(__doc__)
    if a[0] == 'init':
        t = a[a.index('--title') + 1] if '--title' in a else None
        init(a[1], a[2], int(a[3]), int(a[4]), t)
    elif a[0] == 'check':
        sys.exit(0 if check(a[1], a[2]) else 1)
    else:
        {'context': context, 'merge': merge, 'harvest': harvest, 'status': status, 'gz': gz}[a[0]](*a[1:])
