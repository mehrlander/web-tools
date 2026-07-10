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
//   chatRender.transcript(msgs, o?) -> element   // the full conversation
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
// there is no unsandboxed 'parent' kind here. The Edit pencil swaps the
// static <pre> for a CM6 editor (kits/cm6.js, lazy-loaded); Render then
// uses the edited text.
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

    const editBtn = iconBtn('ph-pencil-simple', 'Edit', async ({ tx }) => {
      if (ed) return;
      tx.textContent = '…';
      try {
        await needCm6();
        const host = h('div', { class: 'px-1 py-1' });
        codeHost.replaceChildren(host);
        ed = await cm6.create(host, {
          value: b.code,
          language: lang === 'js' || lang === 'javascript' ? 'js' : lang === 'html' ? 'html' : 'plain',
          wrap: true, fontSize: 12,
        });
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

    // view switching: Code is the static host; others build once, on demand
    const panes = { code: codeHost };
    const tabBtns = {};
    const activate = async id => {
      for (const [vid, btn] of Object.entries(tabBtns))
        btn.className = 'btn btn-ghost btn-xs gap-1 font-mono text-[10px] ' + (vid === id ? 'opacity-100 bg-base-300/50' : 'opacity-50 hover:opacity-100');
      if (!panes[id]) {
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

  function transcript(messages, o = {}) {
    const wrap = h('div', { class: 'space-y-4' });
    (messages || []).forEach((m, i) => wrap.append(message({ anchor: `msg-${i + 1}`, ...m }, o)));
    return wrap;
  }

  // ── house-format markdown → messages ────────────────────────────────────
  // Splits on turn markers: a heading (`## User`, `### Assistant`) or a
  // bold lead-in (`**User:**`) whose word is a known role. Anything before
  // the first marker becomes a meta note.
  const MARKER = /^(?:#{1,6}\s+(?:\*\*)?|\*\*)\s*(user|human|you|me|assistant|ai|claude|chatgpt|gpt|gemini|kimi|model|bot|system|tool)\b[^\n]*$/i;
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

  window.chatRender = { ready, parse, markdown, block, message, transcript, blockViews, ROLES };
})();
