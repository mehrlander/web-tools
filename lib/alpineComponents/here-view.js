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
//
// THE PAGE TAB is the one exception to "this origin only". When the courier
// bookmark opened this window from another site (bookmarklets/courier-stage.js),
// the page it was tapped on can be asked to read ITS OWN storage and say what
// it found: kits/page-storage.js is the code that runs there, sent through the
// Stage's link (window.__courier, stage.js courierLink). The tab shows the same
// list and cards as Stored here, filled from those answers, and appears only
// while such a page is on the line (shell.courierHost). Nothing it reads is
// staged or sent; the values travel from the page into this window and stop.
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
    // Which cards hold a viewer, and each store's records once read, held
    // outside Alpine's reactive state: neither has any business in a proxy.
    const mounted = new Set();
    let storeCache = new Map();
    // One viewer in one host, handed one item, as the Stage reader mounts its
    // own (stage.js, _rRender). A card and a deck slide both come through here.
    const mountViewer = (host) => {
      const el = document.createElement('div');
      el.className = 'flex flex-col h-full w-full min-w-0 overflow-hidden';
      el.setAttribute('x-data', "viewer({ bindStore: false, fill: true, identify: false, "
        + "defaultMode: (f) => window.ViewRegistry.READ_MODE(f) })");
      host.replaceChildren(el);
      window.Alpine.initTree(el);
      return el;
    };
    const entriesToRows = (entries, outOfLine) => entries.map(({ key, value }) => {
      const rec = value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype ? value : { value };
      return outOfLine ? { key, ...rec } : rec;
    });
    const lsSub = (r) => [r.owner && r.owner.label, r.owner && r.owner.src, r.size].filter(Boolean).join(' · ');

    return {
      description: 'This browser: the GitHub token and why a read failed, a note naming the browser, what this origin stores in localStorage and IndexedDB, and, from the courier, what the page it was opened from stores',

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
      // Whose storage the list holds: this origin's ('here') or the courier
      // page's ('page'). The two tabs share the list, the strip and the deck,
      // and switching tabs reloads them from the other source.
      source: '',
      srcHost: '',
      pageErr: '',

      template: `
        <div class="@container h-full flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
            <h1 class="text-lg font-semibold flex items-center gap-2">
              <i class="ph ph-browser text-primary"></i>This browser
            </h1>
            <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 w-fit" role="tablist" data-slot="frame:tabs">
              <button role="tab" @click="setTab('token')" :aria-selected="tab === 'token'"
                      class="flex items-center gap-1.5 px-1.5 sm:px-2 md:px-3 py-1.5 rounded-md text-base font-medium transition-colors"
                      :class="tab === 'token' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                <i class="ph ph-key text-lg hidden md:inline-block"></i>Token</button>
              <button role="tab" @click="setTab('stored')" :aria-selected="tab === 'stored'"
                      class="flex items-center gap-1.5 px-1.5 sm:px-2 md:px-3 py-1.5 rounded-md text-base font-medium transition-colors"
                      :class="tab === 'stored' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                <i class="ph ph-database text-lg hidden md:inline-block"></i>Stored here<span x-show="source === 'here' && items.length" class="hidden sm:inline font-mono text-sm opacity-60" x-text="items.length"></span></button>
              <button role="tab" x-show="courierHost" x-cloak @click="setTab('page')" :aria-selected="tab === 'page'"
                      class="px-2 md:px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors"
                      :class="tab === 'page' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'"
                      :title="'What ' + courierHost + ' stores in this browser, read through the courier'">
                <i class="ph ph-globe-simple text-lg hidden md:inline-block"></i>Page<span class="hidden sm:inline font-mono text-sm opacity-60 max-w-[12rem] truncate" x-text="courierHost"></span></button>
            </div>
          </div>

          <div x-show="tab === 'token'" class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div class="max-w-5xl flex flex-col gap-3 pb-4">
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
            </div>
          </div>

          <!-- STORED HERE: A LIST OVER A STRIP OF ITS CARDS, the Waiting view's
               arrangement (waiting.js) and before it the Budget DRS Funding
               tabs' (home, app/view/views/corpora.js, corpusSwiper). Two
               containers split the pane's height and the page does not scroll:
               the list up to 40% of it, the strip the rest. A swipe moves the
               list's selection, kept in view inside the list; a pick moves the
               strip. The expander opens the deck over the same items at the
               card in view, and closing it lands where the swipe left off. At
               @3xl the two sit side by side. -->
          <div x-show="tab === 'stored' || tab === 'page'" class="flex-1 min-h-0 flex flex-col gap-3 @3xl:flex-row @3xl:gap-4" data-pattern="linked-swiper">
            <section class="shrink-0 min-h-0 max-h-[40%] flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100
                            @3xl:max-h-none @3xl:w-[22rem]">
              <div class="flex items-center gap-2 shrink-0 pl-3 pr-1 py-1 border-b border-base-300 bg-base-200/60">
                <span class="grow min-w-0 truncate text-sm text-base-content/60" x-text="storageLine"></span>
                <button type="button" class="btn btn-ghost btn-xs btn-square text-base-content/50 shrink-0" @click="reload()"
                        :disabled="dbState === 'loading'" aria-label="Refresh"><i class="ph ph-arrows-clockwise text-base"></i></button>
              </div>
              <div x-show="source === 'page' && pageErr" class="shrink-0 text-sm text-warning px-3 py-2 break-words" x-text="pageErr"></div>
              <!-- A page that did not answer listed nothing, so the sections
                   would claim "none" for storage nobody read. -->
              <div x-ref="list" x-show="!(source === 'page' && pageErr)" class="min-h-0 overflow-y-auto overscroll-contain p-1"
                   @keydown.down.prevent="key(1)" @keydown.up.prevent="key(-1)">
                <div class="flex items-center gap-2 px-2 pt-1">
                  <h3 class="font-semibold">localStorage</h3>
                  <span class="text-sm text-base-content/60" x-text="lsSummary"></span>
                </div>
                <div class="text-sm text-warning px-2" x-show="lsErr" x-text="lsErr"></div>
                <ul class="divide-y divide-[var(--color-base-200)]">
                  <template x-for="r in lsRows" :key="r.key">
                    <li>
                      <button type="button" @click="pick('ls:' + r.key)" :data-id="'ls:' + r.key"
                              :aria-current="shownId === 'ls:' + r.key ? 'true' : null"
                              class="w-full text-left py-1.5 px-2 rounded flex items-start justify-between gap-3"
                              :class="shownId === 'ls:' + r.key ? 'bg-primary/10' : 'hover:bg-base-200'">
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

                <div class="flex items-center gap-2 px-2 pt-3">
                  <h3 class="font-semibold">IndexedDB</h3>
                  <span class="text-sm text-base-content/60" x-text="dbSummary"></span>
                </div>
                <div class="text-sm text-warning px-2" x-show="dbState === 'error'" x-text="dbErr"></div>
                <template x-for="d in dbs" :key="d.name">
                  <div class="flex flex-col py-1.5 border-t border-[var(--color-base-200)] first:border-t-0">
                    <div class="flex items-start justify-between gap-3 px-2">
                      <span class="font-mono break-all" x-text="d.name"></span>
                      <span class="shrink-0 text-sm tabular-nums text-base-content/60"
                            x-text="d.records + (d.records === 1 ? ' record' : ' records')"></span>
                    </div>
                    <div class="text-sm text-base-content/60 px-2" x-show="d.owner"
                         x-text="d.owner ? d.owner.label + (d.owner.src ? ' · ' + d.owner.src : '') : ''"></div>
                    <div class="text-sm text-warning px-2" x-show="d.error" x-text="d.error"></div>
                    <a x-show="d.owner && d.owner.legacy" href="../popups/data-shelf.html" target="_blank" rel="noopener"
                       class="text-sm link link-primary w-fit flex items-center gap-1 px-2">
                      <i class="ph ph-tray-arrow-down"></i>Import to the data shelf</a>
                    <ul>
                      <template x-for="s in d.stores" :key="s.name">
                        <li>
                          <button type="button" @click="pick('idb:' + d.name + '/' + s.name)" :data-id="'idb:' + d.name + '/' + s.name"
                                  :aria-current="shownId === 'idb:' + d.name + '/' + s.name ? 'true' : null"
                                  class="w-full text-left py-1 pl-6 pr-2 rounded flex items-center justify-between gap-3"
                                  :class="shownId === 'idb:' + d.name + '/' + s.name ? 'bg-primary/10' : 'hover:bg-base-200'">
                            <span class="font-mono break-all" x-text="s.name"></span>
                            <span class="shrink-0 text-sm tabular-nums text-base-content/60" x-text="s.count"></span>
                          </button>
                        </li>
                      </template>
                    </ul>
                  </div>
                </template>

                <div x-show="source === 'here'" class="flex flex-wrap gap-x-4 gap-y-1 text-sm px-2 py-2">
                  <a href="../popups/idb-nav.html" target="_blank" rel="noopener" class="link link-primary flex items-center gap-1">
                    <i class="ph ph-arrow-square-out"></i>IndexedDB explorer</a>
                  <a href="../popups/data-shelf.html" target="_blank" rel="noopener" class="link link-primary flex items-center gap-1">
                    <i class="ph ph-arrow-square-out"></i>Data shelf</a>
                </div>
              </div>
            </section>

            <section class="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100">
              <div class="flex items-center gap-1 shrink-0 min-h-12 pl-3 pr-1 py-1 border-b border-base-300 bg-base-200/60">
                <div x-show="items.length > 1" class="flex items-center shrink-0 sm:-ml-2">
                  <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at - 1)"
                          :disabled="at <= 0" aria-label="Previous"><i class="ph ph-caret-left"></i></button>
                  <span class="font-mono text-xs opacity-60 tabular-nums px-1" x-text="(at + 1) + '/' + items.length"></span>
                  <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at + 1)"
                          :disabled="at >= items.length - 1" aria-label="Next"><i class="ph ph-caret-right"></i></button>
                </div>
                <div class="grow min-w-0 pl-1">
                  <div class="font-mono font-semibold truncate" x-text="cur ? cur.title : ''"></div>
                  <div class="text-sm text-base-content/60 truncate" x-text="cur ? cur.meta : ''"></div>
                </div>
                <button type="button" class="btn btn-sm btn-ghost btn-square shrink-0" @click="expand()" :disabled="!items.length"
                        aria-label="Swipe through these, full screen">
                  <i class="ph ph-arrows-out-simple text-lg"></i></button>
              </div>
              <!-- data-no-swipe: a sideways drag here is the strip's, never the
                   shell's view pager, even with one card and nothing to scroll. -->
              <div x-ref="strip" x-show="items.length > 0" data-no-swipe @scroll.passive="stripScroll()"
                   class="flex-1 min-h-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain
                          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <template x-for="it in items" :key="it.id">
                  <div data-slide :data-id="it.id" class="w-full shrink-0 snap-center min-h-0 flex flex-col overflow-hidden p-2"></div>
                </template>
              </div>
            </section>
          </div>
        </div>`,

      init() {
        this.$el.innerHTML = this.template;
        // Storage is read AFTER the template is initialised, not beside it:
        // Alpine builds a component's $refs the first time they are read and
        // keeps that answer, so a read before initTree registers the template's
        // x-refs caches an empty set, and the strip and the list are never
        // found again.
        this.$nextTick(() => {
          if (!this.$el.isConnected) return;
          Alpine.initTree(this.$el);
          this.tab === 'page' ? this.loadPage() : this.loadStorage();
        });
        this.note = read(NOTE_KEY) || '';
        this.noteDraft = this.note;
        this.checkToken();
        // An item the address moves to (Back, a link) is shown by moving the
        // strip; a swipe moves the address the other way, in place.
        this.$watch(() => window.__shell?.hereItem, () => this.$nextTick(() => { this.jump(); this.reveal(); }));
        this.$watch(() => window.__shell?.hereTab, (t) => {
          if (t === 'page' && this.source !== 'page') return this.loadPage();
          if (t === 'stored' && this.source !== 'here') return this.loadStorage();
          if (t === 'stored' || t === 'page') this.$nextTick(() => { this.jump(); this.reveal(); });
        });
        // A page that speaks after this view mounted on its tab is read then.
        this.$watch(() => window.__shell?.courierHost, (h) => { if (h && this.tab === 'page') this.loadPage(); });
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
      get storageLine() {
        return [this.srcHost || this.host, this.quotaLine ? this.quotaLine + ' quota storage' : '',
                this.persisted == null ? '' : (this.persisted ? 'persistent' : 'not persistent')].filter(Boolean).join(' · ');
      },
      get quotaLine() {
        if (this.usage == null) return '';
        return fmtBytes(this.usage) + (this.quota ? ' / ' + fmtBytes(this.quota) : '');
      },

      // ── Tabs and the item in view, both part of the address ────────────────
      // Held on the shell (hereTab, hereItem) and stamped by its route row, so
      // ?view=here&tab=stored&item=ls:visits names what is on screen. A tab is
      // a history entry; the item is written in place, since a swipe through
      // twenty cards is not twenty places to go Back to. An item id is
      // `ls:<key>` or `idb:<database>/<store>`.
      get tab() { return window.__shell?.hereTab || 'token'; },
      setTab(t) {
        const sh = window.__shell;
        if (!sh || sh.hereTab === t) return;
        sh.hereTab = t;
        sh.syncUrl();
      },
      get selId() { return window.__shell?.hereItem || ''; },
      // What the detail shows: the item the address names when it still
      // exists, else the first in the list. The default is never written to
      // the address, so arriving does not add a history entry Back would land
      // on only to be sent forward again.
      get shownId() {
        const ids = this.items.map(it => it.id);
        return ids.includes(this.selId) ? this.selId : (ids[0] || '');
      },
      select(id) {
        const sh = window.__shell;
        if (!sh || sh.hereItem === id) return;
        sh.hereItem = id || '';
        const restoring = sh._restoring;
        sh._restoring = true;            // syncUrl replaces in place while this is set
        try { sh.syncUrl(); } finally { sh._restoring = restoring; }
      },
      // The list's items in its own order, which is the strip's and the deck's.
      get items() {
        return [
          ...this.lsRows.map(r => ({ id: 'ls:' + r.key, title: r.key, meta: lsSub(r) })),
          ...this.dbs.flatMap(d => d.stores.map(st => ({
            id: 'idb:' + d.name + '/' + st.name, title: d.name + ' · ' + st.name,
            meta: this.plural(st.count, 'record') + (this.source === 'page' && st.count > 500 ? ' · the first 500 shown' : ''),
            db: d.name, store: st.name, keyPath: st.keyPath,
          }))),
        ];
      },
      get at() { return Math.max(0, this.items.findIndex(it => it.id === this.shownId)); },
      get cur() { return this.items[this.at] || null; },
      plural(n, noun) { return n + ' ' + noun + (n === 1 ? '' : 's'); },
      // What a card shows: a localStorage value as lsShown names it, a store
      // as its records under a .json name, which READ_MODE lays out as a table
      // when every record is a plain object and as a tree otherwise.
      async itemContent(it) {
        if (this.source === 'page') return this.pageContent(it);
        if (it.id.startsWith('ls:')) return lsShown(it.id.slice(3));
        const rows = await this.storeRows(it);
        return { name: it.db + '.' + it.store + '.json', content: JSON.stringify(rows, null, 2) };
      },
      async storeRows(it) {
        const id = it.db + '/' + it.store;
        if (storeCache.has(id)) return storeCache.get(id);
        let rows = [];
        try { rows = entriesToRows(await window.persistence.idb.readEntries(it.db, it.store), it.keyPath === '(key)'); }
        catch (e) { rows = []; }
        storeCache.set(id, rows);
        return rows;
      },

      // ── The strip ──────────────────────────────────────────────────────────
      // A card mounts its viewer when the strip comes within one card of it and
      // then stays mounted, so swiping back is instant.
      panels() { return [...(this.$refs.strip?.querySelectorAll('[data-slide]') || [])]; },
      mountNear() {
        const panels = this.panels(), items = this.items;
        for (const i of [this.at, this.at + 1, this.at - 1]) {
          const it = items[i], host = panels[i];
          if (!it || !host || mounted.has(it.id)) continue;
          mounted.add(it.id);
          const el = mountViewer(host);
          this.itemContent(it).then(({ name, content }) => el.__viewer?.show(name, content, { local: true }));
        }
      },
      // The card nearest the strip's left edge, read off the scroll.
      nearest() {
        const el = this.$refs.strip;
        if (!el || !el.clientWidth) return -1;
        return Math.round(el.scrollLeft / el.clientWidth);
      },
      stripScroll() {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
          this._raf = 0;
          const best = this.nearest();
          if (best < 0 || !this.items[best]) return;
          // A go() is in flight: its scroll passes the cards between, and
          // reading those back would walk the selection through each of them.
          if (this._aim >= 0) {
            if (best !== this._aim) return;
            this._aim = -1; clearTimeout(this._aimT);
          }
          if (best !== this.at) { this.select(this.items[best].id); this.reveal(); }
          this.mountNear();
        });
      },
      // Move to item i: the selection at once, the strip after it. `instant`
      // for a pick in the list, where animating past twenty cards is noise.
      go(i, instant = false) {
        const items = this.items;
        if (!items.length) return;
        i = Math.max(0, Math.min(items.length - 1, i));
        this.select(items[i].id);
        this.reveal();
        this.scrollTo(i, instant);
      },
      pick(id) {
        const i = this.items.findIndex(it => it.id === id);
        if (i >= 0) this.go(i, true);
      },
      // Be on the selected card, without travelling to it. The strip may not
      // have its width yet (it was hidden, or the list just arrived), so the
      // landing waits a frame and tries a few more before giving up.
      jump(tries = 6) {
        requestAnimationFrame(() => {
          const el = this.$refs.strip;
          if ((!el || !el.clientWidth) && tries > 0) return setTimeout(() => this.jump(tries - 1), 50);
          this.scrollTo(this.at, true);
          this.mountNear();
        });
      },
      scrollTo(i, instant) {
        const el = this.$refs.strip;
        if (!el || !el.clientWidth) return;
        const x = i * el.clientWidth;
        if (Math.abs(el.scrollLeft - x) < 2) { this.mountNear(); return; }
        this._aim = i; clearTimeout(this._aimT);
        this._aimT = setTimeout(() => { this._aim = -1; this.stripScroll(); }, 900);
        el.scrollTo({ left: x, behavior: instant ? 'instant' : 'smooth' });
        if (Math.abs(el.scrollLeft - x) < 2) { this._aim = -1; clearTimeout(this._aimT); this.mountNear(); }
      },
      // Up and down in the list step the selection, the strip following.
      key(d) {
        this.go(this.at + d, true);
        this.$nextTick(() => this.rowEl()?.focus({ preventScroll: true }));
      },
      rowEl() {
        const id = this.cur?.id;
        return id ? this.$refs.list?.querySelector('[data-id="' + CSS.escape(id) + '"]') : null;
      },
      // Keep the selected row in view INSIDE THE LIST, never by scrolling the
      // page: a swipe through the cards walks the selection down rows the
      // reader may have scrolled away from.
      reveal() {
        this.$nextTick(() => {
          const list = this.$refs.list, row = this.rowEl();
          if (!list || !row || !list.clientHeight) return;
          const box = list.getBoundingClientRect(), r = row.getBoundingClientRect();
          if (r.top < box.top + 4) list.scrollTop -= box.top + 4 - r.top;
          else if (r.bottom > box.bottom - 4) list.scrollTop += r.bottom - box.bottom + 4;
        });
      },

      // ── The expander: the deck takeover over the same items ────────────────
      // Opened on the card in view; a swipe in the deck moves the selection,
      // and closing it lands the strip and the list where the swipe left off.
      async expand() {
        const items = this.items.slice();
        if (!items.length || this._deck) return;
        await window.gh.load('kits/swipe-deck.js');
        this._deck = window.swipeDeck.open({
          count: items.length, start: this.at, icon: 'ph-hard-drives',
          title: items[this.at].title, subtitle: items[this.at].meta,
          index: (n) => ({ title: items[n].title, subtitle: items[n].meta }),
          render: (n, slide) => {
            const host = document.createElement('div');
            host.className = 'flex flex-col h-full w-full min-w-0 overflow-hidden p-3';
            slide.append(host);
            const el = mountViewer(host);
            this.itemContent(items[n]).then(({ name, content }) => el.__viewer?.show(name, content, { local: true }));
          },
          slideScroll: false,
          innerClass: 'h-full w-full min-w-0',
          immersive: true,
          release: (n, el) => { el.replaceChildren(); },
          // CLOSING IS A STEP BACK IN HISTORY (the kit pushed an entry when it
          // opened), and the shell restores the address that step lands on,
          // which still names the item the deck opened on. So the deck keeps
          // its own place while open and hands it to the list only once the
          // shell has finished restoring.
          onClose: () => {
            const id = this._deckItem;
            this._deck = null; this._deckItem = '';
            const sh = window.__shell;
            const land = (tries = 20) => {
              if (sh && sh._restoring && tries > 0) return setTimeout(() => land(tries - 1), 50);
              if (id) this.select(id);
              this.$nextTick(() => { this.jump(); this.reveal(); });
            };
            setTimeout(land, 60);
          },
        });
        this._deckItem = items[this.at].id;
        this._deck.deck.onSlide((n) => {
          if (!items[n]) return;
          this._deckItem = items[n].id;
          this._deck?.setTitle?.(items[n].title);
          this._deck?.setSubtitle?.(items[n].meta);
        });
      },

      reload() { return this.source === 'page' ? this.loadPage() : this.loadStorage(); },

      async loadStorage() {
        storeCache = new Map();
        mounted.clear();
        this.panels().forEach(p => p.replaceChildren());
        this.source = 'here';
        this.srcHost = this.host;
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
            this.dbs = []; this.dbState = 'unlisted';
            this.$nextTick(() => { this.jump(); this.reveal(); });
            return;
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
        // The strip's cards exist once the list does: land on the item in
        // view and mount it and its neighbours.
        this.$nextTick(() => { this.jump(); this.reveal(); });
      },

      // ── What the courier's page stores ─────────────────────────────────────
      get courierHost() { return window.__shell?.courierHost || ''; },
      // One request to the page, answered as parsed JSON. kits/page-storage.js
      // is what runs there, read through the Stage's link.
      async askPage(request) {
        const link = window.__courier;
        if (!link) throw new Error('no page is on the line: tap the courier bookmark on a page to open this window from it');
        await window.gh.load('kits/page-storage.js');
        return JSON.parse(await link.ask(window.PageStorage.script(), request));
      },
      async loadPage() {
        storeCache = new Map();
        mounted.clear();
        this.panels().forEach(p => p.replaceChildren());
        this.source = 'page';
        this.srcHost = this.courierHost;
        this.pageErr = '';
        this.lsRows = []; this.lsErr = '';
        this.dbs = []; this.dbErr = '';
        this.usage = null; this.quota = null; this.persisted = null;
        this.dbState = 'loading';
        let inv;
        try { inv = await this.askPage({ read: 'inventory' }); }
        catch (e) {
          this.dbState = 'idle';
          // The policy case leads with the reason in plain words; the
          // browser's own sentence follows for the directive it names.
          const said = String((e && e.message) || e);
          this.pageErr = /eval|Content Security/i.test(said)
            ? this.courierHost + "'s Content Security Policy refuses code sent to the page, so its storage cannot be read from here. The browser said: " + said
            : 'The page did not answer: ' + said;
          return;
        }
        if (this.source !== 'page') return;    // the reader switched tabs while the page was answering
        this.srcHost = inv.host || this.courierHost;
        this.lsErr = inv.lsErr || '';
        this.lsRows = (inv.ls || []).map(r => ({ key: r.key, bytes: r.bytes, size: fmtBytes(r.bytes), owner: null }))
          .sort((a, b) => a.key.localeCompare(b.key));
        this.usage = inv.usage ?? null; this.quota = inv.quota ?? null; this.persisted = inv.persisted ?? null;
        this.dbs = (inv.dbs || []).map(d => ({ ...d, owner: null })).sort((a, b) => a.name.localeCompare(b.name));
        this.dbState = inv.dbState || 'ok';
        this.dbErr = inv.dbErr || '';
        this.$nextTick(() => { this.jump(); this.reveal(); });
      },
      // A page value shows as a local one does (lsShown's rules, the token mask
      // included); a page store shows its first records, the meta saying so
      // when the store holds more.
      async pageContent(it) {
        try {
          if (it.id.startsWith('ls:')) {
            const key = it.id.slice(3);
            const v = String((await this.askPage({ read: 'ls', key })).value ?? '');
            if (window.ghAuth?.looksLikeToken?.(v.trim())) return { name: key + '.txt', content: '…' + v.trim().slice(-4) };
            try {
              const parsed = JSON.parse(v);
              if (parsed !== null && typeof parsed === 'object') return { name: key + '.json', content: JSON.stringify(parsed, null, 2) };
            } catch (e) {}
            return { name: key + '.txt', content: v };
          }
          const id = it.db + '/' + it.store;
          let rows = storeCache.get(id);
          if (!rows) {
            const got = await this.askPage({ read: 'store', db: it.db, store: it.store });
            rows = entriesToRows(got.entries || [], got.keyPath == null);
            storeCache.set(id, rows);
          }
          return { name: it.db + '.' + it.store + '.json', content: JSON.stringify(rows, null, 2) };
        } catch (e) {
          return { name: it.title + '.txt', content: 'The page did not answer: ' + ((e && e.message) || e) };
        }
      },
    };
  });
});
