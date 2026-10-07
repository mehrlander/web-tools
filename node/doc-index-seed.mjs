#!/usr/bin/env node
// Seed state/docs.json (lib/kits/doc-index.js) from local checkouts, so the
// hourly crawl starts incremental instead of reading every Markdown file in
// the estate through the API: about 14,000 files across ten repos, measured
// 2026-10-07, against the crawl's 300 reads per repo per run.
//
//   node node/doc-index-seed.mjs [--registry ../web-tools-private] [--repo owner/name ...] [--write]
//
// Each repo is read at the default-branch tip state/files.json last recorded,
// from a checkout named like the repo beside this one (or under its owner's
// folder, where a cloud session puts a read-only clone), so the crawl's tip
// gate sees an entry it can carry. A shallow clone that lacks that commit is
// read at its own tip instead, and the crawl catches up from there. A repo
// with no checkout is skipped, and the crawl builds it in its first run.
// Without --write it prints what it would store.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const registry = path.resolve(root, opt('--registry', '../web-tools-private'));
const only = argv.flatMap((a, i) => a === '--repo' ? [argv[i + 1]] : []);
const write = argv.includes('--write');

const win = {};
for (const f of ['lib/kits/file-index.js', 'lib/kits/doc-index.js'])
  new Function('window', readFileSync(path.join(root, f), 'utf8'))(win);
const D = win.DocIndex;

const files = JSON.parse(readFileSync(path.join(registry, 'state/files.json'), 'utf8'));
const out = path.join(registry, D.CACHE_PATH);
const prev = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });

const got = {};
for (const [repo, e] of Object.entries(files.repos || {})) {
  if (only.length && !only.includes(repo)) continue;
  const dir = [path.join(root, '..', repo.split('/').pop()), path.join(root, '..', repo)]
    .find(d => existsSync(path.join(d, '.git')));
  if (!dir) { console.log(`${repo}: no checkout, left to the crawl`); continue; }
  const has = (sha) => { try { git(dir, 'cat-file', '-e', sha + '^{commit}'); return true; } catch { return false; } };
  if (!has(e.sha)) git(dir, 'fetch', '-q', 'origin');
  const sha = has(e.sha) ? e.sha : git(dir, 'rev-parse', 'origin/HEAD').trim();
  const blobs = git(dir, 'ls-tree', '-r', sha).split('\n').flatMap(line => {
    const m = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(line);
    return m && D.isDoc(m[2]) ? [{ blob: m[1], path: m[2] }] : [];
  });
  // One cat-file process for the repo: "<sha> blob <size>\n<bytes>\n" per object.
  const res = spawnSync('git', ['-C', dir, 'cat-file', '--batch'],
    { input: blobs.map(b => b.blob).join('\n') + '\n', maxBuffer: 1 << 30 });
  const buf = res.stdout;
  let at = 0;
  const docs = blobs.map(b => {
    const nl = buf.indexOf(10, at);
    const size = +buf.toString('latin1', at, nl).split(' ')[2];
    const text = buf.toString('utf8', nl + 1, nl + 1 + size);
    at = nl + 1 + size + 1;
    return { path: b.path, blob: b.blob, words: D.countWords(text) };
  });
  got[repo] = { sha, at: new Date().toISOString(), truncated: false, ...D.encode(docs) };
  console.log(`${repo}: ${got[repo].docs} documents, ${got[repo].words} words at ${sha.slice(0, 7)}${sha === e.sha ? '' : ' (the clone\'s tip)'}`);
}

const scope = [...new Set([...Object.keys(prev?.repos || {}), ...Object.keys(got)])];
const next = D.buildIndex(prev, got, scope, new Date().toISOString());
if (prev?.runs) next.runs = prev.runs;
if (!write) { console.log(`Dry run: would write ${path.relative(root, out)} (${Object.keys(next.repos).length} repos).`); process.exit(0); }
writeFileSync(out, D.serialize(next));
console.log(`Wrote ${path.relative(root, out)}.`);
