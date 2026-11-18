// session-repos.js — the Sessions pane's Repos lens: the repos the recorded
// sessions worked in, as a list over (or beside) a strip of one card per repo
// (html-style rule 11, through kits/linked-swiper.js), and the swipe deck
// over the same cards.
//
// A row is a repo, led by its mark, with the sessions that worked in it as a
// count and a bar on one scale. The first row is every repo at once.
//
// A card is one drawing of the repo's company, an orbit: the repo's mark at
// the center and every repo it shared a session with around it. A companion
// sits nearer the center the larger the share of this repo's sessions it was
// in, against rings at 25, 50 and 75 percent; its mark and its spoke grow
// with the sessions the two shared; and a ring around it fills, clockwise
// from its top, to the share of the companion's OWN sessions that included
// this repo, so a repo whose whole life runs through this one (a full ring)
// reads apart from a big repo that only sometimes joins it. Companions run
// clockwise from twelve, nearest first, each given a slice of the turn in
// proportion to its size over its distance, so the field turns outward in a
// spiral and no two marks meet. A table under the
// drawing gives each figure exactly; a tap on a companion, in either, moves
// the list to that repo. On the All repos card the center is every session
// and each repo sits by the share of all sessions it was in, without rings.
// The design and the seven concepts it was chosen from:
// docs/prototypes/session-repos-ideas.json.
//
// A session names a repo when that checkout was its working directory, which
// is narrower than every repo it touched. An owner-qualified name and a bare
// one (mehrlander/home, home) are one repo here.
//
// Mounted by lib/alpineComponents/estate.js as x-data="sessionRepos(cfg)":
//   cfg.rows()          the session rows (RepoSessionsCache summaries)
//   cfg.key()           changes when the rows or the repo marks do
//   cfg.mark(repo, o)   a repo's mark, as estate's repoMarkHtml draws it
//
// window.SessionRepos = { model, orbit, ALL } for the suite.
(() => {
  const esc = s => window.esc(s);
  const ALL = '*';
  const bare = n => String(n || '').replace(/^[^/]+\//, '');

  // The rows, folded per repo: its sessions, the branches they worked on off
  // the default branch, the sessions it had alone, the days they span, and
  // the sessions it shared with each other repo.
  function model(rows) {
    const by = new Map();
    let total = 0, branches = 0;
    const days = [];
    for (const r of rows || []) {
      const seen = new Set(), names = new Set();
      let nb = 0;
      for (const x of r.repos || []) {
        const repo = bare(x.name);
        if (!repo) continue;
        names.add(repo);
        const branch = x.branch && x.branch !== 'main' ? x.branch : '';
        if (branch && !seen.has(repo + '\n' + branch)) { seen.add(repo + '\n' + branch); nb++; }
      }
      if (!names.size) continue;
      total++; branches += nb;
      if (r.day) days.push(r.day);
      const list = [...names];
      for (const n of list) {
        let e = by.get(n);
        if (!e) by.set(n, e = { name: n, sessions: 0, branches: 0, alone: 0, with: new Map(), first: '', last: '' });
        e.sessions++;
        e.branches += [...seen].filter(k => k.startsWith(n + '\n')).length;
        if (list.length === 1) e.alone++;
        if (r.day && (!e.first || r.day < e.first)) e.first = r.day;
        if (r.day && r.day > e.last) e.last = r.day;
        for (const m of list) if (m !== n) e.with.set(m, (e.with.get(m) || 0) + 1);
      }
    }
    days.sort();
    const repos = [...by.values()].map(e => ({
      ...e, with: [...e.with].map(([name, n]) => ({ name, n, own: by.get(name).sessions }))
        .sort((x, y) => (y.n - x.n) || x.name.localeCompare(y.name)),
    })).sort((a, b) => (b.sessions - a.sessions) || a.name.localeCompare(b.name));
    const all = { name: ALL, sessions: total, branches, alone: 0, first: days[0] || '', last: days[days.length - 1] || '',
                  with: repos.map(e => ({ name: e.name, n: e.sessions, own: 0 })) };
    return { all, repos };
  }

  // Where each companion sits, in units of a 200-wide drawing centered on
  // the hub: distance from the share of the hub's sessions, size from the
  // sessions shared, and a slice of the full turn in proportion to size over
  // distance, so near and large marks get the room they need. The first,
  // the nearest, sits at twelve o'clock and the rest follow clockwise.
  const R0 = 22, R1 = 86;
  function orbit(e) {
    const top = Math.max(1, ...e.with.map(w => w.n));
    const pts = e.with.map(w => {
      const share = e.sessions ? w.n / e.sessions : 0;
      const r = R0 + (1 - share) * (R1 - R0), size = 4.5 + 8.5 * Math.sqrt(w.n / top);
      return { ...w, share, r, size, arc: (size + 4) / r };
    });
    const k = (Math.PI * 2) / (pts.reduce((s, p) => s + p.arc, 0) || 1);
    let a = -Math.PI / 2 - (pts.length ? (pts[0].arc * k) / 2 : 0);
    for (const p of pts) {
      const mid = a + (p.arc * k) / 2;
      a += p.arc * k;
      p.x = Math.cos(mid) * p.r; p.y = Math.sin(mid) * p.r;
    }
    return pts;
  }

  window.SessionRepos = { model, orbit, ALL };

  // The selection outlives the component, which is torn down when another
  // lens is picked: coming back to Repos lands on the repo left.
  let kept = '';
  const f1 = n => n.toFixed(1);
  const pct = x => Math.round(x * 100) + '%';

  document.addEventListener('alpine:init', () => Alpine.data('sessionRepos', (cfg) => ({
    description: 'Repos: the repos the recorded sessions worked in, a list beside a card per repo that draws its company as an orbit: nearer the more of its sessions a repo shared, larger the more sessions, ringed by the share of its own sessions spent with it.',
    cfg,
    loading: true, sel: '', m: { all: { with: [] }, repos: [] },

    template: `
      <div x-show="loading" class="flex items-center gap-2 py-3 text-base text-base-content/70">
        <span class="loading loading-spinner loading-sm"></span> Drawing repos
      </div>
      <p x-show="!loading && !m.repos.length" class="text-base text-base-content/60">No session in this store names a repo.</p>
      <div x-show="!loading && m.repos.length" class="flex min-h-0 flex-1 flex-col">
        <div x-ref="root">
          <div x-ref="list" role="listbox" aria-label="Repos the sessions worked in" data-part="list"></div>
          <div x-ref="card"></div>
        </div>
      </div>`,

    init() {
      this.$el.innerHTML = this.template;
      this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
      this.start();
      this.$watch(() => this.cfg.key(), () => this.rebuild());
    },
    destroy() {
      this._swiper?.destroy();
      this._deck?.close?.();
    },

    async start() {
      try {
        if (!window.TitleTip) await gh.load('kits/title-tip.js');
        if (!window.swipeDeck) await gh.load('kits/swipe-deck.js');
        if (!window.dockSplit) await gh.load('kits/dock-split.js');
        if (!window.linkedSwiper) await gh.load('kits/linked-swiper.js');
        this.m = model(this.cfg.rows());
        this.sel = this.ids.includes(kept) ? kept : ALL;
        if (this.m.repos.length) this.$nextTick(() => this.mount());
      } finally {
        this.loading = false;
      }
    },
    get ids() { return [ALL, ...this.m.repos.map(e => e.name)]; },
    entry(id) { return id === ALL ? this.m.all : this.m.repos.find(e => e.name === id); },
    // The rows changed under the lens (a crawl landed) or a repo's mark file
    // arrived: refold, and redraw on the repo in view.
    rebuild() {
      if (!this._swiper) return;
      this.m = model(this.cfg.rows());
      if (!this.ids.includes(this.sel)) this.sel = ALL;
      this.$refs.list.innerHTML = this.listHtml();
      this._swiper.mount();
    },

    mount() {
      this.$refs.list.innerHTML = this.listHtml();
      this._swiper = linkedSwiper.attach({
        root: this.$refs.root, list: this.$refs.list, card: this.$refs.card, key: 'repo',
        ids: () => this.ids, sel: () => this.sel,
        noun: 'repo', seam: 'session-repos-list', listMax: 'max-h-[26dvh]', slim: true, stackBelow: 720,
        slidePad: 'px-3.5 pt-2 pb-3 max-sm:pb-[calc(var(--fab-bottom,1.5rem)+4rem)]',
        head: ({ i, n, tight }) => this.headHtml(this.ids[i], i, n, tight),
        body: (id, el) => { this.fill(id, el); },
        empty: '',
        onPick: (id, via) => {
          this.sel = kept = id;
          if (this._deck && via !== 'deck') this._deck.deck.go(this.ids.indexOf(id), 'instant');
        },
        deck: () => this.openDeck(),
      });
    },

    // ── The list ────────────────────────────────────────────────────────
    listHtml() {
      const top = Math.max(1, this.m.all.sessions);
      const row = (id, lead, name, n) =>
        `<div data-repo="${esc(id)}" tabindex="-1" data-part="item"`
        + ` class="flex min-h-10 cursor-pointer items-center gap-2.5 border-b border-base-200 px-3 hover:bg-base-200/60 aria-selected:bg-primary/10">`
        + `<span class="inline-flex w-6 flex-none justify-center">${lead}</span>`
        + `<span class="min-w-0 flex-1 truncate text-base">${esc(name)}</span>`
        + `<span class="h-1.5 w-14 flex-none overflow-hidden rounded-full bg-base-200" aria-hidden="true">`
        + `<span class="block h-full rounded-full bg-primary/50" style="width:${Math.max(4, Math.round(n / top * 100))}%"></span></span>`
        + `<span class="w-9 flex-none text-right font-mono text-sm tabular-nums text-base-content/60">${n}</span></div>`;
      return row(ALL, this.allMark('text-xl'), 'All repos', this.m.all.sessions)
        + this.m.repos.map(e => row(e.name, this.mark(e.name, 'text-xl'), e.name, e.sessions)).join('');
    },
    mark(repo, size, style = '') {
      const html = this.cfg.mark(repo, { cls: size, pending: 'glyph' });
      return style ? `<span class="inline-flex leading-none" style="${style}">${html}</span>` : html;
    },
    allMark(size) { return `<i class="ph ph-asterisk ${size} text-base-content/70" aria-hidden="true"></i>`; },

    headHtml(id, i, n, tight) {
      return `<span class="mr-2 inline-flex flex-none">${id === ALL ? this.allMark('text-lg') : this.mark(id, 'text-lg')}</span>`
        + linkedSwiper.head({ title: id === ALL ? 'All repos' : id }, i, n, 'repo', { deck: true, tight, slim: true });
    },

    // ── A card ──────────────────────────────────────────────────────────
    // Drawn as markup, for the strip and the deck alike; its taps are heard
    // on the element it fills, so both answer the same way.
    fill(id, el) {
      const e = this.entry(id);
      el.dataset.srCard = id;
      if (!e) { el.innerHTML = ''; return; }
      const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
      // Month and day, as a list row dates a session, with the year only
      // where the span crosses one.
      const md = (d) => e.first.slice(0, 4) === e.last.slice(0, 4) ? d.slice(5) : d;
      const span = e.first && e.last ? (e.first === e.last ? md(e.first) : md(e.first) + ' → ' + md(e.last)) : '';
      const facts = [plural(e.sessions, 'session', 'sessions'), plural(e.branches, 'branch', 'branches'),
                     id !== ALL && e.alone ? e.alone + ' alone' : '', span].filter(Boolean)
        .map(t => `<span class="whitespace-nowrap">${esc(t)}</span>`).join('<span class="text-base-content/30">·</span>');
      el.innerHTML = `<div class="@container">`
        + `<p class="mb-2 flex flex-wrap items-center gap-x-2 text-base text-base-content/70">${facts}</p>`
        + `<div class="grid gap-x-6 gap-y-3 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @2xl:items-start">`
        + this.orbitHtml(id, e) + this.tableHtml(id, e) + `</div></div>`;
      el.onclick = (ev) => this.tap(ev);
    },

    // The drawing: an SVG for the rings, spokes and share rings, under the
    // marks, which are HTML so every repo is drawn by its own mark. Both
    // scale with the box: SVG units by its viewBox, the marks by container
    // units, 200 units to the box's width.
    orbitHtml(id, e) {
      const pts = orbit(e), hub = id === ALL;
      const top = Math.max(1, ...pts.map(p => p.n));
      const RINGS = [0.75, 0.5, 0.25].map(s => [s, R0 + (1 - s) * (R1 - R0)]);
      const rings = RINGS.map(([, r]) => `<circle r="${f1(r)}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="2 2.5"/>`).join('')
        + `<circle r="${R1}" fill="none" stroke="currentColor" stroke-opacity=".08"/>`;
      // Over the spokes, each in a halo of the card's ground, since a spoke
      // to nine o'clock would otherwise run through them.
      const ringLabels = RINGS.map(([s, r]) => `<text x="${f1(-r)}" y="-1.5" text-anchor="middle" font-size="5.5" fill="currentColor" fill-opacity=".5"`
        + ` stroke="var(--color-base-100)" stroke-width="2.4" paint-order="stroke">${pct(s)}</text>`).join('');
      const spokes = pts.map(p => `<line x1="0" y1="0" x2="${f1(p.x)}" y2="${f1(p.y)}" stroke="var(--color-primary)"`
        + ` stroke-opacity=".35" stroke-width="${f1(0.5 + 3.5 * p.n / top)}"/>`).join('');
      // The share of the companion's own sessions, as a ring drawn from
      // twelve o'clock: a dash as long as that share of the circle.
      const own = hub ? '' : pts.map(p => {
        const r = p.size + 1.6, c = 2 * Math.PI * r, f = p.own ? Math.min(1, p.n / p.own) : 0;
        return `<g transform="translate(${f1(p.x)} ${f1(p.y)}) rotate(-90)">`
          + `<circle r="${f1(r)}" fill="var(--color-base-100)" stroke="currentColor" stroke-opacity=".12" stroke-width="1.4"/>`
          + `<circle r="${f1(r)}" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="1.6" stroke-dasharray="${f1(f * c)} ${f1(c)}"/></g>`;
      }).join('');
      const bg = hub ? pts.map(p => `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(p.size + 1)}" fill="var(--color-base-100)"/>`).join('') : '';
      const counts = pts.filter(p => p.n > 1).map(p => `<text x="${f1(p.x)}" y="${f1(p.y + p.size + (hub ? 7 : 8.5))}" text-anchor="middle"`
        + ` font-size="5.5" fill="currentColor" fill-opacity=".6">${p.n}</text>`).join('');
      const at = (x, y) => `left:${f1(50 + x / 2)}%;top:${f1(50 + y / 2)}%`;
      const marks = pts.map(p => {
        const tip = hub ? `${p.n} of ${e.sessions} sessions` : `${p.n} of ${e.sessions} sessions here · ${p.n} of its ${p.own}`;
        return `<button type="button" data-repo-go="${esc(p.name)}" data-title-tip="${esc(tip)}" data-title-tip-lead="${esc(p.name)}"`
          + ` aria-label="${esc(p.name + ', ' + tip)}" class="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"`
          + ` style="${at(p.x, p.y)};width:${f1(p.size)}cqw;height:${f1(p.size)}cqw">`
          + this.mark(p.name, 'text-[1em]', `font-size:${f1(p.size * 0.62)}cqw`) + `</button>`;
      }).join('');
      const center = hub ? this.allMark('text-[1em]') : this.mark(id, 'text-[1em]');
      return `<div class="relative mx-auto aspect-square w-full max-w-[30rem] text-base-content [container-type:inline-size]" data-sr-orbit>`
        + `<svg class="absolute inset-0 size-full overflow-visible" viewBox="-100 -100 200 200" aria-hidden="true">`
        + rings + spokes + ringLabels + bg + own
        + `<circle r="13" fill="var(--color-base-200)"/>` + counts + `</svg>`
        + `<span class="absolute inline-flex -translate-x-1/2 -translate-y-1/2 leading-none" style="${at(0, 0)};font-size:11cqw">${center}</span>`
        + marks + `</div>`;
    },

    // The figures the drawing rounds, exactly: sessions shared, the share of
    // this repo's sessions, and the share of the companion's own.
    tableHtml(id, e) {
      const hub = id === ALL;
      const th = 'pb-1 text-right text-sm font-medium text-base-content/50';
      const head = `<div class="contents"><span></span><span class="pb-1 text-sm font-medium text-base-content/50">${hub ? 'Repo' : 'Worked with'}</span>`
        + `<span class="${th}">${hub ? 'Sessions' : 'Together'}</span>`
        + `<span class="${th}">${hub ? 'Of all' : 'Of ' + esc(id)}</span>`
        + (hub ? '' : `<span class="${th}">Of its own</span>`) + `</div>`;
      const num = 'text-right font-mono text-sm tabular-nums';
      const rows = e.with.map(w => `<button type="button" data-repo-go="${esc(w.name)}" class="col-span-full grid grid-cols-subgrid items-center rounded py-1 text-left hover:bg-base-200/60">`
        + `<span class="inline-flex w-6 justify-center">${this.mark(w.name, 'text-lg')}</span>`
        + `<span class="min-w-0 truncate text-base">${esc(w.name)}</span>`
        + `<span class="${num}">${w.n}</span>`
        + `<span class="${num} text-base-content/70">${pct(e.sessions ? w.n / e.sessions : 0)}</span>`
        + (hub ? '' : `<span class="${num} text-base-content/70">${pct(w.own ? w.n / w.own : 0)}</span>`)
        + `</button>`).join('');
      return `<div class="grid ${hub ? 'grid-cols-[auto_minmax(0,1fr)_auto_auto]' : 'grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]'} gap-x-3">${head}${rows}</div>`;
    },

    tap(ev) {
      const t = ev.target instanceof Element ? ev.target : null;
      const go = t && t.closest('[data-repo-go]');
      if (!go) return;
      ev.preventDefault();
      this._swiper?.pick(go.dataset.repoGo);
    },

    // html-style rule 11: the door in the head row opens the cards full
    // screen at the card in view, and closing returns to the list there.
    openDeck() {
      if (!window.swipeDeck?.open || this._deck) return;
      const ids = this.ids;
      this._deck = swipeDeck.open({
        count: ids.length, start: Math.max(0, ids.indexOf(this.sel)),
        title: 'Repos', icon: 'ph-graph', innerClass: 'w-full',
        index: (i) => ({ title: ids[i] === ALL ? 'All repos' : ids[i] }),
        render: (i, el) => this.fill(ids[i], el),
        onSlide: (i) => { if (ids[i] !== this.sel) this._swiper?.pick(ids[i], 'deck'); },
        onClose: () => { this._deck = null; },
      });
    },
  })));
})();
