---
name: succinct-js-idioms
description: Succinct JavaScript idiom preferences for code generation. Use this skill whenever generating, reviewing, or refactoring JavaScript, including browser scripts, artifacts, and Node 22+ targets. Nudges toward concise, well-supported APIs and platform primitives.
---

# Succinct JS Idioms

With JavaScript, consider these patterns to produce more succinct code.

## Favored patterns

| Instead of | Use | Why |
|---|---|---|
| `[...arr.slice(0,i), val, ...arr.slice(i+1)]` | `arr.with(i, val)` | Immutable replacement, single expression |
| `.reduce()` accumulator for grouping | `Object.groupBy(arr, fn)` | One-liner, intent is obvious |
| `JSON.parse(JSON.stringify(obj))` | `structuredClone(obj)` | Handles Date, Map, Set, cyclic refs |
| Executor antipattern for Promises | `Promise.withResolvers()` | Returns `{promise, resolve, reject}` directly |
| Manual loops for set operations | `setA.intersection(setB)`, `.union()`, `.difference()` | Native Set methods |
| `[...arr].sort(fn)` | `arr.toSorted(fn)` | Also `toReversed()`, `toSpliced()` |
| `.reverse().find(fn)` | `arr.findLast(fn)` | Also `findLastIndex()` |
| `obj.hasOwnProperty(key)` | `Object.hasOwn(obj, key)` | Works on `Object.create(null)`, shorter |
| `.replace(/x/g, 'y')` | `str.replaceAll('x', 'y')` | No regex for literal replacements |
| `new Error('msg')` losing original error | `new Error('msg', {cause: err})` | Preserves error chain, inspectable via `.cause` |
| Manual close buttons on modals | `<form method="dialog">` inside `<dialog>` | Submit closes dialog, return value via `close` event |
| Manual HTML escape functions | `new Option(untrusted).innerHTML` | Zero-dep browser-native HTML escaping |
| `foo && foo.bar && foo.bar.baz` | `foo?.bar?.baz` | Optional chaining: shorter, same semantics |
| `val \|\| 'default'` (breaks on `0`, `''`) | `val ?? 'default'` | Nullish coalescing: only `null`/`undefined` |
| Class methods needing `.bind(this)` in callbacks | Arrow function class fields: `handleClick = (e) => {}` | Lexical `this` by default, no bind boilerplate |

## Repeating HTML structures and template literal interpolation

HTML often expresses sequential structures verbosely. Look for where a function could fill a template literal that takes via parameters only what sets each instance apart. Distilling data from structure this way can be more succinct and readable.

## DOM micro-helpers

When generating single-file browser scripts or artifacts, consider inlining these to debulk verbose DOM passages:

```js
const el = (t, a) => Object.assign(document.createElement(t), a);
const ea = (s, fn) => [...document.querySelectorAll(s)].map(fn);
```

- `el('div', {className: 'card', textContent: 'hi'})`: create and configure in one expression.
- `ea('.item', el => el.hidden = true)`: query and act without intermediate variables.

## Patterns to favor

- **Property assignment over `setAttribute` + `addEventListener`**: `Object.assign(node, {onclick: fn, hidden: true})` instead of separate calls.
- **`parent.append()` accepts multiple args**: `parent.append(el('h1', {textContent: 'hi'}), el('p', {textContent: 'yo'}))`. No fragment needed.
- **Event delegation with `.closest()`**: One listener on a parent, `e.target.closest('.item')` to find the relevant element. Prefer over per-element listeners.
