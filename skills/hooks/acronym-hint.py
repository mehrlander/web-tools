#!/usr/bin/env python3
"""UserPromptSubmit: when the owner's prompt names one of his coined acronyms
in capitals (SPUR, TOUR, CDE), add that acronym's entry to the session's
context, so he can ask for one in any sentence without linking the doc.

THE ENTRIES. docs/acronyms.md is authoritative; the plugin carries a copy at
default/acronyms.md (node/build/vendor-docs.mjs). Each `## NAME` heading whose
NAME is two or more capital letters opens an entry, which runs to the next `##`
heading. The heading names the acronym, so adding an entry to the doc is all
it takes for the hook to know it.

THE MATCH. Whole words, case-sensitive: "TOUR" matches, "tour" and "TOURS" do
not. An all-capitals word that is not meant as the ask, rare in a prompt,
adds an entry the session can ignore.

Silent and exit 0 on anything else: no plugin root, no copy, no match, or an
unparseable payload.
"""
import json
import os
import re
import sys
from pathlib import Path

HEADING = re.compile(r"^## ([A-Z]{2,})\s*$", re.M)


def entries(text):
    """{NAME: entry text} for each `## NAME` section."""
    heads = list(HEADING.finditer(text))
    found = {}
    for m in heads:
        end = text.find("\n## ", m.end())
        found[m.group(1)] = text[m.end():end if end >= 0 else len(text)].strip()
    return found


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return
    prompt = payload.get("prompt") or ""
    root = os.environ.get("CLAUDE_PLUGIN_ROOT") or ""
    if not prompt or not root:
        return
    try:
        text = (Path(root) / "default" / "acronyms.md").read_text(encoding="utf-8")
    except OSError:
        return
    known = entries(text)
    named = [n for n in known if re.search(rf"(?<![A-Za-z]){n}(?![A-Za-z])", prompt)]
    if not named:
        return
    msg = "\n\n".join(["The owner's prompt names " + ", ".join(named) +
                       ", an acronym coined in mehrlander/web-tools docs/acronyms.md. Its entry:"
                       if len(named) == 1 else
                       "The owner's prompt names " + ", ".join(named) +
                       ", acronyms coined in mehrlander/web-tools docs/acronyms.md. Their entries:"]
                      + [f"{n}: {known[n]}" for n in named])
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": msg,
    }}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
