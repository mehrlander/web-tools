const ViewRegistry = {
  _loadedAssets: new Set(),
  loadAsset(url) {
    if (this._loadedAssets.has(url)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const isCSS = url.includes('.css');
      const el = document.createElement(isCSS ? 'link' : 'script');
      if (isCSS) Object.assign(el, { rel: 'stylesheet', href: url });
      else Object.assign(el, { src: url, async: true });
      el.onload = () => { this._loadedAssets.add(url); resolve(); };
      el.onerror = () => reject(new Error(`Load failed: ${url}`));
      document.head.appendChild(el);
    });
  },
  esc: (s) => new Option(String(s ?? '')).innerHTML,
  modules: [
    {
      id: 'raw', label: 'Raw', icon: 'ph-text-t',
      test: () => true,
      render: (f) => `<pre class="m-0 p-4 h-full overflow-auto text-xs leading-5 font-mono whitespace-pre-wrap text-base-content">${ViewRegistry.esc(f.content)}</pre>`
    },
    {
      id: 'code', label: 'Code', icon: 'ph-code',
      assets: [
        'https://cdn.jsdelivr.net/combine/npm/prismjs/themes/prism.min.css',
        'https://cdn.jsdelivr.net/combine/npm/prismjs/prism.min.js,npm/prismjs/plugins/autoloader/prism-autoloader.min.js'
      ],
      test: (f) => ['js','ts','py','sh','html','md','json','yml','css','rb','rs','go','java','cpp','c','sql','xml'].includes(f.ext),
      render: (f) => `<div class="bg-[#f5f2f0] h-full overflow-hidden"><pre class="!m-0 !p-4 !bg-transparent h-full overflow-auto !text-xs leading-5"><code class="language-${f.ext}">${ViewRegistry.esc(f.content)}</code></pre></div>`,
      after: () => {
        if (window.Prism) {
          Prism.plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism/components/';
          Prism.highlightAll();
        }
      }
    },
    {
      id: 'preview', label: 'Preview', icon: 'ph-eye',
      test: (f) => ['md', 'html'].includes(f.ext),
      assets: ['https://cdn.jsdelivr.net/npm/marked/marked.min.js'],
      render: (f) => {
        if (f.ext === 'html') {
          const blob = new Blob([f.content], { type: 'text/html' });
          return `<iframe src="${URL.createObjectURL(blob)}" class="w-full h-full bg-white" sandbox="allow-scripts allow-modals"></iframe>`;
        }
        return `<div class="overflow-auto prose prose-sm max-w-none px-6 py-4 bg-base-100 h-full w-full">${marked.parse(f.content)}</div>`;
      }
    },
    {
      id: 'table', label: 'Table', icon: 'ph-table',
      assets: [
        'https://unpkg.com/tabulator-tables@6.3.0/dist/css/tabulator_simple.min.css',
        'https://unpkg.com/tabulator-tables@6.3.0/dist/js/tabulator.min.js'
      ],
      test: (f) => f.ext === 'json' && f.content.trim().startsWith('['),
      render: () => `<div class="flex flex-col h-full w-full">
        <div class="flex items-center gap-4 px-3 py-1.5 border-b border-base-300 bg-base-200/50 text-xs shrink-0">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" id="tab-header-filters" class="checkbox checkbox-xs" checked>
            <span>Header filters</span>
          </label>
        </div>
        <div id="tab-target" class="flex-1 min-h-0"></div>
      </div>`,
      after: (f) => {
        requestAnimationFrame(() => {
          const target = document.getElementById('tab-target');
          if (!target) return;
          try {
            const h = target.clientHeight || 500;
            const table = new Tabulator(target, {
              data: JSON.parse(f.content),
              autoColumns: true,
              autoColumnsDefinitions: (defs) => defs.map(d => ({ ...d, headerFilter: 'input' })),
              layout: "fitData",
              height: h + "px"
            });
            const headerFilters = document.getElementById('tab-header-filters');
            headerFilters.addEventListener('change', () => {
              target.querySelectorAll('.tabulator-header-filter').forEach(el => {
                el.style.display = headerFilters.checked ? '' : 'none';
              });
              table.redraw(true);
            });
          } catch (e) {
            target.innerHTML = `<div class="p-4 text-error font-mono text-xs">Invalid JSON Array for Table View</div>`;
          }
        });
      }
    },
    {
      id: 'codepen', label: 'CodePen', icon: 'ph-codepen-logo',
      test: (f) => ['html', 'js', 'css'].includes(f.ext),
      assets: ['https://public.codepenassets.com/embed/index.js'],
      render: (f) => {
        const lang = ['html','css','js'].includes(f.ext) ? f.ext : 'html';
        return `<div id="cpBox" class="h-full w-full bg-base-100">
          <div class="codepen" data-version="2" data-prefill data-height="100%" data-theme-id="light" data-default-tab="${lang},result" style="height:100%; display:flex; align-items:center; justify-content:center;">
            <pre data-lang="${lang}">${ViewRegistry.esc(f.content)}</pre>
          </div>
        </div>`;
      },
      after: () => {
        if (window.__CPEmbed) {
          const box = document.getElementById('cpBox');
          if (box) {
            const h = box.offsetHeight || box.parentElement.offsetHeight;
            const embed = box.querySelector('.codepen');
            if (h > 0) embed.setAttribute('data-height', h);
            __CPEmbed('#cpBox .codepen');
          }
        }
      }
    }
  ],
  getModes(file) { return this.modules.filter(m => m.test(file)); },
  async prepare(moduleId) {
    const mod = this.modules.find(m => m.id === moduleId);
    if (mod?.assets) await Promise.all(mod.assets.map(asset => this.loadAsset(asset)));
    return mod;
  }
};

document.addEventListener('alpine:init', function() {
  Alpine.data('viewer', function(opts) {
    opts = opts || {};
    return {
      template: `
        <div class="flex items-center justify-between mb-2" x-show="file">
          <span class="text-xs text-base-content/50 font-mono" x-text="stats"></span>
          <div class="flex items-center gap-0.5">
            <button @click="openUrls()" class="btn btn-sm btn-square btn-ghost hover:text-primary" title="Open file links">
              <i class="ph text-lg ph-arrow-square-out"></i>
            </button>
            <button x-show="showCopy" @click="copy()" class="btn btn-sm btn-square btn-ghost hover:text-primary">
              <i class="ph text-lg" :class="copied ? 'ph-check' : 'ph-copy'"></i>
            </button>
            <details class="dropdown dropdown-end" data-auto-close>
              <summary class="btn btn-sm btn-square btn-ghost hover:text-primary">
                <i class="ph text-lg" :class="modeIcon"></i>
              </summary>
              <ul class="dropdown-content z-[1] menu p-2 shadow-lg bg-base-200 rounded-box w-32 mt-1 border border-base-300">
                <template x-for="m in availableModes">
                  <li><a @click="switchMode(m.id)" :class="mode === m.id ? 'active' : ''">
                    <i class="ph" :class="m.icon"></i>
                    <span x-text="m.label"></span>
                  </a></li>
                </template>
              </ul>
            </details>
          </div>
        </div>
        <div x-show="viewLoading" class="flex justify-center py-20">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
        <div x-show="!viewLoading" class="h-[calc(100vh-180px)] border border-base-300 rounded-lg bg-base-100 overflow-hidden">
          <div class="h-full" x-html="viewHtml"></div>
        </div>
        <dialog class="viewer-urls modal" onclick="if(event.target===this)this.close()">
          <div class="modal-box shadow-none border border-base-300 bg-base-100 p-4 max-w-lg">
            <div class="mb-1 px-1 font-mono text-sm font-bold" x-text="repo"></div>
            <div x-show="file" class="mb-3 px-1 font-mono text-xs text-base-content/60 truncate" x-text="file"></div>
            <div x-data="linksList()"></div>
            <div class="modal-action mt-3"><button @click="$root.querySelector('dialog.viewer-urls').close()" class="btn btn-ghost btn-sm text-xs">Done</button></div>
          </div>
        </dialog>`,

      file: '',
      content: '',
      mode: '',
      viewLoading: false,
      commits: [],
      commitsFor: '',
      showCopy: opts.copy !== false,
      copied: false,

      init() {
        this.$root.__viewer = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.$watch(
          () => Alpine.store('browser').activeFile,
          (f) => { if (f) this.show(f.path, f.content); }
        );
      },

      get repo() { return Alpine.store('browser').repo; },
      get ref() { return Alpine.store('browser').ref || 'main'; },
      get ext() { return this.file ? this.file.split('.').pop().toLowerCase() : ''; },
      get fileContext() { return { name: this.file, ext: this.ext, content: this.content }; },
      get availableModes() { return ViewRegistry.getModes(this.fileContext); },
      get modeIcon() {
        const mod = ViewRegistry.modules.find(m => m.id === this.mode);
        return mod ? mod.icon : 'ph-text-t';
      },
      get stats() {
        if (!this.content) return '';
        return this.content.split('\n').length + ' lines · ' + (new Blob([this.content]).size / 1024).toFixed(1) + ' KB';
      },
      get viewHtml() {
        if (!this.file || !this.content) return '';
        const mod = ViewRegistry.modules.find(m => m.id === this.mode) || ViewRegistry.modules[0];
        return mod.render(this.fileContext);
      },
      get links() {
        if (!this.repo || !this.file) return [];
        return LinkKit.fill(LinkKit.FILE_LINKS, {
          repo: this.repo,
          ref: this.ref,
          path: this.file,
          showRepoBase: 'https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html'
        });
      },

      async show(file, content) {
        this.file = file;
        this.content = content;
        this.commits = [];
        this.commitsFor = '';
        this.viewLoading = true;
        const modes = this.availableModes;
        const preferred = modes.find(m => m.id === 'raw');
        await this.switchMode(preferred ? preferred.id : modes[0].id);
      },

      async switchMode(id) {
        this.viewLoading = true;
        const mod = await ViewRegistry.prepare(id);
        this.mode = id;
        this.$nextTick(() => {
          if (mod.after) mod.after(this.fileContext);
          this.viewLoading = false;
        });
      },

      openUrls() {
        const el = this.$root.querySelector('dialog.viewer-urls');
        if (el) el.showModal();
      },

      async copy() {
        if (!this.content) return;
        await navigator.clipboard.writeText(this.content);
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 1500);
      }
    };
  });
});
