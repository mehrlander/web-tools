// toss-top-launcher.test.mjs — the top-mode launcher (pages/scratch/toss-top-probe.html)
// keeps a link's whole selection in every URL the page it runs writes.
//
// The launcher replaces itself with a page, so the page's history writes land
// on the launcher's own URL. Its history shim puts gh=<address> back at the
// head and restores the selection (refs=owner/repo@ref[:path], lib=) the page
// did not write. Until 2026-09-29 it restored nothing: a page writing
// ?view=tools dropped every entry, and a reload lost the selection. This is
// the device-test route before the renderer's own ?top is deployed, so a
// check run through it on a phone is only as good as this. The launcher's own
// function is evaluated here, as the file ships it; the renderer's copy is held
// to the same behaviour in toss-top-mode.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = fs.readFileSync(new URL('../../pages/scratch/toss-top-probe.html', import.meta.url), 'utf8');
const keepSource = new Function((SRC.match(/const keepSource = [\s\S]*?;\n/) || [''])[0] + 'return keepSource;')();

// The selection a link carries: two repositories, a file entry, a folder entry,
// and lib as the web-tools entry.
const SEL = ['mehrlander/home@home-br', 'mehrlander/web-tools-private@data-br',
  'mehrlander/home@tenant-br:projects/budget-drs/submittal/link-rewrite.js',
  'mehrlander/web-tools@comp-br:lib/alpineComponents/'];
const K = [['lib', 'main'], ...SEL.map(v => ['refs', v])];
const keep = written => {
  const q = new URLSearchParams(written);
  new Function('K', 'q', keepSource + 'keep(q);')(K, q);
  return q;
};

test('the launcher ships the restore function, and its history shim calls it', () => {
  assert.match(keepSource, /function keep\(q\)/, 'keepSource moved or lost its keep()');
  assert.match(SRC, /K=\$\{JSON\.stringify\(kept\)\};` \+ keepSource \+/, 'the history shim no longer carries the selection');
  assert.match(SRC, /q\.delete\("gh"\);keep\(q\);/, 'the history shim no longer restores the selection');
});

test('a page write that carries no selection gets every entry back', () => {
  const q = keep('view=tools');
  assert.deepEqual(q.getAll('refs'), SEL);
  assert.equal(q.get('lib'), 'main');
  assert.equal(q.get('view'), 'tools');
});

test('an entry the page writes for a target is the page\'s; the others still come back', () => {
  assert.deepEqual(keep('refs=mehrlander/home@page-own').getAll('refs'), ['mehrlander/home@page-own', ...SEL.slice(1)],
    'the repository entry is replaced; the file entry in the same repository is another target');
  assert.equal(keep('view=a&lib=own').get('lib'), 'own', 'a lib the page writes is the page\'s');
  assert.deepEqual(keep(SEL.map(v => 'refs=' + v).join('&')).getAll('refs'), SEL, 'no duplicates for a page that carries its query');
});
