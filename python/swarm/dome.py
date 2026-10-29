#!/usr/bin/env python3
"""Dome: one paragraph, bouts of fighters, every edit landing on one text, and
a referee who checks after each bout that a reader of the paragraph alone can
still answer what the original answered.

    dome.py init <run> <file> <first-line> <last-line> [options]
        --title T        the page's heading
        --about A        what the paragraph is, for the briefs
        --tasks F        reader tasks as JSON Lines (else a tasker writes them)
        --bouts N        the allowance of bouts (default 3)
        --fighters a,b   the temperaments in every bout (default: all of dome.md's)
    dome.py next <run> [--force]   fold in what the last action's agents wrote,
                                   then issue the next action and print its agents
    dome.py check <run> <output>   validate an agent's .jsonl
    dome.py reveal <run> <output>  seal a referee's answers; print the facts expected
    dome.py smash <run> <bout>     land a bout's edits by hand (next does it)
    dome.py gz <run>               the ledger as a #gz= payload

`next` is the coordinator. Run it, start the agents it names (one each, in
parallel, told to read its context file and follow it), and run it again,
until it reports the run ready for review. It issues, in turn:

- write_tasks: a tasker writes tasks.jsonl, the questions a reader of the
  paragraph must be able to answer from it, each with the facts an answer needs.
- run_check on the original: a referee answers each question from the original
  alone. A task the original fails is dropped, since no edit can keep it.
- bout N: each fighter edits the paragraph as bout N-1 left it, with the
  original, the tasks and the last check's findings in view. `next` smashes the
  bout: repairs first, then the biggest swing (the most words claimed, then
  the most saved). An edit whose words are not there exactly once, or that
  overlaps words this bout already wrote, is knocked out.
- run_check on bout N: a referee answers blind, reveals the expected facts and
  grades each answer. A failed task is a finding for bout N+1.

The run stops when the allowance of bouts is spent, or when a bout saves no
words and every task passes. The result is the shortest text on which every
task passes, the original if no bout's does. The ledger is <run>/ledger.json
(kind dome/1), read by pages/swarm.html.
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import swarm  # noqa: E402  (shared: load, save, where, git, words, gz)
from ladder import sections, listed, loose, QW, peeves, peeves_md, check_peeve  # noqa: E402

words = swarm.words
MAX_EDITS = 3
MODELS = {'tasker': 'sonnet', 'referee': 'sonnet', 'fighter': 'haiku'}
WAITING = 3  # next's exit status while an action's agents have not all written


def init(run, path, l0, l1, title=None, about=None, tasks=None, bouts=3, fighters=None):
    run = Path(run); run.mkdir(parents=True, exist_ok=True)
    raw = Path(path).read_text(encoding='utf-8').split('\n')
    text = ' '.join('\n'.join(raw[l0 - 1:l1]).split())
    temper = listed(sections('dome.md')['temperaments'])
    fighters = fighters or list(temper)
    if [f for f in fighters if f not in temper]:
        sys.exit(f'no temperament {", ".join(f for f in fighters if f not in temper)}; one of: {", ".join(temper)}')
    at = swarm.where(path, l0, l1)
    file = Path(path).resolve()
    root = swarm.git(file.parent, 'rev-parse', '--show-toplevel') or str(file.parent)
    jobs = (0 if tasks else 1) + (bouts + 1) + bouts * len(fighters)
    led = {'kind': 'dome/1', 'title': title or file.name,
           'source': {'path': path, 'lines': [l0, l1], **at, 'file': str(file),
                      'words': words(text), 'text': text},
           'brief': {'about': about or f'lines {l0} to {l1} of `{at.get("path", file.name)}`', 'root': root,
                     'tasks': [], 'models': MODELS,
                     'allowance': {'bouts': bouts, 'fighters': fighters, 'jobs': jobs}},
           'blocks': [{'id': 'P1', 'kind': 'para', 'text': text, 'words': words(text)}],
           'state': 'in_progress', 'actions': [], 'bouts': [], 'edits': [], 'path': [], 'checks': []}
    if tasks:
        errs = task_problems(lines_of(tasks))
        if errs:
            sys.exit(f'{tasks}:\n  ' + '\n  '.join(errs))
        led['brief']['tasks'] = [o for _, o in lines_of(tasks)]
    swarm.save(run, led)
    print(f'{run}/ledger.json: one paragraph, {words(text)} words; an allowance of {bouts} bouts'
          f' of {len(fighters)} fighters, {jobs} agent jobs in all')


# --- the ledger read

def before(led, n):
    """The paragraph as bout n finds it: bout n-1's text, or the original."""
    prior = [b for b in led['bouts'] if b['n'] < n]
    return prior[-1]['text'] if prior else led['blocks'][0]['text']


def live(led):
    return [t for t in led.get('brief', {}).get('tasks', []) if not t.get('dropped')]


def checks_on(led, n):
    """The referee's results on the text bout n left (0: the original), by task."""
    return {c['task']: c for c in led.get('checks', []) if c['target'] == n}


def passes(led, n):
    got = checks_on(led, n)
    return all(got.get(t['id'], {}).get('status') == 'pass' for t in live(led))


def brief_of(led):
    b = led.get('brief', {})
    return b.get('about', "a rule in web-tools' `CLAUDE.md`"), b.get('root', str(HERE.parents[1]))


def fill(text, led):
    about, root = brief_of(led)
    return text.replace('{about}', about).replace('{root}', root)


# --- context files: one per agent, each with its paths

def paths_md(run, out, reveal=False):
    me = HERE / 'dome.py'
    return (['## Paths', '', f'- Output: `{out}`']
            + ([f'- Reveal: `python3 {me} reveal {run} {out}`'] if reveal else [])
            + [f'- Check: `python3 {me} check {run} {out}`', ''])


def text_md(head, text):
    return [f'## {head} ({words(text)} words)', '', '```text', text, '```', '']


def tasks_md(led):
    return ['## What a reader must still be able to answer', '',
            'A reader with only the paragraph must be able to answer each question; an answer needs every fact listed.', ''] + [
        f'- **{t["id"]}** {t["question"]} Facts: {"; ".join(t["expected"])}.' for t in live(led)] + ['']


def findings_md(led, n):
    """What the referee found on the text bout n starts from."""
    if n <= 1 or not live(led):
        return []
    got, lost = checks_on(led, n - 1), []
    for t in live(led):
        c = got.get(t['id'])
        if c and c['status'] == 'fail':
            lost.append(f'- **{t["id"]}** {t["question"]} Missing: {c.get("missing", "")}')
    if not lost:
        return ["## The referee's findings", '', f'After bout {n - 1}, a reader of the paragraph alone could answer every question.', '']
    return ["## The referee's findings", '', f'After bout {n - 1}, a reader of the paragraph alone could not answer:', ''] + lost + ['']


def agent(run, name, model, ctx, out, lines):
    (run / ctx).write_text('\n'.join(lines), encoding='utf-8')
    return {'name': name, 'model': model, 'context': ctx, 'output': out}


def tasker(run, led):
    br, s = sections('dome.md'), led['source']
    L = ['# Dome tasker', '', fill(br['tasker'], led), ''] + paths_md(run, run / 'tasks.jsonl')
    L += text_md('The paragraph', led['blocks'][0]['text'])
    if s.get('file'):
        L += ['## Where it comes from', '', f'Lines {s["lines"][0]} to {s["lines"][1]} of `{s["file"]}`.', '']
    return agent(run, 'tasker', led['brief']['models']['tasker'], 'tasks.ctx.md', 'tasks.jsonl', L)


def referee(run, led, n):
    br, out = sections('dome.md'), f'c{n}-referee.jsonl'
    L = [f'# Dome referee: {"the original" if n == 0 else f"after bout {n}"}', '', br['referee'], '']
    L += paths_md(run, run / out, reveal=True) + text_md('The paragraph', before(led, n + 1))
    L += ['## The questions', ''] + [f'- **{t["id"]}** {t["question"]}' for t in live(led)] + ['']
    return agent(run, f'referee {n}', led['brief']['models']['referee'], f'c{n}-referee.ctx.md', out, L)


def fighter(run, led, n, name):
    br = sections('dome.md')
    temper = listed(br['temperaments'])
    if name not in temper:
        sys.exit(f'no temperament {name}; one of: {", ".join(temper)}')
    cur, orig, out = before(led, n), led['blocks'][0]['text'], f'b{n}-{name}.jsonl'
    L = [f'# Dome, bout {n}: {name}', '', fill(br['dome'], led), '',
         '## Your temperament', '', f'**{name}**: {temper[name]}', ''] + paths_md(run, run / out)
    L += text_md('The original', orig)
    L += ['## The paragraph now', '', 'It is still the original: this is the first bout.', ''] if cur == orig else text_md('The paragraph now', cur)
    L += (tasks_md(led) if live(led) else []) + findings_md(led, n)
    L += ['## The Qualified writing rules', '', QW.read_text(encoding='utf-8').split('---', 1)[-1].strip(), ''] + peeves_md()
    models = led.get('brief', {}).get('models', MODELS)
    return agent(run, name, models['fighter'], f'b{n}-{name}.ctx.md', out, L)


def context(run, n, name):
    """A fighter's brief by hand, for a run without a brief (next writes them)."""
    run, led = Path(run).resolve(), swarm.load(run)
    a = fighter(run, led, n, name)
    print(run / a['context']); print(run / a['output'])


# --- checks on what agents wrote

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


def task_problems(ls):
    errs, seen = [], set()
    if not 1 <= len(ls) <= 8:
        errs.append(f'{len(ls)} tasks; write three to six')
    for i, o in ls:
        if '_bad' in o:
            errs.append(f'line {i}: not JSON ({o["_bad"]})'); continue
        if not re.fullmatch(r't\d+', str(o.get('id', ''))) or o['id'] in seen:
            errs.append(f'line {i}: "id" must be t1, t2 and so on, each once')
        seen.add(o.get('id'))
        if not (isinstance(o.get('question'), str) and o['question'].strip()):
            errs.append(f'line {i}: needs a "question"')
        ex = o.get('expected')
        if not (isinstance(ex, list) and ex and all(isinstance(x, str) and x.strip() for x in ex)):
            errs.append(f'line {i}: "expected" must list the facts an answer needs, each a short phrase')
    return errs


def sealed_of(out):
    return Path(out).with_name(Path(out).name.replace('.jsonl', '.sealed.json'))


def answer_problems(led, ls):
    errs, ids = [], [t['id'] for t in live(led)]
    got = [o.get('task') for _, o in ls]
    for i, o in ls:
        if '_bad' in o:
            errs.append(f'line {i}: not JSON ({o["_bad"]})')
        elif not (isinstance(o.get('answer'), str) and o['answer'].strip()):
            errs.append(f'line {i}: needs an "answer"')
    errs += [f'no answer for {t}' for t in ids if t not in got]
    errs += [f'{t} answered {got.count(t)} times' for t in ids if got.count(t) > 1]
    errs += [f'{t} is not a question here' for t in got if t not in ids]
    return errs


def referee_problems(led, out, ls):
    errs = answer_problems(led, ls)
    sealed = sealed_of(out)
    if not sealed.exists():
        return errs + ['run the reveal command before grading']
    seal = json.loads(sealed.read_text(encoding='utf-8'))
    for i, o in ls:
        if '_bad' in o:
            continue
        if o.get('task') in seal and o.get('answer') != seal[o['task']]:
            errs.append(f'line {i}: the answer changed after the reveal; restore it')
        if o.get('status') not in ('pass', 'fail'):
            errs.append(f'line {i}: "status" must be pass or fail')
        elif o['status'] == 'fail' and not (isinstance(o.get('missing'), str) and o['missing'].strip()):
            errs.append(f'line {i}: a fail says what is "missing"')
    return errs


def fighter_problems(led, out, ls):
    n, _ = bout_of(out)
    cur, errs = before(led, n), []
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
        errs += check_peeve(o, i)
    if sum('lost' in o for _, o in ls) > 1:
        errs.append('more than one repair; a fighter may complain once a bout')
    return errs


def problems(run, out):
    led, ls, name = swarm.load(run), lines_of(out), Path(out).name
    if name == 'tasks.jsonl':
        return task_problems(ls)
    if re.fullmatch(r'c\d+-referee\.jsonl', name):
        return referee_problems(led, out, ls)
    return fighter_problems(led, out, ls)


def check(run, out):
    errs = problems(run, out)
    print(f'{Path(out).name}: ' + ('ok' if not errs else '\n  ' + '\n  '.join(errs)))
    return not errs


def reveal(run, out):
    """Seal a referee's blind answers, then show the facts each must contain."""
    led, ls, sealed = swarm.load(run), lines_of(out), sealed_of(out)
    errs = answer_problems(led, ls)
    if errs:
        print(f'{Path(out).name}:\n  ' + '\n  '.join(errs)); return False
    answers = {o['task']: o['answer'] for _, o in ls}
    if sealed.exists() and json.loads(sealed.read_text(encoding='utf-8')) != answers:
        print(f'{Path(out).name}: the answers were sealed already and have changed since; restore them'); return False
    sealed.write_text(json.dumps(answers, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('Sealed. The facts each answer must contain:')
    for t in live(led):
        print(f'- {t["id"]}: {"; ".join(t["expected"])}')
    return True


# --- the smash

def smash(run, n, model='', files=None):
    run, led = Path(run), swarm.load(run)
    # A bout smashed again replaces itself, every bout after it, and their checks.
    led['bouts'] = [b for b in led['bouts'] if b['n'] < n]
    led['edits'] = [e for e in led['edits'] if e['bout'] < n]
    led['path'] = [s for s in led['path'] if s['bout'] < n]
    led['checks'] = [c for c in led.get('checks', []) if c['target'] < n]
    text = before(led, n)
    files = sorted(files if files is not None else run.glob(f'b{n}-*.jsonl'))
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
            if o.get('peeve'):
                e['peeve'] = o['peeve']
            edits.append(e)
    # Repairs first, so a complaint is heard before the cuts land; then the
    # biggest swing: the most words claimed, then the most words saved, so on
    # one span a cut beats a rewrite. A tie goes to the fighter named first.
    order = sorted(edits, key=lambda e: (not e.get('repair'), -words(e['from']), words(e['text']), e['id']))
    # Close the gaps a cut leaves, outside code spans, where a space before a
    # full stop can be an argument (`script . -o out`).
    tidy = lambda t: ''.join(p if p.startswith('`') else re.sub(r' +([.,;:)])', r'\1', re.sub(r'  +', ' ', p))
                             for p in re.split(r'(`[^`]*`)', t)).strip()
    # An edit lands only on words the bout started with: the spans this bout
    # has already written are off limits, so two fighters' words never stack.
    written = []
    for e in order:
        ms = list(loose(e['from']).finditer(text))
        a, b = ms[0].span() if len(ms) == 1 else (0, 0)
        if len(ms) != 1 or any(a < y and x < b for x, y in written):
            e['landed'] = False
            continue
        d = len(e['text']) - (b - a)
        written = [(x + d, y + d) if x >= b else (x, y) for x, y in written] + [(a, a + len(e['text']))]
        text = text[:a] + e['text'] + text[b:]
        e['landed'] = True
        led['path'].append({'edit': e['id'], 'bout': n, 'blocks': ['P1'], 'text': tidy(text), 'words': words(text)})
    text = tidy(text)
    led['edits'] += order
    led['peeves'] = {k: v['name'] for k, v in peeves().items()}
    landed = sum(e['landed'] for e in order)
    led['bouts'].append({'n': n, 'model': model, 'fighters': [bout_of(f)[1] for f in files],
                         'landed': landed, 'knocked': len(order) - landed, 'text': text, 'words': words(text)})
    swarm.save(run, led)
    print(f'bout {n}: {landed} landed, {len(order) - landed} knocked out, {words(before(led, n))} -> {words(text)} words')


# --- the coordinator

def fold(run, act, ready):
    """Take what an action's agents wrote into the ledger."""
    n = act.get('target')
    if act['op'] == 'bout':
        led = swarm.load(run)
        smash(run, n, led['brief']['models']['fighter'], [run / a['output'] for a in act['agents'] if run / a['output'] in ready])
    led = swarm.load(run)
    if act['op'] == 'write_tasks':
        led['brief']['tasks'] = [o for _, o in lines_of(run / 'tasks.jsonl')]
    elif act['op'] == 'run_check':
        led['checks'] = [c for c in led['checks'] if c['target'] != n]
        for _, o in lines_of(run / f'c{n}-referee.jsonl'):
            led['checks'].append({'target': n, 'task': o['task'], 'status': o['status'],
                                  'answer': o['answer'], **({'missing': o['missing']} if o['status'] == 'fail' else {})})
        if n == 0:
            for t in live(led):
                c = checks_on(led, 0)[t['id']]
                if c['status'] == 'fail':
                    t['dropped'] = f'the original fails it: {c["missing"]}'
    last = led['actions'][-1]
    last.update(status='done', used=len(ready))
    swarm.save(run, led)


def decide(led):
    """The next action and its reason, or present and the reason to stop."""
    al, bouts = led['brief']['allowance'], led['bouts']
    n = bouts[-1]['n'] if bouts else 0
    done = {c['target'] for c in led['checks']}
    if not led['brief']['tasks']:
        return 'write_tasks', None, 'the run has no reader tasks yet'
    if not live(led):
        return 'present', None, 'the original fails every task; the tasks need rewriting'
    if 0 not in done:
        return 'run_check', 0, 'calibrate the tasks on the original'
    if n and n not in done:
        return 'run_check', n, f'check what bout {n} left'
    if n >= al['bouts']:
        return 'present', None, f'the allowance of {al["bouts"]} bouts is spent'
    if n and bouts[-1]['words'] >= words(before(led, n)) and passes(led, n):
        return 'present', None, f'bout {n} saved no words and every task passes'
    failed = [t['id'] for t in live(led) if checks_on(led, n).get(t['id'], {}).get('status') == 'fail']
    why = f'repair {", ".join(failed)} and cut further' if failed else 'every task passes; cut further'
    return 'bout', n + 1, why


def present(led, why):
    """Pick the result: the shortest text on which every task passes."""
    wc = lambda n: words(before(led, n + 1))
    best = min([0] + [b['n'] for b in led['bouts'] if passes(led, b['n'])], key=lambda n: (wc(n), n))
    if led['state'] != 'ready_for_review':
        led['actions'].append({'id': f'a{len(led["actions"]) + 1}', 'op': 'present', 'reason': why, 'status': 'done'})
    led.update(state='ready_for_review', best=best, stop=why)
    return best


def next_(run, force=False):
    run, led = Path(run).resolve(), swarm.load(run)
    act = led['actions'][-1] if led['actions'] else None
    if act and act['status'] == 'issued':
        outs = [run / a['output'] for a in act['agents']]
        ready = [o for o in outs if o.exists() and not problems(run, o)]
        if len(ready) < len(outs) and not (force and ready and act['op'] == 'bout'):
            for o in outs:
                if o not in ready:
                    print(f'{o.name}: ' + ('not written yet' if not o.exists() else '; '.join(problems(run, o))))
            print(f'{act["id"]} {act["op"]}: waiting' + (' (`next --force` smashes the bout without them)' if ready and act['op'] == 'bout' else ''))
            return WAITING
        fold(run, act, ready)
        led = swarm.load(run)
    op, n, why = decide(led)
    al = led['brief']['allowance']
    used = sum(a.get('used', 0) for a in led['actions'])
    if op == 'present':
        best = present(led, why)
        swarm.save(run, led)
        orig = led['blocks'][0]['words']
        print(f'ready for review: {why}.')
        print(f'result: {"the original" if best == 0 else f"after bout {best}"}, {words(before(led, best + 1))} of {orig} words'
              f', every task passing; {used} of {al["jobs"]} agent jobs used')
        print(before(led, best + 1))
        return 0
    if op == 'write_tasks':
        agents = [tasker(run, led)]
    elif op == 'run_check':
        agents = [referee(run, led, n)]
    else:
        agents = [fighter(run, led, n, f) for f in al['fighters']]
    act = {'id': f'a{len(led["actions"]) + 1}', 'op': op, 'target': n, 'reason': why, 'agents': agents, 'status': 'issued'}
    led['actions'].append(act)
    swarm.save(run, led)
    label = {'write_tasks': 'write the tasks', 'run_check': f'check {"the original" if n == 0 else f"bout {n}"}', 'bout': f'bout {n}'}[op]
    print(f'{act["id"]} {label}: {why}. Agent jobs: {used} of {al["jobs"]} used, {len(agents)} now.')
    print('Start one agent per line, in parallel, each told to read its context file and follow it:')
    for a in agents:
        print(f'  {a["model"]:<7} {run / a["context"]}')
    print(f'Then: python3 {HERE / "dome.py"} next {run}')
    return 0


if __name__ == '__main__':
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    if not a or a[0] not in ('init', 'next', 'context', 'check', 'reveal', 'smash', 'gz'):
        sys.exit(__doc__)
    if a[0] == 'init':
        f = opt('--fighters')
        init(a[1], a[2], int(a[3]), int(a[4]), opt('--title'), opt('--about'), opt('--tasks'),
             int(opt('--bouts', 3)), f.split(',') if f else None)
    elif a[0] == 'next':
        sys.exit(next_(a[1], '--force' in a))
    elif a[0] == 'context':
        context(a[1], int(a[2]), a[3])
    elif a[0] == 'check':
        sys.exit(0 if check(a[1], a[2]) else 1)
    elif a[0] == 'reveal':
        sys.exit(0 if reveal(a[1], a[2]) else 1)
    elif a[0] == 'smash':
        smash(a[1], int(a[2]), opt('--model', ''))
    else:
        swarm.gz(a[1])
