# Alpine.js V3 Key Patterns

This reference covers Alpine.js V3 patterns and critical differences from V2.

## Breaking Changes from V2

### $el is now always the current element

`$el` represents the element the expression was executed on, not the component root.

```html
<!-- V2: $el was the <div>, now it's the <button> -->
<div x-data>
    <button @click="console.log($el)"></button>
</div>

<!-- Use $root to access component root -->
<div x-data>
    <button @click="console.log($root)"></button>
</div>
```

### init() functions auto-evaluate

No need to call `init()` manually in `x-init`.

```html
<!-- 🚫 Before -->
<div x-data="foo()" x-init="init()"></div>

<!-- ✅ After -->
<div x-data="foo()"></div>

<script>
    function foo() {
        return {
            init() {
                // Runs automatically
            }
        }
    }
</script>
```

### x-show.transition is now x-transition

```html
<!-- 🚫 Before -->
<div x-show.transition="open"></div>

<!-- ✅ After -->
<div x-show="open" x-transition></div>

<!-- With duration -->
<div x-show="open" x-transition.duration.500ms></div>

<!-- Enter/leave separately -->
<div
    x-show="open"
    x-transition:enter.duration.500ms
    x-transition:leave.duration.750ms
></div>
```

### x-data cascading scope

Nested `x-data` now inherits parent scope.

```html
<!-- In V3, foo IS available in nested x-data -->
<div x-data="{ foo: 'bar' }">
    <div x-data="{}">
        <!-- foo is 'bar' -->
    </div>
</div>
```

### x-init callback pattern changed

Use `$nextTick()` instead of returning a function.

```html
<!-- 🚫 Before -->
<div x-data x-init="() => { ... }">...</div>

<!-- ✅ After -->
<div x-data x-init="$nextTick(() => { ... })">...</div>
```

### preventDefault requires explicit call

Returning `false` no longer prevents default.

```html
<!-- 🚫 Before -->
<div x-data="{ blockInput() { return false } }">
    <input type="text" @input="blockInput()">
</div>

<!-- ✅ After -->
<div x-data="{ blockInput(e) { e.preventDefault() }">
    <input type="text" @input="blockInput($event)">
</div>
```

### x-spread is now x-bind

```html
<!-- 🚫 Before -->
<button x-spread="trigger">Toggle</button>

<!-- ✅ After -->
<button x-bind="trigger">Toggle</button>

<script>
    function dropdown() {
        return {
            open: false,
            trigger: {
                'x-on:click'() { this.open = !this.open },
            },
            dialogue: {
                'x-show'() { return this.open },
            },
        }
    }
</script>
```

### Lifecycle events changed

```html
<!-- 🚫 Before -->
<script>
    window.deferLoadingAlpine = startAlpine => {
        startAlpine()
    }
</script>

<!-- ✅ After -->
<script>
    document.addEventListener('alpine:init', () => {
        // Before Alpine initializes
    })

    document.addEventListener('alpine:initialized', () => {
        // After Alpine initializes
    })
</script>
```

## Deprecated APIs

### .away → .outside

```html
<!-- 🚫 Before -->
<div x-show="open" @click.away="open = false">

<!-- ✅ After -->
<div x-show="open" @click.outside="open = false">
```

### Prefer Alpine.data() for reusable components

```html
<!-- 🚫 Before -->
<div x-data="dropdown()">...</div>
<script>
    function dropdown() {
        return { ... }
    }
</script>

<!-- ✅ After -->
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

## CDN Usage

For CDN usage (no build step):

```html
<script defer src="https://unpkg.com/alpinejs"></script>
```

For module imports:

```javascript
import Alpine from 'alpinejs'
window.Alpine = Alpine
Alpine.start()
```
