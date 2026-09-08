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
  var ROWS = 12;                          // session rows offered, at most
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
  // Mathematical sans-serif BOLD for a value inside a line: an age, a count.
  // Mathematical sans-serif BOLD ITALIC, lowercased, for the rule line's own
  // words. That split is not decorative: it is the register Describe-Input
  // already sets a clipboard caption in, and Choose-BackTap titles the other
  // back-tap menu with, so the two menus read as siblings rather than as two
  // designs. Letters and digits only; anything else passes through.
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
  // Describe-Input's centring, to the character: a 68-column field, the rule
  // padded to the middle of it and then two columns further. Copied rather
  // than shared because the two run in different places, and held side by side
  // by tools/test/ops.test.mjs.
  function rule(glyph, words) {
    var bar = '- ' + glyph + ' ' + italic(words) + ' -';
    return new Array(Math.max(0, Math.floor((68 - Array.from(bar).length) / 2) + 3)).join(' ') + bar;
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
  function label(entry, here) {
    return (here ? HERE : RECENT) + ' ' + bold(ago(entry[1])) + '  ' + entry[2];
  }

  function build(idx) {
    var byBranch = idx.branches || {};
    var recent = idx.recent || [];
    var mine = branch ? byBranch[branch] : null;
    var age = ago(idx.generatedAt);
    var rows = [], urls = {};

    function add(l, url) {
      if (urls[l] !== undefined) l += ' · ' + url.slice(-8);  // only a repeat earns its id
      rows.push(l); urls[l] = url;
    }

    // The recognised branch leads, and drops out of the recent fill below so
    // the same session is never two rows.
    if (mine) add(label(mine, true), PAGE + mine[0]);
    // A BRANCH WITH NO ROW STILL GETS ONE, and this is the arm that matters
    // most. The payload is rebuilt only when someone opens the estate's
    // Sessions or State view, so a session reaches it two hops behind: its
    // record lands on the first Stop, the crawl folds it in whenever the crawl
    // next runs. session.html's `#branch=` walks the store itself and reaches
    // no cache, so it answers for exactly the session this index cannot see.
    else if (branch) add(HERE + ' ' + bold('look it up') + '  ' + short(branch), LOOKUP + branch);

    recent.forEach(function (e) {
      if (rows.length >= ROWS || (mine && e[0] === mine[0])) return;
      add(label(e, false), PAGE + e[0]);
    });

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
    function staleAt(hours) {
      var d = Date.now() - Date.parse(idx.generatedAt || '');
      return isFinite(d) && d > hours * 3600000;
    }

    var state = !clip.trim() ? 'empty' : mine ? 'on-branch' : branch ? 'no-session' : 'no-branch';
    var caption =
      state === 'empty' ? rule(CLIP, 'clipboard is empty')
      : state === 'on-branch' ? rule(HERE, 'branch recognized') + '\n'
          + short(branch) + ' · ' + bold(ago(mine[1])) + (staleAt(6) ? ' · index ' + bold(age) + ' old' : '')
      : state === 'no-session' ? rule(HERE, 'branch, no session yet') + '\n'
          + short(branch) + ' · index ' + bold(age) + ' old'
      : rule(CLIP, 'no branch on clipboard') + '\n' + peek(clip);

    return { caption: caption, rows: rows, urls: urls, menu: rows.concat(VERBS),
             branch: branch, id: mine ? mine[0] : '', state: state };
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
    // the text instead of drawing a menu. `menu` still carries the verbs, so a
    // caller that draws it gets a working menu rather than an empty one: the
    // sessions are what failed, not the shortcut.
    return { caption: rule(WARN, 'sessions unreachable') + '\n' + msg,
             rows: [], urls: {}, menu: VERBS.slice(),
             branch: branch, id: '', state: 'error', error: msg, probe: probe() };
  }
})
