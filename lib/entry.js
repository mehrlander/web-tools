// entry.js: the one line a page runs to boot the library.
//
//   await import('https://mehrlander.github.io/web-tools/lib/entry.js');
//
// Served from GitHub Pages, the one host here that answers a JavaScript file
// with a JavaScript content type, so any page on any origin can import it.
// It sets window.__ghBlobBoot = { repo, ref }, the signal gh-api.js's
// auto-bootstrap reads, then brings gh-api.js in by one of two routes:
//
//   - no ?use=: a native import of main's gh-api.js from beside this file.
//   - ?use=<branch|tag|sha>: that ref's gh-api.js from raw.githubusercontent,
//     blob-imported. raw serves text/plain with nosniff, so a blob import is
//     the only way to run it, and raw tracks a push within minutes.
//
// The unpinned route is deliberately a native import, not the blob route at
// main: a toss shell hosting a frame survives it on iPhone and dies on the blob
// route, measured on the device and recorded in scripts/showing.py, with the
// mechanism unknown. Either way every file after gh-api.js loads through
// gh.load at the same ref.
//
// This file itself always comes from main: ?use= pins everything below it,
// not it. Keep it this small so that never matters.

const repo = 'mehrlander/web-tools';
const use = new URLSearchParams(location.search).get('use');
const ref = use || 'main';
window.__ghBlobBoot = { repo, ref };
if (!use) {
  await import('./gh-api.js');
} else {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/lib/gh-api.js`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`entry.js: gh-api.js@${ref} answered HTTP ${res.status}`);
  const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/javascript' }));
  try { await import(url); } finally { URL.revokeObjectURL(url); }
}
