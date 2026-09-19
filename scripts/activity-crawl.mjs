#!/usr/bin/env node
// activity-crawl.mjs — refresh state/activity.json from outside a browser, so a
// merge to main updates the Activity view instead of the cache waiting for
// whoever opens the app next.
//
//   npm run activity-refresh -- --repo mehrlander/home [--repo …] [--dry-run]
//   npm run activity-refresh -- --all [--dry-run]
//
// The crawl itself is lib/kits/activity-crawl.js and the fold is
// lib/kits/repo-activity-cache.js, both of them the same files show-repo loads,
// so this is a second CALLER and not a second crawler. What is local to this
// file is the part the shell keeps in the page: which repos to crawl, reading
// the prior cache, and the commit.
//
// WHERE IT CAN RUN, and the finding that decides it: GitHub Actions, not a
// Claude Code session. Two of the crawl's reads are GraphQL (gh.branchPulls for
// the any-state PR index, gh.branchesDatedSessions for the dated branch walk),
// and a session's proxy answers api.github.com/graphql with 403. Neither read
// throws in a way the crawl notices: the branch walk falls back to the dateless
// REST list, so every branch classifies `older` and `active` reads zero, and the
// PR index comes back empty. A pass like that reports success and writes a
// materially wrong entry, which is why the GraphQL preflight below is a hard
// gate rather than a warning.
//
// Credentials: GH_TOKEN (or GITHUB_TOKEN) reads the crawled repos, and
// GH_WRITE_TOKEN writes the registry if it is set, falling back to the read
// token when it is not. A workflow's own GITHUB_TOKEN reaches neither, since
// both live in other repositories. The split is worth taking: the read token is
// the one that has to name every estate repo, and a fine-grained PAT grants the
// same permissions to every repository it selects, so one token doing both jobs
// is a write token for the whole estate. Two tokens make it a read token for the
// estate and a write token for one repo.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'mehrlander/web-tools-private';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const values = (name) => argv.reduce((out, a, i) => (a === name && argv[i + 1] ? [...out, argv[i + 1]] : out), []);

const dryRun = flag('--dry-run');
const wantAll = flag('--all');
const named = values('--repo').map(r => (r.includes('/') ? r : `mehrlander/${r}`));
if (!wantAll && !named.length) {
  console.error('usage: activity-crawl.mjs (--repo <owner/name> … | --all) [--dry-run]');
  process.exit(2);
}
// A repository_dispatch payload reaches this argument, so it is shaped here
// before it reaches a URL. Membership is checked separately below; this is the
// cheaper question of whether the string is a repo name at all.
for (const r of named) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(r)) {
    console.error(`not a repository name: ${r}`);
    process.exit(2);
  }
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const writeToken = process.env.GH_WRITE_TOKEN || token;
if (!token) {
  console.error('No token. Set GH_TOKEN to one that can read the estate repos, and GH_WRITE_TOKEN to one that can write ' + REGISTRY + '.');
  process.exit(1);
}

// ── Load the browser files, as browser files ────────────────────────────────
// gh-api.js is an ES module whose bootstrap is guarded on `window`, so Node
// imports it and gets the class alone. Everything else is an IIFE that attaches
// to `window`, which is the shape scripts/check-branch-status.mjs already reads
// this way: one object stands in for the page, and the kits see each other on it.
const { default: GH } = await import(pathToFileURL(path.join(root, 'lib/gh-api.js')).href);
const win = { GH };
globalThis.window = win;
for (const file of ['lib/gh-fetch.js', 'lib/gh-store.js', 'lib/kits/csv.js',
                    'lib/kits/crawl-runs.js', 'lib/kits/branch-status.js',
                    'lib/kits/repo-checks.js', 'lib/kits/repo-config-cache.js',
                    'lib/kits/repo-activity-cache.js', 'lib/kits/activity-crawl.js']) {
  new Function('window', readFileSync(path.join(root, file), 'utf8'))(win);
}
const { ActivityCrawl: C, BranchStatus: B, RepoActivityCache: A, RepoConfigCache: CC, RepoChecks, CrawlRuns } = win;

// ── The preflight the header explains ───────────────────────────────────────
{
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query { viewer { login } }' }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
    console.error(`GraphQL is unreachable (${res.status}), so this crawl would write a wrong entry rather than fail: ` +
                  'the branch walk would fall back to the dateless REST list and the PR index would come back empty.');
    console.error('Detail: ' + detail);
    console.error('Run this from GitHub Actions. A Claude Code session cannot POST GraphQL.');
    process.exit(1);
  }
}

const t0 = Date.now();
const reg = new GH({ token: writeToken, repo: REGISTRY, ref: 'main' });

// Estate membership and each repo's own .web-tools.json, from the config cache
// the sibling crawl maintains. Same rule the shell applies: `estate: true`, less
// whatever the registry's own config hides.
// THE FIRST READ A NEW TOKEN MAKES, and therefore the one that has to explain
// itself. GitHub answers a repository the credential cannot see with 404 rather
// than 403, so the bare error reads as a missing file and is a missing
// permission. Measured on this job's first live run, 2026-09-19: the token
// authenticated (the preflight passed, the rate-limit header came back) and
// still could not see the registry.
let configs;
try {
  configs = JSON.parse((await reg.get(CC.CACHE_PATH, GH.FRESH)).text);
} catch (e) {
  if (e?.status === 404 || e?.status === 403) {
    console.error(`Cannot read ${CC.CACHE_PATH} in ${REGISTRY} (HTTP ${e.status}).`);
    console.error('The token reached GitHub, so this is what it is allowed to see rather than whether it works.');
    console.error('A fine-grained token needs that repository in its selection, with Contents read.');
    console.error('A classic token needs the `repo` scope; one with no scopes reads public repositories only.');
    process.exit(1);
  }
  throw e;
}
const hidden = new Set(configs.repos?.[REGISTRY]?.config?.hidden || []);
const members = Object.entries(configs.repos || {})
  .filter(([name, e]) => e?.config?.estate === true && !hidden.has(name))
  .map(([name]) => name);
const cfgByName = new Map(Object.entries(configs.repos || {}).map(([name, e]) => [name, e?.config || null]));

const targets = wantAll ? members : named.filter(r => {
  if (members.includes(r)) return true;
  console.warn(`skipping ${r}: not an estate member in state/configs.json, so the Activity view would not show it`);
  return false;
});
if (!targets.length) {
  console.log('Nothing to crawl.');
  process.exit(0);
}

// The prior cache, read once for the scan gate. It is read AGAIN below, just
// before the fold, for the same reason the shell re-reads: a crawl takes a
// while, and folding over the copy read before it would revert whatever landed
// in between.
let base = await readCache();
let prev = base?.doc || null;

const now = Date.now();
const fetched = {};
const failed = [];
for (const repo of targets) {
  let meta = null;
  // Absolute path, so this is the repo listing's row read one repo at a time:
  // `pushed_at` and `default_branch` are all the crawl wants from it.
  try { meta = await new GH({ token }).req('/repos/' + repo); }
  catch (e) { failed.push(repo); console.warn(`${repo}: cannot read the repo (${e?.message || e})`); continue; }
  const deep = C.needsScan(prev?.repos?.[repo], meta?.pushed_at || '');
  try {
    fetched[repo] = await C.crawlRepo(repo, meta, now, {
      makeGH: (r, ref) => new GH({ token, repo: r, ref }),
      B, checks: RepoChecks, cfg: cfgByName.get(repo), deep, prev,
    });
    const scan = fetched[repo].scan;
    console.log(`${repo}: ${deep ? (scan ? `scanned ${scan.scanned} of ${scan.older} older branches` : 'scan did not complete') : 'summary only (not pushed since the last scan)'}`);
    if (deep && fetched[repo].partial) failed.push(repo);
  } catch (e) {
    failed.push(repo);
    console.warn(`${repo}: crawl failed (${e?.message || e})`);
  }
}

base = await readCache();
prev = base?.doc || null;
const nowISO = new Date().toISOString();
// The carry scope is what this pass SET OUT to cover, and the two modes differ.
// buildCache prunes anything outside it, which is how the cache tracks estate
// membership: an `--all` pass covers the estate, so a repo that has left it is
// meant to go, exactly as the browser's pass drops it. A single-repo pass covers
// one repo and knows nothing about the rest, so everything already in the cache
// carries; passing only the target's name there would delete the estate.
const carry = wantAll ? members : [...new Set([...Object.keys(prev?.repos || {}), ...targets])];
const next = A.buildCache(prev, fetched, nowISO, A.COMMIT_CAP, carry);
const changed = A.changedRepos(prev, next);

if (!changed.length) {
  console.log(`No material change across ${targets.length} repo(s); nothing to commit.`);
  process.exit(failed.length ? 1 : 0);
}
console.log('Changed: ' + changed.join(', '));
if (dryRun) {
  console.log('Dry run: not committing.');
  process.exit(0);
}

next.runs = CrawlRuns.push(prev?.runs, {
  at: nowISO, ms: Date.now() - t0,
  checked: targets.length, changed: changed.length, failed: failed.length,
  pass: 'scan',
  // Which venue ran it. The ring's other entries all come from a browser, and a
  // reader comparing durations should be able to see that this one did not.
  via: 'ci',
}) ?? prev?.runs;

// The same subject the app writes, deliberately: kits/write-kinds.js classifies
// a commit by its subject line, and this IS the crawl, whatever ran it.
await reg.save(A.CACHE_PATH, next, 'Update activity cache (state/activity.json)', { sha: base?.sha });
console.log(`Committed ${A.CACHE_PATH} (${changed.length} repo(s) changed, ${Date.now() - t0}ms).`);
process.exit(failed.length ? 1 : 0);

async function readCache() {
  try {
    const r = await reg.get(A.CACHE_PATH, GH.FRESH);
    return { doc: JSON.parse(r.text), sha: r.sha };
  } catch (e) {
    // A missing cache is a first run, not a failure: buildCache handles a null
    // prior. Anything else (a 403, a truncated read) must not silently become
    // one, because folding onto null would publish a cache holding only the
    // repos this pass reached.
    if (e?.status === 404) return null;
    console.error(`Cannot read ${A.CACHE_PATH}: ${e?.message || e}`);
    process.exit(1);
  }
}
