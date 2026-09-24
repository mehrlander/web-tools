// PowerShell code workspace data. GitHub snapshots and draft bases are immutable;
// working drafts live only in browser storage. Publishing creates one new branch
// after validating every base, and never updates an existing reference. Neither
// drafts nor publication make a claim about the separate work installation.
(() => {
  const COLLECTION = 'wpsWorkspace.drafts';
  const SHA = /^[0-9a-f]{40}$/;
  const fresh = () => window.GH?.FRESH || { cache: 'no-store' };
  const fail = message => { throw new Error(message); };
  const validPath = path => typeof path === 'string' && !!path
    && !/^[\/\\]|[\\:#?\x00-\x1f\x7f]/.test(path)
    && !path.split('/').some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git');
  const validRef = ref => typeof ref === 'string' && !!ref && ref !== '@'
    && !/[\s\x00-\x1f\x7f~^:?*\[\\]/.test(ref) && !ref.includes('..') && !ref.includes('@{')
    && !ref.startsWith('-') && !ref.startsWith('/') && !ref.endsWith('/') && !ref.endsWith('.')
    && !ref.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.lock'));
  const validRepo = repo => typeof repo === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
  const textValue = (text, label) => {
    if (typeof text !== 'string' || text.includes('\0')) fail(label + ' must be text.');
    // UTF-8 has no representation for isolated UTF-16 surrogates. Refuse to
    // replace them silently while saving/exporting a browser draft.
    for (let i = 0; i < text.length; i++) {
      const n = text.charCodeAt(i);
      if (n >= 0xd800 && n <= 0xdbff) {
        const next = text.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) fail(label + ' contains an incomplete Unicode character.');
      } else if (n >= 0xdc00 && n <= 0xdfff) fail(label + ' contains an incomplete Unicode character.');
    }
    return text;
  };
  const context = ({ repo, project, ref }) => {
    if (!validRepo(repo)) fail('A repository address is required.');
    if (!validPath(project)) fail('A repository-relative project path is required.');
    if (!validRef(ref)) fail('A valid repository ref is required.');
    return { repo, project, ref };
  };
  // persistence.collection keys use dot-delimited paths. Encode dots too, so
  // names such as Example..ps1 cannot collapse onto Example.ps1 in storage.
  const draftId = ({ repo, project, ref, path }) => [repo, project, ref, path]
    .map(value => encodeURIComponent(value).replace(/\./g, '%2E')).join('|');
  // Route changes do not fire beforeunload. Retain edits in this app window
  // before awaiting IndexedDB, so a failed or pending save survives remount.
  // This is recovery memory, not durable storage; browser reload still needs
  // a successful save or an exported bundle.
  const recovery = new Map();
  // Component lifetimes cannot own storage ordering: an old component can
  // still have saves queued when its replacement starts editing the same file.
  // Tokens remember the order of user intent, not the later order of calls to
  // saveDraft/removeDraft. They stay outside serializable draft records.
  const intents = new Map(), recordIntents = new WeakMap(), storageQueues = new Map();
  let intentSequence = 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  const rememberDraft = record => {
    context(record);
    if (!validPath(record.path) || !record.path.startsWith(record.project + '/')) fail('The recovery path must be inside its project.');
    if (typeof record.text !== 'string' || typeof record.baseText !== 'string') fail('Recovery requires draft text.');
    const copy = clone(record); copy.id = draftId(copy);
    const token = { id: copy.id, sequence: ++intentSequence };
    intents.set(copy.id, token.sequence); recordIntents.set(record, token); recordIntents.set(copy, token);
    recovery.set(copy.id, copy);
    const returned = clone(copy); recordIntents.set(returned, token); return returned;
  };
  const recoveryDrafts = scope => {
    const c = context(scope);
    return [...recovery.values()].filter(d => d.repo === c.repo && d.project === c.project && d.ref === c.ref).map(clone);
  };
  const forgetRecovery = record => {
    const id = draftId(record), found = recovery.get(id);
    const token = recordIntents.get(record);
    if (token && (token.id !== id || token.sequence !== intents.get(id))) return false;
    if (!found || ['text', 'baseRevision', 'baseBlob', 'baseText'].some(k => found[k] !== record[k])) return false;
    return recovery.delete(id);
  };
  const normalizeDraft = record => {
    if (!record || typeof record !== 'object') fail('A draft record is required.');
    const scope = context(record);
    if (!validPath(record.path) || !record.path.startsWith(scope.project + '/')) fail('The draft path must be inside its project.');
    const newFile = record.baseBlob === '' && record.baseText === '';
    if (!SHA.test(record.baseRevision || '') || (!newFile && !SHA.test(record.baseBlob || ''))) fail('The draft needs its known base revision and blob.');
    if (newFile && !record.path.startsWith(scope.project + '/app/')) fail('New source files must be inside the project app folder.');
    const out = { ...scope, path: record.path, baseRevision: record.baseRevision, baseBlob: record.baseBlob,
      baseText: textValue(record.baseText, 'The base'), text: textValue(record.text, 'The draft'),
      updatedAt: record.updatedAt || new Date().toISOString() };
    if (!Number.isFinite(Date.parse(out.updatedAt))) fail('The draft has an invalid update date.');
    out.id = draftId(out);
    if (record.id && record.id !== out.id) fail('The draft identity does not match its repository, ref and path.');
    return out;
  };
  const collection = () => window.persistence?.collection?.(COLLECTION)
    || fail('Browser-local draft storage is unavailable.');
  const writeDraft = (record, remove) => {
    const normalized = normalizeDraft(record);
    // Direct imports and explicit removals establish intent when called.
    // Deferred callers should call rememberDraft before awaiting anything,
    // then pass that same record (or its returned copy) to this operation.
    if (!recordIntents.has(record)) rememberDraft(record);
    const token = recordIntents.get(record), id = normalized.id;
    if (token.id !== id) fail('The remembered draft identity changed before saving.');
    recordIntents.set(normalized, token);
    const operation = (storageQueues.get(id) || Promise.resolve()).then(async () => {
      // A stale save, including a stale clean-draft deletion, must not touch
      // IndexedDB after a newer intent. Undefined means it was superseded.
      if (intents.get(id) !== token.sequence) return undefined;
      const saved = remove ? await collection().delete(id) : await collection().put(normalized);
      forgetRecovery(normalized);
      return saved;
    });
    // Each identity serializes independently. Failed storage leaves recovery
    // intact and cannot poison the next attempt or block another file.
    const tail = operation.then(() => {}, () => {});
    storageQueues.set(id, tail);
    tail.then(() => { if (storageQueues.get(id) === tail) storageQueues.delete(id); });
    return operation;
  };
  const saveDraft = async record => writeDraft(record, false);
  const loadDrafts = async scope => {
    const c = context(scope);
    const rows = await collection().find(r => r.repo === c.repo && r.project === c.project && r.ref === c.ref);
    // Corrupt entries are not silently discarded. Their original storage is
    // untouched, so a storage export can still recover the supplied text.
    return rows.map(normalizeDraft).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path));
  };
  const removeDraft = async record => writeDraft(record, true);
  const changed = draft => !!draft && typeof draft.text === 'string'
    && (draft.baseBlob === '' || draft.text !== draft.baseText);
  const compare = (base, current, draft) => {
    textValue(base, 'The base'); textValue(current, 'GitHub text'); textValue(draft, 'The draft');
    const state = draft === base ? (current === base ? 'unchanged' : 'upstream')
      : current === base ? 'draft' : current === draft ? 'converged' : 'conflict';
    const labels = { unchanged: 'Unchanged', draft: 'Browser draft', upstream: 'GitHub changed',
      converged: 'Draft matches GitHub', conflict: 'Draft and GitHub changed' };
    return { state, label: labels[state] };
  };
  const pinned = (gh, revision) => Object.assign(Object.create(gh), { ref: revision });
  const checkTree = result => {
    if (result?.truncated) fail('The GitHub tree is truncated. The workspace cannot establish a complete inventory.');
    if (!Array.isArray(result?.tree) || !SHA.test(result.sha || '')) fail('GitHub returned no complete tree.');
    const seen = new Set();
    for (const item of result.tree) {
      if (!validPath(item.path) || seen.has(item.path) || !SHA.test(item.sha || '')) fail('GitHub returned an invalid tree entry.');
      seen.add(item.path);
    }
    return result;
  };
  const snapshot = async ({ gh, project, ref }) => {
    if (!gh?.req || !gh?.get) fail('No repository client is available.');
    const projectPath = typeof project === 'string' ? project : project?.path;
    const manifestPath = project?.installation;
    if (!validPath(projectPath) || !validPath(manifestPath)) fail('This project needs an installation manifest.');
    const sourceRef = ref || gh.ref;
    if (!validRef(sourceRef)) fail('A valid repository ref is required.');
    // Resolve first, then read every ingredient from the same immutable commit.
    const commit = await gh.req('commits/' + encodeURIComponent(sourceRef), fresh());
    const revision = commit?.sha;
    if (!SHA.test(revision || '')) fail('Could not resolve the repository revision.');
    const reader = pinned(gh, revision);
    const [file, response] = await Promise.all([
      reader.get(manifestPath, fresh()), gh.req('git/trees/' + revision + '?recursive=1', fresh()),
    ]);
    const tree = checkTree(response);
    if (!window.Installation) fail('The installation kit is required.');
    const manifest = window.Installation.manifest(file.text);
    const items = window.Installation.inventory({ tree: tree.tree, manifest, projectPath });
    const ledgerPath = manifest.observations || projectPath + '/data/observations.csv';
    if (!validPath(ledgerPath)) fail('The manifest contains an invalid observations path.');
    return { revision, manifest, items, groups: window.Installation.groups(items, manifest), ledgerPath,
      tree: tree.tree, treeSha: tree.sha, manifestPath };
  };
  const gitHash = async bytes => {
    const prefix = new TextEncoder().encode('blob ' + bytes.length + '\0');
    const input = new Uint8Array(prefix.length + bytes.length);
    input.set(prefix); input.set(bytes, prefix.length);
    const hash = await window.crypto.subtle.digest('SHA-1', input);
    return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
  };
  const blobBytes = async (gh, sha) => {
    const blob = await gh.req('git/blobs/' + sha, fresh());
    if (blob?.encoding !== 'base64' || typeof blob.content !== 'string' || (blob.sha && blob.sha !== sha)) fail('GitHub returned an invalid source blob.');
    let bytes;
    try { bytes = Uint8Array.from(atob(blob.content.replace(/\s/g, '')), char => char.charCodeAt(0)); }
    catch { fail('GitHub returned an invalid source encoding.'); }
    if (await gitHash(bytes) !== sha) fail('The source bytes do not match their Git blob.');
    return bytes;
  };
  const blobText = async (gh, sha) => {
    const bytes = await blobBytes(gh, sha);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { fail('This source is not UTF-8. Compare the work copy with its encoding selected before editing.'); }
    return textValue(text, 'The source');
  };
  const blobOf = async ({ gh, path, revision, blobSha }) => {
    if (!gh?.req || !validPath(path) || !SHA.test(revision || '')) fail('Reading source requires a file and immutable revision.');
    let sha = blobSha;
    if (!sha) {
      const tree = checkTree(await gh.req('git/trees/' + revision + '?recursive=1', fresh()));
      sha = tree.tree.find(row => row.path === path && row.type === 'blob')?.sha;
    }
    if (!SHA.test(sha || '')) fail('No source blob was found at this revision.');
    return sha;
  };
  const readFile = async args => {
    const sha = await blobOf(args);
    return { text: await blobText(args.gh, sha), sha, revision: args.revision };
  };
  // The exact bytes, verified against the Git blob and not decoded: what a
  // transfer places on the work computer, whatever the file's encoding.
  // Windows PowerShell 5.1 reads a file with no BOM as ANSI (Windows-1252),
  // so some of the corpus is not UTF-8 and must not be re-encoded to move.
  const readBytes = async args => {
    const sha = await blobOf(args);
    return { bytes: await blobBytes(args.gh, sha), sha, revision: args.revision };
  };
  const exportBundle = ({ repo, ref, revision, project, drafts }) => {
    context({ repo, ref, project });
    if (!SHA.test(revision || '')) fail('A draft bundle needs the workspace revision.');
    if (!Array.isArray(drafts)) fail('A draft bundle needs its draft list.');
    const files = drafts.map(normalizeDraft).sort((a, b) => a.path.localeCompare(b.path));
    if (files.some(d => d.repo !== repo || d.ref !== ref || d.project !== project)) fail('The bundle contains drafts from another workspace.');
    return { format: 'web-tools-powershell-drafts', version: 1, repo, ref, revision, project,
      storage: 'browser-local', drafts: files };
  };
  // Parsing restores no files and writes no storage. The host previews the
  // bundle and then calls saveDraft for the records the user chooses to keep.
  const restoreBundle = (input, scope) => {
    const value = typeof input === 'string' ? JSON.parse(input) : input;
    if (value?.format !== 'web-tools-powershell-drafts' || value.version !== 1) fail('This is not a supported PowerShell draft bundle.');
    const bundle = exportBundle(value);
    if (scope) {
      const c = context(scope);
      if (bundle.repo !== c.repo || bundle.project !== c.project || bundle.ref !== c.ref) fail('This bundle belongs to another repository workspace or ref.');
    }
    if (new Set(bundle.drafts.map(d => d.path)).size !== bundle.drafts.length) fail('The bundle contains duplicate draft paths.');
    return bundle;
  };
  const post = (gh, path, body) => gh.req(path, { method: 'POST', body: JSON.stringify(body) });
  const publish = async ({ gh, baseRevision, branch, message, drafts }) => {
    if (!gh?.req || !validRepo(gh.repo)) fail('No repository client is available.');
    if (!SHA.test(baseRevision || '')) fail('Publishing requires an immutable base revision.');
    if (!validRef(branch) || !branch.includes('/') || branch.startsWith('refs/')
      || ['main', 'master', gh.ref, gh._defaultBranch].includes(branch)) fail('Choose a new feature branch with a prefix, such as wps/my-change.');
    if (typeof message !== 'string' || !message.trim()) fail('A commit message is required.');
    if (!Array.isArray(drafts) || !drafts.length) fail('There are no drafts to publish.');
    const files = drafts.map(normalizeDraft);
    const first = files[0];
    const paths = new Set();
    for (const draft of files) {
      if (draft.repo !== gh.repo || draft.project !== first.project || draft.ref !== first.ref) fail('Publish one repository workspace at a time.');
      if (draft.baseRevision !== baseRevision) fail('A draft has an older base revision. Compare and rebase the draft before publishing.');
      if (!changed(draft)) fail('The publish list contains an unchanged draft.');
      if (paths.has(draft.path)) fail('The publish list contains a duplicate path.');
      paths.add(draft.path);
    }
    if (branch === first.ref) fail('Publishing requires a new feature branch.');
    // Validate all source material and branch availability before the first
    // POST. New-branch creation is the only operation that makes these Git
    // objects reachable; a collision at that final step never overwrites it.
    const [meta, commit, response] = await Promise.all([
      gh.req('', fresh()), gh.req('git/commits/' + baseRevision, fresh()),
      gh.req('git/trees/' + baseRevision + '?recursive=1', fresh()),
    ]);
    if (!meta?.default_branch || branch === meta.default_branch) fail('The destination must be a new feature branch, not the default branch.');
    if (commit?.sha !== baseRevision || !SHA.test(commit?.tree?.sha || '')) fail('GitHub did not confirm the base commit.');
    const tree = checkTree(response);
    if (tree.sha !== commit.tree.sha) fail('The source tree does not match the base commit.');
    let exists = false;
    try { await gh.req('git/ref/heads/' + branch, fresh()); exists = true; }
    catch (error) { if (error?.status !== 404) throw error; }
    if (exists) fail('That branch already exists. Choose a new branch name.');
    const entries = [];
    for (const draft of files) {
      const item = tree.tree.find(row => row.path === draft.path);
      if (draft.baseBlob === '') {
        if (item || tree.tree.some(row => row.path.startsWith(draft.path + '/')
          || (draft.path.startsWith(row.path + '/') && row.type !== 'tree'))) fail('The new path is already occupied at the base revision: ' + draft.path);
        entries.push({ path: draft.path, mode: '100644', type: 'blob', content: draft.text });
        continue;
      }
      if (!item || item.sha !== draft.baseBlob) fail('The base blob changed or is unknown for ' + draft.path + '. Reload and compare before publishing.');
      if (item.type !== 'blob' || !['100644', '100755'].includes(item.mode)) fail('Only regular source files can be published.');
      if (await blobText(gh, item.sha) !== draft.baseText) fail('The saved base text does not match GitHub for ' + draft.path + '. The draft is retained.');
      entries.push({ path: draft.path, mode: item.mode, type: 'blob', content: draft.text });
    }
    const built = await post(gh, 'git/trees', { base_tree: commit.tree.sha, tree: entries });
    if (!SHA.test(built?.sha || '')) fail('GitHub returned no tree for the drafts. The drafts are retained.');
    const created = await post(gh, 'git/commits', { message: message.trim(), tree: built.sha, parents: [baseRevision] });
    if (!SHA.test(created?.sha || '')) fail('GitHub returned no commit for the drafts. The drafts are retained.');
    try { await post(gh, 'git/refs', { ref: 'refs/heads/' + branch, sha: created.sha }); }
    catch (error) {
      // The caller can inspect the branch after an uncertain network response;
      // drafts are kept on both success and failure until explicitly removed.
      error.branch = branch; error.commit = created.sha; error.draftsRetained = true;
      throw error;
    }
    const root = 'https://github.com/' + gh.repo;
    return { repo: gh.repo, branch, revision: created.sha, baseRevision, files: files.map(d => d.path),
      url: root + '/tree/' + encodeURIComponent(branch),
      compareUrl: root + '/compare/' + baseRevision + '...' + encodeURIComponent(branch) + '?expand=1' };
  };
  window.PowerShellWorkspace = { COLLECTION, validPath, validRef, draftId, snapshot, readFile, readBytes,
    loadDrafts, saveDraft, removeDraft, rememberDraft, recoveryDrafts, forgetRecovery,
    changed, compare, exportBundle, restoreBundle, publish };
})();
