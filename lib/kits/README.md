# kits/

Themed logic libraries loaded via `gh.load`. Each kit is a plain script
(no `import`/`export`) that populates a single namespace on `window`. Which code
belongs here is stated in [`docs/code-layers.md`](../../docs/code-layers.md),
and `node/test/code-layers.test.mjs` fails a misplaced file.

## Shape rules

A kit must work through `gh.load`:

1. No static `import` / `export` statements at the top level. (`gh.load`
   runs the body inside `new Function`, where either keyword throws
   `SyntaxError`.)
2. Wrap the file body in an IIFE, `(() => { ... })();`, to keep helpers
   private.
3. End the IIFE by assigning the public namespace: `window.foo = { ... };`
4. Third-party libraries load lazily inside functions via dynamic
   `await import('https://cdn.jsdelivr.net/npm/...')`. That's an expression and
   works fine inside `new Function`'s body.
5. Internal "imports" between kits are reads from `window.otherKit`.
   Order them in the page's `gh.load` chain accordingly.

See [`docs/loader.md`](../../docs/loader.md) for the full loader contract.

## Current kits

Open the [Kits tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=kits)
for the full list. The data is in [`docs/kits.csv`](../../docs/kits.csv), which
`npm run kits-index` rebuilds from the kits.

Each kit is documented in its own header comment, which is authoritative.
This file holds only what no header does: the load order between kits, and
where a kit's demo and checks live when they are not at the default paths.

## Load order

A kit that reads another kit's namespace needs that kit earlier in the page's
`gh.load` chain:

- `kits/cm6.js` before `alpineComponents/cm-editor.js` and
  `compress-input-cm.js`, which log `window.cm6 is missing` at mount without it.
- `kits/proof.js` before `vanilla-demo.js` and `chat-render.js`, which read
  `window.proof` at call time.
- `kits/xlsx.js` before `xlsx-extract.js` and `xlsx-write.js`.
- `kits/peek.js` and `kits/dictate.js` before `annotate.js`. Both are soft
  dependencies: without Peek the DOM reading's chip is absent, and without
  dictate the microphone is, while every other reading works.

## Demos and checks

A kit's demo, when it has one, is `lib/kits/demos/<kit>.html`, and its test
names the kit under `node/test/`; the `demo` and `tested` columns of
`docs/kits.csv` record which kits have each. Where a kit's demo or check lives
elsewhere:

| Kit | Demo or consumer | Checks and references beyond `npm test` |
|---|---|---|
| `console.js` | `pages/demos/console-kit-demo.html` | |
| `cm6.js` | `pages/drop/cm6-editor.html` | |
| `cm6-merge.js`, `review-target.js` | `pages/review.html` | |
| `text-diff.js` | `pages/diff-tool.html` | |
| `wring.js` | `pages/demos/wring-text.html`, `pages/demos/wring-dom.html` | |
| `treemap.js` | `pages/repo-atlas.html` | |
| `data-shelf.js` | `popups/data-shelf.html` | |
| `annotate.js` | `pages/annotate.html` | |
| `peek.js` | `pages/peek.html` | `node/render/scenarios/peek-walk.mjs` drives the browser facts jsdom has no layout for |
| `pdf.js` | `pages/pdf-inspect.html` | `npm run test:pdf`; `npm run test:pdf-versions` settles version pinning; `npm run test:viewer-pdf` asserts the viewer's `pdf` mode never requests pdf-lib. Tolerances and limits: [`docs/pdf-structure.md`](../../docs/pdf-structure.md) |
| `docx.js` | the viewer's `page` mode | `npm run test:viewer-docx`; `--docx <file> --shot out.png` renders a real file |
| `xlsx-extract.js` | `pages/data-view.html` renders its output | contract: [`docs/envelopes/workbook-extract.md`](../../docs/envelopes/workbook-extract.md) |
| `xlsx-write.js` | `pages/xlsx-picker.html` | `node/xlsx-picker-sweep.mjs` runs it over a directory of workbooks; `npm run gold-set` rebuilds the committed [`gold-set/`](../../gold-set/) for opening in Excel (`--check` reports it stale) |
| `wsl-core.js`, `wsl.js` | `pages/wsl-sync/` | |
| `brief.js`, `export.js`, `dom-shot.js` | the FAB's take menu | |

`lib/build.js` is not a kit (it extends `GH.prototype`); how it and the loader
share one contract is "Load and build are one contract" in
[`docs/loader.md`](../../docs/loader.md), and the build pipeline is in
[`node/README.md`](../../node/README.md).
