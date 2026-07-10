# Branch guide: claude/chat-search-results-ui-o8miz0

Builds the chat search results viewer: a results-envelope page (narrative, facet chips, excerpt cards, client-side filter) on a transcript renderer whose fenced code blocks become live artifacts (static code instantly; sandboxed Render/Run/Table/Preview and a CM6 editor on demand), with the sandbox machinery lifted out of vanilla-demo.js into a shared kit.

⭐ [pages/chat-results.html](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@48440ef2dc233696f8ea228dd2405243e2087202:pages/chat-results.html) (🥏 toss; page not on main yet)

**Changed:**
- pages/chat-results.html ([new](https://github.com/mehrlander/web-tools/blob/claude/chat-search-results-ui-o8miz0/pages/chat-results.html), [diff](https://github.com/mehrlander/web-tools/commit/48440ef2dc233696f8ea228dd2405243e2087202))
- lib/chat-render.js ([new](https://github.com/mehrlander/web-tools/blob/claude/chat-search-results-ui-o8miz0/lib/chat-render.js))
- lib/kits/proof.js ([new](https://github.com/mehrlander/web-tools/blob/claude/chat-search-results-ui-o8miz0/lib/kits/proof.js))
- lib/vanilla-demo.js ([new](https://github.com/mehrlander/web-tools/blob/claude/chat-search-results-ui-o8miz0/lib/vanilla-demo.js), [main](https://github.com/mehrlander/web-tools/blob/main/lib/vanilla-demo.js)) — folds onto proof.js
- docs/CHAT-RESULTS.md ([new](https://github.com/mehrlander/web-tools/blob/claude/chat-search-results-ui-o8miz0/docs/CHAT-RESULTS.md)) — the envelope schema the search skill emits
- 8 demo pages load kits/proof.js ahead of vanilla-demo.js; docs/loader.md + lib/kits/README.md rows; marked added to devDependencies

**Verified this session (headless shots):** demo envelope render, Render view (sandboxed Tailwind card, auto-height), Run view (console output streamed back), transcript toggle with role-labeled turns, #gz= fragment decode, ?src= contents-API fetch, and a vanilla-demo page post-fold (proof frames render; the editor-didn't-load notice there is the known esm.sh-empty sandbox limitation, not a regression).

**Next steps / open threads:**
- Teach the chat-histories search skill the envelope contract (docs/CHAT-RESULTS.md): emit #gz= links for small results, commit results/<slug>.json + ?src= links for big ones.
- Live-check the deployed page against real chat-histories files (cross-repo ?src= and source pointers are untestable in the sandbox).
- Tier 2 later: a metadata index over chat-histories for cold-start search in the page.
- Note: the BRANCH-GUIDE.md on main is a stray from the merged show-repo branch; this file replaces it here and the wrap-up deletion clears it from main on merge.
