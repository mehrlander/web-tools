// compactions.js — the sessions whose context was compacted, newest first: a
// list of sessions over a strip of one card per compaction summary (html-style
// rule 11, through kits/linked-swiper.js), and the swipe deck over the same
// cards.
//
// When a Claude Code session's context fills, the harness replaces the
// conversation with a summary. web-tools-private keeps each one as
// sessions/compactions/YYYY/MM/<day>-<short>-<UTC time>.json: one object
// (schema compaction/1: context_before, context_after, chars, ordinal,
// opening_ask and the session's ids), its `text` the summary as the harness
// wrote it. A summary's id is its file name without `.json`, and its session's
// record name is that id without the time. The list is three levels of
// contents-API listings, which give each file's name and size; a file is read
// only when its summary is the one open on the card in view.
// The store is private, so the reads carry the viewer's stored token.
//
// One component, two hosts:
//
//   pages/compactions.html   x-data="compactions()"   its own header, `#at=<id>`
//   the app's Activity row   x-data="compactions(cfg)", cfg from estate.js:
//     cfg.item()        the open summary the shell's address names (`&item=`)
//     cfg.setItem(id)   the reader opened one; the shell stamps it
//     cfg.label(short)  the session's title or opening ask, from the sessions
//                       index the estate already holds, or ''
//     cfg.labels()      a key that changes when that index does
//     cfg.sessionHref(short)   the session's address, which the Cost tab's is built on
//
// A list row is a session: the day of its latest compaction, its title, and,
// where it was compacted more than once, a strip of numbered tabs, one per
// compaction in time order. The cards run session by session and, inside a
// session, compaction by compaction, so a swipe steps through one session's
// summaries before it moves to the next row. A tap on a row opens the
// session's first summary, and a tap on a tab opens that one. The row of the
// open summary is tinted and its tab is the active one.
// A card is headed by its session's title, led by which of the session's
// compactions it is ("2 of 4") where there is more than one. First on it is
// the session's chart: the context after each prompt, the sawtooth each
// compaction cuts, drawn over the cost of each prompt in one short panel with
// two axes (kits/usage-chart.js's combined form), this summary's drop picked
// out. Then the summary. A tap on another compaction's mark in the chart
// opens that summary's card. The address names the open summary.
// The chart reads the session's usage extract,
// sessions/usage/YYYY/MM/<record name>.json (schema usage/1, priced by
// kits/session-usage.js's fromExtract), fetched when a card of the session is
// the one in view. Which sessions have one is listed with the summaries, so a
// card keeps the chart's room before the extract arrives and keeps none for a
// session without one (a session file older than schema 16). A tap on a
// prompt opens the session's Cost tab.
// Nothing on a card scrolls sideways, so a sideways drag anywhere on it is a
// swipe: code and table lines wrap.
// A summary in the harness's nine-section shape is reordered for a reader after
// the gist: what was asked, what the user said, where the work stood, what
// remained and what came next; then the four technical sections. Any other
// shape is drawn in its written order. Every section is open, and its heading
// stays at the top of the card while the reader is inside it, so the card
// always says which section is on screen. A heading gives the section's name
// without the harness's number, which the reordering would scramble; a note
// the summary's writer put after the name, in brackets, is kept in lighter
// type.
// The section in view carries across cards: a swipe, a step, or a move to
// another summary of the same session lands on the section the reader left,
// so one section can be read down a session's compactions. The cards either
// side of the one in view are kept on that section as the reader scrolls, so
// a swipe arrives with nothing moving. A move to another session by its row
// starts at the card's top.
// Bullets nest by their indentation, as the source writes them; bold and code
// are marked and the words are left as written. The harness's own text around
// the summary (the reminder block, the "continued from a previous
// conversation" lead and the closing instruction to resume) is the same on
// every file and left out.
(() => {
  const ROOT = 'sessions/compactions';
  const esc = (s) => window.esc(String(s ?? ''));
  // Read summaries, by summary id. Outside Alpine: a summary runs to 27,000
  // characters and nothing on the page reacts to it.
  const DOCS = new Map();
  const READING = new Map();
  // Usage extracts, by record name: the kit's reading, or null where the
  // session has none. One per session, shared by its summaries' cards.
  const USAGE = new Map();
  const USAGE_READING = new Set();
  const USAGE_ROOT = 'sessions/usage';
  // The record names that have an extract, from the listing; null until it
  // has been read, or where it failed.
  let HAS = null;
  // What each extract says its session was first asked, by record name: the
  // head's name for a session on a page that has no titles.
  const ASKS = new Map();

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
        pre.className = 'whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md bg-base-200 px-3 py-2 font-mono text-[0.85em] leading-relaxed';
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
      if (table) para.className = 'whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-[0.85em]';
      inline(para, t);
      h.append(para);
    }
    return root;
  }

  // A summary's record name, `<day>-<short>`: its id without the time.
  const recordName = (id) => String(id || '').replace(/-\d{8}T\d{6}Z$/, '');
  const usagePath = (r) => USAGE_ROOT + '/' + r.day.slice(0, 4) + '/' + r.day.slice(5, 7) + '/' + recordName(r.id) + '.json';

  // For the suite: the parse and the drawing, without a page.
  window.Compactions = { parseDoc, blocks, PLAIN, TECH, recordName, usagePath, USAGE };

  document.addEventListener('alpine:init', () => Alpine.data('compactions', (cfg = null) => ({
    description: 'Compactions: the sessions whose context was compacted, newest first, one opened beside or under the list: a tab per compaction, the session\'s context chart, and the open summary with its plain-language sections first and its technical sections folded.',
    cfg,
    // rows: one per summary file. sel: the open summary's id.
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
          <div x-ref="list" role="listbox" aria-label="Sessions with a compaction" data-pattern="list" data-part="list" @click="rowTap($event)"></div>
          <div x-ref="card"></div>
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
          if (id && id !== this.sel && this.byId(id)) this.open(id);
        });
        // The sessions index arriving (or refreshing) names the rows.
        this.$watch(() => this.cfg.labels?.(), () => this.relist());
      }
    },
    destroy() {
      document.removeEventListener('keydown', this._keys);
      this.$refs?.card?.removeEventListener('scroll', this._onScroll, true);
      this._swiper?.destroy();
      // The charts watch their own width and the page's theme on <html>.
      this._chartObs?.disconnect(); this._chartTheme?.disconnect();
      this._chartObs = this._chartTheme = null;
      this._charts?.clear();
      this._cards?.clear();
    },

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
        [this.rows] = await Promise.all([this.list(), this.listUsage()]);
        if (!this.rows.length) { this.error = 'No compaction summaries in ' + this.store + ' ' + ROOT; return; }
        const at = this.standalone ? this.param('at') : this.cfg.item?.();
        this.sel = this.byId(at) ? at : this.order[0];
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
    // One group per session, the latest compaction first; a session's
    // summaries in the order they were written.
    get groups() {
      if (this._groupsOf !== this.rows) {
        const by = new Map();
        for (const r of this.rows) {
          const id = recordName(r.id);
          if (!by.has(id)) by.set(id, { id, day: r.day, short: r.short, items: [] });
          by.get(id).items.push(r);
        }
        const gs = [...by.values()];
        for (const g of gs) {
          g.items.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
          g.at = g.items[g.items.length - 1].at;
        }
        this._groups = gs.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
        this._groupsOf = this.rows;
      }
      return this._groups;
    },
    group(gid) { return this.groups.find(g => g.id === gid); },
    // The cards' order: session by session as the list has them, and inside
    // a session its summaries in the order they were written.
    get order() { return this.groups.flatMap(g => g.items.map(r => r.id)); },
    // Whether a session has a usage extract: true or false once the listing
    // or a read has said, undefined until then.
    hasUsage(gid) {
      if (USAGE.has(gid)) return USAGE.get(gid) != null;
      return HAS ? HAS.has(gid) : undefined;
    },
    day(d, bare) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric',
        ...(!bare && d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
    },
    when(r) {
      return this.day(r.at) + ' ' + r.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    },
    label(short) { return (this.cfg?.label?.(short) || '').trim(); },
    sessionHref(short) {
      return this.cfg?.sessionHref?.(short) || 'session.html#id=' + encodeURIComponent(short);
    },
    // The session's Cost tab: the app's session address with `&pane=cost`, or
    // the session page's.
    costHref(short) {
      return this.cfg?.sessionHref ? this.cfg.sessionHref(short) + '&pane=cost'
        : 'session.html#id=' + encodeURIComponent(short) + '&pane=cost';
    },
    summaryHref(id) {
      return this.cfg ? '?view=compactions&item=' + encodeURIComponent(id) : '#at=' + encodeURIComponent(id);
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

    // Which sessions have a usage extract, from the same three levels of
    // listings as the summaries. A failed listing leaves it unknown, and each
    // card then finds out by reading.
    async listUsage() {
      try {
        const dirs = (xs) => xs.filter(x => x.type === 'dir' && /^\d+$/.test(x.name)).map(x => x.path);
        const years = dirs(await this.gh.ls(USAGE_ROOT));
        const months = (await Promise.all(years.map(y => this.gh.ls(y)))).flatMap(dirs);
        const files = (await Promise.all(months.map(m => this.gh.ls(m)))).flat();
        HAS = new Set(files.filter(f => f.type === 'file' && f.name.endsWith('.json')).map(f => f.name.slice(0, -5)));
      } catch { HAS = null; }
    },

    // A row is a session, on one line: the day of its latest compaction, its
    // title where the sessions index has one and its short id where not, and
    // a tab per compaction where there is more than one. What the kit picks
    // and marks is whatever carries data-cmp: the row itself for a session
    // compacted once, and each tab for the others, whose row is tinted while
    // one of its tabs is selected. A long strip is held to about five tabs'
    // width, so the title keeps its room, and scrolls inside itself.
    rowHtml(g) {
      const name = this.label(g.short), n = g.items.length;
      const who = name
        ? `<span class="min-w-0 flex-1 truncate text-base">${esc(name)}</span>`
        : `<span class="min-w-0 flex-1 truncate font-mono text-base">${esc(g.short)}</span>`;
      const day = `<span class="w-12 flex-none font-mono text-xs tabular-nums text-base-content/60">${esc(this.day(g.at, true))}</span>`;
      const row = 'flex min-h-9 items-center gap-2.5 border-b border-base-200 px-3 cursor-pointer hover:bg-base-200/60';
      if (n === 1) {
        return `<div data-cmp="${esc(g.items[0].id)}" tabindex="-1" data-part="item" class="${row} aria-selected:bg-primary/10">${day}${who}</div>`;
      }
      const tabs = g.items.map((x, i) => `<button type="button" role="tab" data-cmp="${esc(x.id)}" aria-selected="false"`
        + ` class="tab min-w-5 flex-none px-1 font-mono text-[0.8125rem] font-medium tabular-nums text-base-content/80 aria-selected:bg-primary aria-selected:text-primary-content"`
        + ` aria-label="Compaction ${i + 1} of ${n}, ${esc(this.when(x))}">${i + 1}</button>`).join('');
      return `<div data-cmp-row="${esc(g.id)}" data-part="item" class="${row} has-[[aria-selected=true]]:bg-primary/10">${day}${who}`
        + `<span role="tablist" data-cmp-tabs class="tabs tabs-box tabs-xs max-w-[7.5rem] flex-none flex-nowrap overflow-x-auto p-0.5 [scrollbar-width:none]"`
        + ` aria-label="This session's compactions">${tabs}</span></div>`;
    },
    // A tap on a session's row, outside its tabs, opens its first summary.
    rowTap(e) {
      const t = e.target instanceof Element ? e.target : null;
      const row = t?.closest('[data-cmp-row]');
      if (!row || t.closest('[data-cmp]')) return;
      const g = this.group(row.getAttribute('data-cmp-row'));
      if (g) this.open(g.items[0].id);
    },
    // The open summary's tab, kept in view inside a strip that scrolls.
    keepTab() {
      const tab = [...(this.$refs?.list?.querySelectorAll('[data-cmp-tabs] [data-cmp]') || [])].find(x => x.getAttribute('data-cmp') === this.sel);
      const strip = tab?.parentElement;
      if (!strip || strip.scrollWidth <= strip.clientWidth) return;
      strip.scrollLeft += tab.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - tab.offsetWidth) / 2;
    },
    relist() {
      if (!this._swiper || !this.$refs.list) return;
      this.$refs.list.innerHTML = this.groups.map(g => this.rowHtml(g)).join('');
      linkedSwiper.mark(this.$refs.list, 'cmp', this.sel);
      this.keepTab();
      this._swiper.paint();
    },

    mount() {
      this.$refs.list.innerHTML = this.groups.map(g => this.rowHtml(g)).join('');
      this._swiper = linkedSwiper.attach({
        root: this.$refs.root, list: this.$refs.list, card: this.$refs.card, key: 'cmp',
        ids: () => this.order, sel: () => this.sel,
        noun: 'summary', seam: 'compactions-list', listMax: 'max-h-[38vh]',
        // Less above the chart than the kit's default pad leaves.
        slidePad: 'px-3.5 pt-1.5 pb-3',
        // The arrows stay at every width: a phone swipes, and can also step.
        tightBelow: 0,
        name: (id) => this.nameOf(id),
        body: (id, el) => { this.fill(id, el, false); },
        empty: '',
        onPick: (id, via) => {
          const sec = this.carries(this.sel, id, via) ? this._sec || 0 : 0;
          this.sel = id;
          this._sec = sec;
          this.position(id, sec);
          for (const n of this.neighbours(id)) this.position(n, sec);
          this.address();
          this.read(id);
          this.keepTab();
          if (this._deck && via !== 'deck') {
            const i = this.order.indexOf(id);
            this._deck.deck.go(i, 'instant');
          }
        },
        deck: () => this.openDeck(),
      });
      this.read(this.sel);
      // Scroll does not bubble, so the cards' scrollers are heard in capture.
      this._onScroll = (e) => this.cardScroll(e);
      this.$refs.card.addEventListener('scroll', this._onScroll, true);
      const keep = () => { linkedSwiper.mark(this.$refs.list, 'cmp', this.sel); this.keepTab(); };
      requestAnimationFrame(() => requestAnimationFrame(keep));
    },

    // The head names the session: its title, or on a page with no titles
    // what it was first asked, once a file that says so has been read. Where
    // the session was compacted more than once, the head leads with which of
    // its compactions this card is.
    nameOf(id) {
      const g = this.group(recordName(id));
      if (!g) return {};
      const ask = ASKS.get(g.id)
        || g.items.map(r => DOCS.get(r.id)).find(d => d && !d.error && d.meta.opening_ask)?.meta.opening_ask;
      const n = g.items.length, i = g.items.findIndex(r => r.id === id);
      return { code: n > 1 && i >= 0 ? (i + 1) + ' of ' + n : '', title: this.label(g.short) || ask || g.short };
    },

    // Whether the section in view goes with the reader from one summary to
    // another: on a swipe or a step, in the strip or the deck, and between
    // two summaries of one session however the move was made. A move to
    // another session through the list starts at the top.
    carries(from, to, via) {
      return via === 'swipe' || recordName(from) === recordName(to) || (via === 'api' && !!this._deck);
    },
    neighbours(id) {
      const o = this.order, i = o.indexOf(id);
      return i < 0 ? [] : [o[i - 1], o[i + 1]].filter(Boolean);
    },
    // The section a card is showing: the last whose top has reached the top
    // of the card's scroller, or 0 above the first.
    sectionOf(el) {
      const sc = el.closest('.sd-slide, [data-ls="body"]');
      if (!sc || sc.scrollTop < 2) return 0;
      const top = sc.getBoundingClientRect().top + 2;
      let n = 0;
      for (const s of el.querySelectorAll('[data-sec]')) {
        if (s.getBoundingClientRect().top > top) break;
        n = +s.dataset.sec;
      }
      return n;
    },
    // Put a summary's drawn cards on a section: its heading at the top of
    // the scroller. Section 0, or one the summary lacks, is the card's top.
    position(id, sec) {
      for (const el of this._cards || []) {
        if (!el.isConnected || el._cmp.id !== id || !el.querySelector('[data-sec]')) continue;
        const sc = el.closest('.sd-slide, [data-ls="body"]');
        if (!sc) continue;
        const s = sec ? el.querySelector('[data-sec="' + sec + '"]') : null;
        const to = s ? sc.scrollTop + s.getBoundingClientRect().top - sc.getBoundingClientRect().top : 0;
        if (Math.abs(sc.scrollTop - to) > 1) sc.scrollTop = to;
      }
    },
    // The reader scrolled the card in view into another section: the cards
    // either side follow, so a swipe lands on that section already in place.
    cardScroll(e) {
      const sc = e.target;
      if (!(sc instanceof Element) || !sc.matches('.sd-slide, [data-ls="body"]') || this._secFrame) return;
      this._secFrame = requestAnimationFrame(() => {
        this._secFrame = 0;
        const el = [...(this._cards || [])].find(x => x.isConnected && x._cmp.id === this.sel && sc.contains(x));
        if (!el) return;
        const n = this.sectionOf(el);
        if (n === (this._sec || 0)) return;
        this._sec = n;
        for (const id of this.neighbours(this.sel)) this.position(id, n);
      });
    },

    // Open a summary: the strip moves to its card and the list to its tab.
    open(id) {
      if (!this.byId(id)) return;
      if (this._swiper) { this._swiper.pick(id); return; }
      this.sel = id;
      this.address();
      this.read(id);
    },

    // A card is one summary: its session's chart, then the text. Files are
    // read only for the card in view: a neighbour the strip builds ahead
    // waits until the reader arrives on it.
    fill(id, el, big) {
      if (!this.byId(id)) return;
      el._cmp = { id, big };
      (this._cards || (this._cards = new Set())).add(el);
      // A sideways drag on the card is the strip's: the card's own scroller
      // moves up and down only.
      const scroller = el.closest('.sd-slide, [data-ls="body"]');
      scroller?.classList.add('overflow-x-hidden');
      let box = el.firstElementChild;
      if (!box || box._id !== id) { box = this.shell(id, big); el.replaceChildren(box); }
      // A sticky heading rests against the scroller's content edge, inside
      // its top padding, and text would show through that strip: the
      // headings are told the padding and sit that much higher.
      if (scroller) box.style.setProperty('--cmp-pad', getComputedStyle(scroller).paddingTop || '0px');
      this.paintCard(box, id);
      if (id === this.sel) this.read(id);
    },
    // Every card on the page for one session's summaries, the strip's and
    // the deck's.
    repaint(gid) {
      for (const el of this._cards || []) {
        if (!el.isConnected) { this._cards.delete(el); continue; }
        const id = el._cmp.id;
        if (recordName(id) === gid && el.firstElementChild?._id === id) this.fill(id, el, el._cmp.big);
      }
      if (this.standalone) this._swiper?.paint();
    },
    // A summary, and its session's usage extract unless the listing says
    // there is none.
    read(id) {
      const g = this.group(recordName(id));
      if (!g) return;
      if (this.hasUsage(g.id) !== false) this.readUsage(g.items[0]);
      const r = this.byId(id);
      if (!r || DOCS.has(id) || READING.has(id)) return;
      READING.set(id, (async () => {
        try { DOCS.set(id, parseDoc((await this.gh.get(r.path)).text)); }
        catch (e) { DOCS.set(id, { error: e?.message || String(e) }); }
        READING.delete(id);
        this.repaint(recordName(id));
      })());
    },

    // The session's usage extract, once per session. A miss (no extract, or
    // a read that failed) is kept as null, and its cards draw no chart.
    readUsage(r) {
      const name = recordName(r.id);
      if (USAGE.has(name) || USAGE_READING.has(name)) return;
      USAGE_READING.add(name);
      (async () => {
        let u = null;
        try {
          if (!window.SessionUsage) await gh.load('kits/session-usage.js');
          if (!window.UsageChart) await gh.load('kits/usage-chart.js');
          const raw = JSON.parse((await this.gh.get(usagePath(r))).text);
          if (raw.opening_ask) ASKS.set(name, String(raw.opening_ask));
          u = window.SessionUsage.fromExtract(raw);
          if (!u.prompts.length) u = null;
        } catch { u = null; }
        USAGE.set(name, u);
        USAGE_READING.delete(name);
        for (const host of this._charts || []) if (host._rec === name) this.drawChart(host, true);
        this.repaint(name);
      })();
    },

    // A card's chart host: empty, and so hidden and taking no room, until the
    // session's extract is here and the card has a width.
    chartEl(id, big) {
      const host = document.createElement('div');
      host.dataset.usageChart = id;
      host.className = 'w-full min-w-0 text-base-content empty:hidden';
      host._id = id; host._rec = recordName(id); host._big = big;
      host.addEventListener('pointerover', (e) => this.chartHover(host, e));
      host.addEventListener('pointerleave', () => window.UsageChart?.mark(host, USAGE.get(host._rec), -1));
      host.addEventListener('focusin', (e) => this.chartHover(host, e));
      host.addEventListener('click', (e) => this.chartTap(host, e));
      if (!this._charts) {
        this._charts = new Set();
        // Each observes the card that holds it: an empty host is hidden, so
        // the card's width is the one to draw at.
        this._chartObs = window.ResizeObserver ? new ResizeObserver((es) => {
          for (const e of es) { const h = e.target._usageHost; if (h) this.drawChart(h); }
        }) : null;
        this._chartTheme = window.MutationObserver ? new MutationObserver(() => { for (const h of this._charts) this.drawChart(h, true); }) : null;
        this._chartTheme?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      }
      this._charts.add(host);
      requestAnimationFrame(() => {
        if (!host.parentElement) return;
        host.parentElement._usageHost = host;
        this._chartObs?.observe(host.parentElement);
        this.drawChart(host);
      });
      return host;
    },
    // The cost of each prompt behind the context after it, in one short
    // panel with two axes, at any width.
    drawChart(host, force) {
      if (!host.isConnected) {
        if (host.parentElement) this._chartObs?.unobserve(host.parentElement);
        this._charts?.delete(host);
        return;
      }
      const u = USAGE.get(host._rec), C = window.UsageChart;
      if (!u || !C) { if (host.firstChild) host.replaceChildren(); return; }
      const w = Math.floor(host.parentElement?.clientWidth || 0);
      if (!w) return;
      const dark = C.dark(host.parentElement);
      if (!force && w === host._w && dark === host._dark && host.firstChild) return;
      host._w = w; host._dark = dark;
      const pick = u.compactions.findIndex(c => c.name === host._id);
      host.innerHTML = C.svg(u, w, {
        dark, combined: true, ph: host._big ? 90 : 48, pick,
        href: (c) => this.summaryHref(c.name),
      });
      C.mark(host, u, host._pick ?? -1);
    },
    chartHover(host, e) {
      const k = window.UsageChart?.at(e) ?? -1;
      if (k >= 0) window.UsageChart.mark(host, USAGE.get(host._rec), k);
    },
    // A compaction's mark opens its summary's card. A prompt opens the session's
    // Cost tab; on a screen that cannot hover the first tap marks the prompt
    // and opens its title-tip, and a second tap on it goes.
    chartTap(host, e) {
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      const r = this.group(host._rec);
      if (!r) return;
      if (a && a.hasAttribute('data-cost-compaction')) {
        const id = a.getAttribute('data-name');
        if (!this.byId(id) || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        window.TitleTip?.close?.();
        if (id !== this.sel) this.open(id);
        return;
      }
      const k = window.UsageChart?.at(e) ?? -1;
      if (!a && k < 0) return;
      const hover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
      if (!a && e.type === 'click' && !hover && host._pick !== k) {
        e.preventDefault();
        host._pick = k;
        window.UsageChart.mark(host, USAGE.get(host._rec), k);
        return;
      }
      host._pick = -1;
      window.TitleTip?.close?.();
      this.openCost(r, e);
    },
    // The app opens the session's card at its Cost tab, as its own session
    // links do; the standalone page follows the link.
    openCost(r, e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (this.cfg) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('web-tools:open-session', { detail: { id: r.short, day: r.day, pane: 'cost' } }));
        return;
      }
      if (!e.target.closest?.('a')) location.href = this.costHref(r.short);
    },

    // The frame: the chart, then the summary.
    shell(id, big) {
      const box = document.createElement('div');
      box._id = id;
      box.className = 'flex min-w-0 flex-col gap-2 [overflow-wrap:anywhere] ' + (big ? 'text-xl leading-8' : 'text-base leading-7');
      // The chart's room, kept from the start where the session has an
      // extract, so the chart lands without moving the summary under it.
      const slot = document.createElement('div');
      slot.dataset.cmpChart = '';
      slot.className = big ? 'min-h-[124px]' : 'min-h-[82px]';
      slot.append(this.chartEl(id, big));
      const rest = document.createElement('div');
      rest.dataset.cmpRest = '';
      rest.className = 'contents';
      box.append(slot, rest);
      return box;
    },
    paintCard(box, id) {
      const r = this.byId(id), d = DOCS.get(id);
      const rest = box.querySelector('[data-cmp-rest]');
      box.querySelector('[data-cmp-chart]').classList.toggle('hidden', this.hasUsage(recordName(id)) === false);
      const state = !d ? 'wait' : d.error ? 'error' : 'doc';
      if (rest._state === state) return;
      rest._state = state;
      if (!d) {
        rest.innerHTML = '<div class="flex justify-center py-10"><span class="loading loading-dots loading-md opacity-30"></span></div>';
      } else if (d.error) {
        const warn = document.createElement('div');
        warn.className = 'alert alert-warning';
        warn.textContent = r.path + ': ' + d.error;
        rest.replaceChildren(warn);
      } else {
        rest.replaceChildren(...this.summaryEls(d));
        // A summary drawn for the card in view, or for one beside it, starts
        // on the section the reader is in.
        if (id === this.sel || this.neighbours(this.sel).includes(id)) this.position(id, this._sec || 0);
      }
    },
    // The summary: its sections in reading order, all open.
    summaryEls(d) {
      const order = d.nine
        ? [...PLAIN, ...TECH].map(n => d.sections.find(s => s.n === n))
        : d.sections;
      const els = [];
      if (d.lead) els.push(blocks(d.lead));
      for (const s of order) els.push(this.section(s));
      return els;
    },
    // A section's heading stays at the top of the card's scroller for as long
    // as its section is under it, and the next heading pushes it out. Its
    // background covers the text that scrolls beneath. It gives the section's
    // name without the number the harness wrote before it: the sections are
    // not drawn in that order, and a run of 1, 6, 8, 7, 9 reads as a fault.
    head(s) {
      const h = document.createElement('h3');
      h.className = 'sticky top-[calc(var(--cmp-pad,0px)*-1)] z-10 min-w-0 border-b border-base-200 bg-base-100 py-0.5 font-semibold';
      const at = s.name.search(/\s\(/);
      inline(h, at > 0 ? s.name.slice(0, at) : s.name);
      if (at > 0) {
        const note = document.createElement('span');
        note.className = 'font-normal text-base-content/65';
        h.append(inline(note, s.name.slice(at)));
      }
      return h;
    },
    section(s) {
      const sec = document.createElement('section');
      sec.dataset.sec = String(s.n);
      sec.className = 'flex flex-col gap-1.5';
      sec.append(this.head(s));
      if (s.text) sec.append(blocks(s.text));
      return sec;
    },

    openDeck() {
      const ids = this.order;
      this._deck = swipeDeck.open({
        count: ids.length, start: Math.max(0, ids.indexOf(this.sel)),
        title: 'Compactions', icon: 'ph-arrows-in-line-vertical', innerClass: 'w-full',
        index: (i) => { const r = this.byId(ids[i]); return { title: this.when(r) + ' · ' + (this.label(r.short) || r.short) }; },
        render: (i, el) => this.fill(ids[i], el, true),
        onSlide: (i) => this._swiper?.pick(ids[i]),
        onClose: () => { this._deck = null; },
      });
      this._deck.el.addEventListener('scroll', this._onScroll, true);
    },
  })));
})();
