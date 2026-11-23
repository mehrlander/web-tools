import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDirectory, phoneAddress, publishFile } from '../../desktop/now-file.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'now-file-'));
  t.after(async () => {
    assert.equal(resolve(root), root);
    assert.ok(relative(resolve(tmpdir()), root).startsWith('now-file-'));
    await rm(root, { recursive: true, force: true });
  });
  const state = join(root, 'state'), source = join(root, 'source.png');
  await mkdir(state);
  await writeFile(join(state, 'companion-access.json'), JSON.stringify({ PhoneUrl: 'https://fixture.example.ts.net/', LocalToken: 'PRIVATE-DO-NOT-PUBLISH' }));
  await writeFile(source, Buffer.from([137, 80, 78, 71, 0, 255]));
  return { root, state, source };
}

test('publishing copies exact bytes and returns a private deep link independent of the source', async t => {
  const { state, source } = await fixture(t), bytes = await readFile(source);
  const published = await publishFile(source, { state, name: 'comparison café.png' });
  const url = new URL(published.url), route = new URLSearchParams(url.hash.slice(1));
  assert.equal(url.origin, 'https://fixture.example.ts.net');
  assert.equal(route.get('view'), 'files');
  assert.equal(route.get('root'), 'outputs');
  assert.equal(route.get('file'), published.path);
  assert.ok(!published.url.includes('PRIVATE') && !published.url.includes(state));
  assert.equal(published.bytes, bytes.length);
  const target = join(state, 'outputs', ...published.path.split('/'));
  assert.deepEqual(await readFile(target), bytes);
  await writeFile(source, 'changed');
  assert.deepEqual(await readFile(target), bytes);
  assert.equal(published.name, 'comparison café.png');
});

test('publishing the same filename twice preserves each result', async t => {
  const { state, source } = await fixture(t);
  const first = await publishFile(source, { state });
  await writeFile(source, 'new bytes');
  const next = await publishFile(source, { state });
  assert.notEqual(first.path, next.path);
  assert.notDeepEqual(await readFile(join(state, 'outputs', first.path)), await readFile(join(state, 'outputs', next.path)));
});

test('invalid names and missing sources produce no publication', async t => {
  const { root, state, source } = await fixture(t);
  for (const name of ['..', '.git', '.GIT', 'COM\u00b2', 'a/b.png', 'a\\b.png', 'a:stream', 'end.', 'end ', 'line\n.png', 'line\u0085.png', 'NUL.txt', 'COM1', 'LPT³.bin', 'wild?.png']) {
    await assert.rejects(publishFile(source, { state, name }), /filename/);
  }
  await assert.rejects(publishFile(join(root, 'missing.png'), { state }));
  assert.deepEqual((await readdir(state)).sort(), ['companion-access.json']);
});

test('the helper refuses an outputs junction instead of writing through it', async t => {
  const { root, state, source } = await fixture(t), outside = join(root, 'outside');
  await mkdir(outside);
  await symlink(outside, join(state, 'outputs'), 'junction');
  await assert.rejects(publishFile(source, { state }), /regular folder/);
  assert.deepEqual(await readdir(outside), []);
});

test('private phone configuration is required before any file is copied', async t => {
  const { state, source } = await fixture(t);
  await writeFile(join(state, 'companion-access.json'), JSON.stringify({ PhoneUrl: 'https://public.example/' }));
  await assert.rejects(publishFile(source, { state }), /Tailscale/);
  assert.deepEqual(await readdir(state), ['companion-access.json']);
  for (const value of ['https://.ts.net/', 'https://-invalid.ts.net/', 'http://fixture.example.ts.net/', 'https://user:secret@fixture.example.ts.net/', 'https://fixture.example.ts.net/other', 'https://fixture.example.ts.net/?token=secret', 'https://fixture.example.ts.net/#fragment', 'https://fixture.example.ts.net:8443/']) {
    assert.throws(() => phoneAddress(value), /Tailscale/);
  }
});

test('the helper uses the companion data override and normal Windows app-data location', () => {
  assert.equal(dataDirectory({ WEBTOOLS_COMPANION_DATA: tmpdir() }), resolve(tmpdir()));
  assert.equal(dataDirectory({ LOCALAPPDATA: tmpdir() }), join(tmpdir(), 'WebToolsDesktop'));
  assert.throws(() => dataDirectory({}), /LOCALAPPDATA/);
  assert.equal(phoneAddress('https://fixture.example.ts.net/').href, 'https://fixture.example.ts.net/');
});

test('the command prints a usable URL while publication details stay on stderr', async t => {
  const { state, source } = await fixture(t);
  const script = fileURLToPath(new URL('../../desktop/now-file.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, source, '--state', state, '--name', 'CLI comparison.png'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const url = new URL(result.stdout.trim()), route = new URLSearchParams(url.hash.slice(1));
  assert.equal(route.get('root'), 'outputs');
  assert.match(result.stderr, /saved CLI comparison.png/);
  assert.deepEqual(await readFile(join(state, 'outputs', route.get('file'))), await readFile(source));
});
