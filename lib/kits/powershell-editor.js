// The PowerShell workspace's editor. CodeMirror 5 is already vendored by the
// app and supplies PowerShell/XML modes, history, folding and search. Load it
// only when a Code workspace opens. A textarea remains usable if loading fails.
(() => {
  const base = 'https://cdn.jsdelivr.net/combine/';
  const pkg = 'npm/codemirror@5.65.21/';
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
  const assets = (files, css = false) => new Promise((resolve, reject) => {
    const el = document.createElement(css ? 'link' : 'script');
    const url = base + files.map(f => pkg + f).join(',');
    if (css) { el.rel = 'stylesheet'; el.href = url; }
    else { el.src = url; el.async = true; }
    el.onload = resolve;
    el.onerror = () => { el.remove(); reject(new Error('Editor assets could not load. The plain text editor is available.')); };
    document.head.append(el);
  });
  const load = () => pending || (pending = (async () => {
    await assets(['lib/codemirror.css', 'addon/fold/foldgutter.css', 'addon/dialog/dialog.css', 'addon/hint/show-hint.css'], true);
    if (!window.CodeMirror) await assets(['lib/codemirror.js']);
    await assets(['mode/powershell/powershell.js', 'mode/xml/xml.js',
      'addon/edit/matchbrackets.js', 'addon/edit/closebrackets.js',
      'addon/fold/foldcode.js', 'addon/fold/foldgutter.js', 'addon/fold/brace-fold.js', 'addon/fold/xml-fold.js',
      'addon/dialog/dialog.js', 'addon/search/searchcursor.js', 'addon/search/search.js',
      'addon/comment/comment.js', 'addon/hint/show-hint.js', 'addon/hint/anyword-hint.js']);
    return window.CodeMirror;
  })().catch(e => { pending = null; throw e; }));

  async function create(host, opts = {}) {
    const CM = await load();
    if (!host.isConnected) return null;
    const mode = path => /\.(xaml|ps1xml)$/i.test(path) ? 'application/xml' : 'powershell';
    let quiet = false, current = null;
    const editor = CM(host, {
      value: normalized(opts.value || ''), mode: mode(opts.path), lineNumbers: true,
      lineWrapping: !!opts.wrap, indentUnit: 4, tabSize: 4, indentWithTabs: false,
      matchBrackets: true, autoCloseBrackets: true, foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      viewportMargin: 15, readOnly: !!opts.readOnly,
      // Display LF, then map each editor change onto the exact source below.
      // CodeMirror's own document model cannot retain mixed line endings.
      lineSeparator: '\n',
      extraKeys: {
        'Ctrl-S': () => opts.onSave?.(), 'Cmd-S': () => opts.onSave?.(),
        'Ctrl-Space': 'autocomplete', 'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
        Tab: cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('    '),
        'Shift-Tab': cm => cm.indentSelection('subtract'),
        Esc: cm => { if (cm.state.completionActive) cm.state.completionActive.close(); else host.dispatchEvent(new CustomEvent('editor-escape', { bubbles: true })); },
      },
    });
    editor.setSize('100%', '100%');
    editor.getWrapperElement().classList.add('!bg-base-100', '!text-base-content', '!text-base', '!font-mono',
      '[&_.cm-keyword]:!text-secondary', '[&_.cm-atom]:!text-accent', '[&_.cm-number]:!text-accent',
      '[&_.cm-def]:!text-primary', '[&_.cm-builtin]:!text-accent', '[&_.cm-variable-2]:!text-info', '[&_.cm-string]:!text-success',
      '[&_.cm-comment]:!text-base-content/60', '[&_.cm-tag]:!text-primary', '[&_.cm-attribute]:!text-secondary');
    const remember = record => {
      const generation = record.doc.changeGeneration();
      record.versions.set(generation, record.text);
      // CodeMirror getHistory() deliberately strips generation numbers. Read
      // those numbers from the vendored CM5 history so the exact-text map keeps
      // only versions the editor can still undo/redo to, plus its current text.
      const reachable = new Set([generation]);
      for (const side of ['done', 'undone']) {
        for (const event of record.doc.history[side]) if (event.generation !== undefined) reachable.add(event.generation);
      }
      for (const key of record.versions.keys()) if (!reachable.has(key)) record.versions.delete(key);
    };
    editor.on('changes', (_cm, changes) => {
      if (quiet || !current) return;
      const generation = current.doc.changeGeneration();
      const historical = changes.every(change => change.origin === 'undo' || change.origin === 'redo');
      // Undo stores normalized removed text inside CodeMirror. Restoring the
      // exact text for its destination generation also restores any CRLF/CR
      // separator deleted by a multi-line edit, including mixed documents.
      if (historical && current.versions.has(generation)) current.text = current.versions.get(generation);
      else for (const change of changes) current.text = applyChange(current.text, change);
      remember(current);
      opts.onChange?.(current.text);
    });
    editor.on('cursorActivity', () => { const p = editor.getCursor(); opts.onCursor?.({ line: p.line + 1, column: p.ch + 1 }); });
    const docs = new Map();
    return {
      open(key, text, path) {
        quiet = true;
        let record = docs.get(key);
        if (!record) {
          record = { doc: new CM.Doc(normalized(text), mode(path), 0, '\n'), text, versions: new Map() };
          docs.set(key, record); remember(record);
        }
        current = record;
        editor.swapDoc(record.doc);
        if (record.text !== text) record.doc.setValue(normalized(text));
        record.text = text;
        remember(record);
        quiet = false;
        editor.refresh();
      },
      value: () => current?.text || '',
      go(line) { const pos = { line: Math.max(0, Math.min(editor.lineCount() - 1, line - 1)), ch: 0 }; editor.setCursor(pos); editor.scrollIntoView(pos, 80); editor.focus(); },
      command(name) { editor.execCommand(name); },
      wrap(value) { editor.setOption('lineWrapping', !!value); editor.refresh(); },
      readOnly(value) { editor.setOption('readOnly', !!value); },
      refresh() { editor.refresh(); },
      focus() { editor.focus(); },
      destroy() { docs.clear(); editor.getWrapperElement().remove(); },
    };
  }
  window.PowerShellEditor = { create, editText, textHistory, displayText: normalized };
})();
