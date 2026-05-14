window.LinkKit = {
  FILE_LINKS: [
    { l: 'GitHub',     i: 'ph-github-logo',      u: 'https://github.com/{repo}/blob/{ref}/{path}' },
    { l: 'Raw',        i: 'ph-file-text',        u: 'https://raw.githubusercontent.com/{repo}/{ref}/{path}' },
    { l: 'CDN',        i: 'ph-cloud-arrow-down', u: 'https://cdn.jsdelivr.net/gh/{repo}@{ref}/{path}' },
    { l: 'github.dev', i: 'ph-pencil-simple',    u: 'https://github.dev/{repo}/blob/{ref}/{path}' },
    { l: 'show-repo',  i: 'ph-tree-structure',   u: '{showRepoBase}?repo={repo}&ref={ref}&file={path}' }
  ],
  REPO_LINKS: [
    { l: 'GitHub',         i: 'ph-github-logo',      u: 'https://github.com/{repo}/tree/{ref}' },
    { l: 'jsDelivr CDN',   i: 'ph-cloud-arrow-down', u: 'https://cdn.jsdelivr.net/gh/{repo}@{ref}/' },
    { l: 'Flat tree JSON', i: 'ph-tree-structure',   u: 'https://data.jsdelivr.com/v1/packages/gh/{repo}@{ref}?structure=flat' }
  ],
  fill(kit, vars) {
    return kit.map(e => ({
      ...e,
      u: e.u.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
    }));
  }
};

document.addEventListener('alpine:init', function() {
  Alpine.data('linksList', function() {
    return {
      template: `
        <div class="flex flex-col gap-1.5">
          <template x-for="link in links" :key="link.u">
            <div class="flex items-center bg-base-200 rounded-lg overflow-hidden">
              <a :href="link.u" target="_blank" class="flex-1 flex items-center gap-2.5 px-3 py-2 min-w-0 hover:bg-base-300">
                <i class="ph shrink-0 text-sm" :class="link.i"></i>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-semibold leading-tight" x-text="link.l"></span>
                  <span class="text-[10px] font-mono opacity-50 truncate leading-tight mt-0.5" x-text="link.u.replace('https://','')"></span>
                </div>
              </a>
              <button class="px-3 py-2 border-l border-base-300 hover:bg-base-300" @click="$clip(link.u)">
                <i class="ph ph-copy text-sm opacity-40"></i>
              </button>
            </div>
          </template>
        </div>`,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
      }
    };
  });
});
