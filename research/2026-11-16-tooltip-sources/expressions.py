#!/usr/bin/env python3
"""Sort scan.py's `expression` rows by what each expression reads.

    python3 expressions.py <scan.csv>

Prints a count per class and writes nothing. The classes, tried in this order:

    choice    fixed words picked by a condition: `open ? 'Hide the sidebar' : 'Show the sidebar'`
    prose     a field or call whose name says it holds written text: gloss, note, tip, hint,
              why, def, desc, summary, caption, reason, subject, text, help, blurb
    name      a field holding a name or a value: label, title, name, path, repo, file, branch,
              kind, status, ref, url, id
    readout   a count, a length, a formatted number or an error message
    unknown   anything else, such as a call whose name says nothing

The rule reads identifiers, not what they hold: a `title` field may hold a
sentence, and a `note` may be generated. The README reports how
often a hand check of a sample agreed with it.
"""
import csv
import re
import sys
from collections import Counter

PROSE = re.compile(r"\b(\w*(gloss|note|tip|hint|why|def|desc|description|summary|caption|reason|subject|text|help|blurb|TIPS|Tip|Why|Note|Gloss|Hint))\b")
NAME = re.compile(r"\.(label|title|name|path|repo|file|branch|kind|status|ref|url|id|key|word|slug)\b|\b(label|title|name|path|repo|file|branch)\b")
READOUT = re.compile(r"\.length\b|[Cc]ount\b|\bn\b|toLocaleString|toFixed|fmt\w*\(|\.message\b|\berr\b|\berror\b|String\(e\)|\d")
CHOICE = re.compile(r"\?[^:]*['\"`][A-Za-z][^'\"`]*\w[^'\"`]*['\"`]")


def classify(e):
    if CHOICE.search(e):
        return "choice"
    if PROSE.search(e):
        return "prose"
    if READOUT.search(e):
        return "readout"
    if NAME.search(e):
        return "name"
    return "unknown"


def main():
    rows = [r for r in csv.DictReader(open(sys.argv[1], encoding="utf-8")) if r["form"] == "expression"]
    c = Counter(classify(r["expression"]) for r in rows)
    print(f"{len(rows)} expressions:", ", ".join(f"{k} {c[k]}" for k in ("choice", "prose", "name", "readout", "unknown")))


if __name__ == "__main__":
    main()
