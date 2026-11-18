// session-repos.js — the Sessions pane's Repos lens: the repos the recorded
// sessions worked in, as a list over (or beside) a strip of one card per repo
// (html-style rule 11, through kits/linked-swiper.js), and the swipe deck
// over the same cards.
//
// A row is a repo, led by its mark, with the sessions that worked in it as a
// count and a bar on one scale. The first row is every repo at once. A card
// names its repo, then states its sessions and branches on one line, then
// the repos it was worked with, each a mark and the sessions the two share
// (on the first card, the pairs worked together most), then its sessions as
// stars: a hub per session and a satellite per repo-branch it worked on,
// each satellite the repo's own mark. On a repo's card that repo's own
// satellites are dimmed, since every star there has one, so the marks that
// stand out are where else the session went. The session picked on a card
// leads it: its closing glyph, its name, its day and length, and what it was
// asked. A tap on a star picks it, a tap on the picked session's name opens
// it, and a tap on a companion moves the list to that repo.
//
// A session names a repo when that checkout was its working directory, which
// is narrower than every repo it touched. An owner-qualified name and a bare
// one (mehrlander/home, home) are one repo here.
//
// Mounted by lib/alpineComponents/estate.js as x-data="sessionRepos(cfg)":
//   cfg.rows()          the session rows (RepoSessionsCache summaries)
//   cfg.key()           changes when the rows or the repo marks do
//   cfg.mark(repo, o)   a repo's mark, as estate's repoMarkHtml draws it
//   cfg.label(row)      a session's name, as a list row draws it
//   cfg.state(row)      [glyph, sentence] for the state the session closed in
//   cfg.dur(mins)       a session's length, as a list row states it
//   cfg.open(row)       open the session
//
// window.SessionRepos = { model, ALL } for the suite.
(() => {
  const esc = s => window.esc(s);
  const ALL = '*';
  const bare = n => String(n || '').replace(/^[^/]+\//, '');
  const branchOf = x => x.branch && x.branch !== 'main' ? x.branch : '';

  // The rows, folded per repo. A session's satellites are its distinct
  // repo-branches, a repo it worked in on its default branch counting once.
  function model(rows) {
    const by = new Map(), pairs = new Map(), stars = [];
    for (const r of rows || []) {
      const seen = new Set(), sats = [];
      for (const x of r.repos || []) {
        const repo = bare(x.name);
        if (!repo) continue;
        const branch = branchOf(x), k = repo + '\n' + branch;
        if (seen.has(k)) continue;
        seen.add(k);
        sats.push({ repo, branch });
      }
      if (!sats.length) continue;
      const star = { id: r.id, row: r, day: r.day || '', sats };
      stars.push(star);
      const names = [...new Set(sats.map(s => s.repo))].sort();
      for (const n of names) {
        let e = by.get(n);
        if (!e) by.set(n, e = { name: n, stars: [], branches: 0, with: new Map(), first: '', last: '' });
        e.stars.push(star);
        e.branches += sats.filter(s => s.repo === n && s.branch).length;
        if (star.day && (!e.first || star.day < e.first)) e.first = star.day;
        if (star.day && star.day > e.last) e.last = star.day;
        for (const m of names) if (m !== n) e.with.set(m, (e.with.get(m) || 0) + 1);
      }
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++) {
          const k = names[i] + '\n' + names[j];
          pairs.set(k, (pairs.get(k) || 0) + 1);
        }
    }
    // Widest session first, then newest, so a card reads as a gradient from
    // the session that went furthest down to the many that stayed home.
    const order = (a, b) => (b.sats.length - a.sats.length) || (b.day > a.day ? 1 : b.day < a.day ? -1 : 0);
    const days = stars.map(s => s.day).filter(Boolean).sort();
    const all = { name: ALL, stars: stars.slice().sort(order),
                  branches: stars.reduce((n, s) => n + s.sats.filter(x => x.branch).length, 0),
                  first: days[0] || '', last: days[days.length - 1] || '',
                  pairs: [...pairs].map(([k, n]) => ({ a: k.split('\n')[0], b: k.split('\n')[1], n }))
                    .sort((x, y) => (y.n - x.n) || x.a.localeCompare(y.a) || x.b.localeCompare(y.b)) };
    const repos = [...by.values()].map(e => ({
      ...e, stars: e.stars.slice().sort(order),
      with: [...e.with].map(([name, n]) => ({ name, n })).sort((x, y) => (y.n - x.n) || x.name.localeCompare(y.name)),
    })).sort((a, b) => (b.stars.length - a.stars.length) || a.name.localeCompare(b.name));
    return { all, repos };
  }

  window.SessionRepos = { model, ALL };

  // The selection outlives the component, which is torn down when another
  // lens is picked: coming back to Repos lands on the repo left.
  let kept = '';
  const picks = new Map();

  // One star's geometry: satellites on a ring, the first at twelve o'clock.
  const R = 21;
  const at = (j, n) => {
    const a = (j / n) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * R, Math.sin(a) * R];
  };

  document.addEventListener('alpine:init', () => Alpine.data('sessionRepos', (cfg) => ({
    description: 'Repos: the repos the recorded sessions worked in, a list beside a card per repo with the repos it was worked with and its sessions drawn as stars, a satellite per repo-branch.',
    cfg,
    loading: true, sel: '', m: { all: { stars: [], pairs: [] }, repos: [] },

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
        noun: 'repo', seam: 'session-repos-list', listMax: 'max-h-[34dvh]', slim: true, stackBelow: 720,
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
      const top = Math.max(1, this.m.all.stars.length);
      const row = (id, lead, name, n) =>
        `<div data-repo="${esc(id)}" tabindex="-1" data-part="item"`
        + ` class="flex min-h-10 cursor-pointer items-center gap-2.5 border-b border-base-200 px-3 hover:bg-base-200/60 aria-selected:bg-primary/10">`
        + `<span class="inline-flex w-6 flex-none justify-center">${lead}</span>`
        + `<span class="min-w-0 flex-1 truncate text-base">${esc(name)}</span>`
        + `<span class="h-1.5 w-14 flex-none overflow-hidden rounded-full bg-base-200" aria-hidden="true">`
        + `<span class="block h-full rounded-full bg-primary/50" style="width:${Math.max(4, Math.round(n / top * 100))}%"></span></span>`
        + `<span class="w-9 flex-none text-right font-mono text-sm tabular-nums text-base-content/60">${n}</span></div>`;
      return row(ALL, '<i class="ph ph-asterisk text-xl text-base-content/70" aria-hidden="true"></i>', 'All repos', this.m.all.stars.length)
        + this.m.repos.map(e => row(e.name, this.mark(e.name, 'text-xl'), e.name, e.stars.length)).join('');
    },
    mark(repo, size) { return this.cfg.mark(repo, { cls: size, pending: 'glyph' }); },

    headHtml(id, i, n, tight) {
      const lead = id === ALL ? '<i class="ph ph-asterisk text-lg text-base-content/70" aria-hidden="true"></i>' : this.mark(id, 'text-lg');
      return `<span class="mr-2 inline-flex flex-none">${lead}</span>`
        + linkedSwiper.head({ title: id === ALL ? 'All repos' : id }, i, n, 'repo', { deck: true, tight, slim: true });
    },

    // ── A card ──────────────────────────────────────────────────────────
    // Drawn as markup, for the strip and the deck alike; its taps are heard
    // on the element it fills, so both answer the same way.
    fill(id, el) {
      const e = this.entry(id);
      el.dataset.srCard = id;
      if (!e) { el.innerHTML = ''; return; }
      if (!picks.has(id) || !e.stars.some(s => s.id === picks.get(id))) picks.set(id, e.stars[0]?.id || '');
      const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
      // Month and day, as a list row dates a session, with the year only
      // where the span crosses one.
      const md = (d) => e.first.slice(0, 4) === e.last.slice(0, 4) ? d.slice(5) : d;
      const span = e.first && e.last ? (e.first === e.last ? md(e.first) : md(e.first) + ' → ' + md(e.last)) : '';
      const facts = [plural(e.stars.length, 'session', 'sessions'), plural(e.branches, 'branch', 'branches'), span].filter(Boolean)
        .map(t => `<span class="whitespace-nowrap">${esc(t)}</span>`).join('<span class="text-base-content/30">·</span>');
      const label = 'text-sm font-medium text-base-content/60';
      const chip = 'inline-flex flex-none items-center gap-1 rounded-full bg-base-200/60 px-2 py-0.5';
      const together = id === ALL
        ? e.pairs.slice(0, 12).map(p =>
            `<span class="${chip}" data-title-tip="${esc(p.a + ' and ' + p.b + ': ' + plural(p.n, 'session', 'sessions'))}">`
            + this.mark(p.a, 'text-[17px]') + this.mark(p.b, 'text-[17px]')
            + `<span class="font-mono text-sm tabular-nums text-base-content/60">${p.n}</span></span>`).join('')
        : e.with.map(w =>
            `<button type="button" class="${chip} hover:bg-base-300/70" data-repo-go="${esc(w.name)}"`
            + ` data-title-tip="${esc(plural(w.n, 'session', 'sessions') + ' worked in both')}" data-title-tip-lead="${esc(w.name)}" aria-label="${esc(w.name + ', ' + w.n)}">`
            + this.mark(w.name, 'text-[17px]')
            + `<span class="font-mono text-sm tabular-nums text-base-content/60">${w.n}</span></button>`).join('');
      el.innerHTML = `<div class="flex flex-col gap-3">`
        + `<div class="sticky top-0 z-10 -mx-3.5 -mt-2 border-b border-base-200 bg-base-100 px-3.5 pt-2 pb-2.5" data-sr-picked>${this.pickedHtml(id)}</div>`
        + `<p class="flex flex-wrap items-center gap-x-2 text-base text-base-content/70">${facts}</p>`
        + (together ? `<div><h3 class="mb-1.5 ${label}">${id === ALL ? 'Worked together' : 'Worked with'}</h3>`
          + `<div class="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">${together}</div></div>` : '')
        + `<div><h3 class="mb-1 ${label}">Sessions</h3>`
        + `<div class="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] justify-items-center gap-0.5">`
        + e.stars.map(s => this.starHtml(s, id)).join('') + `</div></div></div>`;
      el.onclick = (ev) => this.tap(ev, id);
    },

    starHtml(s, id) {
      const n = s.sats.length, on = picks.get(id) === s.id;
      const spokes = s.sats.map((_, j) => {
        const [x, y] = at(j, n);
        return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-width="1" opacity=".3"/>`;
      }).join('');
      const sats = s.sats.map((t, j) => {
        const [x, y] = at(j, n);
        const dim = id !== ALL && t.repo === id ? ' opacity-35' : '';
        return `<span class="absolute inline-flex -translate-x-1/2 -translate-y-1/2${dim}" style="left:calc(50% + ${x.toFixed(1)}px);top:calc(50% + ${y.toFixed(1)}px)">`
          + this.mark(t.repo, 'text-[13px]') + `</span>`;
      }).join('');
      const name = this.cfg.label(s.row) || s.id;
      return `<button type="button" data-star="${esc(s.id)}" aria-pressed="${on}" aria-label="${esc(name)}"`
        + ` class="relative size-16 rounded-lg text-base-content hover:bg-base-200/70 aria-pressed:bg-primary/10 aria-pressed:ring-2 aria-pressed:ring-[var(--color-primary)]">`
        + `<svg class="pointer-events-none absolute inset-0 size-full" viewBox="-32 -32 64 64" aria-hidden="true">${spokes}</svg>`
        + `<span class="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-base-content"></span>`
        + sats + `</button>`;
    },

    // The picked session, named the way a list row names it: the glyph it
    // closed on, what it is called, then when and how long, then its ask.
    pickedHtml(id) {
      const e = this.entry(id), s = e?.stars.find(x => x.id === picks.get(id));
      if (!s) return '';
      const r = s.row, [glyph, note] = this.cfg.state(r) || [];
      const name = this.cfg.label(r);
      return `<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-base">`
        + (glyph ? `<span class="flex-none leading-none" data-title-tip="${esc(note || '')}">${esc(glyph)}</span>` : '')
        + `<button type="button" data-sr-open class="min-w-0 break-all text-left font-semibold hover:text-primary">${esc(name || r.id)}</button>`
        + `<span class="flex-none font-mono text-sm tabular-nums text-base-content/50">${esc([(r.day || '').slice(5), this.cfg.dur(r.mins || 0)].filter(Boolean).join(' · '))}</span>`
        + `</div>`
        + (r.ask ? `<p class="mt-0.5 truncate text-base text-base-content/70">${esc(r.ask)}</p>` : '');
    },

    tap(ev, id) {
      const t = ev.target instanceof Element ? ev.target : null;
      if (!t) return;
      const go = t.closest('[data-repo-go]');
      if (go) { ev.preventDefault(); this._swiper?.pick(go.dataset.repoGo); return; }
      if (t.closest('[data-sr-open]')) {
        const e = this.entry(id), s = e?.stars.find(x => x.id === picks.get(id));
        if (s) { ev.preventDefault(); this._deck?.close?.(); this.cfg.open(s.row); }
        return;
      }
      const star = t.closest('[data-star]');
      if (!star) return;
      ev.preventDefault();
      picks.set(id, star.dataset.star);
      // The strip and the deck may each hold this card: both follow.
      for (const card of document.querySelectorAll('[data-sr-card]')) {
        if (card.dataset.srCard !== id) continue;
        for (const b of card.querySelectorAll('[data-star]')) b.setAttribute('aria-pressed', String(b.dataset.star === picks.get(id)));
        const head = card.querySelector('[data-sr-picked]');
        if (head) head.innerHTML = this.pickedHtml(id);
      }
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
