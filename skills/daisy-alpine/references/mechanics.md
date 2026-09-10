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

## Notes and cards

**This section is the one statement of the house popup rule.** Rule 11 of the
style guide points here; the note kit's header, the budget-drs app's README and
any page comment point here rather than restating it. Edit this section, not a
copy.

A popup is a **note** or a **card**, and one question decides which: **can the
reader tap anything inside it?** A link, a ↗ reference, a copy button, a table,
or a scrollbar, since a box that scrolls has to take the pointer. If yes, it is
a card. If no, it is a note. Size and importance do not enter into it. A
`title` attribute is neither: it is the label of an icon-only control, carries
no fact, and never reaches a phone or a screenshot. daisyUI's `tooltip`,
`data-tip` and `cursor-help` are not used at all; this overrides
`references/daisyui.md`.

| | Note | Card | Card, pinned |
| --- | --- | --- | --- |
| Holds | one line the page already implies; nothing tappable | anything, with a ↗ to where it came from; may scroll | the same |
| Opens | hover, focus, tap | hover with grace, focus, tap | a deliberate click; on touch, every tap |
| Closes | leave, its own tap, tap anywhere, Escape, a scroll, a resize, a blur | the pointer elsewhere, a scroll, a resize, a blur, ✕, tap outside, Escape | ✕, Escape, a scroll, an action inside |
| Own close target | its body: on touch, tapping the note closes it and swallows the tap | ✕, shown where the reader cannot hover | ✕, always |
| Looks | `plain` (the browser's tooltip redrawn) or the styled default | one shell | the same shell, marked pinned |
| Standard term | ARIA `role="tooltip"` | popover with light dismiss | popover with manual dismiss |

**Every popup carries its own close target.** Tap-outside stays as a courtesy
and lets the tap through to what was tapped, so on a dense page it is never
the route out: for a note the route is the note itself, for a card it is the
✕. A pinned card is a state of a card, not a third component: click pins on a
desktop, and on touch a card opens pinned, since a phone has no "leave". That
one sentence is where the ✕ rule comes from.

**The card's way out is built once, in
[`kits/card.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/card.js).**
`Card.closeHTML(pinned)` returns the ghost ✕ (no border, no fill, muted, in the
corner) when the card is pinned or the screen has no hover, and
`Card.wire(el, {onClose, except})` attaches every route to one callback: the ✕,
Escape, and a capture-phase `pointerdown` outside. `except` names the control
that toggles the card, without which the press closes it and the toggle
reopens it. The kit owns the way out and not the geometry, since a card
following the cursor over a chart and one anchored beside a sidebar row are the
same rule and different placement.

Two traps it answers, both of which fail silently. A capture-phase listener is
required because a press often lands on a control whose own handler stops
propagation, so `@click.outside` alone strands the card open. And a shell that
is `pointer-events: none` unless pinned draws a ✕ that cannot be pressed, which
looks correct in a screenshot and fails under a finger; `wire` measures the
element on a coarse pointer and reports it. The shell owns that property:
`@media (hover:none){ .<shell>.show{pointer-events:auto} }`.

**A card closes on the world, not on a leave event.** A leave is not a promise:
the pointer can stop being over the trigger without one ever firing. A scroll
slides the content out from under a card positioned `fixed`, which stays exactly
where it was and is then beside the wrong row. A re-render replaces the element
the listener was attached to. The window loses focus mid-hover. None of those is
a gesture anyone can report, so the symptom arrives as cards that refuse to go
away rather than as a reproduction. `wire` therefore closes on two facts checked
against the world: the pointer is demonstrably somewhere else (over something
that is neither the card nor a selector in `except`, after the 220 ms grace that
lets a reader cross the gap), or the geometry the card was placed against no
longer holds (a page scroll, a resize, a window blur). A scroll *inside* the card
is excluded, since that is a reader reaching the rest of a long one. `stale:
false` opts out, and is only right for a card anchored to nothing that moves.

**A hand-rolled note takes the geometry half of that, and only that.** Where a
page raises its own panel rather than using `Note`, the panel is usually
`pointer-events: none`, which makes it never the pointer's target: `contains`
is false for every point on it, so the pointer guard would arm the instant it
opened and close it 220 ms later. `Card.wire(el, { stale: 'geometry' })` is
that case, bringing the scroll, resize and blur guards, Escape and the press
outside, and leaving the ordinary departure to the trigger's own leave. Found
on budget-drs's submittal page, which carried three panels where two had been
counted: the third survived a blur or a resize with the pointer never moving.

Two consequences worth knowing. `except` now does double duty: a pointer resting
on the control that raised the card has not left, which is also what lets a
second trigger's own hover replace the card rather than flickering through empty.
And the guards read the card's ACTUAL visibility rather than a flag, the same
rule the toggle follows, covering the three ways a panel here is hidden: an
Alpine `x-show`, the `hidden` class, the `hidden` attribute. A card hidden by
opacity alone reads as shown and needs its own answer.

**Closing an already-closed panel un-hides it, so a closer must refuse to
write.** `this.obs = { ...this.obs, open: false }` replaces the object, and
Alpine re-runs `x-show` on the identity change even though the value it reads
is the same `false`; re-running the hide on an element already hidden by a
completed leave transition clears the inline `display: none` and leaves it at
`display: block`, with the state still saying closed. It never recovers: the
guards then see a shown panel and close it again, each close re-stranding it.
Assign the scalar (`this.obs.open = false`), which triggers nothing when
unchanged, or gate the write on `if (!this.obs.open) return`. Found 2026-09-09
on budget-drs's submittal page, where every state-only check passed while the
card sat on screen.

**What the caller still owns: opening.** Enable hover only when
`(hover: hover) and (pointer: fine)` match: open after about 140 ms and close
about 220 ms after leaving both the control and the card. Tapping the control
toggles it using its actual visibility, not a separate state flag, so the two
cannot fall out of step.

**The note is built once, in
[`kits/note.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/note.js),
and not again.** `data-note="…"` where a `title` would have gone, one shared
panel, delegated listeners so markup written later by `innerHTML` needs no
re-init. Load the kit and write the attribute. Beside it: `data-note-title`
for a bold lead line, `data-note-bare` to drop the dotted underline where there
is no room for one, and `data-note-look`, resolved with `closest()` so a page
sets its default once on `<body>`. The kit ships two looks: the styled default,
and `plain`, the browser's own tooltip redrawn (square, no shadow, one size
smaller) for a note of a few words, a header unwrapped, a unit spelled out,
where the styled box reads as more than the text deserves. Any other token is
the page's to style through `#wt-note[data-look="<token>"]`; the sheet render
asks for `excel` and draws Excel's comment box on a page already drawing Excel.

**A note is meant to be one line, and it never scrolls.** Its content is
what the page already implies and cannot fit: a header unwrapped past its
truncation, a unit spelled out, a code's long name. Nobody asks where such a
note came from, because the page beside it already answers, and that is the
second criterion, beside tappability: **where a reader might ask what the
content rests on, it is a card, and the card says so** with a ↗ to the manifest
or table it was drawn from (the budget-drs principle that a caption drawn from a
table also opens that table). A note that wraps is the signal to ask that
question. The kit caps the panel at six lines as a ceiling, not a target, and
clips past it with a console report naming the element; `Note.fits(el)` answers
the same question for a test. The ceiling is a number and can move; the rule
that a note never scrolls cannot.

Three behaviours the kit had to add, each found by measurement:

- **`focusin` alone leaves the panel open when focus goes nowhere.** A bare
  `blur()`, or a click on dead space, fires `focusout` with no `focusin` behind
  it, so the note survives and only Escape clears it. Handle `focusout` too.
- **A note assembled from parts loses its breaks under `white-space: normal`.**
  A caller joining a comment to the value a cell stores wrote a blank line
  between them and got one run-on sentence. The panel is `pre-line`.
- **A screen reader must still get the text.** `title` is announced, so a
  visual-only tooltip is a regression wearing an improvement's clothes. Follow
  the WAI-ARIA pattern: the trigger is focusable, the panel is `role="tooltip"`,
  it opens on focus, and `aria-describedby` points at it while open. The cost is
  a tab stop per note, which is also the only way a keyboard reaches it.

Demo, including the headless recipe that proves a note survives a screenshot
where a `title` cannot:
[`lib/kits/demos/note.html`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/demos/note.html).
The budget-drs app's shared caption card (`window.__tip` in
`app/view/app.html`) is the worked example of a card, and its rich views
(lineage, stream, schema, composition) of the pinned state.

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
