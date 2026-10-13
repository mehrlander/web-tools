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

    // What a localStorage value shows as in the deck: pretty JSON under a
    // .json name, so the viewer's own kind rule (ViewRegistry.READ_MODE) gives
    // it a tree or a table, and anything else as text. The saved token, and any
    // value shaped like a token, shows only its last four characters.
    const lsShown = (key) => {
      let v = '';
      try { v = localStorage.getItem(key) ?? ''; } catch (e) {}
      if (key === 'ghToken' || window.ghAuth?.looksLikeToken?.(v.trim())) {
        return { name: key + '.txt', content: '…' + v.trim().slice(-4) };
      }
      try {
        const parsed = JSON.parse(v);
        if (parsed !== null && typeof parsed === 'object') return { name: key + '.json', content: JSON.stringify(parsed, null, 2) };
      } catch (e) {}
      return { name: key + '.txt', content: v };
    };
    const lsSub = (r) => [r.owner && r.owner.label, r.owner && r.owner.src, r.size].filter(Boolean).join(' · ');

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
          <div class="flex flex-col gap-2">
            <h1 class="text-lg font-semibold flex items-center gap-2">
              <i class="ph ph-browser text-primary"></i>This browser
            </h1>
            <div class="text-sm text-base-content/60" x-text="contextLine"></div>
            <div class="flex flex-wrap items-center gap-2">
              <label class="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-56">
                <span class="text-base-content/60">Note</span>
                <input type="text" x-model="noteDraft" @keyup.enter="saveNote()" maxlength="120"
                       :placeholder="suggestion" class="grow">
              </label>
              <button class="btn btn-sm" @click="saveNote()" :disabled="noteDraft.trim() === note">Save</button>
              <span class="text-sm text-success" x-show="noteMsg" x-text="noteMsg"></span>
            </div>
          </div>

          <template x-if="fail">
            <div role="alert" class="alert alert-warning items-start text-base">
              <i class="ph ph-warning-circle text-xl shrink-0"></i>
              <div class="flex flex-col gap-1 min-w-0">
                <div class="font-semibold text-balance" x-text="failTitle"></div>
                <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5">
                  <dt class="text-sm opacity-70 pt-0.5">Request</dt>
                  <dd class="font-mono break-all" x-text="failRequest"></dd>
                  <template x-if="fail.detail">
                    <div class="contents">
                      <dt class="text-sm opacity-70 pt-0.5">GitHub</dt>
                      <dd x-text="fail.detail"></dd>
                    </div>
                  </template>
                </dl>
              </div>
            </div>
          </template>

          <a x-show="next" :href="backHref" class="btn btn-sm btn-ghost self-start max-w-full">
            <i class="ph ph-arrow-left"></i><span class="truncate">Back to <span class="font-mono" x-text="next"></span></span>
          </a>

          <section class="rounded-box border border-base-300 bg-base-100 p-4 flex flex-col gap-3">
            <h2 class="font-semibold flex items-center gap-2"><i class="ph ph-key"></i>GitHub token</h2>
            <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              <dt class="text-sm text-base-content/60 pt-0.5">Status</dt>
              <dd class="flex items-center gap-1.5"><i class="ph" :class="statusIcon"></i><span x-text="statusValue"></span></dd>
              <template x-if="cause">
                <div class="contents">
                  <dt class="text-sm text-base-content/60 pt-0.5">Likely cause</dt>
                  <dd x-text="cause"></dd>
                </div>
              </template>
              <template x-if="saved">
                <div class="contents">
                  <dt class="text-sm text-base-content/60 pt-0.5">Token</dt>
                  <dd><span class="font-mono" x-text="'…' + saved.slice(-4)"></span> · <span x-text="kind"></span></dd>
                  <dt class="text-sm text-base-content/60 pt-0.5">Saved</dt>
                  <dd x-text="savedLine"></dd>
                  <dt class="text-sm text-base-content/60 pt-0.5">Last accepted</dt>
                  <dd x-text="acceptedLine"></dd>
                </div>
              </template>
              <template x-if="scopesLine">
                <div class="contents">
                  <dt class="text-sm text-base-content/60 pt-0.5">Scopes</dt>
                  <dd x-text="scopesLine"></dd>
                </div>
              </template>
              <template x-if="check.rateLimit != null">
                <div class="contents">
                  <dt class="text-sm text-base-content/60 pt-0.5">Requests left</dt>
                  <dd class="tabular-nums" x-text="rateLine"></dd>
                </div>
              </template>
            </dl>
            <div class="flex flex-wrap gap-2">
              <input type="password" x-model="tokenDraft" @keyup.enter="saveToken()"
                     :placeholder="saved ? 'New token' : 'GitHub token'"
                     autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
                     class="input input-bordered input-sm flex-1 min-w-56 font-mono">
              <button class="btn btn-sm btn-primary" @click="saveToken()" :disabled="!tokenDraft.trim()">
                <span x-text="next ? 'Save and go back' : 'Save'"></span>
              </button>
            </div>
            <div class="text-sm text-warning" x-show="tokenMsg" x-text="tokenMsg"></div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=web-tools"
                 target="_blank" rel="noopener" class="link link-primary flex items-center gap-1">
                <i class="ph ph-arrow-square-out"></i>Get a token</a>
              <button x-show="saved" class="link link-hover text-base-content/60" @click="removeToken()">Remove token</button>
            </div>
          </section>

          <section class="rounded-box border border-base-300 bg-base-100 p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold flex items-center gap-2"><i class="ph ph-database"></i>Stored here</h2>
              <button class="btn btn-xs btn-ghost" @click="loadStorage()" :disabled="dbState === 'loading'">
                <i class="ph ph-arrow-clockwise"></i>Refresh</button>
            </div>
            <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              <dt class="text-sm text-base-content/60 pt-0.5">Origin</dt>
              <dd class="font-mono break-all" x-text="host"></dd>
              <template x-if="quotaLine">
                <div class="contents">
                  <dt class="text-sm text-base-content/60 pt-0.5">Quota storage</dt>
                  <dd class="tabular-nums" x-text="quotaLine"></dd>
                </div>
              </template>
              <template x-if="persisted != null">
                <div class="contents">
                  <dt class="text-sm text-base-content/60 pt-0.5">Persistent</dt>
                  <dd x-text="persisted ? 'yes' : 'no'"></dd>
                </div>
              </template>
            </dl>

            <div class="flex flex-col gap-1">
              <h3 class="font-semibold">localStorage
                <span class="font-normal text-sm text-base-content/60" x-text="lsSummary"></span></h3>
              <div class="text-sm text-warning" x-show="lsErr" x-text="lsErr"></div>
              <ul class="divide-y divide-[var(--color-base-200)]" x-show="lsRows.length">
                <template x-for="(r, i) in lsRows" :key="r.key">
                  <li>
                    <button type="button" @click="openLs(i)"
                            class="w-full text-left py-1.5 px-1 -mx-1 rounded flex items-start justify-between gap-3 hover:bg-base-200">
                      <div class="min-w-0">
                        <div class="font-mono break-all" x-text="r.key"></div>
                        <div class="text-sm text-base-content/60" x-show="r.owner"
                             x-text="r.owner ? r.owner.label + ' · ' + r.owner.src : ''"></div>
                      </div>
                      <span class="shrink-0 text-sm tabular-nums text-base-content/60" x-text="r.size"></span>
                    </button>
                  </li>
                </template>
              </ul>
            </div>

            <div class="flex flex-col gap-1">
              <h3 class="font-semibold">IndexedDB
                <span class="font-normal text-sm text-base-content/60" x-text="dbSummary"></span></h3>
              <div class="text-sm text-warning" x-show="dbState === 'error'" x-text="dbErr"></div>
              <ul class="divide-y divide-[var(--color-base-200)]" x-show="dbs.length">
                <template x-for="d in dbs" :key="d.name">
                  <li class="py-1.5 flex flex-col gap-0.5">
                    <div class="flex items-start justify-between gap-3">
                      <span class="font-mono break-all" x-text="d.name"></span>
                      <span class="shrink-0 text-sm tabular-nums text-base-content/60" x-text="d.records + (d.records === 1 ? ' record' : ' records')"></span>
                    </div>
                    <div class="text-sm text-base-content/60" x-show="d.owner"
                         x-text="d.owner ? d.owner.label + (d.owner.src ? ' · ' + d.owner.src : '') : ''"></div>
                    <div class="flex flex-wrap gap-1" x-show="d.stores.length">
                      <template x-for="s in d.stores" :key="s.name">
                        <button type="button" class="btn btn-xs btn-ghost gap-1" :disabled="!s.count" @click="openStore(d, s)">
                          <span class="font-mono" x-text="s.name"></span><span class="tabular-nums text-base-content/60" x-text="s.count"></span>
                        </button>
                      </template>
                    </div>
                    <div class="text-sm text-warning" x-show="d.error" x-text="d.error"></div>
                    <a x-show="d.owner && d.owner.legacy" href="../popups/data-shelf.html" target="_blank" rel="noopener"
                       class="text-sm link link-primary w-fit flex items-center gap-1">
                      <i class="ph ph-tray-arrow-down"></i>Import to the data shelf</a>
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
        if (f.status === 401) return f.hadToken ? 'Saved token rejected (401)' : 'Request refused (401)';
        if (f.status === 403 && f.rateRemaining === 0) return f.hadToken ? 'Hourly limit reached (403)' : 'Anonymous hourly limit reached (403)';
        if (f.status === 403) return 'Request refused (403)';
        return 'Request refused';
      },
      get failRequest() {
        const f = this.fail;
        if (!f || !f.path) return '';
        return (f.method || 'GET') + ' ' + (f.repo && !/^(https?:|\/)/.test(f.path) ? f.repo + ' · ' : '') + f.path;
      },

      // ── Identity: where this is, and the reader's name for it ──────────────
      get contextLine() {
        const c = this.ctx;
        return [this.host, c.browser, c.os, c.standalone ? 'home-screen app' : 'browser tab',
                c.touch ? 'touch' : 'mouse and keyboard'].filter(Boolean).join(' · ');
      },
      get suggestion() {
        const c = this.ctx;
        return (c.os ? c.os + ' ' : '') + c.browser + (c.standalone ? ', home screen' : '');
      },

      // ── The token: each getter is one field's value ────────────────────────
      get kind() { return tokenKind(this.saved); },
      get savedLine() {
        const m = this.meta;
        return m && m.savedAt ? fmtWhen(m.savedAt) : 'not recorded';
      },
      get acceptedLine() {
        const m = this.meta;
        return m && m.okAt ? fmtWhen(m.okAt) + (m.login ? ' as ' + m.login : '') : 'not recorded';
      },
      get scopesLine() {
        const s = this.check.scopes;
        if (!this.saved || this.check.state !== 'ok') return '';
        if (/^github_pat_/.test(this.saved)) return 'not reported for fine-grained tokens';
        return s && s.length ? s.join(', ') : 'none';
      },
      get rateLine() {
        const c = this.check;
        if (c.rateLimit == null) return '';
        return (c.rateRem ?? '?').toLocaleString() + ' / ' + c.rateLimit.toLocaleString() + ' per hour';
      },
      get statusValue() {
        const c = this.check;
        switch (c.state) {
          case 'checking': return 'checking…';
          case 'ok': return 'accepted' + (c.login ? ' as ' + c.login : '');
          case 'rejected': return 'rejected (401)';
          case 'limited': return 'hourly limit reached';
          case 'none': return 'none saved';
          case 'error': return 'check failed: ' + c.error;
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
      get cause() {
        const s = this.check.state;
        if (s === 'idle' || s === 'checking') return '';
        if (!this.saved) return this.note ? 'token removed · note kept' : 'storage new or cleared · no note';
        if (s === 'rejected') return this.note ? 'expired or revoked · note kept' : 'expired or revoked';
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
        if (!t) { this.tokenMsg = 'empty'; return; }
        if (!window.ghAuth?.looksLikeToken?.(t)) {
          this.tokenMsg = 'Not a token shape: ' + t.length + ' characters; expected ghp_, github_pat_ or 40 hex';
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
        } catch (e) { this.noteMsg = 'not saved: ' + ((e && e.message) || e); return; }
        this.note = v;
        this.noteDraft = v;
        this.noteMsg = v ? 'saved' : 'removed';
        setTimeout(() => { this.noteMsg = ''; }, 2000);
        this.loadStorage();
      },

      // ── What this origin stores ────────────────────────────────────────────
      get lsSummary() {
        if (!this.lsRows.length) return this.lsErr ? '' : 'none';
        const bytes = this.lsRows.reduce((n, r) => n + r.bytes, 0);
        return this.lsRows.length + (this.lsRows.length === 1 ? ' key' : ' keys') + ' · ' + fmtBytes(bytes);
      },
      get dbSummary() {
        if (this.dbState === 'loading') return 'reading…';
        if (this.dbState === 'unlisted') return 'not listed by this browser';
        if (this.dbState !== 'ok') return '';
        if (!this.dbs.length) return 'none';
        return this.dbs.length + (this.dbs.length === 1 ? ' database' : ' databases');
      },
      // The estimate covers quota-managed storage (IndexedDB, caches), not the
      // HTTP cache, and Web Storage is counted separately by lsSummary.
      // Persistent is the browser's promise not to clear storage on its own.
      get quotaLine() {
        if (this.usage == null) return '';
        return fmtBytes(this.usage) + (this.quota ? ' / ' + fmtBytes(this.quota) : '');
      },

      // ── Reading what is stored ─────────────────────────────────────────────
      // A localStorage key opens the whole set in the house swipe deck, on the
      // key tapped, each value in the shared viewer: the Stage reader's
      // arrangement (stage.js, _rRender), so a value reads the way a staged
      // file of its kind does.
      async openLs(start) {
        const rows = this.lsRows.slice();
        if (!rows[start]) return;
        await window.gh.load('kits/swipe-deck.js');
        const handle = window.swipeDeck.open({
          count: rows.length, start, icon: 'ph-hard-drives',
          title: rows[start].key, subtitle: lsSub(rows[start]),
          index: (n) => ({ title: rows[n].key, subtitle: lsSub(rows[n]) }),
          render: (n, slide) => {
            const el = document.createElement('div');
            el.className = 'flex flex-col h-full w-full min-w-0 overflow-hidden p-3';
            el.setAttribute('x-data', "viewer({ bindStore: false, fill: true, identify: false, "
              + "defaultMode: (f) => window.ViewRegistry.READ_MODE(f) })");
            slide.append(el);
            window.Alpine.initTree(el);
            const { name, content } = lsShown(rows[n].key);
            el.__viewer?.show(name, content, { local: true });
          },
          slideScroll: false,
          innerClass: 'h-full w-full min-w-0',
          immersive: true,
          release: (n, el) => { el.replaceChildren(); },
        });
        handle.deck.onSlide((n) => { handle.setTitle(rows[n].key); handle.setSubtitle(lsSub(rows[n])); });
      },

      // An IndexedDB store opens as its records, one per slide, in the record
      // deck. A store with out-of-line keys (every idb-keyval store) gets its
      // key as the first field, and a value that is not a plain object is held
      // under `value`, since the deck reads records.
      async openStore(d, s) {
        await window.gh.load('kits/swipe-deck.js');
        await window.gh.load('kits/record-deck.js');
        let entries = [];
        try { entries = await window.persistence.idb.readEntries(d.name, s.name); }
        catch (e) { d.error = 'not opened: ' + ((e && e.message) || e); return; }
        const outOfLine = s.keyPath === '(key)';
        const rows = entries.map(({ key, value }) => {
          const rec = value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype ? value : { value };
          return outOfLine ? { key, ...rec } : rec;
        });
        if (!rows.length) return;
        window.recordDeck.open({ rows, icon: 'ph-database', title: d.name + ' · ' + s.name,
          subtitle: rows.length + (rows.length === 1 ? ' record' : ' records') });
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
        } catch (e) { this.lsErr = 'not readable: ' + ((e && e.message) || e); }
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
            } catch (e) { row.error = 'not opened: ' + ((e && e.message) || e); }
            out.push(row);
          }
          this.dbs = out;
          this.dbState = 'ok';
        } catch (e) {
          this.dbs = [];
          this.dbState = 'error';
          this.dbErr = 'not readable: ' + ((e && e.message) || e);
        }
      },
    };
  });
});
