document.addEventListener('alpine:init', function() {
  Alpine.data('compressOutput', function(opts) {
    opts = opts || {};
    const ns = opts.path || 'compress-helper';
    const PATH_INPUT  = ns + '.input';
    const PATH_OUTPUT = ns + '.output';
    const PATH_SEL    = ns + '.sel';

    const { tip, lines } = window.fills;
    const tog = (model, label, header, lns) => tip(
      ['bottom', 'xs'],
      `<label class="flex items-center gap-1"><input type="checkbox" x-model="${model}" class="checkbox checkbox-xs">${label}</label>`,
      `<strong>${header}</strong>${lines(['xs'], lns)}`
    );

    return {
      template: `
        <div class="absolute inset-0 flex flex-col">
          <div class="flex flex-wrap items-center gap-3 mb-2 flex-none">
            <b>Output</b>
            <a :href="output" class="link link-primary" draggable="true" x-text="name"></a>
            <input x-model="name" @change="saveOpts()" class="input input-xs w-24" placeholder="Name">
            <div class="ml-auto flex flex-wrap items-center gap-3">
              <span>${tog('compressed','Compressed','Toggle Brotli (BR64:) or Gzip (GZ64:) → Base64 → prefix',['• Has prefix: Uncheck to decompress','• No prefix: Check to compress','Applied before packing'])}</span>
              <select x-model="alg" :disabled="inComp" class="select select-xs w-auto" :class="inComp && 'opacity-50'">
                <option value="brotli">Brotli</option>
                <option value="gzip">Gzip</option>
              </select>
              <input x-model="label" :disabled="!compressed||inComp" @change="saveOpts()" class="input input-xs w-24" :class="(!compressed||inComp) && 'opacity-50'" placeholder="Label">
              <span>${tog('packed','Packed','Wraps in javascript:() IIFE',['• JavaScript: Executes directly with eval()','• HTML/Text: Opens content in new window','Adds decompression if compressed'])}</span>
              <select x-model="format" :disabled="!packed" class="select select-xs w-auto" :class="!packed && 'opacity-50'">
                <option value="popup">Popup</option>
                <option value="tab">New Tab</option>
              </select>
              <button @click="copyOutput" class="btn btn-xs btn-primary" x-text="copyText"></button>
            </div>
          </div>
          <div class="flex gap-4 text-xs mb-2 flex-none">
            <span class="text-info">■ packing</span>
            <span class="bg-warning/20 text-warning-content px-1">■ payload</span>
            <span class="opacity-60 ml-auto" x-text="metrics"></span>
          </div>
          <pre tabindex="0" @click="$el.focus()"
            @keydown.ctrl.a.prevent="selectAllPre($el)"
            @keydown.meta.a.prevent="selectAllPre($el)"
            class="flex-1 min-h-0 p-3 text-xs rounded-box bg-base-200 overflow-auto whitespace-pre-wrap break-all focus:outline-none focus:ring focus:ring-primary/30"
            ><template x-for="s in packingSegments"><span :class="cls[s.t]" x-text="s.v"></span></template></pre>
        </div>`,

      name: 'Test',
      compressed: true,
      packed: true,
      alg: 'gzip',
      format: 'popup',
      label: '',
      input: '',
      sel: null,
      output: '',
      packingSegments: [],
      metrics: '',
      inComp: false,
      copyText: 'Copy',
      cls: { packing: 'text-info', payload: 'bg-warning/20', error: 'text-error bg-error/10' },

      init() {
        const { messaging, persistence } = window;

        this.$root.__compressOutput = this;

        messaging.subscribe(PATH_INPUT, (_, text) => {
          if (text === this.input) return;
          this.input = text;
          this.process();
        });
        messaging.subscribe(PATH_SEL, (_, sel) => {
          this.sel = sel;
          this.process();
        });

        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));

        (async () => {
          const saved = await persistence.load(PATH_OUTPUT);
          if (saved) ['name','compressed','packed','alg','format','label'].forEach(k => {
            if (k in saved) this[k] = saved[k];
          });
          if (!this.input) {
            const inp = await persistence.load(PATH_INPUT);
            if (inp?.input) this.input = inp.input;
          }
          ['compressed','packed','alg','format','label'].forEach(p => {
            this.$watch(p, () => { this.process(); this.saveOpts(); });
          });
          await this.process();
        })();
      },

      async saveOpts() {
        await window.persistence.save(PATH_OUTPUT, {
          name: this.name, compressed: this.compressed, packed: this.packed,
          alg: this.alg, format: this.format, label: this.label
        });
      },

      selectAllPre(el) {
        const r = document.createRange(); r.selectNodeContents(el);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      },

      async process() {
        if (!this.input.trim()) {
          this.output = ''; this.packingSegments = []; this.metrics = ''; this.inComp = false; return;
        }
        const effective = this.sel?.text || this.input;
        try {
          const r = await window.compression.text.process(effective, {
            compressed: this.compressed, packed: this.packed, alg: this.alg,
            popup: this.format === 'popup', label: this.label
          });
          this.inComp = r.isCompressed;
          this.output = r.output;
          this.packingSegments = r.packingSegments;
          this.metrics = `Raw:${r.sizes.raw} Br:${r.sizes.brotli} Gz:${r.sizes.gzip} Out:${r.outSize}`;
        } catch (e) {
          console.error(e);
          this.output = 'Error: ' + e.message;
          this.packingSegments = [{ t: 'error', v: 'Error: ' + e.message }];
        }
      },

      async copyOutput() {
        try {
          await navigator.clipboard.writeText(this.output);
          this.copyText = 'Copied!';
          setTimeout(() => this.copyText = 'Copy', 2000);
        } catch (e) { console.error(e); }
      }
    };
  });
});
