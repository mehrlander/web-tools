# Alpine.js V3 Key Patterns

Pages here are written for Alpine 3 only; loading it is in `mechanics.md`,
"CDN Patterns".

## Scope

### $el is the current element

`$el` represents the element the expression was executed on, not the component root.

```html
<!-- $el is the <button> -->
<div x-data>
    <button @click="console.log($el)"></button>
</div>

<!-- Use $root to access component root -->
<div x-data>
    <button @click="console.log($root)"></button>
</div>
```

### x-data cascading scope

Nested `x-data` inherits parent scope.

```html
<!-- foo IS available in nested x-data -->
<div x-data="{ foo: 'bar' }">
    <div x-data="{}">
        <!-- foo is 'bar' -->
    </div>
</div>
```

### init() runs automatically

An `init()` method on the `x-data` object runs on its own; calling it from
`x-init` as well runs it twice.

```html
<div x-data="foo()"></div>
```

## Register reusable components with Alpine.data()

```html
<div x-data="dropdown">...</div>
<script>
    document.addEventListener('alpine:init', () => {
        Alpine.data('dropdown', () => ({
            ...
        }))
    })
</script>
```

Note: Define `Alpine.data()` extensions BEFORE calling `Alpine.start()`.

## Alpine 3 forms of v2 idioms

- `x-show="open" x-transition` (`x-transition.duration.500ms`,
  `x-transition:enter.duration.500ms`), not `x-show.transition`.
- `x-init="$nextTick(() => { ... })"`, not an `x-init` that returns a function.
- Returning `false` does not prevent default: pass `$event` to the handler and
  call its `preventDefault()`.
- `x-bind="trigger"` with an object of directives, not `x-spread`.
- `@click.outside`, not `@click.away`.
- `alpine:init` and `alpine:initialized` events, not `window.deferLoadingAlpine`.
