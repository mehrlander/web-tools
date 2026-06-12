# Branch guide: claude/overnight-exploration-3qwe3z

Overnight exploration: a self-similarity atlas for arbitrary text — a genomics-style dot plot plus repeat tables, backed by a new linear-time suffix-automaton kit (`lib/kits/selfsim.js`) with brute-force-verified tests, rendered by a new page (`pages/text-atlas.html`).

⭐ [Branch tree](https://github.com/mehrlander/web-tools/tree/claude/overnight-exploration-3qwe3z) (artifacts land as the night progresses)

**Changed:**
- (nothing yet; guide pushed first per convention)

**Next steps / open threads:**
- Build `lib/kits/selfsim.js`: suffix automaton (distinct substrings, longest repeat, top repeats with counts/positions), minimizer k-mer matching for dot-plot points, sliding-window entropy profile
- Tests `tools/test/selfsim.test.mjs`: cross-check every result against naive O(n²) implementations on randomized inputs
- Page `pages/text-atlas.html`: canvas dot plot, repeat table with position strip, entropy track, samples (own source, log, statute text)
- Verify via `npm run shot`, then thumbnails + wrap-up
