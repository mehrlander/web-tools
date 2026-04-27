document.addEventListener('alpine:init', function() {
  Alpine.data('compressInput', function(opts) {
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
          <textarea x-ref="input" x-model="input" @select="onSelect" @click="onSelect" @keyup="onSelect"
            :style="isWrapped ? '' : 'white-space:pre'"
            class="textarea flex-1 min-h-0 font-mono text-xs w-full resize-none"></textarea>
        </div>`,

      input: '',
      sel: null,
      chunks: [],
      isWrapped: true,
      inputType: 'Text',

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
          this.chunks = compression.text.findCompressedChunks(this.input);
          await this.detectType();

          messaging.publish(PATH_INPUT, 'change', this.input);

          this.$watch('input', () => {
            this.chunks = compression.text.findCompressedChunks(this.input);
            this.detectType();
            this.saveInput();
            messaging.publish(PATH_INPUT, 'change', this.input);
          });
          this.$watch('isWrapped', () => this.saveInput());
        })();
      },

      async saveInput() {
        await window.persistence.save(PATH_INPUT, { input: this.input, isWrapped: this.isWrapped });
      },

      async detectType() {
        const { compression } = window;
        const effective = this.sel?.text || this.input;
        const det = compression.text.detectCompressionType(effective.trim());
        if (det) this.inputType = `Compressed (${det.alg === 'brotli' ? 'Brotli' : 'Gzip'})`;
        else if (await compression.acorn.isJS(effective)) this.inputType = 'JavaScript';
        else this.inputType = 'Text/HTML';
      },

      onSelect() {
        requestAnimationFrame(() => {
          const el = this.$refs.input;
          if (el.selectionStart !== el.selectionEnd) {
            this.sel = {
              start: el.selectionStart,
              end:   el.selectionEnd,
              text:  this.input.slice(el.selectionStart, el.selectionEnd)
            };
          } else {
            this.sel = null;
          }
          this.detectType();
          window.messaging.publish(PATH_SEL, 'change', this.sel);
        });
      },

      selectChunk(c) {
        const el = this.$refs.input;
        el.focus();
        el.setSelectionRange(c.start, c.end);
        this.sel = { start: c.start, end: c.end, text: this.input.slice(c.start, c.end) };
        this.detectType();
        window.messaging.publish(PATH_SEL, 'change', this.sel);
      },

      clearSelection() {
        this.$refs.input.setSelectionRange(0, 0);
        this.sel = null;
        this.detectType();
        window.messaging.publish(PATH_SEL, 'change', this.sel);
      }
    };
  });
});
