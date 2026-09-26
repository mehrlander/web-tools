#!/usr/bin/env python3
"""Pages that render a daisyUI theme colour with an opacity modifier and never
tell Tailwind the name is a colour.

The class looks exactly like a class that works and does nothing. The failure is
silent and, for text, INVERTED: a background falls back to transparent so the
tint never draws, and text keeps its resting colour so the thing meant to change
does not. Nothing errors, and on the machine where the UI was built it reads as
a taste decision.

WHAT CHANGED ON 2026-09-16, AND WHY THIS SCAN IS ABOUT PAGES NOW. Tailwind
writes an opacity modifier by composing a color-mix, which it can only do for a
name it knows is a colour. A compiled build is told by `@plugin "daisyui"`;
pages here load daisyUI as a prebuilt stylesheet beside Tailwind's browser JIT
and were told by nothing. lib/gh-boot.js now registers the twenty names
(`@theme inline`, self-referencing var(), so daisyUI keeps the values), and
every page that boots through it composes every case correctly. A page that does
NOT reach that registration is where the old failures survive, so the page is
the unit this scans and the page is what the fix changes.

Two shapes are dead on such a page, and one is fine:

    bg-primary/10        static, on the ramp     daisyUI ships it, fine
    bg-primary/25        static, off the ramp    DEAD
    hover:bg-primary/10  any variant, any step   DEAD
    group-hover:bg-*/n   any variant, any step   DEAD

The ramp is daisyUI's own enumerated set, 10 to 90 by tens, which is why a
static class on it survives without help. The variant case has no such fallback:
daisyUI ships each colour's `hover:` rule at full opacity only and no
`group-hover:` rules at all.

MEASURED BOTH WAYS in headless Chromium against this app's own stylesheet,
reading getComputedStyle either side of a real hover. Unregistered: /25, /5 and
/[25%] all dead, every variant-plus-opacity dead, stock palette colours like
bg-red-500/25 fine throughout. Registered: all of them paint, including the
bracket escape. The rule is about daisyUI's theme colours specifically, which is
why the colour list below is the whole classifier and is pinned by test; a scan
written to the looser rule "opacity must be a multiple of ten" would flag every
bg-red-500/25 in the tree and be wrong about all of them.

History: PR #457 hand-corrected 193 instances of the static off-ramp shape, and
this branch found 103 of the variant shape. Both were the same missing
registration, which is the argument for fixing pages rather than classes.
tools/test/theme-registration.test.mjs holds gh-boot's name list to the one
below so the two cannot drift.
"""

import argparse
import os
import re
import sys

# daisyUI 5's theme colours. Each is a CSS variable, which is what puts it on
# the shipped ramp instead of the browser build's compiler.
THEME_COLOURS = [
    'primary', 'primary-content',
    'secondary', 'secondary-content',
    'accent', 'accent-content',
    'neutral', 'neutral-content',
    'base-100', 'base-200', 'base-300', 'base-content',
    'info', 'info-content',
    'success', 'success-content',
    'warning', 'warning-content',
    'error', 'error-content',
]

# Utilities that take a colour and therefore an opacity modifier.
UTILITIES = [
    'bg', 'text', 'border', 'ring', 'outline', 'decoration', 'divide',
    'from', 'via', 'to', 'fill', 'stroke', 'accent', 'caret', 'placeholder',
    'shadow',
]

GENERATES = {10, 20, 30, 40, 50, 60, 70, 80, 90}

# Longest colour first, so `base-content` is not matched as `base` plus a
# leftover. A trailing `\b` would not save it: `base-100` ends in a digit and
# `content` starts a word.
_COLOURS = '|'.join(sorted(THEME_COLOURS, key=len, reverse=True))
_UTILS = '|'.join(UTILITIES)
PATTERN = re.compile(
    r'\b(?P<util>' + _UTILS + r')-(?P<colour>' + _COLOURS + r')'
    r'/(?P<step>\d{1,3}|\[[^\]\s]*\])'
)

SKIP_DIRS = {'.git', 'node_modules', 'dist', 'archive', '.preview', 'thumbs'}
EXTENSIONS = {'.html', '.js', '.mjs', '.md'}


def nearest_ten(step):
    """The step a reader most likely meant: nearest ten, TIES DOWN, and never
    below 10 since /0 does not generate either.

    Ties down is not a coin flip. It is what the estate's own sweep chose when
    it corrected 193 of these in PR #457: /45 went to /40 forty-seven times
    against /50 nine, /35 to /30 fifty-one against five, /25 to /20 twenty-seven
    against two. A value written between two steps was reaching for a little
    less than the step above it, so the step below is the closer reading of the
    intent. Only /5 and /8 had to go up, because nothing below 10 exists."""
    if step < 10:
        return 10
    if step > 90:
        return 90
    return min(GENERATES, key=lambda g: (abs(g - step), g))


# A page reaches the registration one of two ways: it carries the @theme block
# itself, or it boots through gh-boot.js, which injects one. A file that is not
# a standalone page (a component, a kit, a doc) renders inside whichever page
# hosts it and answers for nothing on its own.
REACHES = re.compile(r'@theme inline|lib/entry\.js|gh-api\.js|gh-boot|dist/web-tools\.js'
                     r'|dist/app\.js|dist/dictate\.js')
LOADS_TAILWIND = re.compile(r'tailwindcss/browser')


def unregistered(text, path):
    """A standalone page that renders these classes without the registration.

    Only an HTML page can answer this: the classes themselves are fine, and a
    component carrying one is fine, because the host page is what does or does
    not tell Tailwind the names are colours."""
    if not path.endswith('.html'):
        return False
    if not LOADS_TAILWIND.search(text):
        return False
    return not REACHES.search(text)


# A variant prefix is what the registration is really needed for. Without it,
# daisyUI's own enumerated ramp still answers a STATIC class on the tens.
VARIANT = re.compile(r'[a-z-]+:$')


def scan_text(text, path):
    """On an unregistered page, two shapes are dead and one is fine.

        bg-primary/10        static, on the ramp      daisyUI ships it
        bg-primary/25        static, off the ramp     DEAD
        hover:bg-primary/10  any variant, any step    DEAD

    Both dead shapes have the same cure, which is why they are one scan now:
    register the names and Tailwind composes every case itself."""
    out = []
    if not unregistered(text, path):
        return out
    for i, line in enumerate(text.splitlines(), 1):
        for m in PATTERN.finditer(line):
            before = line[:m.start()]
            vm = VARIANT.search(before)
            under_variant = bool(vm)
            full = (before[vm.start():] if vm else '') + m.group(0)
            step = m.group('step')
            on_ramp = (not step.startswith('[')) and int(step) in GENERATES
            if on_ramp and not under_variant:
                continue
            out.append((path, i, full, 'variant' if under_variant else 'step'))
    return out


def walk(roots):
    for root in roots:
        if os.path.isfile(root):
            yield root
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for name in sorted(filenames):
                if os.path.splitext(name)[1] in EXTENSIONS:
                    yield os.path.join(dirpath, name)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('roots', nargs='*', default=['lib', 'pages', 'app'],
                    help='files or directories to scan (default: lib pages app)')
    ap.add_argument('--check', action='store_true',
                    help='exit 1 when anything is found, for a gate')
    args = ap.parse_args(argv[1:])
    roots = args.roots or ['lib', 'pages', 'app']

    found = []
    for path in walk(roots):
        try:
            with open(path, encoding='utf-8', errors='replace') as fh:
                text = fh.read()
        except OSError:
            continue
        found.extend(scan_text(text, path))

    for path, line, cls, why in sorted(found):
        note = ('under a variant' if why == 'variant' else 'step is off daisyUI ramp')
        print(f'{path}:{line}: {cls} generates nothing here ({note})')

    if not found:
        print('dead-opacity: none; every page rendering a theme-colour opacity '
              'class reaches the @theme registration')
        return 0

    files = sorted({f for f, _, _, _ in found})
    print(f'\ndead-opacity: {len(found)} class(es) in {len(files)} page(s) that never '
          f'tell Tailwind these names are colours, so none of them generate.')
    print('Fix the PAGE, not the classes: add the @theme inline block beside its '
          'Tailwind script, or boot it through gh-boot.js.')
    for f in files:
        print(f'  {f}')
    return 1 if args.check else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
