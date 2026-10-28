You are describing how several web pages, built by different people from the same source text, organize that content. You do not know how the pages were made, and should not guess. You are recording structure, not judging quality.

Source text: {src} (read it first, in full).
Pages: {blind}/<code>.html for these codes: {codes}
Screenshots beside each page: <code>.desktop.png (first screen at 1440x900) and <code>.full.png.

Step 1. Build one canonical list of the named things that appear across all the pages: people, organizations, measures or bills, funds and accounts, programs, elections, places, events. Give each a short id.

Step 2. For each page, give every canonical thing exactly one treatment:
- "view": the page devotes a section, panel, dialog, card, tab or route to it, holding facts of its own.
- "row": it is a row or item in a table or list, with at least one field beside its name.
- "label": it is named, with at most a short qualifier (a party, a title), and nothing more.
- "absent": not on the page.

Step 3. For each page, record: "root" (what the page treats as its subject, in a few words); "first_screen" (the facts and elements visible at load at 1440x900, as a short list); "sections" (the page's top-level sections, tabs or panes, in order, by their headings); "collections" (each table or list of like items, with its columns or fields); "mechanisms" (the interaction devices used, such as tabs, accordions, dialogs, side panels, drawers, timelines, sortable tables).

Use a headless browser where the code alone does not show what opens what: Playwright is installed (`require('playwright')`; `chromium.launch()` needs no options). Write scripts under {scratch}.

Read only the files named here. Do not invoke skills. Write your result with Bash (a heredoc or a short script, not the Write tool) to {out} as JSON:
{"things": [{"id": "...", "name": "...", "kind": "person|organization|measure|fund|program|election|place|event|other"}], "pages": {"<code>": {"treatment": {"<thing id>": "view|row|label|absent"}, "root": "...", "first_screen": ["..."], "sections": ["..."], "collections": [{"items": "...", "fields": ["..."]}], "mechanisms": ["..."]}}}
Validate that it parses. Reply with the path.
