# Branch guide: claude/overnight-exploration-3qwe3z

A linear-time self-similarity kit (`lib/kits/selfsim.js`: suffix automaton for exact repeats, minimizer k-mer dot plot, entropy) surfaced two ways: a living kit demo, and a "text fingerprints" gallery page where each kind of text (a log, prose, an email with a pasted-twice paragraph) shows its own self-similarity dot plot.

⭐ [pages/text-atlas.html?use=claude/overnight-exploration-3qwe3z](https://mehrlander.github.io/web-tools/pages/text-atlas.html?use=claude/overnight-exploration-3qwe3z)

**Changed:**
- lib/kits/selfsim.js ([new](https://github.com/mehrlander/web-tools/blob/claude/overnight-exploration-3qwe3z/lib/kits/selfsim.js)): the engine. Unchanged since first push.
- pages/text-atlas.html ([new](https://github.com/mehrlander/web-tools/blob/claude/overnight-exploration-3qwe3z/pages/text-atlas.html)): reshaped from a load-your-data instrument into a fingerprint gallery (sample cards render instantly, click into a detail view with the repeat census + auto-traced top repeat; "your own text" is secondary). Dropped zoom/entropy-track/k-w sliders.
- lib/kits/demos/selfsim.html ([new](https://github.com/mehrlander/web-tools/blob/claude/overnight-exploration-3qwe3z/lib/kits/demos/selfsim.html)): living demo (repeat census + drawn dot plot), framed around "did I repeat myself?"
- tools/test/selfsim.test.mjs, tools/test/kits-register.test.mjs: brute-force-verified tests + load-contract smoke
- lib/kits/README.md, lib/kits/demos/index.html, README.md: docs + demo listing

**Next steps / open threads:**
- Reshape done per the "fingerprint gallery" decision. Verified headlessly: gallery + email/prose detail render, 98/98 tests. (cm6 "Editor didn't load" in the kit demo is the known esm.sh-offline harness limit; works on live Pages.)
- Wrap-up (merge-guide entry + PR) pending the user's go.
