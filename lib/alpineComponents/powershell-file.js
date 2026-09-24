// One PowerShell or XAML file: the source in the editor, read-only until Edit,
// with its browser draft, its Problems and its Outline beside it. The same
// component serves two hosts (installation-view.js):
//
//   the file deck    one per slide (openFileDeck). The deck owns the header,
//                    so the slide on screen publishes its actions there: Edit
//                    or Done, Undo and Redo while editing, and one dropdown
//                    for the rest. Editing pauses the swipe, because a
//                    horizontal drag in code selects text or scrolls a line.
//   the Overview     one inline, beside the selected file's state (fileCtx).
//                    It draws the same actions in its own bar, adds a Work
//                    copy tab when the Overview knows what the work computer
//                    holds, and keeps one editor view across selections:
//                    show(item) swaps the text in place.
//
// Edits are browser drafts (PowerShellWorkspace.saveDraft). The Overview
// lists them and publishes them together to a new branch; nothing here
// writes to GitHub or records an installation.
//
// The deck mounts it per slide by setAttribute('x-data', 'powershellFile()'),
// the slide element carrying its context as `__psFile` ({ ctx, item, index }),
// the back-pointer idiom docs/loader.md describes. The Overview passes its
// context as the argument: x-data="powershellFile(fileCtx())".
document.addEventListener('alpine:init', () => {
  Alpine.data('powershellFile', function (ctxArg) {
    const W = () => window.PowerShellWorkspace, L = () => window.PowerShellLanguage;
    const short = sha => String(sha || '').slice(0, 7);
    let ctx = null, editor = null, editorFailed = false, alive = true, source = null, saving = Promise.resolve();
    let index = null, shownKey = '', generation = 0;
    const lines = t => t === '' ? [] : t.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
    return {
      item: null, inline: false, ready: false, loading: true, error: '', notice: '', pane: 'code', editing: false, plain: false,
      text: '', base: null, draft: false, ansi: false, saveState: '', discardAsk: false,
      analysis: { symbols: [], diagnostics: [], references: [] }, diffRows: [],

      template: `
        <div class="flex flex-col h-full min-h-0" data-ps-file>
          <div class="flex items-center gap-2 px-2 py-1.5 border-b border-base-200 shrink-0">
            <div class="min-w-0 overflow-x-auto shrink">
              <div role="tablist" class="tabs tabs-box tabs-sm flex-nowrap w-max" data-tabs>
                <template x-for="p in panes" :key="p.key">
                  <button role="tab" class="tab whitespace-nowrap" :class="pane === p.key && 'tab-active'" :aria-selected="pane === p.key"
                          @click="setPane(p.key)" x-text="p.label"></button>
                </template>
              </div>
            </div>
            <span class="ml-auto text-xs text-base-content/60 truncate min-w-0" x-text="saveState" data-save-state></span>
            <template x-if="inline"><div class="flex items-center shrink-0" data-file-actions>
              <template x-for="a in actions" :key="a.title">
                <button @click="a.onClick()" class="btn btn-ghost btn-sm btn-square" :title="a.title" :aria-label="a.title"><i class="ph text-lg" :class="a.icon"></i></button>
              </template>
              <div class="dropdown dropdown-end">
                <button tabindex="0" class="btn btn-ghost btn-sm btn-square" title="File actions" aria-label="File actions"><i class="ph ph-dots-three-vertical text-lg"></i></button>
                <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box border border-base-300 shadow z-20 w-64 p-1 mt-1" data-file-menu>
                  <template x-for="r in menuRows()" :key="r.label">
                    <li>
                      <a x-show="r.href" :href="r.href" target="_blank" rel="noopener"><i class="ph text-lg" :class="r.icon"></i><span x-text="r.label"></span></a>
                      <button x-show="!r.href" @click="document.activeElement?.blur(); r.onClick()"><i class="ph text-lg" :class="r.icon"></i><span x-text="r.label"></span></button>
                    </li>
                  </template>
                </ul>
              </div>
            </div></template>
          </div>
          <p x-show="error" x-cloak class="text-error text-sm px-3 py-2" x-text="error"></p>
          <p x-show="notice" x-cloak class="text-sm px-3 py-2 bg-warning/10" x-text="notice"></p>
          <div x-show="discardAsk" x-cloak class="flex flex-wrap items-center gap-2 px-3 py-2 bg-error/10 text-sm" data-discard>
            <span class="grow">Discard this browser draft and return to the GitHub version?</span>
            <button @click="discard()" class="btn btn-error btn-sm">Discard draft</button>
            <button @click="discardAsk = false" class="btn btn-ghost btn-sm">Keep</button>
          </div>
          <div x-show="loading && item" class="flex justify-center py-16"><span class="loading loading-dots loading-md opacity-30"></span></div>
          <!-- Class bindings, not x-show: x-show defers a hide to the next
               frame, so a quick flip between panes left the wrong one shown. -->
          <div :class="!loading && pane === 'code' ? '' : 'hidden'" class="grow min-h-0 relative">
            <div data-editor-host :class="plain ? 'hidden' : ''" class="absolute inset-0 overflow-hidden text-sm"></div>
            <pre data-plain :class="plain ? '' : 'hidden'" class="absolute inset-0 overflow-auto p-3 font-mono text-sm bg-base-100" x-text="text"></pre>
          </div>
          <div :class="!loading && pane === 'work' ? '' : 'hidden'" class="grow min-h-0 overflow-auto font-mono text-sm leading-6" data-work role="table"
               :aria-label="(work?.label || '') + ' compared with GitHub now'">
            <div class="sticky top-0 bg-base-200 text-xs text-base-content/70 py-1.5 px-3 flex flex-wrap gap-x-4 font-sans">
              <span x-text="'− ' + (work?.label || '')"></span><span x-text="'+ GitHub now at ' + headRevision"></span></div>
            <template x-for="(r, i) in (work?.rows || [])" :key="i">
              <div class="flex min-w-max" role="row" :class="r.type === 'add' ? 'bg-success/10' : r.type === 'del' ? 'bg-error/10' : ''">
                <span class="w-10 text-right shrink-0 text-base-content/60 text-xs px-1 pt-0.5" role="rowheader" x-text="r.type === 'del' ? r.a : r.b"></span>
                <span class="w-6 text-center shrink-0" role="cell" :aria-label="r.type === 'add' ? 'Added' : r.type === 'del' ? 'Removed' : 'Unchanged'" x-text="r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '"></span>
                <pre class="pr-4" role="cell" x-text="r.text || ' '"></pre></div>
            </template>
          </div>
          <div :class="!loading && pane === 'draft' ? '' : 'hidden'" class="grow min-h-0 overflow-auto font-mono text-sm leading-6" data-changes>
            <div class="sticky top-0 bg-base-200 text-xs text-base-content/70 py-1.5 px-3 flex flex-wrap gap-x-4 font-sans">
              <span x-text="'− GitHub at ' + short(base?.revision)"></span><span>+ browser draft</span></div>
            <p x-show="!draft" class="font-sans text-base-content/60 px-3 py-4">No changes: this is the GitHub version.</p>
            <template x-for="(r, i) in diffRows" :key="i">
              <div class="flex min-w-max" :class="r.type === 'add' ? 'bg-success/10' : r.type === 'del' ? 'bg-error/10' : ''">
                <span class="w-10 text-right shrink-0 text-base-content/60 text-xs px-1 pt-0.5" x-text="r.type === 'del' ? r.a : r.b"></span>
                <span class="w-6 text-center shrink-0" x-text="r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '"></span>
                <pre class="pr-4" x-text="r.text || ' '"></pre></div>
            </template>
          </div>
          <div :class="!loading && (pane === 'problems' || pane === 'outline') ? '' : 'hidden'" class="grow min-h-0 overflow-y-auto py-1" data-insights>
            <template x-for="(entry, i) in entries" :key="i">
              <button @click="goLine(entry.line)" class="w-full text-left px-3 py-1.5 text-base flex gap-3 hover:bg-base-200">
                <span class="font-mono text-xs pt-1 w-8 text-right shrink-0 text-base-content/60" x-text="entry.line"></span>
                <span class="min-w-0 break-words" x-text="entry.message || entry.name"></span>
                <span class="text-sm text-base-content/60 ml-auto shrink-0" x-text="entry.detail || entry.kind || entry.rule"></span>
              </button>
            </template>
            <p x-show="!entries.length" class="text-sm text-base-content/60 px-3 py-4"
               x-text="pane === 'problems' ? 'No browser checks reported. PowerShell runtime validation is still required.' : 'No entries found.'"></p>
          </div>
        </div>`,

      async init() {
        this.$el.innerHTML = this.template;
        if (ctxArg) { ctx = ctxArg; index = 'inline'; this.inline = true; }
        else { ({ ctx, item: this.item } = this.$el.__psFile); index = this.$el.__psFile.index; }
        ctx.cards.set(index, this);
        const host = this.$el.querySelector('[data-editor-host]');
        // The Overview's own hooks, so its tests and drop ring reach the parts
        // they name: the tab list, the editor box, its <pre>, the work diff.
        if (this.inline) {
          this.$el.querySelector('[data-tabs]').setAttribute('data-source-views', '');
          host.setAttribute('data-source-editor', '');
          this.$el.querySelector('[data-plain]').setAttribute('data-source-plain', '');
          this.$el.querySelector('[data-work]').setAttribute('data-source-diff', '');
          // The Overview's Code or Changes choice and this pane move together.
          this.$watch(() => ctx.view(), v => this.followView(v));
        }
        Alpine.initTree(this.$el.firstElementChild);
        // The deck steps slides on Left/Right and dismisses on Escape at the
        // window. Inside the editor those keys are the editor's.
        host.addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) e.stopPropagation(); });
        host.addEventListener('editor-escape', () => { if (this.editing) this.setEditing(false); });
        await this.show(this.inline ? ctx.selected() : this.item);
      },
      destroy() {
        alive = false;
        if (this.editing) ctx?.lockSwipe?.(false);
        editor?.destroy(); editor = null;
        if (ctx?.cards.get(index) === this) ctx.cards.delete(index);
      },

      // Load a file into this instance. The deck calls it once per slide; the
      // Overview on every selection, so its one editor view is reused.
      async show(item, force = false) {
        const key = item ? [ctx.revision, item.path, item.blobSha].join('\n') : '';
        if (!force && key === shownKey) { ctx.shown?.(this.loading ? 'loading' : this.error ? 'error' : this.plain ? 'plain' : 'editor'); return; }
        shownKey = key;
        const gen = ++generation;
        if (this.editing) this.setEditing(false);
        Object.assign(this, { item, loading: !!item, error: '', notice: '', discardAsk: false, draft: false, ansi: false, diffRows: [], saveState: '' });
        if (this.pane === 'draft') this.pane = 'code';
        source = null;
        if (!item) return;
        try {
          await ctx.ready?.();
          const src = await ctx.read(item);
          if (!alive || gen !== generation) return;
          source = src;
          this.ansi = source.encoding === 'windows-1252';
          const d = this.ansi ? null : ctx.drafts.get(item.path);
          this.base = d ? { revision: d.baseRevision, blob: d.baseBlob, text: d.baseText } : { revision: source.revision, blob: source.sha, text: source.text };
          this.text = d ? d.text : source.text;
          this.draft = !!d && W().changed(d);
          if (d && item.blobSha && d.baseBlob !== item.blobSha) this.notice = 'GitHub changed this file after the draft began, so it cannot be published as is. Copy the draft text, discard the draft and reapply the edit.';
          this.saveState = this.draft ? 'Browser draft' : (this.ansi ? 'Windows-1252 · ' : '') + 'GitHub ' + short(source.revision);
          if (this.ansi) this.notice = 'This file is Windows-1252, the encoding Windows PowerShell 5.1 assumes without a BOM. It is read-only here, because saving it would change its encoding to UTF-8.';
          this.analyze();
          this.loading = false;
          if (this.inline) this.followView(ctx.view());
          await this.$nextTick();
          await this.mountEditor(item);
          if (!alive || gen !== generation) return;
          ctx.shown?.(this.plain ? 'plain' : 'editor');
          ctx.theme(item).then(() => { if (alive && gen === generation) this.analyze(); }, () => {});
          if (ctx.active?.() === index) this.header();
        } catch (e) {
          if (alive && gen === generation) { this.error = e.message || String(e); this.loading = false; ctx.shown?.('error'); }
        }
      },
      async mountEditor(item) {
        if (!editor && !editorFailed) {
          const host = this.$el.querySelector('[data-editor-host]');
          try {
            const made = await window.PowerShellEditor.create(host, { value: this.text, path: item.path, readOnly: true, wrap: true,
              onChange: t => this.edit(t), onSave: () => this.persist() });
            if (!alive) { made?.destroy(); return; }
            editor = made;
          } catch { editorFailed = true; }
        }
        this.plain = !editor; this.ready = !!editor;
        editor?.open(item.path, this.text, item.path);
        if (editor) this.$nextTick(() => editor?.refresh());
      },

      refresh() { editor?.refresh(); },
      short,
      get headRevision() { return short(ctx?.revision); },
      // What the work computer is known to hold against GitHub now, when the
      // Overview has it; the deck has no such evidence.
      get work() { return this.inline ? ctx.workCopy() : null; },
      get panes() {
        const n = this.analysis.diagnostics.length;
        return [{ key: 'code', label: 'Code' }, ...(this.work ? [{ key: 'work', label: 'Work copy' }] : []),
          ...(this.draft ? [{ key: 'draft', label: 'Draft' }] : []),
          { key: 'problems', label: 'Problems' + (n ? ' ' + n : '') }, { key: 'outline', label: 'Outline' }];
      },
      get entries() { return this.pane === 'problems' ? this.analysis.diagnostics : this.pane === 'outline' ? this.analysis.symbols : []; },
      setPane(p) {
        this.pane = p;
        if (p === 'draft') this.buildDiff();
        if (p === 'code') this.$nextTick(() => editor?.refresh());
        if (this.inline) ctx.onPane(p);
      },
      followView(v) {
        if (v === 'changes' && this.work && this.pane !== 'work') this.pane = 'work';
        else if (v === 'code' && this.pane === 'work') { this.pane = 'code'; this.$nextTick(() => editor?.refresh()); }
      },
      goLine(line) { this.setPane('code'); this.$nextTick(() => editor?.go(line)); },
      analyze() {
        const a = L().inspect(this.text, this.item.path);
        const theme = /\.xaml$/i.test(this.item.path) ? ctx.themeText(this.item) : null;
        if (theme !== null) a.diagnostics = [...a.diagnostics, ...L().compareTheme(this.text, theme).diagnostics].sort((x, y) => x.line - y.line);
        this.analysis = a;
      },
      buildDiff() {
        if (!this.draft || !window.textDiff?.lines) { this.diffRows = []; return; }
        const a = lines(this.base.text), b = lines(this.text);
        this.diffRows = window.textDiff.lines(a, b).map(op => ({ type: op.type, a: op.a === undefined ? '' : op.a + 1,
          b: op.b === undefined ? '' : op.b + 1, text: op.type === 'add' ? b[op.b] : a[op.a] }));
      },

      // ── Editing ──────────────────────────────────────────────────────────
      get canEdit() { return this.ready && !this.ansi && !this.loading && !!this.item && this.item.comparable !== false && !this.error; },
      setEditing(on) {
        if (on && !this.canEdit) { if (this.plain) this.error = 'The editor did not load, so this file can only be read here.'; return; }
        this.editing = !!on;
        editor?.readOnly(!this.editing);
        ctx.lockSwipe?.(this.editing);
        if (this.editing) { this.setPane('code'); this.$nextTick(() => editor?.focus()); }
        this.header();
      },
      edit(text) {
        if (text === this.text) return;
        this.text = text; this.analyze(); this.persist();
        if (this.pane === 'draft') this.buildDiff();
      },
      record() {
        return { repo: ctx.repo, project: ctx.project, ref: ctx.ref, path: this.item.path, baseRevision: this.base.revision,
          baseBlob: this.base.blob, baseText: this.base.text, text: this.text, updatedAt: new Date().toISOString() };
      },
      persist() {
        const copy = this.record(), gen = generation;
        W().rememberDraft(copy);
        this.saveState = 'Saving…';
        saving = saving.catch(() => {}).then(() => W().changed(copy) ? W().saveDraft(copy) : W().removeDraft(copy)).then(() => {
          W().forgetRecovery(copy);
          if (W().changed(copy)) ctx.drafts.set(copy.path, copy); else ctx.drafts.delete(copy.path);
          ctx.onDraft?.();
          if (!alive || gen !== generation || copy.text !== this.text) return;
          this.draft = W().changed(copy);
          this.saveState = this.draft ? 'Saved in this browser' : 'GitHub ' + short(this.base.revision);
          if (index === ctx.active?.()) this.header();
        }, e => { if (alive) { this.saveState = 'Save failed'; this.error = 'The browser draft was not saved. ' + (e.message || e); } });
        return saving;
      },
      async discard() {
        this.discardAsk = false;
        if (this.editing) this.setEditing(false);
        const copy = { ...this.record(), text: this.base.text };
        W().rememberDraft(copy);
        try { await W().removeDraft(copy); } catch (e) { this.error = 'Could not remove the browser draft: ' + (e.message || e); return; }
        ctx.drafts.delete(copy.path);
        ctx.onDraft?.();
        // Back to the pinned GitHub source, not the draft's older base.
        this.base = { revision: source.revision, blob: source.sha, text: source.text };
        this.text = source.text; this.draft = false; this.notice = '';
        if (this.pane === 'draft') this.pane = 'code';
        editor?.open(this.item.path + '#' + Date.now(), this.text, this.item.path);
        this.saveState = 'GitHub ' + short(source.revision);
        this.analyze(); this.buildDiff(); this.header();
      },

      // ── Actions: the deck header when on screen, else this pane's own bar ─
      get actions() {
        const act = (icon, title, onClick) => ({ icon, title, onClick });
        return this.editing
          ? [act('ph-arrow-u-up-left', 'Undo', () => editor?.command('undo')), act('ph-arrow-u-up-right', 'Redo', () => editor?.command('redo')),
             act('ph-check', 'Done editing', () => this.setEditing(false))]
          : this.canEdit ? [act('ph-pencil-simple', 'Edit', () => this.setEditing(true))] : [];
      },
      header() {
        const h = ctx.handle; if (!h || this.inline) return;
        h.setTitle(this.item.name);
        h.setSubtitle([this.item.area, this.draft ? 'browser draft' : ''].filter(Boolean).join(' · '));
        h.setActions([...this.actions,
          { icon: 'ph-dots-three-vertical', title: 'File actions', onClick: (d, btn) => d.menu(btn, this.menuRows(), { width: 'w-64' }) }]);
      },
      // The Overview's own bar already copies the GitHub text and its status
      // menu offers the install script, so inline the menu leaves them out.
      menuRows() {
        const it = this.item; if (!it) return [];
        const rows = [{ label: 'Find', icon: 'ph-magnifying-glass', onClick: () => { this.setPane('code'); this.$nextTick(() => editor?.command('find')); } }];
        if (it.companion && ctx.has(it.companion)) rows.push({ label: 'Companion: ' + it.companion.split('/').pop(), icon: 'ph-files', onClick: () => ctx.go(it.companion) });
        if (source && !this.inline) {
          rows.push({ label: 'Copy GitHub text', icon: 'ph-copy', onClick: () => this.copy(source.text, 'GitHub text copied.') });
          if (it.installs !== null && ctx.behind?.(it.path)) rows.push({ label: 'Copy install script', icon: 'ph-terminal-window', onClick: () => this.copyScript() });
        }
        if (this.draft) {
          rows.push({ label: 'Copy draft text', icon: 'ph-clipboard-text', onClick: () => this.copy(this.text, 'Draft text copied.') });
          rows.push({ label: 'Discard draft…', icon: 'ph-trash', onClick: () => { this.discardAsk = true; } });
          rows.push({ label: 'Publish drafts…', icon: 'ph-git-pull-request', onClick: () => ctx.publish(it.path) });
        }
        const url = window.GithubLinks?.pathUrl?.(ctx.repo, it.path, source?.revision || ctx.ref);
        if (url) rows.push({ label: 'Open on GitHub', icon: 'ph-github-logo', href: url });
        return rows;
      },
      async copy(text, done) {
        try { await navigator.clipboard.writeText(text); window.Alpine.store('toast')?.('copy', done, 'alert-info', 3000); }
        catch (e) { this.error = 'Copy failed: ' + (e?.message || e); }
      },
      async copyScript() {
        try {
          // The bytes as GitHub holds them: kept from the Windows-1252 read,
          // and for UTF-8 the decoded text re-encodes exactly (the BOM is kept).
          const script = window.Installation.transferScript({ path: this.item.path, name: this.item.name, installs: this.item.installs,
            root: ctx.root, revision: source.revision, blobSha: source.sha, bytes: source.bytes || new TextEncoder().encode(source.text) });
          ctx.transferred(this.item.path);
          await this.copy(script, 'Install script copied. Run it in Windows PowerShell on the work computer to write this file there, then Confirm installed.');
        } catch (e) { this.error = 'Transfer script failed: ' + (e?.message || e); }
      },
    };
  });
});
