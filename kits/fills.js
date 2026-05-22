// kits/fills.js — daisyUI/Tailwind template-string helpers.
//
// Salvaged from Alp (archive/alp/repo/utils/fills.js). Pure functions that
// return HTML strings; zero runtime deps and zero Alpine coupling. Designed
// to be composed wherever HTML is built by string concatenation — Alpine
// `x-data` templates, vanilla DOM, anywhere. Loadable as a plain script
// (no ES modules):
//
//   <script src=".../kits/fills.js"></script>
//   const { tip, lines } = window.fills;
//
// Each helper takes a `mods` array of short tokens (e.g. ['xs','bottom'])
// that map to daisyUI/Tailwind classes. Unrecognized tokens are ignored —
// callers can pass `[]` to get defaults.
//
// For Alpine-flavored equivalents (decorators that wire behavior, not just
// markup), see the directives in alpine-bundle.js (x-tip, x-lines,
// x-toolbar, x-btn, x-save-indicator, x-action, x-metric).

(() => {
  const sz  = mods => ['xs', 'sm', 'md', 'lg', 'xl'].find(s => mods.includes(s));
  const pos = mods => ['top', 'bottom', 'left', 'right'].find(p => mods.includes(p)) || 'bottom';
  const gap = mods => ['gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4'].find(g => mods.includes(g)) || 'gap-0';

  const txt = mods => [
    sz(mods) && `text-${sz(mods)}`,
    ['left', 'center', 'right'].find(a => mods.includes(a)) && `text-${['left', 'center', 'right'].find(a => mods.includes(a))}`,
    mods.includes('bold')     && 'font-bold',
    mods.includes('semibold') && 'font-semibold',
    mods.includes('italic')   && 'italic',
    mods.includes('mono')     && 'font-mono',
    mods.includes('muted')    && 'opacity-60'
  ].filter(Boolean).join(' ');

  const fills = {
    // Single daisyUI button. Markup only — wire behavior separately.
    // For Alpine-scoped handlers use x-btn from alpine-bundle.js.
    btn: (mods, label) => {
      const variant = ['primary','secondary','accent','info','success','warning','error',
        'ghost','outline','soft','neutral'].find(v => mods.includes(v));
      const classes = ['btn', sz(mods) && `btn-${sz(mods)}`, variant && `btn-${variant}`]
        .filter(Boolean).join(' ');
      return `<button class="${classes}">${label}</button>`;
    },

    // daisyUI tooltip with a custom rich content body.
    tip: (mods, trigger, content) => {
      const cls = ['tooltip-content bg-base-100 text-base-content border border-base-300 rounded-box shadow-lg p-3 text-left',
        txt(mods) || 'text-xs'].filter(Boolean).join(' ');
      return `<div class="tooltip tooltip-${pos(mods)}"><div class="${cls}">${content}</div>${trigger}</div>`;
    },

    // Stacked column of single-line items.
    lines: (mods, arr) => {
      const cls = ['flex flex-col', gap(mods), txt(mods)].filter(Boolean).join(' ');
      return `<div class="${cls}">${arr.map(s => `<div>${s}</div>`).join('')}</div>`;
    },

    // Horizontal toolbar wrapper. `mods` reserved for future use.
    toolbar: (mods, ...items) =>
      `<div class="flex gap-2 items-center justify-between mb-2">${items.join('')}</div>`,

    // Full-screen modal. Caller provides the inner box content.
    modal: (inner) => `
      <dialog class="modal">
        <div class="modal-box w-full max-w-[95%] h-[80vh] p-0 shadow-lg flex flex-col overflow-hidden rounded-lg">
          ${inner}
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
      </dialog>`
  };

  window.fills = fills;
})();
