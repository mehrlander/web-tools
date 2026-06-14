# Branch guide: claude/overnight-exploration-3qwe3z

A small catalogue of tested text-analysis functions, `lib/kits/selfsim.js`: a suffix automaton (exact repeats, longest repeat, occurrence counts), minimizer dot-plot points, entropy, and a one-call `draw()` that renders the dot plot into a canvas. Surfaced honestly as a kit with a living demo. The earlier showcase page was retired: it dressed a read-only visualization up as an application, and the argument didn't hold.

⭐ [lib/kits/demos/selfsim.html?use=claude/overnight-exploration-3qwe3z](https://mehrlander.github.io/web-tools/lib/kits/demos/selfsim.html?use=claude/overnight-exploration-3qwe3z)

**Changed:**
- lib/kits/selfsim.js ([new](https://github.com/mehrlander/web-tools/blob/claude/overnight-exploration-3qwe3z/lib/kits/selfsim.js)): the kit; added `draw(canvas, text, opts)` so display is a function, not a component or page
- lib/kits/demos/selfsim.html ([new](https://github.com/mehrlander/web-tools/blob/claude/overnight-exploration-3qwe3z/lib/kits/demos/selfsim.html)): living demo — repeat census ("did I repeat myself?") + a `selfsim.draw` fingerprint
- tools/test/selfsim.test.mjs: brute-force-verified automaton tests + two `draw` tests (recording-canvas stub); also in kits-register smoke test
- pages/text-atlas.html: **deleted** (with its thumbnail)
- lib/kits/README.md, lib/kits/demos/index.html, README.md: page references removed; `draw` documented; demo is the home

**Next steps / open threads:**
- Shape settled: kit + demo, page retired. 100/100 tests. (cm6 "Editor didn't load" in the demo render is the known esm.sh-offline harness limit; the kit snippets run.)
- A real self-similarity *component* (Alpine) stays deferred until a page actually wants to embed one (log viewer, wring demo, show-repo). The honest minimal capture, `draw()` as a function, is in.
- Wrap-up (merge-guide entry + PR) pending the user's go.
