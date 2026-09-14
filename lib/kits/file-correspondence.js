// Associate submitted PowerShell text with one file at one repository revision.
// The declaration contains only a repository-relative path; the app supplies
// the repository and ref. Checks live in IndexedDB, beyond the temporary Stage.
(() => {
  const ROOT = 'wpsCorrespondence.checks';
  const TYPES = /\.(?:ps1|psm1|psd1|ps1xml)$/i;
  const validPath = path => !!path && !/^(?:\/|\\|[a-z]+:)/i.test(path)
    && !/[\\:#?\x00-\x1f]/.test(path) && !path.split('/').some(s => !s || s === '.' || s === '..')
    && TYPES.test(path);
  const declaration = text => {
    const line = String(text || '').split(/\r?\n/).find(s => /^\s*#\s*@file\b/i.test(s));
    if (!line) return '';
    const path = (line.match(/^\s*#\s*@file\s+(.+?)\s*$/i) || [])[1] || '';
    if (!validPath(path)) throw new Error('The # @file line needs a PowerShell file path relative to the repository root.');
    return path;
  };
  const applies = target => !!target?.repo && validPath(target.path);
  const same = (a, b) => !!a && !!b && a.repo === b.repo && a.path === b.path
    && (a.ref || '') === (b.ref || '');
  const digest = async text => {
    const bytes = new TextEncoder().encode(text);
    const hash = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  };
  const checks = () => {
    if (!window.persistence) throw new Error('Check storage is unavailable.');
    return window.persistence.collection(ROOT);
  };
  const history = async target => (await checks().find(r => r.repo === target.repo && r.path === target.path))
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));

  const open = async ({ target, text, name = '', source = 'paste', record = true, revision = '' }) => {
    if (!applies(target)) throw new Error('Choose a repository PowerShell file first.');
    if (typeof text !== 'string' || !text.length) throw new Error('No text was supplied for comparison.');
    const gh = new window.GH({ token: window.TOKEN, repo: target.repo });
    const ref = revision || target.ref || '';
    const commits = await gh.req('commits?' + (ref ? 'sha=' + encodeURIComponent(ref) + '&' : '') + 'per_page=1');
    const sha = commits?.[0]?.sha;
    if (!sha) throw new Error('Could not resolve the repository revision.');
    gh.ref = sha;
    const file = await gh.get(target.path);
    const exact = text === file.text;
    const recordValue = {
      checkedAt: new Date().toISOString(), repo: target.repo, branch: target.ref || '',
      revision: sha, path: target.path, blobSha: file.sha,
      incomingName: name || target.path.split('/').pop(), source,
      incomingSha256: await digest(text), content: text, exact,
      observation: exact ? 'Submitted text matched this repository revision exactly.'
                         : 'Submitted text differed from this repository revision.',
      installation: 'The saved work-computer file was not inspected.',
    };
    let saved = false;
    if (record) {
      try { await checks().put(recordValue); saved = true; }
      catch (e) { window.Alpine?.store('toast')?.('warning', 'Comparison opened, but its check was not saved: ' + (e?.message || e), 'alert-warning', 6000); }
    }
    const refItem = { repo: target.repo, ref: sha, path: target.path,
                      correspondenceText: file.text, correspondenceBlob: file.sha };
    const local = window.StageIntake.textItem(name || target.path.split('/').pop(), text);
    local.correspondenceFor = target.repo + '@' + sha + ':' + target.path;
    const store = window.Alpine.store('browser');
    store.stage = [...(store.stage || []), refItem, local];
    store.stageCompare = { a: window.StageIntake.keyOf(refItem), b: window.StageIntake.keyOf(local) };
    return { record: recordValue, saved, refItem, local };
  };
  const reopen = record => open({ target: { repo: record.repo, ref: record.branch, path: record.path },
    text: record.content, name: record.incomingName, source: record.source,
    record: false, revision: record.revision });
  window.FileCorrespondence = { declaration, validPath, applies, same, history, open, reopen };
})();
