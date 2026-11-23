import test from 'node:test';
import assert from 'node:assert/strict';
import { publishRun, publishReach, reachSnapshot, baselineEligible, runLocation, githubContents } from '../testing/publish.mjs';
import { markdownSummary } from '../testing/summary.mjs';

const record = (id = '1', date = '2026-11-23T10:00:00Z') => ({
  schema: 'web-tools-test-run/1', source: { checkout_sha: 'a'.repeat(40), dirty: false },
  runtime: { node: '22.23.0', platform: 'linux', arch: 'x64', concurrency: 2, dependency_fingerprint: 'f'.repeat(64) },
  run: { id, attempt: '1', event: 'push' }, mode: 'full', complete: true, exit_code: 0,
  finished_at: date, wall_ms: 200, sum_process_wall_ms: 350,
  tests: [{ path: 'node/test/one.test.mjs', elapsed_ms: 350, complete: true, exit_code: 0, files: ['lib/one.js'], directories: [], missing: [], opaque: [] }],
});

function store(branch = 'background') {
  const files = new Map(), writes = [];
  let sequence = 0;
  return { files, writes, request: async (method, file, data) => {
    if (method === 'GET') {
      if (!files.has(file)) { const error = new Error('absent'); error.status = 404; throw error; }
      return files.get(file);
    }
    assert.equal(data.branch, branch);
    assert.equal(data.sha, files.get(file)?.sha);
    assert.match(data.message, /Co-Authored-By: Codex/);
    writes.push(file);
    files.set(file, { content: data.content, sha: String(++sequence) });
    return {};
  } };
}

test('capture retries are idempotent and never change historical run bytes', async () => {
  const held = store(), run = record();
  assert.deepEqual(await publishRun(run, held), { capturePath: runLocation(run), captured: true, latest: true, baseline: true });
  const count = held.writes.length;
  assert.equal((await publishRun(run, held)).captured, false);
  assert.equal(held.writes.length, count);
  await assert.rejects(publishRun({ ...run, wall_ms: 999 }, held), /Refusing to alter captured run/);
});

test('an older capture is retained without rolling latest or baseline backwards', async () => {
  const held = store();
  await publishRun(record('2', '2026-11-24T10:00:00Z'), held);
  const result = await publishRun(record(), held);
  assert.equal(result.captured, true);
  assert.equal(result.latest, false);
  assert.equal(result.baseline, false);
});

test('failed, partial, selected and dirty runs cannot replace the selection baseline', async () => {
  for (const update of [{ exit_code: 1 }, { complete: false }, { mode: 'selected' }, { source: { checkout_sha: 'a'.repeat(40), dirty: true } }]) {
    const run = { ...record(), ...update }, held = store();
    assert.equal(baselineEligible(run), false);
    const result = await publishRun(run, held);
    assert.equal(result.captured, true);
    assert.equal(result.baseline, false);
  }
});

test('a racing pointer writer is reread before retrying', async () => {
  const held = store(); let collided = false;
  const request = async (method, file, data) => {
    if (method === 'PUT' && file === 'data/tests/latest.json' && !collided) {
      collided = true; const error = new Error('race'); error.status = 409; throw error;
    }
    return held.request(method, file, data);
  };
  assert.equal((await publishRun(record(), { request })).latest, true);
  assert.equal(collided, true);
});

test('run identities cannot escape their captured stream', () => {
  assert.throws(() => runLocation({ ...record(), run: { id: '../other', attempt: 1 } }), /identity/);
  assert.throws(() => runLocation({ ...record(), finished_at: 'unknown' }), /identity/);
});

test('summary distinguishes overlapping process durations from suite wall time', () => {
  const summary = markdownSummary(record());
  assert.match(summary, /Suite wall time \| 0\.20 s/);
  assert.match(summary, /Accumulated process elapsed time \| 0\.35 s/);
  assert.match(summary, /not CPU time or developer waiting/);
});

test('GitHub publication binds the target branch and does not print credentials on errors', async () => {
  const calls = [];
  const request = githubContents({ token: 'fake-secret', fetchImpl: async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: false, status: 403 };
  } });
  await assert.rejects(request('GET', 'data/tests/latest.json', { ref: 'background' }), error => {
    assert.equal(error.message.includes('fake-secret'), false); return true;
  });
  assert.match(calls[0].url, /ref=background/);
});

test('public reach retains dependencies and provenance without per-run timings', async () => {
  const run = record(), held = store('main');
  const snapshot = reachSnapshot(run);
  assert.deepEqual(snapshot.tests[0].files, ['lib/one.js']);
  assert.equal(snapshot.tests[0].elapsed_ms, null);
  assert.equal(snapshot.wall_ms, undefined);
  assert.equal(snapshot.source.checkout_sha, run.source.checkout_sha);
  assert.equal((await publishReach(run, held)).published, true);
  assert.equal((await publishReach(run, held)).published, false);
  assert.equal((await publishReach({ ...run, complete: false }, held)).published, false);
});

test('a newer run on the same source can refresh dependency and runtime observations', async () => {
  const held = store('main'), first = record();
  await publishReach(first, held);
  const next = { ...record('2', '2026-11-24T10:00:00Z'), runtime: { ...first.runtime, dependency_fingerprint: 'b'.repeat(64) } };
  assert.equal((await publishReach(next, held)).published, true);
});

test('malformed reach and incomplete runtime provenance cannot become baselines', async () => {
  for (const changed of [
    { source: { checkout_sha: 'bad', dirty: false } },
    { runtime: { ...record().runtime, dependency_fingerprint: '' } },
    { runtime: { ...record().runtime, arch: '' } },
    { tests: [{ ...record().tests[0], files: ['../outside'] }] },
    { tests: [record().tests[0], record().tests[0]] },
    { finished_at: 'not a date' },
  ]) assert.equal(baselineEligible({ ...record(), ...changed }), false);
});

test('a late rerun of older source cannot replace a newer source baseline', async () => {
  const held = store('main');
  await publishReach(record(), held);
  const request = async (method, file, data) => method === 'COMPARE' ? { status: 'behind' } : held.request(method, file, data);
  const older = { ...record('3', '2026-11-25T10:00:00Z'), source: { checkout_sha: 'b'.repeat(40), dirty: false } };
  assert.equal((await publishReach(older, { request })).published, false);
});

test('large captured records read blob bytes when the Contents API omits inline content', async () => {
  const calls = [];
  const request = githubContents({ token: 'fake', fetchImpl: async url => {
    calls.push(String(url));
    return { ok: true, json: async () => calls.length === 1
      ? { sha: 'a'.repeat(40), encoding: 'none', content: '' }
      : { encoding: 'base64', content: Buffer.from('{"retained":true}').toString('base64') } };
  } });
  const read = await request('GET', 'data/tests/reach.json', { ref: 'background' });
  assert.equal(JSON.parse(Buffer.from(read.content, 'base64').toString()).retained, true);
  assert.match(calls[1], /git\/blobs\//);
});
