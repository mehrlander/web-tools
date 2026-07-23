// alpineComponents/map.js — the Map view inside show-repo (formerly Portable).
// Logic-level tests with real Alpine under jsdom (bootstrap.mjs recipe): the set
// loads from the hub manifest through a stubbed GH, and the scope helpers split
// an inline scope story from a file-pointer scope. Not covered: the live
// adoption probe (token-gated; window.PortableAlign + private reads).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="map" x-data="map()"></div>
  </body></html>`,
});

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine;

const manifest = {
  hub: 'mehrlander/web-tools',
  items: [
    { kind: 'skill', command: '/portable:caption', path: '.claude/skills/caption/SKILL.md', title: 'caption', role: 'the caption', use: 'plugin' },
    { kind: 'doc', path: 'docs/CONVENTIONS.md', title: 'Working conventions', role: 'the conventions', use: 'live' },
    { kind: 'script', path: 'scripts/sunset-scan.py', title: 'sunset-scan.py', role: 'sunset markers', use: 'on-demand' },
  ],
};
window.TOKEN = 'ignored-in-test';
window.GH = class {
  constructor(opts) { this.opts = opts; }
  async get(p) { return { text: JSON.stringify(manifest) }; }
};
// No window.__shell in the test, so hasToken() is falsy and the token-gated
// adoption probe never runs; only the public set half loads.

new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/map.js'), 'utf8'))();
Alpine.start();
await tick(3);

const el = window.document.getElementById('map');
const data = Alpine.$data(el);

test('mounts and loads the public set with no startup warnings; adoption stays gated', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
  assert.equal(data.authed, false, 'no token means the per-repo half is gated off');
  assert.ok(data.manifest && data.manifest.items.length === 3);
});

test('the set groups into plugin / docs / scripts sections', () => {
  const secs = data.setSections;
  // [...] rebuilds the realm-crossed array on this side for deepEqual.
  assert.deepEqual([...secs.map(s => s.label)], ['In the plugin', 'Docs', 'Scripts']);
  assert.equal(secs[0].items[0].title, 'caption');
});

test('scope helpers split an inline story from a file pointer', () => {
  assert.equal(data.scopeIsFile('docs/SCOPE.md'), true);
  assert.equal(data.scopeIsFile('projects/x/SCOPE.md'), true);
  assert.equal(data.scopeIsFile('A private orchestration base. Holds content, not conventions.'), false);
  assert.equal(data.scopeText({ scope: 'A private base.' }), 'A private base.');
  assert.equal(data.scopeText({ scope: 'docs/SCOPE.md' }), '', 'a file pointer is not inline text');
  assert.equal(data.scopeFile({ scope: 'docs/SCOPE.md' }), 'docs/SCOPE.md');
  assert.equal(data.scopeFile({ scope: 'A private base.' }), '');
  assert.equal(data.scopeFileGh({ repo: 'me/proj', scope: 'docs/SCOPE.md' }),
    'https://github.com/me/proj/blob/HEAD/docs/SCOPE.md');
});

test('the hub doc link resolves to a GitHub blob', () => {
  assert.equal(data.hubUrl('docs/PORTABLE.md'),
    'https://github.com/mehrlander/web-tools/blob/main/docs/PORTABLE.md');
});

test('openConfig opens the repo dialog on the Config tab without throwing', () => {
  // No #repo element is mounted in this harness, so the call must no-op safely
  // (optional chaining) rather than throw; the real wiring is the shell dialog.
  assert.doesNotThrow(() => data.openConfig('me/proj'));
});
