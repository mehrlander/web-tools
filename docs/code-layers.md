# Code layers

Which folder a new code file goes in, and the rule that admits it.

| Layer | Admission rule | Attaches to |
| --- | --- | --- |
| `lib/` **scaffolding** | extends `GH.prototype`, or is a boot bundle | `GH.prototype`; a bundle is admitted by name |
| `lib/kits/` **kit** | everything else that registers a `window` namespace | `window.<Name>` |
| `lib/alpineComponents/` **component** | renders and holds reactive state | `Alpine.data(name, fn)` |
| `lib/ops/` **op** | is one function expression, reaching neither `window` nor `document` | nothing in a page: its caller evaluates the text |
| `python/` **Python** | is Python | a `python3` invocation |
| `node/` **Node** | is Node, never shipped to a page | a `node`/`npm` invocation |

Attachment decides, not portability or reach.
[`code-shape.py`](../python/code-shape.py) (`npm run code-shape`) reads what
each file attaches to, and
[`code-layers.test.mjs`](../node/test/code-layers.test.mjs) fails a misplaced
file under `lib/`; [`tests.csv`](tests.csv) lists its checks.
[`npm run code-scan`](../python/unclaimed-code.py) is advisory: it counts, per
folder, the files any document names and any test exercises.

## Cases the table does not settle

- **Where a file does both, scaffolding wins.** [`lib/gh-auth.js`](../lib/gh-auth.js)
  extends the prototype and registers `window.ghAuth`, so it sits in `lib/` root.
- **A component beats a namespace.** `ref-switch.js`, `stage.js` and `viewer.js`
  each register a `window` namespace beside their `Alpine.data`, and stay in
  `lib/alpineComponents/`.
- **The loader and the bundles are root by name:** `gh-api.js`, `entry.js`, and
  every `*-bundle.js`. That is what "boot bundle" means in the table.
- **A prototype extension counts through an alias.** The test reads
  `window.GH.prototype` and `window.gh.constructor.prototype` (as in
  [`lib/gh-boot.js`](../lib/gh-boot.js)) the same as `GH.prototype`.
- **Loading at start is not a folder.** It is the `BOOT` array in
  [`lib/gh-boot.js`](../lib/gh-boot.js), with `FAB_BOOT` for the FAB's
  conditional loads. A boot-loaded file stays in the folder its attachment gives
  it.
- **A kit that wants Alpine reactivity gets a component wrapper** rather than
  becoming a component.
  [`cm-editor.js`](../lib/alpineComponents/cm-editor.js) over
  [`cm6.js`](../lib/kits/cm6.js) is the reference pair.
- **A page-free module that registers a namespace stays a kit.** `lib/ops/` takes
  only a bare function expression; its contract is in
  [`lib/ops/README.md`](../lib/ops/README.md).

The shape rules a `lib/` file must honor to load are in [`loader.md`](loader.md).

## Outside `lib/`

Pages, bookmarklets, popups and console snippets are the repo's output shapes;
[`README.md`](../README.md) names their folders. A script that supports them goes
with its caller: a pipeline step with its pipeline, a skill's script in that
skill's folder, and a script a platform runs with that platform's files
(`.githooks/`, `.github/workflows/`, `.claude/`, `skills/hooks/`). A script kept
only to explain a probe stays with the probe's findings
([`CONSTELLATION.md`](CONSTELLATION.md#projects-and-research)). Anything else goes
in `python/` or `node/` by language, and [`node/README.md`](../node/README.md)
splits `node/` further. The commit hook adds a [`harness.csv`](harness.csv) row
for a new file in those folders; fill in its `role`.
