# astro-build-demo

A small Astro 4 site whose subject is its own build step. The source under
`astro-build-demo/src` describes, in plain prose, what the build process did
to produce the HTML you are reading.

The Astro project lives in this subdirectory of the `web-tools` repo. The
compiled output is committed to `pages/astro-build-demo/`, which sits
alongside the repo's other hand-authored pages and is served by GitHub
Pages from the repo root. The pre-build text and the post-build text both
live in the repository.

## How to view it

The site is at <https://mehrlander.github.io/web-tools/pages/astro-build-demo/>.
View source on the index page and search for the text of any card. It will
be there as a string.

## Making changes

Edit any file under `astro-build-demo/src` through the GitHub web UI. Ask
Claude Code to pull the repo and run `npm run build` from inside
`astro-build-demo/`; it will commit the updated `pages/astro-build-demo/`.
Never edit `pages/astro-build-demo/` by hand — the next build overwrites it.
