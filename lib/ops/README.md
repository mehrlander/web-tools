# `lib/ops/`: functions a caller with no page can run

An **op** is one file that is one value: a single function expression, taking
one serialisable argument and returning one serialisable result, reaching
neither `window` nor `document`. It attaches to nothing in a page; its caller
evaluates the file and calls what comes back.

That is the whole admission rule, and it is what separates an op from a kit.
A kit registers a `window` namespace and is loaded into a page that then uses
it. An op is fetched as text by whoever wants it, wherever they are: a page in
this app, a Node test, or a phone that has no page at all and runs the text
inside a `data:` URL it never displays (shortcut-tools' `Run-Op`, over the
`Get-FromJs` route that library documents as its one door to JavaScript).
Same code, two runners.

Held by [`tools/test/code-layers.test.mjs`](../../tools/test/code-layers.test.mjs)
off [`scripts/code-shape.py`](../../scripts/code-shape.py), which reports an op
as attaching to `expression`. The rule and its place among the other layers:
[`docs/code-layers.md`](../../docs/code-layers.md).

## Shape

```js
// what it does, in one line
(function name(input) {
  // ...
  return { ... };
})
```

- **Wrapped in parentheses**, so `eval(text)` yields the function.
- **Synchronous**, and network through a blocking `XMLHttpRequest`. The phone
  route coerces the running page to text at a moment nobody has documented; a
  promise that resolves later returns nothing. A caller that can await may, but
  an op may not require it.
- **Errors are results.** Return `{ caption: 'ERROR …', error }` or the like,
  so a caller with no console still learns what happened.
- **Credentials arrive as input**, never read from storage: the phone has no
  `localStorage` the app's token lives in, and a Node test has none at all.

## The ops

| File | Input | Result |
| --- | --- | --- |
| `session-menu.js` | `{ input: <clipboard text>, token }` | `{ caption, rows, urls, menu, branch, id, state }` |

`session-menu.js` is the whole Claude menu the phone draws after a double back
tap, header and rows together, so `Choose-Claude` in shortcut-tools is a shell
that draws `menu` and looks the chosen row up in `urls`. A change to the menu's
wording, order or verbs is therefore a commit here and costs no install, which
is the point: that repo ranks the device as the expensive resource.

Two rules the result has to keep, both learned from the phone rather than
inferred, and both held by `tools/test/ops.test.mjs`:

- **The caption never pads.** iOS draws the prompt in a proportional font, so
  leading spaces move a line by an amount no character count predicts.
- **A `menu` row either opens an `https` page or is a bare shortcut name.** The
  shell runs a row it cannot find in `urls` as a name, which is measured;
  opening a `shortcuts://` link from inside a running shortcut is not, and
  appears in none of the fifteen library dumps.

It reads `state/session-menu.json` in web-tools-private, a **purpose-built**
46 KB index written by the same crawl that writes `state/sessions.json`
(`lib/kits/repo-sessions-cache.js`, "The phone's copy"). Not the 1.16 MB cache
itself, which carries every tool call of every session to answer a question that
needs three fields.

The public address of an op, for a caller off the app:
`https://cdn.jsdelivr.net/gh/mehrlander/web-tools@main/lib/ops/<name>.js`.
jsDelivr caches a branch ref for up to twelve hours; after a change, purge the
**ref path**, `https://purge.jsdelivr.net/gh/mehrlander/web-tools@main/lib/ops/<name>.js`.
Purging the bare path reported finished and left the alias serving the old copy
(2026-09-03). A caller's own HTTP cache is a second layer: the file is served
with `max-age=604800`, so a caller appends a throwaway query, as Run-Op does.
