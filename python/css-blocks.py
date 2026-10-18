#!/usr/bin/env python3
"""Hand-written CSS: where it is, how much, and whether it has a stated reason.

The house rule is convention 6 of skills/html-style/references/mechanics.md: no
<style> blocks, no vanilla CSS, no <style type="text/tailwindcss">, no @apply.
Convention 3 asks for daisyUI's semantic colours over colour names. Nothing
checked either until 2026-10-18, and a read-only audit on 2026-10-17 measured
the gap with a scanner nobody kept. This one is kept, so the next measurement
reproduces this one.

WHAT COUNTS. A declaration (`property: value`) written by hand, in one of three
places, all in tracked .html, .js, .mjs and .css files:

    block    a <style> element, a .css file, or a JS template literal bound to
             a name containing "css" (const AL_CSS = `...`), which is the shape
             a view module uses to inject its stylesheet
    inline   a static style="..." attribute; one holding a ${...} interpolation
             is computed geometry and is not counted, nor is Alpine's :style

A selector, an at-rule head or a comment is not a declaration. Custom properties
are (`--deck-left: 18rem` is configuration written in CSS).

EXEMPT CSS carries its reason in the stylesheet, beside the rules it covers, in
one of two comments:

    /* exempt(<kind>): <reason> */       the one rule (or at-rule, with
                                         everything nested in it) that follows
    /* exempt-all(<kind>): <reason> */   every rule after it, to the end of
                                         that stylesheet

The kinds are closed, and each names a case where a utility cannot reach:

    third-party  the element is rendered by a library (Tabulator, marked,
                 CodeMirror) or is a daisyUI component's internal part, so no
                 class can be written on it
    svg          SVG drawn as a string where per-element classes would repeat
                 the rule on every node (a dimmed state toggled on the root)
    no-utility   Tailwind has neither a utility nor a variant for the property
                 or the selector (::-webkit-scrollbar, a :has() chain)
    theme        configuration the framework reads (@theme, a CSS variable
                 another component consumes)
    standalone   a page that loads no Tailwind by design
    kit          a kit that draws on any page and cannot assume the host's
                 Tailwind compiled its classes (lib/kits/guide-render.js)

An exemption with no reason, or a kind outside the list, is a finding.

THE GATE IS A RATCHET. A baseline CSV holds, per file, the unexempt declarations
it may carry; `--check` fails when a file exceeds its row or a file with no row
carries any. Conversion lowers a count and `--write` takes the lower number;
it never raises one. `--rebase` accepts the measurement wholesale and is for a
change to THIS scanner, not to a page: a page that needs new CSS either writes
utilities or states its exemption.

THE CLASS REPORT (--classes) is descriptive, not gated. Each class token written
in markup is one of:

    framework  Tailwind compiles it, or daisyUI's stylesheet defines it
    icon       a Phosphor class (ph, ph-*)
    custom     not framework, and defined by a selector in hand-written CSS
               somewhere in the scanned tree
    other      none of these: a JS hook, a third-party library's class, or
               a class nothing styles

Tailwind is asked rather than imitated: the token list goes through the
installed compiler (node_modules/tailwindcss, run under node) and a token is
framework when the output carries its selector. Without node or the package,
framework is daisyUI-only and the report says so.
"""

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter

EXTS = ('.html', '.js', '.mjs', '.css')
# Supplied material (a captured page under data/source/, a research source
# cache) carries its author's CSS, not ours; node/test holds probe fixtures.
SKIP_DIRS = {'node_modules', '.git', 'dist', 'archive', 'vendor', 'source', 'sources', 'source-cache'}
SKIP_PREFIX = ('node/test/',)

KINDS = ('third-party', 'svg', 'no-utility', 'theme', 'standalone', 'kit')
EXEMPT = re.compile(r'^\s*exempt(-all)?\(([^)]*)\)\s*:?\s*(.*)$', re.S | re.I)

NAMED = re.compile(r'(?<![\w$])([A-Za-z_$][\w$]*)\s*[=:]\s*`')
STYLE = re.compile(r'<style\b[^>]*>(.*?)</style\s*>', re.S | re.I)
DECL = re.compile(r'^\s*(-{0,2}[A-Za-z][\w-]*)\s*:(.+)$', re.S)
HEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b')
CLASS_SEL = re.compile(r'\.(-?[A-Za-z_][\w-]*)')


# ---------------------------------------------------------------- the walk

def tracked(root, under=()):
    out = subprocess.run(['git', 'ls-files', '-z', '--', *(under or ['.'])], cwd=root,
                         capture_output=True, text=True).stdout
    for rel in out.split('\0'):
        if not rel or not rel.endswith(EXTS):
            continue
        if any(p in SKIP_DIRS for p in rel.split('/')[:-1]) or rel.startswith(SKIP_PREFIX):
            continue
        yield rel


def template_end(s, i):
    """Index of the backtick closing a template literal whose body starts at i."""
    n = len(s)
    while i < n:
        c = s[i]
        if c == '\\':
            i += 2
            continue
        if c == '`':
            return i
        if c == '$' and i + 1 < n and s[i + 1] == '{':
            i = interp_end(s, i + 2)
            continue
        i += 1
    return n


def interp_end(s, i):
    """Index just past the brace closing a ${ whose body starts at i."""
    n, depth = len(s), 1
    while i < n and depth:
        c = s[i]
        if c == '\\':
            i += 2
            continue
        if c == '`':
            i = template_end(s, i + 1) + 1
            continue
        if c in '"\'':
            q, i = c, i + 1
            while i < n and s[i] != q and s[i] != '\n':
                i += 2 if s[i] == '\\' else 1
            i += 1
            continue
        depth += (c == '{') - (c == '}')
        i += 1
    return i


def flatten(s, mark='0'):
    """Each ${...} replaced by a placeholder, so braces inside JS cannot pass
    for a rule body. Lines are kept so a reported line number still lands."""
    out, i, n = [], 0, len(s)
    while i < n:
        if s.startswith('${', i):
            j = interp_end(s, i + 2)
            out.append(mark + '\n' * s.count('\n', i, j))
            i = j
            continue
        out.append(s[i])
        i += 1
    return ''.join(out)


def comment_line(text, pos):
    """True when pos sits on a line that a JS or HTML comment opens: a comment
    that names <style> is prose, and in a view module it is common."""
    head = text[text.rfind('\n', 0, pos) + 1:pos].lstrip()
    return head.startswith(('//', '*', '/*', '<!--'))


def blocks(text, rel):
    """(name, line, css) per stylesheet in a file."""
    if rel.endswith('.css'):
        yield ('file', 1, text)
        return
    spans = []
    for m in NAMED.finditer(text):
        if 'css' not in m.group(1).lower() or comment_line(text, m.start()):
            continue
        st = m.end()
        en = template_end(text, st)
        spans.append((m.start(), en))
        yield (m.group(1), text.count('\n', 0, st) + 1, text[st:en])
    for m in STYLE.finditer(text):
        if comment_line(text, m.start()):
            continue
        if any(a < m.end() and m.start() < b for a, b in spans):
            continue
        yield ('<style>', text.count('\n', 0, m.start(1)) + 1, m.group(1))


# ---------------------------------------------------------------- one stylesheet

def parse(css):
    """Walk one stylesheet. Returns (declarations, exempt declarations, hex
    Counter, classes defined, problems), a problem being a malformed exemption
    as (offset, message)."""
    css = flatten(css)
    marks, problems = [], []        # (offset, kind, whole) per valid exemption

    def blank(m):
        body = m.group(0)[2:-2].strip()
        e = EXEMPT.match(body)
        if e:
            whole, kind, reason = bool(e.group(1)), e.group(2).strip().lower(), e.group(3).strip()
            if kind not in KINDS:
                problems.append((m.start(), f'exempt({kind}) is not a kind; use one of {", ".join(KINDS)}'))
            elif len(reason) < 8:
                problems.append((m.start(), f'exempt({kind}) states no reason'))
            else:
                marks.append((m.start(), kind, whole))
        return re.sub(r'[^\n]', ' ', m.group(0))

    css = re.sub(r'/\*.*?\*/', blank, css, flags=re.S)
    decls = exempt = 0
    hexes, classes = Counter(), set()
    whole = None                    # an exempt-all in force
    stack = [{'rule': False, 'cover': None}]
    seg = 0                         # start of the text since the last { } or ;

    def take(text, cover):
        nonlocal decls, exempt
        for part in text.split(';'):
            d = DECL.match(part)
            if not d:
                continue
            hexes.update(h.lower() for h in HEX.findall(d.group(2)))
            if cover:
                exempt += 1
            else:
                decls += 1

    for i, c in enumerate(css):
        if c not in '{};':
            continue
        top = stack[-1]
        if c == ';':
            if top['rule']:
                take(css[seg:i], top['cover'] or whole)
            seg = i + 1
            continue
        if c == '}':
            if top['rule']:
                take(css[seg:i], top['cover'] or whole)
            if len(stack) > 1:
                stack.pop()
            seg = i + 1
            continue
        head = css[seg:i].strip()
        cover = top['cover']
        for off, kind, all_ in marks:
            if seg <= off < i or (all_ and off < i and whole is None):
                if all_:
                    whole = whole or kind
                else:
                    cover = cover or kind
        if head and not head.startswith('@'):
            classes.update(CLASS_SEL.findall(re.sub(r'\[[^\]]*\]|\([^)]*\)', '', head)))
        stack.append({'rule': not head.startswith('@') or head.startswith(('@font-face', '@page')),
                      'cover': cover})
        seg = i + 1
    return decls, exempt, hexes, classes, problems


# ---------------------------------------------------------------- inline styles

INLINE = re.compile(r'''(?<![:\w-])style\s*=\s*(\\?["'])''')


def inline_styles(text):
    """(line, declarations, hexes) per static style="" attribute."""
    for m in INLINE.finditer(text):
        q = m.group(1)
        st = m.end()
        en = text.find(q, st)
        if en < 0:
            continue
        val = text[st:en]
        if '${' in val or '{' in val or '\n' in val:
            continue
        parts = [p for p in val.split(';') if DECL.match(p)]
        if parts:
            yield (text.count('\n', 0, m.start()) + 1, len(parts),
                   [h.lower() for p in parts for h in HEX.findall(p.split(':', 1)[1])])


# ---------------------------------------------------------------- per file

def measure(root, rel):
    try:
        text = open(os.path.join(root, rel), encoding='utf-8', errors='ignore').read()
    except OSError:
        return None
    f = {'path': rel, 'block': 0, 'inline': 0, 'exempt': 0, 'hex': Counter(),
         'classes': set(), 'blocks': [], 'problems': []}
    for name, line, css in blocks(text, rel):
        d, x, h, c, probs = parse(css)
        f['block'] += d
        f['exempt'] += x
        f['hex'].update(h)
        f['classes'] |= c
        if d or x:
            f['blocks'].append((name, line, d, x))
        for off, msg in probs:
            f['problems'].append((line + css.count('\n', 0, off), msg))
    if not rel.endswith('.css'):
        for line, k, h in inline_styles(text):
            f['inline'] += k
            f['hex'].update(h)
    f['total'] = f['block'] + f['inline']
    return f


def measure_all(root, paths=None, under=()):
    out = []
    for rel in (paths if paths is not None else tracked(root, under)):
        f = measure(root, rel)
        if f and (f['total'] or f['exempt'] or f['problems']):
            out.append(f)
    return out


# ---------------------------------------------------------------- baseline

def read_baseline(path):
    if not os.path.exists(path):
        return {}
    with open(path, newline='', encoding='utf-8') as fh:
        return {r['path']: int(r['declarations']) for r in csv.DictReader(fh)}


def write_baseline(path, rows):
    with open(path, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh, lineterminator='\n')
        w.writerow(['path', 'declarations'])
        for p in sorted(rows):
            if rows[p] > 0:
                w.writerow([p, rows[p]])


def compare(files, base):
    """(over, new, under) against a baseline. Over and new fail the gate."""
    now = {f['path']: f['total'] for f in files}
    over = [(p, now[p], base[p]) for p in sorted(now) if p in base and now[p] > base[p]]
    new = [(p, now[p]) for p in sorted(now) if p not in base and now[p] > 0]
    under = [(p, now.get(p, 0), base[p]) for p in sorted(base) if now.get(p, 0) < base[p]]
    return over, new, under


# ---------------------------------------------------------------- class tokens

ATTR = re.compile(r'''(?<![\w:-])(?:class|className)\s*=\s*(\\?["'`])''')
BOUND = re.compile(r'''(?:x-bind:class|:class)\s*=\s*(["'])''')
CLASSLIST = re.compile(r'''classList\.(?:add|remove|toggle)\(([^)]*)\)''')
STRLIT = re.compile(r'''(["'])((?:(?!\1)[^\\\n]|\\.)*)\1''')
TOKEN_OK = re.compile(r'^[!@\[\]\w:/.%&>*+~=#(),\'"-]+$')


def attr_end(text, i, q):
    n = len(text)
    while i < n:
        if text.startswith('${', i):
            i = interp_end(text, i + 2)
            continue
        if text.startswith(q, i):
            return i
        if text[i] == '\n' and q != '`':
            return i
        i += 1
    return n


def tokens(text):
    """Class tokens written in markup, in the forms this tree uses."""
    for m in ATTR.finditer(text):
        q = m.group(1)
        en = attr_end(text, m.end(), q)
        yield from split_tokens(flatten(text[m.end():en], '\0'))
    for m in BOUND.finditer(text):
        q = m.group(1)
        en = text.find(q, m.end())
        expr = text[m.end():en] if en > 0 else ''
        for s in STRLIT.finditer(expr):
            yield from split_tokens(s.group(2))
    for m in CLASSLIST.finditer(text):
        for s in STRLIT.finditer(m.group(1)):
            yield from split_tokens(s.group(2))


def split_tokens(s):
    for t in s.split():
        # a token holding an interpolation is a fragment (st-${kind}), not a class
        if t and '\0' not in t and TOKEN_OK.match(t) and not t.startswith('#') and not t.isdigit():
            yield t


def daisy_classes(root):
    path = os.path.join(root, 'node_modules', 'daisyui', 'daisyui.css')
    if not os.path.exists(path):
        return None
    css = open(path, encoding='utf-8', errors='ignore').read()
    return set(re.sub(r'\\(.)', r'\1', m) for m in re.findall(r'\.((?:\\.|[\w-])+)', css))


TW_JS = r'''
import { compile } from 'tailwindcss';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const pkg = path.dirname(new URL(import.meta.resolve('tailwindcss/package.json')).pathname);
const load = async (id, base) => {
  const p = id === 'tailwindcss' ? path.join(pkg, 'index.css')
    : id.startsWith('tailwindcss/') ? path.join(pkg, id.slice(12).replace(/(\.css)?$/, '.css'))
    : path.resolve(base, id);
  return { path: p, base: path.dirname(p), content: readFileSync(p, 'utf8') };
};
// gh-boot.js registers daisyUI's theme colours with @theme inline on every page
// that boots through it, which is what lets text-base-content/45 compile.
const names = ['primary', 'secondary', 'accent', 'neutral', 'base-100', 'base-200', 'base-300',
  'base-content', 'info', 'success', 'warning', 'error'].flatMap((n) => /^base-[123]/.test(n) ? [n] : [n, n + '-content'])
  .filter((n, i, a) => a.indexOf(n) === i && n !== 'base-content-content');
const theme = '@theme inline {' + names.map((n) => '--color-' + n + ': var(--color-' + n + ');').join('') + '}';
const c = await compile('@import "tailwindcss";' + theme, { base: pkg, loadStylesheet: load });
const cands = JSON.parse(readFileSync(0, 'utf8'));
const css = c.build(cands);
const esc = (s) => s.replace(/^-?\d/, (d) => d.length > 1 ? '-\\3' + d[1] + ' ' : '\\3' + d + ' ')
  .replace(/[^\w-]|^-$/g, (ch) => (/[\d]/.test(ch) ? ch : '\\' + ch));
const seen = cands.filter((k) => { const s = '.' + esc(k); let i = css.indexOf(s);
  while (i >= 0) { const nx = css[i + s.length]; if (!nx || !/[\w\\-]/.test(nx)) return true; i = css.indexOf(s, i + 1); }
  return false; });
process.stdout.write(JSON.stringify(seen));
'''


def tailwind_compiles(root, cands):
    """The subset of cands the installed Tailwind compiles, or None."""
    node = shutil.which('node')
    if not node or not os.path.exists(os.path.join(root, 'node_modules', 'tailwindcss', 'package.json')):
        return None
    r = subprocess.run([node, '--input-type=module', '-e', TW_JS], cwd=root, input=json.dumps(sorted(cands)),
                       capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write('css-blocks: tailwind compile failed: ' + r.stderr[-400:] + '\n')
        return None
    return set(json.loads(r.stdout))


FRAMEWORK_BARE = {'group', 'peer', 'dark', 'not-prose', 'container'}


def class_report(root, paths, tw_root):
    """Per-file Counter of framework/icon/custom/other token instances."""
    per, defined, cands = {}, set(), set()
    for rel in paths:
        f = measure(root, rel)
        if f:
            defined |= f['classes']
        try:
            text = open(os.path.join(root, rel), encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        toks = list(tokens(text))
        if toks:
            per[rel] = Counter(toks)
            cands.update(toks)
    daisy = daisy_classes(tw_root) or set()
    tw = tailwind_compiles(tw_root, cands)
    out = {}
    for rel, toks in per.items():
        c = Counter()
        for t, k in toks.items():
            base = t.split('/')[0] if t.startswith(('group/', 'peer/')) else t
            if t == 'ph' or t.startswith('ph-'):
                c['icon'] += k
            elif (tw is not None and t in tw) or t in daisy or base in FRAMEWORK_BARE or base.startswith(('group/', 'peer/')):
                c['framework'] += k
            elif t in defined:
                c['custom'] += k
            else:
                c['other'] += k
        out[rel] = c
    return out, tw is not None, bool(daisy)


# ---------------------------------------------------------------- output

def share(c):
    denom = c['framework'] + c['custom'] + c['other']
    return (100.0 * c['framework'] / denom) if denom else 0.0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('paths', nargs='*', help='files to scan (default: every tracked source file)')
    ap.add_argument('--root', default='.', help='repo root (default: cwd)')
    ap.add_argument('--under', action='append', default=[], help='limit the walk to a path prefix (repeatable)')
    ap.add_argument('--blocks', action='store_true', help='list every stylesheet, not just every file')
    ap.add_argument('--classes', action='store_true', help='report class tokens by kind, per file')
    ap.add_argument('--tailwind-root', help='where node_modules/tailwindcss and daisyui live (default: --root)')
    ap.add_argument('--baseline', help='the ratchet CSV (path,declarations)')
    g = ap.add_mutually_exclusive_group()
    g.add_argument('--check', action='store_true', help='exit 1 on a file over its baseline, a new file, or a malformed exemption')
    g.add_argument('--write', action='store_true', help='lower baseline rows to the measurement (never raises)')
    g.add_argument('--rebase', action='store_true', help='set the baseline to the measurement, raises included')
    args = ap.parse_args()
    root = args.root

    files = measure_all(root, args.paths or None, args.under)

    if args.classes:
        paths = args.paths or list(tracked(root, args.under))
        rep, has_tw, has_daisy = class_report(root, paths, args.tailwind_root or root)
        tot = Counter()
        for rel in sorted(rep, key=lambda r: share(rep[r])):
            c = rep[rel]
            tot.update(c)
            print(f'{share(c):5.1f}%  fw {c["framework"]:5d}  custom {c["custom"]:5d}  other {c["other"]:5d}  icon {c["icon"]:4d}  {rel}')
        print(f'\ncss-blocks classes: framework share {share(tot):.1f}% of {sum(tot.values()) - tot["icon"]} '
              f'non-icon tokens in {len(rep)} files (framework {tot["framework"]}, custom {tot["custom"]}, other {tot["other"]})'
              + ('' if has_tw else '; Tailwind compiler not found, so framework is daisyUI only')
              + ('' if has_daisy else '; daisyUI stylesheet not found'))
        return 0

    problems = [(f['path'], ln, msg) for f in files for ln, msg in f['problems']]
    for rel, ln, msg in problems:
        print(f'{rel}:{ln}: {msg}')

    if args.baseline and (args.check or args.write or args.rebase):
        full = read_baseline(args.baseline)
        # A narrowed walk (paths, --under) speaks only for the files it walked;
        # every other row is carried through untouched rather than read as zero.
        if args.paths:
            inside = lambda p: p in set(args.paths)
        elif args.under:
            inside = lambda p: any(p == u.rstrip('/') or p.startswith(u.rstrip('/') + '/') for u in args.under)
        else:
            inside = lambda p: True
        base = {p: n for p, n in full.items() if inside(p)}
        keep = {p: n for p, n in full.items() if not inside(p)}
        over, new, under = compare(files, base)
        if args.rebase:
            write_baseline(args.baseline, {**keep, **{f['path']: f['total'] for f in files}})
            print(f'css-blocks: baseline rebased to the measurement ({len(over)} raised, {len(new)} added, {len(under)} lowered)')
            return 0
        if args.write:
            now = {f['path']: f['total'] for f in files}
            write_baseline(args.baseline, {**keep, **{p: min(n, now.get(p, 0)) for p, n in base.items()}})
            print(f'css-blocks: {len(under)} baseline row(s) lowered; nothing raised'
                  + (f'; {len(over) + len(new)} file(s) still over, which --write cannot clear' if over or new else ''))
            return 0
        for p, n, b in over:
            print(f'{p}: {n} hand-written declarations, baseline {b}. Write utilities, or state an exemption: /* exempt(<kind>): <reason> */')
        for p, n in new:
            print(f'{p}: {n} hand-written declarations in a file the baseline does not list. Write utilities, or state an exemption: /* exempt(<kind>): <reason> */')
        if under:
            print(f'css-blocks: {len(under)} file(s) under their baseline; run --write to take the lower count'
                  + ''.join(f'\n  {p}: {n} < {b}' for p, n, b in under[:10]))
        ok = not over and not new and not problems
        print(f'css-blocks: {"ok" if ok else "FAIL"}: {sum(f["total"] for f in files)} unexempt declarations '
              f'in {sum(1 for f in files if f["total"])} files against a baseline of {sum(base.values())}')
        return 0 if ok else 1

    for f in sorted(files, key=lambda f: -f['total']):
        line = f'{f["total"]:6d}  block {f["block"]:5d}  inline {f["inline"]:4d}  exempt {f["exempt"]:4d}  hex {len(f["hex"]):3d}  {f["path"]}'
        print(line)
        if args.blocks:
            for name, ln, d, x in f['blocks']:
                print(f'          {f["path"]}:{ln}  {name}  {d} declarations' + (f', {x} exempt' if x else ''))
    hexes = Counter()
    for f in files:
        hexes.update(f['hex'])
    print(f'\ncss-blocks: {sum(f["total"] for f in files)} unexempt declarations '
          f'(block {sum(f["block"] for f in files)}, inline {sum(f["inline"] for f in files)}) '
          f'in {sum(1 for f in files if f["total"])} files; {sum(f["exempt"] for f in files)} exempt; '
          f'{len(hexes)} distinct hex colours, led by ' + ', '.join(f'{h} ({k})' for h, k in hexes.most_common(3)))
    return 1 if (args.check and problems) else 0


if __name__ == '__main__':
    sys.exit(main())
