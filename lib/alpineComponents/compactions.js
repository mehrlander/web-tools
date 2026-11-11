// compactions.js — the sessions whose context was compacted, newest first: a
// list over a strip of one card per session (html-style rule 11, through
// kits/linked-swiper.js), and the swipe deck over the same cards.
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
//     cfg.sessionHref(short), cfg.openSession(short, event)
//
// A list row is a session: the day of its latest compaction, its title, and
// how many times it was compacted where that is more than once. Its card is
// headed by the session's title and leads with one line: a tab per
// compaction, in time order, where the session has more than one; the open
// summary's time; its context before and after, in thousands of tokens; and
// a link to the session. Under that line is the session's context over its
// prompts, the sawtooth each compaction cuts, with the open summary's drop
// picked out (kits/usage-chart.js, the session view's Cost tab's chart), then
// the summary. A tab, or a tap on another compaction's mark in the chart,
// changes the summary in place: the chart stays, redrawn with the new drop
// picked out, and the list does not move. The address names the open summary.
// The chart reads the session's usage extract,
// sessions/usage/YYYY/MM/<record name>.json (schema usage/1, priced by
// kits/session-usage.js's fromExtract), fetched when the card is the one in
// view, as the summary is; a session without one (a session file older than
// schema 16) has no chart. A tap on a prompt opens the session's Cost tab. A
// summary in the harness's nine-section shape is reordered for a reader after
// the gist: what was asked, what the user said, where the work stood, what
// remained and what came next, open; then the four technical sections, each
// folded until opened. Any other shape is drawn whole, in its written order.
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

  // A summary's record name, `<day>-<short>`: its id without the time.
  const recordName = (id) => String(id || '').replace(/-\d{8}T\d{6}Z$/, '');
  const usagePath = (r) => USAGE_ROOT + '/' + r.day.slice(0, 4) + '/' + r.day.slice(5, 7) + '/' + recordName(r.id) + '.json';

  // 785,231 as "785k": a context size, or a section's length, in thousands.
  const fmtK = (v) => !Number.isFinite(v) ? '?'
    : v >= 999500 ? (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
    : v >= 1000 ? Math.round(v / 1000) + 'k' : String(v);

  // For the suite: the parse and the drawing, without a page.
  window.Compactions = { parseDoc, blocks, PLAIN, TECH, recordName, usagePath, USAGE, fmtK };

  document.addEventListener('alpine:init', () => Alpine.data('compactions', (cfg = null) => ({
    description: 'Compactions: the sessions whose context was compacted, newest first, one opened beside or under the list: a tab per compaction, the session\'s context chart, and the open summary with its plain-language sections first and its technical sections folded.',
    cfg,
    // rows: one per summary file. sel: the open summary's id. cur: per
    // session record name, the summary its card shows.
    loading: true, error: '', rows: [], sel: '', cur: {},
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
          <div x-ref="list" role="listbox" aria-label="Sessions with a compaction" data-pattern="list" data-part="list"></div>
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
          if (id && id !== this.sel && this.byId(id)) this.open(id);
        });
        // The sessions index arriving (or refreshing) names the rows.
        this.$watch(() => this.cfg.labels?.(), () => this.relist());
      }
    },
    destroy() {
      document.removeEventListener('keydown', this._keys);
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
        this.rows = await this.list();
        if (!this.rows.length) { this.error = 'No compaction summaries in ' + this.store + ' ' + ROOT; return; }
        const at = this.standalone ? this.param('at') : this.cfg.item?.();
        this.sel = this.byId(at) ? at : this.curOf(this.groups[0].id);
        this.cur[recordName(this.sel)] = this.sel;
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
    // The summary a session's card shows: the one last opened there, else its
    // latest.
    curOf(gid) {
      const g = this.group(gid);
      if (!g) return '';
      const id = this.cur[gid];
      return g.items.some(r => r.id === id) ? id : g.items[g.items.length - 1].id;
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

    // A row is a session, on one line: the day of its latest compaction, its
    // title where the sessions index has one and its short id where not, and
    // how many times it was compacted where that is more than once. The day
    // is a fixed column, so it leaves the year to the card's first line.
    rowHtml(g) {
      const name = this.label(g.short), n = g.items.length;
      const who = name
        ? `<span class="min-w-0 flex-1 truncate text-base">${esc(name)}</span>`
        : `<span class="min-w-0 flex-1 truncate font-mono text-base">${esc(g.short)}</span>`;
      return `<div data-cmp="${esc(g.id)}" tabindex="-1" data-part="item" class="flex items-baseline gap-2.5 border-b border-base-200 px-3 py-1.5 cursor-pointer hover:bg-base-200/60 aria-selected:bg-primary/10">`
        + `<span class="w-12 flex-none font-mono text-xs tabular-nums text-base-content/60">${esc(this.day(g.at, true))}</span>`
        + who
        + (n > 1 ? `<span class="flex-none font-mono text-xs tabular-nums text-base-content/60" aria-label="${n} compactions">×${n}</span>` : '')
        + `</div>`;
    },
    relist() {
      if (!this._swiper || !this.$refs.list) return;
      this.$refs.list.innerHTML = this.groups.map(g => this.rowHtml(g)).join('');
      linkedSwiper.mark(this.$refs.list, 'cmp', recordName(this.sel));
      this._swiper.paint();
    },

    mount() {
      this.$refs.list.innerHTML = this.groups.map(g => this.rowHtml(g)).join('');
      this._swiper = linkedSwiper.attach({
        root: this.$refs.root, list: this.$refs.list, card: this.$refs.card, key: 'cmp',
        ids: () => this.groups.map(g => g.id), sel: () => recordName(this.sel),
        noun: 'session', seam: 'compactions-list', listMax: 'max-h-[38vh]',
        // The arrows stay at every width: a phone swipes, and can also step.
        tightBelow: 0,
        name: (gid) => this.nameOf(gid),
        body: (gid, el) => { this.fill(gid, el, false); },
        empty: '',
        onPick: (gid, via) => {
          this.sel = this.curOf(gid);
          this.address();
          this.read(this.sel);
          if (this._deck && via !== 'deck') {
            const i = this.groups.findIndex(g => g.id === gid);
            this._deck.deck.go(i, 'instant');
          }
        },
        deck: () => this.openDeck(),
      });
      this.read(this.sel);
      const keep = () => linkedSwiper.mark(this.$refs.list, 'cmp', recordName(this.sel));
      requestAnimationFrame(() => requestAnimationFrame(keep));
    },

    // The head names the session. Which of its compactions is open is the
    // card's own first line.
    nameOf(gid) {
      const g = this.group(gid);
      return g ? { title: this.label(g.short) || g.short } : {};
    },

    // Open a summary. Where its session's card is the one in view the card
    // changes in place; where it is not, the list picks the session.
    open(id) {
      if (!this.byId(id)) return;
      const gid = recordName(id);
      this.cur[gid] = id;
      if (gid !== recordName(this.sel) && this._swiper) { this._swiper.pick(gid); return; }
      this.sel = id;
      this.address();
      this.read(id);
      this.repaint(gid);
    },

    // A card's frame is built once for its session; its first line and its
    // summary are painted for the summary the card shows. The summary is read
    // only for the card in view: a neighbour the strip builds ahead waits
    // until the reader arrives on it.
    fill(gid, el, big) {
      const id = this.curOf(gid);
      if (!id) return;
      el._cmp = { gid, big };
      (this._cards || (this._cards = new Set())).add(el);
      let box = el.firstElementChild;
      if (!box || box._gid !== gid) { box = this.shell(gid, id, big); el.replaceChildren(box); }
      this.paintCard(box, gid, id);
      if (!DOCS.has(id) && gid === recordName(this.sel)) this.read(id);
    },
    // Every card on the page for one session, the strip's and the deck's.
    repaint(gid) {
      for (const el of this._cards || []) {
        if (!el.isConnected) { this._cards.delete(el); continue; }
        if (el._cmp.gid === gid && el.firstElementChild?._gid === gid) this.fill(gid, el, el._cmp.big);
      }
    },
    read(id) {
      const r = this.byId(id);
      if (r) this.readUsage(r);
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
          u = window.SessionUsage.fromExtract(JSON.parse((await this.gh.get(usagePath(r))).text));
          if (!u.prompts.length) u = null;
        } catch { u = null; }
        USAGE.set(name, u);
        USAGE_READING.delete(name);
        for (const host of this._charts || []) if (host._rec === name) this.drawChart(host, true);
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
    // Context over the prompts, and under it a shorter panel of cost per
    // prompt where the card is wide enough to keep the summary in view.
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
      const r = this.byId(host._id);
      const pick = u.compactions.findIndex(c => c.name === host._id);
      host.innerHTML = C.svg(u, w, {
        dark, ph: host._big ? 150 : 96, costPh: w >= 560 ? (host._big ? 70 : 52) : 0, pick,
        href: (c) => this.summaryHref(c.name),
        link: r ? { href: this.costHref(r.short), label: 'Cost by prompt' } : null,
      });
      C.mark(host, u, host._pick ?? -1);
    },
    chartHover(host, e) {
      const k = window.UsageChart?.at(e) ?? -1;
      if (k >= 0) window.UsageChart.mark(host, USAGE.get(host._rec), k);
    },
    // A compaction's mark opens its summary on this card. A prompt opens the session's
    // Cost tab; on a screen that cannot hover the first tap marks the prompt
    // and opens its title-tip, and a second tap on it goes.
    chartTap(host, e) {
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      const r = this.byId(host._id);
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

    // The frame: the line of tabs and facts, the chart, then the summary. A
    // change of summary repaints the first and the last and leaves the chart
    // in place, so the text under it does not jump.
    shell(gid, id, big) {
      const box = document.createElement('div');
      box._gid = gid;
      box.className = 'flex flex-col gap-4 ' + (big ? 'text-xl leading-8' : 'text-base leading-7');
      // The first line keeps one height for every summary of a session: it
      // never wraps on its content. The tab strip gives way and scrolls
      // sideways instead, except that five tabs or more take a row of their
      // own on a card narrower than 36rem, where the strip would be a sliver.
      const many = this.group(gid).items.length >= 5;
      const line = document.createElement('div');
      line.className = '@container';
      const top = document.createElement('div');
      top.dataset.cmpTop = '';
      top.className = 'flex items-center gap-x-2 gap-y-1 font-mono text-xs tabular-nums text-base-content/70 '
        + (many ? 'flex-wrap @xl:flex-nowrap' : 'flex-nowrap');
      top.addEventListener('click', (e) => this.topTap(e));
      line.append(top);
      const rest = document.createElement('div');
      rest.dataset.cmpRest = '';
      rest.className = 'contents';
      box.append(line, this.chartEl(id, big), rest);
      return box;
    },
    paintCard(box, gid, id) {
      const g = this.group(gid), r = this.byId(id), d = DOCS.get(id);
      const top = box.querySelector('[data-cmp-top]'), rest = box.querySelector('[data-cmp-rest]');
      const host = box.querySelector('[data-usage-chart]');
      if (host && host._id !== id) {
        host._id = id; host._pick = -1; host.dataset.usageChart = id;
        this.drawChart(host, true);
      }
      const m = d && !d.error ? d.meta : null;
      const many = g.items.length >= 5;
      const tabs = g.items.length > 1
        ? `<div class="min-w-0 max-w-full${many ? ' basis-full @xl:basis-auto' : ''}">`
          + `<div role="tablist" class="tabs tabs-box tabs-sm w-fit max-w-full flex-nowrap overflow-x-auto [scrollbar-width:none]" aria-label="This session's compactions">`
          + g.items.map((x, i) => `<button type="button" role="tab" data-cmp-tab="${esc(x.id)}" aria-selected="${x.id === id}"`
            + ` class="tab flex-none${x.id === id ? ' tab-active' : ''}" aria-label="Compaction ${i + 1}, ${esc(this.when(x))}">${i + 1}</button>`).join('')
          + `</div></div>`
        : '';
      top.innerHTML = tabs
        + `<span class="flex flex-none items-center gap-x-2"><span>${esc(this.when(r))}</span>`
        + (m && Number.isFinite(m.context_before) && Number.isFinite(m.context_after)
          ? `<span>${esc(fmtK(m.context_before))} → ${esc(fmtK(m.context_after))}</span>` : '')
        + `</span>`
        + `<a href="${esc(this.sessionHref(r.short))}" data-session-link="${esc(r.short)}" class="ml-auto flex flex-none text-primary hover:opacity-70"`
          + ` data-title-tip="Open the session" aria-label="Open the session"><i class="ph ph-terminal-window -m-1 p-1 text-base"></i></a>`;
      // A strip that scrolls keeps the open tab in view.
      const on = top.querySelector('.tab-active'), strip = on?.parentElement;
      if (strip && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2;
      const state = !d ? 'wait' : d.error ? 'error' : 'doc';
      if (rest._for === id && rest._state === state) return;
      rest._for = id; rest._state = state;
      if (!d) {
        rest.innerHTML = '<div class="flex justify-center py-10"><span class="loading loading-dots loading-md opacity-30"></span></div>';
      } else if (d.error) {
        const warn = document.createElement('div');
        warn.className = 'alert alert-warning';
        warn.textContent = r.path + ': ' + d.error;
        rest.replaceChildren(warn);
      } else {
        rest.replaceChildren(...this.summaryEls(d));
      }
    },
    topTap(e) {
      const t = e.target instanceof Element ? e.target : null;
      const tab = t?.closest('[data-cmp-tab]');
      if (tab) { this.open(tab.getAttribute('data-cmp-tab')); return; }
      const link = t?.closest('[data-session-link]');
      if (link && this.cfg?.openSession) this.cfg.openSession(link.getAttribute('data-session-link'), e);
    },
    // The summary: what the session was first asked, the section pills, then
    // the sections in reading order.
    summaryEls(d) {
      const m = d.meta;
      const order = d.nine
        ? [...PLAIN, ...TECH].map(n => d.sections.find(s => s.n === n))
        : d.sections;
      const pill = (s) => `<button type="button" data-sec-go="${s.n}" class="btn btn-xs rounded-full font-normal btn-ghost border border-base-300 flex-none">`
        + `<span class="font-mono opacity-60">${s.n}</span><span class="max-w-56 truncate">${esc(s.name.replace(/\s*\(.*$/, ''))}</span>`
        + (s.tech ? '<i class="ph ph-caret-right opacity-50"></i>' : '') + `</button>`;
      const pills = order.map((s, i) => (s.tech && !order[i - 1]?.tech ? '<span class="mx-1 h-4 w-px flex-none self-center bg-base-300"></span>' : '') + pill(s)).join('');
      const lead = document.createElement('div');
      lead.innerHTML = (m.opening_ask ? `<div class="line-clamp-3 text-base-content/70">${esc(m.opening_ask)}</div>` : '')
        + (pills ? `<nav data-sec-nav class="sticky -top-3 z-10 -mx-3.5 -my-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-base-200 bg-base-100 px-3.5 pt-3 pb-1.5 [scrollbar-width:none]" aria-label="Sections">${pills}</nav>` : '');
      const els = [...lead.children];
      if (d.lead) els.push(blocks(d.lead));
      for (const s of order) els.push(s.tech ? this.fold(s) : this.section(s));
      return els;
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
      size.textContent = fmtK(s.text.length) + ' chars';
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
      const card = b.closest('[data-sec-nav]')?.parentElement?.parentElement;
      const sec = card?.querySelector(`[data-sec="${b.getAttribute('data-sec-go')}"]`);
      if (sec?._fill && !sec.open) { sec._fill(); sec.open = true; }
      let sc = sec?.parentElement;
      while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (!sec || !sc || sc === document.body) return;
      const nav = card.querySelector('[data-sec-nav]');
      sc.scrollTo({ top: sc.scrollTop + sec.getBoundingClientRect().top - sc.getBoundingClientRect().top - (nav?.offsetHeight || 0) - 4 });
    },

    openDeck() {
      const gs = this.groups, ids = gs.map(g => g.id);
      this._deck = swipeDeck.open({
        count: ids.length, start: Math.max(0, ids.indexOf(recordName(this.sel))),
        title: 'Compactions', icon: 'ph-arrows-in-line-vertical', innerClass: 'w-full',
        index: (i) => ({ title: this.day(gs[i].at) + ' · ' + (this.label(gs[i].short) || gs[i].short) }),
        render: (i, el) => this.fill(ids[i], el, true),
        onSlide: (i) => this._swiper?.pick(ids[i]),
        onClose: () => { this._deck = null; },
      });
      this._deck.el.addEventListener('click', (e) => this.goSection(e));
    },
  })));
})();
