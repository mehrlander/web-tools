// here-view.js — This browser, the Web Tools app's view at ?view=here.
//
// One page for what the app keeps in THIS browser, for THIS origin
// (mehrlander.github.io): the GitHub token, a note naming the browser, and an
// inventory of localStorage and IndexedDB. Browser storage is filed by origin
// and kept per browser, per profile and, on iOS, per home-screen app, so every
// line here is true of this pairing only. Other websites keep their own
// storage, which no page on this origin can read.
//
// It is also where a failed GitHub read lands. gh-auth.js hands a 401 or 403
// to the app's onFail handler, the shell routes here (routeAuthFail), and the
// failure is explained beside the token it concerns: which read failed, what
// GitHub said, and what the token's own record shows. ?next= is the address
// to return to. The view never makes a read that could fail back into itself:
// its one GitHub call is a plain fetch, outside GH.prototype.req, which is the
// only path gh-auth watches.
//
// The browser note is a name the reader gives this browser (wt:browserNote).
// It is unverified by design and goes nowhere. Because it is set on purpose,
// its absence is evidence: no note and no token means this storage is new or
// was cleared, while a note with no token means the token alone was removed.
//
// The inventory is read-only. Browsing records and deleting stay in
// popups/idb-nav.html, which this view links to. Registered as
// Alpine.data('hereView').
document.addEventListener('alpine:init', function () {
  Alpine.data('hereView', function () {

    const NOTE_KEY = 'wt:browserNote';
    const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

    // The kind of browser, never the machine: two laptops running Chrome on
    // Windows read alike. maxTouchPoints is the touch signal iPadOS does not
    // misreport, unlike the user-agent string (the same reading fab.js makes
    // for the Shortcuts bridge).
    function detectContext() {
      const nav = window.navigator || {};
      let standalone = false, touch = false;
      try { standalone = !!nav.standalone || window.matchMedia('(display-mode: standalone)').matches; } catch (e) {}
      try { touch = (nav.maxTouchPoints || 0) > 1; } catch (e) {}
      const ua = String(nav.userAgent || '');
      const browser = /Edg\//.test(ua) ? 'Edge'
        : /CriOS\//.test(ua) ? 'Chrome'
        : /FxiOS\/|Firefox\//.test(ua) ? 'Firefox'
        : /Chrome\//.test(ua) ? 'Chrome'
        : /Safari\//.test(ua) ? 'Safari' : 'an unrecognized browser';
      const os = /iPhone/.test(ua) ? 'iPhone'
        : /iPad/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'iPad'
        : /Android/.test(ua) ? 'Android'
        : /Windows/.test(ua) ? 'Windows'
        : /CrOS/.test(ua) ? 'ChromeOS'
        : /Macintosh/.test(ua) ? 'Mac'
        : /Linux/.test(ua) ? 'Linux' : '';
      return { browser, os, standalone, touch };
    }

    function tokenKind(t) {
      if (/^github_pat_/.test(t)) return 'fine-grained token';
      if (/^ghp_/.test(t)) return 'classic token';
      if (/^gho_/.test(t)) return 'OAuth token';
      if (/^gh[usr]_/.test(t)) return 'GitHub App token';
      if (/^[a-f0-9]{40}$/.test(t)) return 'classic token, older format';
      return 'unrecognized format';
    }

    // Who writes each key, where the code says so. A key matching nothing is
    // shown without a label rather than called unknown: some keys are built at
    // runtime, and a missing label is not a claim that nothing writes it.
    const LS_OWNERS = [
      [/^ghToken$/, 'GitHub token', 'lib/gh-auth.js'],
      [/^wt:tokenMeta$/, 'Token record: saved, last accepted', 'lib/gh-auth.js'],
      [/^wt:browserNote$/, 'Browser note', 'this view'],
      [/^visits$/, 'Recent visits', 'the app shell'],
      [/^wt:(config|activity|sessions)/, 'When the app last checked a cache', 'the app shell'],
      [/^wt:dictate-handoff$/, 'Dictation handed between pages', 'the dictate-handoff kit'],
      [/^wt:stage-handoff$/, 'A paste handed to the Stage', 'the stage-handoff kit'],
      [/^(fab:|__fabDrawer$)/, 'Launcher state', 'lib/alpineComponents/fab.js'],
      [/^deckDock/, 'Deck docking', 'the app shell'],
      [/^stageAsidePct$/, 'Stage layout', 'lib/alpineComponents/stage.js'],
      [/^reviewDiffView$/, 'Review layout', 'lib/alpineComponents/file-review.js'],
      [/^pageReport:/, 'Page report', 'the page-report kit'],
      [/^(diffTool\.v2|diff_url[AB])$/, 'Diff tool', 'pages/diff-tool.html'],
    ];
    const lsOwner = (k) => {
      const hit = LS_OWNERS.find(([re]) => re.test(k));
      return hit ? { label: hit[1], src: hit[2] } : null;
    };

    // The databases web-tools code opens, by the persistence path's first
    // segment, plus the two legacy shelves the data shelf's importer reads.
    const IDB_OWNERS = {
      dataShelf: { label: 'Data shelf records', src: 'popups/data-shelf.html' },
      pdfInspect: { label: 'Saved views of the PDF inspector', src: 'pages/pdf-inspect.html' },
      'demo-persistence': { label: 'Persistence demo', src: 'lib/kits/demos/persistence.html' },
      DataJarDB: { label: 'DataJar, the older bookmarklet', legacy: true },
      DataShelfDB: { label: 'DataShelf version 1', legacy: true },
    };

    const fmtBytes = (n) => n == null ? '' : n < 1024 ? n + ' B'
      : n < 1024 * 1024 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB'
      : n < 1024 ** 3 ? (n / 1024 ** 2).toFixed(1) + ' MB' : (n / 1024 ** 3).toFixed(1) + ' GB';
    const fmtWhen = (ms) => {
      try { return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
      catch (e) { return new Date(ms).toISOString(); }
    };

    return {
      description: 'This browser: the GitHub token and why a read failed, a note naming the browser, and what this origin stores in localStorage and IndexedDB',

      host: location.host || location.origin,
      ctx: detectContext(),

      saved: '',
      meta: null,
      check: { state: 'idle', login: '', scopes: null, rateRem: null, rateLimit: null, error: '' },
      tokenDraft: '',
      tokenMsg: '',

      note: '',
      noteDraft: '',
      noteMsg: '',

      lsRows: [],
      lsErr: '',
      usage: null,
      quota: null,
      persisted: null,
      dbs: [],
      dbState: 'idle',   // idle | loading | ok | unlisted | error
      dbErr: '',

      template: `
        <div class="mx-auto max-w-5xl flex flex-col gap-4">
          <div>
            <h1 class="text-lg font-semibold flex items-center gap-2">
              <i class="ph ph-browser text-primary"></i>This browser
            </h1>
            <p class="text-base text-base-content/60 mt-1">
              <span class="font-mono" x-text="host"></span> in <span x-text="contextLine"></span>.
              Everything here belongs to this site in this browser only.
            </p>
          </div>

          <template x-if="fail">
            <div role="alert" class="alert alert-warning items-start">
              <i class="ph ph-warning-circle text-xl shrink-0"></i>
              <div class="flex flex-col gap-1 min-w-0">
                <div class="font-semibold" x-text="failTitle"></div>
                <div x-text="failBody"></div>
                <div class="text-sm opacity-80 font-mono break-all" x-text="failRequest"></div>
                <div class="text-sm opacity-80 break-words" x-show="fail.detail" x-text="'GitHub said: ' + fail.detail"></div>
              </div>
            </div>
          </template>

          <a x-show="next" :href="backHref" class="btn btn-sm btn-ghost self-start max-w-full">
            <i class="ph ph-arrow-left"></i><span class="truncate">Back to <span class="font-mono" x-text="next"></span></span>
          </a>

          <section class="rounded-box border border-base-300 bg-base-100 p-4 flex flex-col gap-3">
            <h2 class="font-semibold flex items-center gap-2"><i class="ph ph-key"></i>GitHub token</h2>
            <div class="flex items-start gap-2">
              <i class="ph text-lg shrink-0" :class="statusIcon"></i>
              <span x-text="statusLine"></span>
            </div>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" x-show="saved || check.rateLimit != null">
              <template x-if="saved">
                <div class="contents">
                  <dt class="text-base-content/60">Saved token</dt>
                  <dd><span class="font-mono" x-text="'…' + saved.slice(-4)"></span> · <span x-text="kind"></span></dd>
                  <dt class="text-base-content/60">Saved here</dt>
                  <dd x-text="savedLine"></dd>
                  <dt class="text-base-content/60">Last accepted</dt>
                  <dd x-text="acceptedLine"></dd>
                  <dt class="text-base-content/60" x-show="scopesLine">Scopes</dt>
                  <dd x-show="scopesLine" x-text="scopesLine"></dd>
                </div>
              </template>
              <dt class="text-base-content/60" x-show="check.rateLimit != null">Requests left</dt>
              <dd x-show="check.rateLimit != null" x-text="rateLine"></dd>
            </dl>
            <p class="text-sm text-base-content/70" x-show="diagnosis" x-text="diagnosis"></p>
            <div class="flex flex-wrap gap-2">
              <input type="password" x-model="tokenDraft" @keyup.enter="saveToken()"
                     :placeholder="saved ? 'Paste a new token to replace it' : 'Paste a GitHub token'"
                     autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
                     class="input input-bordered input-sm flex-1 min-w-56 font-mono">
              <button class="btn btn-sm btn-primary" @click="saveToken()" :disabled="!tokenDraft.trim()">
                <span x-text="next ? 'Save and go back' : 'Save'"></span>
              </button>
            </div>
            <p class="text-sm text-warning" x-show="tokenMsg" x-text="tokenMsg"></p>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=web-tools"
                 target="_blank" rel="noopener" class="link link-primary flex items-center gap-1">
                <i class="ph ph-arrow-square-out"></i>Get a token</a>
              <button x-show="saved" class="link link-hover text-base-content/60" @click="removeToken()">Remove the saved token</button>
            </div>
          </section>

          <section class="rounded-box border border-base-300 bg-base-100 p-4 flex flex-col gap-3">
            <h2 class="font-semibold flex items-center gap-2"><i class="ph ph-note-pencil"></i>Browser note</h2>
            <p class="text-sm text-base-content/70">
              A name for this browser in your own words, such as "iPhone home screen". It is kept
              beside the token and sent nowhere. Because you set it on purpose, finding it missing
              later means this storage is new or was cleared.
            </p>
            <div class="flex flex-wrap gap-2">
              <input type="text" x-model="noteDraft" @keyup.enter="saveNote()" maxlength="120"
                     :placeholder="'For example: ' + suggestion"
                     class="input input-bordered input-sm flex-1 min-w-56">
              <button class="btn btn-sm" @click="saveNote()" :disabled="noteDraft.trim() === note">Save note</button>
            </div>
            <p class="text-sm" x-show="note">This browser's note: <span class="font-medium" x-text="note"></span></p>
            <p class="text-sm text-base-content/60" x-show="!note">No note set in this browser.</p>
            <p class="text-sm text-success" x-show="noteMsg" x-text="noteMsg"></p>
          </section>

          <section class="rounded-box border border-base-300 bg-base-100 p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold flex items-center gap-2"><i class="ph ph-database"></i>Stored here</h2>
              <button class="btn btn-xs btn-ghost" @click="loadStorage()" :disabled="dbState === 'loading'">
                <i class="ph ph-arrow-clockwise"></i>Refresh</button>
            </div>
            <p class="text-sm text-base-content/70">
              What <span class="font-mono" x-text="host"></span> keeps in this browser, from every page on
              this site. Other websites keep their own storage, which this page cannot read.
              Read-only here: browse records and delete in the IndexedDB explorer.
            </p>
            <p class="text-sm" x-show="usageLine" x-text="usageLine"></p>

            <div class="flex flex-col gap-1">
              <h3 class="text-sm font-semibold">localStorage
                <span class="font-normal text-base-content/60" x-text="lsSummary"></span></h3>
              <p class="text-sm text-warning" x-show="lsErr" x-text="lsErr"></p>
              <ul class="divide-y divide-[var(--color-base-200)] text-sm" x-show="lsRows.length">
                <template x-for="r in lsRows" :key="r.key">
                  <li class="py-1.5 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-mono break-all" x-text="r.key"></div>
                      <div class="text-base-content/60" x-show="r.owner"
                           x-text="r.owner ? r.owner.label + ' · ' + r.owner.src : ''"></div>
                    </div>
                    <span class="shrink-0 tabular-nums text-base-content/60" x-text="r.size"></span>
                  </li>
                </template>
              </ul>
            </div>

            <div class="flex flex-col gap-1">
              <h3 class="text-sm font-semibold">IndexedDB
                <span class="font-normal text-base-content/60" x-text="dbSummary"></span></h3>
              <p class="text-sm text-base-content/60" x-show="dbState === 'loading'">Reading databases…</p>
              <p class="text-sm text-base-content/60" x-show="dbState === 'unlisted'">
                This browser does not list its databases to pages, so none can be shown here.</p>
              <p class="text-sm text-warning" x-show="dbState === 'error'" x-text="dbErr"></p>
              <ul class="divide-y divide-[var(--color-base-200)] text-sm" x-show="dbs.length">
                <template x-for="d in dbs" :key="d.name">
                  <li class="py-1.5 flex flex-col gap-0.5">
                    <div class="flex items-start justify-between gap-3">
                      <span class="font-mono break-all" x-text="d.name"></span>
                      <span class="shrink-0 tabular-nums text-base-content/60" x-text="d.records + (d.records === 1 ? ' record' : ' records')"></span>
                    </div>
                    <div class="text-base-content/60" x-show="d.owner"
                         x-text="d.owner ? d.owner.label + (d.owner.src ? ' · ' + d.owner.src : '') : ''"></div>
                    <div class="text-base-content/60" x-show="d.stores.length"
                         x-text="'Stores: ' + d.stores.map(s => s.name + ' (' + s.count + ')').join(', ')"></div>
                    <div class="text-warning" x-show="d.error" x-text="d.error"></div>
                    <a x-show="d.owner && d.owner.legacy" href="../popups/data-shelf.html" target="_blank" rel="noopener"
                       class="link link-primary w-fit">Bring its records forward with the data shelf's importer</a>
                  </li>
                </template>
              </ul>
            </div>

            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href="../popups/idb-nav.html" target="_blank" rel="noopener" class="link link-primary flex items-center gap-1">
                <i class="ph ph-arrow-square-out"></i>IndexedDB explorer</a>
              <a href="../popups/data-shelf.html" target="_blank" rel="noopener" class="link link-primary flex items-center gap-1">
                <i class="ph ph-arrow-square-out"></i>Data shelf</a>
            </div>
          </section>
        </div>`,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this.note = read(NOTE_KEY) || '';
        this.noteDraft = this.note;
        this.checkToken();
        this.loadStorage();
      },

      // ── Where the reader came from ─────────────────────────────────────────
      get fail() { return window.__shell?.authFail || null; },
      get next() { return window.__shell?.hereNext || ''; },
      get backHref() { return location.pathname + this.next; },

      get failTitle() {
        const f = this.fail;
        if (!f) return '';
        if (f.status === 401) return f.hadToken ? 'GitHub rejected the saved token' : 'GitHub refused the request (401)';
        if (f.status === 403 && f.rateRemaining === 0) {
          return f.hadToken ? 'This token has used its requests for the hour' : 'The anonymous request limit is used up';
        }
        if (f.status === 403) return 'GitHub refused the request (403)';
        return 'GitHub refused a request';
      },
      get failBody() {
        const f = this.fail;
        if (!f) return '';
        if (f.status === 401 && f.hadToken) return 'It has most likely expired or been revoked. Paste a new token below, or remove it to read public repositories without one.';
        if (f.status === 403 && f.rateRemaining === 0) {
          return f.hadToken ? 'The count resets within the hour.'
            : 'Without a token GitHub allows 60 requests an hour. Save a token below for 5,000.';
        }
        if (f.status === 403) return 'The token may lack permission for this request, or the repository restricts it.';
        return 'The request below is the one that failed.';
      },
      get failRequest() {
        const f = this.fail;
        if (!f || !f.path) return '';
        return (f.method || 'GET') + ' ' + (f.repo && !/^(https?:|\/)/.test(f.path) ? f.repo + ' · ' : '') + f.path;
      },

      // ── The context line ───────────────────────────────────────────────────
      get contextLine() {
        const c = this.ctx;
        return c.browser + (c.os ? ' on ' + c.os : '') + ', '
          + (c.standalone ? 'home-screen app' : 'browser tab') + ', '
          + (c.touch ? 'touch' : 'mouse and keyboard');
      },
      get suggestion() {
        const c = this.ctx;
        return (c.os ? c.os + ' ' : '') + c.browser + (c.standalone ? ', home screen' : '');
      },

      // ── The token ──────────────────────────────────────────────────────────
      get kind() { return tokenKind(this.saved); },
      get savedLine() {
        const m = this.meta;
        if (!m) return 'Not recorded (saved another way, or before the record existed)';
        return m.savedAt ? fmtWhen(m.savedAt) : 'Before the record existed';
      },
      get acceptedLine() {
        const m = this.meta;
        return m && m.okAt ? fmtWhen(m.okAt) + (m.login ? ' as ' + m.login : '') : 'Not recorded yet';
      },
      get scopesLine() {
        const s = this.check.scopes;
        if (!this.saved || this.check.state !== 'ok') return '';
        if (/^github_pat_/.test(this.saved)) return 'Not reported for fine-grained tokens';
        return s && s.length ? s.join(', ') : 'None';
      },
      get rateLine() {
        const c = this.check;
        if (c.rateLimit == null) return '';
        return (c.rateRem ?? '?').toLocaleString() + ' of ' + c.rateLimit.toLocaleString() + ' this hour';
      },
      get statusLine() {
        const c = this.check;
        switch (c.state) {
          case 'checking': return 'Checking with GitHub…';
          case 'ok': return 'GitHub accepts this token' + (c.login ? ' as ' + c.login : '') + '.';
          case 'rejected': return 'GitHub rejects this token (401).';
          case 'limited': return 'This token has used its requests for the hour.';
          case 'none': return 'No token is saved in this browser. Public repositories only, at 60 requests an hour.';
          case 'error': return 'Could not check with GitHub: ' + c.error;
          default: return '';
        }
      },
      get statusIcon() {
        return { ok: 'ph-shield-check text-success', rejected: 'ph-warning text-warning', limited: 'ph-hourglass text-warning',
                 none: 'ph-globe text-base-content/50', error: 'ph-wifi-slash text-warning' }[this.check.state]
          || 'ph-circle-notch animate-spin text-base-content/50';
      },
      // What the note and the token say together. The note is set on purpose,
      // so its presence or absence separates a token removed on its own from a
      // storage that was cleared or is new.
      get diagnosis() {
        const s = this.check.state;
        if (s === 'idle' || s === 'checking') return '';
        if (!this.saved) {
          return this.note
            ? 'This browser still holds its note, so the token alone was removed: by the button here, by "Retry without token" on a page, or from another tab.'
            : 'There is no browser note either. If you set one in this browser before, its storage has been cleared since. If not, this may be a browser or home-screen app that has not been set up yet.';
        }
        if (s === 'rejected') {
          return this.note
            ? 'The browser note is still here, so this storage was not cleared. GitHub has stopped accepting the token, which usually means it expired or was revoked.'
            : 'GitHub has stopped accepting the token, which usually means it expired or was revoked.';
        }
        return '';
      },

      // One plain fetch, deliberately outside GH.prototype.req: gh-auth watches
      // that path, and a check that failed into the failure handler would route
      // this view to itself. /rate_limit costs nothing against the limit, which
      // is why the no-token case asks it rather than /user.
      async checkToken() {
        this.saved = window.ghAuth?.resolve?.() || '';
        this.meta = window.ghAuth?.meta?.() || null;
        this.check = { state: 'checking', login: '', scopes: null, rateRem: null, rateLimit: null, error: '' };
        const c = { ...this.check };
        try {
          const headers = { Accept: 'application/vnd.github+json' };
          if (this.saved) headers.Authorization = 'Bearer ' + this.saved.trim();
          const res = await fetch('https://api.github.com/' + (this.saved ? 'user' : 'rate_limit'), { headers, cache: 'no-store' });
          const num = (h) => { const v = res.headers.get(h); return v == null || v === '' ? null : Number(v); };
          c.rateRem = num('x-ratelimit-remaining');
          c.rateLimit = num('x-ratelimit-limit');
          const scopes = res.headers.get('x-oauth-scopes');
          c.scopes = scopes == null ? null : scopes.split(',').map(s => s.trim()).filter(Boolean);
          if (res.status === 401) c.state = 'rejected';
          else if (res.status === 403 && c.rateRem === 0) c.state = 'limited';
          else if (!res.ok) { c.state = 'error'; c.error = 'GitHub answered ' + res.status; }
          else if (this.saved) {
            c.login = (await res.json())?.login || '';
            c.state = 'ok';
            window.ghAuth?.noteAccepted?.(c.login, headers.Authorization);
            this.meta = window.ghAuth?.meta?.() || null;
          } else {
            const core = (await res.json())?.resources?.core;
            if (core) { c.rateRem = core.remaining; c.rateLimit = core.limit; }
            c.state = 'none';
          }
        } catch (e) {
          c.state = 'error';
          c.error = (e && e.message) || String(e);
        }
        this.check = c;
      },

      // Saving reloads, as repo.js and fab.js do: a token is an account
      // boundary, and half a page painted without one is not worth reconciling.
      saveToken() {
        const t = this.tokenDraft.trim();
        if (!t) { this.tokenMsg = 'Nothing in the field yet'; return; }
        if (!window.ghAuth?.looksLikeToken?.(t)) {
          this.tokenMsg = 'That is ' + t.length + ' characters and does not look like a GitHub token (ghp_, github_pat_, or 40 hex characters)';
          return;
        }
        window.ghAuth.save(t);
        this.tokenDraft = '';
        if (this.next) location.replace(this.backHref); else location.reload();
      },
      removeToken() {
        if (!confirm('Remove the saved GitHub token from this browser?')) return;
        window.ghAuth.clear();
        location.reload();
      },

      // ── The note ───────────────────────────────────────────────────────────
      saveNote() {
        const v = this.noteDraft.trim();
        try {
          if (v) localStorage.setItem(NOTE_KEY, v); else localStorage.removeItem(NOTE_KEY);
        } catch (e) { this.noteMsg = 'This browser refused to save it: ' + ((e && e.message) || e); return; }
        this.note = v;
        this.noteDraft = v;
        this.noteMsg = v ? 'Saved.' : 'Note removed.';
        setTimeout(() => { this.noteMsg = ''; }, 2000);
        this.loadStorage();
      },

      // ── What this origin stores ────────────────────────────────────────────
      get lsSummary() {
        if (!this.lsRows.length) return this.lsErr ? '' : 'nothing stored';
        const bytes = this.lsRows.reduce((n, r) => n + r.bytes, 0);
        return this.lsRows.length + (this.lsRows.length === 1 ? ' key' : ' keys') + ' · ' + fmtBytes(bytes);
      },
      get dbSummary() {
        if (this.dbState !== 'ok') return '';
        if (!this.dbs.length) return 'no databases';
        return this.dbs.length + (this.dbs.length === 1 ? ' database' : ' databases');
      },
      // Two measurements, kept apart: Web Storage counts characters, and the
      // estimate covers quota-managed storage (IndexedDB, caches), not the
      // HTTP cache. Persistence is the browser's promise not to clear storage
      // on its own when space runs low.
      get usageLine() {
        const bits = [];
        if (this.usage != null) bits.push(fmtBytes(this.usage) + ' of quota storage used' + (this.quota ? ', of ' + fmtBytes(this.quota) + ' allowed' : ''));
        if (this.persisted === true) bits.push('marked persistent, so the browser will not clear it on its own');
        if (this.persisted === false) bits.push('not marked persistent, so the browser may clear it when space runs low');
        return bits.length ? bits.join('; ') + '.' : '';
      },

      async loadStorage() {
        const rows = [];
        this.lsErr = '';
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            const v = localStorage.getItem(k) || '';
            const bytes = (k.length + v.length) * 2;   // UTF-16 code units, as Traffic counts them
            rows.push({ key: k, bytes, size: fmtBytes(bytes), owner: lsOwner(k) });
          }
        } catch (e) { this.lsErr = 'This browser refused to list localStorage: ' + ((e && e.message) || e); }
        rows.sort((a, b) => a.key.localeCompare(b.key));
        this.lsRows = rows;

        try { const est = await navigator.storage.estimate(); this.usage = est.usage ?? null; this.quota = est.quota ?? null; }
        catch (e) { this.usage = null; this.quota = null; }
        try { this.persisted = await navigator.storage.persisted(); } catch (e) { this.persisted = null; }

        this.dbState = 'loading';
        this.dbErr = '';
        try {
          if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
            this.dbs = []; this.dbState = 'unlisted'; return;
          }
          await window.gh.load('kits/persistence.js');
          const idb = window.persistence.idb;
          const list = (await idb.databases()).filter(d => d && d.name)
            .sort((a, b) => a.name.localeCompare(b.name));
          const out = [];
          for (const d of list) {
            const row = { name: d.name, stores: [], records: 0, error: '', owner: IDB_OWNERS[d.name] || null };
            try {
              row.stores = await idb.storesDetail(d.name);
              row.records = row.stores.reduce((n, s) => n + (s.count || 0), 0);
            } catch (e) { row.error = 'Could not open: ' + ((e && e.message) || e); }
            out.push(row);
          }
          this.dbs = out;
          this.dbState = 'ok';
        } catch (e) {
          this.dbs = [];
          this.dbState = 'error';
          this.dbErr = 'Could not read IndexedDB: ' + ((e && e.message) || e);
        }
      },
    };
  });
});
