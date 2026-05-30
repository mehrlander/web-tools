// alpineComponents/cm-editor.js — minimal CodeMirror 6 editor as an Alpine
// component. No toolbar, no detection, no messaging/persistence assumptions —
// the host page wires those in. The richer compress-input-cm component is a
// good reference for what to layer on top.
//
// The editor itself is kits/cm6.js (setup:'basic'); this component is the thin
// Alpine reactivity shell over it. Load the kit first:
//   await gh.load('kits/cm6.js');
//   await gh.load('alpineComponents/cm-editor.js');
//
// Usage:
//   <div x-data="cmEditor({ value, language, wrap, readonly, onChange, onSelection })"
//        class="... [&_.cm-editor]:h-full ..."></div>
//
//   - value:       initial doc string
//   - language:    'html' | 'js' | 'plain'  (default: 'plain')
//   - wrap:        bool                     (default: true)
//   - readonly:    bool                     (default: false)
//   - onChange:    (text) => void
//   - onSelection: ({start,end,text}|null) => void
//
// The component exposes its instance on host as `$el.__cm`, the cm6 handle as
// `cm`, and the raw view as `view`. Setting value / language / wrap / readonly
// reactively dispatches the corresponding cm6 update.

document.addEventListener('alpine:init', function () {
  Alpine.data('cmEditor', function (opts) {
    opts = opts || {};

    return {
      description: 'Minimal CodeMirror 6 editor; host wires toolbar, persistence, and language',

      value: opts.value ?? '',
      language: opts.language ?? 'plain',
      wrap: opts.wrap ?? true,
      readonly: opts.readonly ?? false,
      onChange: opts.onChange,
      onSelection: opts.onSelection,

      cm: null,
      view: null,

      init() {
        this.$el.__cm = this;

        if (!window.cm6) {
          console.error('cmEditor: window.cm6 is missing — gh.load("kits/cm6.js") before this component');
          return;
        }

        cm6.create(this.$el, {
          value: this.value,
          language: this.language,
          wrap: this.wrap,
          readOnly: this.readonly,
          setup: 'basic',
          onChange: (text) => { this.value = text; this.onChange?.(text); },
          onSelection: (sel) => this.onSelection?.(sel)
        }).then((handle) => {
          this.cm = handle;
          this.view = handle.view;

          this.$watch('value', (v) => { if (this.cm && v !== this.cm.getValue()) this.cm.setValue(v); });
          this.$watch('language', (l) => this.cm?.setLanguage(l));
          this.$watch('wrap', (w) => this.cm?.setWrap(w));
          this.$watch('readonly', (r) => this.cm?.setReadOnly(r));
        });
      },

      focus() { this.cm?.focus(); },
      destroy() { this.cm?.destroy(); }
    };
  });
});
