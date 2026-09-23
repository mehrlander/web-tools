// Workspace snapshots, exact browser drafts and create-only publication.
// All GitHub requests are observed stubs; this suite never reaches a repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const P = 'projects/wps', REPO = 'mehrlander/home';
const REV = 'a'.repeat(40), TREE = 'b'.repeat(40), NEXT = 'c'.repeat(40);
const FILE = P + '/app/Modules/Example/Example.psm1';
const TEXT = '\ufefffunction Get-Example { "héllo 🌳" }\r\n';
const blobSha = text => {
  const bytes = typeof text === 'string' ? Buffer.from(text, 'utf8') : text;
  return createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
};
const draft = (over = {}) => ({ repo: REPO, project: P, ref: 'main', path: FILE,
  baseRevision: REV, baseBlob: blobSha(TEXT), baseText: TEXT, text: TEXT + '# edited\r\n',
  updatedAt: '2026-09-22T03:00:00.000Z', ...over });
const manifest = { root: 'Documents\\WindowsPowerShell', observations: P + '/data/observations.csv',
  correspondence: [{ repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' }] };

function harness(options = {}) {
  const records = options.records || new Map(), calls = [], writes = [], storageCalls = [];
  const blobs = new Map([[blobSha(TEXT), Buffer.from(TEXT, 'utf8')]]);
  const state = { current: REV, exists: false, failAt: '', truncated: false, storageFailure: false,
    tree: [{ path: FILE, type: 'blob', mode: '100755', sha: blobSha(TEXT) }], ...options };
  const win = { crypto: webcrypto, GH: { FRESH: { cache: 'no-store' } },
    persistence: { collection: name => {
      assert.equal(name, 'wpsWorkspace.drafts');
      return {
        find: async pred => [...records.values()].filter(pred).map(value => structuredClone(value)),
        put: async value => {
          storageCalls.push({ method: 'put', value: structuredClone(value) });
          if (state.beforePut) await state.beforePut(value);
          if (state.storageFailure) throw new Error('Disk full');
          records.set(value.id, structuredClone(value)); return structuredClone(value);
        },
        delete: async id => {
          storageCalls.push({ method: 'delete', id });
          if (state.beforeDelete) await state.beforeDelete(id);
          if (state.storageFailure) throw new Error('Disk full');
          return records.delete(id);
        },
      };
    } },
  };
  new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/installation.js'), 'utf8'))(win);
  new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/powershell-workspace.js'), 'utf8'))(win);
  const gh = {
    repo: REPO, ref: 'main',
    async get(address, opts) {
      calls.push({ method: 'get', address, ref: this.ref, opts });
      assert.equal(address, P + '/data/installation.json');
      return { text: JSON.stringify(manifest), sha: 'd'.repeat(40) };
    },
    async req(address, opts = {}) {
      const method = opts.method || 'GET';
      const body = opts.body ? JSON.parse(opts.body) : undefined;
      const call = { address, method, body, opts };
      calls.push(call);
      if (method !== 'GET') writes.push(call);
      if (state.failAt === address && method !== 'GET') throw Object.assign(new Error('Simulated failure'), { status: 422 });
      if (address === '') return { default_branch: state.defaultBranch || 'main' };
      if (address.startsWith('commits/')) return { sha: state.current, commit: { tree: { sha: TREE } } };
      if (address === 'git/commits/' + REV) return { sha: REV, tree: { sha: TREE } };
      if (/^git\/trees\/[a-f0-9]{40}\?recursive=1$/.test(address)) return { sha: TREE, tree: structuredClone(state.tree), truncated: state.truncated };
      if (address.startsWith('git/blobs/')) {
        const sha = address.slice('git/blobs/'.length);
        const bytes = blobs.get(sha);
        assert.ok(bytes, 'fixture has requested blob');
        return { sha, encoding: 'base64', content: bytes.toString('base64'), size: bytes.length };
      }
      if (address.startsWith('git/ref/heads/')) {
        if (state.exists) return { object: { sha: NEXT } };
        throw Object.assign(new Error('Not found'), { status: 404 });
      }
      if (address === 'git/trees' && method === 'POST') return { sha: 'e'.repeat(40) };
      if (address === 'git/commits' && method === 'POST') return { sha: NEXT };
      if (address === 'git/refs' && method === 'POST') return { ref: body.ref, object: { sha: body.sha } };
      throw new Error('Unexpected request ' + method + ' ' + address);
    },
  };
  const args = over => ({ gh, baseRevision: REV, branch: 'wps/try-example', message: 'Update example via Web Tools', drafts: [draft()], ...over });
  return { K: win.PowerShellWorkspace, gh, args, state, calls, writes, records, blobs, storageCalls };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('a remounted component wins over old saves invoked after its own save completes', async () => {
  const h = harness(), started = deferred(), release = deferred();
  const first = draft({ text: 'first edit' }), oldQueued = draft({ text: 'old queued edit' }), latest = draft({ text: 'new component edit' });
  h.state.beforePut = async value => { if (value.text === first.text) { started.resolve(); await release.promise; } };
  h.K.rememberDraft(first); const firstSave = h.K.saveDraft(first); await started.promise;
  h.K.rememberDraft(oldQueued); // Old component's local queue has not called saveDraft yet.
  h.K.rememberDraft(latest); const latestSave = h.K.saveDraft(latest);
  release.resolve(); await Promise.all([firstSave, latestSave]);
  assert.equal(h.records.get(h.K.draftId(latest)).text, latest.text);
  assert.equal(await h.K.saveDraft(oldQueued), undefined, 'Late call keeps its older intent token');
  assert.equal(h.records.get(h.K.draftId(latest)).text, latest.text);
  assert.deepEqual(h.storageCalls.map(c => c.value?.text), [first.text, latest.text]);
  assert.equal(h.K.recoveryDrafts(latest).length, 0);
});

test('old clean-draft deletions cannot erase a newer saved edit', async () => {
  const h = harness(), clean = draft({ text: TEXT }), newest = draft({ text: 'newest edit' });
  h.K.rememberDraft(clean); // A previous component queued removal after undo to base.
  h.K.rememberDraft(newest); await h.K.saveDraft(newest);
  assert.equal(await h.K.removeDraft(clean), undefined);
  assert.equal(h.records.get(h.K.draftId(newest)).text, newest.text);
  assert.ok(h.storageCalls.every(c => c.method === 'put'));
});

test('a newer edit waits for an in-flight deletion and is the final durable state', async () => {
  const h = harness(), old = draft(), started = deferred(), release = deferred();
  await h.K.saveDraft(old);
  h.state.beforeDelete = async () => { started.resolve(); await release.promise; };
  const clean = draft({ text: TEXT }); h.K.rememberDraft(clean); const remove = h.K.removeDraft(clean); await started.promise;
  const newest = draft({ text: 'after deletion began' }); h.K.rememberDraft(newest); const save = h.K.saveDraft(newest);
  release.resolve(); await Promise.all([remove, save]);
  assert.equal(h.records.get(h.K.draftId(newest)).text, newest.text);
  assert.deepEqual(h.storageCalls.map(c => c.method), ['put', 'delete', 'put']);
});

test('identical text and timestamps still have distinct intent and recovery ownership', async () => {
  const h = harness(), first = draft(), newer = draft();
  h.K.rememberDraft(first); h.K.rememberDraft(newer);
  assert.equal(h.K.forgetRecovery(first), false, 'Equality is not ownership of a later remembered intent');
  assert.equal(await h.K.saveDraft(first), undefined);
  assert.equal(h.K.recoveryDrafts(newer).length, 1);
  await h.K.saveDraft(newer);
  assert.equal(h.records.get(h.K.draftId(newer)).text, newer.text);
  assert.equal(h.K.recoveryDrafts(newer).length, 0);
});

test('failed latest saves retain recovery and do not allow old writes to revive', async () => {
  const h = harness(), old = draft({ text: 'older' }), newest = draft({ text: 'newer' });
  h.K.rememberDraft(old); h.K.rememberDraft(newest); h.state.storageFailure = true;
  await assert.rejects(h.K.saveDraft(newest), /Disk full/);
  h.state.storageFailure = false; assert.equal(await h.K.saveDraft(old), undefined);
  assert.equal(h.records.size, 0); assert.equal(h.K.recoveryDrafts(newest)[0].text, newest.text);
  await h.K.saveDraft(newest); assert.equal(h.records.get(h.K.draftId(newest)).text, newest.text);
  assert.equal(h.K.recoveryDrafts(newest).length, 0);
});

test('storage ordering is per identity so a blocked file does not delay another file', async () => {
  const h = harness(), first = draft(), other = draft({ path: P + '/app/Other.ps1', text: 'independent' });
  const started = deferred(), release = deferred();
  h.state.beforePut = async value => { if (value.path === first.path) { started.resolve(); await release.promise; } };
  h.K.rememberDraft(first); const pending = h.K.saveDraft(first); await started.promise;
  h.K.rememberDraft(other); await h.K.saveDraft(other);
  assert.equal(h.records.get(h.K.draftId(other)).text, other.text);
  release.resolve(); await pending;
});

test('recovery memory survives failed storage and isolates edits by workspace', async () => {
  const h = harness({ storageFailure: true }), d = draft();
  h.K.rememberDraft(d);
  await assert.rejects(h.K.saveDraft(d), /Disk full/);
  const scope = { repo: d.repo, project: d.project, ref: d.ref };
  assert.equal(h.K.recoveryDrafts(scope)[0].text, d.text);
  assert.equal(h.K.recoveryDrafts({ ...scope, ref: 'other' }).length, 0);
  const returned = h.K.recoveryDrafts(scope); returned[0].text = 'mutated';
  assert.equal(h.K.recoveryDrafts(scope)[0].text, d.text);
  const next = { ...d, text: d.text + '# newer' }; h.K.rememberDraft(next);
  assert.equal(h.K.forgetRecovery(d), false, 'older completion cannot forget a newer edit');
  assert.equal(h.K.forgetRecovery(next), true);
  assert.equal(h.K.recoveryDrafts(scope).length, 0);
  const clean = { ...d, text: d.baseText }; h.K.rememberDraft(clean);
  assert.equal(h.K.recoveryDrafts(scope)[0].text, d.baseText, 'pending deletion retains a clean tombstone');
  assert.deepEqual(h.writes, []);
});

test('snapshot resolves one immutable revision before reading any source material', async () => {
  const { K, gh, calls, writes } = harness();
  const result = await K.snapshot({ gh, project: { path: P, installation: P + '/data/installation.json' }, ref: 'main' });
  assert.equal(calls[0].address, 'commits/main');
  assert.equal(calls[0].opts.cache, 'no-store');
  assert.equal(calls.find(c => c.method === 'get').ref, REV);
  assert.ok(calls.some(c => c.address === 'git/trees/' + REV + '?recursive=1'));
  assert.equal(gh.ref, 'main', 'pinning cannot change the shell client');
  assert.equal(result.revision, REV);
  assert.equal(result.items[0].path, FILE);
  assert.equal(result.items[0].installs, 'Modules/Example/Example.psm1');
  assert.equal(result.ledgerPath, P + '/data/observations.csv');
  assert.equal(writes.length, 0);
});

test('snapshot refuses a truncated tree instead of showing an incomplete corpus', async () => {
  const { K, gh, state, writes } = harness();
  state.truncated = true;
  await assert.rejects(K.snapshot({ gh, project: { path: P, installation: P + '/data/installation.json' } }), /truncated/);
  assert.equal(writes.length, 0);
});

test('source reads verify Git bytes and preserve BOM, CRLF and Unicode', async () => {
  const { K, gh, writes } = harness();
  const result = await K.readFile({ gh, path: FILE, revision: REV, blobSha: blobSha(TEXT) });
  assert.equal(result.text, TEXT);
  assert.equal(Buffer.from(result.text).compare(Buffer.from(TEXT)), 0);
  assert.equal(result.sha, blobSha(TEXT));
  assert.equal(writes.length, 0);
});

test('source reads reject corrupt and non-UTF-8 bytes without replacing them', async () => {
  const { K, gh, blobs } = harness();
  blobs.set(blobSha(TEXT), Buffer.from('corrupt'));
  await assert.rejects(K.readFile({ gh, path: FILE, revision: REV, blobSha: blobSha(TEXT) }), /do not match/);
  const bad = Buffer.from([0xff, 0xfe, 0x61, 0x00]), sha = blobSha(bad);
  blobs.set(sha, bad);
  await assert.rejects(K.readFile({ gh, path: FILE, revision: REV, blobSha: sha }), /not UTF-8/);
});

test('drafts persist independently by repository, project, ref and file with no GitHub writes', async () => {
  const { K, writes, records } = harness();
  const first = await K.saveDraft(draft());
  const other = await K.saveDraft(draft({ ref: 'wps/other' }));
  assert.notEqual(first.id, other.id);
  assert.equal(first.id.includes('.'), false, 'storage path delimiters cannot occur in a draft id');
  assert.notEqual(K.draftId(draft({ path: P + '/app/Example..ps1' })), K.draftId(draft({ path: P + '/app/Example.ps1' })));
  assert.equal(records.size, 2);
  const nextSession = harness({ records }).K;
  const found = await nextSession.loadDrafts({ repo: REPO, project: P, ref: 'main' });
  assert.equal(found.length, 1);
  assert.equal(found[0].text, draft().text);
  assert.equal(found[0].baseText, TEXT);
  await nextSession.removeDraft(found[0]);
  assert.equal(records.size, 1);
  assert.equal(writes.length, 0);
});

test('storage failure retains the previous draft and does not pretend the edit was saved', async () => {
  const { K, state, records } = harness();
  const saved = await K.saveDraft(draft());
  state.storageFailure = true;
  await assert.rejects(K.saveDraft({ ...saved, text: 'later edit' }), /Disk full/);
  assert.equal(records.get(saved.id).text, draft().text);
});

test('draft validation refuses unknown bases, corrupt identities and paths outside the project', async () => {
  const { K, records } = harness();
  for (const over of [{ baseRevision: 'main' }, { baseBlob: 'unknown' }, { id: 'different' },
    { path: 'me/private.ps1' }, { path: P + '/../out.ps1' }, { path: P + '/app/.git/config' },
    { text: '\ud800' }, { baseText: 'x\0y' }, { ref: '../main' }]) {
    await assert.rejects(K.saveDraft(draft(over)));
  }
  assert.equal(records.size, 0);
  const record = draft(); record.id = K.draftId(record); record.text = 13;
  records.set(record.id, record);
  await assert.rejects(K.loadDrafts({ repo: REPO, project: P, ref: 'main' }), /must be text/);
  assert.equal(records.get(record.id).text, 13, 'invalid entries are retained for recovery');
});

test('three-way comparison distinguishes upstream movement, edits and convergence exactly', () => {
  const { K } = harness();
  for (const [base, current, local, expected] of [
    ['A', 'A', 'A', 'unchanged'], ['A', 'A', 'B', 'draft'], ['A', 'B', 'A', 'upstream'],
    ['A', 'B', 'B', 'converged'], ['A', 'B', 'C', 'conflict'], ['A\r\n', 'A\n', 'B\r\n', 'conflict'],
  ]) assert.equal(K.compare(base, current, local).state, expected);
  assert.equal(K.changed(draft({ text: TEXT })), false);
  assert.equal(K.changed(draft()), true);
});

test('bundle export and restore preserve exact drafts as data and have no storage or GitHub effects', () => {
  const { K, records, writes, calls } = harness();
  const args = { repo: REPO, project: P, ref: 'main', revision: REV, drafts: [draft()] };
  const exported = K.exportBundle(args);
  const restored = K.restoreBundle(JSON.stringify(exported), { repo: REPO, project: P, ref: 'main' });
  assert.equal(restored.drafts[0].text, draft().text);
  assert.equal(restored.drafts[0].baseText, TEXT);
  assert.equal(records.size, 0); assert.equal(writes.length, 0); assert.equal(calls.length, 0);
  assert.throws(() => K.restoreBundle(JSON.stringify(exported), { repo: REPO, project: P, ref: 'wps/other' }), /another/);
  assert.throws(() => K.restoreBundle({ ...exported, version: 2 }), /not a supported/);
  assert.throws(() => K.restoreBundle({ ...exported, drafts: [draft(), draft()] }), /duplicate/);
  assert.throws(() => K.restoreBundle({ ...exported, drafts: [draft({ path: '../escape.ps1' })] }), /inside/);
});

test('publish validates every base before creating one atomic commit on a new branch', async () => {
  const { K, gh, args, writes, records, calls } = harness();
  const saved = await K.saveDraft(draft());
  const result = await K.publish(args({ drafts: [saved] }));
  assert.deepEqual(writes.map(c => [c.method, c.address]), [['POST', 'git/trees'], ['POST', 'git/commits'], ['POST', 'git/refs']]);
  assert.deepEqual(writes[0].body, { base_tree: TREE, tree: [{ path: FILE, mode: '100755', type: 'blob', content: draft().text }] });
  assert.deepEqual(writes[1].body.parents, [REV]);
  assert.deepEqual(writes[2].body, { ref: 'refs/heads/wps/try-example', sha: NEXT });
  assert.ok(calls.find(c => c.address === 'git/blobs/' + blobSha(TEXT)), 'actual base text is checked');
  assert.equal(result.revision, NEXT);
  assert.equal(result.baseRevision, REV);
  assert.deepEqual(result.files, [FILE]);
  assert.match(result.compareUrl, /compare\/[a-f0-9]{40}\.\.\.wps%2Ftry-example/);
  assert.equal(gh.ref, 'main');
  assert.equal(records.get(saved.id).text, saved.text, 'publication never deletes the recovery copy');
});

test('publication starts from its immutable base even when the source branch advanced', async () => {
  const { K, args, state, writes } = harness();
  state.current = 'f'.repeat(40);
  await K.publish(args());
  assert.deepEqual(writes.find(c => c.address === 'git/commits').body.parents, [REV]);
});

test('publication rejects stale bases, blob mismatches and damaged saved base text before writing', async () => {
  for (const over of [{ baseRevision: 'f'.repeat(40) }, { baseBlob: 'f'.repeat(40) }, { baseText: TEXT + 'wrong' }]) {
    const { K, args, writes } = harness();
    await assert.rejects(K.publish(args({ drafts: [draft(over)] })), /base|blob|before publishing/);
    assert.equal(writes.length, 0);
  }
});

test('publication rejects foreign or duplicate drafts and unknown regular file modes', async () => {
  for (const drafts of [[draft({ repo: 'elsewhere/home' })], [draft(), draft()], [draft({ text: TEXT })]]) {
    const { K, args, writes } = harness();
    await assert.rejects(K.publish(args({ drafts })));
    assert.equal(writes.length, 0);
  }
  const { K, args, state, writes } = harness();
  state.tree[0].mode = '120000';
  await assert.rejects(K.publish(args()), /regular source/);
  assert.equal(writes.length, 0);
});

test('new files need an absent path under app at the captured revision', async () => {
  const { K, args, writes } = harness();
  const created = draft({ path: P + '/app/Modules/New/New.psm1', baseBlob: '', baseText: '', text: '' });
  assert.equal(K.changed(created), true, 'a new empty file is still a file creation');
  await K.publish(args({ drafts: [created] }));
  assert.equal(writes[0].body.tree[0].content, '');
  assert.equal(writes[0].body.tree[0].mode, '100644');
  const other = harness();
  for (const path of [FILE, FILE + '/child.ps1', P + '/app/Modules/Example', P + '/working/New.ps1']) {
    await assert.rejects(other.K.publish(other.args({ drafts: [draft({ path, baseBlob: '', baseText: '' })] })), /occupied|app folder/);
  }
  assert.equal(other.writes.length, 0);
});

test('existing branches, default branch names and malformed names are never updated', async () => {
  const { K, args, state, writes } = harness();
  for (const branch of ['', 'main', 'master', 'no-prefix', 'wps/../main', 'refs/heads/new', 'wps/a.lock', 'wps/a?x', 'wps/a b']) {
    await assert.rejects(K.publish(args({ branch })), /feature branch/);
  }
  state.defaultBranch = 'wps/default';
  await assert.rejects(K.publish(args({ branch: state.defaultBranch })), /default branch/);
  state.exists = true;
  await assert.rejects(K.publish(args()), /already exists/);
  assert.equal(writes.length, 0);
});

test('a final branch collision or network failure cannot overwrite a ref or discard drafts', async () => {
  for (const failAt of ['git/trees', 'git/commits', 'git/refs']) {
    const { K, args, state, records, writes } = harness();
    const saved = await K.saveDraft(draft());
    state.failAt = failAt;
    await assert.rejects(K.publish(args({ drafts: [saved] })), /Simulated failure/);
    assert.equal(records.get(saved.id).text, saved.text);
    assert.ok(writes.every(c => c.method === 'POST'));
    assert.equal(writes.filter(c => c.address === 'git/refs').length, failAt === 'git/refs' ? 1 : 0);
  }
});

test('truncated and corrupt trees stop publication before any write', async () => {
  const { K, args, state, writes } = harness();
  state.truncated = true;
  await assert.rejects(K.publish(args()), /truncated/);
  state.truncated = false; state.tree.push({ ...state.tree[0] });
  await assert.rejects(K.publish(args()), /invalid tree entry/);
  assert.equal(writes.length, 0);
});
