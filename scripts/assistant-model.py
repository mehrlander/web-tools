#!/usr/bin/env python3
"""Fit the assistant-guess model: who wrote a branch that declares nobody.

AGENTS.md gives each assistant a branch prefix and a commit trailer, and
lib/kits/assistant-mark.js classifies a branch by reading them. A branch that
carries neither falls to `human`, which is the classifier's fallback rather
than a finding. This script learns what those unlabeled branches look like, so
the Activity view can offer a GUESS beside the declared marks without
pretending it is a record.

Two stages, because two different kinds of evidence are available and only one
of them is a guess:

  STAGE 1, identity.  Claude Code's harness authors its commits as
  `Claude <noreply@anthropic.com>`; a local tool authors as whatever git config
  holds. Measured over a 190-PR sample: 115 of 119 claude/ PRs carry the
  harness identity, and 16 of 16 gemini/ PRs carry the local one. That is
  evidence, not style, so it decides the Claude-or-not question outright
  wherever a row carries the field.

  STAGE 2, style.  Given a locally authored branch, Gemini and Codex are told
  apart by how they write a title and name a branch: conventional-commit heads,
  clause length, comma and `and` joins, slug shape. This is the part that is a
  model, and it is a small one: 41 examples, 16 features, leave-one-out
  accuracy 83% against a 61% majority baseline.

The three things this cannot do, stated here because the number above invites
more confidence than it earns:

  1. It has no `human` class. Every label comes from a branch prefix, and a
     person's own commits carry no prefix, so there are no labeled human
     examples to learn from. The model answers "closest to which assistant",
     never "was this an assistant at all".
  2. It learns one library's habits over one month. A tool that changes its
     commit style, or a fifth tool nobody has seen, scores as whichever of the
     two it happens to resemble.
  3. Topic beats style on this little data. A run with title vocabulary added
     scores 88%, five points better, by learning which files each tool touched
     that week. Those features are deliberately NOT shipped: they measure the
     work, not the writer, and they expire the moment the work moves on.

Usage:
  assistant-model.py --fetch     acquire data/assistant-attribution/branches.csv
                                 from the GitHub API (needs GITHUB_TOKEN)
  assistant-model.py             fit the CSV and write the weights into
                                 lib/kits/assistant-guess.js
  assistant-model.py --check     fail if those weights are behind the CSV
  assistant-model.py --report    print the leave-one-out scorecard
"""
import csv, json, math, os, re, sys, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLE = ROOT / 'data' / 'assistant-attribution' / 'branches.csv'
KIT = ROOT / 'lib' / 'kits' / 'assistant-guess.js'
BEGIN, END = '/* MODEL-BEGIN */', '/* MODEL-END */'

REPOS = ['mehrlander/web-tools', 'mehrlander/home',
         'mehrlander/shortcut-tools', 'mehrlander/web-tools-private']
# A declared prefix is the label. `agent/` is deliberately absent: nothing
# declares it, assistant-mark.js maps most of it to Gemini with three hardcoded
# exceptions, and a guessed label cannot train a guesser.
PREFIX = {'claude': 'claude', 'codex': 'codex', 'chatgpt': 'codex',
          'gemini': 'gemini', 'antigravity': 'gemini', 'grok': 'grok',
          'copilot': 'copilot'}
CLAUDE_SAMPLE = 120   # newest claude/ PRs kept, for the stage-1 base rates
CLASSES = ['gemini', 'codex']   # what stage 2 chooses between
THRESHOLD = 0.70      # below this the model abstains and the row stays blank

# ── features ────────────────────────────────────────────────────────────────
# Mirrored verbatim in lib/kits/assistant-guess.js and held by
# tools/test/assistant-guess.test.mjs, which recomputes the fixtures below in
# JavaScript. Every feature is a style property of the title or the branch
# slug. No vocabulary, no file paths, no timestamps: see the docstring.
CC = re.compile(r'^([a-z][a-z-]*)(\([^)]*\))?:\s')

def feats(title, slug):
    t = title or ''
    s = slug or ''
    f = {'bias': 1.0}
    m = CC.match(t)
    if m:
        f['cc'] = 1.0
        if m.group(2):
            f['ccscope'] = 1.0
        f['cctype_' + m.group(1)] = 1.0
    if ':' in t[:24]:
        f['colon_early'] = 1.0
    n = len(t.split())
    f['wlen_' + ('s' if n <= 6 else 'm' if n <= 10 else 'l' if n <= 14 else 'xl')] = 1.0
    if t[:1].isupper():
        f['cap'] = 1.0
    if ' and ' in t:
        f['and'] = 1.0
    if ',' in t:
        f['comma'] = 1.0
    if '`' in t:
        f['tick'] = 1.0
    if any(c.isdigit() for c in t):
        f['digit'] = 1.0
    if '(' in t and not m:
        f['paren'] = 1.0
    h = s.count('-')
    f['slughyp_' + ('s' if h <= 2 else 'm' if h <= 4 else 'l')] = 1.0
    # Claude Code's harness ends a branch slug with six random characters. A
    # row reaching stage 2 has no claude/ prefix, but a renamed or hand-pushed
    # branch can still carry the suffix, so it stays a feature.
    if re.search(r'-(?=[a-z0-9]{6}$)[a-z0-9]*\d[a-z0-9]*$', s):
        f['rand6'] = 1.0
    return f

# ── model ───────────────────────────────────────────────────────────────────
# Multinomial logistic regression, full-batch gradient descent, fixed iteration
# count and no shuffling, so one CSV yields one set of weights byte for byte.
# Classes are weighted to equal mass, which makes the weights a likelihood
# ratio rather than a record of how many PRs each tool happened to open. The
# prior belongs at scoring time, declared, where it can be argued with.
def train(data, classes, iters=400, lr=0.5, l2=0.05):
    W = {c: defaultdict(float) for c in classes}
    mass = {c: sum(1 for _, y in data if y == c) for c in classes}
    wt = {c: 1.0 / max(1, mass[c]) for c in classes}
    for _ in range(iters):
        G = {c: defaultdict(float) for c in classes}
        for f, y in data:
            p = softmax({c: dot(W[c], f) for c in classes})
            for c in classes:
                g = (p[c] - (1.0 if y == c else 0.0)) * wt[y]
                for k, v in f.items():
                    G[c][k] += g * v
        for c in classes:
            for k in set(W[c]) | set(G[c]):
                W[c][k] -= lr * (G[c][k] + (l2 * W[c][k] if k != 'bias' else 0.0))
    return {c: {k: round(v, 6) for k, v in W[c].items() if abs(v) > 1e-6} for c in classes}

def dot(w, f):
    return sum(w.get(k, 0.0) * v for k, v in f.items())

def softmax(z):
    mx = max(z.values())
    ex = {c: math.exp(v - mx) for c, v in z.items()}
    s = sum(ex.values())
    return {c: v / s for c, v in ex.items()}

def score(W, title, slug, classes=CLASSES):
    return softmax({c: dot(W[c], feats(title, slug)) for c in classes})

# ── acquisition ─────────────────────────────────────────────────────────────
def api(url):
    token = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    if not token:
        sys.exit('--fetch needs GITHUB_TOKEN or GH_TOKEN in the environment')
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def fetch():
    rows, claude = [], []
    for repo in REPOS:
        page = 1
        while page <= 12:
            batch = api(f'https://api.github.com/repos/{repo}/pulls'
                        f'?state=all&per_page=100&page={page}&sort=created&direction=desc')
            if not batch:
                break
            for p in batch:
                head = p['head']['ref'] or ''
                seg = head.split('/')[0] if '/' in head else ''
                row = {'repo': repo, 'number': p['number'], 'head': head,
                       'prefix': seg, 'label': PREFIX.get(seg, ''),
                       'created': (p['created_at'] or '')[:10],
                       'title': (p['title'] or '').replace('\n', ' ').strip(),
                       'identity': ''}
                (claude if row['label'] == 'claude' else rows).append(row)
            page += 1
    claude.sort(key=lambda r: r['created'], reverse=True)
    rows += claude[:CLAUDE_SAMPLE]
    # Identity costs one call per PR, so it is fetched only where it is read:
    # every non-claude row (stage 2 runs on the locally authored ones) and the
    # claude sample (which is what measures stage 1's separation in the first
    # place).
    for r in rows:
        try:
            cs = api(f"https://api.github.com/repos/{r['repo']}/pulls/{r['number']}/commits?per_page=100")
        except Exception as e:
            print(f"  ! {r['repo']}#{r['number']}: {e}", file=sys.stderr)
            continue
        # The branch's FIRST commit, not any of them. A later harness commit
        # only says a Claude session visited the branch (merging main into it,
        # refreshing an artifact), and reading those as ownership mislabeled 2
        # of 20 codex branches and 2 of 12 agent ones. Scoring the first commit
        # instead drops both to zero and costs Claude nothing: 115 of 115.
        first = (cs[0].get('commit', {}).get('author') or {}).get('email', '') if cs else ''
        r['identity'] = ('harness' if 'noreply@anthropic.com' in first
                         else 'web' if 'users.noreply.github.com' in first
                         else 'local' if first else '')
    rows.sort(key=lambda r: (r['repo'], r['number']))
    TABLE.parent.mkdir(parents=True, exist_ok=True)
    with TABLE.open('w', newline='') as fh:
        # lineterminator, because the repo's other CSVs are LF and csv
        # defaults to CRLF.
        w = csv.DictWriter(fh, ['repo', 'number', 'head', 'prefix', 'label',
                                'identity', 'created', 'title'], lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    print(f'wrote {TABLE.relative_to(ROOT)}: {len(rows)} rows')

def load():
    with TABLE.open() as fh:
        return list(csv.DictReader(fh))

def population(rows):
    """The rows stage 2 is fitted on: labeled, and authored locally."""
    return [r for r in rows if r['label'] in CLASSES and r['identity'] == 'local']

# ── evaluation ──────────────────────────────────────────────────────────────
def loo(pop):
    X = [(feats(r['title'], slug(r['head'])), r['label']) for r in pop]
    out = []
    for i in range(len(X)):
        W = train([x for j, x in enumerate(X) if j != i], CLASSES)
        p = softmax({c: dot(W[c], X[i][0]) for c in CLASSES})
        g = max(p, key=p.get)
        out.append((p[g], g, X[i][1]))
    return out

def slug(head):
    return head.split('/', 1)[1] if '/' in head else head

def report(rows):
    pop = population(rows)
    print(f'training population: {dict(Counter(r["label"] for r in pop))}')
    ident = defaultdict(Counter)
    for r in rows:
        if r['label'] and r['identity']:
            ident[r['label']][r['identity']] += 1
    print('\nstage 1, commit author identity per declared class')
    for k in sorted(ident, key=lambda x: -sum(ident[x].values())):
        print(f"  {k:<9} " + ', '.join(f'{v}x {n}' for n, v in ident[k].most_common()))
    res = loo(pop)
    base = max(Counter(r['label'] for r in pop).values()) / len(pop)
    print(f'\nstage 2, leave-one-out over {len(pop)} examples')
    print(f'  accuracy       {sum(1 for p, g, y in res if g == y) / len(res):.0%}')
    print(f'  baseline       {base:.0%} (always the majority class)')
    for th in (0.5, 0.6, 0.7, 0.8, 0.9):
        kept = [r for r in res if r[0] >= th]
        acc = sum(1 for p, g, y in kept if g == y) / len(kept) if kept else 0
        print(f'  p>={th}: answers {len(kept):>2}/{len(res)}, correct {acc:.0%}')
    return res

# ── emit ────────────────────────────────────────────────────────────────────
def block(rows):
    pop = population(rows)
    W = train([(feats(r['title'], slug(r['head'])), r['label']) for r in pop], CLASSES)
    res = loo(pop)
    kept = [r for r in res if r[0] >= THRESHOLD]
    fixtures = [{'title': r['title'], 'slug': slug(r['head']),
                 'p': {c: round(v, 4) for c, v in score(W, r['title'], slug(r['head'])).items()}}
                for r in sorted(pop, key=lambda r: (r['repo'], int(r['number'])))[:6]]
    ident = defaultdict(Counter)
    for r in rows:
        if r['label'] and r['identity']:
            ident[r['label']][r['identity']] += 1
    model = {
        'classes': CLASSES,
        'threshold': THRESHOLD,
        'weights': W,
        'fitted': {
            'examples': len(pop),
            'per_class': dict(Counter(r['label'] for r in pop)),
            'loo_accuracy': round(sum(1 for p, g, y in res if g == y) / len(res), 3),
            'loo_baseline': round(max(Counter(r['label'] for r in pop).values()) / len(pop), 3),
            'answered_at_threshold': round(len(kept) / len(res), 3),
            'correct_at_threshold': round(sum(1 for p, g, y in kept if g == y) / len(kept), 3) if kept else 0,
            'identity_base_rates': {k: dict(v) for k, v in sorted(ident.items())},
        },
        'fixtures': fixtures,
    }
    return json.dumps(model, indent=2, sort_keys=True)

def emit(rows, check=False):
    text = KIT.read_text()
    i, j = text.index(BEGIN), text.index(END)
    fresh = f'{BEGIN}\nconst MODEL = {block(rows)};\n{END}'
    if text[i:j + len(END)] == fresh:
        print('assistant-guess.js: model current')
        return 0
    if check:
        print('assistant-guess.js is behind data/assistant-attribution/branches.csv.\n'
              '  run: python3 scripts/assistant-model.py', file=sys.stderr)
        return 1
    KIT.write_text(text[:i] + fresh + text[j + len(END):])
    print('assistant-guess.js: model rewritten')
    return 0

if __name__ == '__main__':
    args = sys.argv[1:]
    if '--fetch' in args:
        fetch()
    elif '--report' in args:
        report(load())
    else:
        sys.exit(emit(load(), check='--check' in args))
