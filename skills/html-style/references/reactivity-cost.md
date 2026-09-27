# Reactivity cost in long lists

Keypress paths are budget-constrained. Work that runs N times per keypress is suspect; work that runs once is usually fine. If a list might exceed roughly 30 items, design selection visuals accordingly from the start.

A per-row reactive binding inside `x-for` that depends on a single global state value runs N effects on every change to that global. At small N it's invisible. Around 30 to 50 rows on typical hardware it becomes a perceptible lag on hot paths like keypress navigation. Threshold is empirical and varies by setup.

## Failing pattern

```html
<!-- 🚫 selected === i subscribes every row to `selected`. -->
<template x-for="(link, i) in links" :key="i">
  <a :class="selected === i ? 'border-l-4 border-primary bg-base-200' : link.baseClass"
     @click="selected = i"></a>
</template>
```

The expensive thing is the dependency, not the expression.

## Fix: take the per-row visual out of Alpine

Keep the index in Alpine state for consumers whose cost is constant in N (status text, header, single indicator). Apply the per-row visual via direct DOM. Tag rows with `:data-i="i"` so the handler can find them. The row's `:class` reads only fields that are static after load.

```html
<template x-for="(link, i) in links" :key="i">
  <a :data-i="i" :class="link.baseClass" @click="select(i)"></a>
</template>

<script>
Alpine.data('sidebar', () => ({
  links: [/* ... */],
  selected: -1,
  cls: ['border-l-4', 'border-primary', 'bg-base-200'],

  select(i) {
    this.$root.querySelectorAll('[data-i].is-sel').forEach(el => {
      el.classList.remove('is-sel', ...this.cls);
    });
    const row = this.$root.querySelector(`[data-i="${i}"]`);
    row?.classList.add('is-sel', ...this.cls);
    this.selected = i;
  },
}));
</script>
```

`select(i)` is the source of truth for highlight. Treat `selected` as a consumer of that state, not a parallel writer. Constant-cost consumers elsewhere in the component stay reactive and are fine.

## DOM-reuse gotcha

Alpine reuses nodes when `x-for` replaces an array under stable index keys (`:key="i"`). Classes added by direct DOM are not tracked by any binding and will survive a re-render onto a different row's data. Two ways to handle it.

Stable identity keys (`:key="link.id"`) sidestep the problem and are usually the better default for unrelated reasons (focus retention, animations, form state).

If you genuinely want index-based reuse, clear before replacing:

```javascript
commit(newLinks) {
  this.$root.querySelectorAll('.is-sel').forEach(el => {
    el.classList.remove('is-sel', ...this.cls);
  });
  this.links = newLinks;
  this.selected = -1;
}
```
