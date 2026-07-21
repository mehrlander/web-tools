// chat-render.js — chat transcript renderer: markdown in, readable
// conversation out, with fenced code blocks promoted to live artifacts.
//
// Sibling to vanilla-demo.js: a framework-free, DOM-rendering module loaded
// via gh.load. Depends on kits/proof.js for sandboxed Render/Run frames
// (load it first), on Tailwind + daisyUI + Phosphor on the host page for
// styling, and on the typography CSS for prose (see pages/chat-results.html
// for the combine link). marked loads lazily via ready(); CM6 and Tabulator
// load only when a block's Edit or Table affordance is used.
//
//   await chatRender.ready();                    // loads marked, once
//   chatRender.parse(md)          -> [{role, md}]    // house-format splitter
//   chatRender.markdown(md, o?)   -> element     // prose + block artifacts
//   chatRender.block({lang,code}, o?) -> element // one fenced-block artifact
//   chatRender.message(msg, o?)   -> element     // one chat turn
//   chatRender.transcript(msgs, o?) -> element   // the full conversation, with a
//                                                // Cards | Scroll toggle (cards default
//                                                // on a phone). msgs: array or house-format
//                                                // string; o.mode forces the view;
//                                                // o.chunk: scroll reveal batch (default 12)
//   chatRender.deck(msgs, o?)     -> element     // just the swipe deck view
//                                                // (one exchange per card; o.height/o.fill)
//   chatRender.openTranscript(msgs, o?) -> {el, close}  // fullscreen takeover: one chat
//                                                // fills the screen as the deck, back/Esc/✕ close
//                                                // (o: {title, provider, date, mode})
//
// The block artifact is the point: every fenced block renders instantly as a
// static <pre> (no editor cost), with a view row that builds on demand —
// viewer.js's registry idea keyed on fence language instead of file
// extension, backed by proof.js's sandboxes instead of Prism:
//
//   lang        views
//   html/svg    Code | Render   (sandboxed iframe; full documents srcdoc'd)
//   json array  Code | Table    (Tabulator, lazy)
//   md          Code | Preview  (marked)
//   other       Code
//
// The chats arrive as regular provider output — they don't know this
// renderer exists — so a view is offered only where an arbitrary block
// stands on its own. Markup fragments do; a js block is usually a piece
// of some larger thing, so js gets no Run view (executing it out of
// context just produces reference errors). Nothing executes on load:
// Render and Table build on first click. Chat code is arbitrary, so
// there is no unsandboxed 'parent' kind here. The Edit pencil always
// lands on the Code view and swaps the static <pre> for a CM6 editor
// (kits/cm6.js, lazy-loaded) — editing is editing the source text, never
// the rendered view (Tabulator stays read-only). Views built from older
// text rebuild from the edited text when re-activated.
//
// opts (markdown/message/transcript pass it through to block):
//   { tw?: bool           // Tailwind in Render frames (default true)
//     daisy?: bool        // daisyUI + Phosphor in Render frames
//     collapse?: number } // px height beyond which a message collapses
//                         // (default 460; 0 disables)

(() => {
  const ghRef = typeof gh !== 'undefined' ? gh : (window.gh || null);

  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const k of kids) n.append(k);
    return n;
  };
  const esc = s => new Option(String(s ?? '')).innerHTML;
  const copyText = async t => {
    try { await navigator.clipboard.writeText(t); }
    catch { const ta = h('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } finally { ta.remove(); } }
  };

  // ── lazy assets ─────────────────────────────────────────────────────────
  const loadedAssets = new Set();
  const loadAsset = url => {
    if (loadedAssets.has(url)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const isCSS = url.endsWith('.css');
      const el = document.createElement(isCSS ? 'link' : 'script');
      if (isCSS) Object.assign(el, { rel: 'stylesheet', href: url });
      else Object.assign(el, { src: url });
      el.onload = () => { loadedAssets.add(url); resolve(); };
      el.onerror = () => reject(new Error(`Load failed: ${url}`));
      document.head.appendChild(el);
    });
  };

  let readyPromise = null;
  const ready = () => readyPromise || (readyPromise =
    window.marked ? Promise.resolve() : loadAsset('https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js'));

  const needCm6 = async () => {
    if (!window.cm6 && ghRef) await ghRef.load('kits/cm6.js');
    if (!window.cm6) throw new Error('kits/cm6.js not available');
  };
  const needTabulator = async () => {
    await loadAsset('https://unpkg.com/tabulator-tables@6.3.0/dist/css/tabulator_simple.min.css');
    await loadAsset('https://unpkg.com/tabulator-tables@6.3.0/dist/js/tabulator.min.js');
  };

  // ── small shared UI bits ────────────────────────────────────────────────
  const iconBtn = (icon, label, onClick) => {
    const b = h('button', { class: 'btn btn-ghost btn-xs gap-1 font-mono text-[10px] opacity-60 hover:opacity-100' });
    const ic = h('i', { class: `ph ${icon} text-[13px]` });
    const tx = h('span', {}, label);
    b.append(ic, tx);
    b.addEventListener('click', () => onClick({ ic, tx }));
    return b;
  };
  const copyBtn = getText => iconBtn('ph-copy', 'Copy', async ({ ic, tx }) => {
    await copyText(getText());
    ic.className = 'ph ph-check text-[13px]'; tx.textContent = 'Copied';
    setTimeout(() => { ic.className = 'ph ph-copy text-[13px]'; tx.textContent = 'Copy'; }, 1300);
  });

  const proseClass = 'prose prose-sm max-w-none prose-pre:bg-base-200 prose-pre:text-base-content';
  const prose = md => h('div', { class: proseClass, html: marked.parse(md) });

  // ── block views — viewer.js's registry shape, keyed on fence language ──
  const isFullDoc = code => /^\s*(<!doctype|<html)/i.test(code);
  const jsonRows = code => {
    try { const v = JSON.parse(code); return Array.isArray(v) && v.length && typeof v[0] === 'object' ? v : null; }
    catch { return null; }
  };

  const blockViews = [
    {
      id: 'render', label: 'Render', icon: 'ph-eye',
      test: b => ['html', 'svg', 'xml'].includes(b.lang),
      build(host, getCode, o) {
        const frame = h('iframe', { class: 'w-full block bg-base-100 rounded-box border border-base-300', sandbox: 'allow-scripts', style: 'height:48px' });
        addEventListener('message', e => {
          if (e.source === frame.contentWindow && e.data && typeof e.data.__h === 'number')
            frame.style.height = Math.min(720, Math.max(40, e.data.__h + 2)) + 'px';
        });
        const build = () => {
          const c = getCode();
          if (isFullDoc(c)) {
            // A complete document renders as-is; splice the reporter in for
            // height, else fall back to a fixed viewport.
            if (/<\/body>/i.test(c)) frame.srcdoc = c.replace(/<\/body>/i, proof.reporter + '</body>');
            else { frame.srcdoc = c; frame.style.height = '320px'; }
          } else {
            frame.srcdoc = proof.doc('render', c, { tw: o.tw !== false, daisy: o.daisy });
          }
        };
        const bar = h('div', { class: 'flex justify-end' }, iconBtn('ph-arrow-clockwise', 'Refresh', build));
        host.append(frame, bar);
        build();
      },
    },
    {
      id: 'table', label: 'Table', icon: 'ph-table',
      test: b => b.lang === 'json' && !!jsonRows(b.code),
      async build(host, getCode) {
        await needTabulator();
        const target = h('div', { class: 'rounded-box border border-base-300 overflow-hidden' });
        host.append(target);
        const rows = jsonRows(getCode());
        if (!rows) { target.replaceWith(h('div', { class: 'text-xs opacity-60 p-2' }, 'Not a JSON array of objects.')); return; }
        new Tabulator(target, {
          data: rows, autoColumns: true, layout: 'fitDataFill',
          height: Math.min(420, 40 + rows.length * 32) + 'px',
        });
      },
    },
    {
      id: 'preview', label: 'Preview', icon: 'ph-article',
      test: b => ['md', 'markdown'].includes(b.lang),
      build(host, getCode) {
        host.append(h('div', { class: proseClass + ' rounded-box border border-base-300 bg-base-100 px-4 py-3', html: marked.parse(getCode()) }));
      },
    },
  ];

  const COLLAPSE_LINES = 24;

  function block(spec, o = {}) {
    const lang = String(spec.lang || '').toLowerCase().trim().split(/\s+/)[0];
    const b = { lang, code: spec.code };
    const views = blockViews.filter(v => v.test(b));

    const card = h('div', { class: 'rounded-box overflow-hidden bg-base-100 border border-base-300 not-prose my-3' });

    let ed = null;
    const getCode = () => ed ? ed.getValue() : b.code;
    let codeVersion = 0;          // bumped on edit; stale panes rebuild on re-activate
    const builtVersion = {};

    // static code view: instant, no editor cost; long blocks start collapsed
    const pre = h('pre', { class: 'm-0 px-3 py-2.5 overflow-auto text-[11.5px] leading-5 font-mono whitespace-pre text-base-content bg-base-100', html: esc(b.code) });
    const codeHost = h('div', { class: 'relative' }, pre);
    const lines = (b.code.match(/\n/g) || []).length + 1;
    if (lines > COLLAPSE_LINES) {
      pre.style.maxHeight = '20rem';
      const fade = h('div', { class: 'absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-base-100 to-transparent flex items-end justify-center pb-1.5' });
      const more = h('button', { class: 'btn btn-xs btn-ghost bg-base-100/90 border border-base-300 font-mono text-[10px]' }, `Show all ${lines} lines`);
      more.addEventListener('click', () => { pre.style.maxHeight = 'none'; fade.remove(); });
      fade.append(more);
      codeHost.append(fade);
    }

    // Edit means "edit the source text", so it always lands on the Code
    // view (clicking it from Table/Render would otherwise mount the editor
    // into a hidden pane). The editor mounts detached and swaps in only on
    // success, so a failed CM6 load leaves the static <pre> intact.
    const editBtn = iconBtn('ph-pencil-simple', 'Edit', async ({ tx }) => {
      if (ed) { activate('code'); return; }
      tx.textContent = '…';
      await activate('code');
      try {
        await needCm6();
        const host = h('div', { class: 'px-1 py-1' });
        ed = await cm6.create(host, {
          value: b.code,
          language: lang === 'js' || lang === 'javascript' ? 'js' : lang === 'html' ? 'html' : 'plain',
          wrap: true, fontSize: 12,
          onChange: () => { codeVersion++; },
        });
        codeHost.replaceChildren(host);
        editBtn.remove();
      } catch (e) { tx.textContent = 'Edit'; console.warn('[chat-render] editor unavailable:', e.message); }
    });

    // header: language tag, view tabs, actions
    const langTag = h('div', { class: 'flex items-center gap-1.5 font-mono text-[9.5px] opacity-50' },
      h('span', { class: 'inline-block w-1.5 h-1.5 bg-base-content/30 rounded-sm' }),
      h('span', {}, lang || 'text'));
    const tabs = h('div', { class: 'flex items-center gap-0.5' });
    const actions = h('div', { class: 'flex items-center' }, copyBtn(getCode), editBtn);
    const bar = h('div', { class: 'flex items-center justify-between gap-2 bg-base-200/60 pl-2.5 pr-1 py-0.5 border-b border-base-300' },
      langTag, h('div', { class: 'flex items-center gap-1' }, tabs, actions));

    const body = h('div', {});
    body.append(codeHost);

    // view switching: Code is the static host; others build on demand and
    // rebuild if the source was edited since they were last built
    const panes = { code: codeHost };
    const tabBtns = {};
    const activate = async id => {
      for (const [vid, btn] of Object.entries(tabBtns))
        btn.className = 'btn btn-ghost btn-xs gap-1 font-mono text-[10px] ' + (vid === id ? 'opacity-100 bg-base-300/50' : 'opacity-50 hover:opacity-100');
      if (panes[id] && id !== 'code' && builtVersion[id] !== codeVersion) {
        panes[id].remove();
        delete panes[id];
      }
      if (!panes[id]) {
        builtVersion[id] = codeVersion;
        const v = blockViews.find(x => x.id === id);
        const pane = h('div', { class: 'p-2 bg-base-200/40 space-y-1' });
        panes[id] = pane;
        body.append(pane);
        await v.build(pane, getCode, o);
      }
      for (const [pid, el] of Object.entries(panes)) el.style.display = pid === id ? '' : 'none';
    };
    if (views.length) {
      const mkTab = (id, label, icon) => {
        const btn = h('button', { class: 'btn btn-ghost btn-xs gap-1 font-mono text-[10px] opacity-50' },
          h('i', { class: `ph ${icon} text-[12px]` }), h('span', {}, label));
        btn.addEventListener('click', () => activate(id));
        tabBtns[id] = btn;
        tabs.append(btn);
      };
      mkTab('code', 'Code', 'ph-code');
      views.forEach(v => mkTab(v.id, v.label, v.icon));
      activate('code');
    }

    card.append(bar, body);
    return card;
  }

  // ── markdown → prose runs + block artifacts ─────────────────────────────
  function markdown(md, o = {}) {
    const tokens = marked.lexer(String(md ?? ''));
    const wrap = h('div', {});
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const seg = Object.assign(run, { links: tokens.links });
      wrap.append(h('div', { class: proseClass, html: marked.parser(seg) }));
      run = [];
    };
    for (const tok of tokens) {
      if (tok.type === 'code') { flush(); wrap.append(block({ lang: tok.lang, code: tok.text }, o)); }
      else run.push(tok);
    }
    flush();
    return wrap;
  }

  // ── chat turns ──────────────────────────────────────────────────────────
  const ROLES = {
    user:      { label: 'You',       icon: 'ph-user',       edge: 'border-primary/50' },
    assistant: { label: 'Assistant', icon: 'ph-sparkle',    edge: 'border-base-content/25' },
    system:    { label: 'System',    icon: 'ph-gear',       edge: 'border-warning/40' },
    tool:      { label: 'Tool',      icon: 'ph-wrench',     edge: 'border-info/40' },
    meta:      { label: 'Note',      icon: 'ph-note',       edge: 'border-base-300' },
  };
  const normRole = r => {
    const s = String(r || '').toLowerCase();
    if (/^(user|human|you|me)/.test(s)) return 'user';
    if (/^(assistant|ai|claude|chatgpt|gpt|gemini|kimi|model|bot)/.test(s)) return 'assistant';
    if (/^system/.test(s)) return 'system';
    if (/^tool/.test(s)) return 'tool';
    return s in ROLES ? s : 'meta';
  };

  function message(m, o = {}) {
    const role = normRole(m.role);
    const meta = ROLES[role];
    const head = h('div', { class: 'flex items-center gap-1.5 mb-1' },
      h('i', { class: `ph ${meta.icon} text-[12px] opacity-50` }),
      h('span', { class: 'font-mono text-[9.5px] tracking-widest uppercase opacity-50' }, m.label || meta.label),
      m.ts ? h('span', { class: 'font-mono text-[9.5px] opacity-30' }, String(m.ts)) : '');
    const bodyHost = h('div', { class: 'relative' }, markdown(m.md, o));
    const el = h('div', { class: `border-l-2 ${meta.edge} pl-3.5 py-0.5` }, head, bodyHost);
    if (m.anchor) el.id = m.anchor;

    // collapse pass: runs after the element is in the document
    const limit = o.collapse === undefined ? 460 : o.collapse;
    if (limit) requestAnimationFrame(() => {
      if (!bodyHost.isConnected || bodyHost.scrollHeight <= limit * 1.25) return;
      bodyHost.style.maxHeight = limit + 'px';
      bodyHost.style.overflow = 'hidden';
      const fade = h('div', { class: 'absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-base-200/90 to-transparent flex items-end justify-center pb-1' });
      const more = h('button', { class: 'btn btn-xs bg-base-100 border border-base-300 font-mono text-[10px] shadow-sm' }, 'Show full message');
      more.addEventListener('click', () => { bodyHost.style.maxHeight = 'none'; bodyHost.style.overflow = ''; fade.remove(); });
      fade.append(more);
      bodyHost.append(fade);
    });
    return el;
  }

  // The scroll view: turns stacked vertically. Renders the first `chunk` turns
  // up front and reveals the rest on one click, appended a batch per animation
  // frame, so a long chat no longer builds every turn and every code card
  // synchronously on expand.
  function scrollList(msgs, o = {}) {
    const wrap = h('div', {});
    const list = h('div', { class: 'space-y-4' });
    wrap.append(list);

    const chunk = o.chunk === undefined ? 12 : o.chunk;
    let next = 0;
    const renderBatch = n => {
      const end = n ? Math.min(next + n, msgs.length) : msgs.length;
      for (; next < end; next++) list.append(message({ anchor: `msg-${next + 1}`, ...msgs[next] }, o));
    };
    renderBatch(chunk || msgs.length);

    if (next < msgs.length) {
      const moreBar = h('div', { class: 'pt-1' });
      const btn = h('button', { class: 'btn btn-sm btn-block btn-ghost bg-base-100 border border-base-300 font-mono text-[11px] gap-2' },
        h('i', { class: 'ph ph-arrows-down text-[14px]' }), h('span', {}, `Show ${msgs.length - next} more turns`));
      btn.addEventListener('click', () => {
        btn.replaceChildren(h('span', { class: 'loading loading-spinner loading-xs' }), h('span', {}, 'Rendering…'));
        const step = () => {
          renderBatch(chunk);
          if (next < msgs.length) requestAnimationFrame(step);
          else moreBar.remove();
        };
        requestAnimationFrame(step);
      });
      moreBar.append(btn);
      wrap.append(moreBar);
    }
    return wrap;
  }

  // The full conversation. Accepts a message array or a house-format markdown
  // string (parsed here, so an inline string transcript renders like a fetched
  // one). Owns the header and a Cards | Scroll toggle over the two views: the
  // swipe deck (deck()) and the scroll list (scrollList()). Cards is the
  // default when the device is plausibly a phone (a narrow viewport OR a coarse
  // pointer, so a touch device still defaults to Cards even when a wrapping
  // frame or in-app browser reports a desktop-width layout); Scroll otherwise.
  // Each view builds once and is kept. o.mode ('cards'|'scroll') forces the
  // initial view past detection.
  const isHandheld = () => {
    try { return matchMedia('(max-width: 640px)').matches || matchMedia('(pointer: coarse)').matches; }
    catch { return false; }
  };
  function transcript(messages, o = {}) {
    const msgs = typeof messages === 'string' ? parse(messages) : (messages || []);
    const wrap = h('div', {});
    const seg = h('div', { class: 'join' });
    const label = h('p', { class: 'font-mono text-[9.5px] tracking-widest uppercase opacity-40' },
      `Full transcript · ${msgs.length} message${msgs.length === 1 ? '' : 's'}`);
    const bar = h('div', { class: 'flex items-center justify-between gap-2 mb-2' }, label, seg);
    const body = h('div', {});

    const built = {};
    let mode = (o.mode === 'cards' || o.mode === 'scroll') ? o.mode : (isHandheld() ? 'cards' : 'scroll');
    const render = () => {
      if (!built[mode]) built[mode] = mode === 'cards' ? deck(msgs, o) : scrollList(msgs, o);
      body.replaceChildren(built[mode]);
      for (const b of seg.children)
        b.className = 'btn btn-xs join-item font-mono text-[10px]' +
          (b.dataset.mode === mode ? ' btn-neutral' : ' btn-ghost bg-base-100 border border-base-300');
    };
    for (const [k, v, icon] of [['cards', 'Cards', 'ph-cards-three'], ['scroll', 'Scroll', 'ph-list']]) {
      const b = h('button', { 'data-mode': k, html: `<i class="ph ${icon} text-[12px]"></i> ${v}` });
      b.addEventListener('click', () => { mode = k; render(); });
      seg.append(b);
    }
    wrap.append(bar, body);
    render();
    return wrap;
  }

  // ── swipe deck: one exchange per card, paged ────────────────────────────
  // Group messages into exchanges: a user turn starts a new card; the
  // response turns (assistant/tool/system) and any leading preamble attach to
  // the current card. So a card is a prompt and its answer.
  function exchanges(msgs) {
    const groups = [];
    msgs.forEach(m => {
      if (normRole(m.role) === 'user' || !groups.length) groups.push([]);
      groups[groups.length - 1].push(m);
    });
    return groups;
  }

  let deckStyled = false;
  const ensureDeckStyle = () => {
    if (deckStyled) return; deckStyled = true;
    const s = h('style');
    s.textContent = '.cr-track::-webkit-scrollbar{display:none}';
    document.head.append(s);
  };

  // A swipeable card deck: one exchange per full-width, snap-scrolling card,
  // long turns scrolling *inside* the card so the deck shape holds instead of
  // a long scroll. Cards build their content lazily (active plus neighbours),
  // so a long chat pages cheaply on mobile: only the visible turn renders its
  // markdown and code. Native touch swipe comes from CSS scroll-snap; the
  // buttons and counter drive it on desktop. o.height overrides the card
  // height (CSS length); o.fill makes the deck fill its parent (a fullscreen
  // takeover) instead of a fixed height; per-message collapse is off in a card.
  function deck(messages, o = {}) {
    ensureDeckStyle();
    const msgs = typeof messages === 'string' ? parse(messages) : (messages || []);
    const groups = exchanges(msgs);
    const wrap = h('div', { class: o.fill ? 'flex flex-col h-full min-h-0' : '' });
    const height = o.height || 'min(72vh, 640px)';

    const track = h('div', { class: 'cr-track flex overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain' + (o.fill ? ' grow min-h-0' : ''),
      style: o.fill ? 'scrollbar-width:none' : `height:${height};scrollbar-width:none` });
    const bodies = [];
    const built = new Array(groups.length).fill(false);
    groups.forEach((g, i) => {
      const roles = [...new Set(g.map(m => ROLES[normRole(m.role)].label))].join('  →  ');
      const head = h('div', { class: 'shrink-0 flex items-center justify-between px-3.5 py-2 border-b border-base-300 bg-base-200/50' },
        h('span', { class: 'font-mono text-[9.5px] tracking-widest uppercase opacity-50' }, roles),
        h('span', { class: 'font-mono text-[9.5px] opacity-40 tabular-nums' }, `${i + 1} / ${groups.length}`));
      const body = h('div', { class: 'grow overflow-y-auto px-3.5 py-3 space-y-4' });
      bodies.push(body);
      track.append(h('div', { class: 'flex-none w-full snap-center px-0.5 h-full' },
        h('div', { class: 'h-full flex flex-col rounded-box border border-base-300 bg-base-100 overflow-hidden' }, head, body)));
    });

    const buildCard = i => {
      if (i < 0 || i >= groups.length || built[i]) return;
      built[i] = true;
      groups[i].forEach(m => bodies[i].append(message(m, { ...o, collapse: 0 })));
    };

    const cardW = () => track.clientWidth || 1;
    const active = () => Math.round(track.scrollLeft / cardW());
    const go = i => track.scrollTo({ left: Math.max(0, Math.min(groups.length - 1, i)) * cardW(), behavior: 'smooth' });

    if (groups.length > 1) {
      const navBtn = (icon, onClick) => {
        const b = h('button', { class: 'btn btn-sm btn-circle btn-ghost border border-base-300' }, h('i', { class: `ph ${icon} text-[15px]` }));
        b.addEventListener('click', onClick);
        return b;
      };
      const prevB = navBtn('ph-caret-left', () => go(active() - 1));
      const nextB = navBtn('ph-caret-right', () => go(active() + 1));
      const counter = h('span', { class: 'font-mono text-[11px] opacity-60 tabular-nums min-w-16 text-center' }, `1 / ${groups.length}`);
      const nav = h('div', { class: 'flex items-center justify-center gap-3 pt-2.5' + (o.fill ? ' pb-1 shrink-0' : '') }, prevB, counter, nextB);
      const sync = a => {
        counter.textContent = `${a + 1} / ${groups.length}`;
        prevB.disabled = a <= 0;
        nextB.disabled = a >= groups.length - 1;
      };
      let raf = 0;
      track.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const a = active();
          sync(a);
          buildCard(a - 1); buildCard(a); buildCard(a + 1);
        });
      });
      track.tabIndex = 0;
      track.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') { go(active() + 1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { go(active() - 1); e.preventDefault(); }
      });
      sync(0);
      wrap.append(track, nav);
    } else {
      wrap.append(track);
    }

    // first paint deferred so clientWidth is valid once inserted
    requestAnimationFrame(() => { buildCard(0); buildCard(1); });
    return wrap;
  }

  // Fullscreen takeover: one chat fills the screen as the swipe deck (or the
  // scroll list, via the toggle), with a title bar and a close control. Opening
  // it locks the background scroll and pushes a history entry, so the phone
  // back button, Escape, and the close button all dismiss it. Returns a handle
  // with close(). opts: { title, provider, date, mode }.
  function openTranscript(messages, opts = {}) {
    const msgs = typeof messages === 'string' ? parse(messages) : (messages || []);

    const overlay = h('div', { class: 'fixed inset-0 z-[70] bg-base-100 flex flex-col' });
    const closeBtn = h('button', { class: 'btn btn-sm btn-ghost btn-circle shrink-0', 'aria-label': 'Close' },
      h('i', { class: 'ph ph-x text-[18px]' }));
    const titleWrap = h('div', { class: 'min-w-0 flex-1' },
      h('div', { class: 'font-semibold text-sm truncate' }, opts.title || 'Transcript'),
      h('div', { class: 'font-mono text-[10px] opacity-50 truncate' },
        [opts.provider, opts.date, `${msgs.length} message${msgs.length === 1 ? '' : 's'}`].filter(Boolean).join('  ·  ')));
    const seg = h('div', { class: 'join shrink-0' });
    const bar = h('div', { class: 'flex items-center gap-2 px-2.5 py-2 border-b border-base-300 bg-base-200/60 shrink-0' },
      closeBtn, titleWrap, seg);
    const body = h('div', { class: 'grow min-h-0' });
    overlay.append(bar, body);

    const built = {};
    let mode = (opts.mode === 'scroll' || opts.mode === 'cards') ? opts.mode : 'cards';
    const render = () => {
      if (!built[mode]) built[mode] = mode === 'cards'
        ? deck(msgs, { ...opts, fill: true })
        : h('div', { class: 'h-full overflow-y-auto px-3.5 py-3' }, scrollList(msgs, opts));
      body.replaceChildren(built[mode]);
      for (const b of seg.children)
        b.className = 'btn btn-xs join-item font-mono text-[10px]' +
          (b.dataset.mode === mode ? ' btn-neutral' : ' btn-ghost bg-base-100 border border-base-300');
    };
    for (const [k, v, icon] of [['cards', 'Cards', 'ph-cards-three'], ['scroll', 'Scroll', 'ph-list']]) {
      const b = h('button', { 'data-mode': k, html: `<i class="ph ${icon} text-[12px]"></i> ${v}` });
      b.addEventListener('click', () => { mode = k; render(); });
      seg.append(b);
    }

    const prevOverflow = document.documentElement.style.overflow;
    let closed = false;
    const cleanup = () => {
      if (closed) return; closed = true;
      removeEventListener('keydown', onKey);
      removeEventListener('popstate', onPop);
      document.documentElement.style.overflow = prevOverflow;
      overlay.remove();
    };
    const dismiss = () => { if (!closed) history.back(); };   // back → popstate → cleanup
    const onPop = () => cleanup();
    const onKey = e => { if (e.key === 'Escape') dismiss(); };
    closeBtn.addEventListener('click', dismiss);
    addEventListener('popstate', onPop);
    addEventListener('keydown', onKey);
    history.pushState({ __crDeck: 1 }, '', location.href);
    document.documentElement.style.overflow = 'hidden';
    document.body.append(overlay);
    render();
    return { el: overlay, close: dismiss };
  }

  // ── house-format markdown → messages ────────────────────────────────────
  // Splits on turn markers whose first word is a known role, in any of three
  // forms: a heading (`## User`, `### Assistant`), a bold lead-in (`**User:**`),
  // or a dashed fence (`--- Human ---`, `--- Assistant ---`, `--- Tool (name) ---`)
  // — the last is what chat-histories' extract_chat.py emits, so a fetched or
  // inline transcript from a result envelope splits into turns instead of
  // rendering as one blob. Anything before the first marker becomes a meta note.
  const MARKER = /^(?:#{1,6}\s+(?:\*\*)?|\*\*|-{3,}\s*)\s*(user|human|you|me|assistant|ai|claude|chatgpt|gpt|gemini|kimi|model|bot|system|tool)\b[^\n]*$/i;
  function parse(md) {
    const lines = String(md ?? '').split('\n');
    const out = [];
    let cur = null;
    const push = () => { if (cur && cur.md.trim()) out.push({ role: cur.role, md: cur.md.trim() }); };
    let fence = null;
    for (const line of lines) {
      const f = line.match(/^\s*(```+|~~~+)/);
      if (f) fence = fence && f[1][0] === fence[0] && f[1].length >= fence.length ? null : (fence || f[1]);
      const m = !fence && line.match(MARKER);
      if (m) { push(); cur = { role: normRole(m[1]), md: '' }; continue; }
      if (!cur) cur = { role: 'meta', md: '' };
      cur.md += line + '\n';
    }
    push();
    return out;
  }

  window.chatRender = { ready, parse, markdown, block, message, transcript, deck, openTranscript, blockViews, ROLES };
})();
