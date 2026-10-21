// ONE OWNER FOR THE CLIPBOARD WRITE, held here because the duplication came
// back by copy-paste rather than by decision. Four kits carried the same
// textarea fallback: chat-render and vanilla-demo byte-identical, session-export
// the same idea returning a boolean, md-doc already delegating. The block is not
// boilerplate but the iOS recipe kits/io.js documents at length, so four copies
// were four places for it to drift, and three had already drifted on what they
// returned.
//
// The gate is deliberately about the FALLBACK, not about `navigator.clipboard`:
// a kit may reach the modern API directly as its no-io.js degradation, and the
// delegates do exactly that. What no kit may re-implement is the legacy path.
//
// THE RECIPE MOVED DOWN A LAYER on 2026-10-20, to vanilla-bundle.js as
// window.copy.legacy. Outside the kits the same textarea write had four more
// copies (window.copy's own fallback, the Alpine $clip magic, the transform
// workbench, and the shorter and chat-results pages), and io.js could not be
// their owner: it is fetched by the kits that copy, while vanilla-bundle loads
// first on every page. io.copy keeps the focus wait and the modern API, and
// falls back through window.copy.legacy like everything else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const KITS = 'lib/kits';

const ALLOWED = new Set([
  // The owner.
  'lib/vanilla-bundle.js',
  // annotate.js's exception is earned: the card mounts into ARBITRARY
  // documents, including a page running inside a toss frame, so its fallback
  // selects into `S.doc` rather than the top-level `document`, and marks its
  // textarea so its own observer ignores it.
  'lib/kits/annotate.js',
  // A drop page that loads no library.
  'pages/drop/live-docs-concept.html',
]);

test('only vanilla-bundle.js (and the annotator) implement the legacy clipboard write', () => {
  const files = execFileSync('git', ['ls-files', 'lib', 'pages', 'app', 'popups'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(js|html)$/.test(f) && !f.startsWith('pages/scratch/') && !ALLOWED.has(f));
  const offenders = files.filter((f) => /execCommand\(\s*['"]copy['"]\s*\)/.test(readFileSync(join(repoRoot, f), 'utf8')));
  assert.deepEqual(offenders, [],
    'these re-implement the legacy copy; delegate to window.copy.legacy (or io.copy) instead');
});

test('every kit that copies delegates to io.copy and fetches it at load time', () => {
  // Fetched when the kit loads, never inside the click: a write has to run in
  // the gesture that asked for it, and an await before it can spend the user
  // activation Safari counts.
  // session-export.js was here and is not: it stopped copying on 2026-09-06,
  // so the delegate and the load-time fetch went with the button. A kit that
  // does not copy is not exempt from this rule, it is outside it.
  const consumers = ['chat-render.js', 'vanilla-demo.js', 'md-doc.js', 'row-menu.js', 'json-explorer.js'];
  for (const name of consumers) {
    const src = readFileSync(join(KITS, name), 'utf8');
    assert.match(src, /window\.io\.copy\(text\)/, name + ' delegates the write');
    assert.match(src, /ghRef\.load\('kits\/io\.js'\)/, name + ' fetches io.js at load time');
    assert.doesNotMatch(src, /ghRef\.load\('kits\/io\.js'\)[\s\S]{0,80}await/,
      name + ' does not await io.js inside a handler');
  }
});

test('a kit that does not copy carries no clipboard machinery', () => {
  // The list above is a membership claim in one direction only. This is the
  // other: session-export draws the session outline and has no copy control, so
  // an io.js fetch sitting in it would be a load nothing spends.
  const src = readFileSync(join(KITS, 'session-export.js'), 'utf8');
  assert.doesNotMatch(src, /window\.io\.copy/, 'no clipboard delegate');
  assert.doesNotMatch(src, /kits\/io\.js/, 'and nothing fetches io.js for it');
});

test('io.copy returns the deferred write\'s own answer', () => {
  // The unfocused branch waits for a click and then copies. It used to resolve
  // undefined, so a caller reading the result showed "Failed" on a copy that
  // had just succeeded.
  const src = readFileSync(join(KITS, 'io.js'), 'utf8');
  assert.match(src, /resolve\(await io\.copy\(text\)\)/);
});
