// entry.js: the one line a page runs to boot the library.
//
//   await import('https://mehrlander.github.io/web-tools/lib/entry.js');
//
// Served from GitHub Pages, the one host here that answers a JavaScript file
// with a JavaScript content type, so any page on any origin can import it.
//
// The ref, in order: entry.js?ref=<ref> on the import URL (the page's own
// choice; the budget-drs pages pass their ?lib= this way), else window.__lib
// (stamped by toss-render only when a Web Tools version was asked for), else
// the page's ?use=<branch|tag|sha> (real on a deployed page, or the effective
// Web Tools ref toss-render answers for any framed page), else main. Under a
// toss, __lib and use agree whenever both are present; __lib comes first so
// an explicit selection survives a page that reads its own query some other
// way.
//
// It sets window.__ghBlobBoot = { repo, ref }, the signal gh-api.js's
// auto-bootstrap reads, then brings gh-api.js in by one of two routes:
//
//   - main: a native import of gh-api.js from beside this file.
//   - any other ref: that ref's gh-api.js from raw.githubusercontent,
//     blob-imported. raw serves text/plain with nosniff, so a blob import is
//     the only way to run it, and raw tracks a push within minutes.
//
// The main route is deliberately a native import, not the blob route at
// main. The 2026-09-08 device matrix found that a toss shell pinned with
// ?use=<sha> dies on an iPhone when it hosts a frame, and the blob import is
// one of the two things that pin changes; the other is the ref the shell's gh
// names. No cell has run the blob route at main, so which of the two is fatal
// is open: pages/scratch/shell-pin-probe.html separates them. Either way every
// file after gh-api.js loads through gh.load at the same ref.
//
// This file itself always comes from main: ?use= pins everything below it,
// not it. Keep it this small so that never matters.

const repo = 'mehrlander/web-tools';
const ref = new URL(import.meta.url).searchParams.get('ref')
  || window.__lib
  || new URLSearchParams(location.search).get('use') || 'main';
window.__ghBlobBoot = { repo, ref };
if (ref === 'main') {
  await import('./gh-api.js');
} else {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/lib/gh-api.js`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`entry.js: gh-api.js@${ref} answered HTTP ${res.status}`);
  const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/javascript' }));
  try { await import(url); } finally { URL.revokeObjectURL(url); }
}
