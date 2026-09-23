// Associate submitted text with one file at one repository revision. The
// declaration names a PowerShell file; a selected XAML file supplies its own
// address. Checks and unfinished submissions live in browser-local IndexedDB.
(() => {
  const ROOT = 'wpsCorrespondence';
  const POWERSHELL = /\.(?:ps1|psm1|psd1|ps1xml)$/i;
  const COMPARABLE = /\.(?:ps1|psm1|psd1|ps1xml|xaml)$/i;
  const validPath = (path, types = POWERSHELL) => !!path && !/^(?:\/|\\|[a-z]+:)/i.test(path)
    && !/[\\:#?\x00-\x1f]/.test(path) && !path.split('/').some(s => !s || s === '.' || s === '..')
    && types.test(path);
  const declaration = text => {
    const paths = new Set();
    // Recognize physical lines without changing the supplied source. A BOM
    // is already whitespace to this pattern. Repeated signatures may name
    // the same file; different identities must not silently choose the first.
    for (const line of String(text || '').split(/\r\n?|\n/)) {
      if (!/^\s*#\s*@file\b/i.test(line)) continue;
      const path = (line.match(/^\s*#\s*@file\s+(.+?)\s*$/i) || [])[1] || '';
      if (!validPath(path)) throw new Error('The # @file line needs a PowerShell file path relative to the repository root.');
      paths.add(path);
    }
    if (paths.size > 1) throw new Error('The text contains conflicting # @file declarations. Keep one repository-relative file identity before comparing.');
    return paths.values().next().value || '';
  };
  const applies = target => !!target?.repo && validPath(target.path, COMPARABLE);
  const same = (a, b) => !!a && !!b && a.repo === b.repo && a.path === b.path
    && (a.ref || '') === (b.ref || '');
  const normalizedLines = text => text.replace(/\r\n?/g, '\n');
  const decodeBytes = (bytes, encoding = 'auto') => {
    if (!bytes) throw new Error('No file bytes were supplied.');
    if (!bytes.length) throw new Error('The comparison file is empty.');
    const bom = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : '';
    const chosen = encoding === 'auto' ? bom || 'utf-8' : encoding;
    if (!['utf-8', 'utf-16le', 'utf-16be', 'windows-1252'].includes(chosen))
      throw new Error('Unsupported comparison file encoding.');
    try {
      const text = new TextDecoder(chosen, { fatal: true }).decode(bytes);
      if (text.includes('\u0000')) throw new Error('The decoded file contains NUL characters.');
      return text;
    } catch (e) {
      throw new Error('Could not decode comparison file as ' + chosen
        + '. Choose its encoding and try again. ' + (e?.message || e));
    }
  };
  const digest = async text => {
    const bytes = new TextEncoder().encode(text);
    const hash = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  };
  const collection = kind => {
    if (!window.persistence) throw new Error('Browser-local correspondence storage is unavailable.');
    return window.persistence.collection(ROOT + '.' + kind);
  };
  const history = async target => (await collection('checks').find(r => r.repo === target.repo && r.path === target.path))
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  const pending = async repo => (await collection('pending').find(r => r.repo === repo))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  // Every check under a folder, newest first: the Installation pill reads a
  // whole workspace's checks in one pass rather than one lookup per file.
  const checksUnder = async (repo, prefix) => (await collection('checks').find(r => r.repo === repo && r.path.startsWith(prefix)))
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  const stageLocal = (text, name, previous) => {
    const store = window.Alpine.store('browser');
    let local = previous && (store.stage || []).find(it => it.local
      && it.correspondencePendingId === previous.id && it.text === text);
    if (!local) {
      local = window.StageIntake.textItem(name, text);
      store.stage = [...(store.stage || []), local];
    }
    return local;
  };
  const stagePair = (target, sha, file, local) => {
    const store = window.Alpine.store('browser');
    const candidate = { repo: target.repo, ref: sha, path: target.path,
      correspondenceText: file.text, correspondenceBlob: file.sha };
    const key = window.StageIntake.keyOf(candidate);
    let refItem = (store.stage || []).find(it => !it.local && window.StageIntake.keyOf(it) === key);
    if (refItem) {
      refItem.correspondenceText = file.text;
      refItem.correspondenceBlob = file.sha;
    } else {
      refItem = candidate;
      store.stage = [...(store.stage || []), refItem];
    }
    local.correspondenceFor = key;
    store.stageCompare = { a: key, b: window.StageIntake.keyOf(local) };
    store.stageFocus = '';
    return refItem;
  };
  const retainedError = (error, pendingSaved) => {
    const e = new Error(error?.message || String(error));
    e.retained = true;
    e.pendingSaved = pendingSaved;
    return e;
  };
  const open = async ({ target, text, name = '', source = 'paste', record = true,
    revision = '', pendingRecord = null }) => {
    if (!applies(target)) throw new Error('Choose a repository PowerShell or XAML file first.');
    if (typeof text !== 'string' || !text.length) throw new Error('No text was supplied for comparison.');
    const incomingName = name || target.path.split('/').pop();
    let local, unfinished;
    if (record) {
      local = stageLocal(text, incomingName, pendingRecord);
      try {
        unfinished = await collection('pending').put({ ...pendingRecord,
          submittedAt: pendingRecord?.submittedAt || new Date().toISOString(),
          repo: target.repo, branch: target.ref || '', path: target.path,
          originalPath: pendingRecord?.originalPath || target.path,
          incomingName, source, content: text,
          attempts: (pendingRecord?.attempts || 0) + 1, lastError: '' });
        local.correspondencePendingId = unfinished.id;
      } catch (e) {
        window.Alpine.store('browser').stageFocus = window.StageIntake.keyOf(local);
        throw retainedError(e, false);
      }
    }
    let sha, file;
    try {
      const gh = new window.GH({ token: window.TOKEN, repo: target.repo });
      const ref = revision || target.ref || '';
      const commits = await gh.req('commits?' + (ref ? 'sha=' + encodeURIComponent(ref) + '&' : '') + 'per_page=1');
      sha = commits?.[0]?.sha;
      if (!sha) throw new Error('Could not resolve the repository revision.');
      gh.ref = sha;
      file = await gh.get(target.path);
    } catch (e) {
      if (unfinished) {
        try { await collection('pending').put({ ...unfinished, lastError: e?.message || String(e) }); }
        catch { /* The staged text and original pending record remain available. */ }
        window.Alpine.store('browser').stageFocus = window.StageIntake.keyOf(local);
        throw retainedError(e, true);
      }
      throw e;
    }
    if (!local) local = stageLocal(text, incomingName);
    const exact = text === file.text;
    const lineEndingsOnly = !exact && normalizedLines(text) === normalizedLines(file.text);
    const recordValue = {
      checkedAt: new Date().toISOString(), repo: target.repo, branch: target.ref || '',
      revision: sha, path: target.path, blobSha: file.sha,
      incomingName, source, incomingSha256: await digest(text), content: text, exact, lineEndingsOnly,
      observation: exact ? 'Submitted text matched this repository revision exactly.'
        : lineEndingsOnly ? 'Submitted text differed only in line endings from this repository revision.'
                          : 'Submitted text differed from this repository revision.',
      installation: 'The saved work-computer file was not inspected.',
    };
    let saved = false;
    if (record) {
      try { await collection('checks').put(recordValue); saved = true; }
      catch (e) { window.Alpine?.store('toast')?.('warning', 'Comparison opened, but its check was not saved: ' + (e?.message || e), 'alert-warning', 6000); }
    }
    const refItem = stagePair(target, sha, file, local);
    if (saved && unfinished) {
      try { await collection('pending').delete(unfinished.id); }
      catch (e) { window.Alpine?.store('toast')?.('warning', 'Comparison saved, but its pending copy could not be removed: ' + (e?.message || e), 'alert-warning', 6000); }
    }
    return { record: recordValue, saved, refItem, local };
  };
  const retry = (submission, target = null) => open({
    target: target || { repo: submission.repo, ref: submission.branch, path: submission.path },
    text: submission.content, name: submission.incomingName, source: submission.source,
    pendingRecord: submission,
  });
  const reopen = record => open({ target: { repo: record.repo, ref: record.branch, path: record.path },
    text: record.content, name: record.incomingName, source: record.source,
    record: false, revision: record.revision });
  window.FileCorrespondence = { declaration, validPath, applies, same, decodeBytes,
    history, pending, checksUnder, open, retry, reopen };
})();
