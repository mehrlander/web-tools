#!/bin/bash
# A page that will render a list of bookmarks kept in Markdown.
set -e
git init -q && git config user.email eval@example.com && git config user.name eval
printf '# bookmarks\n\nindex.html will show the links in bookmarks.md as a table.\n' > README.md
cat > bookmarks.md <<'MD'
- [MDN Web Docs](https://developer.mozilla.org) - reference
- [Alpine.js](https://alpinejs.dev) - library
- [daisyUI](https://daisyui.com) - components
- [Can I use](https://caniuse.com) - reference
- [Tailwind CSS](https://tailwindcss.com) - library
- [Phosphor Icons](https://phosphoricons.com) - icons
MD
printf '<!doctype html>\n<title>Bookmarks</title>\n<body></body>\n' > index.html
git add -A && git commit -qm "Bookmarks list and an empty page"
