document.addEventListener('alpine:init', () => {
  Alpine.data('localWork', () => ({
    snapshot: null, busy: false, error: '', pane: 'checkouts',
    async init() {
      this.$el.innerHTML = `
        <section class="min-w-0 py-3" aria-label="Local work">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="text-lg font-semibold">Local work</h2>
            <span class="text-sm text-base-content/60" x-text="observation"></span>
            <button class="btn btn-sm btn-ghost" @click="load()" :disabled="busy">Read latest</button>
            <a class="link text-sm" :href="sourceUrl" target="_blank">GitHub observation</a>
            <a class="link text-sm" href="?view=tending">Tending findings</a>
          </div>
          <p class="mt-2 text-sm text-base-content/65">File counts describe the laptop at the observation time. The inventory preserves no working-file contents. A pushed branch may still need incorporation.</p>
          <p class="my-3 text-sm text-error" role="status" x-show="error" x-text="error"></p>
          <p class="my-3 text-sm" x-show="busy">Reading the private observation…</p>
          <template x-if="snapshot">
            <div>
              <p class="mt-2 text-sm" x-show="!snapshot.coverage?.complete">Directory coverage is incomplete. Unseen folders have not been cleared.</p>
              <div class="my-3 flex flex-wrap gap-1" role="tablist">
                <template x-for="p in ['checkouts','conversations','standalone']" :key="p">
                  <button class="btn btn-sm" :class="pane === p ? 'btn-primary' : 'btn-ghost'" @click="pane=p" :aria-selected="pane === p" role="tab" x-text="p === 'checkouts' ? 'Checkouts' : p === 'conversations' ? 'Conversations' : 'Standalone files'"></button>
                </template>
              </div>
              <div x-show="pane === 'checkouts'">
                <p class="mb-2 text-sm text-base-content/60" x-text="visible.length + ' checkouts; ' + stashes + ' observed stashes across shared Git stores'"></p>
                <template x-for="row in visible" :key="row.id">
                  <article class="border-t border-base-200 py-3 break-words">
                    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <a x-show="row.repo" class="link font-medium" :href="repoUrl(row)" x-text="row.repo" target="_blank"></a>
                      <span x-show="!row.repo" class="font-medium" x-text="row.path.split('/').pop()"></span>
                      <span class="font-mono text-sm" x-text="row.scope + '/' + row.path"></span>
                      <span class="font-mono text-sm text-base-content/60" x-text="row.branch || 'Branch unavailable'"></span>
                    </div>
                    <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span x-text="'Commit publication: ' + window.LocalWork.preservation(row)"></span>
                      <span x-text="window.LocalWork.integration(row)"></span>
                      <span x-text="count(row.changed) + ' changed · ' + count(row.untracked) + ' untracked · ' + count(row.ignored) + ' ignored entries'"></span>
                      <span class="font-medium" x-show="row.changed || row.untracked">Working-file changes remain local</span>
                    </div>
                    <p class="mt-1 text-xs text-base-content/60" x-text="row.checkedAt ? 'GitHub checked ' + when(row.checkedAt) : 'GitHub comparison has not been recorded'"></p>
                    <p class="text-sm font-medium" x-show="row.state !== 'ready' || row.notice" x-text="row.notice || 'Checkout could not be read'"></p>
                    <div class="mt-1 flex flex-wrap gap-3">
                      <template x-for="session in row.sessions || []" :key="session.id">
                        <a class="link text-sm line-clamp-2" :href="window.LocalWork.sessionUrl(session.id)" :title="session.title" x-text="session.provider + ': ' + session.title"></a>
                      </template>
                    </div>
                  </article>
                </template>
              </div>
              <div x-show="pane === 'conversations'">
                <template x-for="coverage in snapshot.coverage?.sessions || []" :key="coverage.provider">
                  <p class="mb-2 text-sm" x-text="coverage.provider + ': ' + (coverage.captured ?? '?') + ' prose records from ' + (coverage.examined ?? '?') + ' examined / ' + (coverage.catalog ?? '?') + ' catalog entries; ' + (coverage.unavailable ?? '?') + ' unavailable' + (coverage.limited ? '; catalog limit reached' : '')"></p>
                </template>
                <template x-for="session in snapshot.sessions || []" :key="session.id">
                  <article class="border-t border-base-200 py-2 break-words">
                    <a class="link" :href="window.LocalWork.sessionUrl(session.id)" x-text="session.title"></a>
                    <p class="text-sm text-base-content/60" x-text="session.provider + ' · ' + session.ended + ' · ' + session.capture.state + ' (' + session.capture.source + ')'"></p>
                  </article>
                </template>
              </div>
              <div x-show="pane === 'standalone'">
                <p class="mb-2 text-sm text-base-content/60">These folders hold local files outside a discovered checkout. Presence does not establish whether another copy exists online. Ignored files are not automatically disposable.</p>
                <template x-for="item in snapshot.standalone || []" :key="item.scope + ':' + item.path">
                  <article class="border-t border-base-200 py-2 break-words">
                    <p class="font-mono text-sm" x-text="item.scope + '/' + (item.path || '')"></p>
                    <p class="text-sm" x-text="item.state === 'unavailable' ? 'Folder unavailable' : item.files + ' immediate files: ' + item.examples.join(', ')"></p>
                  </article>
                </template>
              </div>
            </div>
          </template>
        </section>`;
      this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
      if (!window.LocalWork) await window.gh.load('kits/local-work.js');
      await this.load();
    },
    get store() { return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
    get sourceUrl() { return window.RepoAddress.github.blob(this.store, 'background', 'state/local-work.json'); },
    get observation() { return this.snapshot ? window.LocalWork.freshness(this.snapshot) + ': ' + this.when(this.snapshot.observedAt) : ''; },
    get visible() { return window.LocalWork.rows(this.snapshot, this.activityQuery || ''); },
    get stashes() { return (this.snapshot?.stores || []).reduce((n, s) => n + (s.stashes || 0), 0); },
    count(n) { return Number.isInteger(n) ? n : '?'; },
    when(value) { return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'time unavailable'; },
    repoUrl(row) { return /^[\w.-]+\/[\w.-]+$/.test(row.repo || '') ? window.RepoAddress.github.repo(row.repo) : ''; },
    async load() {
      if (this.busy) return;
      this.busy = true; this.error = '';
      try {
        const client = new window.GH({ token: window.TOKEN, repo: this.store, ref: 'background' });
        const value = JSON.parse((await client.get('state/local-work.json', window.GH.FRESH)).text);
        if (value.schema !== 1 || !Array.isArray(value.checkouts)) throw new Error('format');
        this.snapshot = value;
      } catch {
        this.error = this.snapshot ? 'The latest observation is unavailable. Showing the previous observation.' : 'No readable local-work observation. Connect GitHub and let the laptop companion publish an observation.';
      } finally { this.busy = false; }
    },
  }));
});
