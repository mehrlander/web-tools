// The stage-tab uploader: drop (or paste) a local file, designate where it
// goes in the open repo, and commit it. It composes two smaller components —
// dropZone (takes the file, hands over its bytes) and a bare mention picker
// (browse the repo tree to fill the destination path) — and adds the commit:
// a two-tap write of the held bytes to the chosen path on the open repo's
// default branch, via gh.saveBytes / gh.save (gh-store.js).
//
// This panel stands beside the ref-based stage list, not inside it: a dropped
// local file carries content, where a staged item is only a ref. Folding local
// files into the stage array proper is a follow-up.

document.addEventListener('alpine:init', function() {
  Alpine.data('uploader', function() {
    const dirOf = p => { const i = p.lastIndexOf('/'); return i === -1 ? '' : p.slice(0, i); };
    const join = (dir, name) => dir ? dir.replace(/\/+$/, '') + '/' + name : name;

    return {
      description: 'Stage-tab upload panel: drop or paste a file, browse the repo tree to set its destination path, and commit it to the open repo',

      template: `
        <div class="border border-base-300 rounded-lg bg-base-100 p-3 flex flex-col gap-3">
          <div class="text-xs font-bold opacity-70 flex items-center gap-1.5">
            <i class="ph ph-upload-simple"></i>Add a file to this repo
          </div>

          <!-- The drop target. Its drop-file event bubbles here. -->
          <div x-data="dropZone({ idle: 'Drop a file to commit', hint: 'or click to browse, or paste' })"
               @drop-file="onDropped($event.detail)"></div>

          <template x-if="pending">
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2 text-sm">
                <span class="flex items-center gap-2 min-w-0">
                  <i class="ph ph-file text-info shrink-0"></i>
                  <span class="font-mono truncate" x-text="pending.name || '(pasted text)'"></span>
                  <span class="opacity-50 shrink-0" x-text="fmtSize(pending.size)"></span>
                </span>
                <button @click="clear()" class="btn btn-ghost btn-xs w-6 h-6 p-0 opacity-40 hover:opacity-100 hover:text-error">
                  <i class="ph ph-x"></i>
                </button>
              </div>

              <div class="flex items-center gap-1.5">
                <input x-model="destPath" placeholder="path/in/repo/filename"
                       class="input input-sm input-bordered font-mono grow min-w-48" :disabled="committing">
                <button @click="browsing = !browsing" class="btn btn-sm btn-ghost gap-1"
                        :class="browsing && 'text-primary'" title="Browse the repo tree to set the folder">
                  <i class="ph ph-folder-open"></i>Browse
                </button>
              </div>

              <!-- The path designator: a bare mention picker over the open repo.
                   Picking a file sets the destination to that file's folder plus
                   the dropped filename; the field stays editable after. Mounted
                   only while browsing (x-if), so the tree fetch is on demand. -->
              <template x-if="browsing">
                <div x-collapse @mention-select="onPathPicked($event.detail)">
                  <div x-data="mention({ bare: true, placeholder: 'Type @ to find a folder, then pick a file inside it' })"></div>
                </div>
              </template>

              <div class="flex items-center justify-between gap-2">
                <button @click="commit()" :disabled="committing || !destPath.trim()"
                        class="btn btn-sm gap-1" :class="armed ? 'btn-error' : 'btn-primary'">
                  <i class="ph" :class="committing ? 'ph-circle-notch animate-spin' : 'ph-check'"></i>
                  <span x-text="commitLabel"></span>
                </button>
                <span class="text-[10px] font-mono opacity-60 truncate" x-text="status"></span>
              </div>
            </div>
          </template>
        </div>`,

      pending: null,     // { name, size, type, bytes, buf, isText, text }
      destPath: '',
      browsing: false,
      committing: false,
      armed: false,
      status: '',

      init() {
        this.$root.__uploader = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
      },

      get repo() { return Alpine.store('browser').repo; },
      get commitLabel() {
        return this.committing ? 'Committing…' : this.armed ? 'Commit here?' : 'Commit to ' + (this.repo || 'repo');
      },

      fmtSize(n) {
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(1) + ' MB';
      },

      // A file (or pasted text) arrived from the drop-zone. Hold it and seed a
      // sensible destination: the folder the explorer is currently showing, plus
      // the file's own name (a fallback name for a text paste).
      onDropped(d) {
        const folder = Alpine.store('browser').path || '';
        if (d.file || d.name) {
          this.pending = { name: d.name, size: d.size, type: d.type, bytes: d.bytes, buf: d.buf, isText: false };
          this.destPath = join(folder, d.name);
        } else {
          this.pending = { name: '', size: d.size, type: 'text/plain', text: d.text, isText: true };
          this.destPath = join(folder, 'pasted.txt');
        }
        this.armed = false;
        this.status = '';
      },

      // The tree picker emitted a chosen file path. Keep the dropped filename;
      // adopt the picked file's folder as the destination folder.
      onPathPicked(sel) {
        if (!this.pending) return;
        const name = this.pending.isText ? (this.destPath.split('/').pop() || 'pasted.txt') : this.pending.name;
        this.destPath = join(dirOf(sel.path), name);
        this.browsing = false;
      },

      clear() {
        this.pending = null;
        this.destPath = '';
        this.armed = false;
        this.status = '';
      },

      // Two-tap commit: first tap arms for 3s, second writes. Bytes go through
      // saveBytes (binary-safe); pasted text through save. Lands on the open
      // repo's default branch (the Contents API default), one commit.
      async commit() {
        if (this.committing || !this.pending) return;
        const path = this.destPath.trim();
        const toast = Alpine.store('toast');
        if (!path) return toast('warning', 'Set a destination path', 'alert-error', 4000);
        if (path.endsWith('/')) return toast('warning', 'Destination needs a filename, not just a folder', 'alert-error', 4000);
        if (!this.armed) {
          this.armed = true;
          setTimeout(() => { this.armed = false; }, 3000);
          return;
        }
        this.armed = false;
        this.committing = true;
        this.status = '';
        try {
          const s = Alpine.store('browser');
          if (!s.gh.save) await window.gh?.load('gh-store.js');
          if (!s.gh.saveBytes) throw new Error('gh-store.js unavailable');
          const msg = 'Add ' + path + ' via show-repo';
          if (this.pending.isText) await s.gh.save(path, this.pending.text, msg);
          else await s.gh.saveBytes(path, this.pending.bytes, msg);
          this.status = 'committed ' + path;
          toast('check-circle', 'Committed ' + path + ' to ' + s.repo, 'alert-success', 4000);
          // If the explorer is showing the destination folder, refresh it so
          // the new file appears without a manual reload.
          const folder = dirOf(path);
          const exp = document.getElementById('explorer')?.__explorer;
          if (exp && (exp.path || '') === folder) exp.load(folder, true);
          this.clear();
        } catch (e) {
          this.status = '';
          toast('warning', 'Commit failed: ' + (e.message || e), 'alert-error', 6000);
        }
        this.committing = false;
      }
    };
  });
});
