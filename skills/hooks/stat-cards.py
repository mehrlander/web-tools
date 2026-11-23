#!/usr/bin/env python3
"""daisyUI stat cards in a class attribute (html-style rule 1).

Rule 1 rules out a row of tiles, each a label over a big number. daisyUI ships
that layout as the `stats` container and its `stat-value` figure, so the two
classes are the mechanical tell. A plain `stat` is not: pages/word-select.html
names a status span `stat`, which is why node/render/measure.mjs reads the same
two classes and nothing else.

Shares its class-attribute parser with reading-column.py beside this file, so a
class named in a comment or in prose is never a finding. Ships with the plugin
for the same reason: the guard that refuses one (stat-cards-guard.sh) runs from
any project root.

A `stat-card-ok` comment on the line, or on the line above, is the opt-out.

Advisory by default; `--check` makes it a gate. The default roots are the whole
tree minus vendored and archived folders, since a stat-card grid is as wrong in
dump/ as in pages/.
"""

import argparse
import importlib.util
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('reading_column', os.path.join(HERE, 'reading-column.py'))
_rc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_rc)

# A variant prefix (`sm:stats-horizontal`) does not make a new tell; `stats`
# itself is always on the container.
STAT = re.compile(r'(?:^|\s)(stats|stat-value)(?=\s|$)')
OPT_OUT = 'stat-card-ok'
EXTENSIONS = _rc.EXTENSIONS
SKIP_DIRS = _rc.SKIP_DIRS

MESSAGE = (
    '{cls} is a daisyUI stat card (html-style rule 1): a label over a big '
    'number spends the page\'s best space on a figure with no comparison. Show '
    'the count with the content or control that gives it context, such as a '
    'filter pill or a table caption.'
)


def scan_text(text, path):
    """[(path, line_no, class, message)], in line order."""
    out = []
    lines = text.splitlines()
    for i, line in enumerate(lines, 1):
        if OPT_OUT in line or (i > 1 and OPT_OUT in lines[i - 2]):
            continue
        for run in _rc._class_runs(line):
            for m in STAT.finditer(run):
                out.append((path, i, m.group(1), MESSAGE.format(cls=m.group(1))))
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('roots', nargs='*', help='files or directories to scan (default: the whole tree)')
    ap.add_argument('--check', action='store_true', help='exit 1 when anything is found, for a gate')
    args = ap.parse_args(argv[1:])

    found = []
    for path in _rc.walk(args.roots or ['.']):
        try:
            with open(path, encoding='utf-8', errors='replace') as fh:
                found.extend(scan_text(fh.read(), path))
        except OSError:
            continue

    for path, line, cls, _ in sorted(found):
        print(f'{path}:{line}: {cls}')
    if not found:
        print('stat-cards: none')
        return 0
    print(f'\nstat-cards: {len(found)} in {len({f for f, *_ in found})} file(s); html-style rule 1')
    return 1 if args.check else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
