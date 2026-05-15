// alpineComponents/idb-tree.js — sidebar tree of IndexedDB databases on this
// origin, with store counts and a filter.
//
// Usage:
//   <div x-data="idbTree({
//     onSelect: (db, store) => doSomething(db, store),
//     selectedDb: 'MyDB', selectedStore: 'items'   // optional initial highlight
//   })"></div>
//
// The component is read-only — it scans via persistence.idb and emits a
// selection callback. The caller decides what to do with the picked store.
// Call `tree.refresh()` (via `el.__idbTree`) after writes from elsewhere
// to re-pull counts.

document.addEventListener('alpine:init', function () {
  Alpine.data('idbTree', function (opts) {
    opts = opts || {};

    return {
      template: `
        <div class="flex flex-col h-full">
          <div class="p-3 border-b border-base-300">
            <input type="text" x-model="filter" placeholder="Search databases or stores…"
                   class="input input-sm input-ghost w-full">
          </div>
          <div class="flex-1 overflow-y-auto p-3 space-y-3">
            <div x-show="loading" class="flex justify-center py-12">
              <span class="loading loading-spinner loading-md text-primary"></span>
            </div>
            <template x-for="db in visibleDBs" :key="db.name">
              <div>
                <div class="flex items-center gap-1.5 mb-1">
                  <h2 class="font-bold truncate" x-text="db.name"></h2>
                  <span class="badge badge-sm opacity-60 shrink-0" x-text="'v' + db.version"></span>
                </div>
                <div class="space-y-0.5">
                  <template x-for="s in db.stores" :key="s.name">
                    <button class="w-full text-left px-2 py-1 rounded hover:bg-base-200 transition-colors"
                            :class="isSelected(db.name, s.name) ? 'bg-base-200' : ''"
                            @click="select(db.name, s.name)">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-medium truncate" x-text="s.name"></span>
                        <span class="badge badge-sm badge-ghost shrink-0" x-text="s.count"></span>
                      </div>
                      <div class="text-sm opacity-60 truncate" x-text="keyDesc(s)"></div>
                    </button>
                  </template>
                </div>
              </div>
            </template>
            <div x-show="!loading && !databases.length"
                 class="text-center text-sm opacity-50 italic py-8">
              No databases on this origin.
            </div>
            <div x-show="!loading && databases.length && !visibleDBs.length"
                 class="text-center text-sm opacity-50 italic py-8">
              No matches.
            </div>
          </div>
        </div>`,

      databases: [],
      filter: '',
      loading: false,
      onSelect: opts.onSelect || (() => {}),
      selectedDb: opts.selectedDb || null,
      selectedStore: opts.selectedStore || null,

      init() {
        this.$root.__idbTree = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(async () => {
          Alpine.initTree(this.$el);
          await this.refresh();
        });
      },

      get visibleDBs() {
        const f = this.filter.toLowerCase();
        return this.databases.flatMap((db) => {
          const stores = f
            ? db.stores.filter(s => db.name.toLowerCase().includes(f) || s.name.toLowerCase().includes(f))
            : db.stores;
          return stores.length ? [{ name: db.name, version: db.version, stores }] : [];
        });
      },

      keyDesc(s) {
        const k = Array.isArray(s.keyPath) ? `[${s.keyPath.join('+')}]` : s.keyPath;
        return `${s.autoIncrement ? '++' : ''}${k}`;
      },

      isSelected(dbName, storeName) {
        return this.selectedDb === dbName && this.selectedStore === storeName;
      },

      select(dbName, storeName) {
        this.selectedDb = dbName;
        this.selectedStore = storeName;
        this.onSelect(dbName, storeName);
      },

      async refresh() {
        this.loading = true;
        try {
          const dbs = await persistence.idb.databases();
          const out = [];
          for (const { name, version } of dbs) {
            if (!name) continue;
            const stores = await persistence.idb.storesDetail(name).catch(() => []);
            out.push({ name, version, stores });
          }
          this.databases = out.sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
          console.error('idb-tree: refresh', e);
          this.databases = [];
        }
        this.loading = false;
      }
    };
  });
});
