# archive/json-viewers/

These are old JSON and tree viewers, pulled out of two archives on 2026-09-23. They were gathered to find display ideas for the reader that the tracker task [own-json-tree-retire-vje-i0lcj2](../../tracker/tasks/own-json-tree-retire-vje-i0lcj2.md) proposes. That reader would be a themed, lazy, display-only JSON tree with no CDN dependency. vanilla-jsoneditor would stay as the edit mode. [`pages/drop/json-viewers.html`](../../pages/drop/json-viewers.html) lists all 62 pages, lets you step through them, and shows the selected one live.

The files sit under `archive/` rather than `pages/` because they are preserved source. The repo's style and lint scans skip `archive/`, and these files should not be rewritten to pass them. The thumbnails in `thumbs/` were made once with `tools/render/screenshot.mjs` through `pages-shots`, and no hook refreshes them.

## Where the files came from

- **`websim/`**: 33 projects copied from the whitecloud WebSim export in the home repo: `chron/2026/07/2026-07-06-websim-account-export.zip`. Each project was a folder holding one `index.html`, and here each is flattened to `<slug>.html`. A comment at the top of each file names the WebSim project. The gallery shows the version count from the export's `manifest.json` where the title is unique. WebSim generated these pages from prompts, so the version count shows how long a prompt thread ran, not how much hand editing a page had.
- **`codepen/`**: 29 pens by Mark-E, picked by title from the pen log in the home repo: `chron/2026/03/2026-03-29-codepen-log.json`. `codepen.io` is blocked in this sandbox. The source came from `cdpn.io/Mark-E/fullpage/<id>`, whose `srcdoc` attribute holds each pen compiled into one page. The pen's URL and creation date are in the file's first line.
- **Two changes to the pen source.** CodePen's loop-guard script and its `window.CP` calls are removed, since they fail outside CodePen. The CodePen favicon links are also removed. The WebSim files are unchanged apart from the provenance comment.

**Many of these pages fetch live data**, from sources such as SpaceX, GitHub, swapi.dev and the Art Institute of Chicago. The loc.gov and legislature DOM trees assume WebSim's fetch proxy, so outside WebSim those requests are blocked by CORS. Seven files are broken as extracted. The gallery labels all of these. It also has a filter for pages that run without live data, although that filter cannot catch a page whose fetch fails silently.

## Ideas worth taking, ranked

Four readers went through all 62 files. The ranking is by how much each idea would improve a display-only tree. Line numbers are approximate.

1. **A folded node shows a summary shaped by its type.** [`codemirror-json-and-html-folding-demo`](websim/codemirror-json-and-html-folding-demo.html) (lines 141 to 220):
   - An object shows `key: value` for its scalar values, and `{}` or `[]` for nested ones.
   - An object inside an array shows only its values.
   - An array of scalars shows the values inline.
   - An array of objects shows the union of its items' keys and an item count.

   A tree folded this way reads as an outline. The file gets the summary by re-parsing the folded text, which is fragile. A tree that works on the data can compute the same summary directly. [`renderjson`](codepen/renderjson-mdyyxd.html) and the Elegant Tree line do simpler versions: `{12 items}`, and `{ k: v, … }` cut at about 20 characters.
2. **A folded array of objects reads as a table.** [`elegant-tree-view-component-with-api-sel`](websim/elegant-tree-view-component-with-api-sel.html) and [`-5`](websim/elegant-tree-view-component-5.html) (lines 51 to 73 and 169 to 223):
   - The array's header row lists the union of the item keys.
   - Each folded item row shows its values in the same order and at the same widths, so the rows line up as a table with no click.
   - Clicking a key shows how many items carry it (for example 28/30), which exposes optional keys.

   The file measures column widths with `canvas.measureText`, and assigns colors by key position, not by key name. A CSS grid with `ch` widths would do the alignment better. Of all the ideas here, this one is the most original.
3. **A key keeps one color everywhere** (the same CodeMirror demo, lines 85 to 94). Hues are spaced by the golden angle, `(i * 137.508) % 360`, so a key has the same color in folded summaries, the legend and table rows. This makes repeated structure visible. It works against the house rule of one meaningful accent color, so it belongs behind a control rather than on by default.
4. **A chain of single children folds onto one line.** [`tree-display-component · rwowwz`](codepen/tree-display-component-rwowwz.html) (line 769) and [`library-of-congress-vanilla-js-collapsib`](websim/library-of-congress-vanilla-js-collapsib.html) (line 162). While a node has exactly one child, the child is written on the same row: `data › result › items`. It takes about five lines. For JSON the row reads as a dotted path.
5. **Children are built on first open, and the output stays JSON.** [`renderjson`](codepen/renderjson-mdyyxd.html) (lines 91 to 141):
   - A folded node is a single span such as `{12 items}`.
   - Clicking it builds the children and caches them in a `WeakMap`. Clicking the opening `{` folds the node again.
   - The expanded text keeps its quotes, commas and indentation, so selecting it and copying gives valid JSON.

   It is the only lazy renderer that works among the 62 files. In Alpine, `x-if` on first open does the same.
6. **The path is the node's identity.**
   - [`chicago-art-institute-tree-view`](codepen/chicago-art-institute-tree-view-opyaxg.html) (line 83) stores which nodes are open as a `Set` of path strings. Serialized into the URL fragment, that set would be a deep link.
   - [`json-structure-visualizer`](websim/json-structure-visualizer.html) (lines 231 to 327) builds a path such as `data[3].id` for each node. That path feeds a clickable breadcrumb and a prev and next control that steps through siblings.
   - [`tree-view-test`](codepen/tree-view-test-grlwee.html) (lines 685 to 747) shows a small toolbar after a 500 ms hover, with a button that copies the node's path.

   All three build the path unsafely: joined with `-`, keys not escaped, or keys containing dots left unquoted. JSON Pointer avoids all three problems.
7. **Folding policies.** [`spacex-json-viewer-with-auto-folding`](websim/spacex-json-viewer-with-auto-folding.html) (lines 105 to 168) has three:
   - Fold everything below depth N.
   - Fold any subtree longer than N characters. This is a good default.
   - Fold everything except one key, and open every ancestor of each match. A deep link needs exactly this reveal step.
8. **Borders mark structural role.** In the api-sel file, a 4px left border tells whether a row sits inside an array, which a color by value type cannot tell. [`JSON Tree Newer`](codepen/json-tree-newer-wvovqj.html) draws a border along the full length of an open container. The border color there depends on whether the container is an object or an array.
9. **Free tree scaffolding.**
   - daisyUI 5 styles `menu > li > details > summary` as an indented, collapsible tree, as [`daisy-link-tree`](codepen/daisy-link-tree-veezmn.html) shows. It needs no toggle code, and the tree follows the theme.
   - The same file rebuilds a tree from flat `a/b/c` paths in three lines.
   - `li::before` plus `li:last-child::before { height: 50% }` draws connector lines with no extra markup ([rwowwz](codepen/tree-display-component-rwowwz.html), line 682).
10. **Show each subtree's size.** [`local-storage-explorer`](codepen/local-storage-explorer-gojvwy.html) puts a byte count on each row. The sunburst in [`websim-html-xml-element-hierarchy-visual`](websim/websim-html-xml-element-hierarchy-visual.html) sizes each node by its descendant count. Either figure next to a folded summary shows where the bulk of the data is.
11. **Pick paths to make columns.** [`spacex-launches-tree-view`](websim/spacex-launches-tree-view.html) (lines 152 to 253) shows every dotted path in the first record as a pill. Selecting pills reduces every record to those paths, which turns a nested array into a flat table.
12. **Filters that change what is shown.** [`JSON dmp`](codepen/json-dmp-qennea.html) can hide everything the diff did not change. [`Jsonata spacex example`](codepen/jsonata-spacex-example-npnzwx.html) filters the view through a query box. In general form: show only the paths that match, with their ancestors kept.

**Ordinary.** Coloring leaf values by type is in almost every file and is standard. The D3 SpaceX trees are the stock collapsible-tree example. The FancyTree, Shoelace and treejs pages mostly show their libraries' own configuration options.

## What none of them has

None of the 62 pages has search. None handles a very wide array, such as 100,000 items at one level. None keeps integers larger than 2^53 exact. The tracker task names these three as the hard parts, so there is no existing work to borrow for them.
