#!/usr/bin/env node
// sessions-crawl.mjs — refresh state/sessions.json, the phone's
// state/session-menu.json and the session search shards from outside a browser,
// so a session's record reaches them without waiting for someone to open the
// app's Sessions view.
//
//   npm run sessions-refresh [-- --dry-run]
//
// The crawl is lib/kits/sessions-crawl.js, the same file the app loads, so this
// is a second CALLER and not a second crawler. What is local to this file is
// the part the shell keeps in the page: the client, the reads and writes, and
// the report. It has no listing gate: the app's gate is a browser's own record
// of what it last folded, and a runner with no memory between runs reads the
// cache instead, which costs one file read an hour.
//
// It needs no GraphQL, so unlike activity-crawl.mjs it runs anywhere a token
// reaches the REST API.
//
// Credentials: GH_WRITE_TOKEN reads and writes the registry, falling back to
// GH_TOKEN (or GITHUB_TOKEN). GH_TOKEN also reads the session-titles export in
// mehrlander/chat-histories; a token that cannot see it leaves every title as
// the cache already had it, which is the kit's rule for any failed titles read.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'mehrlander/web-tools-private';
const dryRun = process.argv.slice(2).includes('--dry-run');

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const writeToken = process.env.GH_WRITE_TOKEN || token;
if (!writeToken) {
  console.error('No token. Set GH_WRITE_TOKEN (or GH_TOKEN) to one that can read and write ' + REGISTRY + '.');
  process.exit(1);
}

// The browser files, as browser files: gh-api.js exports the class, and every
// other file is an IIFE that attaches to one object standing in for the page.
const { default: GH } = await import(pathToFileURL(path.join(root, 'lib/gh-api.js')).href);
const win = { GH };
globalThis.window = win;
for (const file of ['lib/gh-fetch.js', 'lib/gh-store.js', 'lib/kits/csv.js',
                    'lib/kits/closing-state.js', 'lib/kits/repo-sessions-cache.js',
                    'lib/kits/session-index.js', 'lib/kits/crawl-runs.js',
                    'lib/kits/sessions-crawl.js']) {
  new Function('window', readFileSync(path.join(root, file), 'utf8'))(win);
}
const { RepoSessionsCache: S, SessionIndex: X, CrawlRuns, SessionsCrawl: C } = win;

const reg = new GH({ token: writeToken, repo: REGISTRY, ref: 'main' });

// The first read a new token makes, and so the one that explains itself:
// GitHub answers a repository the credential cannot see with 404, which reads
// as a missing file and is a missing permission.
let listing;
try {
  listing = await C.listRecords(reg, S);
} catch (e) {
  if (e?.status === 404 || e?.status === 403) {
    console.error(`Cannot list ${REGISTRY} (HTTP ${e.status}). A fine-grained token needs that repository in its selection, with Contents read.`);
    process.exit(1);
  }
  throw e;
}
if (!listing.length) {
  console.log('No session records in the registry; nothing to fold.');
  process.exit(0);
}

// A missing file is a first run and folds onto nothing. Any other failure
// must stop the pass: folding onto null would publish a cache holding only the
// records this pass happened to read.
async function readFold(p) {
  try {
    const r = await reg.get(p, GH.FRESH);
    return { doc: JSON.parse(r.text), sha: r.sha };
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}
const written = [];
async function saveFold(p, doc, message, base) {
  if (dryRun) { written.push(p); return null; }
  const res = await reg.save(p, doc, message, { sha: base?.sha });
  written.push(p);
  return res;
}

const r = await C.fold({
  reg, S, listing, readFold, saveFold,
  readTitles: () => C.readTitles(new GH({ token, repo: S.TITLES_REPO }), S),
  loadIndex: async () => X,
  runs: CrawlRuns,
  // Which venue ran it, so a reader comparing durations in the run ring can
  // see that this one was not a browser.
  via: 'ci',
});

console.log(`${r.total} records listed; read ${r.read}${r.deferred ? `, ${r.deferred} deferred to the next pass` : ''}.`);
if (!written.length) console.log('No material change; nothing to commit.');
else console.log((dryRun ? 'Dry run, would write: ' : 'Committed: ') + written.join(', '));
