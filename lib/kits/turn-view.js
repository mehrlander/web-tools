// turn-view.js — the pages and documents one turn of a session changed, each
// rendered as its reader would see it, with a note bar whose notes go to the
// estate's notes store. One view, two hosts:
//
//   card   a card of session.html's Turns tab. The card keeps its height; a
//          row of icons pinned at its bottom chooses what fills the body:
//          the discussion (the first icon, drawn by the host, the default)
//          or one of the turn's files. A chosen file brings a foot directly
//          above the row: its name and commit, its GitHub and open links, a
//          Full door to turn.html, and the note bar. The row is always the
//          card's last line (the owner, 2026-11-27: "Icons at the bottom,
//          discussion as the first one").
//   full   pages/turn.html: the files over a strip of cards
//          (kits/linked-swiper.js), with the swipe deck's takeover.
//
// THE CARD'S ROW IS ICONS, not tabs: a turn changes up to a dozen files, and
// a tab with a whole path does not fit a phone's width. Each file's button
// is its kind's icon and the start of its name, the row scrolls sideways
// when it runs long, and the chosen file's path is printed in the foot.
//
// What a turn changed is kits/turn-views.js's answer, from the record alone.
// The commit each file stood at when the turn ended is GitHub's: one commits
// read per file, made when the file is first shown, so a session's dozens of
// turns cost nothing until a reader opens one. A file not committed by the
// turn's end shows its branch as it is now ("now"); one at neither its
// branch nor main says so in place of a frame.
//
// Notes: drafted in this browser per session and turn (both hosts share the
// drafts), sent through kits/notes.js, one note per draft, about
// owner/repo@branch:path, its text naming the session, the turn and the card.
//
// Framework-free. Needs window.esc (lib/vanilla-bundle.js), TurnViews,
// RepoAddress, GuideRender, and for full mode linkedSwiper and swipeDeck;
// kits/notes.js and gh-store.js load on the first Send.
//
//   TurnView.card(el, { record, path, n, store?, start?, discussion, onPick?, expand? })
//     -> { destroy() }; with no files, discussion(el) alone
//     start        the item to open on: 0 the discussion, i the i-th file
//     discussion(target)  draws the discussion into target (the host's)
//     onPick(j)    the item in view moved (0 the discussion)
//     expand(i)    the Full door's address for file i (0-based)
//   TurnView.mount(el, { record, path, n, store?, start?, onPick?, discussion? })
//     -> { count, destroy() }, or null with no discussion and no files.
//     With discussion(target), the list opens on a Discussion item, so start
//     and onPick count it as item 0 and the files from 1.
//   TurnView.files(record, n) -> the turn's file count
(() => {
  const SITE = 'https://mehrlander.github.io/web-tools/';
  const STORE = 'mehrlander/web-tools-private';
  const esc = (s) => window.esc(s);
  const ROW = 'flex cursor-pointer items-center gap-2 border-b border-base-200 px-3 py-1.5 last:border-0 hover:bg-base-200/60 aria-selected:bg-primary/10';

  const unpinned = (v) => v.pin === 'head' || v.pin === 'main';
  const tail = (p) => p.split('/').slice(-2).join('/');
  const iconOf = (v) => (v.kind === 'page' ? 'ph-browser' : 'ph-file-text');

  // ── The commit each file stood at ─────────────────────────────────────
  const CONF = new Map();
  function conf(g, slug) {
    if (!CONF.has(slug)) CONF.set(slug, g.get('.web-tools.json').then((r) => JSON.parse(r.text)).catch(() => null));
    return CONF.get(slug);
  }
  async function readRef(m, v) {
    const slug = m.owner + '/' + v.repo;
    const g = new window.GH({ token: window.TOKEN, repo: slug, ref: v.branch || 'main' });
    const q = 'commits?per_page=1&path=' + encodeURIComponent(v.path) + (m.turn.to ? '&until=' + encodeURIComponent(m.turn.to) : '');
    const ref = v.branch || 'main';
    const c = (await g.req(q + '&sha=' + encodeURIComponent(ref)).catch(() => null))?.[0];
    const when = c?.commit?.committer?.date || '';
    if (c && when >= m.turn.from.slice(0, 19)) { v.ref = c.sha; v.pin = c.sha.slice(0, 7); }
    else {
      // The branch's head, not main: main is the answer only when the
      // branch no longer holds the file (merged and deleted) and main does.
      const has = (r) => g.req('contents/' + v.path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(r))
        .then(() => true, (e) => (e?.status === 404 ? false : null));
      let at = ref, there = await has(ref);
      if (there === false && ref !== 'main' && await has('main')) { at = 'main'; there = true; }
      v.ref = at; v.pin = at === 'main' ? 'main' : 'head'; v.missing = there === false;
    }
    const c2 = await conf(g, slug);
    v.url = v.kind === 'page'
      ? ((window.GuideRender?.pageTargets?.(slug, v.ref, [v.path], c2?.showing) || [])[0]?.url || '')
      : SITE + 'pages/data-view.html?src=' + slug + '@' + v.ref + ':' + v.path;
  }
  // Once per file, however many times it is shown.
  const resolve = (m, v) => v.reading || (v.reading = readRef(m, v).catch(() => { v.ref = v.branch || 'main'; v.pin = 'head'; }));

  // ── Notes ─────────────────────────────────────────────────────────────
  let SENT = null;   // one read of the store per page, shared by every view
  async function registry() {
    if (!window.TOKEN) throw new Error('no GitHub token is saved in this browser');
    if (!window.GH.toBase64) await window.gh.load('gh-store.js');
    if (!window.Notes) await window.gh.load('kits/notes.js');
    return new window.GH({ token: window.TOKEN, repo: STORE, ref: 'main' });
  }
  const loadSent = () => SENT || (SENT = registry().then((g) => window.Notes.load(g)).catch(() => []));

  function model({ record, path, n, store }) {
    const turn = window.TurnViews.of(record, n);
    if (!turn) return null;
    const short = String(record.short || '').slice(0, 8) || (String(path).match(/-([0-9a-f]{8})\.json$/) || [])[1] || '';
    const m = { record, path, store: store || STORE, owner: (store || STORE).split('/')[0], turn, short,
                views: turn.files.map((f) => ({ ...f, name: f.path.split('/').pop(), ref: '', pin: '', url: '', missing: false })) };
    m.key = 'turn-notes:' + short + ':' + turn.n;
    m.aboutOf = (v) => m.owner + '/' + v.repo + (v.branch ? '@' + v.branch : '') + ':' + v.path;
    m.where = (v) => 'Written on turn ' + m.turn.n + ' of session ' + m.short + ' (' + m.store + ':' + m.path + ')'
      + ', card ' + (m.views.indexOf(v) + 1) + ' of ' + m.views.length + (v.pin ? ', at ' + v.pin : '') + '.';
    return m;
  }
  const files = (record, n) => { const t = window.TurnViews?.of(record, n); return t ? t.files.length + t.other.length : 0; };

  const link = (href, icon, tip) => href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener" class="btn btn-xs btn-ghost btn-square cursor-pointer hover:text-primary"'
    + ' data-title-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '"><i class="ph ' + icon + ' text-base"></i></a>' : '';
  const ghOf = (m, v) => window.RepoAddress.github.blob(m.owner + '/' + v.repo, v.ref || v.branch || 'main', v.path);

  // A file's frame, or why there is none yet.
  function frame(v, target) {
    if (!v) return;
    if (v.missing) {
      target.innerHTML = '<div class="flex flex-col gap-1 px-4 py-6 text-base" data-at="missing"><span class="font-semibold">Not at ' + esc(v.ref) + '</span>'
        + '<span class="font-mono text-sm text-base-content/60">' + esc(v.repo + ':' + v.path) + '</span></div>';
      return;
    }
    if (!v.url) {
      target.innerHTML = '<div class="flex h-full items-start justify-center pt-12"><span class="loading loading-dots loading-md opacity-40"></span></div>';
      return;
    }
    if (target.querySelector('iframe')?.getAttribute('src') === v.url) return;
    const f = document.createElement('iframe');
    f.src = v.url;
    f.className = 'block h-full w-full border-0 bg-base-100';
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
    f.setAttribute('aria-label', v.path);
    target.replaceChildren(f);
  }

  // ── The note bar: drafts, sent notes and a field, for the file in view ──
  function noteBar(m, el, current, changed) {
    let drafts = [], sent = [], typing = '', sending = false, status = '';
    try { drafts = JSON.parse(localStorage.getItem(m.key) || '[]'); } catch { drafts = []; }
    const addCls = () => 'btn btn-sm btn-square ' + (typing.trim() ? 'btn-success' : 'btn-ghost opacity-40');
    function paint() {
      const v = current();
      if (!v) { el.replaceChildren(); return; }
      const mine = drafts.filter((d) => d.key === v.key);
      const told = sent.filter((s) => s.about === m.aboutOf(v));
      const had = document.activeElement === el.querySelector('[data-draft]');
      el.innerHTML = ((mine.length || told.length) ? '<div class="flex max-h-24 flex-col gap-1.5 overflow-y-auto">'
          + mine.map((d) => '<div class="flex items-start gap-2 rounded-lg bg-info/10 py-1 pl-2 pr-1 text-base">'
            + '<i class="ph ph-chat-circle-text mt-1 opacity-60"></i><span class="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">' + esc(d.text) + '</span>'
            + '<button type="button" class="btn btn-ghost btn-xs btn-square" data-drop="' + esc(d.id) + '" aria-label="Remove this note"><i class="ph ph-x"></i></button></div>').join('')
          + told.map((s) => '<div class="flex items-start gap-2 rounded-lg bg-success/10 py-1 px-2 text-base">'
            + '<i class="ph ph-check-circle mt-1 text-success"></i><span class="min-w-0 flex-1 line-clamp-2 [overflow-wrap:anywhere]">' + esc(String(s.text).split('\n\n')[0]) + '</span>'
            + '<span class="shrink-0 font-mono text-xs text-base-content/50">' + esc(String(s.at).slice(5, 10)) + '</span></div>').join('')
          + '</div>' : '')
        + '<div class="flex items-center gap-2">'
        + '<input data-draft type="text" class="input input-sm input-bordered min-w-0 flex-1 text-base" aria-label="A note on the file in view" placeholder="Add a note">'
        + '<button type="button" data-add class="' + addCls() + '" aria-label="Add the note"><i class="ph ph-check"></i></button>'
        + '<button type="button" data-send class="btn btn-sm btn-primary min-w-20 tabular-nums"' + (sending || !drafts.length ? ' disabled' : '') + '>'
        + (sending ? '<span class="loading loading-spinner loading-xs"></span>' : '') + (drafts.length ? 'Send ' + drafts.length : 'Send') + '</button></div>'
        + (status ? '<div class="text-xs text-base-content/70" role="status">' + esc(status) + '</div>' : '');
      const f = el.querySelector('[data-draft]');
      f.value = typing;
      if (had) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }
    const keep = () => {
      try { localStorage.setItem(m.key, JSON.stringify(drafts)); status = ''; }
      catch { status = 'This browser would not keep the note; Send before leaving.'; }
      changed?.(); paint();
    };
    function add() {
      const text = typing.trim(), v = current();
      if (!text || !v) { el.querySelector('[data-draft]')?.focus(); return; }
      drafts = [...drafts, { id: 'd' + Date.now().toString(36), key: v.key, text, at: new Date().toISOString() }];
      typing = '';
      keep();
      el.querySelector('[data-draft]')?.focus();
    }
    async function send() {
      if (sending || !drafts.length) return;
      sending = true; status = 'Sending…'; paint();
      try {
        const reg = await registry();
        const author = await window.Notes.author(reg);
        const out = drafts.slice();
        const notes = out.map((d) => {
          const v = m.views.find((x) => x.key === d.key);
          return window.Notes.make({ about: m.aboutOf(v), author, text: d.text + '\n\n' + m.where(v) });
        });
        const all = await window.Notes.append(reg, notes);
        const ids = new Set(notes.map((n) => n.id));
        sent = [...sent, ...all.filter((n) => ids.has(n.id))];
        drafts = drafts.filter((d) => !out.some((x) => x.id === d.id));
        status = 'Sent ' + out.length + ' note' + (out.length === 1 ? '' : 's') + '.';
        SENT = Promise.resolve(all);
      } catch (e) {
        status = 'Not sent: ' + (e?.message || String(e));
      }
      sending = false;
      keep();
    }
    el.addEventListener('input', (e) => {
      if (!e.target.matches('[data-draft]')) return;
      typing = e.target.value;
      const b = el.querySelector('[data-add]');
      if (b) b.className = addCls();
    });
    // A key typed here stays here: the strips around this view take arrows.
    el.addEventListener('keydown', (e) => {
      if (!e.target.matches('[data-draft]')) return;
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); add(); }
    });
    el.addEventListener('click', (e) => {
      const d = e.target.closest('[data-drop]');
      if (d) { drafts = drafts.filter((x) => x.id !== d.getAttribute('data-drop')); keep(); return; }
      if (e.target.closest('[data-add]')) add();
      else if (e.target.closest('[data-send]')) send();
    });
    let read = false;
    return {
      paint,
      drafts: (v) => drafts.filter((d) => d.key === v.key).length,
      // The turn's sent notes, read once, when a file is first shown.
      async sent() {
        if (read) return;
        read = true;
        sent = (await loadSent()).filter((n) => String(n.text).includes('turn ' + m.turn.n + ' of session ' + m.short + ' '));
        paint();
      },
    };
  }

  // ── The card: one bounded view, its row choosing the body ────────────
  function card(el, o = {}) {
    const m = model(o);
    el.replaceChildren();
    if (!m || !(m.views.length || m.turn.other.length)) { o.discussion?.(el); return { destroy() { el.replaceChildren(); } }; }
    let j = Math.max(0, Math.min(m.views.length + (m.turn.other.length ? 1 : 0), o.start || 0)), gone = false;
    const expandTo = (i) => (o.expand ? o.expand(i) : SITE + 'pages/turn.html#id=' + m.short + '&turn=' + m.turn.n + '&card=' + i);

    el.setAttribute('data-turn-view', 'card');
    const shell = document.createElement('div');
    shell.className = 'flex h-full min-h-0 flex-col';
    const row = document.createElement('div');
    row.dataset.at = 'turn-row';
    // pr-16, as the foot has: the FAB sits over the card's bottom-right
    // corner, and the row's end padding lets its last icon scroll clear.
    row.className = 'flex flex-none items-center gap-0.5 overflow-x-auto border-t border-base-200 bg-base-100 py-1 pl-2 pr-16 [scrollbar-width:none]';
    const talk = document.createElement('div');
    // pb-20 lets the last lines scroll clear of the estate's FAB.
    talk.className = 'min-h-0 flex-auto overflow-y-auto px-3.5 pt-3 pb-20';
    talk.dataset.at = 'discussion';
    const pane = document.createElement('div');
    pane.className = 'min-h-0 flex-auto';
    pane.dataset.at = 'card';
    const bar = document.createElement('div');
    bar.dataset.at = 'composer';
    bar.className = 'flex flex-col gap-1.5';
    const foot = document.createElement('div');
    // pr-16 clears the estate's FAB, which sits over a card's bottom-right
    // corner on a phone and covered Send and Full.
    foot.className = 'flex flex-none flex-col gap-1.5 border-t border-base-300 py-2 pl-3 pr-16';
    const name = document.createElement('div');
    name.className = 'flex min-w-0 items-center gap-1';
    name.dataset.at = 'turn-file';
    foot.append(name, bar);
    // The reply's close (its closing state and caption), pinned above the
    // row while the discussion is in view; the host's discussion fills it.
    const close = document.createElement('div');
    close.dataset.at = 'turn-close';
    close.className = 'flex flex-none flex-col gap-0.5 border-t border-base-300 bg-base-100 py-1.5 pl-3.5 pr-16 empty:hidden';
    shell.append(talk, pane, close, foot, row);
    el.append(shell);
    o.discussion?.(talk, close);

    // Items: 0 the discussion, 1..n the files, then the other files' list.
    const others = m.turn.other.length ? m.views.length + 1 : 0;
    const v = () => (j > 0 && j <= m.views.length ? m.views[j - 1] : null);
    const notes = noteBar(m, bar, v, () => paintRow());
    // The row: an icon for the discussion, then one per file. The file in
    // view is named in the foot above it, over the note bar, with its links.
    function paintRow() {
      // A file's button carries its icon and the start of its name, so the
      // files are told apart without opening each one.
      const stem = (x) => x.name.replace(/\.[^.]+$/, '');
      const icon = (k, ic, name, n, label) => '<button type="button" data-item="' + k + '" aria-pressed="' + (k === j) + '"'
        + ' class="btn btn-sm btn-ghost relative flex-none cursor-pointer gap-1 px-1.5 font-normal hover:text-primary '
        + (k === j ? 'btn-active text-primary' : 'text-base-content/60') + '"'
        + ' aria-label="' + esc(name) + '" data-title-tip="' + esc(name) + '"><i class="ph ' + ic + ' text-lg"></i>'
        + (label ? '<span class="max-w-[4.5rem] truncate text-xs">' + esc(label) + '</span>' : '')
        + (n ? '<span class="badge badge-info badge-xs absolute -right-0.5 -top-0.5 px-1 tabular-nums">' + n + '</span>' : '') + '</button>';
      row.innerHTML = icon(0, 'ph-chat-text', 'Discussion', 0)
        + '<span class="mx-1 h-5 w-px flex-none bg-base-300"></span>'
        + m.views.map((x, i) => icon(i + 1, iconOf(x), x.path, notes.drafts(x), stem(x))).join('')
        + (others ? icon(others, 'ph-files', m.turn.other.length === 1 ? '1 other file' : m.turn.other.length + ' other files', 0, '+' + m.turn.other.length) : '');
      const f = v();
      // Every part holds its place before the commit read lands: the pin
      // reads … and the open link waits disabled, so nothing reflows.
      name.innerHTML = f ? '<span class="mr-1 w-14 flex-none font-mono text-xs font-normal tabular-nums '
            + (unpinned(f) ? 'text-warning">now' : 'text-base-content/60">' + esc(f.pin || '\u2026')) + '</span>'
          + '<span class="min-w-0 flex-1 truncate text-sm font-semibold">' + esc(tail(f.path)) + '</span>'
          + link(ghOf(m, f), 'ph-github-logo', 'On GitHub')
          + (f.url ? link(f.url, 'ph-arrow-square-out', 'Open in a new tab')
              : '<span class="btn btn-xs btn-ghost btn-square btn-disabled" aria-hidden="true"><i class="ph ph-arrow-square-out text-base"></i></span>')
          + '<a href="' + esc(expandTo(j - 1)) + '" data-turn-expand class="btn btn-xs btn-ghost gap-1 font-normal hover:text-primary" aria-label="Open this turn full screen at this file">'
          + '<i class="ph ph-arrows-out"></i>Full</a>' : '';
    }
    // The files with no render, as a list: each its path and a link to it.
    function paintOthers() {
      pane.innerHTML = '<div class="h-full overflow-y-auto px-3.5 py-3" data-at="other-files"><ul class="flex flex-col gap-1">'
        + m.turn.other.map((x) => '<li class="flex min-w-0 items-center gap-2 text-base"><i class="ph ph-file-code shrink-0 text-base-content/50"></i>'
          + '<a class="link link-hover min-w-0 truncate" target="_blank" rel="noopener" href="'
          + esc(window.RepoAddress.github.blob(m.owner + '/' + x.repo, x.branch || 'main', x.path)) + '">'
          + '<span class="text-base-content/50">' + esc(x.path.includes('/') ? x.path.slice(0, x.path.lastIndexOf('/') + 1) : '') + '</span>'
          + esc(x.path.split('/').pop()) + '</a></li>').join('') + '</ul></div>';
    }
    function show() {
      const f = v(), list = others && j === others;
      talk.classList.toggle('hidden', !!f || list);
      close.classList.toggle('!hidden', !!f || list);
      pane.classList.toggle('hidden', !f && !list);
      if (list) { foot.classList.add('hidden'); paintRow(); paintOthers(); return; }
      foot.classList.toggle('hidden', !f);
      paintRow();
      if (!f) return;
      frame(f, pane);
      notes.paint();
      // The commit read and the render start when a file is first chosen.
      resolve(m, f).then(() => { if (gone || v() !== f) return; paintRow(); frame(f, pane); });
      notes.sent();
    }
    row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-item]');
      if (!b) return;
      const k = +b.getAttribute('data-item');
      if (k === j) return;
      j = k; show(); o.onPick?.(j);
    });
    show();
    return { destroy() { gone = true; el.replaceChildren(); } };
  }

  // ── The full page's form: the list over a strip ──────────────────────
  function mount(el, o = {}) {
    const m = model(o);
    if (!m) return null;
    // The discussion leads the list when the host draws one (o.discussion),
    // as it does on the card; then the files.
    const D = o.discussion ? { key: '§discussion', disc: true, name: 'Discussion', path: 'Discussion' } : null;
    const items = D ? [D, ...m.views] : m.views;
    if (!items.length) return null;
    let at = Math.max(0, Math.min(items.length - 1, o.start || 0)), swiper = null, gone = false;

    el.replaceChildren();
    el.setAttribute('data-turn-view', 'full');
    const box = document.createElement('div');
    box.className = 'flex min-h-0 grow flex-col';
    const root = document.createElement('div'), list = document.createElement('div'), cardEl = document.createElement('div');
    root.className = 'min-h-0 grow px-2 pt-2';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'The discussion and the pages and documents this turn changed');
    list.dataset.at = 'files';
    cardEl.dataset.at = 'card';
    root.append(list, cardEl);
    const bar = document.createElement('div');
    bar.dataset.at = 'composer';
    bar.className = 'shrink-0 border-t border-base-300 px-3 py-2 flex flex-col gap-1.5 empty:hidden';
    box.append(root, bar);
    el.append(box);

    const rows = () => items.map((v, i) => {
      if (v.disc) {
        return '<div data-view="' + esc(v.key) + '" role="option" tabindex="-1" aria-selected="' + (i === at) + '" class="' + ROW + '">'
          + '<i class="ph ph-chat-text shrink-0 text-base text-base-content/50"></i><span class="min-w-0 flex-1 truncate text-sm">Discussion</span></div>';
      }
      const n = notes.drafts(v);
      const dir = v.path.includes('/') ? v.path.slice(0, v.path.lastIndexOf('/') + 1) : '';
      return '<div data-view="' + esc(v.key) + '" role="option" tabindex="-1" aria-selected="' + (i === at) + '" class="' + ROW + '">'
        + '<i class="ph ' + iconOf(v) + ' shrink-0 text-base text-base-content/50"></i>'
        + '<span class="min-w-0 flex-1 truncate text-sm"><span class="text-base-content/50">' + esc(dir) + '</span>' + esc(v.name) + '</span>'
        + (n ? '<span class="badge badge-info badge-sm shrink-0 gap-1"><i class="ph ph-chat-circle-text"></i>' + n + '</span>' : '')
        + (unpinned(v) ? '<span class="shrink-0 font-mono text-xs text-warning">now</span>' : '')
        + '</div>';
    }).join('');
    const repaint = () => { list.innerHTML = rows(); swiper?.mount(); window.linkedSwiper?.mark(list, 'view', items[at]?.key); };
    // The note bar belongs to a file; on the discussion it is empty.
    const notes = noteBar(m, bar, () => (items[at]?.disc ? null : items[at]), repaint);
    function head(i, n, tight) {
      const v = items[i];
      if (!v) return '';
      if (v.disc) return window.linkedSwiper.head({ title: 'Discussion' }, i, n, 'card', { deck: true, tight });
      return window.linkedSwiper.head({ code: unpinned(v) ? 'now' : v.pin, title: tail(v.path) }, i, n, 'card', { deck: true, tight })
        + link(ghOf(m, v), 'ph-github-logo', 'On GitHub') + link(v.url, 'ph-arrow-square-out', 'Open in a new tab');
    }
    function body(v, target) {
      if (!v) return;
      if (v.disc) {
        const s = document.createElement('div');
        s.className = 'h-full overflow-y-auto px-3.5 pt-3 pb-20';
        s.dataset.at = 'discussion';
        target.replaceChildren(s);
        o.discussion(s);
        return;
      }
      frame(v, target);
    }
    function deck() {
      if (!window.swipeDeck) return;
      let h = null;
      h = window.swipeDeck.open({
        count: items.length, start: at, innerClass: 'h-full w-full min-w-0',
        index: (i) => (items[i].disc ? { title: 'Discussion', icon: 'ph-chat-text' }
          : { title: tail(items[i].path), subtitle: items[i].pin, icon: iconOf(items[i]) }),
        icon: 'ph-cards-three', title: items[at].name, subtitle: 'turn ' + m.turn.n + ' · ' + m.short,
        onSlide: (i) => { h?.setTitle?.(items[i].name); at = i; swiper?.show(items[i].key); notes.paint(); o.onPick?.(i); },
        render: (i, slide) => body(items[i], slide),
      });
    }
    list.innerHTML = rows();
    swiper = window.linkedSwiper.attach({
      root, list, card: cardEl, key: 'view', noun: 'card', listMax: 'max-h-[22vh]',
      ids: () => items.map((v) => v.key),
      sel: () => items[at]?.key,
      head: ({ i, n, tight }) => head(i, n, tight),
      body: (id, target) => body(items.find((v) => v.key === id), target),
      innerClass: 'h-full w-full', slidePad: 'p-0',
      onPick: (id) => { const i = items.findIndex((v) => v.key === id); if (i >= 0 && i !== at) { at = i; notes.paint(); o.onPick?.(i); } },
      deck,
    });
    notes.paint();
    // The full page reads every file at once: its list shows every pin.
    Promise.all(m.views.map((v) => resolve(m, v).then(() => { if (!gone) repaint(); }))).then(() => { if (!gone) notes.sent(); });

    return { count: items.length, turn: m.turn, destroy() { gone = true; swiper?.destroy?.(); el.replaceChildren(); } };
  }

  window.TurnView = { card, mount, files };
})();
