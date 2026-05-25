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
//     value, language, wrap, lineNumbers, readOnly, fontSize, onChange, onSelection, onRun
//   });
//   ed.getValue(); ed.setValue(str);
//   ed.setLanguage('js'|'html'|'plain'); ed.setWrap(bool);
//   ed.setLineNumbers(bool); ed.setReadOnly(bool); ed.setFontSize(px); ed.focus();
//
//   - onRun, if given, binds Mod-Enter (Cmd/Ctrl-Enter) to call it.
//
// Built on minimalSetup (history, default keymap, drawSelection, syntax
// highlighting) — deliberately no fold gutter or autocomplete, for a clean
// snippet editor. Line numbers ride a compartment so they can toggle live;
// minimalSetup omits them by default.

(() => {
  let modsPromise = null;
  const mods = () => modsPromise || (modsPromise = Promise.all([
    import('https://esm.sh/codemirror'),
    import('https://esm.sh/@codemirror/state'),
    import('https://esm.sh/@codemirror/view'),
    import('https://esm.sh/@codemirror/commands'),
    import('https://esm.sh/@codemirror/lang-javascript'),
    import('https://esm.sh/@codemirror/lang-html'),
  ]).then(([cm, state, view, commands, js, html]) => ({
    EditorView: cm.EditorView,
    minimalSetup: cm.minimalSetup,
    EditorState: state.EditorState,
    Compartment: state.Compartment,
    Prec: state.Prec,
    keymap: view.keymap,
    lineNumbers: view.lineNumbers,
    indentWithTab: commands.indentWithTab,
    javascript: js.javascript,
    htmlLang: html.html,
  })));

  const langExt = (m, lang) =>
    lang === 'js' ? m.javascript() : lang === 'html' ? m.htmlLang() : [];

  async function create(parent, opts = {}) {
    const m = await mods();
    const {
      value = '', language = 'plain', wrap = true,
      lineNumbers = false, readOnly = false, fontSize = 13,
      onChange, onSelection, onRun,
    } = opts;

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
          m.minimalSetup,
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
    };
  }

  window.cm6 = { create, preload: mods };
})();
