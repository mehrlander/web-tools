# DaisyUI, Tailwind and Alpine mechanics

How a page here is built. What it should look like is the house style in
[`SKILL.md`](SKILL.md) beside this file; that one is binding and this one is the
means. Every rule below is here because it compiles, renders, or silently does
nothing in a way nobody would guess from reading the class list.

## Rules that look like taste and are not

**A theme colour takes opacity in tens, 10 through 90.** `bg-success/10`,
`text-base-content/60`. Anything else on a daisyUI theme colour generates no
rule: `/0`, `/100`, every step off the tens, and the bracket form (`/[5%]`).
Stock palette colours are unaffected and take any step, so `bg-red-500/33` is
fine. The reason to care is the direction of the failure, not the tidiness: a
background falls back to transparent and TEXT falls back to FULL strength, so a
line meant to be quiet comes out louder than the line above it. Nothing errors,
which is why it survives review. Enforced by `npm run opacity-scan`
(`scripts/dead-opacity.py`), gated in `tools/test/dead-opacity.test.mjs`, which
also carries the measurement.

**A Phosphor class names an icon or renders nothing at all**, silently. The
[`phosphor-icons` skill](../../phosphor-icons/SKILL.md) owns that rule and the
two ways to get the name wrong; `npm run icon-scan` (`scripts/blank-icons.py`)
enforces it, gated in `tools/test/blank-icons.test.mjs`.

**A bound boolean attribute takes `!!`.** `:disabled="!!row.busy"`, never
`:disabled="row.busy"`. Alpine's `x-bind` coerces an undefined result to `''`
whenever the expression contains a dot, and `bind()` removes an attribute only
for `null`, `undefined` and `false`, so `''` takes the other branch and WRITES
it. A property that is simply absent therefore disables the button, freezes the
input, or checks the box, and the author is looking at a field that is plainly
not true. Only a bare fetch is exposed: `!row.busy` and `row.busy === true`
already yield a real boolean and need nothing. Two shipped controls were dead
this way before anyone found the cause (PR #469), both with passing suites,
because a test that calls a method on the component cannot see an attribute the
template put on a button. Enforced by `npm run bool-attr-scan`
(`scripts/bound-boolean-attrs.py`), gated in
`tools/test/bound-boolean-attrs.test.mjs`.

**A bound attribute holding a constant does not need binding.** `:title="'a
kind\'s units'"` escapes the apostrophe for the template literal, so the
attribute reaches Alpine as an unterminated string and the whole expression
throws on every load. A constant is a plain `title=`. Where the expression is
genuinely conditional and one branch needs an apostrophe, `&apos;` is not the
way out either: entities are decoded before Alpine sees the attribute, so the
string closes early and the browser reports `Unexpected identifier`, naming
neither the attribute nor the file. Switch the surrounding quotes, or write the
branch without one.

**Put `min-w-0` on the scroll track.** Flex and grid items default to
`min-width:auto`; a track of `min-w-full` slides can claim one viewport per slide
and push the header offscreen. Pair it with `min-h-0` on the `1fr` content row.
The same default is why `truncate` on a flex child never shrinks it, and why an
implicit grid column, which sizes to max-content, makes every `min-w-0` beneath
it inert until the column is capped with `grid-cols-[minmax(0,1fr)]`.

**An `x-for` template inside `<svg>` draws nothing.** Alpine clones a
`<template>` into the HTML namespace, so `<path>` parses as an unknown HTML
element. Build the markup as a string and assign it through `x-html` on a
wrapping `<div>`, which lets the parser switch namespace.

**An `<input type=range>` is clamped by the browser at creation.** One built
while its `:max` is still a placeholder has its DOM value clamped, and `x-model`
writes the clamp back, so the thumb and the readout part company for the life of
the page. Create it with `x-if` once the real bounds are in hand.

**Render Markdown through the guide renderer.**
[`kits/guide-render.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/guide-render.js)
brings its own CSS, lifts phone prose to 17px, and redirects blob links to a
renderer. First pass the source through
[`SourcePeek.fenceFrontmatter`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/source-peek.js),
or `marked` turns opening metadata into the first paragraph. Existing `prose
prose-sm` surfaces may stay; prefer the guide renderer for new work, and do not
convert working pages for symmetry.

## Title-tips and panel-tips

**This section is the one statement of the house popup rule.** Rule 11 of the
style guide, the kit headers and page comments point here rather than
restating it.

A popup is a **title-tip** or a **panel-tip**, and one question decides which:
**can the reader tap anything inside it?** A link, a ↗ reference, a copy button,
a table, or a scrollbar, since a box that scrolls takes the pointer. If yes, it
is a panel-tip; if no, a title-tip. Where a reader might ask what the content
rests on, it is also a panel-tip, and it names its source with a ↗. Size and
importance do not enter into it. The standard terms are a tooltip (ARIA
`role="tooltip"`) and a popover.

A `title` attribute is neither: it labels an icon-only control and carries no
fact, since it never reaches a phone or a screenshot. daisyUI's `tooltip`,
`data-tip` and `cursor-help` are not used; this overrides `references/daisyui.md`.

| | Title-tip | Panel-tip | Panel-tip, pinned |
| --- | --- | --- | --- |
| Holds | one line the page already implies; nothing tappable | anything, with a ↗ to where it came from; may scroll | the same |
| Opens | hover, focus, tap | hover with grace, focus, tap | a deliberate click; on touch, every tap |
| Closes | leave, its own tap, tap anywhere, Escape, a scroll, a resize, a blur | the pointer elsewhere, a scroll, a resize, a blur, ✕, tap outside, Escape | ✕, Escape, a scroll, an action inside |
| Own close target | its body: on touch, tapping it closes it and swallows the tap | ✕, shown where the reader cannot hover | ✕, always |

**Every popup carries its own close target.** Tap-outside also closes, and lets
the tap through to what was under it, so on a dense page it is never the route
out: a title-tip closes on its own tap, a panel-tip on its ✕. Pinned is a state
of a panel-tip, not a third kind: a click pins it on a desktop, and on touch it
opens pinned, since a phone has no "leave".

### Title-tip: `kits/title-tip.js`

Load [the kit](https://github.com/mehrlander/web-tools/blob/main/lib/kits/title-tip.js)
and write `data-title-tip="…"` where a `title` would have gone; markup written
later needs nothing more. Beside it:

- `data-title-tip-lead`: a bold lead line, such as a comment's author.
- `data-title-tip-bare`: no dotted underline, where there is no room for one.
- `data-title-tip-look`: `plain` (the browser's tooltip redrawn, for a few
  words) or the styled default, resolved with `closest()` so `<body>` sets a
  page default. Any other token is the page's to style through
  `#wt-title-tip[data-look="<token>"]`, as the sheet render does for `excel`.

A title-tip is one line and never scrolls. One that wraps is the cue to ask
whether it is a panel-tip. The kit caps it at six lines and reports a clip in
the console; `TitleTip.fits(el)` answers the same question for a test. Demo:
[`lib/kits/demos/title-tip.html`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/demos/title-tip.html).

### Panel-tip: `kits/panel-tip.js`

[The kit](https://github.com/mehrlander/web-tools/blob/main/lib/kits/panel-tip.js)
owns the way out, not the geometry or the opening. Render
`PanelTip.closeHTML(pinned)`, the ghost ✕ shown when pinned or where nothing
hovers, and call `PanelTip.wire(el, { onClose, except })` once. It closes on the
✕, Escape, a press outside, the pointer demonstrably elsewhere after a 220 ms
grace, and a page scroll, resize or window blur, since a leave event is not
guaranteed to fire. `except` names the control that toggles the panel-tip.
`stale: false` drops the scroll, resize and blur guards, which is right only for
a panel-tip anchored to nothing that moves; `stale: 'geometry'` keeps them and
drops the pointer guard, for a hand-rolled panel that is `pointer-events: none`.

The caller owns four things:

- **Opening.** Hover only where `(hover: hover) and (pointer: fine)` match: open
  after about 140 ms, close about 220 ms after leaving both the control and the
  panel-tip. A tap toggles on the panel-tip's actual visibility, not on a flag.
- **The ✕ on touch.** A shell that is `pointer-events: none` unless pinned draws
  a ✕ nobody can press. Add `@media (hover:none){ .<shell>.show{pointer-events:auto} }`;
  `wire` reports the case on a coarse pointer.
- **Closing once.** Assign the scalar (`this.obs.open = false`) or return early
  when already closed. Replacing the object (`this.obs = {...this.obs, open: false}`)
  re-runs Alpine's `x-show` and un-hides a panel its leave transition already hid.
- **Hiding in a way the guards can read:** `x-show`, the `hidden` class, or the
  `hidden` attribute. A panel-tip hidden by opacity alone reads as shown.

Worked example: the budget-drs app's caption panel-tip (`window.__tip` in
`app/view/app.html`), and the pinned state in its lineage, stream, schema and
composition views. Demo:
[`lib/kits/demos/panel-tip.html`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/demos/panel-tip.html).

## References

- **DaisyUI 5 components**: See `daisyui.md` for complete component syntax, class names, and usage rules
- **Alpine.js V3 patterns**: See `alpine-v3.md` for V3 API and key differences from V2
- **Reactivity cost in long lists**: See `reactivity-cost.md` for the per-row binding pattern that scales badly with N, the direct-DOM fix, and the DOM-reuse gotcha
- **Full demo**: See `demo-sortable.html` for a complete working example demonstrating CDN usage, DaisyUI components, Alpine.js patterns, Phosphor Icons, and third-party library integration

## Key Conventions

1. Use CDN delivery (jsDelivr for Tailwind/DaisyUI/libraries, unpkg for Alpine): no build step
2. Single-file artifacts: inline styles and scripts
3. DaisyUI semantic colors (`primary`, `base-100`, etc.) over Tailwind color names
4. Alpine's `x-data`, `x-show`, `x-bind` for reactivity: no React
5. Use Phosphor Icons via CDN for iconography: no inline SVGs
6. No `<style>` blocks: no vanilla CSS, no `<style type="text/tailwindcss">`, no `@apply`. Generally, avoid all efforts to override styles in third-party components.
7. A daisyUI semantic colour works only in the utility families daisyUI itself ships, and there are **exactly three**: `bg`, `border`, `text`. Derived from daisyUI 5.7.28's own stylesheet on 2026-09-08, not estimated: it defines 207 classes on a semantic colour across 25 families, and every family but those three is a daisyUI COMPONENT (`btn-primary`, `badge-error`, `alert-warning`), which is a different thing. So `bg-base-200`, `text-base-content` and `border-base-300` resolve, while `divide-base-200`, `ring-primary`, `outline-primary`, `accent-primary`, `from-base-100`, `via-`, `to-`, `fill-`, `stroke-`, `caret-`, `placeholder-`, `decoration-` and `shadow-` on a semantic colour all compile to nothing and are dropped silently. **The fix is mechanical: write the same utility with an arbitrary value, `ring-primary` to `ring-[var(--color-primary)]`.** Measured 2026-09-08 in headless Chromium: the arbitrary form sets `--tw-ring-color` to the theme colour where the semantic name set nothing, `divide-[var(--color-base-200)]` paints at `oklch(0.98 0 0)` where `divide-base-200` painted in the text colour, and an opacity step rides along unchanged (`/40` becomes `color-mix(... 40%, transparent)`). So the ring stays a ring and takes no layout space, which swapping to `border-*` would not preserve, and the colour still follows the theme, which a palette colour would not. One exception measured: `shadow-*` leaves `--tw-shadow-color` unset in the arbitrary form, so a shadow tint has to be written out. **Run it rather than remember it: `npm run family-scan`** ([`scripts/dead-family.py`](https://github.com/mehrlander/web-tools/blob/main/scripts/dead-family.py)), which derives the supported set from the installed daisyUI, names the substitution per finding, and gates the tree in `tools/test/dead-family.test.mjs`. Tailwind v4 then defaults `border-color` to `currentColor` (v3 defaulted to `gray-200`), so `divide-y` alone paints hairlines in the **text colour**: black lines where a faint grey was intended. The same trap waits in `ring-*`, `outline-*`, and `accent-*`. Separate rows with `gap`, or write the border explicitly (`[&>*+*]:border-t [&>*+*]:border-base-200`). A Tailwind palette name (`divide-slate-300`) also works and is the tell: if swapping the colour name fixes it, the semantic name was never compiling. Inside an `x-for`, reach for the index rather than the adjacency selector; see 8.
8. **Structural selectors are wrong inside an `x-for`, including the adjacency fix above.** Alpine inserts each clone *after* the `<template>` rather than replacing it, so the template stays in the DOM and occupies the parent's first child slot. Measured with jsdom against the real runtime, three rows in a bare parent:

   ```
   children: template,span,span,span
   :first-child matches a clone?  false      (the template is :first-child)
   :last-child  matches a clone?  true       (only while nothing follows the loop)
   :scope > * + * hits:           span,span,span
   ```

   So `first:` matches nothing at all, `last:` matches only when the loop is the last thing in its parent (add a footer under it and that silently stops too), and `[&>*+*]:border-t` puts a border on **every** row including the first, because the first clone's preceding sibling is the template. All three compile and all three are real CSS, so nothing warns; the rule just lands on the wrong element or on none.

   Take the position from the loop, which is the one source that knows it: `x-for="(row, i) in rows"` then `:class="{ 'border-t border-base-200': i }"`. Or separate with `gap` on a flex/grid parent, which is ordinal-free. Reserve `first:`/`last:`/`[&>*+*]:` for static markup.

9. **A daisyUI control does not fill its parent, and a phone is where you find out.** `.input` and `.textarea` compute to `width: clamp(3rem, 20rem, 100%)`, so in a column narrower than 20rem they look correct and in a wider one they stop short while their label runs on. Measured at a 390px viewport: the label 342px, the field 320px, a ragged right edge down the whole form. Put `w-full` on every input, textarea, and select rather than relying on the flex parent to stretch it, since `align-self: stretch` does not apply to an item with an explicit width.

10. **Size a pane by its container, not by the viewport.** A pane that is half a screen on desktop and the whole screen on a phone cannot be laid out with `sm:`/`lg:`, which ask how wide the *window* is: the same `lg:grid-cols-6` that reads well full-width puts six columns in a 360px column when the pane is split. Put `@container` on the column and use `@md:`/`@xl:`, which ask how wide the *column* is. The variants degrade to one column where they are unsupported, which is the safe direction.

11. **Tailwind v4 layers its utilities; the typography stylesheet is unlayered, and unlayered wins.** `.prose{max-width:65ch}` therefore beats `.max-w-none` on the cascade-layer rule rather than on specificity, and nothing in the class list looks wrong. Reach for `!max-w-none`, or keep the 65ch measure on purpose and centre the column. Prefer `lib/kits/guide-render.js` for anything new, which brings its own CSS and sidesteps this; do not convert a working surface just for symmetry.

## CDN Patterns

Use jsDelivr `combine` to bundle multiple packages in a single request. Tailwind, DaisyUI, icons, and any other libraries go through jsDelivr. Alpine goes through unpkg; when plugins join, a jsDelivr combine keeps them one tag with core last.

### Scripts (jsDelivr combine)
```html
<script src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web,npm/clipboard"></script>
```

### Styles (jsDelivr combine)
```html
<link href="https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5" rel="stylesheet" />
```

### Alpine + plugins (jsDelivr combine, defer)
```html
<script defer src="https://cdn.jsdelivr.net/combine/npm/@alpinejs/collapse/dist/cdn.min.js,npm/@alpinejs/sort/dist/cdn.min.js,npm/alpinejs/dist/cdn.min.js"></script>
```

Alpine core must load last when combining with plugins. Use `defer` so Alpine initializes after the DOM is ready.

### Phosphor Icons

Use `<i class="ph ph-icon-name">` for regular weight, `ph-bold`, `ph-fill`, etc. for variants. Avoids inline SVGs entirely.
```html
<i class="ph ph-caret-down"></i>
<i class="ph ph-file-text"></i>
<i class="ph ph-check"></i>
```
