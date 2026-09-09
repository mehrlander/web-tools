#!/usr/bin/env python3
"""Split a stranded branch's MISSING paths into the four things they can be.

The estate's branch scan (lib/kits/branch-status.js) gives every path a branch
touched one of three verdicts against the default branch: `landed` (these bytes
are there, at this path or moved anywhere else), `differs` (the path is there
holding other bytes), and `missing` (neither). It calls `missing` "the strong
stranded evidence, and the only class that says deleting the branch would lose
something", and for a scan working over the GitHub API that is as far as it can
honestly go: separating the causes needs a history walk it explicitly declines
to make.

That leaves `missing` carrying four different facts at once, and on this estate
the majority of them are not losses:

  moved     the default branch holds this BASENAME somewhere else. A file that
            moved and was edited on the way reads as missing, since the bytes
            no longer match and the path no longer exists.
  retired   the default branch's history shows this path deleted. The work
            landed and was later withdrawn, so the branch's copy is a revenant.
  stranded  none of the above, and history is complete enough to say so. This
            is the real thing: content that exists on this branch and nowhere
            else.
  unknown   none of the above, but history is TRUNCATED, so a deletion older
            than the clone cannot be ruled out. Reported separately rather than
            folded into stranded, because a shallow clone turning "we cannot
            see" into "it was lost" is how a cleanup pass talks itself into
            reopening settled work.

Measured on 2026-09-09 against the fourteen branches the scan then called
stranded. Eight were `moved` or `retired`: `tools/test/show-repo-*.test.mjs`
renamed to `shell-*`, `docs/CONVENTIONS.md` and `docs/PORTABLE.md` retired by
PRs #634 and #638, budget-drs checklist material landed under new names, and
`data/authored/notes.csv` moved to `submittal/notes.csv` while its own verifier
on the default branch kept opening the new path. Three were real. That pass was
done by hand, three times over, which is why it is a script now.

WHY THIS IS A CLI AND NOT PART OF THE SCAN. Both extra answers are cheap over a
local checkout and expensive over the API: the basename lookup wants the default
branch's whole tree, and the deletion lookup wants its history. The scan reads
neither. This is the same split branch-status.js already documents, where the
CLI answers what the crawl cannot afford.

Advisory and never blocking, in the idiom of dead-links.py, stranded-titles.py
and duplicated-claims.py: run it, read the list, act or shrug. It reports
candidates, not findings, and `moved` in particular is a LEAD rather than a
proof, since one basename can name two unrelated files.

Usage:
  stranded-triage.py <repo-dir> <branch> [<branch>...]  triage named branches
  stranded-triage.py --cache <activity.json>            every branch the scan
                                                        calls stranded, in the
                                                        sibling checkouts
  ... [--base <ref>]      what to compare against (default: the repo's origin/HEAD)
  ... [--siblings <dir>]  where the checkouts live (default: the repo's parent)
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

VERDICTS = ('landed', 'differs', 'moved', 'retired', 'stranded', 'unknown')


def git(repo, *args):
    """Run one git command in `repo`, returning stdout or '' on failure.

    Failure is a normal answer here, not an error: a branch the clone does not
    hold and a path with no history both come back empty, and the caller has a
    verdict for each.
    """
    try:
        r = subprocess.run(('git', '-C', str(repo)) + args,
                           capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.SubprocessError):
        return ''
    return r.stdout if r.returncode == 0 else ''


def tree(repo, ref):
    """{path: blob sha} for one ref. The blob sha is what makes `landed` a
    content test rather than a path test, which is the whole reason a file that
    moved without being edited never reaches this script at all."""
    out = {}
    for line in git(repo, 'ls-tree', '-r', ref).splitlines():
        meta, _, path = line.partition('\t')
        parts = meta.split()
        if len(parts) >= 3 and parts[1] == 'blob':
            out[path] = parts[2]
    return out


def deleted_at(repo, ref, path):
    """The commit that removed `path` from `ref`, or ''.

    `--no-renames` on purpose: a rename is recorded as a delete plus an add, and
    a delete is exactly what is being asked about. With rename detection on, git
    reports R and this returns nothing for the commonest retirement there is.
    """
    out = git(repo, 'log', '--no-renames', '--diff-filter=D',
              '--format=%h %s', '-1', ref, '--', path)
    return out.strip()


# A basename this common on the default branch carries no information: matching
# `README.md` proposes every README in the tree as the file that moved. Measured
# on home, where `code/batch/README.md` drew three unrelated leads and the real
# answer was that only its sibling .bat was stranded. Three is the smallest
# threshold that kills that case while keeping a genuine one-to-one move.
COMMON_BASENAME = 3


def classify(path, tip_blob, base, base_blobs, base_basenames,
             deletion, history_complete):
    """One path's verdict. Pure: every git read is a parameter.

    Order is the argument. `landed` and `differs` come first because they are
    facts about the CURRENT tree and cannot be wrong. `moved` and `retired` are
    inferences and only ever apply to what is left, so neither can override a
    file that is plainly present.
    """
    if tip_blob and tip_blob in base_blobs:
        return 'landed', base_blobs[tip_blob]
    if path in base:
        return 'differs', ''
    hits = [p for p in base_basenames.get(os.path.basename(path), []) if p != path]
    if hits and len(hits) < COMMON_BASENAME:
        return 'moved', ', '.join(sorted(hits))
    if deletion:
        return 'retired', deletion
    return ('stranded', '') if history_complete else ('unknown', 'history truncated')


def triage(repo, branch, base):
    """Every path `branch` touched that base does not hold identically."""
    merge_base = git(repo, 'merge-base', base, branch).strip()
    if not merge_base:
        return None, 'no merge base with ' + base
    base_tree = tree(repo, base)
    # Reverse index by content, so `landed` finds bytes that moved. First path
    # wins on a duplicate; which one is named does not change the verdict.
    base_blobs = {}
    base_basenames = {}
    for p, sha in base_tree.items():
        base_blobs.setdefault(sha, p)
        base_basenames.setdefault(os.path.basename(p), []).append(p)
    # A shallow clone cannot see a deletion older than its horizon, and saying
    # so is the difference between `stranded` and `unknown` below.
    complete = git(repo, 'rev-parse', '--is-shallow-repository').strip() != 'true'

    changed = [l.strip() for l in
               git(repo, 'diff', '--name-only', merge_base + '...' + branch).splitlines()
               if l.strip()]
    tip = tree(repo, branch)
    rows = []
    for path in changed:
        blob = tip.get(path)
        if blob is None:
            continue                    # the branch DELETED it; nothing is stranded
        v, note = classify(path, blob, base_tree, base_blobs, base_basenames,
                           deleted_at(repo, base, path) if path not in base_tree else '',
                           complete)
        rows.append({'path': path, 'verdict': v, 'note': note})
    return rows, ('' if complete else 'shallow clone: run `git -C %s fetch --unshallow` '
                                      'to separate retired from stranded' % repo)


def report(label, rows, caveat):
    counts = {v: 0 for v in VERDICTS}
    for r in rows:
        counts[r['verdict']] += 1
    live = [r for r in rows if r['verdict'] in ('moved', 'retired', 'stranded', 'unknown')]
    print('\n%s  (%d path%s)' % (label, len(rows), '' if len(rows) == 1 else 's'))
    print('  ' + ', '.join('%d %s' % (counts[v], v) for v in VERDICTS if counts[v]))
    for r in sorted(live, key=lambda r: (VERDICTS.index(r['verdict']), r['path'])):
        print('    %-9s %s%s' % (r['verdict'], r['path'],
                                 '  -> ' + r['note'] if r['note'] else ''))
    if caveat:
        print('  ! ' + caveat)
    return counts


def from_cache(path, siblings, base_override):
    """Every branch the activity cache calls stranded, in whatever sibling
    checkouts are on disk. A repo with no checkout is NAMED and skipped, since
    silently triaging four repos out of ten reads as a clean bill of health."""
    cache = json.loads(Path(path).read_text())
    jobs, absent = [], []
    for full, a in (cache.get('repos') or {}).items():
        short = full.split('/')[-1]
        repo = Path(siblings) / short
        stranded = [b['name'] for b in ((a.get('scan') or {}).get('branches') or [])
                    if b.get('group') == 'stranded']
        if not stranded:
            continue
        if not (repo / '.git').exists():
            absent.append('%s (%d branch%s)' % (short, len(stranded),
                                                '' if len(stranded) == 1 else 'es'))
            continue
        base = base_override or default_base(repo)
        for b in stranded:
            jobs.append((repo, 'origin/' + b, base, short + ' ' + b))
    return jobs, absent


def default_base(repo):
    head = git(repo, 'symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD').strip()
    return head.replace('refs/remotes/', '') if head else 'origin/main'


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('repo', nargs='?')
    ap.add_argument('branches', nargs='*')
    ap.add_argument('--cache')
    ap.add_argument('--base')
    ap.add_argument('--siblings')
    # Opt-in rather than automatic: `fetch --unshallow` rewrites the checkout,
    # and a triage run is not the moment to decide that for someone. It is the
    # difference between 21 `unknown` and 13 `stranded` on this estate, so the
    # caveat line names it every time it applies.
    ap.add_argument('--deepen', action='store_true',
                    help='git fetch --unshallow each repo first, so a deletion '
                         'older than the clone can still be found')
    a = ap.parse_args(argv[1:])

    if a.cache:
        siblings = a.siblings or str(Path(a.cache).resolve().parents[2])
        jobs, absent = from_cache(a.cache, siblings, a.base)
    elif a.repo and a.branches:
        repo = Path(a.repo)
        base = a.base or default_base(repo)
        jobs = [(repo, b, base, repo.name + ' ' + b) for b in a.branches]
        absent = []
    else:
        ap.print_help()
        return 2

    if a.deepen:
        for repo in {j[0] for j in jobs}:
            if git(repo, 'rev-parse', '--is-shallow-repository').strip() == 'true':
                print('deepening %s ...' % repo)
                git(repo, 'fetch', '--unshallow', '-q')

    total = {v: 0 for v in VERDICTS}
    for repo, branch, base, label in jobs:
        rows, caveat = triage(repo, branch, base)
        if rows is None:
            print('\n%s\n  ! %s' % (label, caveat))
            continue
        for v, n in report(label, rows, caveat).items():
            total[v] += n
    print('\nstranded-triage: %d branch%s; %s'
          % (len(jobs), '' if len(jobs) == 1 else 'es',
             ', '.join('%d %s' % (total[v], v) for v in VERDICTS if total[v]) or 'nothing to report'))
    if absent:
        print('not checked, no checkout here: ' + '; '.join(absent))
    if total['stranded'] or total['unknown']:
        print('Only `stranded` says content would be lost. `moved` is a lead, not a proof: '
              'one basename can name two unrelated files.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
