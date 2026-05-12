// alpineComponents/cm-editor.js — minimal CodeMirror 6 editor as an Alpine
// component. No toolbar, no detection, no messaging/persistence assumptions —
// the host page wires those in. The richer compress-input-cm component is a
// good reference for what to layer on top.
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
// The component exposes its instance on host as `$el.__cm` and on the data
// scope as `value` / `language` / `wrap` / `readonly`. Setting any of these
// reactively dispatches the corresponding CodeMirror update.

document.addEventListener('alpine:init', function () {
  Alpine.data('cmEditor', function (opts) {
    opts = opts || {};

    return {
      value: opts.value ?? '',
      language: opts.language ?? 'plain',
      wrap: opts.wrap ?? true,
      readonly: opts.readonly ?? false,
      onChange: opts.onChange,
      onSelection: opts.onSelection,

      view: null,
      _modules: null,
      _langCompartment: null,
      _wrapCompartment: null,
      _readonlyCompartment: null,
      _suppressUpdate: false,

      init() {
        this.$el.__cm = this;

        (async () => {
          const [
            { EditorView, basicSetup },
            { EditorState, Compartment },
            { javascript },
            { html: htmlLang }
          ] = await Promise.all([
            import('https://esm.sh/codemirror'),
            import('https://esm.sh/@codemirror/state'),
            import('https://esm.sh/@codemirror/lang-javascript'),
            import('https://esm.sh/@codemirror/lang-html')
          ]);

          this._modules = { EditorView, EditorState, Compartment, javascript, htmlLang };
          this._langCompartment = new Compartment();
          this._wrapCompartment = new Compartment();
          this._readonlyCompartment = new Compartment();

          const langExt = this._langExt(this.language);

          const onUpdate = EditorView.updateListener.of((u) => {
            if (this._suppressUpdate) return;
            if (u.docChanged) {
              this.value = u.state.doc.toString();
              this.onChange?.(this.value);
            }
            if ((u.docChanged || u.selectionSet) && this.onSelection) {
              const r = u.state.selection.main;
              this.onSelection(r.from !== r.to ? {
                start: r.from,
                end: r.to,
                text: u.state.doc.sliceString(r.from, r.to)
              } : null);
            }
          });

          this.view = new EditorView({
            state: EditorState.create({
              doc: this.value,
              extensions: [
                basicSetup,
                this._langCompartment.of(langExt),
                this._wrapCompartment.of(this.wrap ? EditorView.lineWrapping : []),
                this._readonlyCompartment.of(EditorState.readOnly.of(this.readonly)),
                onUpdate
              ]
            }),
            parent: this.$el
          });

          this.$watch('value', (v) => {
            if (!this.view) return;
            if (v === this.view.state.doc.toString()) return;
            this._suppressUpdate = true;
            this.view.dispatch({
              changes: { from: 0, to: this.view.state.doc.length, insert: v }
            });
            this._suppressUpdate = false;
          });
          this.$watch('language', (l) => this._applyLanguage(l));
          this.$watch('wrap', (w) => this._applyWrap(w));
          this.$watch('readonly', (r) => this._applyReadonly(r));
        })();
      },

      _langExt(lang) {
        if (!this._modules) return [];
        const { javascript, htmlLang } = this._modules;
        return lang === 'js' ? javascript() : lang === 'html' ? htmlLang() : [];
      },

      _applyLanguage(lang) {
        if (!this.view) return;
        this.view.dispatch({ effects: this._langCompartment.reconfigure(this._langExt(lang)) });
      },

      _applyWrap(w) {
        if (!this.view) return;
        const { EditorView } = this._modules;
        this.view.dispatch({
          effects: this._wrapCompartment.reconfigure(w ? EditorView.lineWrapping : [])
        });
      },

      _applyReadonly(r) {
        if (!this.view) return;
        const { EditorState } = this._modules;
        this.view.dispatch({
          effects: this._readonlyCompartment.reconfigure(EditorState.readOnly.of(r))
        });
      },

      focus() { this.view?.focus(); }
    };
  });
});
