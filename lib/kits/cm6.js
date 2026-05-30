// kits/cm6.js — framework-free CodeMirror 6 editor factory. No Alpine, no DOM
// opinions beyond mounting into the host you pass. The CM6 modules load lazily
// (and once) on first create(); shared deps are deduped by esm.sh.
//
// This is the plumbing the Alpine components (cm-editor, compress-input-cm)
// re-implement inline today; they can fold onto it. Used directly by
// vanilla-demo.js for the editor in each demo block.
//
// Usage:
//   const ed = await cm6.create(hostEl, {
//     value, language, wrap, lineNumbers, readOnly, fontSize, setup,
//     onChange, onSelection, onRun
//   });
//   ed.getValue(); ed.setValue(str);
//   ed.setLanguage('js'|'html'|'plain'); ed.setWrap(bool);
//   ed.setLineNumbers(bool); ed.setReadOnly(bool); ed.setFontSize(px);
//   ed.focus(); ed.destroy(); ed.view;
//
//   - onRun, if given, binds Mod-Enter (Cmd/Ctrl-Enter) to call it.
//   - setup: 'minimal' (default) or 'basic'. minimal is history + default
//     keymap + drawSelection + syntax highlighting, for a clean snippet
//     editor. 'basic' is CodeMirror's basicSetup (line numbers, fold gutter,
//     autocomplete, search, bracket matching, …) — what the richer Alpine
//     editors want. With 'basic', line numbers come from the setup itself, so
//     leave setLineNumbers alone to avoid a duplicate gutter.
//   - destroy() tears the view down (call on host teardown to avoid leaks).

(() => {
  let modsPromise = null;

  // Keyed so a failure can name the URL it came from. allSettled (vs Promise.all)
  // lets us report *every* failing import, not just the first to reject — the
  // generic WebKit "Importing a module script failed." names none of the six.
  const CM6_URLS = {
    cm:       'https://esm.sh/codemirror',
    state:    'https://esm.sh/@codemirror/state',
    view:     'https://esm.sh/@codemirror/view',
    commands: 'https://esm.sh/@codemirror/commands',
    js:       'https://esm.sh/@codemirror/lang-javascript',
    html:     'https://esm.sh/@codemirror/lang-html',
  };

  // Per-import settle state, so a stall stays attributable. A hung import()
  // leaves Promise.allSettled (and thus mods()) pending forever — it never
  // rejects, so failedImports never exists and unhandledrejection never fires.
  // loadStatus() then names which URL(s) are still pending vs. which fulfilled
  // (and how fast): the only signal a true hang leaves behind.
  const loadStatus = {};
  let loadStartedAt = null;

  // esm.sh occasionally drops one fetch in the shared CM6 module graph under
  // Mobile Safari; because the packages share sub-deps, that one failure can
  // reject several top-level imports at once (observed: five rejecting at the
  // same ms, the URL healthy on re-probe, recovered on reload). We can't
  // prevent the transient, so we absorb it — each import retries with backoff.
  const MAX_ATTEMPTS = 3;
  const RETRY_BASE_MS = 300;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const mods = () => modsPromise || (modsPromise = (async () => {
    const keys = Object.keys(CM6_URLS);
    const t0 = performance.now();
    loadStartedAt = Date.now();
    // Diagnostic switches (no effect without the param):
    //   ?cm6stall=<key|comma-list|all>  — named import(s) hang forever, to
    //     reproduce the timeout/stall path and confirm attribution.
    //   ?cm6fail=<key[:n],…>            — named import fails its first n
    //     attempts (n omitted = every attempt), to exercise retry: :1/:2
    //     should recover, a bare key should exhaust and surface the notice.
    const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const stallParam = params && params.get('cm6stall');
    const stalled = stallParam ? new Set(stallParam === 'all' ? keys : stallParam.split(',').map(s => s.trim())) : null;
    const forceFail = new Map();
    if (params && params.get('cm6fail')) params.get('cm6fail').split(',').forEach(s => {
      const [k, n] = s.split(':');
      forceFail.set(k.trim(), n === undefined ? Infinity : Number(n));
    });

    const loadOne = async (key) => {
      const url = CM6_URLS[key];
      let lastErr;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        loadStatus[key] = { url, state: 'pending', attempt };
        try {
          if (forceFail.has(key) && attempt <= forceFail.get(key)) throw new Error(`cm6fail: forced (attempt ${attempt})`);
          const m = await import(url);
          loadStatus[key] = { url, state: 'fulfilled', ms: Math.round(performance.now() - t0), attempt };
          return m;
        } catch (e) {
          lastErr = e;
          const exhausted = attempt >= MAX_ATTEMPTS;
          loadStatus[key] = { url, state: exhausted ? 'rejected' : 'retrying', ms: Math.round(performance.now() - t0), attempt, reason: String((e && e.message) || e) };
          if (!exhausted) await sleep(RETRY_BASE_MS * attempt + Math.random() * 150);  // jitter so retries don't re-align into one burst
        }
      }
      throw lastErr;
    };

    keys.forEach(k => { loadStatus[k] = { url: CM6_URLS[k], state: 'pending' }; });
    const settled = await Promise.allSettled(keys.map(k =>
      stalled && stalled.has(k)
        ? new Promise(() => {})   // never settles — leaves loadStatus[k] 'pending'
        : loadOne(k)
    ));
    const durationMs = Math.round(performance.now() - t0);

    const got = {};
    const failedImports = [];
    settled.forEach((r, i) => {
      const key = keys[i];
      if (r.status === 'fulfilled') got[key] = r.value;
      else failedImports.push({ key, url: CM6_URLS[key], reason: String((r.reason && r.reason.message) || r.reason) });
    });
    if (failedImports.length) {
      const err = new Error(`cm6: ${failedImports.length}/${keys.length} module imports failed (${durationMs}ms): ${failedImports.map(f => f.url).join(', ')}`);
      err.failedImports = failedImports;
      err.durationMs = durationMs;
      throw err;
    }

    const { cm, state, view, commands, js, html } = got;
    return {
      EditorView: cm.EditorView,
      minimalSetup: cm.minimalSetup,
      basicSetup: cm.basicSetup,
      EditorState: state.EditorState,
      Compartment: state.Compartment,
      Prec: state.Prec,
      keymap: view.keymap,
      lineNumbers: view.lineNumbers,
      indentWithTab: commands.indentWithTab,
      javascript: js.javascript,
      htmlLang: html.html,
    };
  })());

  const langExt = (m, lang) =>
    lang === 'js' ? m.javascript() : lang === 'html' ? m.htmlLang() : [];

  async function create(parent, opts = {}) {
    const m = await mods();
    const {
      value = '', language = 'plain', wrap = true,
      lineNumbers = false, readOnly = false, fontSize = 13,
      setup = 'minimal', onChange, onSelection, onRun,
    } = opts;
    const setupExt = setup === 'basic' ? m.basicSetup : m.minimalSetup;

    const cLang = new m.Compartment();
    const cWrap = new m.Compartment();
    const cNums = new m.Compartment();
    const cRead = new m.Compartment();
    const cTheme = new m.Compartment();

    const themeExt = px => m.EditorView.theme({
      '&': { fontSize: px + 'px', backgroundColor: 'transparent' },
      '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
      '&.cm-focused': { outline: 'none' },
    });

    let suppress = false;
    const listener = m.EditorView.updateListener.of(u => {
      if (suppress) return;
      if (u.docChanged) onChange?.(u.state.doc.toString());
      if ((u.docChanged || u.selectionSet) && onSelection) {
        const r = u.state.selection.main;
        onSelection(r.from !== r.to
          ? { start: r.from, end: r.to, text: u.state.doc.sliceString(r.from, r.to) }
          : null);
      }
    });

    const runKeys = onRun
      ? m.Prec.high(m.keymap.of([{ key: 'Mod-Enter', run: () => (onRun(), true) }]))
      : [];

    const view = new m.EditorView({
      parent,
      state: m.EditorState.create({
        doc: value,
        extensions: [
          setupExt,
          m.keymap.of([m.indentWithTab]),
          runKeys,
          cLang.of(langExt(m, language)),
          cWrap.of(wrap ? m.EditorView.lineWrapping : []),
          cNums.of(lineNumbers ? m.lineNumbers() : []),
          cRead.of(m.EditorState.readOnly.of(readOnly)),
          cTheme.of(themeExt(fontSize)),
          listener,
        ],
      }),
    });

    const reconf = (c, ext) => view.dispatch({ effects: c.reconfigure(ext) });

    return {
      view,
      getValue: () => view.state.doc.toString(),
      setValue(v) {
        suppress = true;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
        suppress = false;
      },
      setLanguage: l => reconf(cLang, langExt(m, l)),
      setWrap: w => reconf(cWrap, w ? m.EditorView.lineWrapping : []),
      setLineNumbers: n => reconf(cNums, n ? m.lineNumbers() : []),
      setReadOnly: r => reconf(cRead, m.EditorState.readOnly.of(r)),
      setFontSize: px => reconf(cTheme, themeExt(px)),
      focus: () => view.focus(),
      destroy: () => view.destroy(),
    };
  }

  window.cm6 = {
    create,
    preload: mods,
    loadStatus: () => ({
      startedAt: loadStartedAt,
      elapsedMs: loadStartedAt != null ? Date.now() - loadStartedAt : null,
      imports: { ...loadStatus },
    }),
  };
})();
