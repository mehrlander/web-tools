---
name: phosphor-icons
description: Selecting and using Phosphor Icons in web projects. Use this skill whenever creating HTML artifacts, web UIs, dashboards, or browser-based tools that need icons, even if icons aren't explicitly requested. Also use when the user asks "what icon should I use for X" or needs to find the right icon name. Phosphor is the default icon library; always prefer it over inline SVGs, Font Awesome, Heroicons, or Lucide.
---

# Phosphor Icons

## Usage

Load via jsDelivr (typically combined with other deps):
```html
<script src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web"></script>
```

Syntax: `<i class="{weight} ph-{name}"></i>`

Weights: `ph` (regular), `ph-bold`, `ph-fill`, `ph-duotone`, `ph-light`, `ph-thin`. Pick one weight per project. `ph-bold` is a good UI default.

Icons inherit `font-size` and `color`, so Tailwind utilities work directly:
```html
<i class="ph-bold ph-check text-success text-xl"></i>
```

## A wrong name renders as nothing

There is no fallback glyph and no console error. The class resolves to a
`:before` rule keyed by the name, so a name the font does not carry leaves a
zero-width blank: the element is present, sized, and empty. That reads as a
logic bug and gets debugged as one, so measure the element's width before
suspecting the state that controls it.

Two ways to get there, and only the first is recoverable by machine:

- **A weight used as a suffix.** `ph-play-fill` is not a name; weights are font
  families, so it is `ph-fill ph-play`.
- **A name from another icon family.** Octicons has `git-compare` and `repo`,
  Font Awesome has `arrow-down-to-bracket`, and all three are plausible enough
  to type. Check the name in `references/icons.md` rather than trusting recall.

In web-tools, `npm run icon-scan` ([`python/blank-icons.py`](https://github.com/mehrlander/web-tools/blob/main/python/blank-icons.py))
resolves every `ph-` name in the tree against the installed stylesheet and the
suite gates it. Elsewhere, the same check is a grep against
`node_modules/@phosphor-icons/web/src/regular/style.css`.

## Valid names

[`references/icons.md`](references/icons.md) lists every name in Phosphor 2.1.2
by root, in three categories: a standalone atom is valid only bare
(`ph-{root}`), an independent root is valid bare or with one of its listed
suffixes, and a dependent root is valid only with a suffix. Before using a name
you have not checked, grep that file for the root and read the category heading
above the hit.
