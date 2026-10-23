# The test

Beside this file is one image, poster.png. It is a guide for naming collections of records in three repositories checked out side by side: /home/user/web-tools, /home/user/home and /home/user/web-tools-private.

For each collection below, look at the collection itself until you can tell what one entry is and what happens to entries over time, then use only the poster to say what the collection should be called.

1. docs/aims-reading.csv in web-tools.
2. trackers.md at the root of home.
3. home/projects/wps/data/observations.csv, the PowerShell outpost's observations (web-tools/docs/outposts.md, lines 33-34, describes it).
4. The traffic ledger: window.__traffic, kept by web-tools/lib/gh-boot.js (around line 249).
5. web-tools-private/state/sessions.json (web-tools/docs/views/sessions.md, lines 15-17, describes it).
6. Source bundles, as web-tools/docs/source-bundles.md describes them (lines 16-18 especially).
7. home/projects/budget-drs/data/derived/marts/decision-ledger.csv (row 6 of home/projects/budget-drs/data/design/tables.csv describes it).
8. web-tools-private/errands/ (start from its README).

Rules for this test:
- Do not open anything under /home/user/web-tools/research/category-mapping/, /home/user/web-tools/skills/cat-map/, /home/user/web-tools/pages/cat-map.html, /home/user/web-tools/node/.preview/, or /home/user/web-tools-private/sessions/, and nothing in this folder other than this file and poster.png. Other readers are taking the same test independently.
- Read only: do not edit or commit anything in the three repositories. Write only your answer file.
- Decide by the poster's rules, not by what the files call themselves.

Write one JSON file:

{"by": "<your label>",
 "answers": [{"n": 1, "collection": "...", "box": "registry" | "snapshot" | "stream" | "no word yet" | "none",
              "adds": ["cache", "tracker", "inbox", "list"],
              "name": "what you would call it, in a few words",
              "confidence": "high" | "medium" | "low",
              "unclear": "what on the poster left you unsure for this one, or empty"}],
 "poster": "one paragraph: where the poster helped and where it failed you"}

"adds" lists only the words that apply, possibly none. Validate that the file parses (python3 -c "import json; json.load(open(PATH))"). Final message: the path, and the one place the poster was hardest to use.
