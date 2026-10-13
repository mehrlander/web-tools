---
name: safe-html-templating
description: Core patterns and pitfalls for constructing HTML strings within JavaScript. This most commonly applies to bookmarklets writing complete HTML to popups and Alpine.js expressions utilizing nested template literals. Use whenever generating similarly structured code. Watch for failures that manifest as silent rendering defects rather than console errors. Unescaped closing script tags in JSON payloads prematurely ending script blocks, outer literal interpolation consuming inner scopes, or payload data inadvertently breaking the HTML structure.
---

# Safe HTML templating

## 1. JSON inside `<script>`

`JSON.stringify` does not escape `</script>`. A string containing that token ends the block early. Older parsers also choke on U+2028 and U+2029.

Bad:
```js
document.write(`<script>const data = ${JSON.stringify(payload)}</script>`)
```

Good. Stash on `window` first, then rewrite. The window object persists across `document.open`:
```js
window.__data = payload
document.open()
document.write(`<!doctype html><script>const data = window.__data</script>...`)
document.close()
```

If you must inline, escape the unsafe bits:
```js
const safe = JSON.stringify(payload)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029')
```

## 2. Backtick and `${}` collisions

When the outer string is a template literal and the inner HTML wants its own template syntax (an Alpine expression that uses `${}`, a tagged template being generated as output), the outer parser eats the inner first. JS evaluates `${index}` against the outer scope before Alpine ever sees it.

```js
const html = `<div x-text="\`Item ${index}\`"></div>`  // outer JS interpolates first
```

Fine at one level: Alpine's `${}` only appears inside attribute values you control, and a single nesting is easy to track. The hazard scales with depth. When you find yourself two layers in, slow down and look at what each layer evaluates. If you need a literal `${` in the output, escape it:

```js
const html = `<div x-text="\`Item \${index}\`"></div>`
```

## 3. Data through HTML vs. through bindings

The same value is dangerous in HTML and inert through a binding. Keep the HTML scaffold static and push values in through `x-text`, `:href`, `:src`, `textContent`, `setAttribute`.

Bad:
```js
container.innerHTML = `<a href="${userUrl}">${userName}</a>`
```

Good:
```js
window.user = { url: userUrl, name: userName }
container.innerHTML = `<a x-bind:href="user.url" x-text="user.name"></a>`
```

Or plain DOM, no Alpine:
```js
const a = container.querySelector('a')
a.href = userUrl
a.textContent = userName
```

The principle holds for JSON viewers, log lines, fetch results, anything that arrived from outside your code.

## 4. `document.write` after load

Calling `document.write` on a loaded page replaces the document. Fine when intentional, surprising otherwise. The clean sequence:

```js
document.open()
document.write(html)
document.close()
```

One asymmetry to remember. Scripts written via `document.write` execute. Scripts assigned via `innerHTML` do not. So if your HTML string includes a `<script src>` tag, the path matters.

To add a script to an already-loaded page without rewriting it, build the element directly:

```js
document.head.append(
  Object.assign(document.createElement('script'), { src: '...' })
)
```

## When it goes wrong

These bugs surface as garbled output, not errors. Walk backward from the start of the wrongness: the offending character is sitting just before that point, often something prosaic like a quote in a name or a `<` in a comment. Clean output doesn't prove the escaping is right, only that the current data didn't happen to land on a meaningful character.
