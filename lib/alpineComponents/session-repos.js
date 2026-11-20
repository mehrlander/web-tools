// session-repos.js — the Sessions pane's Repos tab: the repos the recorded
// sessions worked in, as a list over (or beside) a strip of one card per repo
// (html-style rule 11, through kits/linked-swiper.js), and the swipe deck
// over the same cards.
//
// A row is a repo, led by its mark, with the sessions that worked in it as a
// count and a bar on one scale. The first row is every repo at once. While a
// repo is picked, every other row also says how many of its sessions that
// repo shared: a darker run at the start of its bar and the count before its
// total, so web-tools reads 51/75 beside home, and a row that shared none
// fades. The list is the card's table of exact figures, and pointing at a
// repo in the list or in the drawing lights it in the other.
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
// spiral and no two marks meet. A tap on a companion moves the list to that
// repo. On the All repos card the center is every session and each repo sits
// by the share of all sessions it was in, without rings.
//
// Beside the drawing (under it when the card is narrow), the repo's sessions
// by day: a bar per day across the span of every session, this repo's
// sessions over the faint bar of all sessions that day, so a run of work
// reads against what else was going on.
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
//   cfg.item()          the repo the shell's address names, '' for All repos
//   cfg.setItem(id, { push })  the reader picked one; the shell stamps it,
//                       adding a history entry only when push is set
//
// A pick by the list, a swipe or a step browses and updates the address in
// place; a companion tapped in the orbit follows a link and adds an entry,
// so Back returns to the repo it was tapped from. Back and Forward open the
// repo the address names.
//
// window.SessionRepos = { model, orbit, span, ALL } for the suite.
(() => {
  const esc = s => window.esc(s);
  const ALL = '*';
  const bare = n => String(n || '').replace(/^[^/]+\//, '');

  // The rows, folded per repo: its sessions, the branches they worked on off
  // the default branch, the sessions it had alone, its sessions per day and
  // the days they span, and the sessions it shared with each other repo.
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
        if (!e) by.set(n, e = { name: n, sessions: 0, branches: 0, alone: 0, with: new Map(), first: '', last: '', days: {} });
        e.sessions++;
        if (r.day) e.days[r.day] = (e.days[r.day] || 0) + 1;
        e.branches += [...seen].filter(k => k.startsWith(n + '\n')).length;
        if (list.length === 1) e.alone++;
        if (r.day && (!e.first || r.day < e.first)) e.first = r.day;
        if (r.day && r.day > e.last) e.last = r.day;
        for (const m of list) if (m !== n) e.with.set(m, (e.with.get(m) || 0) + 1);
      }
    }
    days.sort();
    const perDay = {};
    for (const d of days) perDay[d] = (perDay[d] || 0) + 1;
    const repos = [...by.values()].map(e => ({
      ...e, with: [...e.with].map(([name, n]) => ({ name, n, own: by.get(name).sessions }))
        .sort((x, y) => (y.n - x.n) || x.name.localeCompare(y.name)),
    })).sort((a, b) => (b.sessions - a.sessions) || a.name.localeCompare(b.name));
    const all = { name: ALL, sessions: total, branches, alone: 0, first: days[0] || '', last: days[days.length - 1] || '',
                  days: perDay, with: repos.map(e => ({ name: e.name, n: e.sessions, own: 0 })) };
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

  // Every day from the first to the last, inclusive, as YYYY-MM-DD.
  function span(first, last) {
    const out = [];
    if (!first || !last) return out;
    for (let t = Date.parse(first + 'T00:00:00Z'), end = Date.parse(last + 'T00:00:00Z'); t <= end && out.length < 400; t += 864e5)
      out.push(new Date(t).toISOString().slice(0, 10));
    return out;
  }

  window.SessionRepos = { model, orbit, span, ALL };

  // The selection outlives the component, which is torn down when another
  // tab is picked: coming back to Repos lands on the repo left.
  let kept = '';
  const f1 = n => n.toFixed(1);
  const pct = x => Math.round(x * 100) + '%';

  document.addEventListener('alpine:init', () => Alpine.data('sessionRepos', (cfg) => ({
    description: 'Repos: the repos the recorded sessions worked in, a list beside a card per repo that draws its company as an orbit (nearer the more of its sessions a repo shared, larger the more sessions, ringed by the share of its own sessions spent with it) and its sessions by day; the list gives each repo\'s sessions shared with the one picked.',
    cfg,
    loading: true, sel: '', rowCount: 0, m: { all: { with: [] }, repos: [] },

    template: `
      <div x-show="loading || !rowCount" class="flex items-center gap-2 py-3 text-base text-base-content/70">
        <span class="loading loading-spinner loading-sm"></span> Drawing repos
      </div>
      <p x-show="!loading && rowCount && !m.repos.length" class="text-base text-base-content/60">No session in this store names a repo.</p>
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
      this.$watch(() => this.cfg.item?.(), (id) => {
        const want = id || ALL;
        if (!this._swiper || want === this.sel || !this.ids.includes(want)) return;
        this.sel = kept = want;
        this._swiper.show(want);
        this.paintList();
      });
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
      } finally {
        this.loading = false;
      }
      this.rebuild();
    },
    get ids() { return [ALL, ...this.m.repos.map(e => e.name)]; },
    entry(id) { return id === ALL ? this.m.all : this.m.repos.find(e => e.name === id); },
    // Fold the rows and draw, on the first pass and whenever the rows change
    // (a crawl landed) or a repo's mark file arrives. A tab opened by its
    // address mounts before the sessions have loaded, so an empty fold waits
    // for the rows rather than saying no session names a repo, and the
    // first fold that holds repos is the one that mounts.
    rebuild() {
      if (this.loading) return;
      const rows = this.cfg.rows() || [];
      this.rowCount = rows.length;
      this.m = model(rows);
      const named = this.cfg.item?.() || '';
      if (named && this.ids.includes(named) && !this._swiper) this.sel = named;
      if (!this.ids.includes(this.sel)) this.sel = this.ids.includes(kept) ? kept : ALL;
      if (!this.m.repos.length) return;
      if (!this._swiper) { this.$nextTick(() => { if (!this._swiper) this.mount(); }); return; }
      this.$refs.list.innerHTML = this.listHtml();
      this._swiper.mount();
      this.paintList();
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
          this.cfg.setItem?.(id, { push: via === 'follow' });
          this.paintList();
          if (this._deck && via !== 'deck') this._deck.deck.go(this.ids.indexOf(id), 'instant');
        },
        deck: () => this.openDeck(),
      });
      this.paintList();
      // html-style rule 16: a repo pointed at in the list or the drawing is
      // lit in the other.
      const root = this.$refs.root;
      root.addEventListener('pointerover', (ev) => {
        const t = ev.target instanceof Element ? ev.target.closest('[data-repo], [data-repo-go]') : null;
        this.light(t ? (t.dataset.repo || t.dataset.repoGo) : '');
      });
      root.addEventListener('pointerleave', () => this.light(''));
    },
    light(name) {
      if (name === this._lit) return;
      this._lit = name;
      for (const el of this.$refs.root.querySelectorAll('[data-repo], [data-repo-go]')) {
        el.toggleAttribute('data-hot', !!name && (el.dataset.repo || el.dataset.repoGo) === name);
      }
    },

    // ── The list ────────────────────────────────────────────────────────
    listHtml() {
      const top = Math.max(1, this.m.all.sessions);
      const w = (n) => Math.max(4, Math.round(n / top * 100)) + '%';
      const row = (id, lead, name, n) =>
        `<div data-repo="${esc(id)}" tabindex="-1" data-part="item"`
        + ` class="flex min-h-10 cursor-pointer items-center gap-2.5 border-b border-base-200 px-3 transition-opacity hover:bg-base-200/60 data-hot:bg-base-200/80 aria-selected:bg-primary/10 data-none:opacity-40">`
        + `<span class="inline-flex w-6 flex-none justify-center">${lead}</span>`
        + `<span class="min-w-0 flex-1 truncate text-base">${esc(name)}</span>`
        + `<span class="relative h-1.5 w-14 flex-none overflow-hidden rounded-full bg-base-200" aria-hidden="true">`
        + `<span class="absolute inset-y-0 left-0 rounded-full bg-primary/50" data-sr-bar style="width:${w(n)}"></span>`
        + `<span class="absolute inset-y-0 left-0 w-0 rounded-full bg-primary" data-sr-shared></span></span>`
        + `<span class="w-16 flex-none text-right font-mono text-sm tabular-nums text-base-content/60" data-sr-n>${n}</span></div>`;
      return row(ALL, this.allMark('text-xl'), 'All repos', this.m.all.sessions)
        + this.m.repos.map(e => row(e.name, this.mark(e.name, 'text-xl'), e.name, e.sessions)).join('');
    },
    // Each row's share with the repo picked: the darker run of its bar and
    // the count before its total. The All row's share is the picked repo's
    // own sessions; the picked row, and every row while All is picked, shows
    // its total alone.
    paintList() {
      const list = this.$refs.list, sel = this.sel, e = this.entry(sel);
      if (!list || !e) return;
      const top = Math.max(1, this.m.all.sessions);
      const shared = new Map((sel === ALL ? [] : e.with).map(w => [w.name, w.n]));
      for (const row of list.querySelectorAll('[data-repo]')) {
        const id = row.dataset.repo, own = id === ALL ? this.m.all.sessions : this.entry(id)?.sessions || 0;
        const n = sel === ALL || id === sel ? null : id === ALL ? e.sessions : shared.get(id) || 0;
        const bar = row.querySelector('[data-sr-bar]'), part = row.querySelector('[data-sr-shared]'), out = row.querySelector('[data-sr-n]');
        bar.classList.toggle('bg-primary/50', n === null);
        bar.classList.toggle('bg-primary/20', n !== null);
        part.style.width = n ? Math.max(4, Math.round(n / top * 100)) + '%' : '0';
        out.innerHTML = n === null ? String(own)
          : `<span class="${n ? 'text-base-content' : ''}">${n}</span><span class="text-base-content/40">/${own}</span>`;
        row.toggleAttribute('data-none', n === 0);
      }
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
        + `<div class="grid gap-x-8 gap-y-4 @2xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] @2xl:items-start">`
        + this.orbitHtml(id, e) + this.whenHtml(id, e) + `</div></div>`;
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
          + ` aria-label="${esc(p.name + ', ' + tip)}" class="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full data-hot:outline-2 data-hot:outline-offset-4 data-hot:outline-[var(--color-primary)]"`
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

    // The repo's sessions by day, over every session's span: its bar on the
    // faint bar of all sessions that day, both on the scale of the busiest
    // day of all, with the repo's own busiest day named.
    whenHtml(id, e) {
      const all = this.m.all, days = span(all.first, all.last);
      if (!days.length) return '';
      const top = Math.max(1, ...days.map(d => all.days[d] || 0));
      const n = days.length, hub = id === ALL;
      const bars = days.map((d, i) => {
        const a = all.days[d] || 0, h = e.days[d] || 0;
        return (hub ? '' : `<rect x="${i + 0.12}" y="${f1(100 - a / top * 100)}" width=".76" height="${f1(a / top * 100)}" fill="currentColor" fill-opacity=".1"/>`)
          + (h ? `<rect x="${i + 0.12}" y="${f1(100 - h / top * 100)}" width=".76" height="${f1(h / top * 100)}" fill="var(--color-primary)" fill-opacity=".75"/>` : '');
      }).join('');
      const busiest = days.reduce((b, d) => (e.days[d] || 0) > (e.days[b] || 0) ? d : b, days[0]);
      const peak = e.days[busiest] || 0;
      const md = (d) => d.slice(5);
      const lead = `<p class="mb-1.5 flex flex-wrap items-baseline gap-x-2"><span class="text-sm font-medium text-base-content/60">By day</span>`
        + (peak ? `<span class="text-sm text-base-content/50">busiest ${esc(md(busiest))}, ${peak} ${peak === 1 ? 'session' : 'sessions'}`
          + (hub ? '' : ` of ${all.days[busiest]}`) + `</span>` : '') + `</p>`;
      return `<div class="min-w-0 text-base-content" data-sr-when>${lead}`
        + `<svg class="block h-28 w-full" viewBox="0 0 ${n} 100" preserveAspectRatio="none" aria-hidden="true">${bars}`
        + `<line x1="0" y1="100" x2="${n}" y2="100" stroke="currentColor" stroke-opacity=".2" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`
        + `<div class="mt-1 flex justify-between font-mono text-xs tabular-nums text-base-content/50"><span>${esc(md(days[0]))}</span><span>${esc(md(days[n - 1]))}</span></div></div>`;
    },

    tap(ev) {
      const t = ev.target instanceof Element ? ev.target : null;
      const go = t && t.closest('[data-repo-go]');
      if (!go) return;
      ev.preventDefault();
      this._swiper?.pick(go.dataset.repoGo, 'follow');
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
