// Programs are declared in a repo's .web-tools.json (docs/manifest-fields.csv,
// programs[]). A declaration is the one list the Programs tab, the programs
// skill and the program-files hook all read, so a path in it that no longer
// exists misleads all three at once. This holds every declaration to the
// files on disk: the program's folder and its README.md charter exist, every
// governed path exists, no file answers
// to two programs, and every reviewer is an agent docs/agents.csv lists.
// A program with status "proposed" has a folder and a mark but no charter,
// and governs nothing until it is adopted. Its `areas`, the Program view's
// tiles, name rows of its charter's Areas table, icons the font carries, and
// registries on disk whose header has every column a panel reads. A groups
// panel draws a chip a group, so it names an icon for every group it draws,
// and each row's `file` is a file on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const SIBLINGS = ['home', 'chat-histories', 'web-tools-private', 'shortcut-tools', 'fun'];

function declarations() {
  const found = [];
  const read = (repo, root) => {
    const p = path.join(root, '.web-tools.json');
    if (!existsSync(p)) return;
    let m;
    try { m = JSON.parse(readFileSync(p, 'utf8')); } catch { return; }
    for (const e of Array.isArray(m.programs) ? m.programs : []) found.push({ repo, root, e });
  };
  read('mehrlander/web-tools', repoRoot);
  for (const name of SIBLINGS) read('mehrlander/' + name, path.join(repoRoot, '..', name));
  return found;
}

const agents = new Set(parseCsv(readFileSync(path.join(repoRoot, 'docs', 'agents.csv'), 'utf8')).map(r => r.id));

test('the hub declares at least one program', () => {
  assert.ok(declarations().some(d => d.repo === 'mehrlander/web-tools'));
});

test('every program names itself, an icon and a folder whose README.md is its charter', () => {
  const gaps = [], names = new Set();
  for (const { repo, root, e } of declarations()) {
    const id = `${repo}: ${e?.name || '(unnamed)'}`;
    if (typeof e?.name !== 'string' || !/^[a-z0-9-]+$/.test(e.name)) gaps.push(`${id} needs a lowercase name`);
    else if (names.has(e.name)) gaps.push(`${id} is declared twice`);
    else names.add(e.name);
    // A ph- glyph, or an SVG file in the program's repository, as a project's icon may be.
    const icon = typeof e?.icon === 'string' ? e.icon : '';
    if (!icon.startsWith('ph-') && !(icon.endsWith('.svg') && existsSync(path.join(root, icon)))) gaps.push(`${id} needs a ph- icon or an SVG file`);
    if (e?.status !== undefined && e.status !== 'proposed') gaps.push(`${id} has status ${e.status}; only "proposed" is a status`);
    const proposed = e?.status === 'proposed';
    if (typeof e?.path !== 'string' || !existsSync(path.join(root, e.path, proposed ? '' : 'README.md'))) gaps.push(`${id}'s ${proposed ? 'folder' : 'charter'} ${e?.path}${proposed ? '' : '/README.md'} is missing`);
  }
  assert.deepEqual(gaps, []);
});

test('every governed path exists, and no file answers to two programs', () => {
  // An entry ending in / governs everything under it, so two entries collide
  // when one equals the other or sits inside it.
  const gaps = [], seen = [];
  const inside = (a, b) => a === b || (b.endsWith('/') && a.startsWith(b));
  for (const { repo, root, e } of declarations()) {
    const governs = Array.isArray(e?.governs) ? e.governs : [];
    if (e?.status === 'proposed') { if (governs.length) gaps.push(`${repo}: ${e.name} is proposed and governs files`); continue; }
    if (!governs.length) gaps.push(`${repo}: ${e?.name} governs nothing`);
    for (const g of governs) {
      if (typeof g !== 'string' || !existsSync(path.join(root, g))) { gaps.push(`${repo}: ${e?.name} governs missing ${g}`); continue; }
      // The overlap check compares strings, so an entry must already be in
      // canonical form: no leading ./, directories ending in /.
      const canon = path.posix.normalize(g).replace(/^\.\//, '') + (statSync(path.join(root, g)).isDirectory() && !g.endsWith('/') ? '/' : '');
      if (canon !== g) gaps.push(`${repo}: ${e?.name} governs ${g}, which should be written ${canon}`);
      const clash = seen.find(s => s.repo === repo && (inside(g, s.g) || inside(s.g, g)));
      if (clash) gaps.push(`${repo}:${g} is governed by both ${clash.name} (${clash.g}) and ${e.name}`);
      seen.push({ repo, g, name: e.name });
    }
  }
  assert.deepEqual(gaps, []);
});

test('reviewers are listed agents, measures are paths or locators, views are app addresses', () => {
  const gaps = [];
  for (const { repo, root, e } of declarations()) {
    for (const r of e?.reviewers || []) if (!agents.has(r)) gaps.push(`${repo}: ${e.name} reviewer ${r} is not in docs/agents.csv`);
    for (const m of e?.measures || []) {
      const qualified = /^[\w.-]+\/[\w.-]+(@[\w./-]+)?:[^\s]+$/.test(m);
      if (!qualified && !existsSync(path.join(root, m))) gaps.push(`${repo}: ${e.name} measure ${m} is neither a locator nor a file`);
    }
    for (const v of e?.views || []) if (!/^\?view=[\w-]+/.test(v)) gaps.push(`${repo}: ${e.name} view ${v} is not an app address`);
  }
  assert.deepEqual(gaps, []);
});

// The Areas table's first column, as the Program view reads it (program.js,
// mdSectionTable): the rows of the first table under `## Areas`.
const charterAreas = md => {
  const lines = md.split('\n'), at = lines.findIndex(l => l.trim().toLowerCase() === '## areas');
  if (at < 0) return [];
  let i = at + 1;
  while (i < lines.length && !/^#{1,2}\s/.test(lines[i]) && !lines[i].trim().startsWith('|')) i++;
  const out = [];
  for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) out.push(lines[j].split('|')[1].trim());
  return out;
};
// The installed font's names, where it is installed; an icon class names
// one or draws nothing (python/blank-icons.py, which reads no JSON).
const FONT = path.join(repoRoot, 'node_modules', '@phosphor-icons', 'web', 'src', 'regular', 'style.css');
const glyphs = existsSync(FONT) ? new Set([...readFileSync(FONT, 'utf8').matchAll(/\.ph\.ph-([a-z0-9-]+):before/g)].map(m => 'ph-' + m[1])) : null;

test('every declared area names a charter row, an icon the font carries, and panels that read real columns', () => {
  const gaps = [], KINDS = ['measure', 'breakdown', 'gallery', 'groups', 'views'];
  for (const { repo, root, e } of declarations()) {
    if (!Array.isArray(e?.areas)) continue;
    const id = `${repo}: ${e.name}`, charter = path.join(root, e.path || '', 'README.md');
    const rows = existsSync(charter) ? charterAreas(readFileSync(charter, 'utf8')) : [];
    for (const a of e.areas) {
      if (!rows.includes(a?.name)) gaps.push(`${id} declares area ${a?.name}, which its charter's Areas table does not name`);
      const icons = [a?.icon, ...(a?.panels || []).flatMap(pn => Object.values(pn?.icons || {}))].filter(x => x !== undefined);
      for (const i of icons) if (typeof i !== 'string' || !i.startsWith('ph-') || (glyphs && !glyphs.has(i))) gaps.push(`${id}: ${a.name} names icon ${i}, which the font does not carry`);
      for (const pn of a?.panels || []) {
        if (!KINDS.includes(pn?.kind)) { gaps.push(`${id}: ${a.name} has a panel of kind ${pn?.kind}`); continue; }
        for (const v of pn.views || []) if (!/^\?view=[\w-]+/.test(v)) gaps.push(`${id}: ${a.name} view ${v} is not an app address`);
        for (const re of Object.values(pn.where || {})) { try { new RegExp(re); } catch { gaps.push(`${id}: ${a.name} where ${re} is not a pattern`); } }
        if (pn.kind === 'gallery' && pn.source) {
          if (!['research', 'repos'].includes(pn.source)) gaps.push(`${id}: ${a.name} gallery source ${pn.source} is not research or repos`);
          continue;
        }
        if (!['breakdown', 'gallery', 'groups'].includes(pn.kind)) continue;
        const file = path.join(root, pn.registry || '');
        if (!pn.registry || !/\.csv$/.test(pn.registry) || !existsSync(file)) { gaps.push(`${id}: ${a.name} reads ${pn.registry}, which is not a CSV on disk`); continue; }
        const rows = parseCsv(readFileSync(file, 'utf8')), head = new Set(Object.keys(rows[0] || {}));
        const fileCols = [...String(pn.file || '').matchAll(/\{([^{}]+)\}/g)].map(m => m[1]);
        const cols = [pn.by, pn.label, pn.icon, pn.glyph, pn.thumb, pn.href, pn.text, ...fileCols, ...Object.keys(pn.where || {})].filter(Boolean);
        if ((pn.kind === 'breakdown' || pn.kind === 'groups') && !pn.by) gaps.push(`${id}: ${a.name} ${pn.kind} names no column`);
        if ((pn.kind === 'gallery' || pn.kind === 'groups') && !pn.label) gaps.push(`${id}: ${a.name} ${pn.kind} names no label column`);
        const missing = cols.filter(c => !head.has(c));
        for (const c of missing) gaps.push(`${id}: ${a.name} reads column ${c}, which ${pn.registry} does not have`);
        if (pn.kind !== 'groups' || missing.length) continue;
        // The rows a groups panel draws, grouped as Programs.groups groups
        // them: by `by`, or its part before `split`, where `where` lets a row in.
        const where = Object.entries(pn.where || {}).map(([k, re]) => { try { return [k, new RegExp(re)]; } catch { return [k, /(?!)/]; } });
        const kept = rows.filter(r => where.every(([k, re]) => re.test(String(r[k] ?? ''))));
        const keyOf = r => { const k = String(r[pn.by] ?? '').trim(); return pn.split && k.includes(pn.split) ? k.slice(0, k.indexOf(pn.split)) : k; };
        const drawn = Array.isArray(pn.only) && pn.only.length ? pn.only : [...new Set(kept.map(keyOf))];
        for (const g of drawn) if (!pn.icons?.[g]) gaps.push(`${id}: ${a.name} draws group ${g || '(empty)'} of ${pn.registry} with no icon`);
        if (pn.file) for (const r of kept.filter(r => drawn.includes(keyOf(r)))) {
          const f = pn.file.replace(/\{([^{}]+)\}/g, (_, c) => String(r[c] ?? '').trim());
          if (!existsSync(path.join(root, f))) gaps.push(`${id}: ${a.name} opens ${f} for a row of ${pn.registry}, which is not on disk`);
        }
      }
    }
  }
  assert.deepEqual(gaps, []);
});

function outsideFences(md) {
  const out = [];
  let fenced = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^```/.test(line.trim())) { fenced = !fenced; continue; }
    if (!fenced) out.push(line);
  }
  return out.join('\n');
}

function relativeLinks(md) {
  const targets = [];
  for (const m of outsideFences(md).matchAll(/\]\(([^)\s]+)\)/g)) {
    const raw = m[1].split('#')[0];
    if (!raw || /^(?:https?:|mailto:)/.test(raw)) continue;
    targets.push(raw);
  }
  return targets;
}

test('each manager.md aligns with its charter Processes table, and relative links in charters and manager briefs resolve', () => {
  const gaps = [];
  for (const { repo, root, e } of declarations()) {
    if (e?.status === 'proposed' || typeof e?.path !== 'string') continue;
    const dir = path.join(root, e.path);
    const charterPath = path.join(dir, 'README.md');
    if (!existsSync(charterPath)) continue;
    const charter = readFileSync(charterPath, 'utf8');
    for (const rel of relativeLinks(charter)) {
      if (!existsSync(path.resolve(dir, rel))) gaps.push(`${repo}:${e.path}/README.md links missing ${rel}`);
    }
    const managerPath = path.join(dir, 'manager.md');
    if (!existsSync(managerPath)) continue;
    const manager = readFileSync(managerPath, 'utf8');
    for (const rel of relativeLinks(manager)) {
      if (!existsSync(path.resolve(dir, rel))) gaps.push(`${repo}:${e.path}/manager.md links missing ${rel}`);
    }
    const procSection = outsideFences(charter).match(/^## Processes\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
    if (!procSection) {
      gaps.push(`${repo}:${e.path}/README.md has manager.md without a ## Processes section`);
      continue;
    }
    if (!procSection[1].includes('(manager.md)')) {
      gaps.push(`${repo}:${e.path}/README.md ## Processes does not link manager.md`);
    }
    const rows = [...procSection[1].matchAll(/^\| ([^|\n]+?) \|/gm)]
      .map(m => m[1].trim())
      .filter(cell => cell !== 'Process' && !/^-+$/.test(cell));
    const headings = [...outsideFences(manager).matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
    if (JSON.stringify(rows) !== JSON.stringify(headings)) {
      gaps.push(`${repo}:${e.path} Processes rows ${JSON.stringify(rows)} != manager.md headings ${JSON.stringify(headings)}`);
    }
  }
  assert.deepEqual(gaps, []);
});
