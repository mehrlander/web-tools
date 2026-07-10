#!/usr/bin/env python3
"""
Build a shortcuts:// link that delivers a chain of Shortcuts actions to the
Copy-ActionFromJson shortcut on the user's device.

Input: a JSON file (or stdin) holding a chain in compact form:

    { "actions": [ { "id": "...", "p": { ... } }, ... ] }

Output: a tappable shortcuts://run-shortcut link. Tapping it runs the
device-side shortcut, which serializes each action to plist XML, coerces it
to the com.apple.shortcuts.action UTI, and places it on the clipboard ready
to paste into any shortcut.

The payload travels as the JSON text itself, URL-encoded. The device-side
JS builder expects exactly the { "actions": [...] } shape this emits.

Inline variable anchors (the U+FFFC object-replacement character) MUST be
written in the JSON as the literal ASCII entity  &#65532;  -- never as the
raw glyph. See references/action-format.md for why.
"""
import json
import sys
import urllib.parse

SHORTCUT_NAME = "Copy-ActionFromJson"
RAW_GLYPH = "\uFFFC"


def validate(chain):
    """Catch the two mistakes that silently break a paste."""
    problems = []
    if not isinstance(chain, dict) or "actions" not in chain:
        problems.append("top level must be an object with an 'actions' array")
        return problems
    for i, a in enumerate(chain["actions"]):
        if "id" not in a or "p" not in a:
            problems.append(f"action {i}: needs both 'id' and 'p' keys")
        # The raw glyph must never appear; it dies on paste-in. Use &#65532;.
        if RAW_GLYPH in json.dumps(a, ensure_ascii=False):
            problems.append(
                f"action {i}: contains a raw U+FFFC glyph. "
                f"Write inline anchors as the ASCII entity &#65532; instead."
            )
    return problems


def build_link(chain):
    payload = json.dumps(chain, ensure_ascii=False)
    enc = urllib.parse.quote(payload, safe="")
    return f"shortcuts://run-shortcut?name={SHORTCUT_NAME}&input=text&text={enc}"


def main():
    src = open(sys.argv[1]) if len(sys.argv) > 1 else sys.stdin
    chain = json.load(src)
    problems = validate(chain)
    if problems:
        print("PAYLOAD PROBLEMS:", file=sys.stderr)
        for p in problems:
            print("  -", p, file=sys.stderr)
        sys.exit(1)
    print(build_link(chain))


if __name__ == "__main__":
    main()
