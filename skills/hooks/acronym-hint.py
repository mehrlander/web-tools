#!/usr/bin/env python3
"""UserPromptSubmit: when the owner's prompt names one of his coined acronyms
in capitals (SPUR, TOUR, CDE), add that acronym's entry to the session's
context, so he can ask for one in any sentence without linking anything.

THE ENTRIES. The Lists view's Acronyms list, lists/acronyms.json in
web-tools-private, is authoritative. An item whose text is two or more capital
letters is an acronym, and its note is the entry. Adding an item in the Lists
view is all it takes for the hook to know it. An item of kind `draft` is a
working name, and its entry says so; a concept not yet named is lowercase
text, which never matches.

FINDING THE LIST. The payload's cwd and each folder above it are tried, first
as a web-tools-private checkout itself and then as the folder that holds one
(the session root beside its checkouts). The hook reads only a checkout already
on disk and makes no network call, so a session with no web-tools-private
checkout gets no hint.

THE MATCH. Whole words, case-sensitive: "TOUR" matches, "tour" and "TOURS" do
not. An all-capitals word that is not meant as the ask, rare in a prompt,
adds an entry the session can ignore.

Silent and exit 0 on anything else: no checkout, no list, no match, or an
unparseable payload.
"""
import json
import re
import sys
from pathlib import Path

LIST = Path("lists") / "acronyms.json"
NAME = re.compile(r"^[A-Z]{2,}$")


def find_list(cwd):
    """The Acronyms list in the nearest web-tools-private checkout, or None."""
    here = Path(cwd).resolve()
    for d in [here, *here.parents]:
        for c in ([d / LIST] if d.name == "web-tools-private" else []) + [d / "web-tools-private" / LIST]:
            if c.is_file():
                return c
    return None


def entries(raw):
    """{NAME: entry text} for each item whose text is an acronym; a draft's
    entry leads with "(draft)"."""
    found = {}
    for it in (raw.get("items") or []) if isinstance(raw, dict) else []:
        name = str(it.get("text") or "").strip()
        note = str(it.get("note") or "").strip()
        if NAME.match(name) and note:
            found[name] = ("(draft) " if it.get("kind") == "draft" else "") + note
    return found


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return
    prompt = payload.get("prompt") or ""
    if not prompt:
        return
    path = find_list(payload.get("cwd") or ".")
    if not path:
        return
    try:
        known = entries(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return
    named = [n for n in known if re.search(rf"(?<![A-Za-z]){n}(?![A-Za-z])", prompt)]
    if not named:
        return
    where = "the Acronyms list (web-tools-private lists/acronyms.json)"
    msg = "\n\n".join(["The owner's prompt names " + ", ".join(named) +
                       (", an acronym coined in " + where + ". Its entry:"
                        if len(named) == 1 else
                        ", acronyms coined in " + where + ". Their entries:")]
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
