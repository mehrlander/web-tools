// session-menu.js — the Claude menu the phone draws after a double back tap:
// whether the clipboard holds a branch this estate recognises, which session
// that branch is, and what else is recent, as one caption and one row list.
//
// An op: one function expression, no page assumed. The phone fetches this file
// and evaluates it inside a data: page that Shortcuts coerces to text (Run-Op,
// in shortcut-tools), so the whole file must be a value, and the value must be
// a function of one serialisable argument returning one serialisable result.
// Nothing here may reach window or document; lib/ops/README.md is the contract
// and tools/test/code-layers.test.mjs holds it.
//
//   input   { input: <clipboard text>, token: <GitHub token> }
//   result  { caption, rows, urls, menu, branch, id, state }
//
//   caption  two lines, in Describe-Input's register: a centred rule naming
//            what the clipboard produced, then a line of specifics. The empty
//            clipboard has no specifics and is one line.
//   rows     the session rows alone, newest first, each carrying the glyph its
//            header carries so the header doubles as the legend.
//   urls     row label -> the page it opens. Every row that opens a page is in
//            here; a row that is not is a shortcut name for the caller to run.
//   menu     rows plus VERBS, which is the whole Claude menu. It is never
//            empty, an ERROR result included, so a caller can draw the menu
//            without testing anything first.
//   state    'on-branch' | 'no-session' | 'no-branch' | 'empty' | 'error'
//
// THE MENU LIVES HERE, NOT ON THE PHONE. Choose-Claude is a shell: call the op,
// draw `menu`, look the chosen row up in `urls` and either open it or run it by
// name. So a change to the menu's wording, order or verbs is a commit to this
// file, and costs no install. That is the point: shortcut-tools' CLAUDE.md
// ranks the device as the expensive resource, and a menu that can only be
// edited by re-importing a shortcut spends it on every revision.
//
// ONE BRANCH IS ONE SESSION, which is why nothing here counts them. Measured
// over the 341 rows on file 2026-09-08: 331 distinct `claude/…` branches, 331
// sessions, not one branch with two. The harness mints a fresh branch per
// session, so the only name that repeats is `main` (48 rows), which `branchOf`
// rejects anyway for having no slash. The question a header can usefully answer
// is therefore recognition and age, never "how many".
//
// SYNCHRONOUS ON PURPOSE. The coercion that runs this captures the document at
// a moment nobody has documented, and a promise resolving after that returns
// empty with no error. So the index is read with a blocking XMLHttpRequest, the
// one shape known to complete before the capture (pages/gh-recent-branches.html
// in shortcut-tools measured this first).
(function sessionMenu(input) {
  var STORE = 'mehrlander/web-tools-private';
  var INDEX = 'state/session-menu.json';
  var PAGE = 'https://mehrlander.github.io/web-tools/pages/session.html#id=';
  var LOOKUP = 'https://mehrlander.github.io/web-tools/pages/session.html#branch=';
  var ESTATE = 'https://mehrlander.github.io/web-tools/app/?view=sessions';
  var ROWS = 12;                          // session rows in `rows`, at most
  var VERBS = ['Show-Loop', 'Out'];       // the menu's fixed tail, in order

  input = input || {};
  var token = String(input.token || '');
  var clip = String(input.input || input.branch || '');
  var branch = branchOf(clip);

  // ── What the clipboard is ────────────────────────────────────────────────
  //
  // What the Claude app puts on the clipboard has varied, so a full ref, a URL
  // carrying one, or the bare name all reduce to the name. Only the first line
  // counts: a clipboard can hold a caption whose first line is the branch.
  //
  // A URL IS NOT A BRANCH, and saying so takes a second test. The rule was
  // "has a slash, has no whitespace", which every http address also passes, so
  // pasting any page and tapping produced `none yet on https://…/index.html`:
  // a fact about the cache wearing the clothes of a fact about a branch that
  // never existed, and 54 characters of it in the header (2026-09-08). An
  // address that CARRIED a branch has already been cut back to the branch by
  // then, so the test only has to reject what is still an address: a scheme,
  // or a first segment with a dot in it, which is what a hostname always has
  // and a branch name effectively never does.
  function branchOf(text) {
    var s = String(text || '').trim().split(/\r?\n/)[0].trim();
    var carried = /(?:tree\/|compare\/|branch\.html#gh=[^@]+@|branch=)/.test(s);
    s = s.replace(/^.*?(?:tree\/|compare\/|branch\.html#gh=[^@]+@|branch=)/, '')
         .replace(/^origin\//, '').replace(/^refs\/heads\//, '')
         .replace(/[?#&].*$/, '').replace(/\/$/, '');
    if (!carried && (/:\/\//.test(s) || /^[^/]*\.[^/]*\//.test(s))) return '';
    return /\//.test(s) && !/\s/.test(s) ? s : '';
  }

  // The stored token may or may not carry its scheme; accept either.
  function auth(t) { return /^(Bearer|token) /i.test(t) ? t : 'Bearer ' + t; }

  // ── The two alphabets, and which says what ───────────────────────────────
  //
  // Mathematical sans-serif BOLD for a value inside a line: an age, a slug.
  // Mathematical sans-serif BOLD ITALIC, lowercased, for the first line's own
  // words. That split is the register Describe-Input sets a clipboard caption
  // in, so the two back-tap menus read as siblings. Letters and digits only;
  // anything else passes through.
  function bold(str) {
    return String(str).replace(/[A-Za-z0-9]/g, function (ch) {
      var c = ch.charCodeAt(0), base;
      if (c >= 65 && c <= 90) base = 0x1D5D4 - 65;
      else if (c >= 97 && c <= 122) base = 0x1D5EE - 97;
      else base = 0x1D7EC - 48;
      return String.fromCodePoint(base + c);
    });
  }
  function italic(str) {
    return String(str).toLowerCase().replace(/[a-z]/g, function (ch) {
      return String.fromCodePoint(0x1D656 + ch.charCodeAt(0) - 97);
    });
  }
  // NO PADDING, AND THE REASON IS THE ONLY REASON THAT MATTERS: iOS draws this
  // prompt in a proportional font, so a count of leading spaces says nothing
  // about how far the line moves. Describe-Input pads to a 68-column field and
  // this copied it; on the phone (2026-09-08) the first line landed indented
  // past centre while the line under it sat flush left, which is what padding
  // does when a space is narrower than a letter.
  //
  // Left-aligned is also the ROBUST choice, not merely the corrected one: an
  // unpadded line reads correctly whether the host centres the prompt or
  // left-aligns it, and padding is wrong under both. The `- … -` marks went
  // with the padding, since a rule drawn around text that is not centred is a
  // frame around nothing.
  function rule(glyph, words) {
    return glyph + ' ' + italic(words);
  }

  // The two kinds of session row share a glyph with the header that introduces
  // them, so the header is also the legend.
  var HERE = '🌿';    // 🌿 the clipboard's branch
  var RECENT = '🕘';  // 🕘 recent, any branch
  var CLIP = '📋';    // 📋 the clipboard held no branch
  var WARN = '⚠️';    // ⚠️ the index could not be read

  // Where the op is when something throws, so an error result names the step
  // rather than only the engine's message. JavaScriptCore's bare "Type error"
  // on 2026-09-03 said nothing about which of these it came from.
  var stage = 'start';

  function readIndex() {
    stage = 'open';
    var x = new XMLHttpRequest();
    x.open('GET', 'https://api.github.com/repos/' + STORE + '/contents/' + INDEX + '?ref=main', false);
    stage = 'headers';
    x.setRequestHeader('Authorization', auth(token));
    // Raw, not the contents envelope, which base64s the body.
    x.setRequestHeader('Accept', 'application/vnd.github.raw');
    stage = 'send';
    x.send();
    stage = 'status ' + x.status;
    if (x.status !== 200) throw new Error('HTTP ' + x.status + ' reading ' + INDEX);
    stage = 'parse';
    return JSON.parse(x.responseText);
  }

  // On failure, three cheap requests that between them say whether the runner
  // can reach the API at all, whether a header breaks it, and whether it is the
  // preflight that a non-simple header forces. Each reports a status or the
  // error's name; none can throw out of here.
  function probe() {
    var url = 'https://api.github.com/repos/' + STORE + '/contents/' + INDEX + '?ref=main';
    var tries = [
      ['zen plain', 'https://api.github.com/zen', {}],
      ['zen auth', 'https://api.github.com/zen', { Authorization: auth(token) }],
      ['index auth only', url, { Authorization: auth(token) }],
    ];
    var out = {};
    tries.forEach(function (t) {
      try {
        var x = new XMLHttpRequest();
        x.open('GET', t[1], false);
        Object.keys(t[2]).forEach(function (k) { x.setRequestHeader(k, t[2][k]); });
        x.send();
        out[t[0]] = 'status ' + x.status;
      } catch (e) { out[t[0]] = (e && e.name || 'Error') + ': ' + (e && e.message || ''); }
    });
    return out;
  }

  function ago(iso) {
    var mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!isFinite(mins)) return '';
    if (mins < 60) return mins + 'm';
    if (mins < 1440) return Math.round(mins / 60) + 'h';
    return Math.round(mins / 1440) + 'd';
  }
  // The title names the branch by its slug: `claude/` says nothing a reader
  // needs and the six-character suffix is there for uniqueness, not reading.
  function short(b) { return String(b || '').replace(/^claude\//, '').replace(/-[a-z0-9]{6}$/, ''); }
  // One line of the clipboard, bounded, for the header that reports having
  // found no branch in it. It is the only place the clipboard's own text is
  // shown, and it is what makes "no branch" checkable rather than merely
  // asserted: a reader can see WHAT was read and judge the verdict.
  function peek(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length > 44 ? '“' + s.slice(0, 43) + '…”' : '“' + s + '”';
  }

  // An entry is [id, ended, ask]; the payload is built for this menu and holds
  // nothing else, so nothing here filters, sorts, or reshapes. Whatever a row
  // needs to say is already in the three fields, and `recent` already arrives
  // newest first. lib/kits/repo-sessions-cache.js buildMenuIndex() is the
  // builder, and tools/test/repo-sessions-cache.test.mjs holds the shape.
  // THE BRANCH SLUG LEADS, NOT THE ASK. A menu of ten rows reading "2h" and 56
  // characters of a dictated opening sentence is ten rows a reader cannot tell
  // apart, which is what the phone showed on 2026-09-08. The slug is the same
  // ask already reduced to a topic by whoever named the branch, and it is short
  // enough to survive a phone row whole. The ask stays as the fallback, for a
  // session that did no branch work.
  function label(entry, here, branchName) {
    var what = branchName ? short(branchName) : entry[2];
    return (here ? HERE : RECENT) + ' ' + bold(ago(entry[1])) + '  ' + what;
  }

  function build(idx) {
    var byBranch = idx.branches || {};
    var recent = idx.recent || [];
    var mine = branch ? byBranch[branch] : null;
    var age = ago(idx.generatedAt);
    var rows = [], urls = {};

    function add(into, l, url) {
      if (urls[l] !== undefined) l += ' · ' + url.slice(-8);  // only a repeat earns its id
      into.push(l); urls[l] = url;
    }

    // ── `rows`: the session list ─────────────────────────────────────────────
    //
    // NOT WHAT THE BACK TAP DRAWS ANY MORE. Claude-Session reads this and shows
    // it as a menu of its own, which is where a list of a dozen sessions
    // belongs: opted into, rather than in the way of the three things a back
    // tap is for. See `menu` below.
    if (mine) add(rows, label(mine, true, branch), PAGE + mine[0]);
    recent.forEach(function (e) {
      if (rows.length >= ROWS || (mine && e[0] === mine[0])) return;
      add(rows, label(e, false, e[3]), PAGE + e[0]);
    });

    function staleAt(hours) {
      var d = Date.now() - Date.parse(idx.generatedAt || '');
      return isFinite(d) && d > hours * 3600000;
    }

    // ── The header ───────────────────────────────────────────────────────────
    //
    // Two lines: what the clipboard produced, then the specifics. The second
    // line is where a reader checks the first, which is why the no-branch case
    // shows the clipboard's own text rather than only asserting the verdict.
    //
    // THE INDEX'S AGE RIDES THE `no-session` CASE AT EVERY AGE, however fresh,
    // and rides `on-branch` only past six hours. Where nothing matched, the age
    // is the difference between "no such session" and "the crawl has not run
    // since this one started", and a reader cannot tell those apart without it.
    // Where a row DID match, it only warns that a newer session might be
    // missing, which is worth six hours of silence rather than a stamp on every
    // menu.
    var state = !clip.trim() ? 'empty' : mine ? 'on-branch' : branch ? 'no-session' : 'no-branch';
    var caption =
      state === 'empty' ? rule(CLIP, 'clipboard is empty')
      : state === 'on-branch' ? rule(HERE, 'branch recognized') + '\n'
          + short(branch) + ' · ' + bold(ago(mine[1])) + (staleAt(6) ? ' · index ' + bold(age) + ' old' : '')
      : state === 'no-session' ? rule(HERE, 'branch, no session yet') + '\n'
          + short(branch) + ' · index ' + bold(age) + ' old'
      : rule(CLIP, 'no branch on clipboard') + '\n' + peek(clip);

    return { caption: caption, rows: rows, urls: urls, menu: menuOf(mine, urls),
             branch: branch, id: mine ? mine[0] : '', state: state };
  }

  // ── `menu`: what the back tap draws ────────────────────────────────────────
  //
  // THREE OR FOUR ROWS, NOT A LIST. The first build put the session list here,
  // and the phone showed what that is: ten rows reading "2h" over a clipped
  // sentence, indistinguishable from each other, in a menu whose job is to be
  // read in the second after a gesture. The header already answers the question
  // the tap was asking, so the rows only have to carry what to DO about it, and
  // that is at most one thing per state.
  //
  // The list did not go away, it moved to where a list is worth reading: `rows`
  // for Claude-Session, and the estate's Sessions view for anything more, on a
  // screen that can show a session's shape rather than 56 characters of it.
  //
  // EVERY ROW HERE OPENS AN https PAGE except the verbs, which are bare
  // shortcut names: Choose-Claude runs a row it cannot find in `urls` by name.
  //
  // **Wrong 2026-09-08 → the reason above:** this read that opening a
  // `shortcuts://` link from inside a running shortcut "appears nowhere in
  // fifteen library dumps." The search behind that claim read 45 documents of
  // 613, because a dump is `.wflow` binary plists inside a zip and the scan
  // skipped them. Read properly, 12 workflows both carry a run-shortcut URL and
  // open a URL. The route is attested. The rows stay as they are because the
  // name arm is the one THIS chain's dispatch exercises, which is a preference,
  // not a prohibition; a `shortcuts://` row is available when one is wanted.
  function menuOf(mine, urls) {
    var menu = [];
    function add(l, url) { urls[l] = url; menu.push(l); }
    if (mine) add(HERE + ' Open this session', PAGE + mine[0]);
    else if (branch) add(HERE + ' Look it up', LOOKUP + branch);
    add(RECENT + ' All sessions', ESTATE);
    return menu.concat(VERBS);
  }

  try {
    if (!token) throw new Error('no token reached the op');
    var idx = readIndex();
    stage = 'build';
    return build(idx);
  } catch (err) {
    var name = err && err.name && err.name !== 'Error' ? err.name + ': ' : '';
    var msg = 'ERROR ' + name + (err && err.message || String(err)) + ' at ' + stage;
    // The caption keeps the same two-line shape, and the word ERROR stays on
    // the second line because Claude-Session tests the caption for it and shows
    // the text instead of drawing a menu. `menu` still draws, because the
    // sessions are what failed and not the shortcut, and it keeps the estate
    // row: when this index is unreachable, the view that rebuilds it is the one
    // thing on the menu worth tapping.
    var urls = {}, menu = menuOf(null, urls);
    return { caption: rule(WARN, 'sessions unreachable') + '\n' + msg,
             rows: [], urls: urls, menu: menu,
             branch: branch, id: '', state: 'error', error: msg, probe: probe() };
  }
})
