// kits/cm6-merge.js — framework-free CodeMirror 6 *diff* factory: read-only
// side-by-side and unified merge views over two versions of a text. The
// display sibling of kits/cm6.js (the editor factory): same esm.sh module
// loading with per-import retry, same lazy first-use load, no Alpine, no DOM
// opinions beyond mounting into the host you pass.
//
// Usage:
//   const h = await cm6Merge.split(hostEl, { a, b, language, wrap, collapse });
//   const h = await cm6Merge.unified(hostEl, { original, doc, language, wrap, collapse });
//   h.view       // MergeView (split) or EditorView (unified)
//   h.destroy()  // tear down (call on host teardown to avoid leaks)
//
//   - split:   a = old text, b = new text, rendered as two linked panes with
//              word-level change highlighting and an aligning gutter.
//   - unified: original = old text, doc = new text, rendered as one pane with
//              inline deletions (read-only, so no per-chunk revert controls).
//   - language: 'js' | 'html' | 'json' | 'css' | 'md' | 'plain' (default), or
//              derive it from a filename with cm6Merge.langFor(path).
//   - wrap:     line wrapping (default true — these render inside cards).
//   - collapse: fold unchanged stretches behind an expandable bar (default
//              true; the point of a review view is the changed lines).
//
// Both views are read-only by construction (readOnly + !editable on every
// pane): this kit presents diffs, it does not merge. cm6Merge.preload()
// starts the module fetch early without rendering anything.

(() => {
  let modsPromise = null;

  // Keyed so a failure can name the URL it came from; allSettled reports every
  // failing import. Same rationale and retry shape as kits/cm6.js: esm.sh
  // occasionally drops one fetch in a shared module graph (seen on Mobile
  // Safari), so each import retries with jittered backoff. esm.sh dedupes the
  // sub-deps these share with cm6.js, so a page loading both kits pays for
  // the common modules once.
  const URLS = {
    merge: 'https://esm.sh/@codemirror/merge',
    cm:    'https://esm.sh/codemirror',
    state: 'https://esm.sh/@codemirror/state',
    view:  'https://esm.sh/@codemirror/view',
    js:    'https://esm.sh/@codemirror/lang-javascript',
    html:  'https://esm.sh/@codemirror/lang-html',
    json:  'https://esm.sh/@codemirror/lang-json',
    css:   'https://esm.sh/@codemirror/lang-css',
    md:    'https://esm.sh/@codemirror/lang-markdown',
  };

  const MAX_ATTEMPTS = 3;
  const RETRY_BASE_MS = 300;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const mods = () => modsPromise || (modsPromise = (async () => {
    const keys = Object.keys(URLS);

    const loadOne = async (key) => {
      let lastErr;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try { return await import(URLS[key]); }
        catch (e) {
          lastErr = e;
          if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_MS * attempt + Math.random() * 150);
        }
      }
      throw lastErr;
    };

    const settled = await Promise.allSettled(keys.map(loadOne));
    const got = {};
    const failed = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') got[keys[i]] = r.value;
      else failed.push(URLS[keys[i]]);
    });
    if (failed.length) {
      throw new Error(`cm6-merge: ${failed.length}/${keys.length} module imports failed: ${failed.join(', ')}`);
    }

    return {
      MergeView: got.merge.MergeView,
      unifiedMergeView: got.merge.unifiedMergeView,
      minimalSetup: got.cm.minimalSetup,
      EditorState: got.state.EditorState,
      EditorView: got.view.EditorView,
      lineNumbers: got.view.lineNumbers,
      langs: {
        js:   got.js.javascript,
        html: got.html.html,
        json: got.json.json,
        css:  got.css.css,
        md:   got.md.markdown,
      },
    };
  })());

  const EXT_LANG = {
    js: 'js', mjs: 'js', cjs: 'js', ts: 'js', jsx: 'js', tsx: 'js',
    html: 'html', htm: 'html',
    json: 'json',
    css: 'css',
    md: 'md', markdown: 'md',
  };
  const langFor = (path) => EXT_LANG[String(path || '').split('.').pop().toLowerCase()] || 'plain';

  const langExt = (m, lang) => (m.langs[lang] ? m.langs[lang]() : []);

  // Shared per-pane extensions: read-only, line numbers, quiet theme.
  const paneExts = (m, { language, wrap }) => [
    m.minimalSetup,
    m.lineNumbers(),
    langExt(m, language),
    wrap ? m.EditorView.lineWrapping : [],
    m.EditorState.readOnly.of(true),
    m.EditorView.editable.of(false),
    m.EditorView.theme({
      '&': { fontSize: '12px', backgroundColor: 'transparent' },
      '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
      '&.cm-focused': { outline: 'none' },
    }),
  ];

  const collapseOpt = (collapse) => collapse ? { margin: 3, minSize: 4 } : undefined;

  async function split(parent, opts = {}) {
    const m = await mods();
    const { a = '', b = '', language = 'plain', wrap = true, collapse = true } = opts;
    const view = new m.MergeView({
      parent,
      a: { doc: a, extensions: paneExts(m, { language, wrap }) },
      b: { doc: b, extensions: paneExts(m, { language, wrap }) },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: collapseOpt(collapse),
    });
    return { view, destroy: () => view.destroy() };
  }

  async function unified(parent, opts = {}) {
    const m = await mods();
    const { original = '', doc = '', language = 'plain', wrap = true, collapse = true } = opts;
    const view = new m.EditorView({
      parent,
      state: m.EditorState.create({
        doc,
        extensions: [
          paneExts(m, { language, wrap }),
          m.unifiedMergeView({
            original,
            highlightChanges: true,
            gutter: true,
            mergeControls: false,
            collapseUnchanged: collapseOpt(collapse),
          }),
        ],
      }),
    });
    return { view, destroy: () => view.destroy() };
  }

  window.cm6Merge = { split, unified, langFor, preload: mods };
})();
