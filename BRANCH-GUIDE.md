# Branch guide: claude/overnight-exploration-3qwe3z

A self-similarity atlas for arbitrary text: a genomics-style dot plot plus an exact-repeat census and entropy track, backed by a new linear-time suffix-automaton kit. Paste a log, source file, JSON, or prose and see where it repeats itself.

⭐ [pages/text-atlas.html?use=claude/overnight-exploration-3qwe3z](https://mehrlander.github.io/web-tools/pages/text-atlas.html?use=claude/overnight-exploration-3qwe3z)

**Changed:**
- lib/kits/selfsim.js ([new](https://github.com/mehrlander/web-tools/blob/claude/overnight-exploration-3qwe3z/lib/kits/selfsim.js)): suffix automaton (distinct count, longest/top repeats, exact occurrences), minimizer k-mer dot-plot points + exact-within-slice zoom, sliding-window entropy
- pages/text-atlas.html ([new](https://github.com/mehrlander/web-tools/blob/claude/overnight-exploration-3qwe3z/pages/text-atlas.html)): canvas dot plot with hover, drag-zoom, click-to-trace; stats cards; repeat table with position strips; entropy strip; four built-in samples
- tools/test/selfsim.test.mjs ([new](https://github.com/mehrlander/web-tools/blob/claude/overnight-exploration-3qwe3z/tools/test/selfsim.test.mjs)): cross-checks the automaton against naive O(n²) references on seeded-random inputs; minimizer coverage + planted-repeat guarantees
- lib/kits/README.md, README.md: selfsim section + page row
- tools/test/kits-register.test.mjs: selfsim added to the load-contract smoke test

**Next steps / open threads:**
- Verified headlessly (shot + driven scripts: full text, access-log trace, json zoom; 98/98 tests). Thumbnail + wrap-up remaining.
