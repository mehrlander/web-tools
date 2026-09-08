#!/usr/bin/env python3
"""A daisyUI theme colour in a utility family daisyUI does not ship.

`divide-base-200` looks exactly like `border-base-300`, which works, and
generates nothing. Tailwind v4 then defaults `border-color` to `currentColor`
(v3 defaulted to `gray-200`), so `divide-y` alone paints its hairlines in the
TEXT colour: black rules where a faint grey was intended. Nothing errors.

THE CLASSIFIER IS THE POINT, and it is derived rather than declared. daisyUI 5's
theme colours are CSS variables, so Tailwind's browser build cannot compile a
utility for them; every working class is one daisyUI's own stylesheet ships. So
this reads `node_modules/daisyui/daisyui.css` and takes the supported set from
it, which means the answer tracks the installed version instead of a list here
going stale.

What that derivation says today (daisyUI 5.7.28): of the twenty-two families it
defines with a semantic colour, nineteen are its OWN components (`btn-primary`,
`badge-error`, `alert-warning`) and exactly three are Tailwind colour utilities:

    bg  border  text        ship, in all twenty colours
    divide  ring  outline  accent  from  via  to
    fill  stroke  caret  placeholder  decoration  shadow      DEAD

A stock palette colour (`divide-slate-300`, `ring-red-500`) is compiled by the
browser build and is fine, which is why the scan keys on the theme colours and
nothing else. Swapping the colour name is also the tell by hand: if
`divide-slate-300` fixes it, the semantic name was never compiling.

A GATE WAS TRIED AND ABANDONED ONCE, on 2026-08-22, and knowing why saves
repeating it: the attempt probed a rendered page, and a Tailwind BROWSER build
compiles only the classes it has scanned, so an injected `bg-red-500` control
does not resolve either and "this family rejects the colour" cannot be told from
"this class appears nowhere in the source". Both read as dead. The stylesheet
answers what the page cannot.

Advisory by default, in the idiom of dead-opacity.py beside it, which checks the
opacity STEP on a class this one checks the existence of. `--check` makes it a
gate. Exits 0 with a note when daisyUI is not installed, since the derivation
has nothing to read and a scan that cannot classify must not fail a suite.
"""

import argparse
import os
import re
import subprocess
import sys

DAISY_CSS = os.path.join('node_modules', 'daisyui', 'daisyui.css')

# daisyUI 5's theme colours, shared with scripts/dead-opacity.py. Each is a CSS
# variable, which is what puts it outside the browser build's compiler.
THEME_COLOURS = [
    'primary', 'primary-content', 'secondary', 'secondary-content',
    'accent', 'accent-content', 'neutral', 'neutral-content',
    'base-100', 'base-200', 'base-300', 'base-content',
    'info', 'info-content', 'success', 'success-content',
    'warning', 'warning-content', 'error', 'error-content',
]

# Tailwind's colour-utility families: every one takes a colour, so every one
# LOOKS like it should take a theme colour. Which of them actually do is what
# the stylesheet answers.
COLOUR_UTILS = [
    'bg', 'text', 'border', 'ring', 'outline', 'decoration', 'divide',
    'from', 'via', 'to', 'fill', 'stroke', 'accent', 'caret', 'placeholder',
    'shadow',
]

_COLOURS = '|'.join(sorted(THEME_COLOURS, key=len, reverse=True))
_UTILS = '|'.join(sorted(COLOUR_UTILS, key=len, reverse=True))
# The class as written: a variant prefix and an opacity step are both allowed to
# ride, since neither changes whether the base class exists.
PATTERN = re.compile(r'\b(?P<cls>(?P<util>' + _UTILS + r')-(?P<colour>' + _COLOURS + r'))(?![\w-])')
# A rule head in daisyUI's own stylesheet, which is where a supported class is
# declared. Flat selectors, one per rule.
DEFINED = re.compile(r'(?:^|[},;>+~\s])\.((?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*?)-(?:' + _COLOURS + r'))(?=[,{:\s])')

# Markdown is left out: every .md occurrence in this tree is prose ABOUT the
# trap (this file, the mechanics reference, SNAGS.md), and a class in a fenced
# example is documentation rather than markup a browser will meet.
EXTS = ('.html', '.js', '.mjs')
SKIP_DIRS = {'node_modules', '.git', 'dist', 'archive'}


def supported(root):
    """Every `<family>-<colour>` class daisyUI's stylesheet defines, or None."""
    path = os.path.join(root, DAISY_CSS)
    if not os.path.exists(path):
        return None
    css = open(path, encoding='utf-8', errors='ignore').read()
    return set(m.group(1) for m in DEFINED.finditer(css))


def tracked(root):
    out = subprocess.run(['git', 'ls-files', '-z'], cwd=root,
                         capture_output=True, text=True).stdout
    for rel in out.split('\0'):
        if not rel or not rel.endswith(EXTS):
            continue
        if any(part in SKIP_DIRS for part in rel.split('/')):
            continue
        yield rel


def scan(root, ship, paths=None):
    """(rel, lineno, class, suggestion) per dead class, in file order.

    `paths` scans exactly those files, which is how the test drives it and how a
    person checks one page; absent, it walks the tracked set.
    """
    hits = []
    for rel in (paths if paths is not None else tracked(root)):
        try:
            lines = open(os.path.join(root, rel), encoding='utf-8', errors='ignore').read().splitlines()
        except OSError:
            continue
        in_html_comment = False
        for n, line in enumerate(lines, 1):
            # A comment naming the trap is documentation, not markup, and this
            # tree carries several. HTML comments are tracked across lines
            # because that is the shape they take here: the app's markup lives
            # inside JS template literals, where a multi-line <!-- --> block is
            # how a decision is recorded beside the element it governs.
            was_comment = in_html_comment
            if '<!--' in line and '-->' not in line[line.index('<!--'):]:
                in_html_comment = True
            elif in_html_comment and '-->' in line:
                in_html_comment = False
                was_comment = True
            stripped = line.lstrip()
            if was_comment or in_html_comment or stripped.startswith(('//', '*', '<!--', '#')):
                continue
            for m in PATTERN.finditer(line):
                cls = m.group('cls')
                if cls in ship:
                    continue
                hits.append((rel, n, cls, suggest(m.group('util'), m.group('colour'))))
    return hits


def suggest(util, colour):
    if util == 'divide':
        return 'gap, or border-t + border-' + colour + ' per row'
    if util in ('ring', 'outline'):
        return 'border-' + colour + ', or a Tailwind palette colour'
    return 'bg/border/text-' + colour + ', or a Tailwind palette colour'


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('paths', nargs='*', help='files to scan (default: every tracked source file)')
    ap.add_argument('--check', action='store_true', help='exit 1 on any finding')
    ap.add_argument('--root', default='.', help='repo root (default: cwd)')
    args = ap.parse_args()

    ship = supported(args.root)
    if ship is None:
        print('dead-family: daisyUI is not installed, so the supported set cannot be '
              'derived; nothing scanned. Run npm install to enable this check.')
        return 0

    fams = sorted({c.rsplit('-', 1)[0] if not c.endswith('-content') else c[:c.rindex('-', 0, c.rindex('-'))]
                   for c in ship})
    hits = scan(args.root, ship, args.paths or None)
    for rel, n, cls, fix in hits:
        print(f'{rel}:{n}: {cls} generates no rule -> {fix}')
    if not hits:
        print('dead-family: none', end=' ')
    else:
        print(f'\ndead-family: {len(hits)} in {len({h[0] for h in hits})} file(s);', end=' ')
    print(f'{len(ship)} classes shipped by the installed daisyUI across {len(fams)} families')
    return 1 if (args.check and hits) else 0


if __name__ == '__main__':
    sys.exit(main())
