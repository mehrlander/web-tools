// alpineComponents/drag-splitter.js — the drag-splitter as an Alpine component:
// the line a reader drags to resize two adjoining areas, after WPF's
// GridSplitter. The gesture, the keys and the ARIA are kits/drag-splitter.js;
// this is the thin shell that holds the size and applies it, so a host writes
// one element instead of an attach call, a store and a reset.
//
// Load the kit first, then this, before alpine-bundle.js:
//   await gh.load('kits/drag-splitter.js');
//   await gh.load('alpineComponents/drag-splitter.js');
//
// Usage, on the element that becomes the drag-splitter, placed between the two
// areas in the host's own layout (a grid track or a flex item):
//   <div x-data="dragSplitter({ axis: 'row', sets: '--list-h', store: 'my-list-h' })"></div>
//
// Options; a size is in `unit`, and min and max also take a function:
//   axis      'col' (a vertical line, sizing a width) | 'row' (a horizontal
//             line, sizing a height); default 'col'
//   from      'start': the area sized is before the line (left, above);
//             'end': after it. Default 'start'
//   unit      'px' | '%' of the span; default 'px'
//   on        the element the size is written on and measured against, or a
//             function of the drag-splitter returning it; default its parent
//   sets      a CSS custom property written on `on`, as `<size><unit>`; the
//             host's layout reads it, with its default as the fallback
//   store     a localStorage key: the size on release, restored on init
//   target    the area sized, or a function returning it, read for the size
//             before any drag; default the sibling on the `from` side
//   bounds    () => rect the size is a share of; default `on`'s own rect
//   min, max  the stops, in `unit`, or a function (el, span) => stop, span
//             being the bounds' extent in px; default 5% and 95% of the span
//   label     the drag-splitter's name for a screen reader
//   onChange(size), onCommit(size), onReset()
//
// The component holds `size` (null until dragged or restored) and `reset()`,
// which a double-click also runs: it removes the property and the stored size,
// so the host's own default applies again. The kit's handle is `split`.
document.addEventListener('alpine:init', function () {
  Alpine.data('dragSplitter', function (o) {
    o = o || {};
    const axis = o.axis === 'row' ? 'row' : 'col';
    const from = o.from === 'end' ? 'end' : 'start';
    const pct = o.unit === '%';
    const fn = v => (typeof v === 'function' ? v : () => v);

    return {
      size: null,
      split: null,

      init() {
        const el = this.$el;
        // Without the kit, and no loader to fetch it, there is no drag-splitter
        // and the host's default layout stands, as it would without this.
        const ready = window.dragSplitter ? Promise.resolve()
          : (window.gh?.load ? window.gh.load('kits/drag-splitter.js') : Promise.resolve());
        ready.then(() => this._mount(el)).catch(() => {});
      },

      _mount(el) {
        if (this.split || !window.dragSplitter) return;
        const on = () => fn(o.on)(el) || el.parentElement;
        const rect = () => (o.bounds ? o.bounds(el) : on().getBoundingClientRect());
        const span = () => { const r = rect(); return (axis === 'row' ? r.height : r.width) || 0; };
        const toPct = v => (pct ? v : (span() ? v / span() * 100 : 0));
        const fromPct = p => (pct ? p : p * span() / 100);
        const target = () => fn(o.target)(el) || (from === 'start' ? el.previousElementSibling : el.nextElementSibling);
        const measured = () => {
          const t = target(), r = t && t.getBoundingClientRect();
          const v = r ? (axis === 'row' ? r.height : r.width) : 0;
          return pct ? (span() ? v / span() * 100 : 0) : v;
        };
        const minPct = () => (o.min == null ? 5 : toPct(Number(fn(o.min)(el, span()))));
        const maxPct = () => (o.max == null ? 95 : toPct(Number(fn(o.max)(el, span()))));
        const clamp = v => Math.round(Math.max(fromPct(minPct()), Math.min(fromPct(maxPct()), v)));

        this._apply = (v, quiet) => {
          v = clamp(v);
          this.size = v;
          if (o.sets) on().style.setProperty(o.sets, v + (pct ? '%' : 'px'));
          if (!quiet) o.onChange?.(v);
          return v;
        };
        this._save = v => { if (o.store) try { localStorage.setItem(o.store, String(v)); } catch {} };
        this._on = on;

        let kept = NaN;
        if (o.store) try { kept = Number(localStorage.getItem(o.store)); } catch {}
        if (kept > 0) this._apply(kept, true);

        this.split = window.dragSplitter.attach(el, {
          axis, from, label: o.label, min: minPct, max: maxPct,
          bounds: rect,
          value: () => toPct(this.size != null ? this.size : measured()),
          onChange: p => { this._apply(fromPct(p)); this.split?.refresh(); },
          onCommit: p => { const v = this._apply(fromPct(p)); this._save(v); o.onCommit?.(v); },
        });
        this._reset = () => this.reset();
        el.addEventListener('dblclick', this._reset);
        // A container can change size without a window resize (a docked deck,
        // a sidebar). Re-clamp a kept size and keep the ARIA stops current.
        if (window.ResizeObserver) {
          this._ro = new ResizeObserver(() => {
            if (this.size != null) this._apply(this.size, true);
            this.split?.refresh();
          });
          this._ro.observe(on());
        }
      },

      reset() {
        this.size = null;
        if (o.sets && this._on) this._on().style.removeProperty(o.sets);
        if (o.store) try { localStorage.removeItem(o.store); } catch {}
        o.onReset?.();
        this.split?.refresh();
      },

      destroy() {
        this._ro?.disconnect();
        this._ro = null;
        if (this._reset) this.$el.removeEventListener('dblclick', this._reset);
        this.split?.destroy();
        this.split = null;
      },
    };
  });
});
