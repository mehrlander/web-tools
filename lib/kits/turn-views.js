// turn-views.js — one turn of a session record: its window, its ask, its close,
// and the pages and documents it changed.
//
// The per-turn half of what session-brief's Views tab does per session. That
// tab asks GitHub what a branch changed against main; a turn has no such
// question to ask, so this reads the record alone. Every row a record keeps
// carries `at`, so a turn is a window of time, and the files it changed are
// the file-tool calls inside that window: Edit, Write and NotebookEdit by
// their path, and a Bash command by the files the harness says it changed
// (`bashEditDiff`, kept on the call's harness_result since record schema 16).
// An agent's calls count too, by their own `at`.
//
// THE TURN IS THE TURNS TAB'S. sessionRender.groups(sessionRender.turns(r))
// is the list of cards session-brief draws, one per ask, and turn n here is
// card n - 1 there, the one the tab labels "Exchange n". The window runs from
// that card's first row to the next card's first row, or to the record's end.
//
// WHAT THIS CANNOT KNOW, stated rather than guessed:
//   • The ref a file stood at when the turn ended. The record keeps each
//     checkout's branch and head at the LAST Stop only (`repos`), and the
//     branches it pushed with a time (`pushed`). branchAt() picks the branch
//     by the first push at or after the window opened; the host asks GitHub
//     for the commit (commits?path&until) and says so when it falls back.
//   • A file changed by a git command (commit, merge, checkout and the like).
//     Its bashEditDiff is the commit hook's regenerated catalogs or a merge's
//     incoming files, not the turn's own authoring, so it is left out and
//     counted in `skipped.git`.
//
// Pure: plain objects in, plain objects out, no DOM, no network. Needs
// window.sessionRender for the card boundaries.
//
//   TurnViews.count(record)            -> the number of turns
//   TurnViews.at(record, iso, slack)   -> the turn holding that instant, or 0
//   TurnViews.before(record, iso)      -> the record's last Stop predates it
//   TurnViews.of(record, n)            -> { n, total, from, to, ask, origin,
//                                           reply, closing, files, skipped }
//   TurnViews.kindOf(path, authored)   -> 'page' | 'doc' | ''
//   TurnViews.split(key, repos)        -> { repo, path } from a record path
//   TurnViews.branchAt(record, repo, from) -> the branch, or ''
//   TurnViews.peers(record)            -> inbound messages from other sessions,
//                                         as turn rows ({ role: 'peer', dir, at, md, peer })
//   TurnViews.spawnOf(ask)             -> { peer, short } for a spawn prompt, or null
//   TurnViews.isSend(call)             -> a send_message call (an outbound message)
//
// `of` also gives `usage` ({ start, end, out, responses }: the context at the
// turn's first and last response, and the tokens it wrote; null where the
// record keeps no responses), `compactions` and `peers` (counts), and for
// turn 1 `spawn`.
//
// A file is { key, repo, path, kind, tool, edits, agents, first, last,
// branch }, pages first, then documents, each newest edit first. `files`
// holds those with a kind and `other` the rest, so a host can count them.
(() => {
  const PAGE = /\.html?$/i;
  const DOC = /\.(md|markdown)$/i;
  const DATA = /\.(csv|tsv|json|jsonl)$/i;
  const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
  const GIT = /\bgit\s+(?:-C\s+\S+\s+)?(?:commit|merge|pull|rebase|checkout|switch|reset|stash|cherry-pick|am|restore|revert)\b/;
  // What no reader opens as a page or a document: the pre-build, the
  // dependency tree, and the scratchpad.
  const NOISE = /^(?:dist\/|node_modules\/)|(?:^|\/)scratchpad\//;

  // A data file is a document only when a file tool wrote it: the commit
  // hook and the repo's scripts rewrite catalogs by the dozen (23 CSVs in
  // one turn of 2026-11-26-c145e062), and a card for each buries the pages.
  const SLACK = 15000;

  const kindOf = (path, authored = true) => PAGE.test(path) ? 'page'
    : DOC.test(path) || (authored && DATA.test(path)) ? 'doc' : '';

  // An instant a row really has. session-render stamps what it adds after
  // the conversation with a run of U+FFFF so it sorts last: the closing
  // summary card is '\uffff\uffff', a schema-1 final message '\uffff'.
  const real = (at) => !!at && !String(at).startsWith('\uffff');
  const firstAt = (c) => (c.find((t) => real(t.at)) || {}).at || '';

  // The Turns tab's cards, less any with no real instant: the closing summary
  // ("What this session touched") is a card there and is no turn. It comes
  // last, so the numbering of the turns before it is the tab's.
  // Memoized per record, since a session's Turns list asks for every turn.
  const CARDS = new WeakMap();
  function cards(record) {
    const sr = window.sessionRender;
    if (!sr || !record || typeof record !== 'object') return [];
    if (!CARDS.has(record)) CARDS.set(record, sr.groups(sr.turns(record)).filter((c) => firstAt(c)));
    return CARDS.get(record);
  }

  // ── Messages between sessions ─────────────────────────────────────────
  // Inbound: a relayed row from another Claude session (record `relayed`,
  // with `from_session`). Outbound: a send_message call. A spawn prompt is a
  // session's first ask when it came from no person (origin set) and is not
  // a harness envelope; its sender is the session it names, if it names one.
  const SEND = /(?:^|__)send_message$/;
  const isSend = (c) => SEND.test(String(c?.name || ''));
  function peers(record) {
    const out = [];
    for (const x of record?.relayed || []) {
      if (!/Claude session/i.test(String(x?.origin || '')) || !x.at) continue;
      out.push({ role: 'peer', dir: 'in', at: x.at, ts: String(x.at).slice(11, 19), md: String(x.text || ''), peer: String(x.from_session || '') });
    }
    return out;
  }
  function spawnOf(t) {
    if (!t || !t.origin || /^\s*</.test(t.md || '')) return null;
    const md = String(t.md || '');
    const id = (md.match(/session_[A-Za-z0-9]{16,}/) || [])[0] || '';
    const short = (md.match(/\bshort ([0-9a-f]{8})\b/) || md.match(/\(([0-9a-f]{8})\)/) || [])[1] || '';
    return { peer: id, short };
  }

  // ── Usage ──────────────────────────────────────────────────────────────
  // A response's context: everything it read, cached or not.
  const ctxOf = (u) => (u ? (+u.input_tokens || 0) + (+u.cache_read_input_tokens || 0) + (+u.cache_creation_input_tokens || 0) : 0);
  function usage(record, from, to) {
    const rs = (record?.responses || []).filter((r) => r?.at && r.at >= from && (!to || r.at < to) && r.usage);
    if (!rs.length) return null;
    const start = ctxOf(rs[0].usage), end = ctxOf(rs[rs.length - 1].usage);
    const out = rs.reduce((s, r) => s + (+r.usage.output_tokens || 0), 0);
    return start || end ? { start, end, out, responses: rs.length } : null;
  }

  const count = (record) => cards(record).length;

  // The turn whose window holds an instant, or 0. A reply cannot know its own
  // turn's number when it prints a link to it, but it knows when its ask
  // arrived, so a link may name the turn by that instant.
  //
  // SLACK, because the instant a caption hook stamps on an ask it is
  // submitting is its own clock, read before the harness writes the ask with
  // its timestamp: a turn opening up to `slack` ms after the instant still
  // holds it.
  function at(record, iso, slack = SLACK) {
    const ms = Date.parse(String(iso || ''));
    if (!Number.isFinite(ms)) return 0;
    const list = cards(record);
    let n = 0;
    list.forEach((c, i) => { if (Date.parse(firstAt(c)) <= ms + slack) n = i + 1; });
    return n;
  }

  // Whether the record was written before an instant: its last Stop
  // (`ended`) predates the ask, so the turn holding it is not in it yet.
  function before(record, iso) {
    const ms = Date.parse(String(iso || '')), end = Date.parse(record?.ended || '');
    return Number.isFinite(ms) && Number.isFinite(end) && end < ms;
  }

  // `/home/user/web-tools/pages/x.html` and the record's own
  // `web-tools/pages/x.html` both read as { repo: 'web-tools', path:
  // 'pages/x.html' }. A path whose first segment names no checkout the
  // record knows is outside every repo, and comes back with repo ''.
  function split(key, repos) {
    let s = String(key || '').replace(/^\/home\/user\//, '');
    const names = repos instanceof Set ? repos : new Set(repos || []);
    const cut = s.indexOf('/');
    if (cut > 0 && names.has(s.slice(0, cut))) return { repo: s.slice(0, cut), path: s.slice(cut + 1) };
    return { repo: '', path: s };
  }

  function repoNames(record) {
    const out = new Set();
    for (const r of [...(record?.repos || []), ...(record?.pushed || [])]) if (r?.name) out.add(r.name);
    for (const a of record?.attached || []) if (typeof a === 'string') out.add(a);
    return out;
  }

  // The branch a repo was on during a turn: the first push of that repo at
  // or after the window opened (a branch is pushed after the work on it),
  // else the checkout's branch at the last Stop. main and HEAD say nothing.
  function branchAt(record, repo, from) {
    const real = (b) => b && !/^(main|master|HEAD)$/.test(b);
    const pushes = (record?.pushed || []).filter((p) => p?.name === repo && real(p.branch))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const next = pushes.find((p) => String(p.at) >= String(from || ''));
    if (next) return next.branch;
    const r = (record?.repos || []).find((x) => x?.name === repo);
    if (r && real(r.branch)) return r.branch;
    return pushes.length ? pushes[pushes.length - 1].branch : '';
  }

  // Every file-changing call in the record, the session's and its agents'.
  function changes(record) {
    const out = [];
    const take = (c, agent) => {
      if (!c || !c.at) return;
      if (FILE_TOOLS.has(c.name)) {
        const p = c.input?.file_path || c.input?.notebook_path || c.arg;
        if (typeof p === 'string' && p) out.push({ at: c.at, path: p, agent, tool: true });
        return;
      }
      if (c.name !== 'Bash') return;
      const files = c.harness_result?.bashEditDiff?.files;
      if (!Array.isArray(files) || !files.length) return;
      const git = GIT.test(String(c.input?.command || c.arg || ''));
      for (const f of files) {
        if (f && typeof f.filePath === 'string') out.push({ at: c.at, path: f.filePath, agent, git });
      }
    };
    for (const c of record?.calls || []) take(c, '');
    for (const a of record?.agents || []) for (const c of a?.calls || []) take(c, a.id || 'agent');
    return out;
  }

  function of(record, n) {
    const list = cards(record);
    const total = list.length;
    const k = Math.trunc(Number(n)) - 1;
    if (!(k >= 0 && k < total)) return null;
    const card = list[k];
    const from = firstAt(card);
    const to = k + 1 < total ? firstAt(list[k + 1]) : '';
    const ask = card.find((t) => t.role === 'user') || null;
    const replies = card.filter((t) => t.role === 'assistant' && t.md);
    const reply = replies.length ? replies[replies.length - 1] : null;
    const cs = window.ClosingState;
    let closing = null;
    for (let i = replies.length - 1; i >= 0 && !closing; i--) {
      const c = cs?.closings ? cs.closings(replies[i].md) : [];
      if (c.length) closing = { ...c[c.length - 1], at: replies[i].at };
    }

    const names = repoNames(record);
    const inside = (at) => at >= from && (!to || at < to);
    const byKey = new Map();
    const skipped = { git: 0, outside: 0, other: 0 };
    for (const ch of changes(record)) {
      if (!inside(ch.at)) continue;
      const { repo, path } = split(ch.path, names);
      if (!repo || NOISE.test(path)) { skipped.outside++; continue; }
      if (ch.git) { skipped.git++; continue; }
      const key = repo + ':' + path;
      let f = byKey.get(key);
      if (!f) {
        f = { key, repo, path, kind: '', tool: false, edits: 0, first: ch.at, last: ch.at, agents: 0,
              branch: branchAt(record, repo, from) };
        byKey.set(key, f);
      }
      f.edits++;
      if (ch.tool) f.tool = true;
      if (ch.agent) f.agents++;
      if (ch.at < f.first) f.first = ch.at;
      if (ch.at > f.last) f.last = ch.at;
    }
    const all = [...byKey.values()];
    for (const f of all) f.kind = kindOf(f.path, f.tool);
    const shown = all.filter((f) => f.kind);
    skipped.other = all.length - shown.length;
    const rank = { page: 0, doc: 1 };
    shown.sort((a, b) => rank[a.kind] - rank[b.kind] || String(b.last).localeCompare(String(a.last)));
    return {
      n: k + 1, total, from, to,
      ask: ask ? ask.md : '', origin: ask?.origin || '',
      reply: reply ? reply.md : '', closing,
      files: shown, other: all.filter((f) => !f.kind), skipped,
      usage: usage(record, from, to),
      compactions: card.filter((t) => t.role === 'compaction').length,
      peers: peers(record).filter((p) => inside(p.at)).length
        + (record?.calls || []).filter((c) => isSend(c) && c.at && inside(c.at)).length,
      spawn: k === 0 ? spawnOf(ask) : null,
    };
  }

  window.TurnViews = { count, at, before, of, kindOf, split, branchAt, peers, spawnOf, isSend };
})();
