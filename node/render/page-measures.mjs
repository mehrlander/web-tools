#!/usr/bin/env node
// Run the page-measures pass (screenshot.mjs --measure) over a set of pages
// and write one report: a row per page, its render health, its findings, and
// the signals worth reading beside the image.
//
//   node node/render/page-measures.mjs <page...>       the named pages
//   node node/render/page-measures.mjs --base <ref>    pages changed since <ref>
//   node node/render/page-measures.mjs --all           every page pages-shots shoots
//       [--jobs N] [--summary <file>]
//
// With --base, a change to the pass itself (anything in node/render/, or the
// workflow) widens the set to every page, so a PR that changes how pages are
// measured is measured everywhere.
//
// Report only, by design: findings never set the exit code. Under this repo's
// PR rules a red check on a session's own PR is work that session must come
// back for, and the measures are signals, not verdicts. The exit code is
// nonzero only when this script itself fails.
//
// Each page is shot at 1000x625, the thumbnail size, with its declared
// shot-query, so the pixel comparison is like for like. Output lands in
// node/.preview/page-measures/ (gitignored): <page>.png, .phone.png,
// .measures.json, and report.md.

import { spawn, execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile, appendFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT = path.join(repoRoot, 'node/render/screenshot.mjs');
const OUT = path.join(repoRoot, 'node/.preview/page-measures');
const WIDENS = [/^node\/render\//, /^\.github\/workflows\/page-measures\.yml$/];

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const flag = name => { const i = args.indexOf(name); return i >= 0 && !!args.splice(i, 1); };
const base = opt('--base'), summary = opt('--summary'), jobs = +(opt('--jobs') || 4), all = flag('--all');

// The page set pages-shots shoots: pages/ and the kit demos, no index files.
async function walk(dir) {
  const out = [];
  for (const e of await readdir(path.join(repoRoot, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'thumbs') out.push(...await walk(rel)); }
    else if (e.name.endsWith('.html') && e.name !== 'index.html') out.push(rel);
  }
  return out;
}
const universe = async () => [...await walk('pages'), ...await walk('lib/kits/demos')].sort();

async function choose() {
  if (all) return { pages: await universe(), why: 'every page (--all)' };
  if (!base) return { pages: args, why: 'named pages' };
  const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const pool = await universe();
  if (changed.some(f => WIDENS.some(re => re.test(f))))
    return { pages: pool, why: `every page, because the pass itself changed since ${base}` };
  return { pages: pool.filter(p => changed.includes(p)), why: `pages changed since ${base}` };
}

async function shoot(page) {
  const html = await readFile(path.join(repoRoot, page), 'utf8');
  const q = html.match(/<meta\s+name="shot-query"\s+content="([^"]*)"/);   // as pages-shots reads it
  const png = path.join(OUT, page.replace(/\//g, '--').replace(/\.html$/, '.png'));
  const t = Date.now();
  const { code, out } = await new Promise(done => {
    let out = '';
    const c = spawn(process.execPath, [SHOT, page, '--measure', '--width', '1000', '--height', '625', '--out', png,
      ...(q ? ['--query', q[1]] : [])], { cwd: repoRoot });
    c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d);
    c.on('close', code => done({ code, out }));
  });
  const json = png.replace(/\.png$/, '.measures.json');
  const m = existsSync(json) ? JSON.parse(await readFile(json, 'utf8')) : null;
  return { page, sec: (Date.now() - t) / 1000, code, m, tail: code ? out.trim().split('\n').slice(-3).join(' ') : '' };
}

const { findings, signals } = await import('./measure.mjs');
const cell = s => String(s).replace(/\|/g, '\\|');
const render = r => r.code ? `failed (exit ${r.code}): ${r.tail}`
  : !r.m ? 'no measures written' : r.m.warnings.length ? r.m.warnings.map(w => w.trim()).join('<br>') : 'ok';

const { pages, why } = await choose();
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const t0 = Date.now();
const queue = [...pages], rows = [];
await Promise.all(Array.from({ length: Math.min(jobs, pages.length) }, async () => {
  while (queue.length) rows.push(await shoot(queue.shift()));
}));
const wall = ((Date.now() - t0) / 1000).toFixed(1);

const found = r => r.m ? findings(r.m) : [];
rows.sort((a, b) => (render(b) !== 'ok') - (render(a) !== 'ok') || found(b).length - found(a).length || a.page.localeCompare(b.page));
const lines = [
  '## Page measures', '',
  pages.length
    ? `${pages.length} page(s), ${why}, in ${wall} s, ${jobs} at a time. Report only: findings never fail this check. ` +
      'Each page was shot at 1000×625 and at 390 px wide; the images are in this run\'s `page-measures` artifact.'
    : `No page to measure: ${why} is empty.`,
];
if (rows.length) lines.push('', '| Page | Render | Findings | Signals |', '|---|---|---|---|',
  ...rows.map(r => `| \`${r.page}\` | ${cell(render(r))} | ${cell(found(r).join('<br>') || 'none')} | ${r.m ? cell(signals(r.m)) : ''} |`));
const report = lines.join('\n') + '\n';

await writeFile(path.join(OUT, 'report.md'), report);
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ why, wall: +wall, jobs, rows }, null, 1));
if (summary) await appendFile(summary, report);
console.log(report);
