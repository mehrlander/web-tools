// kits/md-doc.js — a markdown document rendered as something you can read and
// take pieces OUT of.
//
// Three jobs over one render, and the first two are the same job seen from
// either end:
//
//   CONTAIN    a wide table, code block or image scrolls or shrinks inside its
//              own box rather than widening the column it sits in. Without this
//              the widest thing in a doc sets the width of everything around it,
//              and a reader dragging sideways to see column six drags the prose
//              with it.
//   CUT        every heading gets a control over THAT SECTION'S SOURCE: copy
//              it, copy it with a revision ask on top, or open a note pinned
//              to it. Wikipedia's [edit] link, answering a different verb: the
//              unit a reader wants to act on is the section, and what they
//              want to act on it WITH is the markdown, not the HTML it was
//              rendered into.
//   DECLARE    the rendered box says which source and which address it is a
//              rendering OF, so any node inside it can be answered for in the
//              source's terms. That is what lets a note read
//              `docs/APP.md § Mechanism (lines 16-28)` rather than
//              `article > p:nth-of-type(3) [42-57]`.
//
// The two arrived together because they are the same complaint from two sides.
// A rendered document is a reading surface that has thrown away its source:
// the table has lost the pipes that would have let it wrap, and the section has
// lost the `##` that would have let it travel. Both are recoverable only by the
// surface that still holds the source, which is this one.
//
// WHY THE SOURCE AND NOT THE SELECTION. Copying a rendered section gives you
// prose with the structure flattened out: a table becomes tab-separated runs, a
// link becomes its label, a fenced block loses its fence. Handing that to a
// model and asking for a revision gets you a revision of the flattening. The
// source slice is the thing that can be revised and put back, which is the
// whole point of cutting at a section rather than at a paragraph.
//
//   mdDoc.split(src)                 -> [{ index, depth, title, slug, raw,
//                                          start, end, startLine, endLine }]
//   mdDoc.reference(sec, addr)       -> the provenance line(s), as an array
//   mdDoc.payload(sec, addr)         -> reference + blank line + sec.raw
//   mdDoc.html(src, o?)              -> a prose HTML STRING, tables contained
//   mdDoc.render(host, src, o?)      -> mounts into host; returns { box, sections }
//   mdDoc.enhance(box, src, o?)      -> the same over markup another renderer made
//   mdDoc.contain(el, {wrap})        -> el, nothing left that can widen a column
//                                       (`wrap` makes a fence wrap rather than
//                                       scroll; see the note above contain)
//   mdDoc.linkRepoFiles(el, o?)       -> make unambiguous repository file references navigable
//   mdDoc.repoPath(file, href)        -> { path, hash } for a relative repository href
//   mdDoc.locate(node)               -> { addr, sections, section } for any node in a render
//   mdDoc.sourceRef(node)            -> "docs/APP.md § Mechanism (lines 16-28)"
//
// `addr` is `{ repo, ref, path, url }`, all optional. It is what makes a copied
// section worth pasting: a section with no address is a passage nobody can find
// again, and the address is the half the reader cannot reconstruct.
//
// THE THREE VERBS ARE ONE MENU, not three buttons. A heading has room for one
// mark, and the reader's question at a heading is "what can I do with this
// part", which a menu answers and three glyphs make them decode. The note row
// appears only where `window.Annotate` is actually running, since a control
// that opens nothing is worse than an absent one.
//
// SECTIONS NEST, the way Wikipedia's do: a section runs from its heading to the
// next heading of EQUAL OR HIGHER rank, so copying `## Surfacing primitives`
// brings its `###` subsections with it and each of those still has its own
// control. A reader asking for "this section" nearly always means the part of
// the document under that title, not the paragraphs before the next subheading.
//
// Requires `window.marked` to be loaded already (the same lazy load every other
// markdown surface here does), and reads `window.io.copy` when it is present
// for the iOS clipboard path. No Alpine, no gh, no DOM opinions of its own: it
// takes the host it is handed.
//
// kits/chat-render.js carries its own copy of the table wrap, and keeps it: it
// is a standalone script a page can drop in from jsDelivr with nothing else,
// and tools/test/chat-render-wide-table.test.mjs pins it there. The wrap is six
// lines; the independence is worth more than the six.
(() => {
  if (window.mdDoc) return;

  const H = 'h1,h2,h3,h4,h5,h6';
  const PROSE = 'prose prose-sm !max-w-none break-words prose-pre:bg-base-200 prose-pre:text-base-content';

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k) n.append(k);
    return n;
  };

  // ── Contain ───────────────────────────────────────────────────────────────
  // Three elements can be wider than the column they are in, and each widens it
  // rather than being clipped by it. A TABLE's intrinsic min-content width (the
  // longest unbreakable run in each column) is a floor no ancestor can shrink
  // below. A PRE is `white-space: pre`, so a long command line does not wrap at
  // all. An IMG is its own pixel width. In a swipe-deck slide, the thing that
  // ends up scrolling is the SLIDE, which drags the headings and the prose
  // sideways along with whatever overflowed and reads as the document being
  // broken.
  //
  // The table's wrapper does not force `max-content` on it. Typography's default
  // `width: 100%` still wraps cells, so a table that CAN fit still fits and only
  // one that genuinely cannot starts scrolling. Same call, and the same reasons,
  // as chat-render's.
  //
  // INLINE STYLES, NOT UTILITY CLASSES, and that is the lesson kits/guide-render.js
  // paid for: a class that arrives in the DOM from a JS string depends on the
  // Tailwind browser build having generated a rule for it, and when it has not
  // there is no error anywhere, just a layout that quietly does not hold. The
  // `pre` case makes the point twice over, since the rule that normally saves it
  // belongs to the typography plugin: a page that renders prose without loading
  // that plugin has `overflow-x: visible` on every code block. Measured 2026-08-26
  // in the headless render, where the plugin ships no dist CSS and resolves to a
  // miss: a 922px command line inside a 398px column, slide scrollWidth 938
  // against a 430px track. The utility classes stay on the wrapper as the
  // readable statement of intent; the inline style is what makes it true.
  // ── Fenced code: say what it is, and colour it ──────────────────────────
  //
  // marked already emits `<pre><code class="language-x">`; nothing in this
  // estate's prose path ever read that class, so every fence rendered as an
  // unlabelled grey slab. A markdown file quoting markdown (a skill file
  // showing the marker shapes is the case) was the most confusing: a block of
  // plain text with no indication it was a sample rather than the document.
  //
  // Two things, and the order matters. The LABEL is free and always right, so
  // it goes on whether or not the highlighter ever arrives. Prism is loaded
  // only when a labelled fence exists, and only its JS: its theme CSS paints a
  // light background and fixed token colours, which would fight the theme in
  // every dark render. The token colours live in guide-render's own CSS
  // instead, keyed to the daisyUI variables, so a highlighted block belongs to
  // the page it is on.
  const PRISM_JS =
    'https://cdn.jsdelivr.net/combine/npm/prismjs/prism.min.js,npm/prismjs/plugins/autoloader/prism-autoloader.min.js';

  let prismAsked = null;
  function needPrism() {
    if (window.Prism) return Promise.resolve(window.Prism);
    if (prismAsked) return prismAsked;
    prismAsked = new Promise((done) => {
      const sc = document.createElement('script');
      sc.src = PRISM_JS;
      sc.onload = () => {
        // The same package the core came from, and a VERSIONED path. viewer.js
        // learned this the hard way: an unversioned components path 404s, so
        // every language the autoloader asked for failed and only Prism's four
        // bundled grammars highlighted. Pointing at npm/prismjs keeps the two
        // halves on one version.
        try {
          window.Prism.plugins.autoloader.languages_path =
            'https://cdn.jsdelivr.net/npm/prismjs/components/';
        } catch (e) { /* no autoloader is still a working core */ }
        done(window.Prism);
      };
      sc.onerror = () => done(null);   // offline is unhighlighted, never broken
      document.head.append(sc);
    });
    return prismAsked;
  }

  const LANG_NAME = {
    sh: 'shell', bash: 'shell', zsh: 'shell', shell: 'shell',
    py: 'python', rb: 'ruby', js: 'javascript', mjs: 'javascript',
    ts: 'typescript', yml: 'yaml', md: 'markdown',
  };

  function labelFences(root) {
    const codes = [...root.querySelectorAll('pre > code[class*="language-"]')];
    if (!codes.length) return;
    for (const code of codes) {
      const pre = code.parentElement;
      if (pre.dataset.mdFence) continue;
      const lang = (code.className.match(/language-([\w+#-]+)/) || [])[1] || '';
      pre.dataset.mdFence = lang || '1';
      if (!lang || lang === '1') continue;
      // Positioned on the PRE rather than in a wrapper, so the block keeps its
      // own edges and the containment rule above still owns its scrolling.
      //
      // `md-fence` is what reserves the strip it sits in. The label used to
      // share the first line of code: at .25rem down it ran from y4 to y14 and
      // the first line began at y11, so wherever that line reached the right
      // edge, which on a phone is most lines, the two sat on top of each other.
      // The class is on the pre rather than a `:has()` selector because
      // `data-md-fence` is also set for a fence with no language, which gets no
      // label and so needs no strip.
      pre.style.position = 'relative';
      pre.classList.add('md-fence');
      const tag = document.createElement('span');
      tag.className = 'md-fence-lang';
      // SPELLED OUT WHERE THE ABBREVIATION IS OPAQUE. A reader asked what `sh`
      // meant, which is a fair question about a two-letter label on a code
      // block. The map is deliberately short: only the cases where the token a
      // fence declares is not a word, since renaming anything else would
      // invent a language the document did not name.
      tag.textContent = LANG_NAME[lang] || lang;
      pre.append(tag);
    }
    // A MARKED BLOCK KEEPS ITS MARKS AND GIVES UP ITS COLOURS, because the two
    // cannot share a block. Prism's highlightElement assigns innerHTML, so it
    // replaces everything inside the <code> with its own token spans, and any
    // <ins>/<del> that kits/md-diff.js laid over that fence is gone with it. A
    // documentation change inside a code block then rendered with no marking at
    // all: measured 2026-09-17 on the md-diff demo, three marks on the page and
    // zero inside the fence, in the one block whose edit was the point.
    //
    // Marking wins rather than highlighting for two reasons. It is the reason
    // that surface exists, where syntax colour is decoration. And the two would
    // be arguing anyway: the token colours below are the theme's own primary,
    // success and accent, and red-on-removed over green-on-a-string is a worse
    // read than either alone.
    //
    // TAKING THE CLASS OFF is what takes a block out of Prism's reach, and it
    // has to come off rather than be renamed. Prism's selector is four
    // alternatives, not one: `code[class*="language-"]` AND
    // `code[class*="lang-"]`, plus the same two through an ancestor. A first
    // attempt rewrote `language-sh` to `md-marked-lang-sh`, which still matched
    // the second alternative, so Prism claimed the block, found no grammar for
    // it, stamped `language-none` on it, and assigned innerHTML anyway: the
    // marks died exactly as before and the class said the fix had run. The
    // language moves to a data attribute, which no selector of Prism's reads.
    //
    // The label above has already been read off the class by this point, and
    // `data-md-fence` on the pre is what stops a later pass relabelling, so
    // nothing downstream needs the class back. Token colours are keyed to
    // `.token.*` in guide-render's CSS rather than to the language, so they are
    // unaffected for every block that keeps its highlighting.
    for (const code of codes) {
      if (!code.querySelector('ins, del')) continue;
      const lang = (code.className.match(/\blang(?:uage)?-([\w+#-]+)/) || [])[1];
      if (lang) code.dataset.mdMarkedLang = lang;
      code.className = code.className.replace(/\blang(?:uage)?-[\w+#-]+/g, '').trim();
    }
    if (!codes.some((c) => /\blang(?:uage)?-/.test(c.className))) return;
    needPrism().then((P) => {
      if (!P) return;
      try { P.highlightAllUnder(root); } catch (e) { /* a grammar that will not load */ }
    });
  }

  // `o.wrap` changes what a `pre` does with a line too long for its box: wrap
  // it rather than scroll it sideways.
  //
  // WHY A CALLER WOULD ASK. A horizontal scroller inside a horizontal gesture
  // is two claims on one drag. kits/md-diff.js moves between a change's
  // readings by swiping, and a fence inside one took the drag for its own
  // scroll, so on a phone the reader could not reliably reach `old` from a
  // block whose content was code. The estate already met this with tables, in
  // a pane rather than a swipe (see the note by `.guide-body table` in
  // guide-render), and answered it by giving the table its own scroller; that
  // answer does not transfer, because the gesture the fence would be taking is
  // the one the whole container exists for.
  //
  // It is a caller's choice rather than the default because the two readings
  // are both right somewhere. A guide body on a page is read down and a long
  // command scrolling in place keeps the prose measure honest; a fence inside a
  // comparison has to be legible at a glance, which means visible in full.
  // The containment choice a caller makes, pulled out so html(), render() and
  // enhance() forward it rather than each naming it again.
  const CONTAIN_OPTS = (o) => ({ wrap: o.wrap });

  function contain(root, o = {}) {
    if (!root) return root;
    for (const t of root.querySelectorAll('table')) {
      if (t.parentElement && t.parentElement.hasAttribute('data-md-scroll')) continue;
      const box = el('div', {
        class: 'overflow-x-auto max-w-full',
        style: 'overflow-x:auto;max-width:100%',
        'data-md-scroll': '',
      });
      t.replaceWith(box);
      box.append(t);
    }
    // A pre scrolls as ITSELF: it is already a block with its own edges, so
    // there is nothing a wrapper would add.
    for (const pre of root.querySelectorAll('pre')) {
      if (o.wrap) {
        pre.style.whiteSpace = 'pre-wrap';
        // `anywhere` rather than `break-word`: a shell command breaks at its
        // spaces, which is where a reader would break it, and the mid-token
        // break only happens for a single token wider than the box, which is
        // exactly when there is no other choice.
        pre.style.overflowWrap = 'anywhere';
        pre.style.overflowX = 'visible';
      } else {
        pre.style.overflowX = 'auto';
      }
      pre.style.maxWidth = '100%';
    }
    labelFences(root);
    for (const img of root.querySelectorAll('img')) {
      if (!img.style.maxWidth) img.style.maxWidth = '100%';
    }
    return root;
  }

  // ── Repository links ────────────────────────────────────────────────────────────────────────────────
  // Markdown already has a syntax for saying "this is a link". A repository
  // reader owes that authored intent one extra thing: `../markers/SKILL.md`
  // should open the repository file rather than resolve against app/index.html.
  // Inline code is different. Backticks say "code", not "link", so this kit
  // gives a WHOLE code span a door only when its text names exactly one known
  // file. Ambiguity stays visible and inert instead of choosing by accident.
  //
  // The kit resolves and marks; the host navigates. That division keeps a
  // Markdown render reusable in a Files pane, a Swipe Deck, or a standalone
  // page without teaching this DOM-only kit what any of those surfaces are.
  // The child reader is a TEXT surface. Keep this list deliberately narrower
  // than "anything with a filename": handing an xlsx, image, PDF, or Word
  // document to the source renderer first decodes its bytes as text and then
  // presents the corruption as though it were the file. Authored binary links
  // still get their repository URL below; they simply keep the browser's
  // ordinary navigation instead of acquiring an in-deck click handler.
  const TEXT_FILEISH = /^[^\s?#]+\.(?:mjs|cjs|jsx?|tsx?|json|html?|css|md|markdown|csv|tsv|py|sh|bash|yml|yaml|toml|txt|log|svg|xml)$/i;

  function textRepoPath(path) {
    return TEXT_FILEISH.test(String(path || ''));
  }

  function repoPath(file, href) {
    let raw = String(href || '').trim();
    if (!raw) return null;
    // A fragment is still a repository-file reference: it names the current
    // file. Let the host land inside its existing reader so the browser does
    // not mint a history entry the Swipe Deck knows nothing about.
    if (raw.startsWith('#')) return raw.length > 1 && file
      ? { path: String(file), hash: raw }
      : null;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) return null;
    let hash = '';
    const hi = raw.indexOf('#');
    if (hi >= 0) { hash = raw.slice(hi); raw = raw.slice(0, hi); }
    const qi = raw.indexOf('?');
    if (qi >= 0) raw = raw.slice(0, qi);
    try { raw = decodeURIComponent(raw); } catch { /* keep the authored path */ }
    if (!raw) return null;
    const out = raw.startsWith('/') ? [] : String(file || '').split('/').slice(0, -1).filter(Boolean);
    for (const seg of raw.replace(/^\/+/, '').split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        if (!out.length) return null;
        out.pop();
      } else out.push(seg);
    }
    return out.length ? { path: out.join('/'), hash } : null;
  }

  function codeRepoPath(text, file, paths) {
    const raw = String(text || '').trim();
    if (!raw || !textRepoPath(raw)) return null;
    const known = paths instanceof Set ? paths : new Set(paths || []);
    if (!known.size) return null;
    const clean = raw.replace(/^\/+/, '');
    const relative = repoPath(file, raw);
    // ./ and ../ are authored resolution choices even inside code. A slash
    // without either prefix normally names a repository-root path. A bare
    // filename carries neither fact, so it links only when the entire tree has
    // one candidate: root README.md must not beat docs/README.md by accident.
    if (/^\.\.?\//.test(raw)) return relative && known.has(relative.path) ? relative : null;
    if (clean.includes('/')) {
      if (known.has(clean)) return { path: clean, hash: '' };
      if (relative && known.has(relative.path)) return relative;
    }
    const matches = [...known].filter(p => p === clean || p.endsWith('/' + clean));
    return matches.length === 1 ? { path: matches[0], hash: '' } : null;
  }

  function linkRepoFiles(root, o = {}) {
    if (!root) return { authored: 0, inferred: 0 };
    const known = o.paths instanceof Set ? o.paths : new Set(o.paths || []);
    const file = String(o.path || '');
    const hrefFor = (target) => typeof o.href === 'function'
      ? o.href(target.path, target.hash || '')
      : target.path + (target.hash || '');
    const bind = (a, target, source) => {
      if (!a || !target || a.hasAttribute('data-repo-path')) return false;
      a.setAttribute('data-repo-path', target.path);
      if (target.hash) a.setAttribute('data-repo-hash', target.hash);
      a.setAttribute('data-repo-link', source);
      a.setAttribute('href', hrefFor(target));
      if (!a.title) a.title = 'Open ' + target.path + ' in this repository';
      if (typeof o.open === 'function') a.addEventListener('click', (e) => {
        // The href remains a real GitHub address, so modified clicks keep the
        // browser's ordinary new-tab/new-window behavior. Only an unmodified
        // primary click belongs to the host's in-place reader.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        o.open({ path: target.path, hash: target.hash || '', source, link: a }, e);
      });
      return true;
    };

    let authored = 0, inferred = 0;
    for (const a of root.querySelectorAll('a[href]')) {
      const target = repoPath(file, a.getAttribute('href'));
      // With a known set, only re-aim a path the repository says exists.
      // Without one, leave resolution to the browser rather than manufacture
      // certainty this renderer does not have. Unsupported files still need
      // the repository URL: their authored relative href otherwise resolves
      // against app/index.html. They do not, however, become deck doors.
      if (!target || !known.size || !known.has(target.path)) continue;
      if (!textRepoPath(target.path)) {
        a.setAttribute('href', hrefFor(target));
        if (!a.title) a.title = 'Open ' + target.path + ' in this repository';
        continue;
      }
      if (bind(a, target, 'authored')) authored++;
    }
    for (const code of root.querySelectorAll('code')) {
      if (code.closest('pre, a, button')) continue;
      const target = codeRepoPath(code.textContent, file, known);
      if (!target) continue;
      const a = document.createElement('a');
      code.replaceWith(a);
      a.append(code);
      if (bind(a, target, 'inferred')) inferred++;
    }
    return { authored, inferred };
  }

  // ── Cut ───────────────────────────────────────────────────────────────────
  // GitHub's own slug rule, near enough to link with: lowercased, punctuation
  // dropped, spaces hyphenated. Used for the blob URL's fragment, so a copied
  // reference opens on the section rather than at the top of a long file.
  const slugify = (s) => String(s || '').trim().toLowerCase()
    .replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');

  // The headings, found in the SOURCE rather than in the rendered HTML, and
  // found through the parser rather than by a line regex. `# ` inside a fenced
  // block is not a heading and a regex cannot tell; the lexer already knows.
  //
  // Only TOP-LEVEL heading tokens count. A heading inside a blockquote or a
  // list item is a nested token, and render() pairs this list against the box's
  // direct-child headings, so the two agree by construction: both take exactly
  // the headings that sit at the document's own level.
  //
  // Offsets come from locating each token's `raw` forward from where the last
  // one ended, rather than from summing raw lengths. Summing drifts the moment
  // one token's raw is not byte-exact; searching forward re-anchors on every
  // token and cannot drift past the next match.
  function headings(src) {
    const marked = window.marked;
    if (!marked || !marked.lexer) return [];
    let toks;
    try { toks = marked.lexer(String(src ?? '')); } catch { return []; }
    const out = [];
    let at = 0;
    for (const t of toks) {
      const raw = typeof t.raw === 'string' ? t.raw : '';
      const i = raw ? src.indexOf(raw, at) : -1;
      const start = i >= 0 ? i : at;
      if (i >= 0) at = i + raw.length;
      else at = at + raw.length;
      if (t.type === 'heading') out.push({ depth: t.depth, title: String(t.text || '').trim(), start });
    }
    return out;
  }

  // Line numbers, because the point of copying a section is usually to get a
  // revision back, and "lines 43-91 of this file" is what turns a revision into
  // an edit somebody can apply. One pass over the newlines, so a long document
  // costs one scan rather than one per section.
  const lineIndex = (src) => {
    const nl = [];
    for (let i = src.indexOf('\n'); i >= 0; i = src.indexOf('\n', i + 1)) nl.push(i);
    return (offset) => {
      let lo = 0, hi = nl.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (nl[mid] < offset) lo = mid + 1; else hi = mid; }
      return lo + 1;
    };
  };

  function split(source) {
    const src = String(source ?? '');
    const heads = headings(src);
    if (!heads.length) return [];
    const lineAt = lineIndex(src);
    return heads.map((h, k) => {
      // To the next heading of equal or higher rank: the section INCLUDES its
      // subsections. A `##` copied without its `###`s is a fragment of an
      // argument, and the reader who wanted the fragment has the subsection's
      // own control right there.
      let end = src.length;
      for (let j = k + 1; j < heads.length; j++) {
        if (heads[j].depth <= h.depth) { end = heads[j].start; break; }
      }
      const raw = src.slice(h.start, end).replace(/\s+$/, '');
      return {
        index: k,
        depth: h.depth,
        title: h.title,
        slug: slugify(h.title),
        raw,
        start: h.start,
        end: h.start + raw.length,
        startLine: lineAt(h.start),
        endLine: lineAt(h.start + Math.max(0, raw.length - 1)),
      };
    });
  }

  // The address, in the estate's own `owner/repo[@ref]:path` grammar, because
  // that is the form every tool here can already resolve. The blob URL rides
  // beside it for the reader rather than for a tool, with the line anchor
  // GitHub understands.
  function reference(sec, addr = {}) {
    const { repo, ref, path, url } = addr || {};
    const where = path
      ? (repo ? repo + (ref ? '@' + ref : '') + ':' + path : path)
      : '';
    const L = [];
    const lines = sec && sec.startLine ? ` lines ${sec.startLine}-${sec.endLine}` : '';
    if (where) L.push(`From ${where}${lines}`);
    else if (lines) L.push(`From lines ${sec.startLine}-${sec.endLine}`);
    if (url) L.push(url + (sec && sec.startLine ? `#L${sec.startLine}-L${sec.endLine}` : ''));
    return L;
  }

  // The reference ALWAYS rides, and that is a decision rather than an
  // oversight. A section pasted into a chat without it is a passage the reader
  // then has to place by hand, which is the one part of the job they cannot do
  // from what is on their screen. A section pasted WITH it and not wanted costs
  // deleting two lines. The asymmetry decides it, the same way it decides the
  // annotator's preamble.
  function payload(sec, addr = {}) {
    if (!sec) return '';
    const head = reference(sec, addr);
    return head.length ? head.join('\n') + '\n\n' + sec.raw : sec.raw;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // `proseClass: ''` means the caller's own container is already the prose box,
  // so what comes back is the BODY rather than a second wrapper. A stray div
  // between a `.prose` element and its children is not fatal (typography
  // matches descendants), but it takes over `> :first-child`, and a caller who
  // has said "I have a container" should get what goes in it.
  function html(source, o = {}) {
    const marked = window.marked;
    if (!marked) return '';
    let out = marked.parse(String(source ?? ''));
    if (typeof o.sanitize === 'function') out = o.sanitize(out);
    const bare = o.proseClass === '' || o.proseClass === null;
    const box = el('div', { class: bare ? null : (o.proseClass || PROSE), html: out });
    contain(box, CONTAIN_OPTS(o));
    return bare ? box.innerHTML : box.outerHTML;
  }

  // THE CLIPBOARD WRITE IS kits/io.js's, and this two-line delegate is all any
  // kit keeps of it. Four of them carried the same textarea-fallback block,
  // pasted and lightly reworded, and the block is not boilerplate: it is the
  // iOS recipe io.js documents at length (focusable, not readonly, read the
  // value rather than trusting execCommand's return). Four copies of that is
  // four places for it to be subtly wrong, and three of them already differed
  // from each other in whether they returned anything.
  //
  // It is FETCHED at load time rather than at click time. A clipboard write
  // has to run inside the user gesture that asked for it, and an await before
  // the write can spend the activation Safari is counting; loading the kit
  // when this one loads means it is simply there by the time a finger arrives.
  // The guard survives for the page that never gets it, and falls back to the
  // modern API alone, which is honest: no io.js, no legacy path.
  const ghRef = typeof gh !== 'undefined' ? gh : (window.gh || null);
  if (!window.io && ghRef) ghRef.load('kits/io.js').catch(() => {});
  // kits/src-doc.js is self-loaded on the same principle: a page that loads this
  // kit has asked for a declared render, and the declaration is what that kit
  // holds. Every caller loads the pair explicitly too, since this arrives one
  // fetch late; this is the net under a caller that forgets, and declare()
  // below says so rather than silently doing nothing.
  if (!window.srcDoc && ghRef) ghRef.load('kits/src-doc.js').catch(() => {});
  const copyText = async (text) => {
    if (window.io && typeof window.io.copy === 'function') return window.io.copy(text);
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };

  // ── Locate ────────────────────────────────────────────────────────────────
  // THE DECLARATION, and it is what everything downstream of the render hangs
  // on. A rendered box says "I am a rendering of THIS markdown, at THIS
  // address", and any node inside it can then be answered for in the source's
  // own terms rather than the DOM's. kits/annotate.js is the first consumer:
  // its `Path:` line reads `docs/APP.md § Mechanism (lines 16-28)` instead of
  // `article > p:nth-of-type(3) [42-57]`, which is the difference between a
  // note a model can act on and a note it has to go looking for.
  //
  // kits/src-doc.js OWNS THE DECLARATION: the attribute, the property and
  // the announcement for every kind that declares. This kit supplies the
  // markdown half: the sections, and the reference line that names one.

  // THE ROW THIS RENDER ANSWERS TO in docs/routes-kinds.csv, carried on the
  // declaration so a reader of the DOM gets the vocabulary without fetching a
  // registry. kits/annotate.js is that reader: its Section row is labelled from
  // `aimLabel` and `aimHint` rather than from strings of its own, so the aim
  // says what it is about instead of saying "Section" on a page that has four
  // other structures in it.
  //
  // `aimIcon` IS PART OF THAT VOCABULARY, and it was not until 2026-09-06. The
  // label travelled and the glyph did not: both surfaces that draw this aim
  // hardcoded `ph-text-align-left`, so the next kind to declare would have
  // inherited markdown's icon along with its own name, and the row a reader saw
  // said "alignment" about a document. A kind that names its aim now names its
  // mark too.
  //
  // ph-file-md, NOT ph-markdown-logo, and the difference is what the aim is
  // ABOUT. The logo is the format, and kits/annotate.js already spends it on
  // the serialization key that shows the set as markdown; two of them in one
  // card header, one lit and one not, would be the same glyph for two unrelated
  // questions. This aim points at a markdown DOCUMENT sitting on the page, so
  // it takes the document mark, which also pairs with the Page aim's ph-file
  // two buttons to its left: this page, or this markdown document.
  //
  // The registry is the owner and tools/test/routes-manifest.test.mjs holds the
  // two together, the same arrangement docs/routes-routes.csv has with
  // toss-render's inlined TOSS_ROUTES: the registry declares, the code inlines
  // so no render path takes a fetch, and adding to one alone fails.
  const KIND = Object.freeze({
    kind: 'markdown',
    label: 'Markdown document',
    unit: 'section',
    aim: 'section',
    aimLabel: 'Markdown section',
    aimHint: 'tap a heading: the note is about its source',
    aimIcon: 'ph-file-md',
  });

  // Declaring is src-doc's, stamped with this kit's own row so a reader of
  // the DOM knows which kind it found.
  let warned = false;
  function declare(box, state) {
    if (!window.srcDoc) {
      // Loud, once. A missing src-doc.js means nothing declares, which looks
      // exactly like a page with no markdown on it: the failure this kit's
      // consumers have already been bitten by twice.
      if (!warned) { warned = true; console.warn('md-doc: kits/src-doc.js is not loaded; nothing will declare'); }
      return box;
    }
    // `units` is what src-doc's aim test reads: this kind counts in
    // sections, and a heading-less file declares with none.
    return window.srcDoc.declare(box, {
      kind: KIND, units: (state && state.sections || []).length, ...state,
    });
  }

  // Kept as an alias so a markdown-specific caller reads as one; both
  // conditions (this kind declares an aim, and the render has sections in it)
  // are src-doc's now, since every kind needs the same pair.
  const declaredIn = (doc) => (window.srcDoc ? window.srcDoc.declaredIn(doc) : null);

  // Which section a node is in: walk up to the node's top-level ancestor inside
  // the box, then back through its previous siblings to the nearest heading
  // that render() stamped. That is the same rule the reader applies by eye,
  // which is what makes it the right one: a paragraph belongs to whatever
  // heading it is under.
  function locate(node) {
    let el0 = node && node.nodeType === 1 ? node : (node && node.parentElement);
    const box = window.srcDoc ? window.srcDoc.boxOf(el0) : null;
    const state = box && box.__srcDoc;
    if (!state) return null;
    let top = el0;
    while (top && top.parentElement && top.parentElement !== box) top = top.parentElement;
    let section = null, head = null;
    for (let n = top; n; n = n.previousElementSibling) {
      const i = n.getAttribute && n.getAttribute('data-md-section');
      if (i != null) { section = state.sections[+i] || null; head = n; break; }
    }
    // The heading NODE rides along, not just the section data: a caller that
    // wants to outline the section (annotate's section pick) needs somewhere to
    // start walking, and re-finding the heading from a css path would be a
    // second answer to a question this call already answered.
    return { box, addr: state.addr || {}, sections: state.sections || [], section, head };
  }

  // The one line that says where a passage lives, in the source's terms. It is
  // deliberately not the machine address: `owner/repo@ref:path` is what the
  // payload's own header carries, and a note wants the part a person or a model
  // reads, which is the file, the section, and the lines.
  function sourceRef(nodeOrLoc) {
    const loc = nodeOrLoc && nodeOrLoc.addr !== undefined ? nodeOrLoc : locate(nodeOrLoc);
    if (!loc || !loc.addr || !loc.addr.path) return '';
    const s = loc.section;
    return loc.addr.path
      + (s ? ' § ' + s.title + ' (lines ' + s.startLine + '-' + s.endLine + ')' : '');
  }

  // ── The section control ───────────────────────────────────────────────────
  // The default ask a section carries when it is copied FOR REVISION. It is one
  // sentence and it constrains the shape of the answer, because the answer has
  // to come back as something that can replace the lines the header names. A
  // revision that arrives as advice about the section is not a revision.
  const REVISE = 'Revise the section below. Return only the revised section as '
              + 'markdown, keeping its heading, so it can replace the lines named above.';

  const rows = (sec, o) => {
    const addr = o.addr || {};
    const out = [
      { icon: 'ph-copy', label: 'Copy section',
        hint: 'the source, with its address',
        run: () => payload(sec, addr) },
      { icon: 'ph-pen-nib', label: 'Copy for revision',
        hint: 'the same, with the ask on top',
        run: () => (o.reviseAsk || REVISE) + '\n\n' + payload(sec, addr) },
    ];
    // Only where the annotator is LOADED: a row that opens a note composer on a
    // page with no annotator is a dead control, and the reader has no way to
    // tell which kind they are looking at. Presence is the honest test, since a
    // kit that is not on the page cannot be reached from here and speculatively
    // loading one on every markdown render would spend a fetch on a menu nobody
    // opened.
    //
    // NOT `enabled`, which is what this asked until 2026-09-06 and which made
    // the row useless for the thing it is best placed to do. Gated that way it
    // could only JOIN an annotation already running, so the only way to start
    // one was the launcher menu, which is a held finger and a control floating
    // somewhere else on the page. The row a reader is already looking at, on
    // the heading they already care about, could not begin. Turning the
    // annotator on is one call and the click handler makes it, exactly as
    // alpineComponents/fab.js's annAim does before arming an aim.
    if (window.Annotate && window.Annotate.noteSection) {
      out.push({ icon: 'ph-note-pencil', label: 'Note this section',
                 hint: 'opens the composer, pinned here', note: true });
    }
    return out;
  };

  // The control lives INSIDE the heading, appended after its text, rather than
  // in a row of its own. A row would push every heading down a line and give
  // the document a second rhythm; inside, it rides the heading's own baseline
  // and disappears into it when nothing is hovering.
  //
  // `data-annotate-ui` is not decoration: kits/annotate.js walks the document's
  // text to anchor a quote and rejects any subtree carrying that attribute, so
  // stamping it here keeps the control out of the text a note is taken on.
  // Without it a selection dragged across a heading would carry an invisible
  // glyph into the quote and the anchor would not re-find itself. The menu
  // carries it too, since it is mounted into the same document.
  function sectionControl(sec, headEl, o) {
    const b = el('button', {
      type: 'button',
      class: 'md-sec-menu align-middle ml-2 px-1 opacity-25 hover:opacity-100 focus:opacity-100 '
           + 'transition-opacity cursor-pointer not-prose',
      title: 'This section: copy it, or note it',
      'data-annotate-ui': '',
      'aria-label': 'This section',
    }, el('i', { class: 'ph ph-dots-three-vertical text-[0.8em]' }));

    const flash = (icon, tone) => {
      const mark = b.firstElementChild;
      mark.className = 'ph ' + icon + ' text-[0.8em]';
      b.classList.add('opacity-100', tone);
      setTimeout(() => {
        mark.className = 'ph ph-dots-three-vertical text-[0.8em]';
        b.classList.remove('opacity-100', tone);
      }, 1400);
    };

    // FIXED, and anchored to the button rather than to the heading. A section
    // control can sit anywhere in a scrolling slide, and an absolutely
    // positioned menu inside prose would be clipped by the first ancestor with
    // its own overflow, which after contain() is a thing this kit deliberately
    // creates.
    //
    // A fixed menu does not travel with the text it belongs to, so it FOLLOWS
    // on scroll and closes only when its heading leaves the viewport. Closing
    // on any scroll at all was the first version and it lost a race that is not
    // rare: a scroll already in flight when the control is tapped (a
    // scrollIntoView, a phone still settling from a flick) delivers its event
    // after the tap, so the menu opened and vanished in the same frame.
    // Measured 2026-08-26 in the headless app, where a probe that scrolled the
    // heading into view and tapped it got no menu at all while the same tap
    // without the scroll worked.
    let menu = null;
    const place = () => {
      if (!menu) return;
      const r = b.getBoundingClientRect();
      const vh = window.innerHeight || 800, vw = window.innerWidth || 400;
      if (r.bottom < 0 || r.top > vh) { close(); return; }
      const w = menu.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(r.left, vw - w.width - 8)) + 'px';
      menu.style.top = (r.bottom + w.height + 8 > vh
        ? Math.max(8, r.top - w.height - 4) : r.bottom + 4) + 'px';
    };
    const close = () => {
      if (!menu) return;
      menu.remove(); menu = null;
      document.removeEventListener('pointerdown', onAway, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
    const onAway = (e) => { if (menu && !menu.contains(e.target) && e.target !== b) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); b.focus(); } };

    const open = () => {
      close();
      menu = el('div', {
        class: 'fixed z-[80] w-60 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl '
             + 'border border-base-300 bg-base-100 shadow-xl text-base-content not-prose',
        'data-annotate-ui': '',
      });
      for (const r of rows(sec, o)) {
        const item = el('button', {
          type: 'button',
          class: 'flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-200 cursor-pointer',
        },
          el('i', { class: 'ph ' + r.icon + ' shrink-0 opacity-60' }),
          el('span', { class: 'min-w-0' },
            el('span', { class: 'block text-sm leading-tight', text: r.label }),
            el('span', { class: 'block text-xs opacity-50 leading-tight', text: r.hint })));
        item.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation();
          close();
          if (r.note) {
            // Turn it on first where it is off. noteSection returns false
            // without a mounted card, so the row would have flashed a warning
            // and done nothing; enable() is idempotent when the card is already
            // up and aimed at this document. The heading's OWN document, not
            // window.document, since a render inside a frame has to be
            // annotated where it lives.
            try {
              if (!window.Annotate.enabled) window.Annotate.enable({ doc: headEl.ownerDocument });
              if (!window.Annotate.noteSection(headEl)) flash('ph-warning', 'text-warning');
            } catch { flash('ph-warning', 'text-warning'); }
            return;
          }
          const text = r.run();
          try { await copyText(text); flash('ph-check', 'text-success'); }
          catch { flash('ph-warning', 'text-warning'); }
          if (typeof o.onCopy === 'function') o.onCopy(text, sec);
        });
        menu.append(item);
      }
      document.body.append(menu);
      place();
      document.addEventListener('pointerdown', onAway, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('scroll', place, true);
      window.addEventListener('resize', place);
    };

    b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (menu) close(); else open();
    });
    return b;
  }

  // ENHANCE takes markup SOMEBODY ELSE produced and does the rest: contain it,
  // stamp its headings, declare its source. It exists because this kit is not
  // the only markdown renderer in the estate and should not have to be:
  // kits/guide-render.js renders a doc with the link re-aiming a guide body
  // needs, and the Files pane reads markdown through it. That reader wants the
  // containment and the section controls without giving up the re-aiming, and
  // a second renderer would be a second answer to what this estate's prose
  // looks like. So render() is enhance() with a parse in front of it, and a
  // host that already has a box calls the second half alone.
  //
  // The `src` it is handed must be the SOURCE THAT PRODUCED THAT MARKUP.
  // Nothing can check that, and getting it wrong is the one way this misfires:
  // the headings would pair by order against a different document and every
  // section control would copy the wrong lines.
  function enhance(box, source, o = {}) {
    if (!box) return { box: null, sections: [] };
    const src = String(source ?? '');
    contain(box, CONTAIN_OPTS(o));
    let sections = [];
    if (o.sections !== false) {
      sections = split(src);
      // Pairing by ORDER, over the box's DIRECT children. Both lists are "the
      // headings at the document's own level", taken from the same parse, so
      // they line up one to one. A mismatched length means something rewrote
      // the HTML between the parse and here, and the honest answer is to attach
      // to as many as agree rather than to guess which side is right.
      const heads = [...box.querySelectorAll(':scope > ' + H.split(',').join(', :scope > '))];
      const n = Math.min(heads.length, sections.length);
      for (let i = 0; i < n; i++) {
        const sec = sections[i];
        if (heads[i].hasAttribute('data-md-section')) continue;   // already enhanced
        heads[i].setAttribute('data-md-section', String(i));
        heads[i].id = heads[i].id || sec.slug;
        if (o.copy !== false) heads[i].append(sectionControl(sec, heads[i], o));
      }
    }
    // Declared even with no sections and even with the controls off: the
    // address is worth answering for on a document that happens to have no
    // headings, and a host that suppressed the controls has not said it wants
    // the source forgotten.
    declare(box, { addr: o.addr || {}, sections, source: src });
    return { box, sections };
  }

  function render(host, source, o = {}) {
    if (!host) return { box: null, sections: [] };
    const src = String(source ?? '');
    const marked = window.marked;
    host.textContent = '';
    if (!marked) {
      const pre = el('pre', { class: 'text-sm font-mono whitespace-pre-wrap m-0', text: src });
      host.append(pre);
      return { box: pre, sections: [] };
    }
    const box = el('div', { class: o.proseClass || PROSE });
    let out = marked.parse(src);
    if (typeof o.sanitize === 'function') out = o.sanitize(out);
    box.innerHTML = out;
    // ATTACHED FIRST, then enhanced, and the order is load-bearing rather than
    // stylistic: enhance() ends by declaring, declaring announces, and a
    // listener's honest question is "does this document hold a render now".
    // Announcing about a box still detached answers no, so the Section chip
    // stayed hidden on a page that had just rendered a document. The other
    // caller of enhance() (the Files pane) was always in this order, which is
    // why only render() had the bug.
    host.append(box);
    const { sections } = enhance(box, src, o);
    return { box, sections };
  }

  // ── The markdown hierarchy, which is not the DOM's ────────────────────────
  //
  // A rendered document has two structures over it and they do not agree. The
  // DOM's is `article > div > ul > li`; markdown's is `## Scope` inside
  // `# Working conventions`, and the second is the one a reader of the prose
  // means. Nothing in a render carries it: sections nest by RANK, and `split`
  // already knows the ranks, so the chain is arithmetic over its output rather
  // than anything that has to be walked.
  //
  // Ancestors of section i: the nearest preceding section of lower depth, then
  // ITS nearest preceding lower depth, up to the top. Innermost first, so it
  // reads like kits/peek.js's chainOf and the two can share a renderer.
  function chain(sections, i) {
    const out = [];
    let sec = sections[i];
    if (!sec) return out;
    out.push(sec);
    let want = sec.depth;
    for (let j = i - 1; j >= 0 && want > 1; j--) {
      if (sections[j].depth < want) { out.push(sections[j]); want = sections[j].depth; }
    }
    return out;
  }

  // The heading NODE for a section index, inside a declared render. `locate`
  // hands back the head for the node you asked about; this is how a caller
  // reaches the head of a DIFFERENT section, which is what walking the markdown
  // hierarchy needs. The attribute is this kit's, so the lookup is too.
  function headOf(box, index) {
    if (!box || index == null) return null;
    return box.querySelector('[data-md-section="' + index + '"]');
  }

  // The sections DIRECTLY under this one: the runs whose depth is exactly one
  // rank finer, before the next section of equal or higher rank closes it.
  function children(sections, i) {
    const sec = sections[i];
    if (!sec) return [];
    const out = [];
    for (let j = i + 1; j < sections.length; j++) {
      if (sections[j].depth <= sec.depth) break;
      if (sections[j].depth === sec.depth + 1) out.push(sections[j]);
    }
    return out;
  }

  // WHAT A SECTION IS MADE OF, counted in markdown's own units rather than the
  // DOM's. A reader asking about a passage wants to know it is four paragraphs
  // and a table, not that it is a div containing nine elements. Counted off the
  // source, so a fence's contents cannot be mistaken for the structures they
  // resemble: a ``` block full of hyphens is one code block, not a list.
  function stats(raw) {
    const src = String(raw ?? '');
    let inFence = false, fences = 0, paras = 0, blank = true;
    let bullets = 0, tables = 0, quotes = 0, heads = 0;
    for (const line of src.split('\n')) {
      if (/^\s{0,3}(```|~~~)/.test(line)) {
        if (!inFence) fences++;
        inFence = !inFence; blank = true; continue;
      }
      if (inFence) continue;
      if (!line.trim()) { blank = true; continue; }
      if (/^\s{0,3}#{1,6}\s/.test(line)) { heads++; blank = true; continue; }
      if (/^\s*([-*+]|\d+[.)])\s/.test(line)) { bullets++; blank = false; continue; }
      if (/^\s{0,3}\|/.test(line)) { if (blank) tables++; blank = false; continue; }
      if (/^\s{0,3}>/.test(line)) { if (blank) quotes++; blank = false; continue; }
      if (blank) paras++;
      blank = false;
    }
    const words = src.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
    return {
      words, chars: src.length, lines: src.split('\n').length,
      headings: Math.max(0, heads - 1),   // its own heading is not a child
      paragraphs: paras, listItems: bullets, code: fences, tables, quotes,
      links: (src.match(/\[[^\]]*\]\([^)]*\)/g) || []).length,
    };
  }

  window.mdDoc = {
    KIND, split, reference, payload, html, render, enhance, contain, declare, declaredIn, locate, sourceRef,
                   linkRepoFiles, repoPath, chain, children, stats, headOf, REVISE, _slugify: slugify };
})();
