#!/usr/bin/env python3
"""Make a look link for a page, and check its anchors against the page's source.

A look link is a fragment that lib/kits/look.js reads on arrival: it lands on a
place in the page, can say why, and can ring the control to tap. The kit's
header owns the grammar; in short, `show=<anchor>`, `tap=<anchor>`, `say=<text>`,
`walk=<name>` and `steps=<base64url JSON>`.

An anchor is only a reference once something has checked it, and the kit can
only check at run time, on the reader's screen, by saying "Not on this page".
This checks before the link is sent, from the page's source:

    data-at="<name>"            a declared anchor
    :data-at="'row-' + r.id"    a bound one; the literal head is checked as a
                                prefix, so `row-licenses` passes and the rest
                                of the name is the page's to supply at run time
    id="<name>"                 the kit's second resolution
    data-at-open="<name>"       each must name an anchor, or a hidden region
                                names an opener that is not there
    <script type="application/json" id="look-walks">
                                every step of every declared walk

`text:` and `css:` anchors are reported as unchecked: they resolve against the
rendered page, which a source read cannot see. So is any name on a page that
sets data-at from script, where a miss here may be a name made at run time.

Usage:
    look-link.py anchors PAGE              the anchors a page declares, one a line
    look-link.py check PAGE [PAGE ...]     every walk step and opener resolves;
                                           exit 1 on a miss
    look-link.py make PAGE --show A [--say TEXT]
    look-link.py make PAGE --tap A [--say TEXT]
    look-link.py make PAGE --walk NAME
    look-link.py make PAGE --steps JSON    a sequence, carried in the link

`make` prints the fragment without its '#', ready for `npm run showing -- --at`,
and names any anchor the page does not declare on stderr, exiting 1.
scripts/showing.py imports this file for the hint it prints beside a link to a
page that takes look links.
"""

import argparse
import base64
import json
import posixpath
import re
import sys
from pathlib import Path
from urllib.parse import quote

LITERAL = re.compile(r"""(?<![:\w-])data-at\s*=\s*(["'])(.*?)\1""", re.S)
BOUND = re.compile(r"""(?:(?<=\s):|x-bind:)data-at\s*=\s*(["'])(.*?)\1""", re.S)
OPEN = re.compile(r"""(?<![:\w-])data-at-open\s*=\s*(["'])(.*?)\1""", re.S)
IDS = re.compile(r"""(?<![:\w-])id\s*=\s*(["'])([^"'\s]+)\1""")
WALKS = re.compile(r"""<script\b[^>]*\bid\s*=\s*["']look-walks["'][^>]*>(.*?)</script>""", re.S | re.I)
SCRIPTED = re.compile(r"""dataset\.at\s*=|setAttribute\(\s*["']data-at["']""")
# Loading the kit, not mentioning it: a gh.load call, the kit's own assignment
# where a renderer has inlined it, or a script src that resolves to the kit. A
# page that only names the file, as a link to its source does, takes no look
# links. A relative src is resolved against the page's folder when the page's
# path is known, since a kit demo loads it as ../look.js.
KIT = re.compile(r"""gh\.load\(\s*["']kits/look\.js|window\.Look\s*=(?!=)""")
SRCS = re.compile(r"""<script\b[^>]*\bsrc\s*=\s*["']([^"'?#]+)""", re.I)


# Booting the web-tools loader, which loads the kit itself when a fragment asks
# for a look marker (lib/gh-boot.js, LOOK_BOOT): an import of entry.js or
# gh-api.js, or of a pre-build.
BOOTS = re.compile(r"""(?:import\s*\(\s*|import\s+|from\s*|src\s*=\s*)["'`][^"'`]*(?:lib/entry\.js|gh-api\.js|dist/(?:web-tools|app)\.js)""")


def takes_look(text, page=None):
    """Whether a look link reaches this page without the toss renderer."""
    if KIT.search(text) or BOOTS.search(text):
        return True
    for src in SRCS.findall(text):
        if src.endswith("kits/look.js"):
            return True
        if page and not re.match(r"^(?:[a-z][a-z0-9+.-]*:|/)", src, re.I):
            if posixpath.normpath(posixpath.join(posixpath.dirname(str(page)), src)).endswith("lib/kits/look.js"):
                return True
    return False


# The literal head of a bound expression: 'row-' + x, "row-" + x, `row-${x}`.
HEAD = re.compile(r"""^\s*(['"`])([^'"`$]*)""")
WHOLE = re.compile(r"""^\s*(['"])([^'"]*)\1\s*$""")


def read_page(text, page=None):
    """What a page's source declares, for resolving and for reporting."""
    names, prefixes = set(), set()
    for _, v in LITERAL.findall(text):
        names.add(v)
    for _, expr in BOUND.findall(text):
        m = WHOLE.match(expr)
        if m:
            names.add(m.group(2))
            continue
        h = HEAD.match(expr)
        if h and h.group(2):
            prefixes.add(h.group(2))
    walks, walk_error = {}, None
    m = WALKS.search(text)
    if m:
        try:
            walks = json.loads(m.group(1))
            if not isinstance(walks, dict):
                walks, walk_error = {}, "look-walks is not an object of named walks"
        except json.JSONDecodeError as e:
            walk_error = f"look-walks is not valid JSON ({e.msg}, line {e.lineno})"
    return {
        "takes": takes_look(text, page),
        "names": names,
        "prefixes": prefixes,
        "ids": {v for _, v in IDS.findall(text)},
        "opens": [v for _, v in OPEN.findall(text)],
        "scripted": bool(SCRIPTED.search(text)),
        "walks": walks,
        "walk_error": walk_error,
    }


def resolve(info, at):
    """How an anchor resolves against a page's source, or None for a miss."""
    if at.startswith(("text:", "css:")):
        return "unchecked"
    if at in info["names"]:
        return "name"
    if any(at.startswith(p) and len(at) > len(p) for p in info["prefixes"]):
        return "prefix"
    if at in info["ids"]:
        return "id"
    # A page that sets names from script, or declares none at all, can only be
    # checked on the rendered page, by the kit.
    if info["scripted"] or not (info["names"] or info["prefixes"]):
        return "unchecked"
    return None


def problems(info):
    """Every declared walk step and every opener that names nothing."""
    out = []
    if info["walk_error"]:
        out.append(info["walk_error"])
    for name, steps in info["walks"].items():
        if not isinstance(steps, list) or not steps:
            out.append(f"walk {name!r} has no steps")
            continue
        for i, s in enumerate(steps, 1):
            at = str((s or {}).get("at", "")).strip() if isinstance(s, dict) else ""
            if not at:
                out.append(f"walk {name!r} step {i} has no anchor")
            elif resolve(info, at) is None:
                out.append(f"walk {name!r} step {i}: {at!r} is not an anchor on this page")
    for at in info["opens"]:
        if resolve(info, at) is None:
            out.append(f"data-at-open={at!r} names no anchor on this page")
    return out


def encode(steps):
    raw = json.dumps(steps, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode(value):
    """The steps a steps= value carries: base64url JSON, or plain JSON."""
    v = value.strip()
    if v.startswith("["):
        return json.loads(v)
    return json.loads(base64.urlsafe_b64decode(v + "=" * (-len(v) % 4)).decode("utf-8"))


def fragment(show=None, tap=None, say=None, walk=None, steps=None):
    """The fragment, without '#', in the plainest form that carries the ask."""
    if steps is not None:
        return "steps=" + encode(steps)
    if walk is not None:
        return "walk=" + quote(walk, safe="")
    key, at = ("tap", tap) if tap is not None else ("show", show)
    out = f"{key}={quote(at, safe=':')}"
    if say:
        out += "&say=" + quote(say, safe="")
    return out


def asked(info, show=None, tap=None, walk=None, steps=None):
    """The anchors a link asks for that the page does not declare."""
    if walk is not None:
        if walk not in info["walks"]:
            return [f"the page declares no walk named {walk!r}"]
        return []
    ats = [s.get("at", "") for s in steps] if steps is not None else [tap if tap is not None else show]
    return [f"{a!r} is not an anchor on this page" for a in ats if resolve(info, str(a)) is None]


def main(argv=None):
    ap = argparse.ArgumentParser(description="Make a look link for a page and check its anchors.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("anchors", help="list the anchors a page declares")
    a.add_argument("page")
    a.add_argument("--json", action="store_true")
    c = sub.add_parser("check", help="every declared walk step and opener resolves")
    c.add_argument("pages", nargs="+")
    m = sub.add_parser("make", help="print a look fragment for a page")
    m.add_argument("page")
    g = m.add_mutually_exclusive_group(required=True)
    g.add_argument("--show")
    g.add_argument("--tap")
    g.add_argument("--walk")
    g.add_argument("--steps", help="a JSON list of {at, say?, tap?}")
    m.add_argument("--say")
    o = ap.parse_args(argv)

    if o.cmd == "anchors":
        info = read_page(Path(o.page).read_text(errors="ignore"), o.page)
        if o.json:
            print(json.dumps({k: sorted(v) if isinstance(v, set) else v for k, v in info.items()}, indent=2))
            return 0
        for n in sorted(info["names"]):
            print(f"{n}\tname")
        for p in sorted(info["prefixes"]):
            print(f"{p}*\tprefix")
        for i in sorted(info["ids"] - info["names"]):
            print(f"{i}\tid")
        for w in sorted(info["walks"]):
            print(f"{w}\twalk")
        if not info["takes"]:
            print("! this page neither boots the web-tools loader nor loads kits/look.js, "
                  "so a look link reaches it only through the toss renderer", file=sys.stderr)
        return 0

    if o.cmd == "check":
        bad = 0
        for page in o.pages:
            for p in problems(read_page(Path(page).read_text(errors="ignore"), page)):
                print(f"{page}: {p}")
                bad += 1
        return 1 if bad else 0

    info = read_page(Path(o.page).read_text(errors="ignore"), o.page)
    steps = None
    if o.steps is not None:
        try:
            steps = json.loads(o.steps)
        except json.JSONDecodeError as e:
            print(f"! --steps is not JSON: {e.msg}", file=sys.stderr)
            return 2
        if not isinstance(steps, list) or not all(isinstance(s, dict) and s.get("at") for s in steps):
            print("! --steps must be a list of objects, each with an `at`", file=sys.stderr)
            return 2
    print(fragment(show=o.show, tap=o.tap, say=o.say, walk=o.walk, steps=steps))
    misses = asked(info, show=o.show, tap=o.tap, walk=o.walk, steps=steps)
    for x in misses:
        print("! " + x, file=sys.stderr)
    ats = [] if o.walk is not None else (
        [s["at"] for s in steps] if steps is not None else [o.tap if o.tap is not None else o.show])
    for at in ats:
        how = resolve(info, str(at))
        if how == "prefix":
            print(f"note: {at!r} matches only a bound prefix; the page makes the rest of the name at run time",
                  file=sys.stderr)
        elif how == "unchecked":
            print(f"note: {at!r} resolves only on the rendered page, so it is unchecked here", file=sys.stderr)
    if not info["takes"]:
        print("! this page neither boots the web-tools loader nor loads kits/look.js, "
              "so the link works only through the toss renderer", file=sys.stderr)
    return 1 if misses else 0


if __name__ == "__main__":
    sys.exit(main())
