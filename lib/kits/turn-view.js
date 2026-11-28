// turn-view.js — the pages and documents one turn of a session changed, each
// rendered as its reader would see it, with a note bar whose notes go to the
// estate's notes store. One view, two hosts:
//
//   compact  inside a card of session.html's Turns tab, under the discussion:
//            the files as rows over one frame, the row tapped choosing the
//            frame, and a door to the full page. A strip of its own would
//            sit inside the Turns tab's strip, two horizontal swipes nested.
//   full     pages/turn.html: the files over a strip of cards
//            (kits/linked-swiper.js), with the swipe deck's takeover.
//
// What a turn changed is kits/turn-views.js's answer, from the record alone.
// The commit each file stood at when the turn ended is GitHub's: one commits
// read per file, made when the view first comes into sight, so a session's
// dozens of turns cost nothing until a reader reaches one. A file not
// committed by the turn's end shows its branch as it is now ("now"); one at
// neither its branch nor main says so in place of a frame.
//
// Notes: drafted in this browser per session and turn (both hosts share the
// drafts), sent through kits/notes.js, one note per draft, about
// owner/repo@branch:path, its text naming the session, the turn and the card.
//
// Framework-free. Needs window.esc (lib/vanilla-bundle.js), TurnViews,
// RepoAddress, GuideRender, and for full mode linkedSwiper and swipeDeck;
// kits/notes.js and gh-store.js load on the first Send.
//
//   TurnView.mount(el, { record, path, n, store?, mode?, start?, onPick?, expand? })
//     -> { count, destroy() } or null when the turn changed no page or document
//   record, path  the session record and its store path
//   n             the turn, 1-based, as TurnViews numbers it
//   mode          'compact' (default) or 'full'
//   start         the card to open on, 0-based
//   onPick(i)     the card in view moved
//   expand(i)     compact: the door's address for card i (default turn.html)
(() => {
  const SITE = 'https://mehrlander.github.io/web-tools/';
  const STORE = 'mehrlander/web-tools-private';
  const esc = (s) => window.esc(s);
  const ROW = 'flex cursor-pointer items-center gap-2 border-b border-base-200 px-3 py-1.5 last:border-0 hover:bg-base-200/60 aria-selected:bg-primary/10';

  const unpinned = (v) => v.pin === 'head' || v.pin === 'main';
  const tail = (p) => p.split('/').slice(-2).join('/');

  // ── The commit each file stood at ─────────────────────────────────────
  const CONF = new Map();
  function conf(g, slug) {
    if (!CONF.has(slug)) CONF.set(slug, g.get('.web-tools.json').then((r) => JSON.parse(r.text)).catch(() => null));
    return CONF.get(slug);
  }
  async function resolve(m, v) {
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
    return m;
  }

  // ── The view ──────────────────────────────────────────────────────────
  function mount(el, o = {}) {
    const m = model(o);
    if (!m || !m.views.length) return null;
    const full = o.mode === 'full';
    let at = Math.max(0, Math.min(m.views.length - 1, o.start || 0));
    let drafts = [], sent = [], typing = '', sending = false, status = '', swiper = null, seen = null, gone = false;
    try { drafts = JSON.parse(localStorage.getItem(m.key) || '[]'); } catch { drafts = []; }

    const aboutOf = (v) => m.owner + '/' + v.repo + (v.branch ? '@' + v.branch : '') + ':' + v.path;
    const where = (v) => 'Written on turn ' + m.turn.n + ' of session ' + m.short + ' (' + m.store + ':' + m.path + ')'
      + ', card ' + (m.views.indexOf(v) + 1) + ' of ' + m.views.length + (v.pin ? ', at ' + v.pin : '') + '.';
    const expandTo = (i) => (o.expand ? o.expand(i) : SITE + 'pages/turn.html#id=' + m.short + '&turn=' + m.turn.n + '&card=' + i);

    el.replaceChildren();
    el.setAttribute('data-turn-view', full ? 'full' : 'compact');
    const box = document.createElement('div');
    box.className = full ? 'flex min-h-0 grow flex-col' : 'flex flex-col gap-2 border-t border-base-300 pt-3';
    el.append(box);

    // The compact view's head: what this is, how many, and the door.
    if (!full) {
      const h = document.createElement('div');
      h.className = 'flex items-center gap-2';
      h.innerHTML = '<i class="ph ph-browsers text-base text-base-content/50"></i>'
        + '<span class="text-sm font-semibold">Changed in this turn</span>'
        + '<span class="font-mono text-xs tabular-nums text-base-content/50">' + m.views.length + '</span>'
        + (m.turn.other.length ? '<span class="text-xs text-base-content/50">+' + m.turn.other.length + ' other</span>' : '')
        + '<a data-turn-expand class="btn btn-xs btn-ghost ml-auto gap-1 font-normal hover:text-primary" aria-label="Open this turn full screen">'
        + '<i class="ph ph-arrows-out"></i>Full</a>';
      box.append(h);
    }

    const root = document.createElement('div'), list = document.createElement('div'), card = document.createElement('div');
    root.className = full ? 'min-h-0 grow px-2 pt-2' : 'flex flex-col gap-2';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Pages and documents this turn changed');
    list.dataset.at = 'files';
    card.dataset.at = 'card';
    if (!full) {
      list.className = 'rounded-lg border border-base-300 bg-base-100';
      card.className = 'flex h-[min(70dvh,40rem)] flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100';
    }
    root.append(list, card);
    box.append(root);

    const bar = document.createElement('div');
    bar.dataset.at = 'composer';
    bar.className = full ? 'shrink-0 border-t border-base-300 px-3 py-2 flex flex-col gap-1.5' : 'flex flex-col gap-1.5';
    box.append(bar);

    function rows() {
      return m.views.map((v, i) => {
        const n = drafts.filter((d) => d.key === v.key).length;
        const dir = v.path.includes('/') ? v.path.slice(0, v.path.lastIndexOf('/') + 1) : '';
        return '<div data-view="' + esc(v.key) + '" role="option" tabindex="-1" aria-selected="' + (i === at) + '" class="' + ROW + '">'
          + '<i class="ph ' + (v.kind === 'page' ? 'ph-browser' : 'ph-file-text') + ' shrink-0 text-base text-base-content/50"></i>'
          + '<span class="min-w-0 flex-1 truncate text-sm"><span class="text-base-content/50">' + esc(dir) + '</span>' + esc(v.name) + '</span>'
          + (n ? '<span class="badge badge-info badge-sm shrink-0 gap-1"><i class="ph ph-chat-circle-text"></i>' + n + '</span>' : '')
          + (unpinned(v) ? '<span class="shrink-0 font-mono text-xs text-warning">now</span>' : '')
          + '</div>';
      }).join('');
    }
    const link = (href, icon, tip) => href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener" class="btn btn-xs btn-ghost btn-square"'
      + ' data-title-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '"><i class="ph ' + icon + ' text-base"></i></a>' : '';
    const gh = (v) => window.RepoAddress.github.blob(m.owner + '/' + v.repo, v.ref || v.branch || 'main', v.path);
    function head(i, n, tight) {
      const v = m.views[i];
      if (!v) return '';
      return window.linkedSwiper.head({ code: unpinned(v) ? 'now' : v.pin, title: tail(v.path) }, i, n, 'card', { deck: true, tight })
        + link(gh(v), 'ph-github-logo', 'On GitHub') + link(v.url, 'ph-arrow-square-out', 'Open in a new tab');
    }
    function body(v, target) {
      if (!v) return;
      if (v.missing) {
        target.innerHTML = '<div class="flex flex-col gap-1 px-4 py-6 text-base" data-at="missing"><span class="font-semibold">Not at ' + esc(v.ref) + '</span>'
          + '<span class="font-mono text-sm text-base-content/60">' + esc(m.owner + '/' + v.repo + ':' + v.path) + '</span></div>';
        return;
      }
      if (!v.url) {
        target.innerHTML = '<div class="flex h-full items-start justify-center pt-12"><span class="loading loading-dots loading-md opacity-40"></span></div>';
        return;
      }
      const f = document.createElement('iframe');
      f.src = v.url;
      f.className = 'block h-full w-full border-0 bg-base-100';
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
      f.setAttribute('aria-label', v.path);
      target.replaceChildren(f);
    }

    // Compact: rows over one frame, with a head row naming the file.
    function paintCompact() {
      list.innerHTML = rows();
      const v = m.views[at];
      card.innerHTML = '<div class="flex flex-none items-center gap-1 border-b border-base-200 py-1 pl-3.5 pr-1.5">'
        + '<span class="mr-1 font-mono text-xs text-base-content/60">' + esc(unpinned(v) ? 'now' : v.pin || '…') + '</span>'
        + '<span class="min-w-0 flex-1 truncate text-base font-bold">' + esc(tail(v.path)) + '</span>'
        + link(gh(v), 'ph-github-logo', 'On GitHub') + link(v.url, 'ph-arrow-square-out', 'Open in a new tab') + '</div>'
        + '<div data-frame class="min-h-0 flex-auto"></div>';
      body(v, card.querySelector('[data-frame]'));
    }
    function pick(i) {
      if (i === at || i < 0 || i >= m.views.length) return;
      at = i;
      if (full) swiper?.show(m.views[i].key); else paintCompact();
      paintBar();
      o.onPick?.(i);
    }
    list.addEventListener('click', (e) => {
      if (full) return;   // linked-swiper picks in full mode
      const r = e.target.closest('[data-view]');
      if (r) pick(m.views.findIndex((v) => v.key === r.getAttribute('data-view')));
    });
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-turn-expand]')) { e.preventDefault(); location.assign(expandTo(at)); }
    });

    function deck() {
      if (!window.swipeDeck) return;
      const L = m.views;
      let h = null;
      h = window.swipeDeck.open({
        count: L.length, start: at, innerClass: 'h-full w-full min-w-0',
        index: (i) => ({ title: tail(L[i].path), subtitle: L[i].pin, icon: L[i].kind === 'page' ? 'ph-browser' : 'ph-file-text' }),
        icon: 'ph-cards-three', title: L[at].name, subtitle: 'turn ' + m.turn.n + ' · ' + m.short,
        onSlide: (i) => { h?.setTitle?.(L[i].name); at = i; swiper?.show(L[i].key); paintBar(); o.onPick?.(i); },
        render: (i, slide) => body(L[i], slide),
      });
    }
    function paintList() {
      if (full) {
        list.innerHTML = rows();
        swiper?.mount();
        window.linkedSwiper?.mark(list, 'view', m.views[at]?.key);
      } else paintCompact();
    }

    // The note bar, drawn again on every change: a few rows and a field.
    function paintBar() {
      const v = m.views[at];
      const mine = drafts.filter((d) => d.key === v.key);
      const told = sent.filter((s) => s.about === aboutOf(v));
      const field = bar.querySelector('[data-draft]');
      const had = field && document.activeElement === field;
      bar.innerHTML = ((mine.length || told.length) ? '<div class="flex max-h-24 flex-col gap-1.5 overflow-y-auto">'
          + mine.map((d) => '<div class="flex items-start gap-2 rounded-lg bg-info/10 py-1 pl-2 pr-1 text-base">'
            + '<i class="ph ph-chat-circle-text mt-1 opacity-60"></i><span class="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">' + esc(d.text) + '</span>'
            + '<button type="button" class="btn btn-ghost btn-xs btn-square" data-drop="' + esc(d.id) + '" aria-label="Remove this note"><i class="ph ph-x"></i></button></div>').join('')
          + told.map((s) => '<div class="flex items-start gap-2 rounded-lg bg-success/10 py-1 px-2 text-base">'
            + '<i class="ph ph-check-circle mt-1 text-success"></i><span class="min-w-0 flex-1 line-clamp-2 [overflow-wrap:anywhere]">' + esc(String(s.text).split('\n\n')[0]) + '</span>'
            + '<span class="shrink-0 font-mono text-xs text-base-content/50">' + esc(String(s.at).slice(5, 10)) + '</span></div>').join('')
          + '</div>' : '')
        + '<div class="flex items-center gap-2">'
        + '<input data-draft type="text" class="input input-sm input-bordered min-w-0 flex-1 text-base" aria-label="A note on the card in view" placeholder="' + esc('Note on ' + v.name) + '">'
        + '<button type="button" data-add class="btn btn-sm btn-square ' + (typing.trim() ? 'btn-success' : 'btn-ghost opacity-40') + '" aria-label="Add the note"><i class="ph ph-check"></i></button>'
        + '<button type="button" data-send class="btn btn-sm btn-primary min-w-20 tabular-nums"' + (sending || !drafts.length ? ' disabled' : '') + '>'
        + (sending ? '<span class="loading loading-spinner loading-xs"></span>' : '') + (drafts.length ? 'Send ' + drafts.length : 'Send') + '</button></div>'
        + (status ? '<div class="text-xs text-base-content/70" role="status">' + esc(status) + '</div>' : '');
      const f = bar.querySelector('[data-draft]');
      f.value = typing;
      if (had) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }
    const keep = () => {
      try { localStorage.setItem(m.key, JSON.stringify(drafts)); status = ''; }
      catch { status = 'This browser would not keep the note; Send before leaving.'; }
      paintList(); paintBar();
    };
    function add() {
      const text = typing.trim(), v = m.views[at];
      if (!text) { bar.querySelector('[data-draft]')?.focus(); return; }
      drafts = [...drafts, { id: 'd' + Date.now().toString(36), key: v.key, text, at: new Date().toISOString() }];
      typing = '';
      keep();
      bar.querySelector('[data-draft]')?.focus();
    }
    async function send() {
      if (sending || !drafts.length) return;
      sending = true; status = 'Sending…'; paintBar();
      try {
        const reg = await registry();
        const author = await window.Notes.author(reg);
        const list2 = drafts.slice();
        const notes = list2.map((d) => {
          const v = m.views.find((x) => x.key === d.key);
          return window.Notes.make({ about: aboutOf(v), author, text: d.text + '\n\n' + where(v) });
        });
        const all = await window.Notes.append(reg, notes);
        const ids = new Set(notes.map((n) => n.id));
        sent = [...sent, ...all.filter((n) => ids.has(n.id))];
        drafts = drafts.filter((d) => !list2.some((x) => x.id === d.id));
        status = 'Sent ' + list2.length + ' note' + (list2.length === 1 ? '' : 's') + '.';
        SENT = Promise.resolve(all);
      } catch (e) {
        status = 'Not sent: ' + (e?.message || String(e));
      }
      sending = false;
      keep();
    }
    bar.addEventListener('input', (e) => {
      if (!e.target.matches('[data-draft]')) return;
      const had = !!typing.trim();
      typing = e.target.value;
      if (had !== !!typing.trim()) {
        const b = bar.querySelector('[data-add]');
        b.className = 'btn btn-sm btn-square ' + (typing.trim() ? 'btn-success' : 'btn-ghost opacity-40');
      }
    });
    // A key typed here stays here: the strips around this view take arrows.
    bar.addEventListener('keydown', (e) => {
      if (!e.target.matches('[data-draft]')) return;
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); add(); }
    });
    bar.addEventListener('click', (e) => {
      const d = e.target.closest('[data-drop]');
      if (d) { drafts = drafts.filter((x) => x.id !== d.getAttribute('data-drop')); keep(); return; }
      if (e.target.closest('[data-add]')) add();
      else if (e.target.closest('[data-send]')) send();
    });

    // Drawn now; read when first in sight.
    if (full && window.linkedSwiper) {
      list.innerHTML = rows();
      swiper = window.linkedSwiper.attach({
        root, list, card, key: 'view', noun: 'card', listMax: 'max-h-[22vh]',
        ids: () => m.views.map((v) => v.key),
        sel: () => m.views[at]?.key,
        head: ({ i, n, tight }) => head(i, n, tight),
        body: (id, target) => body(m.views.find((v) => v.key === id), target),
        innerClass: 'h-full w-full', slidePad: 'p-0',
        onPick: (id) => { const i = m.views.findIndex((v) => v.key === id); if (i >= 0 && i !== at) { at = i; paintBar(); o.onPick?.(i); } },
        deck,
      });
    } else paintCompact();
    paintBar();

    const read = async () => {
      await Promise.all(m.views.map(async (v) => {
        await resolve(m, v).catch(() => { v.ref = v.branch || 'main'; v.pin = 'head'; });
        if (gone) return;
        if (full) { list.innerHTML = rows(); swiper?.mount(); window.linkedSwiper?.mark(list, 'view', m.views[at]?.key); }
        else paintCompact();
      }));
      if (gone) return;
      sent = (await loadSent()).filter((n) => String(n.text).includes('turn ' + m.turn.n + ' of session ' + m.short + ' '));
      if (!gone) paintBar();
    };
    if (full || typeof IntersectionObserver !== 'function') read();
    else {
      seen = new IntersectionObserver((es) => {
        if (!es.some((x) => x.isIntersecting)) return;
        seen.disconnect(); seen = null;
        read();
      });
      seen.observe(el);
    }

    return {
      count: m.views.length, turn: m.turn,
      destroy() { gone = true; seen?.disconnect(); swiper?.destroy?.(); el.replaceChildren(); },
    };
  }

  window.TurnView = { mount };
})();
