#!/usr/bin/env python3
"""Weekly size-and-churn series for a repo's markdown, as one JSON payload.

Samples the default branch every N days, records every matching file's size in
words at each sample, and folds in per-file commit churn from `git log
--numstat`. Output feeds pages/doc-growth.html.

History follows renames, so a moved file keeps its edits under its current path.
Each edit is also WEIGHTED by 1 / the matching files its commit changed: a commit
to one file counts 1 for it, a sweep across ten counts 0.1 for each, so a sweep is
not read as attention to every document it touched, and no cutoff decides which
commits count. Files a commit hook writes (--generated) are marked `gen`, since
their edits are the hook's, not a reader's.

    python3 python/doc-growth.py . -o data/doc-growth/web-tools.json --name mehrlander/web-tools

Words come in two counts: `w` counts every token, `r` skips fenced code and YAML
frontmatter. Tables and indented code count in both, so the two diverge where a
file is mostly fenced code.
"""
import argparse, json, re, subprocess, sys, threading, time
from collections import defaultdict
from datetime import datetime, timezone

FENCE = re.compile(r'^\s*(```|~~~)')


def git(repo, *args, binary=False):
    r = subprocess.run(['git', '-C', repo, *args], capture_output=True)
    if r.returncode:
        sys.exit(f"git {' '.join(args)}: {r.stderr.decode()[:400]}")
    return r.stdout if binary else r.stdout.decode('utf-8', 'replace')


def counts(text):
    """(all words, prose words) for one markdown blob."""
    lines = text.split('\n')
    prose, infence, i = [], False, 0
    if lines and lines[0].strip() == '---':          # YAML frontmatter
        for j in range(1, len(lines)):
            if lines[j].strip() == '---':
                i = j + 1
                break
    for ln in lines[i:]:
        if FENCE.match(ln):
            infence = not infence
            continue
        if not infence:
            prose.append(ln)
    return len(text.split()), len('\n'.join(prose).split())


# Markdown the hub's and home's commit hooks write. Their edit counts measure the
# hook, so the page leaves them out of the Care reading.
GENERATED = [r'(^|/)tracker/board\.md$', r'^trackers\.md$', r'^full-picture\.md$',
             r'^chron/(blog/)?index\.md$', r'^pages/README\.md$', r'^docs/README\.md$',
             r'^skills/default/(CONVERSATION|QUALIFIED-WRITING)\.md$']


def renamed(field):
    """(old, new) from a numstat path field, which spells a rename as
    `old => new` or `pre/{old => new}/post`; (field, field) otherwise."""
    if ' => ' not in field:
        return field, field
    if '{' in field:
        pre, rest = field.split('{', 1)
        mid, post = rest.split('}', 1)
        old, new = mid.split(' => ')
        clean = lambda s: (pre + s + post).replace('//', '/')
        return clean(old), clean(new)
    old, new = field.split(' => ')
    return old, new


def group_of(path, containers):
    parts = path.split('/')
    if len(parts) == 1:
        return '(root)'
    if parts[0] in containers and len(parts) > 2:
        return '/'.join(parts[:2])
    return parts[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('repo')
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--branch', default='main')
    ap.add_argument('--ext', default='.md')
    ap.add_argument('--days', type=int, default=7, help='sampling interval')
    ap.add_argument('--name', default=None, help='owner/repo label for the page')
    ap.add_argument('--containers', default='projects,packages,apps',
                    help='dirs that group by two segments, not one')
    ap.add_argument('--generated', action='append', default=None,
                    help='regex for a file a commit hook writes (repeatable); '
                         'defaults to the hub\'s and home\'s hook outputs')
    ap.add_argument('--min-edits', type=int, default=1,
                    help='drop files touched in fewer commits than this. A file '
                         'at 1 was committed once and never revised, which in a '
                         'repo carrying generated markdown is most of the tree '
                         'and none of the story.')
    a = ap.parse_args()
    repo, containers = a.repo, set(a.containers.split(','))
    generated = [re.compile(g) for g in (a.generated or GENERATED)]

    stamps = [int(x) for x in git(repo, 'log', '--format=%ct', a.branch).split()]
    first, last = min(stamps), max(stamps)
    step = a.days * 86400

    # --- churn: which commits touched what, and by how many lines -------------
    # The log runs newest first, so a rename is met before the older commits
    # that used the old path: `alias` maps each earlier path to the file's
    # current one, and every row is filed under that.
    touched = defaultdict(list)          # current path -> [(ts, added, deleted, weight)]
    alias = {}
    commits, rows = [], None
    for line in git(repo, 'log', '--numstat', '-M', '--format=C|%ct',
                    a.branch).split('\n'):
        if line.startswith('C|'):
            rows = []
            commits.append((int(line[2:]), rows))
        elif line and rows is not None:
            add, dele, field = line.split('\t')
            old, new = renamed(field)
            if not new.endswith(a.ext):
                continue
            cur = alias.get(new, new)
            if old != new:
                alias[old] = cur
            rows.append((cur, int(add) if add != '-' else 0, int(dele) if dele != '-' else 0))
    for ts, rows in commits:
        for cur, add, dele in rows:
            touched[cur].append((ts, add, dele, 1 / len(rows)))

    # --- weekly trees ---------------------------------------------------------
    frames, trees = [], []
    t = first
    while t <= last + step:
        sha = git(repo, 'rev-list', '-1', f'--before=@{min(t, last)}', a.branch).strip()
        if sha:
            snap = {}
            for row in git(repo, 'ls-tree', '-r', '-l', sha).split('\n'):
                if not row:
                    continue
                meta, path = row.split('\t', 1)
                if path.endswith(a.ext):
                    snap[alias.get(path, path)] = meta.split()[2]      # blob sha
            frames.append(datetime.fromtimestamp(min(t, last), timezone.utc)
                          .strftime('%Y-%m-%d'))
            trees.append(snap)
        t += step

    # --- word counts, one read per distinct blob ------------------------------
    blobs = {s for snap in trees for s in snap.values()}
    sizes = {}
    proc = subprocess.Popen(['git', '-C', repo, 'cat-file', '--batch'],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    # Feed the request list from a thread. Writing it all up front deadlocks the
    # moment the batch outgrows a pipe buffer: git blocks writing blob content
    # nobody is reading yet, so our own write never returns. A repo small enough
    # to fit both sides in 64K (web-tools) runs clean and hides the bug.
    def feed():
        proc.stdin.write(('\n'.join(blobs) + '\n').encode())
        proc.stdin.close()
    writer = threading.Thread(target=feed, daemon=True)
    writer.start()
    for sha in blobs:
        header = proc.stdout.readline().split()
        n = int(header[2])
        sizes[sha] = counts(proc.stdout.read(n).decode('utf-8', 'replace'))
        proc.stdout.read(1)
    writer.join()
    proc.wait()

    # --- assemble -------------------------------------------------------------
    paths = sorted({p for snap in trees for p in snap
                    if len(touched.get(p, [])) >= a.min_edits})

    # Drop leading and trailing samples that hold none of the kept files. A repo
    # that spent its first year as a scratch pad (web-tools was one file named
    # TestNew.txt until April 2026) otherwise ships dozens of empty frames, and
    # a player that opens on one is indistinguishable from a player still
    # loading. Trimming here rather than in the page keeps every consumer honest.
    keep = [k for k, snap in enumerate(trees) if any(p in snap for p in paths)]
    if keep:
        lo, hi = keep[0], keep[-1] + 1
        trees, frames = trees[lo:hi], frames[lo:hi]
        first += lo * step
    groups = sorted({group_of(p, containers) for p in paths})
    gi = {g: i for i, g in enumerate(groups)}
    files = []
    for p in paths:
        w, pr, ed, wt, net = [], [], [], [], []
        for k, snap in enumerate(trees):
            sha = snap.get(p)
            w.append(sizes[sha][0] if sha else None)
            pr.append(sizes[sha][1] if sha else None)
            lo = first + (k - 1) * step
            hi = first + k * step
            ev = [e for e in touched.get(p, []) if lo < e[0] <= hi]
            ed.append(len(ev))
            wt.append(round(sum(e[3] for e in ev), 3))
            net.append(sum(e[1] - e[2] for e in ev))
        live = [i for i, v in enumerate(w) if v is not None]
        row = {'p': p, 'g': gi[group_of(p, containers)],
               'w': w, 'r': pr, 'e': ed, 'a': wt, 'n': net,
               'born': live[0] if live else 0,
               'edits': len(touched.get(p, [])),
               'weighted': round(sum(e[3] for e in touched.get(p, [])), 3)}
        le = max((e[0] for e in touched.get(p, [])), default=0)
        if le:
            row['le'] = datetime.fromtimestamp(le, timezone.utc).strftime('%Y-%m-%d')
        if any(g.search(p) for g in generated):
            row['gen'] = 1
        files.append(row)

    out = {'repo': a.name or repo, 'branch': a.branch, 'ext': a.ext,
           'days': a.days, 'generated': time.strftime('%Y-%m-%d'),
           'frames': frames, 'groups': groups, 'files': files}
    with open(a.out, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f"{a.out}: {len(files)} files (min-edits {a.min_edits}), "
          f"{len(frames)} frames, "
          f"{len(groups)} groups, {first and frames[0]}..{frames[-1]}")


main()
