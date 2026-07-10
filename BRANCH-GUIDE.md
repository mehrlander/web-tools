# Branch guide: claude/chat-search-results-ui-o8miz0

Builds a chat search results page: a results-envelope viewer with facets and client-side filtering, on a transcript renderer whose fenced code blocks get live views (CM6 editor, sandboxed render, run-with-console, table) via a proof machinery lifted out of vanilla-demo.js.

⭐ [pages/chat-results.html](https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/chat-search-results-ui-o8miz0:pages/chat-results.html) (🥏 toss; page not on main yet)

**Changed:**
- (first commit: this guide only; files land next)

**Next steps / open threads:**
- kits/proof.js: lift sandbox doc builders (HEAD/reporter/render/context/jsrender/console) from vanilla-demo.js
- fold vanilla-demo.js onto proof.js; add kits/proof.js to the 8 demo pages' load chains
- lib/chat-render.js: transcript renderer (markdown prose + block artifacts with Code/Render/Run/Table/Preview views)
- pages/chat-results.html: envelope viewer (narrative, facet chips, excerpt cards, filter bar; #gz= / ?src= / inline demo data)
- docs/CHAT-RESULTS.md: envelope schema, the contract the search skill emits
- Note: the BRANCH-GUIDE.md on main is a stray from the merged show-repo branch; this file replaces it here and the wrap-up deletion clears it from main on merge.
