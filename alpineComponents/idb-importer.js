// alpineComponents/idb-importer.js — modal for importing records from any
// IndexedDB database on this origin into a persistence.collection.
//
// Usage:
//   <div x-data="idbImporter({ target: 'dataShelf.items', onImported: n => loadItems() })"
//        x-ref="importer"></div>
//
//   $refs.importer.__importer.open()
//
// The component renders its own <dialog>, exposes `open()` / `close()` on
// the host element via $el.__importer, and walks the user through three
// steps: pick database → pick store → preview & import. Reads are done
// via persistence.idb (native IndexedDB, read-only); writes go through
// persistence.collection. No Dexie dependency.

document.addEventListener('alpine:init', function () {
  Alpine.data('idbImporter', function (opts) {
    opts = opts || {};

    return {
      template: `
        <dialog x-ref="modal" class="modal modal-bottom sm:modal-middle backdrop-blur-md" @close="onClose()">
          <div class="modal-box w-11/12 max-w-2xl flex flex-col p-0 overflow-hidden border border-base-300 bg-base-100 shadow-2xl">
            <div class="navbar bg-base-200/50 border-b border-base-300 px-4 min-h-12 shrink-0 gap-2">
              <div class="flex-none text-primary"><i class="ph-fill ph-tray-arrow-down-fill text-2xl"></i></div>
              <div class="flex-1">
                <h3 class="font-bold text-base">Import from IndexedDB</h3>
                <div class="text-[10px] font-mono opacity-50">→ <span x-text="target"></span></div>
              </div>
              <button @click="close()" class="btn btn-ghost btn-sm btn-square">
                <i class="ph ph-x"></i>
              </button>
            </div>

            <!-- step: pick database -->
            <div x-show="step === 'pick'" class="flex flex-col flex-1 min-h-0">
              <div class="px-4 py-3 text-xs uppercase font-bold opacity-50 tracking-widest">Databases on this origin</div>
              <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
                <div x-show="loading" class="flex justify-center py-12">
                  <span class="loading loading-spinner loading-md text-primary"></span>
                </div>
                <template x-for="db in databases" :key="db.name">
                  <button @click="loadStores(db.name)"
                          class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-base-300 hover:bg-base-200 hover:border-primary/50 transition-colors text-left">
                    <div class="flex items-center gap-2 min-w-0">
                      <i class="ph ph-database text-primary shrink-0"></i>
                      <span class="font-mono text-sm truncate" x-text="db.name"></span>
                      <span class="badge badge-ghost badge-xs" x-show="legacyHint(db.name)" x-text="legacyHint(db.name)"></span>
                    </div>
                    <span class="text-xs opacity-50 font-mono shrink-0" x-text="'v' + db.version"></span>
                  </button>
                </template>
                <div x-show="!loading && !databases.length" class="text-center text-sm opacity-50 italic py-8">
                  No databases found. Your browser may not support <code class="font-mono">indexedDB.databases()</code> (older Firefox).
                </div>
              </div>
            </div>

            <!-- step: pick store -->
            <div x-show="step === 'stores'" class="flex flex-col flex-1 min-h-0">
              <div class="flex items-center gap-2 px-4 py-2 border-b border-base-200">
                <button @click="step = 'pick'" class="btn btn-ghost btn-xs gap-1">
                  <i class="ph ph-arrow-left"></i> back
                </button>
                <span class="text-xs opacity-50 font-mono truncate" x-text="picked.db"></span>
              </div>
              <div class="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                <div x-show="loading" class="flex justify-center py-12">
                  <span class="loading loading-spinner loading-md text-primary"></span>
                </div>
                <template x-for="s in stores" :key="s">
                  <button @click="preview(s)"
                          class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-base-300 hover:bg-base-200 hover:border-primary/50 transition-colors text-left">
                    <div class="flex items-center gap-2 min-w-0">
                      <i class="ph ph-table text-secondary shrink-0"></i>
                      <span class="font-mono text-sm truncate" x-text="s"></span>
                    </div>
                    <span class="text-xs opacity-50 shrink-0">
                      <span x-text="storeCounts[s] ?? '?'"></span> records
                    </span>
                  </button>
                </template>
                <div x-show="!loading && !stores.length" class="text-center text-sm opacity-50 italic py-8">
                  No object stores in this database.
                </div>
              </div>
            </div>

            <!-- step: preview & import -->
            <div x-show="step === 'preview'" class="flex flex-col flex-1 min-h-0">
              <div class="flex items-center gap-2 px-4 py-2 border-b border-base-200">
                <button @click="step = 'stores'" class="btn btn-ghost btn-xs gap-1" :disabled="importing">
                  <i class="ph ph-arrow-left"></i> back
                </button>
                <span class="text-xs opacity-50 font-mono truncate">
                  <span x-text="picked.db"></span> / <span x-text="picked.store"></span>
                </span>
              </div>
              <div class="flex-1 overflow-y-auto px-4 py-3">
                <div class="text-sm mb-2">
                  Found <span class="font-bold text-primary" x-text="records.length"></span>
                  record<span x-show="records.length !== 1">s</span>.
                  <span class="opacity-50 text-xs ml-1" x-show="records.length">Sample below.</span>
                </div>
                <pre x-show="sample" class="bg-base-200 rounded-lg p-3 text-[11px] font-mono overflow-auto max-h-64 whitespace-pre-wrap" x-text="sample"></pre>
                <div x-show="result" class="mt-3 alert alert-success py-2 text-sm">
                  <i class="ph ph-check-circle"></i>
                  <span x-text="result"></span>
                </div>
              </div>
              <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-base-200 bg-base-50">
                <button @click="close()" class="btn btn-ghost btn-sm">Done</button>
                <button @click="doImport()" :disabled="importing || !records.length"
                        class="btn btn-primary btn-sm gap-2">
                  <span x-show="!importing"><i class="ph ph-tray-arrow-down"></i> Import <span x-text="records.length"></span></span>
                  <span x-show="importing"><span class="loading loading-spinner loading-xs"></span> Importing…</span>
                </button>
              </div>
            </div>
          </div>
        </dialog>`,

      target: opts.target || '',
      onImported: opts.onImported,

      step: 'pick',
      databases: [],
      stores: [],
      storeCounts: {},
      records: [],
      sample: '',
      picked: { db: '', store: '' },
      loading: false,
      importing: false,
      result: '',

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.$el.__importer = this;
      },

      async open() {
        this.step = 'pick';
        this.result = '';
        this.records = [];
        this.sample = '';
        this.loading = true;
        this.$refs.modal.showModal();
        try {
          const all = await persistence.idb.databases();
          // Sort: legacy hits first, then alphabetical.
          this.databases = all.sort((a, b) => {
            const al = this.legacyHint(a.name) ? 0 : 1;
            const bl = this.legacyHint(b.name) ? 0 : 1;
            return al - bl || a.name.localeCompare(b.name);
          });
        } catch (e) {
          console.error('importer: databases()', e);
        }
        this.loading = false;
      },

      close() { this.$refs.modal.close(); },
      onClose() { /* dialog close event — nothing to clean up */ },

      legacyHint(name) {
        if (name === 'DataJarDB') return 'legacy';
        if (name === 'DataShelfDB') return 'v1';
        return '';
      },

      async loadStores(dbName) {
        this.picked.db = dbName;
        this.loading = true;
        this.storeCounts = {};
        try {
          this.stores = await persistence.idb.stores(dbName);
          for (const s of this.stores) {
            this.storeCounts[s] = await persistence.idb.count(dbName, s).catch(() => '?');
          }
        } catch (e) {
          console.error('importer: stores()', e);
          this.stores = [];
        }
        this.loading = false;
        this.step = 'stores';
      },

      async preview(storeName) {
        this.picked.store = storeName;
        this.loading = true;
        this.result = '';
        try {
          this.records = await persistence.idb.readAll(this.picked.db, storeName);
          this.sample = this.records.slice(0, 3)
            .map(r => JSON.stringify(r, null, 2))
            .join('\n\n');
        } catch (e) {
          console.error('importer: readAll()', e);
          this.records = [];
          this.sample = String(e?.message || e);
        }
        this.loading = false;
        this.step = 'preview';
      },

      async doImport() {
        if (!this.target || !this.records.length) return;
        this.importing = true;
        const col = persistence.collection(this.target);
        let imported = 0, skipped = 0;
        for (const r of this.records) {
          try { await col.put(r); imported++; }
          catch (e) { skipped++; console.error('importer: put', e); }
        }
        this.importing = false;
        this.result = `Imported ${imported} record${imported === 1 ? '' : 's'}` +
                      (skipped ? `, skipped ${skipped}.` : '.');
        Alpine.store('toast')?.('check-circle', `Imported ${imported}`, 'alert-success', 2000);
        this.onImported?.(imported);
      }
    };
  });
});
