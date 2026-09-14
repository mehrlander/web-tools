// lib/alpineComponents/xlsx-picker.js — the reactive wrapper over
// kits/xlsx-write.js. The kit holds every decision about what a rebuild costs;
// this holds a selection, a plan that is recomputed as the selection changes,
// and the resulting file.
//
// A KIT WANTING ALPINE REACTIVITY GETS A COMPONENT WRAPPER RATHER THAN
// BECOMING ONE (docs/code-layers.md). Nothing here reads a zip or writes a
// part. The one thing it does own is re-planning on every tick: plan() is
// pure and synchronous, so the sheet list can say which parts leave and which
// pivot is about to be orphaned BEFORE the rebuild runs, which is the whole
// reason the plan is separate from the rebuild in the first place.
(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.data('xlsxPicker', () => ({
      file: null,          // { name, bytes }
      read: null,          // kits/xlsx.js readZip result
      partNames: [],
      plan: null,
      keep: [],            // sheet display names
      grafts: [],          // graft ids the reader has left ticked
      busy: '',            // '' | 'reading' | 'rebuilding'
      error: '',
      result: null,        // { bytes, manifest, suffix, mime }
      elapsed: 0,
      dragging: false,

      get ready() { return !!this.plan && !this.busy; },
      get canBuild() { return this.ready && this.keep.length > 0; },
      get sheets() { return this.plan?.sheets ?? []; },
      get available() { return (this.plan?.grafts ?? []).filter(g => g.available); },
      get refused() {
        // A graft the reader cannot take, and why. The pivot is the case that
        // matters: it is refused because its cache reads a sheet that is not
        // kept, and saying so beside the checkbox is the difference between a
        // disabled control and an explained one.
        return (this.plan?.grafts ?? []).flatMap(g => g.blocked || []);
      },

      // ---- opening ------------------------------------------------------

      async pick(event) {
        const f = event.target.files?.[0];
        if (f) await this.open(f);
        event.target.value = '';
      },

      async drop(event) {
        this.dragging = false;
        const f = event.dataTransfer?.files?.[0];
        if (f) await this.open(f);
      },

      async open(f) {
        this.reset();
        this.busy = 'reading';
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const JSZipLib = window.JSZip ?? (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
          const zip = await JSZipLib.loadAsync(bytes);
          this.partNames = Object.keys(zip.files).filter(p => !zip.files[p].dir).sort();
          this.read = await window.xlsxKit.readZip(bytes);
          this.file = { name: f.name, bytes };
          // Everything on by default: the reader subtracts, which matches what
          // they came to do.
          this.keep = Object.values(this.read.xl.sheets)
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(s => s.name);
          this.replan();
          this.grafts = this.available.map(g => g.id);
        } catch (e) {
          this.error = /zip|End of|corrupt/i.test(e.message)
            ? `${f.name} did not open as a workbook. A .xlsx is a ZIP, so a truncated or renamed file fails here.`
            : e.message;
        } finally {
          this.busy = '';
        }
      },

      reset() {
        Object.assign(this, { file: null, read: null, partNames: [], plan: null,
                              keep: [], grafts: [], error: '', result: null, elapsed: 0 });
      },

      // ---- selection ----------------------------------------------------

      toggle(name) {
        this.keep = this.keep.includes(name) ? this.keep.filter(n => n !== name) : [...this.keep, name];
        this.replan();
      },

      only(name) {
        this.keep = [name];
        this.replan();
      },

      all() {
        this.keep = this.sheets.map(s => s.name);
        this.replan();
      },

      replan() {
        if (!this.read) return;
        this.result = null;
        this.plan = window.xlsxWriteKit.plan(this.read, this.partNames, this.keep);
        // A graft can stop being available when the selection changes (the
        // pivot whose cache source was just unticked), so the ticks follow.
        const live = new Set(this.available.map(g => g.id));
        this.grafts = this.grafts.filter(id => live.has(id));
      },

      toggleGraft(id) {
        this.grafts = this.grafts.includes(id) ? this.grafts.filter(g => g !== id) : [...this.grafts, id];
        this.result = null;
      },

      // ---- rebuilding ---------------------------------------------------

      async build() {
        if (!this.canBuild) return;
        this.busy = 'rebuilding';
        this.error = '';
        this.result = null;
        const started = Date.now();
        // One frame before the work starts, or the spinner never paints: the
        // rebuild holds the main thread, and on the largest workbook measured
        // here (94,450 cells) it holds it for about 49 seconds.
        await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
        try {
          this.result = await window.xlsxWriteKit.rebuild(this.file.bytes, this.keep, { grafts: this.grafts });
          this.elapsed = Date.now() - started;
        } catch (e) {
          this.error = e.message;
          this.__stack = e.stack;
        } finally {
          this.busy = '';
        }
      },

      get outName() {
        const stem = (this.file?.name || 'workbook').replace(/\.xls[xm]$/i, '');
        return `${stem}-${this.keep.length}-sheets.${this.result?.suffix ?? 'xlsx'}`;
      },

      save() {
        if (!this.result) return;
        this.offer(new Blob([this.result.bytes], { type: this.result.mime }), this.outName);
      },

      saveManifest() {
        if (!this.result) return;
        const text = window.xlsxWriteKit.manifestText(this.result.manifest);
        this.offer(new Blob([text], { type: 'text/markdown' }), this.outName.replace(/\.xls[xm]$/, '-manifest.md'));
      },

      offer(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: name });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },

      // ---- reading the result -------------------------------------------

      // EVERY VALUE THE TEMPLATE READS COMES THROUGH A GETTER, and that is a
      // correctness rule rather than tidiness. Alpine evaluates an element's
      // bindings whether or not `x-show` has hidden it, so `x-text="result.suffix"`
      // on a hidden button throws on every tick until a rebuild exists. The
      // first render of this page produced six such errors, none of them
      // visible, and the page still looked right.
      get manifest() { return this.result?.manifest ?? null; },
      get suffix() { return this.result?.suffix ?? 'xlsx'; },
      get partsLeaving() { return this.plan?.partsLeaving ?? []; },
      get droppedCount() { return this.plan?.dropped?.length ?? 0; },
      get droppedLine() {
        const n = this.droppedCount;
        return `${n} sheet${n === 1 ? '' : 's'} dropped`;
      },
      get cellLoss() { return this.manifest?.cellLoss ?? null; },
      get log() { return this.manifest?.log ?? []; },
      get outLine() { return this.manifest ? `${this.manifest.kept.join(', ')} → ${this.outName}` : ''; },
      get rows() { return this.manifest?.rows ?? []; },
      get problems() { return this.manifest?.checks?.problems ?? []; },
      get passed() { return !!this.manifest?.checks?.ok; },

      kb(n) { return `${(n / 1024).toFixed(1)} KB`; },

      // The header's one compact line. A figure belongs here rather than in a
      // row of tiles (the house style's first rule), so this is the only place
      // the page states a count on its own.
      get summary() {
        if (!this.plan) return '';
        const hidden = this.sheets.filter(s => s.visibility !== 'visible').length;
        return [
          `${this.keep.length} of ${this.sheets.length} sheets`,
          hidden ? `${hidden} hidden` : null,
          `${this.partNames.length} parts`,
          this.kb(this.file.bytes.length),
          this.result ? `→ ${this.kb(this.result.bytes.length)} in ${this.manifest.output.parts} parts` : null,
        ].filter(Boolean).join(' · ');
      },
    }));
  });
})();
