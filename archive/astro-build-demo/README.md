# astro-build-demo (archived)

> **Archived per [#138](https://github.com/mehrlander/web-tools/issues/138).**
> This was a test of Astro — a self-documenting build-step demo, and a
> deliberate counter-example to the repo's no-build ethos. It was never one of
> the four shapes (pages/bookmarklets/popups/console) and composed with nothing
> else, so it's kept here for grep value rather than served live. The former
> live page has been removed from `pages/`; its last committed build sits in
> [`build-output/`](build-output/) so the pre-build and post-build text still
> live side by side. The two stray `test*.html` files that had drifted into
> that output (hand-edits in a "never edit by hand" directory) were dropped in
> the move.
>
> A clean `npm install && npm run build` on Node 22 still reproduced the
> committed output byte-for-byte as of 2026-06-02, so the loop below worked at
> archival time; nothing here is maintained going forward.

A small Astro 4 site whose subject is its own build step. The source under
`src/` describes, in plain prose, what the build process did to produce the
HTML. The pre-build text and the post-build text both live in the repository.

## What it was

View source on `build-output/index.html` and search for the text of any card.
It is there as a string — the point the demo was making: the build read
`src/data/items.json`, looped the entries, compiled the Tailwind classes, and
flattened the Layout/index/Counter components into one HTML file before any
browser arrived.

## The build loop it used (historical)

When live, the loop was: edit any file under `src/` via the GitHub web UI,
then have Claude Code pull the repo and run `npm run build` from inside this
directory; it would commit the regenerated output to `pages/astro-build-demo/`
(`astro.config.mjs` still points `outDir` there). The output was never to be
hand-edited — the next build overwrote it.
