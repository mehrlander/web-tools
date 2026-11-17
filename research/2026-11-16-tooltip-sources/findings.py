#!/usr/bin/env python3
"""Write findings.js, the counts diagram.html draws, from this probe's runs.

    python3 findings.py <web-tools scan.csv> <budget-drs scan.csv> <budget-drs tooltips.csv>

The two scan files are scan.py's output with --provenance; the third is
budget-drs's data/design/catalog/tooltips.csv at the same commit. Every count
the diagram shows is computed here; the page types none.
"""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

from expressions import classify

HERE = Path(__file__).resolve().parent
RUN = {"web-tools": "2668629", "budget-drs": "52b1b30", "date": "2026-11-16"}
# The commits that changed title= into data-title-tip= and kept the words.
CONVERSIONS = {"fdb397b27", "744e0a42a", "360ca91f3", "52d88af62", "70c1ba568", "42769de14", "17a8e90be"}
CLASSES = ["choice", "prose", "name", "readout", "unknown"]


def rows(path):
    return list(csv.DictReader(open(path, encoding="utf-8")))


def blame(rs):
    found = [r for r in rs if r["introduced"]]
    same = sum(1 for r in found if r["blamed"] == r["introduced"])
    conv = sum(1 for r in found if r["blamed"] != r["introduced"] and r["blamed"] in CONVERSIONS)
    return {"scanned": len(rs), "found": len(found), "same": same, "conversion": conv,
            "other": len(found) - same - conv}


def main():
    wt, bd, table = (rows(p) for p in sys.argv[1:4])
    forms = Counter(r["form"] for r in table)
    cards = sum(1 for r in table if r["form"] == "expression" and r["mechanism"] in ("hover-card", "sankey-card"))
    wt_forms = Counter(r["form"] for r in wt)
    wt_cls = Counter(classify(r["expression"]) for r in wt if r["form"] == "expression")
    bd_cls = Counter(classify(r["expression"]) for r in bd if r["form"] == "expression")
    bd_cls["unknown"] += cards          # the card calls scan.py does not read
    out = {
        "run": RUN,
        "routes": {
            "data-cell": {"web-tools": None, "budget-drs": forms["data-cell"]},
            "literal": {"web-tools": wt_forms["literal"], "budget-drs": forms["literal"]},
            "template": {"web-tools": wt_forms["template"], "budget-drs": forms["template"]},
            "expression": {"web-tools": wt_forms["expression"], "budget-drs": forms["expression"]},
        },
        "computed": {c: {"web-tools": wt_cls[c], "budget-drs": bd_cls[c]} for c in CLASSES},
        "blame": {"web-tools": blame(wt), "budget-drs": blame(bd)},
    }
    (HERE / "findings.js").write_text("window.TOOLTIP_FINDINGS = " + json.dumps(out, indent=1) + ";\n", encoding="utf-8")
    print(json.dumps(out["blame"]))


if __name__ == "__main__":
    main()
