#!/bin/bash
# A small project with history and a work log, for a catch-up question.
set -e
git init -q && git config user.email eval@example.com && git config user.name eval
printf 'name,url,tag\nMDN,https://developer.mozilla.org,reference\n' > links.csv
printf '<!doctype html>\n<title>Links</title>\n<body><table id="t"></table></body>\n' > index.html
git add -A && git commit -qm "links.csv and a page shell"
printf 'Alpine,https://alpinejs.dev,library\ndaisyUI,https://daisyui.com,components\n' >> links.csv
git add -A && git commit -qm "Two more links"
cat > NOTES.md <<'MD'
# Work log

- Tue: started the links page. links.csv holds the rows; index.html will render them.
- Wed: added two rows. The page still renders nothing: the fetch of links.csv is not written yet.
- Wed: tag filter discussed, not started. Undecided whether tags should be a fixed list.
- Thu: noticed the daisyUI row has no trailing newline handling in the parser we plan to use.
MD
git add -A && git commit -qm "Work log"
