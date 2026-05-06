document.addEventListener('alpine:init', function() {
  Alpine.data('compressInputCm', function(opts) {
    opts = opts || {};
    const ns = opts.path || 'compress-helper';
    const PATH_INPUT = ns + '.input';
    const PATH_SEL   = ns + '.sel';

    return {
      template: `
        <div class="absolute inset-0 flex flex-col">
          <div class="flex flex-wrap items-center gap-2 mb-2 flex-none">
            <b>Input</b>
            <span class="badge badge-sm badge-neutral" x-text="inputType"></span>
            <div class="flex-1"></div>
            <button class="btn btn-xs" :class="sel ? 'btn-primary' : 'btn-ghost opacity-50'"
              x-text="sel ? 'Selection ('+sel.start+'-'+sel.end+')' : 'Selection'"></button>
            <template x-for="c in chunks">
              <button @click="selectChunk(c)" class="btn btn-xs"
                :class="sel && sel.start===c.start && sel.end===c.end ? 'btn-primary' : 'btn-ghost'"
                x-text="c.label ? (c.alg==='brotli'?'BR64':'GZ64')+'(\\''+c.label+'\\')' : (c.alg==='brotli'?'BR64':'GZ64')+'('+c.start+'-'+c.end+')'"></button>
            </template>
            <button @click="clearSelection" class="btn btn-xs btn-ghost" :class="!sel && 'opacity-50'">Clear</button>
            <button @click="isWrapped=!isWrapped" class="btn btn-xs btn-ghost" title="Toggle wrap">
              <i :class="isWrapped ? 'ph ph-text-aa' : 'ph ph-text-t'"></i>
            </button>
          </div>
          <div x-ref="editor"
            class="flex-1 min-h-0 w-full text-xs rounded-box border border-base-300 overflow-hidden bg-base-100
                   [&_.cm-editor]:h-full [&_.cm-editor]:outline-none
                   [&_.cm-scroller]:overflow-auto [&_.cm-scroller]:font-mono
                   [&_.cm-gutters]:bg-base-200/30 [&_.cm-gutters]:border-none"></div>
        </div>`,

      input: '',
      sel: null,
      chunks: [],
      isWrapped: true,
      inputType: 'Text',

      view: null,
      _modules: null,
      _langCompartment: null,
      _wrapCompartment: null,
      _currentLang: null,

      init() {
        this.$root.__compressInput = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));

        (async () => {
          const { messaging, persistence, compression } = window;

          const v = await persistence.load(PATH_INPUT);
          if (v) {
            if ('input' in v) this.input = v.input;
            if ('isWrapped' in v) this.isWrapped = v.isWrapped;
          }

          await new Promise(r => this.$nextTick(r));
          await this.mountEditor();

          this.chunks = compression.text.findCompressedChunks(this.input);
          await this.detectType();

          messaging.publish(PATH_INPUT, 'change', this.input);

          this.$watch('input', () => {
            this.chunks = compression.text.findCompressedChunks(this.input);
            this.detectType();
            this.saveInput();
            messaging.publish(PATH_INPUT, 'change', this.input);
          });
          this.$watch('isWrapped', () => {
            this.applyWrap();
            this.saveInput();
          });
        })();
      },

      async mountEditor() {
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

        const onUpdate = EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            this.input = u.state.doc.toString();
          }
          if (u.docChanged || u.selectionSet) {
            const r = u.state.selection.main;
            if (r.from !== r.to) {
              this.sel = {
                start: r.from,
                end: r.to,
                text: u.state.doc.sliceString(r.from, r.to)
              };
            } else {
              this.sel = null;
            }
            this.detectType();
            window.messaging.publish(PATH_SEL, 'change', this.sel);
          }
        });

        this.view = new EditorView({
          state: EditorState.create({
            doc: this.input,
            extensions: [
              basicSetup,
              this._langCompartment.of([]),
              this._wrapCompartment.of(this.isWrapped ? EditorView.lineWrapping : []),
              onUpdate
            ]
          }),
          parent: this.$refs.editor
        });
      },

      applyWrap() {
        if (!this.view) return;
        const { EditorView } = this._modules;
        this.view.dispatch({
          effects: this._wrapCompartment.reconfigure(this.isWrapped ? EditorView.lineWrapping : [])
        });
      },

      applyLanguage(kind) {
        if (!this.view || this._currentLang === kind) return;
        this._currentLang = kind;
        const { javascript, htmlLang } = this._modules;
        const ext = kind === 'js' ? javascript() : kind === 'html' ? htmlLang() : [];
        this.view.dispatch({ effects: this._langCompartment.reconfigure(ext) });
      },

      async saveInput() {
        await window.persistence.save(PATH_INPUT, { input: this.input, isWrapped: this.isWrapped });
      },

      async detectType() {
        const { compression } = window;
        const effective = this.sel?.text || this.input;
        const det = compression.text.detectCompressionType(effective.trim());
        if (det) {
          this.inputType = `Compressed (${det.alg === 'brotli' ? 'Brotli' : 'Gzip'})`;
          this.applyLanguage('plain');
        } else if (await compression.acorn.isJS(effective)) {
          this.inputType = 'JavaScript';
          this.applyLanguage('js');
        } else {
          this.inputType = 'Text/HTML';
          this.applyLanguage('html');
        }
      },

      selectChunk(c) {
        if (!this.view) return;
        this.view.focus();
        this.view.dispatch({
          selection: { anchor: c.start, head: c.end },
          scrollIntoView: true
        });
      },

      clearSelection() {
        if (!this.view) return;
        const pos = this.view.state.selection.main.from;
        this.view.dispatch({ selection: { anchor: pos, head: pos } });
      }
    };
  });
});
