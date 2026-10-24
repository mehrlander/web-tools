---
name: bake-page
description: >-
  Turn a CDN-driven HTML artifact into one self-contained file:
  Tailwind and daisyUI compiled and pruned, Phosphor icons inlined as SVG,
  Alpine and other runtime JS inlined. Use when a page needs to render inline
  (preview box, data URL, iPhone) without CDN loads, or when the user asks to
  "bake" a page or wants a self-contained, offline, or single-file version.
---

# Bake Page

Author in CDN form, the editable source, and hand over the baked twin. Baking
never alters authored markup (classes, `x-data`, icon names); to go back, keep
or restore the source rather than reversing a baked file.

## Run

```bash
npm i tailwindcss @tailwindcss/cli daisyui @phosphor-icons/core alpinejs   # deps the default stack uses
node scripts/bake.js input.html output.html
```

Detects libraries (combine URL + Alpine script + markup), strips those CDN tags,
bakes each detected library, writes one file. Prints what it baked and flags any
library it has no recipe for. Honors `<!--CSS-->` / `<!--JS-->` markers; else
injects before `</head>` and `</body>`.

## Detection

The script bakes only what appears in the page in a form it recognizes. Each
kind has its tell:

- **Tailwind**: a `@tailwindcss/browser` reference, or the `daisyui` string
  (which needs it).
- **daisyUI**: the literal `daisyui` anywhere on the page.
- **Phosphor**: the `@phosphor-icons/web` package, or any `ph-` class.
- **Alpine**: the unpkg Alpine tag, or any `x-data` in the markup.
- **Runtime libs** (lodash, clipboard, jszip, get-xpath, winbox, tabulator):
  only from a `cdn.jsdelivr.net/combine/` URL, and only if the name has a
  `RUNTIME` recipe.

Tailwind and Phosphor are caught however they arrive, since their tells are
loose markup signals. The runtime libs are strict: combine URL plus a known
name. A standalone CDN tag is invisible, and a combine name with no recipe is
reported (`NOT baked, add a recipe`), not silently dropped.

## Key insights

- **Tailwind scans source as text**, not as a DOM. A class your JS assembles at
  runtime is invisible and gets dropped. A literal string is kept even inside an
  Alpine `:class="open && 'rotate-180'"`, because the scanner sees `rotate-180`
  as text. Safelist or write the literal when a class is built dynamically.
- **Phosphor swap specifics**: weight maps to a folder (`ph`=regular,
  `ph-bold`=bold, ...); non-regular weights add a filename suffix
  (`plus-bold.svg`); SVGs use `fill="currentColor"`, so `text-*` color and a
  `size-[1em]` class make them act like the font glyph did. Carry any extra
  attributes on the `<i>` (`:class`, `x-show`) onto the `<svg>`, or the bindings
  die. A swapper that reads only `class` loses them. The swap resolves static
  classes only: an icon selected through a dynamic `:class` never swaps. Render
  one `<i>` per variant with the full static class and toggle with `x-show`.
- **Alpine cannot be pruned**; inline it as-is, before `</body>`. Styled-but-no-
  clicks means the inlined Alpine did not run.
- **Injection uses function replacers, and must.** `String.replace` reads `$$`,
  `$&`, `` $` ``, `$'` and `$1` in a replacement *string* as patterns, and a
  minified bundle is full of them. Alpine registers every magic through
  ``Object.defineProperty(t, `$${n}`, …)``, so a string replacement registers
  each magic without its `$`, and every expression using `$el`, `$refs`,
  `$dispatch`, `$watch` or `$nextTick` fails with "not defined", silently, in a
  bundle whose source clearly contains the name. **Verify by diffing:** the inlined bytes must equal
  the npm dist byte for byte.
- **Blob URLs abort on opaque origins** (`file://`, data-URL pages): a worklet
  or worker module built via `URL.createObjectURL` throws. Build the module URL
  as `'data:text/javascript,' + encodeURIComponent(src)`.
- **Size floor** is roughly the inlined runtime JS (Alpine ~45 KB). CSS scales
  with classes used; a non-interactive page bakes small.

## How it works, and adding a library

Each library is one of three kinds, baked a different way; adding one means
classifying it into a kind.

- **Tailwind**: the engine generates CSS from the classes in the markup, so the
  kind holds Tailwind core and any Tailwind plugin (daisyUI is one). `@import
  "tailwindcss" source(none);` plus a `@plugin` line per plugin, run through
  `@tailwindcss/cli --minify` with `@source` pointed at the page. The
  `source(none)` scopes the scan to the page alone, so only its used utilities
  and components ship and a busy working directory cannot leak stray classes in.
  A new plugin is one more `@plugin` line.
- **Swap** (Phosphor, or any class-to-asset mapping): a swapper finds the class
  pattern, reads the asset (a static SVG), inlines it, carries the extra
  attributes, and drops the font. Another icon set needs its own swapper.
- **Inline** (Alpine and most runtime JS): runtime behaviour, cannot become
  CSS. Paste the minified npm dist into a `<script>`; nearly free per library,
  and Alpine goes last (any other ordering need is a change to the `order`
  sort in `scripts/bake.js`). A new one is a line in the `RUNTIME` map in
  `scripts/bake.js` (`name: { js: 'path', css: 'path' }`) pointing at the npm
  dist file; install the package and re-run. A `css` path (Tabulator's) is
  embedded whole in a `<style>` block, not compiled or pruned.

`scripts/bake.js` prints `NOT baked, add a recipe` for unknown combine
packages; such a package is almost always the Inline kind. `vanilla-jsoneditor` arrives by dynamic `import()` from unpkg, not
the combine URL, so it is never detected; to bake it, inline its standalone
bundle and keep the `createJSONEditor` entry point, as a deliberate add since
it is heavier than the others.

## Verify

Headless load from `file://`: expect zero non-`file:` requests, click an Alpine
control and read state back, screenshot to catch a missing icon. A page that
takes a microphone probes with `--use-fake-ui-for-media-stream
--use-fake-device-for-media-stream --autoplay-policy=no-user-gesture-required`.
Recipe:
`references/verify.md`.
