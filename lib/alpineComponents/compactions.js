// compactions.js — every compaction summary in the session store, newest first,
// a list over a strip of one card per summary (html-style rule 11, through
// kits/linked-swiper.js), and the swipe deck over the same cards.
//
// When a Claude Code session's context fills, the harness replaces the
// conversation with a summary. web-tools-private keeps each one as
// sessions/compactions/YYYY/MM/<day>-<short>-<UTC time>.json: one object
// (schema compaction/1: context_before, context_after, chars, ordinal,
// opening_ask and the session's ids), its `text` the summary as the harness
// wrote it. A summary's id is its file name without `.json`. The list is three levels of contents-API listings, which give each
// file's name and size; a file is read only when its card is the one in view.
// The store is private, so the reads carry the viewer's stored token.
//
// One component, two hosts:
//
//   pages/compactions.html   x-data="compactions()"   its own header, `#at=<id>`
//   the app's Activity row   x-data="compactions(cfg)", cfg from estate.js:
//     cfg.item()        the open summary the shell's address names (`&item=`)
//     cfg.setItem(id)   the reader picked one; the shell stamps it
//     cfg.label(short)  the session's title or opening ask, from the sessions
//                       index the estate already holds, or ''
//     cfg.labels()      a key that changes when that index does
//     cfg.sessionHref(short), cfg.openSession(short, event)
//
// A card leads with the file's facts, then the summary. A summary in
// the harness's nine-section shape is reordered for a reader after the gist:
// what was asked, what the user said, where the work stood, what remained and
// what came next, open; then the four technical sections, each folded until
// opened. Any other shape is drawn whole, in its written order. Bullets nest by
// their indentation, as the source writes them; bold and code are marked and
// the words are left as written. The harness's own text around the summary
// (the reminder block, the "continued from a previous conversation" lead and
// the closing instruction to resume) is the same on every file and left out.
(() => {
  const ROOT = 'sessions/compactions';
  const esc = (s) => window.esc(String(s ?? ''));
  // Read summaries, by row id, and the cards waiting on one. Outside Alpine:
  // a summary runs to 27,000 characters and nothing on the page reacts to it.
  const DOCS = new Map();
  const WAITING = new Map();
  const READING = new Map();

  // The nine sections, by number, and the reading order: the plain-language
  // five open, then the technical four folded.
  const KNOWN = {
    1: /primary request/i, 2: /technical concepts/i, 3: /files and code/i, 4: /errors/i,
    5: /problem solving/i, 6: /user messages/i, 7: /pending tasks/i, 8: /current work/i, 9: /next step/i,
  };
  const PLAIN = [1, 6, 8, 7, 9];
  const TECH = [2, 3, 4, 5];

  // `<day>-<short>-<YYYYMMDDTHHMMSSZ>`, the store's own name for a summary.
  const parseName = (name) => {
    const m = /^(\d{4}-\d{2}-\d{2})-([0-9a-f]{8})-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(name);
    if (!m) return null;
    const at = new Date(Date.UTC(+m[3], m[4] - 1, +m[5], +m[6], +m[7], +m[8]));
    return { day: m[1], short: m[2], at };
  };

  // A file's object (or its JSON text): every key but `text` is a fact about
  // the summary, and `text` is the summary.
  function parseDoc(data) {
    const { text, ...meta } = typeof data === 'string' ? JSON.parse(data) : (data || {});
    let body = String(text ?? '').replace(/\r\n/g, '\n');
    body = body.replace(/<system-reminder>[\s\S]*?<\/system-reminder>\n?/g, '')
      .replace(/<tools-used-before-summary>[\s\S]*?<\/tools-used-before-summary>\n?/g, '')
      .replace(/^\s+/, '')
      .replace(/^This session is being continued from a previous conversation that ran out of context\. The summary below covers the earlier portion of the conversation\.\s*/, '')
      .replace(/^Summary:[ \t]*\n/, '')
      .replace(/\n*If you need specific details from before compaction[\s\S]*$/, '');
    // A section head is `N. Name:` at the start of a line, the name sometimes
    // in bold and then sometimes without its colon. Numbers rise by one to
    // three, which skips a numbered line inside a section, and a number from
    // one to nine must carry its known name.
    const heads = [];
    let prev = 0;
    for (const h of body.matchAll(/^(\d{1,2})\.[ \t]+(.+?)[ \t]*$/gm)) {
      const n = +h[1];
      const name = h[2].replace(/\*\*/g, '').trim();
      if (n <= prev || n > prev + 3 || !(KNOWN[n] ? KNOWN[n].test(name) : /:$/.test(name))) continue;
      heads.push({ n, name: name.replace(/:$/, ''), index: h.index, len: h[0].length });
      prev = n;
    }
    const sections = heads.map((h, i) => {
      const end = i + 1 < heads.length ? heads[i + 1].index : body.length;
      return { n: h.n, name: h.name, tech: TECH.includes(h.n),
               text: body.slice(h.index + h.len, end).replace(/^\n/, '').replace(/\s+$/, '') };
    });
    const nine = sections.length === 9 && sections.every((s, i) => s.n === i + 1);
    if (!nine) for (const s of sections) s.tech = false;
    const lead = (heads.length ? body.slice(0, heads[0].index) : body).replace(/\s+$/, '');
    return { meta, lead, sections, nine };
  }

  // Bold and code marked; every other character as written.
  function inline(el, text) {
    let at = 0;
    for (const m of text.matchAll(/\*\*([^*\n]+?)\*\*|`([^`\n]+)`/g)) {
      if (m.index > at) el.append(text.slice(at, m.index));
      const s = document.createElement(m[1] != null ? 'strong' : 'code');
      s.className = m[1] != null ? 'font-semibold' : 'break-words font-mono text-[0.9em] text-base-content/75';
      s.textContent = m[1] != null ? m[1] : m[2];
      el.append(s);
      at = m.index + m[0].length;
    }
    if (at < text.length) el.append(text.slice(at));
    return el;
  }

  // The summary's lines as blocks: bullets nested by their indentation (the
  // harness indents three spaces under a head and two more per level), fenced
  // code as code, and any other run of lines as a paragraph inside the item
  // it is indented under.
  const ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
  const FENCE = /^(\s*)(```|~~~)/;
  const LIST = {
    ul: ['list-disc', 'list-[circle]', 'list-[square]'],
    ol: ['list-decimal', 'list-[lower-alpha]', 'list-[lower-roman]'],
  };
  function blocks(text) {
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-2';
    const stack = [];
    let para = null;
    const host = (indent) => {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      return stack.length ? stack[stack.length - 1].li : root;
    };
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) { para = null; continue; }
      const indent = /^\s*/.exec(line)[0].length;
      const f = FENCE.exec(line);
      if (f) {
        const code = [];
        for (i++; i < lines.length && !lines[i].trimStart().startsWith(f[2]); i++) code.push(lines[i]);
        const pre = document.createElement('pre');
        pre.className = 'overflow-x-auto whitespace-pre rounded-md bg-base-200 px-3 py-2 font-mono text-[0.85em] leading-relaxed';
        pre.textContent = code.map(l => l.slice(Math.min(indent, /^\s*/.exec(l)[0].length))).join('\n');
        host(indent).append(pre);
        para = null;
        continue;
      }
      const m = ITEM.exec(line);
      if (m) {
        const kind = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length && stack[stack.length - 1].indent > indent + 1) stack.pop();
        let top = stack[stack.length - 1];
        if (top && Math.abs(top.indent - indent) <= 1 && top.kind !== kind) { stack.pop(); top = stack[stack.length - 1]; }
        if (!top || Math.abs(top.indent - indent) > 1) {
          const list = document.createElement(kind);
          const depth = stack.filter(s => s.kind === kind).length;
          list.className = (kind === 'ol' ? 'pl-7 ' : 'pl-6 ') + LIST[kind][Math.min(depth, 2)]
            + ' space-y-1 marker:text-base-content/45';
          if (kind === 'ol') list.start = parseInt(m[2], 10) || 1;
          (top ? top.li : root).append(list);
          top = { indent, kind, list, li: null };
          stack.push(top);
        }
        const li = document.createElement('li');
        li.className = 'pl-0.5';
        inline(li, m[3]);
        top.list.append(li);
        top.li = li;
        para = null;
        continue;
      }
      const h = host(indent);
      const t = line.trim();
      const table = t.startsWith('|');
      if (para && para.parentNode === h && para.dataset.table === String(table)) {
        para.append(document.createElement('br'));
        inline(para, t);
        continue;
      }
      para = document.createElement('div');
      para.dataset.table = String(table);
      if (table) para.className = 'overflow-x-auto whitespace-pre font-mono text-[0.85em]';
      inline(para, t);
      h.append(para);
    }
    return root;
  }

  const fmtSize = (n) => n && window.Traffic?.fmtBytes ? window.Traffic.fmtBytes(n) : '';

  // For the suite: the parse and the drawing, without a page.
  window.Compactions = { parseDoc, blocks, PLAIN, TECH };

  document.addEventListener('alpine:init', () => Alpine.data('compactions', (cfg = null) => ({
    description: 'Compactions: every compaction summary in the session store, newest first, one opened beside or under the list with its plain-language sections first and its technical sections folded.',
    cfg,
    loading: true, error: '', rows: [], sel: '',
    get standalone() { return !this.cfg; },
    get store() { return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
    get token() { return window.TOKEN || window.ghAuth?.resolve() || ''; },

    template: `
      <template x-if="standalone">
        <header class="flex-none border-b border-base-300 bg-base-100">
          <div class="flex items-center gap-2 px-3 py-2">
            <i class="ph ph-arrows-in-line-vertical text-lg text-base-content/60"></i>
            <h1 class="min-w-0 truncate text-base font-bold">Compactions</h1>
            <span x-show="rows.length" class="font-mono text-xs tabular-nums text-base-content/60" x-text="rows.length"></span>
            <a href="https://mehrlander.github.io/web-tools/app/?view=compactions" target="_top"
               class="btn btn-ghost btn-sm btn-square ml-auto" data-title-tip="Compactions in Web Tools" aria-label="Compactions in Web Tools">
              <i class="ph ph-terminal-window text-lg"></i></a>
          </div>
        </header>
      </template>
      <div x-show="loading" class="flex items-center gap-2 py-3 text-base text-base-content/70" :class="standalone && 'px-3'">
        <span class="loading loading-spinner loading-sm"></span> Listing summaries
      </div>
      <div x-show="error" class="alert alert-error px-3 py-2" :class="standalone && 'm-3'">
        <i class="ph ph-warning-circle"></i><span x-text="error"></span>
      </div>
      <div x-show="rows.length" class="flex min-h-0 flex-1 flex-col" :class="standalone && 'p-2.5'">
        <div x-ref="root">
          <div x-ref="list" role="listbox" aria-label="Compaction summaries" data-pattern="list" data-part="list"></div>
          <div x-ref="card" @click="goSection($event)"></div>
        </div>
      </div>`,

    init() {
      this.$el.innerHTML = this.template;
      this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
      this.start();
      // Left and Right step the list wherever the strip's own keys do not
      // reach (they answer while the card has the pointer or the focus), and
      // only while this view is on screen.
      this._keys = (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        if (!this.$el.isConnected || !this.$el.getClientRects().length) return;
        if (window.swipeDeck?.top?.() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable) return;
        e.preventDefault();
        this._swiper?.step(d);
      };
      document.addEventListener('keydown', this._keys);
      if (this.cfg) {
        // Back and Forward move the open summary through the shell's address.
        this.$watch(() => this.cfg.item?.(), (id) => {
          if (id && id !== this.sel && this.byId(id)) this._swiper?.pick(id);
        });
        // The sessions index arriving (or refreshing) names the rows.
        this.$watch(() => this.cfg.labels?.(), () => this.relist());
      }
    },
    destroy() { document.removeEventListener('keydown', this._keys); this._swiper?.destroy(); },

    // The kits this view draws with, from the pre-build's cache in the app
    // and on the standalone page alike.
    async deps() {
      if (!window.TitleTip) await gh.load('kits/title-tip.js');
      if (!window.swipeDeck) await gh.load('kits/swipe-deck.js');
      if (!window.dockSplit) await gh.load('kits/dock-split.js');
      if (!window.linkedSwiper) await gh.load('kits/linked-swiper.js');
      if (!window.Traffic) await gh.load('kits/traffic.js');
    },

    async start() {
      try {
        await this.deps();
        this.gh = new GH({ token: this.token, repo: this.store, ref: 'main' });
        this.rows = await this.list();
        if (!this.rows.length) { this.error = 'No compaction summaries in ' + this.store + ' ' + ROOT; return; }
        const at = this.standalone ? this.param('at') : this.cfg.item?.();
        this.sel = this.byId(at) ? at : this.rows[0].id;
        this.$nextTick(() => this.mount());
      } catch (e) {
        this.error = ROOT + ': ' + (e?.message || e);
      } finally {
        this.loading = false;
      }
    },

    param(key) {
      const h = new URLSearchParams((location.hash || '').replace(/^#/, '')).get(key);
      return h || new URLSearchParams(location.search).get(key);
    },
    // The address follows the reader: the page's own fragment, or the shell's.
    address() {
      if (!this.sel) return;
      if (this.cfg) { this.cfg.setItem?.(this.sel); return; }
      if (!/^https?:$/.test(location.protocol)) return;
      try { history.replaceState(history.state, '', '#at=' + encodeURIComponent(this.sel)); } catch {}
    },
    byId(id) { return this.rows.find(r => r.id === id); },
    when(r, long) {
      const d = r.at;
      const day = d.toLocaleDateString([], { month: 'short', day: 'numeric',
        ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
      return day + ' ' + d.toLocaleTimeString([], { hour: long ? 'numeric' : '2-digit', minute: '2-digit' });
    },
    label(short) { return (this.cfg?.label?.(short) || '').trim(); },
    sessionHref(short) {
      return this.cfg?.sessionHref?.(short) || 'session.html#id=' + encodeURIComponent(short);
    },

    // Years, then months, then each month's files: the listings are the index.
    async list() {
      const dirs = (xs) => xs.filter(x => x.type === 'dir' && /^\d+$/.test(x.name)).map(x => x.path);
      const years = dirs(await this.gh.ls(ROOT));
      const months = (await Promise.all(years.map(y => this.gh.ls(y)))).flatMap(dirs);
      const files = (await Promise.all(months.map(m => this.gh.ls(m)))).flat();
      const rows = [];
      for (const f of files) {
        if (f.type !== 'file' || !f.name.endsWith('.json')) continue;
        const id = f.name.slice(0, -5), n = parseName(id);
        if (n) rows.push({ id, path: f.path, size: f.size || 0, ...n });
      }
      return rows.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
    },

    // A row: when and how long on one line, then the session it came from, by
    // its title where the sessions index has one and by its short id where not.
    rowHtml(r) {
      const name = this.label(r.short);
      const who = name
        ? `<div class="truncate text-base">${esc(name)}</div>`
        : `<a href="${esc(this.sessionHref(r.short))}" class="link link-hover self-start font-mono text-base text-primary"`
          + ` data-title-tip="Open session ${esc(r.short)}" aria-label="Open session ${esc(r.short)}">${esc(r.short)}</a>`;
      return `<div data-cmp="${esc(r.id)}" tabindex="-1" data-part="item" class="flex flex-col gap-0.5 border-b border-base-200 px-3 py-2 cursor-pointer hover:bg-base-200/60 aria-selected:bg-primary/10">`
        + `<div class="flex items-baseline gap-2 font-mono text-xs tabular-nums text-base-content/60">`
        + `<span>${esc(this.when(r))}</span><span class="ml-auto">${esc(fmtSize(r.size))}</span></div>`
        + who + `</div>`;
    },
    relist() {
      if (!this._swiper || !this.$refs.list) return;
      this.$refs.list.innerHTML = this.rows.map(r => this.rowHtml(r)).join('');
      linkedSwiper.mark(this.$refs.list, 'cmp', this.sel);
      this._swiper.paint();
    },

    mount() {
      this.$refs.list.innerHTML = this.rows.map(r => this.rowHtml(r)).join('');
      this._swiper = linkedSwiper.attach({
        root: this.$refs.root, list: this.$refs.list, card: this.$refs.card, key: 'cmp',
        ids: () => this.rows.map(r => r.id), sel: () => this.sel,
        noun: 'summary', seam: 'compactions-list', listMax: 'max-h-[38vh]',
        // The arrows stay at every width: a phone swipes, and can also step.
        tightBelow: 0,
        name: (id) => this.nameOf(id),
        body: (id, el) => { this.fill(id, el, false); },
        empty: '',
        onPick: (id, via) => {
          this.sel = id;
          this.address();
          this.read(id);
          if (this._deck && via !== 'deck') {
            const i = this.rows.findIndex(r => r.id === id);
            this._deck.deck.go(i, 'instant');
          }
        },
        deck: () => this.openDeck(),
      });
      this.read(this.sel);
      const keep = () => linkedSwiper.mark(this.$refs.list, 'cmp', this.sel);
      requestAnimationFrame(() => requestAnimationFrame(keep));
    },

    nameOf(id) {
      const r = this.byId(id);
      if (!r) return {};
      const d = DOCS.get(id);
      const n = d && !d.error && d.meta.ordinal;
      // The session's id is on the card's first line, as its link, so the head
      // row carries only when and which compaction.
      return { when: this.when(r), title: n ? 'Compaction ' + n : 'Compaction' };
    },

    // A card is drawn from the summary once it has been read. Until then it
    // waits, and only the card in view is read: a neighbour the strip builds
    // ahead is filled when the reader arrives on it.
    fill(id, el, big) {
      const d = DOCS.get(id);
      if (!d) {
        el.innerHTML = '<div class="flex justify-center py-10"><span class="loading loading-dots loading-md opacity-30"></span></div>';
        if (!WAITING.has(id)) WAITING.set(id, new Set());
        WAITING.get(id).add({ el, big });
        if (id === this.sel) this.read(id);
        return;
      }
      el.replaceChildren(this.cardEl(id, d, big));
    },
    read(id) {
      const r = this.byId(id);
      if (!r || DOCS.has(id) || READING.has(id)) return;
      READING.set(id, (async () => {
        try { DOCS.set(id, parseDoc((await this.gh.get(r.path)).text)); }
        catch (e) { DOCS.set(id, { error: e?.message || String(e) }); }
        READING.delete(id);
        for (const w of WAITING.get(id) || []) if (w.el.isConnected) this.fill(id, w.el, w.big);
        WAITING.delete(id);
        if (id === this.sel) this._swiper?.paint();
      })());
    },

    cardEl(id, d, big) {
      const r = this.byId(id);
      const box = document.createElement('div');
      if (d.error) {
        box.className = 'alert alert-warning';
        box.textContent = r.path + ': ' + d.error;
        return box;
      }
      const m = d.meta;
      const num = (v) => Number.isFinite(v) ? v.toLocaleString('en-US') : '?';
      box.className = 'flex flex-col gap-4 ' + (big ? 'text-xl leading-8' : 'text-base leading-7');
      const order = d.nine
        ? [...PLAIN, ...TECH].map(n => d.sections.find(s => s.n === n))
        : d.sections;
      const facts = [
        `<span>${esc(num(m.context_before))} → ${esc(num(m.context_after))} tokens of context</span>`,
        Number.isFinite(m.chars) ? `<span>${esc(num(m.chars))} characters</span>` : '',
        `<a href="${esc(this.sessionHref(r.short))}" data-session-link="${esc(r.short)}" class="link link-hover text-primary">session ${esc(r.short)}</a>`,
      ].filter(Boolean).join('');
      const pill = (s) => `<button type="button" data-sec-go="${s.n}" class="btn btn-xs rounded-full font-normal btn-ghost border border-base-300 flex-none">`
        + `<span class="font-mono opacity-60">${s.n}</span><span class="max-w-56 truncate">${esc(s.name.replace(/\s*\(.*$/, ''))}</span>`
        + (s.tech ? '<i class="ph ph-caret-right opacity-50"></i>' : '') + `</button>`;
      const pills = order.map((s, i) => (s.tech && !order[i - 1]?.tech ? '<span class="mx-1 h-4 w-px flex-none self-center bg-base-300"></span>' : '') + pill(s)).join('');
      box.innerHTML = `<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs tabular-nums text-base-content/70">${facts}</div>`
        + (m.opening_ask ? `<div class="line-clamp-3 text-base-content/70">${esc(m.opening_ask)}</div>` : '')
        + (pills ? `<nav data-sec-nav class="sticky -top-3 z-10 -mx-3.5 -my-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-base-200 bg-base-100 px-3.5 pt-3 pb-1.5 [scrollbar-width:none]" aria-label="Sections">${pills}</nav>` : '');
      const link = box.querySelector('[data-session-link]');
      if (link && this.cfg?.openSession) link.addEventListener('click', (e) => this.cfg.openSession(r.short, e));
      if (d.lead) box.append(blocks(d.lead));
      for (const s of order) box.append(s.tech ? this.fold(s) : this.section(s));
      return box;
    },
    head(s, tag) {
      const h = document.createElement(tag);
      h.className = 'flex min-w-0 items-baseline gap-2 font-semibold';
      const n = document.createElement('span');
      n.className = 'font-mono text-xs font-normal tabular-nums text-base-content/50';
      n.textContent = s.n + '.';
      h.append(n, inline(document.createElement('span'), s.name));
      return h;
    },
    section(s) {
      const sec = document.createElement('section');
      sec.dataset.sec = String(s.n);
      sec.className = 'flex flex-col gap-1.5 scroll-mt-14';
      sec.append(this.head(s, 'h3'));
      if (s.text) sec.append(blocks(s.text));
      return sec;
    },
    // A technical section folds, its size on the fold, its body drawn on the
    // first open: Files and Code Sections alone is a quarter of a summary.
    fold(s) {
      const det = document.createElement('details');
      det.dataset.sec = String(s.n);
      det.className = 'group scroll-mt-14 rounded-lg border border-base-200';
      const sum = document.createElement('summary');
      sum.className = 'flex cursor-pointer select-none items-baseline gap-2 px-3 py-1.5 list-none [&::-webkit-details-marker]:hidden hover:bg-base-200/60 rounded-lg';
      const caret = document.createElement('i');
      caret.className = 'ph ph-caret-right self-center flex-none text-base-content/50 transition-transform group-open:rotate-90';
      const h = this.head(s, 'h3');
      h.classList.add('flex-1');
      const size = document.createElement('span');
      size.className = 'ml-auto flex-none font-mono text-xs tabular-nums text-base-content/50';
      size.textContent = s.text.length.toLocaleString('en-US') + ' characters';
      sum.append(caret, h, size);
      const body = document.createElement('div');
      body.className = 'border-t border-base-200 px-3 py-2';
      det.append(sum, body);
      det._fill = () => { if (!body.firstChild && s.text) body.append(blocks(s.text)); };
      det.addEventListener('toggle', () => { if (det.open) det._fill(); });
      return det;
    },

    // A section pill scrolls its card to that section, opening a fold first.
    goSection(e) {
      const b = e.target instanceof Element ? e.target.closest('[data-sec-go]') : null;
      if (!b) return;
      const card = b.closest('[data-sec-nav]')?.parentElement;
      const sec = card?.querySelector(`[data-sec="${b.getAttribute('data-sec-go')}"]`);
      if (sec?._fill && !sec.open) { sec._fill(); sec.open = true; }
      let sc = sec?.parentElement;
      while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (!sec || !sc || sc === document.body) return;
      const nav = card.querySelector('[data-sec-nav]');
      sc.scrollTo({ top: sc.scrollTop + sec.getBoundingClientRect().top - sc.getBoundingClientRect().top - (nav?.offsetHeight || 0) - 4 });
    },

    openDeck() {
      const ids = this.rows.map(r => r.id);
      this._deck = swipeDeck.open({
        count: ids.length, start: Math.max(0, ids.indexOf(this.sel)),
        title: 'Compactions', icon: 'ph-arrows-in-line-vertical', innerClass: 'w-full',
        index: (i) => ({ title: this.when(this.rows[i]) + ' · ' + (this.label(this.rows[i].short) || this.rows[i].short) }),
        render: (i, el) => this.fill(ids[i], el, true),
        onSlide: (i) => this._swiper?.pick(ids[i]),
        onClose: () => { this._deck = null; },
      });
      this._deck.el.addEventListener('click', (e) => this.goSection(e));
    },
  })));
})();
