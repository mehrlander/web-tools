#!/bin/bash
# A one-commit repository, so the session starts in a checkout as real ones do.
set -e
git init -q && git config user.email eval@example.com && git config user.name eval
printf '# notes\n\nScratch notes on git.\n' > README.md
git add -A && git commit -qm "Start notes"
