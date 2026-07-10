# Library recipes

The libraries the combine URL might pull, sorted into buckets. Extension point
for the inline bucket: one line in the `RUNTIME` map inside `scripts/bake.js`,
shaped `name: { js: 'path', css: 'path' }`.

## Compile bucket (Tailwind family)

| Library | How it bakes |
| --- | --- |
| `@tailwindcss/browser` | Replaced by a real compile: `@import "tailwindcss";` run through `@tailwindcss/cli --minify`, scanning the page so only used utilities ship. |
| `daisyui` | A Tailwind plugin. Add `@plugin "daisyui";` to the compile input and its components (`btn`, `card`, `badge`) prune alongside the utilities. The CDN `themes.css` is just the pre-baked version of this. |

Any other Tailwind plugin joins the same way: one `@plugin` line.

## Swap bucket (icons)

| Library | How it bakes |
| --- | --- |
| `@phosphor-icons/web` | The font/JS library is dropped. A swapper scans `<i class="ph ph-name">`, reads the matching SVG from `@phosphor-icons/core/assets/<weight>/<name>.svg`, and inlines it. Weights map to folders (`ph` to `regular`, `ph-bold` to `bold`, ...); non-regular weights add a filename suffix (`plus-bold.svg`). Extra attributes on the `<i>` (Alpine `:class`, `x-show`) are carried onto the `<svg>`. SVGs use `fill="currentColor"`, so `text-*` color and a `size-[1em]` class make them behave like the font glyphs did. |

A different icon set needs its own swapper, but the shape is the same: find the
class pattern, read the asset, inline it, carry the attributes.

## Inline bucket (runtime JS and CSS)

These cannot become CSS. Inline the npm dist file as-is. Each is one line in the
`RUNTIME` map: `name: { js: 'path', css: 'path' }`.

| Library | npm dist (js) | dist (css) |
| --- | --- | --- |
| `alpinejs` | `alpinejs/dist/cdn.min.js` | — |
| `lodash` | `lodash/lodash.min.js` | — |
| `clipboard` | `clipboard/dist/clipboard.min.js` | — |
| `jszip` | `jszip/dist/jszip.min.js` | — |
| `get-xpath` | `get-xpath/dist/index.min.js` | — |
| `winbox` | `winbox/dist/winbox.bundle.min.js` | — |
| `tabulator-tables` | `tabulator-tables/dist/js/tabulator.min.js` | `tabulator-tables/dist/css/tabulator_simple.min.css` |

Notes:

- **Load order.** The script inlines Alpine last so any globals it touches are
  defined first. If you add a library Alpine depends on, the alphabetical-plus-
  Alpine-last order already handles it; for other ordering needs, sort the
  `order` array.
- **CSS-bearing libraries** (like Tabulator) get their stylesheet inlined
  verbatim in a `<style>` block. It is not Tailwind, so it is not pruned, just
  embedded whole.
- **vanilla-jsoneditor** is loaded as an ES module via dynamic `import()` from
  unpkg, not the combine URL. To bake it, inline its standalone bundle and keep
  the `createJSONEditor` entry point. It is heavier than the others; treat it as
  a deliberate add rather than an automatic one.

## When the script flags a library

`bake.js` prints `NOT baked, add a recipe: <name>` for any combine package it
does not have a recipe for. That is the cue: classify it (almost always the
inline bucket), add the one-line `RUNTIME` entry, install the npm package, and
re-run.
