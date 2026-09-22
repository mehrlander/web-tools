// Code is a workspace over an installation manifest. GitHub source is pinned,
// editor drafts belong to this browser, supplied copies remain observations,
// and publication creates a new branch. None of these gestures installs code.
document.addEventListener('alpine:init', () => {
  Alpine.data('powershellWorkspace', function (project) {
    const W = () => window.PowerShellWorkspace;
    const shell = () => window.__shell;
    const plain = value => JSON.parse(JSON.stringify(value));
    let editor = null, companionEditor = null, alive = true, selection = 0, saveChain = Promise.resolve(), pendingSaves = 0;
    const cached = new Map();
    const failedSaves = new Set();
    const fallbackHistory = new Map();
    let companionText = '';
    return {
      description: 'PowerShell code workspace: pinned GitHub sources, browser drafts, editor tabs, symbols, search, companion files, supplied-copy comparisons, installation observations and reviewed publication to a new branch.',
      project, repo: '', ref: '', revision: '', manifest: null, items: [], rows: [],
      docs: [], active: '', loading: true, opening: false, error: '', notice: '',
      query: '', area: '', nav: 'files', pane: 'code', panel: 'outline', explorer: true,
      editorReady: false, editorError: '', wrap: false, cursor: { line: 1, column: 1 },
      analysis: { symbols: [], diagnostics: [], references: [], controls: [] },
      diffRows: [], diffWarning: '', diffAgainst: 'base', onlyChanges: false,
      localText: '', localEncoding: 'auto', localCheck: null, comparing: false,
      searchText: '', searchResults: [], searching: false, searchDone: false,
      refreshing: false, newOpen: false, newPath: '', confirmation: '',
      publishing: false, publishOpen: false, publishBranch: '', publishMessage: '', published: null,
      history: [], historyBusy: false, historyPath: '', saveState: '',
      importBundle: null, importBusy: false,
      focusMode: false, companionOpen: false, companionBusy: false, companionPath: '', companionError: '', connections: [],
      changingDraft: false,
      template: `
        <section class="@container flex flex-col min-w-0 min-h-0 bg-base-100" :class="focusMode ? 'fixed inset-0 z-40' : 'h-full'" data-powershell-workspace>
          <header class="flex flex-wrap items-center gap-2 border-b border-base-300 px-3 py-2 shrink-0">
            <button @click="toggleExplorer()" class="btn btn-ghost btn-sm" :aria-expanded="explorer">Files</button>
            <span class="font-mono text-sm truncate hidden @xl:block" x-text="repo + '@' + ref"></span>
            <a :href="revisionUrl" target="_blank" rel="noopener" class="link font-mono text-xs" x-text="short(revision)"></a>
            <span class="grow"></span>
            <button @click="toggleFocus()" class="btn btn-ghost btn-sm" x-text="focusMode ? 'Exit focus' : 'Focus'"></button>
            <button @click="refreshUpstream()" :disabled="!!(loading || refreshing || publishing)" class="btn btn-ghost btn-sm" x-text="refreshing ? 'Checking…' : 'Check GitHub'"></button>
            <button @click="exportDrafts()" :disabled="!dirtyDocs.length" class="btn btn-ghost btn-sm">Export drafts</button>
            <label class="btn btn-ghost btn-sm">Import drafts<input type="file" accept=".json" class="hidden" @change="previewImport($event)"></label>
            <button @click="reviewPublish()" :disabled="!!(!dirtyDocs.length || publishing || loading)" class="btn btn-primary btn-sm">Review changes <span class="badge badge-sm" x-text="dirtyDocs.length"></span></button>
          </header>
          <div x-show="error" role="alert" class="px-3 py-2 text-error border-b border-base-300 text-base" x-text="error"></div>
          <div x-show="notice" role="status" class="px-3 py-1 text-base border-b border-base-300 flex gap-2"><span class="grow" x-text="notice"></span><button @click="notice = ''" class="btn btn-ghost btn-xs" aria-label="Dismiss notice">✕</button></div>
          <div x-show="loading" class="p-6"><span class="loading loading-spinner loading-sm"></span> Reading repository…</div>
          <div x-show="!loading" class="flex min-w-0 min-h-0 grow overflow-hidden">
            <aside x-show="explorer" class="w-full @3xl:w-64 @3xl:shrink-0 min-h-0 overflow-y-auto border-r border-base-300 flex flex-col" :class="active && 'hidden @3xl:flex'">
              <div class="flex items-center gap-1 p-2 border-b border-base-200">
                <button @click="nav = 'files'" class="btn btn-ghost btn-sm" :class="nav === 'files' && 'text-primary'">Explorer</button>
                <button @click="nav = 'search'" class="btn btn-ghost btn-sm" :class="nav === 'search' && 'text-primary'">Search</button>
                <button @click="newOpen = !newOpen; newPath = project.path + '/app/Scripts/New-Script.ps1'" class="btn btn-ghost btn-sm ml-auto" aria-label="New file">+</button>
              </div>
              <form x-show="newOpen" @submit.prevent="newFile()" class="p-2 flex flex-col gap-2 border-b border-base-300">
                <label class="text-sm">New repository path<input x-model="newPath" class="input input-bordered input-sm w-full font-mono mt-1" aria-label="New repository path"></label>
                <button class="btn btn-outline btn-sm">Create browser draft</button>
              </form>
              <div x-show="nav === 'files'" class="p-2 flex flex-col gap-2">
                <input x-model="query" class="input input-bordered input-sm w-full" placeholder="Find file…" aria-label="Find file">
                <select x-model="area" class="select select-bordered select-sm w-full" aria-label="File area"><option value="">All areas</option><template x-for="a in areas" :key="a"><option x-text="a"></option></template></select>
                <template x-for="group in visibleGroups" :key="group.area">
                  <div><h3 class="text-xs uppercase font-mono text-base-content/60 px-1 py-2" x-text="group.area"></h3>
                    <template x-for="it in group.files" :key="it.path">
                      <button @click="open(it.path)" class="w-full text-left px-2 py-1.5 rounded flex gap-2 items-start hover:bg-base-200" :class="active === it.path && 'bg-primary/10 text-primary'" :aria-current="active === it.path ? 'true' : null">
                        <span class="text-sm font-mono mt-0.5" x-text="isDirty(it.path) ? '●' : /xaml$/i.test(it.path) ? '◇' : '›'"></span>
                        <span class="min-w-0"><span class="block text-base break-words" x-text="it.name"></span><span class="block font-mono text-xs text-base-content/60 break-all" x-text="it.unit"></span></span>
                      </button>
                    </template>
                  </div>
                </template>
                <p x-show="!visibleGroups.length" class="text-base p-2 text-base-content/60">No matching files.</p>
              </div>
              <form x-show="nav === 'search'" @submit.prevent="search()" class="flex flex-col gap-2 p-2">
                <input x-model="searchText" class="input input-bordered input-sm w-full" placeholder="Search code…" aria-label="Search code">
                <button :disabled="searching || !searchText.trim()" class="btn btn-outline btn-sm" x-text="searching ? 'Searching…' : 'Search workspace'"></button>
                <span x-show="searchDone" class="text-xs font-mono" x-text="searchResults.length + ' matches · ' + short(revision)"></span>
                <template x-for="(hit, i) in searchResults" :key="i"><button type="button" @click="open(hit.path, hit.line)" class="text-left py-2 border-b border-base-200"><span class="block text-sm font-mono break-all" x-text="hit.path.slice(project.path.length + 1) + ':' + hit.line"></span><span class="block text-base break-all" x-text="hit.text"></span></button></template>
              </form>
            </aside>
            <main class="flex flex-col min-w-0 min-h-0 grow" :class="!active && explorer && 'hidden @3xl:flex'">
              <div role="tablist" aria-label="Open files" class="flex overflow-x-auto min-w-0 shrink-0 border-b border-base-300">
                <template x-for="d in docs" :key="d.path"><div class="flex shrink-0 border-r border-base-200" :class="active === d.path && 'bg-primary/10 text-primary'">
                  <button role="tab" @click="open(d.path)" :aria-selected="active === d.path" class="px-3 py-2 text-sm font-mono" x-text="(changed(d) ? '● ' : '') + basename(d.path)"></button>
                  <button @click="close(d.path)" class="px-2 text-base-content/60" :aria-label="'Close ' + basename(d.path)">×</button>
                </div></template>
              </div>
              <div x-show="!doc" class="p-6 text-base text-base-content/60">Open a PowerShell or XAML file.</div>
              <div x-show="!!doc" class="flex flex-col min-h-0 grow">
                <div class="flex flex-wrap gap-2 items-center px-3 py-2 border-b border-base-200 shrink-0">
                  <button @click="active = ''; explorer = true" class="btn btn-ghost btn-xs @3xl:hidden">All files</button>
                  <span class="font-mono text-xs break-all grow" x-text="doc?.path"></span>
                  <a :href="fileUrl" target="_blank" rel="noopener" class="link text-sm">GitHub ↗</a>
                  <button x-show="!!companion" @click="open(companion)" class="btn btn-ghost btn-xs">Companion</button>
                  <button x-show="!!companion" @click="showCompanion()" class="btn btn-ghost btn-xs hidden @3xl:inline-flex">Split companion</button>
                  <button @click="installation()" class="btn btn-ghost btn-xs">Installation</button>
                </div>
                <div class="flex flex-wrap gap-1 items-center px-2 py-1 border-b border-base-300 shrink-0" role="tablist" aria-label="Code views">
                  <template x-for="tab in ['code', 'diff', 'local', 'history']" :key="tab"><button role="tab" @click="setPane(tab)" :aria-selected="pane === tab" class="btn btn-ghost btn-sm capitalize" :class="pane === tab && 'text-primary bg-primary/10'" x-text="tab === 'local' ? 'Supplied copy' : tab"></button></template>
                  <span class="grow"></span>
                  <button @click="copyDraft()" :disabled="publishing" class="btn btn-ghost btn-sm">Copy</button>
                  <button @click="downloadDraft()" class="btn btn-ghost btn-sm">Download</button>
                </div>
                <div x-show="opening" class="p-2 text-sm">Reading file…</div>
                <div x-show="pane === 'code'" class="flex min-h-0 grow flex-col">
                  <div class="flex flex-wrap gap-1 items-center px-2 py-1 shrink-0">
                    <button @click="editorCommand('find')" class="btn btn-ghost btn-xs">Find</button><button @click="editorCommand('replace')" class="btn btn-ghost btn-xs">Replace</button>
                    <button @click="editorCommand('undo')" class="btn btn-ghost btn-xs">Undo</button><button @click="editorCommand('redo')" class="btn btn-ghost btn-xs">Redo</button>
                    <button @click="confirmation = 'discard'" :disabled="!!(!changed(doc) || publishing)" class="btn btn-ghost btn-xs">Restore base…</button>
                    <label class="text-xs flex gap-1 items-center"><input type="checkbox" x-model="wrap" @change="setWrap()" class="checkbox checkbox-xs">Wrap</label>
                    <span class="grow"></span><span class="text-xs" x-text="saveState"></span>
                  </div>
                  <div x-show="editorError" class="text-sm text-warning px-3" x-text="editorError"></div>
                  <div class="grid grow min-h-48 min-w-0 overflow-hidden" :class="companionOpen ? 'grid-cols-2' : 'grid-cols-1'">
                    <div class="min-w-0 min-h-0 flex flex-col">
                      <div x-show="editorReady" class="grow min-h-0 overflow-hidden [&_.CodeMirror-gutters]:!bg-base-200 [&_.CodeMirror-gutters]:!border-base-300 [&_.CodeMirror-cursor]:!border-base-content [&_.CodeMirror-selected]:!bg-primary/20 [&_.CodeMirror-linenumber]:!text-base-content/60"><div x-ignore data-editor-host class="h-full"></div></div>
                      <textarea x-ref="fallback" x-show="!editorReady" :value="doc?.text || ''" @input="editFallback($event.target.value, $event)" :readonly="publishing || changingDraft || !doc" spellcheck="false" aria-label="PowerShell source" class="textarea rounded-none border-0 w-full grow min-h-48 font-mono text-base leading-6"></textarea>
                    </div>
                    <section x-show="companionOpen" class="min-w-0 min-h-0 flex flex-col border-l border-base-300" aria-label="Companion source">
                      <div class="flex gap-2 items-center px-2 py-1 shrink-0"><span class="font-mono text-xs grow truncate" x-text="basename(companionPath)"></span><span class="text-xs">Read only</span><button @click="companionOpen = false; refreshEditor()" class="btn btn-ghost btn-xs" aria-label="Close companion">✕</button></div>
                      <p x-show="companionError" class="text-sm text-error px-2" x-text="companionError"></p><span x-show="companionBusy" class="loading loading-spinner loading-sm m-2"></span>
                      <div x-ignore data-companion-host class="grow min-h-0 overflow-hidden [&_.CodeMirror-gutters]:!bg-base-200 [&_.CodeMirror-gutters]:!border-base-300"></div>
                    </section>
                  </div>
                  <div class="border-t border-base-300 shrink-0">
                    <div class="flex gap-1 px-2 py-1 items-center"><template x-for="tab in ['outline', 'problems', 'references', ...(companionOpen ? ['connections'] : [])]" :key="tab"><button @click="panel = panel === tab ? '' : tab" class="btn btn-ghost btn-xs capitalize" :class="panel === tab && 'text-primary'" x-text="tab + (tab === 'problems' ? ' (' + analysis.diagnostics.length + ')' : '')"></button></template><span class="ml-auto text-xs text-base-content/60">Browser analysis</span></div>
                    <div x-show="panel" class="max-h-40 overflow-y-auto px-2 pb-2">
                      <template x-for="(entry, i) in panelEntries" :key="i"><button @click="goLine(entry.line)" class="w-full text-left px-2 py-1 text-base flex gap-3 hover:bg-base-200"><span class="font-mono text-xs pt-1 text-base-content/60" x-text="entry.line"></span><span x-text="entry.message || entry.name"></span><span class="text-sm text-base-content/60 ml-auto" x-text="entry.kind || entry.rule"></span></button></template>
                      <span x-show="!panelEntries.length" class="text-sm text-base-content/60 px-2" x-text="panel === 'problems' ? 'No browser checks reported. PowerShell runtime validation is still required.' : 'No entries found.'"></span>
                    </div>
                  </div>
                </div>
                <div x-show="pane === 'diff'" class="flex flex-col min-h-0 grow">
                  <div class="flex flex-wrap gap-2 items-center px-3 py-2 shrink-0"><select x-model="diffAgainst" @change="buildDiff()" aria-label="Compare draft against" class="select select-bordered select-sm"><option value="base">Pinned base → draft</option><option value="current">Last checked GitHub → draft</option><option value="local">Supplied copy → draft</option></select><label class="text-sm flex gap-2 items-center"><input type="checkbox" x-model="onlyChanges" class="checkbox checkbox-xs">Changes only</label><span class="text-sm" x-text="statusOf(doc).label"></span></div>
                  <div x-show="diffWarning" class="px-3 text-warning text-sm" x-text="diffWarning"></div>
                  <div class="overflow-auto min-h-0 grow font-mono text-base leading-6" data-code-diff><template x-for="(r, i) in shownDiff" :key="i"><div class="flex min-w-max" :class="r.type === 'add' ? 'bg-success/10' : r.type === 'del' ? 'bg-error/10' : ''"><span class="w-12 text-right shrink-0 text-base-content/50 text-xs px-1 pt-1" x-text="r.a"></span><span class="w-12 text-right shrink-0 text-base-content/50 text-xs px-1 pt-1" x-text="r.b"></span><span class="w-6 text-center shrink-0" x-text="r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '"></span><pre class="pr-4" x-text="r.text || ' '"></pre></div></template></div>
                  <div x-show="!!doc && doc.currentBlob !== undefined && doc.currentBlob !== doc.baseBlob" class="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-base-300"><span class="text-sm">GitHub changed since this draft began.</span><button @click="diffAgainst = 'current'; buildDiff(); confirmation = 'rebase'" :disabled="!!(doc?.currentText === null || publishing)" class="btn btn-outline btn-sm">Use current as base…</button></div>
                </div>
                <div x-show="pane === 'local'" class="flex flex-col gap-3 p-3 overflow-auto grow min-h-0" @dragover.prevent @drop.prevent.stop="dropCopy($event)">
                  <div class="flex flex-wrap gap-2"><label class="btn btn-outline btn-sm">Choose local file<input type="file" class="hidden" accept=".ps1,.psm1,.psd1,.ps1xml,.xaml,.txt" @change="pickCopy($event)"></label><select x-model="localEncoding" class="select select-bordered select-sm" aria-label="Local file encoding"><option value="auto">Auto encoding</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option><option value="windows-1252">Windows-1252</option></select></div>
                  <textarea x-model="localText" class="textarea textarea-bordered w-full min-h-48 font-mono text-base" spellcheck="false" aria-label="Supplied local copy" placeholder="Paste the work copy, or drop a file"></textarea>
                  <div class="flex flex-wrap gap-2"><button @click="compareCopy()" :disabled="comparing || !localText.length" class="btn btn-primary btn-sm">Compare supplied copy</button><button @click="confirmation = 'local'" :disabled="!!(!localCheck || publishing)" class="btn btn-outline btn-sm">Use compared copy as draft…</button></div>
                  <dl x-show="!!localCheck" class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm"><dt>Comparison</dt><dd x-text="localCheck?.exact ? 'Exact match to pinned revision' : localCheck?.lineEndingsOnly ? 'Line endings differ' : 'Text differs'"></dd><dt>Checked</dt><dd x-text="localCheck?.checkedAt"></dd><dt>Installation</dt><dd>Not inspected</dd><dt>Hash of supplied text</dt><dd class="font-mono break-all" x-text="localCheck?.incomingSha256"></dd></dl>
                  <button x-show="!!localCheck" @click="diffAgainst = 'local'; setPane('diff')" class="btn btn-ghost btn-sm self-start">Compare supplied copy with draft</button>
                </div>
                <div x-show="pane === 'history'" class="overflow-auto min-h-0 grow p-3"><span x-show="historyBusy" class="loading loading-spinner loading-sm"></span><p x-show="!historyBusy && !history.length" class="text-base-content/60">No commits found.</p><template x-for="h in history" :key="h.sha"><a :href="h.html_url" target="_blank" rel="noopener" class="flex gap-3 py-3 border-b border-base-200"><span class="font-mono text-xs shrink-0 pt-1" x-text="short(h.sha)"></span><span class="min-w-0 grow"><span class="block text-base" x-text="h.commit?.message?.split('\\n')[0]"></span><span class="block text-xs text-base-content/60" x-text="h.commit?.author?.date"></span></span><span>↗</span></a></template></div>
                <div x-show="confirmation" class="p-3 bg-base-200 border-t border-base-300 flex flex-col gap-2" role="alert">
                  <p class="text-base" x-text="confirmationText"></p><div class="flex gap-2"><button @click="confirmAction()" :disabled="changingDraft" class="btn btn-primary btn-sm">Confirm</button><button @click="confirmation = ''" :disabled="changingDraft" class="btn btn-ghost btn-sm">Cancel</button></div>
                </div>
              </div>
              <footer class="border-t border-base-300 flex flex-wrap gap-x-3 gap-y-1 px-3 py-1 text-xs shrink-0"><span x-text="doc ? statusOf(doc).label : items.length + ' files'"></span><span x-text="doc ? lineFormat(doc.text) : ''"></span><span class="grow"></span><span x-show="!!doc" x-text="'Ln ' + cursor.line + ', Col ' + cursor.column"></span><span>PowerShell 5.1 · Browser draft</span></footer>
            </main>
          </div>
          <div x-show="publishOpen" class="border-t border-primary bg-base-200 p-3 flex flex-col gap-2 shrink-0" data-publish-review>
            <div class="flex flex-wrap items-center gap-2"><strong>Publish reviewed drafts</strong><span class="text-sm" x-text="dirtyDocs.length + ' files from ' + short(revision)"></span><button @click="publishOpen = false" :disabled="publishing" class="btn btn-ghost btn-xs ml-auto" aria-label="Close publication review">✕</button></div>
            <div class="flex gap-1 overflow-x-auto"><template x-for="d in dirtyDocs" :key="d.path"><button @click="open(d.path); setPane('diff')" class="btn btn-ghost btn-xs shrink-0" x-text="basename(d.path)"></button></template></div>
            <div class="flex flex-wrap gap-2"><label class="text-sm grow">New branch<input x-model="publishBranch" :disabled="publishing" class="input input-bordered input-sm w-full font-mono" placeholder="wps/my-change" aria-label="New branch"></label><label class="text-sm grow">Commit message<input x-model="publishMessage" :disabled="publishing" class="input input-bordered input-sm w-full" aria-label="Commit message"></label></div>
            <div class="flex flex-wrap items-center gap-2"><span class="text-sm grow">Creates a new GitHub branch. Local installation is unchanged.</span><button @click="publish()" :disabled="publishing || refreshing || !dirtyDocs.length || !publishBranch.trim() || !publishMessage.trim()" class="btn btn-primary btn-sm" x-text="publishing ? 'Publishing…' : 'Create branch and commit'"></button></div>
          </div>
          <div x-show="!!published" class="px-3 py-2 border-t border-base-300 flex flex-wrap gap-3 text-base"><span>Published</span><a :href="published?.url" target="_blank" rel="noopener" class="link font-mono" x-text="published?.branch"></a><a :href="published?.compareUrl" target="_blank" rel="noopener" class="link">Open pull request ↗</a></div>
          <div x-show="!!importBundle" class="px-3 py-2 border-t border-primary bg-base-200 flex flex-wrap gap-3 items-center text-base"><span class="grow" x-text="'Restore ' + (importBundle?.drafts.length || 0) + ' browser drafts from ' + short(importBundle?.revision) + '?'"></span><button @click="restoreImport()" :disabled="importBusy" class="btn btn-primary btn-sm">Restore drafts</button><button @click="importBundle = null" :disabled="importBusy" class="btn btn-ghost btn-sm">Cancel</button></div>
        </section>`,

      init() {
        this.focusMode = window.matchMedia('(max-width: 767px)').matches;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this._beforeUnload = event => { if (pendingSaves || failedSaves.size || this.importBusy || this.changingDraft) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', this._beforeUnload);
        this.load();
      },
      destroy() { alive = false; selection++; editor?.destroy(); companionEditor?.destroy(); editor = null; companionEditor = null; window.removeEventListener('beforeunload', this._beforeUnload); },
      short(value) { return String(value || '').slice(0, 7); },
      basename(path) { return String(path || '').split('/').pop(); },
      changed(d) { return !!d && W().changed(d); },
      get doc() { return this.docs.find(d => d.path === this.active) || null; },
      get dirtyDocs() { return this.docs.filter(d => this.changed(d)); },
      get areas() { return [...new Set(this.items.map(it => it.area))]; },
      get visibleGroups() {
        const q = this.query.trim().toLowerCase();
        return this.areas.map(area => ({ area, files: this.items.filter(it => it.area === area && (!this.area || area === this.area) && (!q || it.path.toLowerCase().includes(q))) })).filter(g => g.files.length);
      },
      get panelEntries() { return this.panel === 'outline' ? this.analysis.symbols : this.panel === 'problems' ? this.analysis.diagnostics : this.panel === 'references' ? this.analysis.references : this.panel === 'connections' ? this.connections : []; },
      get shownDiff() { return this.onlyChanges ? this.diffRows.filter(r => r.type !== 'eq') : this.diffRows; },
      get revisionUrl() { return this.repo && this.revision ? 'https://github.com/' + this.repo + '/commit/' + this.revision : ''; },
      get fileUrl() { return this.doc ? 'https://github.com/' + this.repo + '/blob/' + this.doc.baseRevision + '/' + this.doc.path.split('/').map(encodeURIComponent).join('/') : ''; },
      get companion() { return this.items.find(it => it.path === this.active)?.companion || ''; },
      get confirmationText() {
        if (this.confirmation === 'rebase') return 'Keep this draft text and use the last checked GitHub text as its new base. Review the current GitHub → draft diff before confirming.';
        if (this.confirmation === 'local') return 'Replace this browser draft with the compared copy. The supplied copy remains in browser comparison history.';
        if (this.confirmation === 'discard') return this.doc?.baseBlob ? 'Discard this browser draft and restore its pinned GitHub base. Export drafts first if you need to keep these edits.' : 'Discard this new browser file. Export drafts first if you need to keep it.';
        return '';
      },
      isDirty(path) { return this.changed(this.docs.find(d => d.path === path)); },
      async refreshEditor() { await this.$nextTick(); editor?.refresh(); companionEditor?.refresh(); },
      toggleExplorer() {
        if (this.$root.clientWidth < 768 && this.active) { this.active = ''; this.explorer = true; }
        else this.explorer = !this.explorer;
        this.refreshEditor();
      },
      toggleFocus() { this.focusMode = !this.focusMode; this.refreshEditor(); },
      statusOf(d) {
        if (!d) return { state: 'unchanged', label: '' };
        if (d.currentText === null) return { state: 'conflict', label: 'File removed from GitHub' };
        return W().compare(d.baseText, d.currentText === undefined ? d.baseText : d.currentText, d.text);
      },
      lineFormat(text) {
        const s = String(text || '');
        const endings = [...new Set(s.match(/\r\n|\r|\n/g) || [])];
        return (s.charCodeAt(0) === 0xfeff ? 'UTF-8 BOM · ' : 'UTF-8 · ') + (endings.length > 1 ? 'Mixed endings' : endings[0] === '\r\n' ? 'CRLF' : endings[0] === '\r' ? 'CR' : 'LF');
      },
      gh() { const gh = new window.GH({ token: window.TOKEN, repo: this.repo }); gh.ref = this.ref; return gh; },
      async load() {
        const store = Alpine.store('browser'); this.repo = store.repo; this.ref = store.ref || store.defaultRef || 'main';
        try {
          const snap = await W().snapshot({ gh: this.gh(), project: this.project, ref: this.ref });
          if (!alive) return;
          this.revision = snap.revision; this.manifest = snap.manifest; this.items = snap.items.filter(it => it.comparable);
          const scope = { repo: this.repo, project: this.project.path, ref: this.ref };
          let stored = [];
          try { stored = await W().loadDrafts(scope); }
          catch (e) { this.notice = 'Saved browser drafts could not be read. Export any new edits before reloading. ' + (e.message || e); }
          const recovered = W().recoveryDrafts(scope);
          this.docs = [...new Map([...stored, ...recovered].map(d => [d.path, d])).values()];
          for (const d of recovered) failedSaves.add(d.path);
          if (recovered.length) this.notice = 'Recovered drafts from this app window. Save or export them before reloading.';
          if (!alive) return;
          for (const d of this.docs) {
            if (!this.items.some(it => it.path === d.path)) this.addDraftItem(d.path);
            const it = this.items.find(it => it.path === d.path);
            if (it.blobSha && it.blobSha === d.baseBlob) d.baseRevision = this.revision;
          }
          this.loading = false;
          const requested = shell()?.installationItem;
          if (requested && this.items.some(it => it.path === requested)) await this.open(requested);
          else if (this.docs.length) await this.open(this.docs[0].path);
          else if (this.items.length) await this.open(this.items[0].path);
          this.mountEditor();
        } catch (e) { if (alive) { this.error = e.message || String(e); this.loading = false; } }
      },
      async read(item, revision = this.revision) {
        const key = revision + ':' + item.path;
        if (!cached.has(key)) cached.set(key, W().readFile({ gh: this.gh(), path: item.path, revision, blobSha: item.blobSha }).catch(e => { cached.delete(key); throw e; }));
        return cached.get(key);
      },
      async open(path, line = 1) {
        if (this.publishing || this.changingDraft) return;
        const item = this.items.find(it => it.path === path); if (!item) return;
        const request = ++selection; this.opening = true; this.error = ''; this.confirmation = ''; this.companionOpen = false;
        try {
          let d = this.docs.find(d => d.path === path);
          if (!d) {
            const file = await this.read(item);
            if (!alive || request !== selection) return;
            d = { repo: this.repo, project: this.project.path, ref: this.ref, path,
              baseRevision: file.revision, baseBlob: file.sha, baseText: file.text, text: file.text, updatedAt: new Date().toISOString() };
            this.docs.push(d);
          }
          if (!alive || request !== selection) return;
          this.active = path; this.localCheck = d.localCheck || null; this.localText = this.localCheck?.content || '';
          if (shell()) { shell().installationItem = path; shell().syncUrl?.(); }
          this.saveState = this.changed(d) ? 'Draft restored' : 'GitHub source';
          this.analyze(); this.buildDiff();
          if (this.pane === 'history') this.loadHistory();
          await this.$nextTick();
          editor?.open(path, d.text, path); editor?.go(line);
          if (line > 1) this.setPane('code');
        } catch (e) { if (alive && request === selection) this.error = e.message || String(e); }
        finally { if (alive && request === selection) this.opening = false; }
      },
      async mountEditor() {
        try {
          const result = await window.PowerShellEditor.create(this.$root.querySelector('[data-editor-host]'), { value: this.doc?.text || '', path: this.active,
            onChange: text => this.edit(text), onSave: () => this.persist(this.doc), onCursor: p => { this.cursor = p; } });
          if (!alive) { result?.destroy(); return; }
          editor = result; this.editorReady = !!result;
          await this.$nextTick(); if (this.doc) editor?.open(this.active, this.doc.text, this.active); editor?.refresh();
        } catch (e) { if (alive) this.editorError = e.message || String(e); }
      },
      edit(text) {
        const d = this.doc; if (!d || this.publishing || this.changingDraft || d.text === text) return;
        d.text = text; d.updatedAt = new Date().toISOString(); this.analyze(); this.persist(d);
        if (this.pane === 'diff') this.buildDiff();
      },
      editFallback(text, event) {
        if (!this.doc) return;
        let history = fallbackHistory.get(this.active);
        if (!history || history.value() !== this.doc.text) { history = window.PowerShellEditor.textHistory(this.doc.text); fallbackHistory.set(this.active, history); }
        try { this.edit(history.input(text, event?.inputType || '')); }
        catch (e) { if (event?.target) event.target.value = window.PowerShellEditor.displayText(this.doc.text); this.error = e.message || String(e); }
      },
      persist(d) {
        if (!d) return saveChain;
        const copy = plain(d); delete copy.currentText; delete copy.currentBlob; delete copy.currentRevision; delete copy.localCheck;
        W().rememberDraft(copy);
        this.saveState = 'Saving…';
        pendingSaves++;
        saveChain = saveChain.catch(() => {}).then(async () => {
          if (W().changed(copy)) return W().saveDraft(copy);
          return W().removeDraft(copy);
        }).then(saved => { W().forgetRecovery(copy); failedSaves.delete(copy.path); if (alive && this.doc?.path === copy.path && this.doc?.text === copy.text) this.saveState = 'Saved in this browser'; if (saved?.id) d.id = saved.id; }, e => {
          failedSaves.add(copy.path);
          if (alive) { this.saveState = 'Save failed'; this.error = 'Browser draft was not saved. Export drafts before leaving. ' + (e.message || e); }
        }).finally(() => { pendingSaves--; });
        return saveChain;
      },
      close(path) {
        const d = this.docs.find(d => d.path === path); if (!d || this.publishing || this.changingDraft) return;
        // Dirty tabs remain in the draft set and are never discarded by a close.
        if (this.changed(d)) { this.notice = 'This file has a browser draft. Publish it or restore the base before closing.'; return; }
        this.docs = this.docs.filter(d => d.path !== path);
        if (this.active === path) { this.active = ''; if (this.docs.length) this.open(this.docs[this.docs.length - 1].path); }
      },
      analyze() {
        this.analysis = this.doc ? window.PowerShellLanguage.inspect(this.doc.text, this.doc.path) : { symbols: [], diagnostics: [], references: [], controls: [] };
        if (this.companionOpen && !this.companionBusy) this.analyzeConnections();
      },
      analyzeConnections() {
        if (!this.doc) return;
        const currentIsXaml = /\.xaml$/i.test(this.active);
        const links = window.PowerShellLanguage.compareCompanions(currentIsXaml ? companionText : this.doc.text, currentIsXaml ? this.doc.text : companionText);
        this.connections = [
          ...links.matched.map(row => ({ name: row.name, kind: 'Explicit control lookup', line: currentIsXaml ? row.line : this.analysis.references.find(ref => ref.kind === 'control' && ref.name === row.name)?.line || 1 })),
          ...links.diagnostics,
        ];
      },
      async showCompanion() {
        if (!this.companion || this.companionBusy) return;
        const request = selection, path = this.companion;
        this.companionBusy = true; this.companionError = ''; this.companionPath = path; this.companionOpen = true; this.pane = 'code';
        try {
          const draft = this.docs.find(d => d.path === path);
          const text = draft ? draft.text : (await this.read(this.items.find(it => it.path === path))).text;
          if (!alive || request !== selection) return;
          await this.$nextTick();
          if (!companionEditor) companionEditor = await window.PowerShellEditor.create(this.$root.querySelector('[data-companion-host]'), { value: text, path, readOnly: true, wrap: this.wrap });
          if (!alive || request !== selection) { companionEditor?.destroy(); companionEditor = null; return; }
          companionEditor?.open(path, text, path);
          companionText = text; this.analyzeConnections();
          this.panel = 'connections'; await this.refreshEditor();
        } catch (e) { if (alive && request === selection) this.companionError = e.message || String(e); }
        finally { this.companionBusy = false; }
      },
      async setPane(pane) { this.pane = pane; this.confirmation = ''; if (pane === 'diff') this.buildDiff(); if (pane === 'history') this.loadHistory(); await this.$nextTick(); editor?.refresh(); },
      goLine(line) { this.setPane('code'); editor?.go(line); if (!editor && this.doc) { this.$refs.fallback.focus(); const preceding = this.$refs.fallback.value.split('\n').slice(0, Math.max(0, line - 1)); const pos = preceding.length ? preceding.join('\n').length + 1 : 0; this.$refs.fallback.setSelectionRange(pos, pos); } },
      editorCommand(name) { editor?.command(name); },
      setWrap() { editor?.wrap(this.wrap); companionEditor?.wrap(this.wrap); },
      buildDiff() {
        const d = this.doc; this.diffWarning = ''; if (!d || !window.textDiff) { this.diffRows = []; return; }
        let before = d.baseText;
        if (this.diffAgainst === 'current') { before = d.currentText; if (before === undefined) this.diffWarning = 'Check GitHub to fetch the current source.'; if (before === null) this.diffWarning = 'This file was removed from GitHub.'; }
        if (this.diffAgainst === 'local') { before = this.localCheck?.content; if (before === undefined) this.diffWarning = 'Compare a supplied copy first.'; }
        if (before === undefined || before === null) { this.diffRows = []; return; }
        const a = before.split('\n'), b = d.text.split('\n');
        this.diffRows = window.textDiff.lines(a, b).map(op => ({ type: op.type, a: op.a === undefined ? '' : op.a + 1, b: op.b === undefined ? '' : op.b + 1, text: op.type === 'add' ? b[op.b] : a[op.a] }));
        this.diffWarning = window.textDiff.lastWarning || this.diffWarning;
        if (before !== d.text && before.replace(/\r\n?/g, '\n') === d.text.replace(/\r\n?/g, '\n')) this.diffWarning = 'Only line endings differ. Exact text remains preserved.';
      },
      async refreshUpstream() {
        if (this.refreshing || this.publishing || this.changingDraft) return false;
        this.refreshing = true; this.error = '';
        try {
          const next = await W().snapshot({ gh: this.gh(), project: this.project, ref: this.ref });
          if (!alive) return false;
          for (const d of this.docs) {
            const item = next.items.find(it => it.path === d.path);
            if (!item) { d.currentText = d.baseBlob ? null : ''; d.currentBlob = ''; }
            else { const f = await this.read(item, next.revision); if (!alive) return false; d.currentText = f.text; d.currentBlob = f.sha; }
            d.currentRevision = next.revision;
            if (d.currentBlob === d.baseBlob) { d.baseRevision = next.revision; await this.persist(d); }
          }
          if (!alive) return false;
          this.revision = next.revision; this.manifest = next.manifest;
          this.items = next.items.filter(it => it.comparable);
          for (const d of this.docs) if (!this.items.some(it => it.path === d.path)) this.addDraftItem(d.path);
          this.notice = 'GitHub checked at ' + this.short(next.revision) + '. Draft text retained.'; this.buildDiff(); return true;
        } catch (e) { this.error = 'Could not check GitHub: ' + (e.message || e); return false; }
        finally { this.refreshing = false; }
      },
      async search() {
        const term = this.searchText.trim().toLowerCase(); if (!term || this.searching) return;
        this.searching = true; this.searchDone = false; this.searchResults = []; this.error = '';
        const revision = this.revision;
        try {
          for (const item of this.items) {
            if (!alive) return;
            const d = this.docs.find(d => d.path === item.path);
            const text = d ? d.text : (await this.read(item, revision)).text;
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) if (lines[i].toLowerCase().includes(term)) {
              this.searchResults.push({ path: item.path, line: i + 1, text: lines[i] });
              if (this.searchResults.length >= 500) { this.notice = 'Showing the first 500 matches. Refine the search to see more.'; return; }
            }
          }
        } catch (e) { this.error = 'Search stopped: ' + (e.message || e); }
        finally { this.searching = false; this.searchDone = true; }
      },
      addDraftItem(path) { this.items.push({ path, name: this.basename(path), area: 'Drafts', unit: 'Browser draft', comparable: true, blobSha: '', companion: '' }); },
      async newFile() {
        if (this.publishing || this.changingDraft) return;
        const path = this.newPath.trim();
        if (!path.startsWith(this.project.path + '/app/') || !/\.(ps1|psm1|psd1|ps1xml|xaml)$/i.test(path) || /[\\:#?\x00-\x1f]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) { this.error = 'Choose a PowerShell or XAML path under ' + this.project.path + '/app/.'; return; }
        if (this.items.some(it => it.path === path)) { this.error = 'That file is already in the workspace.'; return; }
        const text = /\.(xaml|ps1xml)$/i.test(path) ? '<!-- New XAML draft -->\n' : '# @file ' + path + '\n';
        this.addDraftItem(path); const d = { repo: this.repo, project: this.project.path, ref: this.ref, path, baseRevision: this.revision, baseBlob: '', baseText: '', text, updatedAt: new Date().toISOString() };
        this.docs.push(d); await this.persist(d); this.newOpen = false; await this.open(path); this.setPane('code');
      },
      async compareCopy(source = 'paste', name = '') {
        if (!this.doc || !this.localText.length || this.comparing) return;
        const path = this.active, text = this.localText, revision = this.doc.baseRevision, request = selection; this.comparing = true; this.error = '';
        try {
          const result = await window.FileCorrespondence.open({ target: { repo: this.repo, ref: this.ref, path }, text, name: name || this.basename(path), source, revision });
          if (!alive || request !== selection || this.active !== path) return;
          this.localCheck = result.record; this.doc.localCheck = result.record;
          window.dispatchEvent(new CustomEvent('correspondence-check', { detail: result.record }));
          this.notice = result.saved ? 'Comparison retained in this browser.' : 'Comparison opened; browser storage did not retain the check.';
        } catch (e) { this.error = e.message || String(e); }
        finally { this.comparing = false; }
      },
      async loadCopy(file, source) {
        const path = this.active, request = selection;
        try { const bytes = new Uint8Array(await file.arrayBuffer()); const text = window.FileCorrespondence.decodeBytes(bytes, this.localEncoding); if (!alive || request !== selection || path !== this.active) return; this.localText = text; await this.compareCopy(source, file.name); }
        catch (e) { this.error = e.message || String(e); }
      },
      pickCopy(e) { const f = e.target.files?.[0]; e.target.value = ''; if (f) this.loadCopy(f, 'file picker'); },
      dropCopy(e) { const files = [...(e.dataTransfer?.files || [])]; if (files.length === 1) this.loadCopy(files[0], 'drop'); else if (files.length > 1) this.error = 'Choose one copy for the selected file.'; else { this.localText = e.dataTransfer?.getData('text') || ''; this.compareCopy('drop'); } },
      async confirmAction() {
        const d = this.doc; if (!d || this.publishing || this.changingDraft) return;
        this.changingDraft = true; editor?.readOnly(true);
        try {
        if (this.confirmation === 'rebase' && typeof d.currentText === 'string') { d.baseText = d.currentText; d.baseBlob = d.currentBlob; d.baseRevision = d.currentRevision; await this.persist(d); }
        else if (this.confirmation === 'local' && this.localCheck) { d.text = this.localCheck.content; d.updatedAt = new Date().toISOString(); await this.persist(d); editor?.open(d.path, d.text, d.path); }
        else if (this.confirmation === 'discard') {
          const discarded = plain(d); W().rememberDraft(discarded);
          await saveChain;
          try { await W().removeDraft(discarded); } catch (e) { this.error = 'Could not remove browser draft: ' + (e.message || e); return; }
          W().forgetRecovery(discarded);
          failedSaves.delete(d.path);
          if (!d.baseBlob) { this.items = this.items.filter(it => it.path !== d.path); this.docs = this.docs.filter(it => it.path !== d.path); this.active = ''; this.changingDraft = false; if (this.docs.length) await this.open(this.docs[0].path); }
          else { d.text = d.baseText; editor?.open(d.path, d.text, d.path); this.saveState = 'Restored pinned base'; }
        }
        this.confirmation = ''; this.analyze(); this.buildDiff();
        } finally { this.changingDraft = false; editor?.readOnly(false); }
      },
      installation() { shell()?.goProject(this.project.path, 'overview', this.active); },
      async copyDraft() { try { await navigator.clipboard.writeText(this.doc.text); this.notice = 'Draft text copied. Installation is not recorded.'; } catch (e) { this.error = e.message || String(e); } },
      downloadDraft() { if (this.doc) window.io.save(this.doc.text, this.basename(this.active), 'text/plain;charset=utf-8'); },
      exportDrafts() { window.io.save(JSON.stringify(W().exportBundle({ repo: this.repo, ref: this.ref, revision: this.revision, project: this.project.path, drafts: plain(this.dirtyDocs) }), null, 2), 'powershell-drafts.json', 'application/json'); },
      async previewImport(e) {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file || this.publishing || this.changingDraft) return;
        try {
          const bundle = W().restoreBundle(await file.text(), { repo: this.repo, project: this.project.path, ref: this.ref });
          const conflicts = bundle.drafts.filter(d => this.dirtyDocs.some(open => open.path === d.path && open.text !== d.text));
          if (conflicts.length) throw new Error('This browser already has different drafts for ' + conflicts.map(d => this.basename(d.path)).join(', ') + '. Export or restore those drafts before importing.');
          this.importBundle = bundle;
        } catch (e) { this.error = e.message || String(e); }
      },
      async restoreImport() {
        if (!this.importBundle || this.importBusy || this.publishing || this.changingDraft) return;
        const bundle = plain(this.importBundle);
        this.importBusy = true; this.changingDraft = true; editor?.readOnly(true);
        try {
          await saveChain;
          for (const d of bundle.drafts) {
            if (!alive) return;
            const existing = this.docs.find(it => it.path === d.path);
            if (existing && this.changed(existing) && existing.text !== d.text) throw new Error('A draft changed after import review. Review the bundle again.');
          }
          for (const d of bundle.drafts) {
            const existing = this.docs.find(it => it.path === d.path);
            if (existing && this.changed(existing) && existing.text !== d.text) throw new Error('A draft changed after import review. Review the bundle again.');
            if (!alive) return;
            const saved = await W().saveDraft(plain(d));
            if (!alive) return;
            this.docs = this.docs.filter(it => it.path !== d.path); this.docs.push(saved);
            if (!this.items.some(it => it.path === d.path)) this.addDraftItem(d.path);
          }
          const path = bundle.drafts[0]?.path; this.importBundle = null; this.changingDraft = false;
          if (path) await this.open(path); this.notice = 'Drafts restored in this browser. Check GitHub before publishing.';
        } catch (e) { this.error = 'Import stopped: ' + (e.message || e); }
        finally { this.importBusy = false; this.changingDraft = false; editor?.readOnly(false); }
      },
      async loadHistory() {
        const path = this.active; if (!path || path === this.historyPath) return;
        this.historyBusy = true; this.history = [];
        try { const rows = await this.gh().req('commits?path=' + encodeURIComponent(path) + '&sha=' + encodeURIComponent(this.revision) + '&per_page=30'); if (alive && path === this.active) { this.history = rows; this.historyPath = path; } }
        catch (e) { if (path === this.active) this.error = e.message || String(e); }
        finally { if (path === this.active) this.historyBusy = false; }
      },
      async reviewPublish() {
        if (!await this.refreshUpstream()) return;
        this.publishOpen = true; this.publishBranch ||= 'wps/edit-' + new Date().toISOString().slice(0, 10); this.publishMessage ||= 'Update PowerShell workspace via Web Tools';
        this.diffAgainst = 'base'; if (this.dirtyDocs.length) await this.open(this.dirtyDocs[0].path); this.setPane('diff');
      },
      async publish() {
        if (this.publishing || this.changingDraft) return;
        const drafts = plain(this.dirtyDocs);
        if (drafts.some(d => d.baseRevision !== this.revision || this.statusOf(d).state === 'conflict' || this.statusOf(d).state === 'upstream')) { this.error = 'Review the changed GitHub files and accept the current base before publishing.'; return; }
        this.publishing = true; editor?.readOnly(true); this.error = '';
        try {
          await saveChain;
          this.published = await W().publish({ gh: this.gh(), baseRevision: this.revision, branch: this.publishBranch.trim(), message: this.publishMessage.trim(), drafts });
          this.publishOpen = false; this.notice = 'Branch created. Browser drafts are retained; installation remains unrecorded.';
        } catch (e) {
          this.error = e.commit
            ? 'GitHub did not confirm branch creation. Check ' + this.repo + '/tree/' + e.branch + ' before trying another name. Browser drafts are retained. ' + (e.message || e)
            : 'Not published: ' + (e.message || e);
        }
        finally { this.publishing = false; editor?.readOnly(false); }
      },
    };
  });
});
