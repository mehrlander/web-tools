# Paragraph rewrite proposals: `docs/surfacing-extended.md`

Agent: **Chief of Staff (Grok)** · signed **2026-09-16**
Drafts in this file: **8**

These are non-destructive proposals. Do not treat as applied edits to the live doc.

## `docs/surfacing-extended.md:p002` · lines 3–7 · high · 60→32w (ratio 0.533)

### Original

The ways of handing something over, and the details, that most replies never reach.
[SURFACING.md](SURFACING.md) holds the primitives themselves and is injected into every
session; this file is not, and is fetched when one of the entries below applies. Each
keeps its **Form** where there is a syntax and its **Boundary** where an edge changes
the rule.

### Proposed rewrite

The ways of handing something over, and the details, that most replies never reach. Each keeps its **Form** where there is a syntax and its **Boundary** where an edge changes the rule.

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/surfacing-extended.md:p005` · lines 13–14 · high · 74→43w (ratio 0.581)

### Original

* **Publish an artifact 📦.** Publish a self-contained page as a stable private `claude.ai` snapshot; authentication follows the viewer's Claude sign-in, so no browser token. Record the URL in a README, PR body, or task file.
  **Boundary:** artifact CSP blocks external requests, so bake CDN dependencies in first. Frozen but republishable in place with version history. Private to the author on Pro and Max, so other readers get a 🥏 `#gz=` toss. See `docs/artifacts.md`.

### Proposed rewrite

* **Publish an artifact 📦.** Publish a self-contained page as a stable private `claude.ai` snapshot; authentication follows the viewer's Claude sign-in, so no browser token. Private to the author on Pro and Max, so other readers get a 🥏 `#gz=` toss. See `docs/artifacts.md`.

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/surfacing-extended.md:p006` · lines 16–19 · high · 176→98w (ratio 0.557)

### Original

* **Stage a fileset 🗂️.** Move a fileset across repos for viewing, bundle download, copying, or review diff.
  **Form:** `…/app/#stage=owner/repo[@ref]:p1,p2;owner2/repo2:p3`, groups `;`-separated and paths `,`-separated. Add `&prompts=<base64url>` for `{label, ask}` review prompts or `&mode=diff` to open on that comparison; `StageLink.read` also accepts these in the query.
  **Pasted text needs no token.** A stage of text you hold rather than refs you point at mints as `#gz=<base64url(gzip([{name,text}]))>`, budgeted at 24 KB of payload, and opens for a reader with no token and no access to the repo. With `&mode=diff` that is the whole token-less review handoff: a before, an after, and the asks, in one link of a few hundred characters.
  **Boundary:** the ref half is token-gated with the same in-app-browser caveat as `#gh=`; for a tokenless reader either send the text under `#gz=` or download the bundle and hand it over. A stage is an inline handoff, not a caption row. See `docs/stage.md`, `docs/show-repo.md`, and `.web-tools.json`.

### Proposed rewrite

* **Stage a fileset 🗂️.** Move a fileset across repos for viewing, bundle download, copying, or review diff. **Form:** `…/app/#stage=owner/repo[@ref]:p1,p2;owner2/repo2:p3`, groups `;`-separated and paths `,`-separated. Add `&prompts=<base64url>` for `{label, ask}` review prompts or `&mode=diff` to open on that comparison; `StageLink.read` also accepts these in the query. **Pasted text needs no token.** A stage of text you hold rather than refs you point at mints as `#gz=<base64url(gzip([{name,text}]))>`, budgeted at 24 KB of payload. See `docs/stage.md`, `docs/show-repo.md`, and `.web-tools.json` (`#gh=` `#gz=`).

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/surfacing-extended.md:p007` · lines 21–22 · high · 85→38w (ratio 0.447)

### Original

* **Carry content in an envelope.** A curated, annotated set of files, chats, diffs, or search hits that should travel and render together goes in an envelope rather than an ad-hoc format. The envelope formats are stage, surface (`pages/app.html` estate view), chat-results (`pages/chat-results.html`) and data view (`pages/data-view.html`).
  **Boundary:** they share the `owner/repo[@ref]:path` grammar, the `#gz=`/`?src=` delivery split, and live-code rendering. One contract per format in [`docs/envelopes/`](https://github.com/mehrlander/web-tools/tree/main/docs/envelopes).

### Proposed rewrite

* **Carry content in an envelope.** A curated, annotated set of files, chats, diffs. One contract per format in [`docs/envelopes/`](https://github.com/mehrlander/web-tools/tree/main/docs/envelopes) (`pages/app.html` `pages/chat-results.html` `pages/data-view.html`).

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/surfacing-extended.md:p008` · lines 24–26 · high · 175→93w (ratio 0.531)

### Original

* **Toss data 📊.** Address a CSV, JSON array, or log through the data route so it opens readable rather than raw: `toss-render.html#data=owner/repo[@ref]:path`. It picks a mode by content (table, tree, preview, code, raw) and leaves every other one a tap away. Bare bytes need no wrapper; an `items` envelope adds several files with a default view and notes for each, and a trailing `#item=<name|index>` opens on one.
  **A PDF has two routes.** `#data=` is the first look: the page drawn, a pager, the real page and byte counts. `#pdf=` is the workbench (`pages/pdf-inspect.html`), down to characters, vector rules and detected table cells. Pick by what the reader is meant to do.
  **Boundary:** same token gate as `#gh=`; `#gz=` on the page itself for a tokenless reader. Contract: [`docs/envelopes/data-view.md`](https://github.com/mehrlander/web-tools/blob/main/docs/envelopes/data-view.md). What the kit recovers from a PDF and what it does not: [`pdf-structure.md`](https://github.com/mehrlander/web-tools/blob/main/docs/pdf-structure.md).

### Proposed rewrite

* **Toss data 📊.** Address a CSV, JSON array, or log through the data route so it opens readable rather than raw: `toss-render.html#data=owner/repo[@ref]:path`. **A PDF has two routes.** `#data=` is the first look: the page drawn, a pager, the real page and byte counts. Contract: [`docs/envelopes/data-view.md`](https://github.com/mehrlander/web-tools/blob/main/docs/envelopes/data-view.md). What the kit recovers from a PDF and what it does not: [`pdf-structure.md`](https://github.com/mehrlander/web-tools/blob/main/docs/pdf-structure.md) (`items` `#item=<name|index>` `#pdf=`).

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/surfacing-extended.md:p009` · lines 28–29 · high · 136→57w (ratio 0.419)

### Original

* **Copy to the clipboard 📋.** A `shortcuts://run-shortcut?name=<shortcut>&input=text&text=<payload>` link whose payoff is content on the reader's clipboard.
  **Boundary:** only for content that must be made on the device, meaning a pasteboard type you cannot produce or a value computed from device state at tap time; otherwise hand over a file. The payload is opaque, so the caption states what it holds, how many actions, and whether the link replaces or adds. Paste it exactly as its generator emitted it: an edited payload keeps its actions and loses its label, so it works and misreports at once. Hand it over as `[label](shortcuts://…)`, never bare and never in a code span, which the chat client will not autolink. Measured in [markdown-in-chat.md](https://github.com/mehrlander/web-tools/blob/main/docs/markdown-in-chat.md).

### Proposed rewrite

* **Copy to the clipboard 📋.** A `shortcuts://run-shortcut?name=<shortcut>&input=text&text=<payload>` link whose payoff is content on the reader's clipboard. Hand it over as `[label](shortcuts://…)`, never bare and never in a code span, which the chat client will not autolink. Measured in [markdown-in-chat.md](https://github.com/mehrlander/web-tools/blob/main/docs/markdown-in-chat.md).

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/surfacing-extended.md:p012` · lines 35–36 · high · 56→40w (ratio 0.714)

### Original

* **Review the diff 🔍.** Where the changed files are worth reading, add `…/pages/review.html#gh=owner/repo@branch&base=main` (`:path` for one file): each file's diff against the merge base, its patch and its raw content.
  **Boundary:** it supplements the caption, never replaces it, and is token-gated like every `#gh=`. 🌿 reads the branch, 🔍 the diff.

### Proposed rewrite

* **Review the diff 🔍.** Where the changed files are worth reading, add `…/pages/review.html#gh=owner/repo@branch&base=main` (`:path` **Boundary:** it supplements the caption, never replaces it, and is token-gated like every `#gh=`. 🌿 reads the branch, 🔍 the diff.

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/surfacing-extended.md:p018` · lines 52–52 · high · 50→33w (ratio 0.66)

### Original

  In an MCP-written body or comment, **a URL of 150 characters or more is wrapped in backticks and renders as literal text; 149 or fewer survives.** Length only, anywhere in the text, the label never counting; chat is untouched. Check with `scripts/mcp-link-safe.py --check`, and shorten in this order:

### Proposed rewrite

In an MCP-written body or comment, **a URL of 150 characters or more is wrapped in backticks and renders as literal text. Check with `scripts/mcp-link-safe.py --check`, and shorten in this order:

*Signed: Chief of Staff (Grok) · 2026-09-16*

---
