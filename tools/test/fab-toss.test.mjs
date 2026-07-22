// fab-toss.test.mjs — the fab's singleton guard, toss-subject adoption, and
// the render tab's branch classification (task 0003). The toss-render side
// (stamping __fabHosted / __tossSubject into rendered HTML) is exercised by
// its own page; these tests cover the fab's half of the contract.
//
// One shared window + Alpine start (the bootstrap pattern); per-scenario fabs
// mount via Alpine.initTree, which runs the same init() a page load would.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="f" x-data="fab()" data-repo="mehrlander/web-tools" data-path="pages/toss-render.html"></div>
  </body></html>`,
});
const Alpine = await startAlpine(window, ['lib/alpineComponents/fab.js']);
const doc = window.document;

// Mount a fresh fab under the current window globals and hand back its $data.
async function mountFab(attrs = '') {
  const host = doc.createElement('div');
  host.innerHTML = `<div x-data="fab()" ${attrs}></div>`;
  doc.body.appendChild(host);
  Alpine.initTree(host);
  await tick(3);
  return { el: host.firstElementChild, host };
}

test('normal mount renders and keeps shell identity', () => {
  const el = doc.getElementById('f');
  assert.ok(el.children.length > 0, 'template renders');
  const d = Alpine.$data(el);
  assert.equal(d.hosted, false);
  assert.equal(d.viaToss, false);
  assert.equal(d.repo, 'mehrlander/web-tools');
  assert.equal(d.shellRepo, 'mehrlander/web-tools');
});

test('singleton guard: __fabHosted suppresses the mount', async () => {
  window.__fabHosted = true;
  try {
    const { el } = await mountFab();
    assert.equal(el.children.length, 0, 'template must not render under a host');
    assert.equal(Alpine.$data(el).hosted, true);
  } finally {
    delete window.__fabHosted;
  }
});

test('adopts a pre-stamped toss subject at init, restores on clear, re-adopts on event', async () => {
  window.__tossSubject = { repo: 'mehrlander/other', ref: 'feature-x', path: 'pages/thing.html' };
  const { el } = await mountFab('data-repo="mehrlander/web-tools" data-path="pages/toss-render.html"');
  const d = Alpine.$data(el);

  assert.equal(d.viaToss, true);
  assert.equal(d.repo, 'mehrlander/other');
  assert.equal(d.path, 'pages/thing.html');
  assert.equal(d.ref, 'feature-x');
  assert.equal(d.frameRef, 'feature-x');
  // Shell identity survives for the Components/Scripts link targets.
  assert.equal(d.shellRepo, 'mehrlander/web-tools');
  assert.match(d.scriptUrl('kits/console.js'), /mehrlander\/web-tools\/blob\/main\/kits\/console\.js$/);
  // Inside a toss the fab IS the toss tab, so no open-in-toss link.
  assert.equal(d.tossUrl, '');

  // Clear (an inline #gz= render, or back to the panel): shell identity returns.
  window.__tossSubject = null;
  window.dispatchEvent(new window.CustomEvent('toss-subject'));
  await tick();
  assert.equal(d.viaToss, false);
  assert.equal(d.repo, 'mehrlander/web-tools');
  assert.equal(d.path, 'pages/toss-render.html');
  assert.equal(d.frameRef, 'main');

  // A later address render re-stamps and re-fires.
  window.__tossSubject = { repo: 'mehrlander/other', ref: 'feature-y', path: 'pages/thing.html' };
  window.dispatchEvent(new window.CustomEvent('toss-subject'));
  await tick();
  assert.equal(d.viaToss, true);
  assert.equal(d.frameRef, 'feature-y');
  window.__tossSubject = null;
  window.dispatchEvent(new window.CustomEvent('toss-subject'));
  await tick();
});

test('classifyRows: statuses and ordering (baseline, differs desc, unknown, same, missing)', () => {
  const d = Alpine.$data(doc.getElementById('f'));

  const rows = d.classifyRows([
    { name: 'b-missing',  date: '2026-07-05', fileOid: null },
    { name: 'b-diff-old', date: '2026-07-03', fileOid: 'B' },
    { name: 'main',       date: '2026-07-01', fileOid: 'A' },
    { name: 'b-same',     date: '2026-07-02', fileOid: 'A' },
    { name: 'b-diff-new', date: '2026-07-04', fileOid: 'C' },
  ], 'main', 'A');
  assert.deepEqual(rows.map(r => r.name),
    ['main', 'b-diff-new', 'b-diff-old', 'b-same', 'b-missing']);
  assert.deepEqual(rows.map(r => r.status),
    ['baseline', 'differs', 'differs', 'same', 'missing']);

  // Rows with no fileOid key at all (the degraded no-token path) are 'unknown'.
  const unknowns = d.classifyRows([
    { name: 'main', date: '2026-07-01' },
    { name: 'b',    date: '2026-07-02' },
  ], 'main', null);
  assert.deepEqual(unknowns.map(r => r.status), ['baseline', 'unknown']);

  // updatedCount surfaces the differs rows (the tab-badge signal).
  d.pageBranches = rows;
  assert.equal(d.updatedCount, 2);
  d.pageBranches = [];
});

test('renderAtRef in a toss re-addresses the shell instead of opening the overlay', async () => {
  window.__tossSubject = { repo: 'mehrlander/other', ref: 'feature-x', path: 'pages/thing.html' };
  const calls = [];
  window.__tossNavigate = addr => calls.push(addr);
  const { el } = await mountFab();
  const d = Alpine.$data(el);

  d.pickFrameRef('feature-z');
  d.renderAtRef();
  assert.deepEqual(calls, ['mehrlander/other@feature-z:pages/thing.html'],
    're-addresses in place via __tossNavigate (no bespoke overlay)');
  window.__tossSubject = null;
  delete window.__tossNavigate;
});

test('mode getters: a toss reads as off-canonical, marks the subject ref', async () => {
  window.__tossSubject = { repo: 'mehrlander/other', ref: 'feature-x', path: 'pages/thing.html' };
  const { el } = await mountFab();
  const d = Alpine.$data(el);
  assert.equal(d.offRef, true, 'a toss is off-canonical');
  assert.equal(d.previewRef, 'feature-x', 'previewRef is the adopted subject ref');
  assert.equal(d.viewingRef, 'feature-x', 'viewingRef marks the ref being rendered');
  assert.equal(d.canonicalUrl(),
    'https://mehrlander.github.io/other/pages/thing.html', 'canonical deployed URL for the subject');

  // Clearing the subject drops back to the live shell: not off-canonical.
  window.__tossSubject = null;
  window.dispatchEvent(new window.CustomEvent('toss-subject'));
  await tick();
  assert.equal(d.offRef, false, 'the live shell is not a preview');
  assert.equal(d.previewRef, null);
});

test('no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});
