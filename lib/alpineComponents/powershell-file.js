// One PowerShell or XAML file as a slide of the Overview's file deck: the
// source in the editor, read-only until Edit, with its changes against GitHub,
// its Problems and its Outline beside it. The Overview is the list and opens
// the deck (installation-view.js, openFileDeck); this is what one slide holds.
//
// The deck owns the header, so a slide publishes its actions there when it is
// the one on screen: Edit or Done, Undo and Redo while editing, and one
// dropdown for the rest. Editing pauses the swipe, because a horizontal drag
// in code selects text or scrolls a line; the deck's dots, list and arrows
// still move between files.
//
// Edits are browser drafts (PowerShellWorkspace.saveDraft). The Overview
// lists them and publishes them together to a new branch; nothing here
// writes to GitHub or records an installation.
//
// Mounted per slide by setAttribute('x-data', 'powershellFile()'); the slide
// element carries its context as `__psFile` ({ ctx, item, index }), the
// back-pointer idiom docs/loader.md describes.
document.addEventListener('alpine:init', () => {
  Alpine.data('powershellFile', function () {
    const W = () => window.PowerShellWorkspace, L = () => window.PowerShellLanguage;
    const short = sha => String(sha || '').slice(0, 7);
    let ctx = null, editor = null, alive = true, source = null, saving = Promise.resolve();
    const lines = t => t === '' ? [] : t.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
    return {
      item: null, loading: true, error: '', notice: '', pane: 'code', editing: false, plain: false,
      text: '', base: null, draft: false, ansi: false, saveState: '', discardAsk: false,
      analysis: { symbols: [], diagnostics: [], references: [] }, diffRows: [],

      template: `
        <div class="flex flex-col h-full min-h-0" data-ps-file>
          <div class="flex items-center gap-2 px-2 py-1.5 border-b border-base-200 shrink-0">
            <div role="tablist" class="tabs tabs-box tabs-sm shrink-0">
              <template x-for="p in panes" :key="p.key">
                <button role="tab" class="tab" :class="pane === p.key && 'tab-active'" :aria-selected="pane === p.key"
                        @click="setPane(p.key)" x-text="p.label"></button>
              </template>
            </div>
            <span class="ml-auto text-xs text-base-content/60 truncate" x-text="saveState" data-save-state></span>
          </div>
          <p x-show="error" x-cloak class="text-error text-sm px-3 py-2" x-text="error"></p>
          <p x-show="notice" x-cloak class="text-sm px-3 py-2 bg-warning/10" x-text="notice"></p>
          <div x-show="discardAsk" x-cloak class="flex flex-wrap items-center gap-2 px-3 py-2 bg-error/10 text-sm" data-discard>
            <span class="grow">Discard this browser draft and return to the GitHub version?</span>
            <button @click="discard()" class="btn btn-error btn-sm">Discard draft</button>
            <button @click="discardAsk = false" class="btn btn-ghost btn-sm">Keep</button>
          </div>
          <div x-show="loading" class="flex justify-center py-16"><span class="loading loading-dots loading-md opacity-30"></span></div>
          <div x-show="!loading && pane === 'code'" class="grow min-h-0 relative">
            <div data-editor-host class="absolute inset-0 overflow-hidden text-sm"></div>
            <pre x-show="plain" x-cloak class="absolute inset-0 overflow-auto p-3 font-mono text-sm bg-base-100" x-text="text"></pre>
          </div>
          <div x-show="!loading && pane === 'changes'" x-cloak class="grow min-h-0 overflow-auto font-mono text-sm leading-6" data-changes>
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
          <div x-show="!loading && (pane === 'problems' || pane === 'outline')" x-cloak class="grow min-h-0 overflow-y-auto py-1" data-insights>
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
        Alpine.initTree(this.$el.firstElementChild);
        ({ ctx, item: this.item } = this.$el.__psFile);
        ctx.cards.set(this.$el.__psFile.index, this);
        const host = this.$el.querySelector('[data-editor-host]');
        // The deck steps slides on Left/Right and dismisses on Escape at the
        // window. Inside the editor those keys are the editor's.
        host.addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) e.stopPropagation(); });
        host.addEventListener('editor-escape', () => { if (this.editing) this.setEditing(false); });
        try {
          source = await ctx.read(this.item);
          if (!alive) return;
          this.ansi = source.encoding === 'windows-1252';
          const d = this.ansi ? null : ctx.drafts.get(this.item.path);
          this.base = d ? { revision: d.baseRevision, blob: d.baseBlob, text: d.baseText } : { revision: source.revision, blob: source.sha, text: source.text };
          this.text = d ? d.text : source.text;
          this.draft = !!d && W().changed(d);
          if (d && this.item.blobSha && d.baseBlob !== this.item.blobSha) this.notice = 'GitHub changed this file after the draft began, so it cannot be published as is. Copy the draft text, discard the draft and reapply the edit.';
          this.saveState = this.draft ? 'Browser draft' : (this.ansi ? 'Windows-1252 · ' : '') + 'GitHub ' + short(source.revision);
          if (this.ansi) this.notice = 'This file is Windows-1252, the encoding Windows PowerShell 5.1 assumes without a BOM. It is read-only here, because saving it would change its encoding to UTF-8.';
          this.analyze();
          this.loading = false;
          await this.$nextTick();
          try {
            editor = await window.PowerShellEditor.create(host, { value: this.text, path: this.item.path, readOnly: true, wrap: true,
              onChange: t => this.edit(t), onSave: () => this.persist() });
            if (!alive) { editor?.destroy(); editor = null; return; }
            editor.open(this.item.path, this.text, this.item.path);
          } catch { this.plain = true; }
          ctx.theme(this.item).then(() => { if (alive) this.analyze(); }, () => {});
          if (ctx.active() === this.$el.__psFile.index) this.header();
        } catch (e) { if (alive) { this.error = e.message || String(e); this.loading = false; } }
      },
      destroy() {
        alive = false;
        if (this.editing) ctx?.lockSwipe(false);
        editor?.destroy(); editor = null;
        if (ctx?.cards.get(this.$el.__psFile?.index) === this) ctx.cards.delete(this.$el.__psFile.index);
      },

      short,
      get panes() {
        const n = this.analysis.diagnostics.length;
        return [{ key: 'code', label: 'Code' }, { key: 'changes', label: this.draft ? 'Changes •' : 'Changes' },
          { key: 'problems', label: 'Problems' + (n ? ' ' + n : '') }, { key: 'outline', label: 'Outline' }];
      },
      get entries() { return this.pane === 'problems' ? this.analysis.diagnostics : this.pane === 'outline' ? this.analysis.symbols : []; },
      setPane(p) {
        this.pane = p;
        if (p === 'changes') this.buildDiff();
        if (p === 'code') this.$nextTick(() => editor?.refresh());
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
      setEditing(on) {
        if (on && (!editor || this.ansi)) { if (!editor) this.error = 'The editor did not load, so this file can only be read here.'; return; }
        this.editing = !!on;
        editor?.readOnly(!this.editing);
        ctx.lockSwipe(this.editing);
        if (this.editing) { this.setPane('code'); this.$nextTick(() => editor?.focus()); }
        this.header();
      },
      edit(text) {
        if (text === this.text) return;
        this.text = text; this.analyze(); this.persist();
        if (this.pane === 'changes') this.buildDiff();
      },
      record() {
        return { repo: ctx.repo, project: ctx.project, ref: ctx.ref, path: this.item.path, baseRevision: this.base.revision,
          baseBlob: this.base.blob, baseText: this.base.text, text: this.text, updatedAt: new Date().toISOString() };
      },
      persist() {
        const copy = this.record();
        W().rememberDraft(copy);
        this.saveState = 'Saving…';
        saving = saving.catch(() => {}).then(() => W().changed(copy) ? W().saveDraft(copy) : W().removeDraft(copy)).then(() => {
          W().forgetRecovery(copy);
          if (W().changed(copy)) ctx.drafts.set(copy.path, copy); else ctx.drafts.delete(copy.path);
          if (!alive || copy.text !== this.text) return;
          this.draft = W().changed(copy);
          this.saveState = this.draft ? 'Saved in this browser' : 'GitHub ' + short(this.base.revision);
          if (this.$el.__psFile.index === ctx.active()) this.header();
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
        // Back to the pinned GitHub source, not the draft's older base.
        this.base = { revision: source.revision, blob: source.sha, text: source.text };
        this.text = source.text; this.draft = false; this.notice = '';
        editor?.open(this.item.path + '#' + Date.now(), this.text, this.item.path);
        this.saveState = 'GitHub ' + short(source.revision);
        this.analyze(); this.buildDiff(); this.header();
      },

      // ── The deck header, while this slide is on screen ───────────────────
      header() {
        const h = ctx.handle; if (!h) return;
        h.setTitle(this.item.name);
        h.setSubtitle([this.item.area, this.draft ? 'browser draft' : ''].filter(Boolean).join(' · '));
        const act = (icon, title, onClick) => ({ icon, title, onClick });
        h.setActions(this.editing
          ? [act('ph-arrow-u-up-left', 'Undo', () => editor?.command('undo')), act('ph-arrow-u-up-right', 'Redo', () => editor?.command('redo')),
             act('ph-check', 'Done editing', () => this.setEditing(false)), act('ph-dots-three-vertical', 'File actions', (d, btn) => d.menu(btn, this.menuRows(), { width: 'w-64' }))]
          : [...(editor && !this.ansi ? [act('ph-pencil-simple', 'Edit', () => this.setEditing(true))] : []),
             act('ph-dots-three-vertical', 'File actions', (d, btn) => d.menu(btn, this.menuRows(), { width: 'w-64' }))]);
      },
      menuRows() {
        const it = this.item, rows = [{ label: 'Find', icon: 'ph-magnifying-glass', onClick: () => { this.setPane('code'); this.$nextTick(() => editor?.command('find')); } }];
        if (it.companion && ctx.has(it.companion)) rows.push({ label: 'Companion: ' + it.companion.split('/').pop(), icon: 'ph-files', onClick: () => ctx.go(it.companion) });
        if (source) {
          rows.push({ label: 'Copy GitHub text', icon: 'ph-copy', onClick: () => this.copy(source.text, 'GitHub text copied.') });
          rows.push({ label: 'Download', icon: 'ph-download-simple', onClick: () => window.io?.save?.(source.text, it.name, 'text/plain') });
          if (it.installs !== null) rows.push({ label: 'Copy transfer script', icon: 'ph-terminal-window', onClick: () => this.copyScript() });
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
          await this.copy(script, 'Transfer script copied. Run it in Windows PowerShell on the work computer, then Mark as installed.');
        } catch (e) { this.error = 'Transfer script failed: ' + (e?.message || e); }
      },
    };
  });
});
