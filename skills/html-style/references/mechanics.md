# DaisyUI, Tailwind and Alpine mechanics

How a page here is built. What it should look like is the house style in
[`SKILL.md`](../SKILL.md) one folder up; that one is binding and this one is the
means.

## Rules that look like taste and are not

**A theme colour takes opacity in tens, 10 through 90, unless the page
registers the theme colours.** A page that boots through `lib/gh-boot.js`, which
registers them (`@theme inline`), composes every step. On a page that does not,
only a static step in tens survives (`bg-success/10`,
`text-base-content/60`); `/0`, `/100`, every step off the tens, the bracket form
(`/[5%]`) and any variant (`hover:bg-primary/10`) generate no rule. A background
then falls back to transparent and text keeps its resting colour, so a line
meant to be quiet or to change does not, and nothing errors. Stock palette
colours take any step (`bg-red-500/33`). Enforced by `npm run opacity-scan`
(`python/dead-opacity.py`), gated in `node/test/dead-opacity.test.mjs`, which
also carries the measurement.

**A Phosphor class names an icon or renders nothing at all**, silently. The
[`phosphor-icons` skill](../../phosphor-icons/SKILL.md) owns that rule and the
two ways to get the name wrong; `npm run icon-scan` (`python/blank-icons.py`)
enforces it, gated in `node/test/blank-icons.test.mjs`.

**A bound boolean attribute takes `!!`.** `:disabled="!!row.busy"`, never
`:disabled="row.busy"`. Alpine's `x-bind` coerces an undefined result to `''`
whenever the expression contains a dot, and `bind()` removes an attribute only
for `null`, `undefined` and `false`, so `''` takes the other branch and WRITES
it. A property that is simply absent therefore disables the button, freezes the
input, or checks the box. Only a bare fetch is exposed: `!row.busy` and
`row.busy === true` already yield a real boolean and need nothing. A passing
suite does not clear it, since a test that calls a method on the component
cannot see an attribute the template put on a button. Enforced by `npm run bool-attr-scan`
(`python/bound-boolean-attrs.py`), gated in
`node/test/bound-boolean-attrs.test.mjs`.

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

**A class new to the page has no CSS until the current task ends.** Code that
builds an element and measures it in the same task reads unstyled geometry, on
the first open only, because the browser build compiles new classes after the
inserting script returns. Measure again on the next animation frame.

**Render Markdown through the guide renderer.**
[`kits/guide-render.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/guide-render.js)
brings its own CSS, lifts phone prose to 17px, and redirects blob links to a
renderer. First pass the source through
[`SourcePeek.fenceFrontmatter`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/source-peek.js),
or `marked` turns opening metadata into the first paragraph. Existing `prose
prose-sm` surfaces may stay; prefer the guide renderer for new work, and do not
convert working pages for symmetry.

## HTML strings and embedded data

Keep the scaffold static and pass text through `textContent` or `x-text`.
For an HTML string, use the shared `esc` from
[vanilla-bundle.js](https://github.com/mehrlander/web-tools/blob/main/lib/vanilla-bundle.js)
once at the interpolation boundary. Its `fill` treats plain strings as text
and explicitly branded `html` as markup; `tpl` interpolates raw values and
requires escaping. The
[demo](https://github.com/mehrlander/web-tools/blob/main/pages/demos/vanilla-bundle-demo.html)
shows those distinctions. Setting `href` or `src` avoids quote injection but
does not validate a URL's scheme; validate untrusted destinations separately.

**Inline JSON must survive the HTML parser.** `JSON.stringify` leaves a closing
script tag intact, including inside a JSON string or a `type="application/json"`
block. Serialize, then escape `<` before inserting the result:

```js
const json = JSON.stringify(payload)
  .replace(/</g, '\u003c')
  .replace(/ /g, '\u2028')
  .replace(/ /g, '\u2029');
```

**Check each template-literal layer.** An outer literal evaluates `${...}`
before generated Alpine or JavaScript sees it. Escape a literal `${` as `\${`
and an inner backtick as `\``. A backtick inside an HTML comment still ends
the enclosing JavaScript literal. Parse checks catch broken outer syntax;
inspect the generated string for valid-but-wrong interpolation as well.

**Document replacement is deliberate.** `document.open()`, `document.write(html)`,
`document.close()` replaces the current document. Scripts written that way can
execute; scripts inserted with `innerHTML` do not. To load a script into the
existing page, append a newly created `script` element. Exercise values with
quotes, `<`, and closing script text; ordinary data alone does not check escaping.

## Title-tips and panel-tips

This section is the one statement of the house popup rule; rule 11 of the style guide, the kit headers and page comments point here. Rule 13 of the [style guide](../SKILL.md#the-rules) rules out modal dialogs.

A popup is a **title-tip** or a **panel-tip**, and one question decides which:
**can the reader tap anything inside it?** A link, a ↗ reference, a copy button,
a table, or a scrollbar, since a box that scrolls takes the pointer. If yes, it
is a panel-tip; if no, a title-tip. Where a reader might ask what the content
rests on, it is also a panel-tip, and it names its source with a ↗. Size and
importance do not enter into it. The standard terms are a tooltip (ARIA
`role="tooltip"`) and a popover.

A `title` attribute is neither, and neither are daisyUI's `tooltip`,
`data-tip` and `cursor-help`; none is used (rule 11).

| | Title-tip | Panel-tip | Panel-tip, pinned |
| --- | --- | --- | --- |
| Holds | one line the page already implies; nothing tappable | anything, with a ↗ to where it came from; may scroll | the same |
| Opens | hover, focus, tap; on an enabled control, hover and keyboard focus | hover with grace, focus, tap | a deliberate click; on touch, every tap |
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

- **DaisyUI 5 components**: See `daisyui.md` for component syntax, class names, and usage rules, an excerpt of upstream's list
- **Alpine.js V3 patterns**: See `alpine-v3.md` for the scope and registration rules that trip a page, and the Alpine 3 forms of v2 idioms
- **Reactivity cost in long lists**: See `reactivity-cost.md` for the per-row binding pattern that scales badly with N, the direct-DOM fix, and the DOM-reuse gotcha
- **Full demo**: See `demo-sortable.html` for a complete working example demonstrating CDN usage, DaisyUI components, Alpine.js patterns, Phosphor Icons, and third-party library integration

## Key Conventions

1. Use CDN delivery (jsDelivr for Tailwind/DaisyUI/libraries, unpkg for Alpine): no build step
2. Single-file artifacts: inline scripts
3. DaisyUI semantic colors (`primary`, `base-100`, etc.) over Tailwind color names
4. Alpine's `x-data`, `x-show`, `x-bind` for reactivity: no React
5. Use Phosphor Icons via CDN for iconography: no inline SVGs. A project's or repository's own mark, or one of the Map's marks for its tab groups and outposts, is the exception: an SVG file drawn to the [Drawn marks](https://github.com/mehrlander/web-tools/blob/main/docs/favicons/README.md#drawn-marks) rules.
6. No `<style>` blocks: no vanilla CSS, no `<style type="text/tailwindcss">`, no `@apply`. Generally, avoid all efforts to override styles in third-party components. Where no utility can reach, write `/* exempt(<kind>): <reason> */` before the rule, with a kind from [`python/css-blocks.py`](https://github.com/mehrlander/web-tools/blob/main/python/css-blocks.py). Enforced by `npm run css-scan`, gated in `node/test/css-blocks.test.mjs` against [`docs/css-baseline.csv`](https://github.com/mehrlander/web-tools/blob/main/docs/css-baseline.csv), a per-file ceiling; after converting a file, lower its row with `--write`.
7. **A daisyUI theme colour compiles in three utility families, `bg`, `border` and `text`, unless the page registers the theme colours with Tailwind.** On a page without the registration, `divide-base-200`, `ring-primary`, `outline-`, `from-`, `fill-`, `stroke-` and the rest compile to nothing and drop silently, while components such as `btn-primary` work. `lib/gh-boot.js` registers them on every page that boots the web-tools loader, and a page can register them itself with an `@theme inline` block. Elsewhere, write the same utility with an arbitrary value, `ring-[var(--color-primary)]`, which keeps the theme colour and any opacity step; a `shadow-*` tint has no arbitrary form, so drop the tint or write out the whole shadow. `npm run family-scan` ([`python/dead-family.py`](https://github.com/mehrlander/web-tools/blob/main/python/dead-family.py)) finds such utilities and names the fix, and [its tests](https://github.com/mehrlander/web-tools/blob/main/node/test/dead-family.test.mjs) hold the measured cases. Tailwind v4 also defaults the border colour to `currentColor`, so `divide-y` alone draws text-coloured hairlines: separate rows with `gap`, or colour the border (`[&>*+*]:border-t [&>*+*]:border-base-200`; inside an `x-for`, see 8).
8. **Structural selectors are wrong inside an `x-for`, including the adjacency fix above.** Alpine inserts each clone *after* the `<template>` rather than replacing it, so the template stays in the DOM and occupies the parent's first child slot. Measured with jsdom against the real runtime, three rows in a bare parent:

   ```
   children: template,span,span,span
   :first-child matches a clone?  false      (the template is :first-child)
   :last-child  matches a clone?  true       (only while nothing follows the loop)
   :scope > * + * hits:           span,span,span
   ```

   So `first:` matches nothing at all, `last:` matches only when the loop is the last thing in its parent (add a footer under it and that silently stops too), and `[&>*+*]:border-t` puts a border on **every** row including the first, because the first clone's preceding sibling is the template. All three compile, so nothing warns.

   Take the position from the loop, which is the one source that knows it: `x-for="(row, i) in rows"` then `:class="{ 'border-t border-base-200': i }"`. Or separate with `gap` on a flex/grid parent, which is ordinal-free. Reserve `first:`/`last:`/`[&>*+*]:` for static markup.

9. **A daisyUI control does not fill its parent, and a phone is where you find out.** `.input` and `.textarea` compute to `width: clamp(3rem, 20rem, 100%)`, so in a column narrower than 20rem they look correct and in a wider one they stop short while their label runs on, leaving a ragged right edge down the form. Put `w-full` on every input, textarea, and select rather than relying on the flex parent to stretch it, since `align-self: stretch` does not apply to an item with an explicit width.

10. **Size a pane by its container, not by the viewport.** A pane that is half a screen on desktop and the whole screen on a phone cannot be laid out with `sm:`/`lg:`, which ask how wide the *window* is: the same `lg:grid-cols-6` that reads well full-width puts six columns in a 360px column when the pane is split. Put `@container` on the column and use `@md:`/`@xl:`, which ask how wide the *column* is. The variants degrade to one column where they are unsupported, which is the safe direction.

11. **Tailwind v4 layers its utilities, and an unlayered stylesheet beats them on the cascade-layer rule rather than on specificity.** The typography `prose` cap is the case `SKILL.md` rule 3 names (`!max-w-none`); the guide renderer above sidesteps it. Any hand-written or kit-injected stylesheet wins the same way, so a utility beside such a rule may never have applied, and converting the rule switches it on: keep what rendered, and drop the utility that never did.

12. **An `x-data` expression sees every registered component name.** Alpine injects each name passed to `Alpine.data` into the scope of an `x-data` expression, so a config that closes over host state, such as `x-data="refPicker({ repo: () => repo })"`, reads the `repo` component's factory when one is registered under that name, not the host's field. A callback built in that expression and invoked bare has `this` bound to the same scope proxy, and `$data` is that proxy too. Build a child mount's config in the host's `init()`, over a `self` captured there, and pass the stored object: `x-data="refPicker(pickerCfg.ref)"`.

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

### Alpine alone (unpkg, defer)
```html
<script defer src="https://unpkg.com/alpinejs"></script>
```

### Alpine + plugins (jsDelivr combine, defer)
```html
<script defer src="https://cdn.jsdelivr.net/combine/npm/@alpinejs/collapse/dist/cdn.min.js,npm/@alpinejs/sort/dist/cdn.min.js,npm/alpinejs/dist/cdn.min.js"></script>
```

Alpine core must load last when combining with plugins. Use `defer` so Alpine initializes after the DOM is ready.

### Phosphor Icons

The combine above loads them; the [`phosphor-icons` skill](../../phosphor-icons/SKILL.md) has the class syntax and weights.
