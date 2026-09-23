// The PowerShell workspace's editor, on CodeMirror 6. It imports the same
// esm.sh module graph kits/cm6.js does (state, view, commands, language), so
// the app carries one CodeMirror. The PowerShell mode is CM6's legacy stream
// port of the CM5 tokenizer, XAML rides lang-xml, and the modules load only
// when a Code workspace opens, each import retried the way cm6.js retries.
// A textarea remains usable if loading fails.
//
// The editor shows LF while the exact source, CRLF, CR, mixed and BOM
// included, is kept beside each document and every change is mapped onto it.
// Undo and redo restore the exact bytes of the version they return to, so a
// separator deleted by a multi-line edit comes back as it was.
(() => {
  const URLS = {
    state: 'https://esm.sh/@codemirror/state',
    view: 'https://esm.sh/@codemirror/view',
    commands: 'https://esm.sh/@codemirror/commands',
    language: 'https://esm.sh/@codemirror/language',
    search: 'https://esm.sh/@codemirror/search',
    autocomplete: 'https://esm.sh/@codemirror/autocomplete',
    highlight: 'https://esm.sh/@lezer/highlight',
    powershell: 'https://esm.sh/@codemirror/legacy-modes/mode/powershell',
    xml: 'https://esm.sh/@codemirror/lang-xml',
  };
  let pending;
  const normalized = text => text.replace(/\r\n?|\n/g, '\n');
  const separator = text => text.match(/\r\n|\r|\n/)?.[0] || '\n';
  const offset = (text, pos) => {
    const endings = /\r\n|\r|\n/g; let at = 0;
    for (let line = 0; line < pos.line; line++) { const match = endings.exec(text); if (!match) return text.length; at = match.index + match[0].length; }
    return Math.min(text.length, at + pos.ch);
  };
  const applyChange = (text, change) => text.slice(0, offset(text, change.from))
    + change.text.join(separator(text)) + text.slice(offset(text, change.to));
  // Native textareas normalize their displayed value. Map one input edit back
  // onto the exact source, keeping untouched CRLF/CR separators and the BOM.
  const editText = (original, displayed) => {
    const before = normalized(original), after = normalized(displayed);
    let start = 0, endA = before.length, endB = after.length;
    while (start < endA && start < endB && before[start] === after[start]) start++;
    while (endA > start && endB > start && before[endA - 1] === after[endB - 1]) { endA--; endB--; }
    const pos = index => { const lines = before.slice(0, index).split('\n'); return { line: lines.length - 1, ch: lines.at(-1).length }; };
    return applyChange(original, { from: pos(start), to: pos(endA), text: after.slice(start, endB).split('\n') });
  };
  // Native textarea undo also stores normalized text. Keep exact versions for
  // its inputType history events, allowing the browser to coalesce several
  // keystrokes into one undo. One history belongs to one file, never the field
  // shared by several tabs. Unknown/expired history must not invent separators.
  const textHistory = (initialText, limit = 200) => {
    const versions = [String(initialText)]; let index = 0;
    return {
      value: () => versions[index],
      input(displayed, inputType = '') {
        const after = normalized(displayed), undo = inputType === 'historyUndo', redo = inputType === 'historyRedo';
        if (undo || redo) {
          for (let i = index + (undo ? -1 : 1); i >= 0 && i < versions.length; i += undo ? -1 : 1) {
            if (normalized(versions[i]) === after) { index = i; return versions[index]; }
          }
          throw new Error('That undo history is no longer available for this file. The exact draft is retained.');
        }
        const next = editText(versions[index], after);
        if (next !== versions[index]) {
          versions.splice(index + 1); versions.push(next); index++;
          if (versions.length > limit + 1) { versions.shift(); index--; }
        }
        return versions[index];
      },
    };
  };
  // An offset in the LF document, mapped onto the exact text: a CRLF pair is
  // one character to the editor and two to the source.
  const exactAt = (text, at) => {
    let i = 0, n = 0;
    while (n < at && i < text.length) { i += text[i] === '\r' && text[i + 1] === '\n' ? 2 : 1; n++; }
    return i;
  };
  // Changes arrive in the coordinates of the document before them. Applied
  // from the last one back, each earlier offset is still where it was.
  const applyChanges = (text, changes) => {
    const sep = separator(text);
    for (const c of [...changes].sort((a, b) => b.fromA - a.fromA)) {
      text = text.slice(0, exactAt(text, c.fromA)) + c.inserted.join(sep) + text.slice(exactAt(text, c.toA));
    }
    return text;
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const importOne = async url => {
    let last;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { return await import(url); }
      catch (e) { last = e; if (attempt < 3) await sleep(300 * attempt + Math.random() * 150); }
    }
    throw last;
  };
  const load = () => pending || (pending = (async () => {
    const keys = Object.keys(URLS);
    const settled = await Promise.allSettled(keys.map(k => importOne(URLS[k])));
    const m = {};
    keys.forEach((k, i) => { if (settled[i].status === 'fulfilled') m[k] = settled[i].value; });
    if (keys.some(k => !m[k]) || !m.view.EditorView || !m.powershell.powerShell) {
      throw new Error('Editor modules could not load. The plain text editor is available.');
    }
    return m;
  })().catch(e => { pending = null; throw e; }));

  async function create(host, opts = {}) {
    const m = await load();
    if (!host.isConnected) return null;
    const { EditorState, Compartment } = m.state;
    const { EditorView, keymap, lineNumbers, drawSelection, dropCursor } = m.view;
    const { history, historyKeymap, defaultKeymap, indentMore, indentLess, toggleComment, undo, redo } = m.commands;
    const { StreamLanguage, foldGutter, foldKeymap, foldService, bracketMatching, indentUnit, HighlightStyle, syntaxHighlighting } = m.language;
    const { search, searchKeymap, openSearchPanel, closeSearchPanel, searchPanelOpen, highlightSelectionMatches } = m.search;
    const { autocompletion, completionKeymap, completeAnyWord, closeBrackets, closeBracketsKeymap, startCompletion, closeCompletion, completionStatus } = m.autocomplete;
    const t = m.highlight.tags;
    const isXml = path => /\.(xaml|ps1xml)$/i.test(path || '');
    const powershell = StreamLanguage.define(m.powershell.powerShell);
    // A stream language carries no fold information of its own. Fold a line
    // that opens a brace to the line that closes it, as CM5's brace-fold did.
    const braceFold = foldService.of((state, from) => {
      const line = state.doc.lineAt(from);
      if (!line.text.replace(/#.*$/, '').trimEnd().endsWith('{')) return null;
      let depth = 0;
      for (let n = line.number; n <= state.doc.lines; n++) {
        const text = state.doc.line(n).text.replace(/#.*$/, '');
        for (const ch of text) {
          if (ch === '{') depth++;
          else if (ch === '}' && --depth === 0) {
            if (n === line.number) return null;
            const end = state.doc.line(n);
            return { from: line.to, to: end.from + end.text.indexOf('}') };
          }
        }
      }
      return null;
    });
    // The CM5 token class names, kept so the theme variants below and the
    // contrast checks read the same tokens on either editor.
    const style = HighlightStyle.define([
      { tag: t.keyword, class: 'cm-keyword' }, { tag: t.atom, class: 'cm-atom' }, { tag: t.number, class: 'cm-number' },
      { tag: t.definition(t.variableName), class: 'cm-def' }, { tag: t.standard(t.variableName), class: 'cm-builtin' },
      { tag: t.special(t.variableName), class: 'cm-variable-2' }, { tag: t.variableName, class: 'cm-variable' },
      { tag: t.string, class: 'cm-string' }, { tag: t.special(t.string), class: 'cm-string-2' }, { tag: t.comment, class: 'cm-comment' },
      { tag: t.operator, class: 'cm-operator' }, { tag: t.punctuation, class: 'cm-punctuation' }, { tag: t.invalid, class: 'cm-error' },
      { tag: t.tagName, class: 'cm-tag' }, { tag: t.attributeName, class: 'cm-attribute' }, { tag: t.attributeValue, class: 'cm-string' },
    ]);
    const cWrap = new Compartment(), cRead = new Compartment();
    let wrapOn = !!opts.wrap, readOn = !!opts.readOnly;
    const wrapExt = on => on ? EditorView.lineWrapping : [];
    const readExt = on => [EditorState.readOnly.of(on), EditorView.editable.of(!on)];
    // Colors come from the page's daisyUI variables, mixed toward the text
    // color for contrast, and live in the editor's own theme rather than in
    // Tailwind classes added at runtime: style-mod injects them with the view,
    // while a class the browser build has not seen yet is generated a beat
    // later, which a contrast check reading the first paint can catch.
    const mix = name => `color-mix(in oklab, var(--color-${name}), var(--color-base-content) 70%)`;
    const theme = EditorView.theme({
      '&': { height: '100%', fontSize: 'inherit', backgroundColor: 'var(--color-base-100)', color: 'var(--color-base-content)' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      '.cm-gutters': { backgroundColor: 'var(--color-base-100)', color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)', border: 'none' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-base-content)' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'color-mix(in oklab, var(--color-primary) 20%, transparent)' },
      '&.cm-focused': { outline: 'none' },
      '.cm-keyword': { color: mix('secondary') },
      '.cm-atom, .cm-number, .cm-builtin': { color: mix('accent') },
      '.cm-def, .cm-tag': { color: mix('primary') },
      '.cm-variable, .cm-variable-2': { color: mix('info') },
      '.cm-string, .cm-string-2': { color: mix('success') },
      '.cm-attribute': { color: mix('secondary') },
      '.cm-comment': { color: 'color-mix(in oklab, var(--color-base-content) 80%, transparent)' },
      '.cm-error': { color: 'var(--color-error)' },
    });
    let quiet = false, current = null;
    const docs = new Map();
    const remember = (record, key) => {
      record.versions.set(key, record.text);
      if (record.versions.size > 200) record.versions.delete(record.versions.keys().next().value);
    };
    const listener = EditorView.updateListener.of(u => {
      if (quiet || !current) return;
      current.state = u.state;
      if (u.docChanged) {
        const key = u.state.doc.toString();
        const historical = u.transactions.some(tr => tr.isUserEvent('undo') || tr.isUserEvent('redo'));
        // Undo stores normalized removed text inside CodeMirror. Restoring the
        // exact text kept for the version it returns to also restores any
        // CRLF/CR separator deleted by a multi-line edit, mixed documents included.
        if (historical && current.versions.has(key)) current.text = current.versions.get(key);
        else {
          const changes = [];
          u.changes.iterChanges((fromA, toA, fromB, toB, inserted) => changes.push({ fromA, toA, inserted: inserted.toString().split('\n') }));
          current.text = applyChanges(current.text, changes);
        }
        remember(current, key);
        opts.onChange?.(current.text);
      }
      if (u.selectionSet || u.docChanged) {
        const head = u.state.selection.main.head, line = u.state.doc.lineAt(head);
        opts.onCursor?.({ line: line.number, column: head - line.from + 1 });
      }
    });
    const keys = keymap.of([
      { key: 'Mod-s', run: () => { opts.onSave?.(); return true; } },
      { key: 'Ctrl-Space', run: startCompletion },
      { key: 'Mod-/', run: toggleComment },
      { key: 'Tab', run: v => v.state.selection.ranges.some(r => !r.empty) ? indentMore(v) : (v.dispatch(v.state.replaceSelection('    ')), true), shift: indentLess },
      { key: 'Escape', run: v => {
        if (completionStatus(v.state)) { closeCompletion(v); return true; }
        if (searchPanelOpen(v.state)) { closeSearchPanel(v); return true; }
        host.dispatchEvent(new CustomEvent('editor-escape', { bubbles: true }));
        return true;
      } },
    ]);
    const extensions = path => [
      lineNumbers(), foldGutter(), history(), drawSelection(), dropCursor(),
      indentUnit.of('    '), EditorState.tabSize.of(4), bracketMatching(), closeBrackets(), highlightSelectionMatches(),
      autocompletion({ override: [completeAnyWord], activateOnTyping: false }), search({ top: true }),
      isXml(path) ? m.xml.xml() : [powershell, braceFold], syntaxHighlighting(style),
      cWrap.of(wrapExt(wrapOn)), cRead.of(readExt(readOn)),
      keys, keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap]),
      theme, listener,
    ];
    const view = new EditorView({ parent: host, state: EditorState.create({ doc: normalized(opts.value || ''), extensions: extensions(opts.path) }) });
    host.__editor = view;
    view.dom.classList.add('!text-base');
    const settle = () => view.dispatch({ effects: [cWrap.reconfigure(wrapExt(wrapOn)), cRead.reconfigure(readExt(readOn))] });
    return {
      open(key, text, path) {
        quiet = true;
        let record = docs.get(key);
        if (!record) {
          record = { state: EditorState.create({ doc: normalized(text), extensions: extensions(path) }), text, versions: new Map() };
          docs.set(key, record);
        }
        current = record;
        view.setState(record.state);
        if (record.text !== text) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: normalized(text) } });
        record.text = text;
        settle();
        record.state = view.state;
        remember(record, view.state.doc.toString());
        quiet = false;
        view.requestMeasure();
      },
      value: () => current?.text || '',
      go(line) {
        const target = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, line || 1)));
        view.dispatch({ selection: { anchor: target.from }, effects: EditorView.scrollIntoView(target.from, { y: 'center' }) });
        view.focus();
      },
      command(name) {
        if (name === 'undo') { undo(view); return; }
        if (name === 'redo') { redo(view); return; }
        if (name !== 'find' && name !== 'replace') return;
        openSearchPanel(view);
        const field = view.dom.querySelector('.cm-panel.cm-search input[name=search]');
        if (field) { field.focus(); field.select(); }
      },
      wrap(value) { wrapOn = !!value; view.dispatch({ effects: cWrap.reconfigure(wrapExt(wrapOn)) }); view.requestMeasure(); },
      readOnly(value) { readOn = !!value; view.dispatch({ effects: cRead.reconfigure(readExt(readOn)) }); },
      refresh() { view.requestMeasure(); },
      focus() { view.focus(); },
      destroy() { docs.clear(); view.destroy(); delete host.__editor; },
    };
  }
  window.PowerShellEditor = { create, editText, textHistory, displayText: normalized };
})();
