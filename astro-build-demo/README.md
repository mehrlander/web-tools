# astro-build-demo

A small Astro 4 site whose subject is its own build step. The source under
`/src` describes, in plain prose, what the build process did to produce the
HTML you are reading.

The compiled output is committed to `/docs` and served by GitHub Pages. That
means the pre-build text and the post-build text both live in the repository,
one directory apart.

## How to view it

Once Pages is enabled, the site is at
<https://mehrlander.github.io/astro-build-demo/>. View source on the index
page and search for the text of any card. It will be there as a string.

## One-time setup

In the repo's Settings, open Pages, set the source to "Deploy from a branch",
choose branch `main` and folder `/docs`, and save. This is a checkbox you have
to click once. Claude Code cannot do it for you.

## Making changes

Edit any file under `/src` through the GitHub web UI. Ask Claude Code to pull
the repo and run `npm run build`; it will commit the updated `/docs`. Never
edit `/docs` by hand — the next build overwrites it.
