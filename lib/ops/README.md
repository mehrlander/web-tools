# `lib/ops/`: functions a caller with no page can run

An **op** is one file that is one value: a single function expression, taking
one serialisable argument and returning one serialisable result, reaching
neither `window` nor `document`. It attaches to nothing in a page; its caller
evaluates the file and calls what comes back.

That is the whole admission rule, and it is what separates an op from a kit,
which registers a `window` namespace in a page. An op is fetched as text by
whoever wants it: a page in this app, a Node test, or a phone that has no page
at all and runs the text inside a `data:` URL it never displays
(shortcut-tools' `Run-Op`).

Held by [`node/test/code-layers.test.mjs`](../../node/test/code-layers.test.mjs)
off [`python/code-shape.py`](../../python/code-shape.py), which reports an op
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
| `session-menu.js` | `{ input: <clipboard's first line, or b64:<the whole clipboard>>, token }` | `{ caption, rows, urls, menu, branch, id, state }` |

`session-menu.js` is the whole Claude menu the phone draws (its header has the
fields), so a change to the menu's wording, order or verbs is a commit here and
costs no install on the device.

Two rules the result has to keep, both learned from the phone rather than
inferred, and both held by `node/test/ops.test.mjs`:

- **The caption never pads.** iOS draws the prompt in a proportional font, so
  leading spaces move a line by an amount no character count predicts.
- **A `menu` row either opens an `https` page or is a bare shortcut name.** The
  phone's shell (`Choose-Claude` in shortcut-tools) runs a row it cannot find
  in `urls` as a name, which is measured;
  opening a `shortcuts://` link from inside a running shortcut is not, and
  appears in none of the fifteen library dumps.

It reads `state/session-menu.json` in web-tools-private, a **purpose-built**
index written by the same crawl that writes `state/sessions.json`
(`lib/kits/repo-sessions-cache.js`, "The phone's copy"), not the full cache.

A clipboard holding prose rather than a branch or a session link is read as a
**copied reply**: the session it names in a 💬 caption, or else the session whose
fingerprints in `state/reply-prints.json` account for most of it. The same crawl
writes that file for the menu's 16 recent sessions (`lib/kits/session-index.js`,
"The phone's reply prints", which also states the method and what it was measured
to find), and it is about 200 KB gzipped, so the op reads it only for prose.
`Run-Op` passes an op one line, so `Choose-Claude` sends the whole clipboard as
`b64:` and its base64. A raw first line still works: on the sample it found the
session for 99.5% of whole copied replies, against 99.9% of all copies whole.

**A merge is the whole publish.** The address a caller off the app uses is
GitHub's contents API, `https://api.github.com/repos/mehrlander/web-tools/contents/lib/ops/<name>.js?ref=main`,
with `Accept: application/vnd.github.raw` so the response is the file rather
than a JSON envelope around a base64 body. It is served `private, max-age=60`,
so no shared cache exists to hold a replaced op and nothing has to be purged.
A caller's own HTTP cache is the only layer left, and sixty seconds of it, which
a throwaway query defeats, as `Run-Op` does.
