#!/usr/bin/env node
// The UI patterns units declare in their markup, checked. One row per unit
// loaded: the pattern its markup declares, the body a reader coded, the parts
// found, and whether the pattern's promise holds when the page is driven.
//
//   node tools/build/ui-instances.mjs [--only <text>] [--jobs N]
//
// A body code is treated as an interface (data/ui-units/codebook.md, "Declaring
// a pattern in markup"): data-pattern on the element holding the arrangement,
// data-part on its elements, the parts a code allows in codes.csv's parts
// column. Three sources can say a unit is an instance of a code, and this file
// reports where they agree:
//
//   declared   the markup's data-pattern, read headless
//   coded      the reader's body code in coded.csv
//   kit        a kit in the code's kits cell, among the unit's built_on
//
// and checks the declaration against the code's behavior:
//
//   list         at least one item is shown
//   list-detail  picking an item that is not selected changes (or first shows)
//                the detail, and the selection (aria-selected or aria-current)
//                moves to it
//
// A result reads `holds`, `fails`, or `unchecked`: a declaration hidden at the
// unit's address, or a list with nothing in it there, keeps or breaks no
// promise until a fixture gives it something to show.
//
// Which units are loaded: every coded unit whose code has parts (a reader may
// have coded what the markup never declared), and every unit whose files carry
// data-pattern. The rest are not instances of a declarable code and are not
// listed. Rows go to instances.csv beside each store's coded.csv, public units
// here and home's in home, split by visibility like the other tables.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { writeCsv } from './registries-load.mjs';
import { HUB, HOME, ESTATE, STORES, rowsOf, slug, codedUnits, evalFrom, shoot, head, needHomeModules } from './ui-recipes.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = opt('--only', '');
const JOBS = Math.max(1, +opt('--jobs', 3));
const DESK = { width: 1280, height: 900 };
const COLS = ['unit', 'coded', 'declared', 'kit', 'parts', 'missing', 'stray', 'contract', 'read_at'];
const TMP = path.join(HUB, 'tools/.preview/ui-instances');
// The commit each store's pages were read at: web-tools' app is served at HEAD,
// and home's tool reads its checkout, which is HEAD once the markup is committed.
const READ_AT = { 'web-tools': head, home: execFileSync('git', ['-C', HOME, 'rev-parse', 'HEAD']).toString().trim() };
mkdirSync(TMP, { recursive: true });

// code -> { required: [...], optional: [...], kits: [...] }, for the codes that have parts.
const CODES = Object.fromEntries(rowsOf(path.join(HUB, 'data/ui-units/codes.csv'))
  .filter(c => c.axis === 'body' && c.parts)
  .map(c => {
    const parts = c.parts.split(';').filter(Boolean);
    return [c.code, { required: parts.filter(p => !p.endsWith('?')),
                      optional: parts.filter(p => p.endsWith('?')).map(p => p.slice(0, -1)),
                      kits: (c.kits || '').split(';').filter(Boolean) }];
  }));

// Run in the page: every shown declared pattern, its parts counted, and its
// code's promise tried. Answers a JSON string, like the focus eval.
const checkJs = (coded) => `(async () => {
  const shown = (e) => e.getClientRects().length > 0;
  const settle = () => new Promise((ok) => setTimeout(ok, 800));
  const marked = (e) => e.getAttribute('aria-selected') === 'true'
    || ['true', 'page', 'step', 'location'].includes(e.getAttribute('aria-current'));
  const out = [];
  // A unit's rows can arrive after the render tool's own wait, slower still
  // when the live API is rate-limited, so give a declared pattern up to
  // fifteen seconds to show an item before reading the page.
  const ready = () => [...document.querySelectorAll('[data-pattern]')].some((r) => shown(r) && [...r.querySelectorAll('[data-part="item"]')].some(shown));
  for (let t = 0; t < 30 && !ready(); t++) await new Promise((ok) => setTimeout(ok, 500));
  // A pattern inside another belongs to an item of the outer one (Sessions'
  // branch tiles), so only the outermost roots are the unit's own.
  const tops = [...document.querySelectorAll('[data-pattern]')].filter((r) => !r.parentElement?.closest('[data-pattern]'));
  // The unit's own pattern is the one matching the reader's code where one
  // does; any other shown pattern is one the unit contains (Stage, coded a
  // tool, shows the errands list). Only the first is driven, so a pick in one
  // pattern cannot disturb the reading of another.
  const showing = tops.filter(shown);
  const first = showing.find((r) => r.dataset.pattern === ${JSON.stringify(coded)}) || showing[0];
  for (const root of first ? [first] : []) {
    const own = (sel) => [...root.querySelectorAll(sel)].filter((e) => shown(e) && e.closest('[data-pattern]') === root);
    const counts = {};
    for (const e of [root, ...own('[data-part]')]) if (e.dataset.part) counts[e.dataset.part] = (counts[e.dataset.part] || 0) + 1;
    const pattern = root.dataset.pattern;
    const items = () => own('[data-part="item"]');
    let contract = 'no promise checked for this code';
    // An empty list keeps or breaks no promise: at this address there is
    // nothing to check, which a fixture would change.
    if (pattern === 'list') contract = items().length ? 'holds: ' + items().length + ' items shown' : 'unchecked: no item shown at this address';
    if (pattern === 'list-detail') {
      const detail = () => own('[data-part="detail"]')[0];
      // The pick goes where a person would click: the item when it is itself a
      // control, else its title, else the first control inside it that is not
      // one of its actions. A pick handler on a button inside a row div never
      // hears a click dispatched on the div.
      const control = (e) => e.matches('button, a[href], [role="option"], [tabindex], [onclick]')
        || e.hasAttribute('@click') || e.hasAttribute('x-on:click');
      const target = (it) => control(it) ? it
        : [it.querySelector('[data-part="title"]'), ...it.querySelectorAll('button, a[href], [role="option"], [tabindex]')]
            .find((e) => e && !e.closest('[data-part="actions"]') && (control(e) || e.querySelector('button, a[href]'))) || it;
      const its = items();
      const i = its.findLastIndex((e) => !marked(e));
      if (its.length < 2) contract = 'unchecked: fewer than two items shown at this address';
      else if (i < 0) contract = 'fails: every item is marked selected';
      else {
        // A detail may be hidden until the first pick (Search's reader), so
        // its absence before the pick is not yet a failure.
        const before = detail() ? detail().textContent : null;
        target(its[i]).click();
        await settle();
        const after = items(), picked = after[i], now = after.filter(marked);
        const changed = !!detail() && detail().textContent !== before;
        const moved = !!picked && marked(picked) && now.length === 1;
        contract = (changed && moved ? 'holds' : 'fails') + ': the pick ' + (changed ? (before === null ? 'showed' : 'changed') : 'did not change')
          + ' the detail; the selection ' + (moved ? 'moved to it' : now.length ? 'did not move to it' : 'is not marked');
      }
    }
    const also = showing.filter((r) => r !== root).map((r) => r.dataset.pattern);
    out.push({ pattern, counts, contract, also });
  }
  // Declared but hidden here, where the declared element itself is what is
  // hidden (a board no project declares, a list waiting on a token). A pattern
  // whose parent is hidden too sits in another tab of the same page, which is
  // that tab's declaration, not this unit's.
  const own = tops.find((r) => !shown(r) && r.parentElement && shown(r.parentElement));
  if (!out.length && own) out.push({ pattern: own.dataset.pattern, counts: {}, contract: 'unchecked: declared, but not shown at this address', also: [] });
  // The app's live GitHub reads are unauthenticated here, and past the hourly
  // limit the app swaps the unit for a token prompt: nothing was read, which
  // is not the same as nothing declared.
  if (!out.length && /API rate limit exceeded/.test(document.body.innerText)) out.push({ pattern: '', counts: {}, contract: "not read: GitHub's rate limit replaced the unit with a token prompt", also: [] });
  return JSON.stringify(out);
})()`;

const listParts = (counts) => Object.entries(counts).map(([p, n]) => `${p} ${n}`).join('; ');

needHomeModules();
const declaring = new Map();   // repo:file -> carries data-pattern
const carries = (repo, file) => {
  const k = repo + ':' + file;
  if (!declaring.has(k)) {
    const root = repo === 'web-tools' ? HUB : path.join(ESTATE, repo);
    const p = path.join(root, file);
    declaring.set(k, existsSync(p) && readFileSync(p, 'utf8').includes('data-pattern="'));
  }
  return declaring.get(k);
};
const work = codedUnits(ONLY).filter(w => CODES[w.c.body] || (w.u.files || '').split(';').some(f => f && carries(w.u.repo, f)));
console.log(`${work.length} units to load, ${JOBS} at a time`);

const done = new Map(STORES.map(s => [s.name, []]));
let n = 0;
const worker = async () => {
  for (let w = work.shift(); w; w = work.shift()) {
    // One retry for a page that did not answer: three headless browsers at
    // once, against a rate-limited API, now and then lose one.
    // Also once more when the unit's own files carry a declaration and the
    // page showed none: its rows were late, not absent.
    const declares = (w.u.files || '').split(';').some(f => f && carries(w.u.repo, f));
    let res = await shoot(w.r, DESK, false, path.join(TMP, slug(w.unit) + '.png'), checkJs(w.c.body || ''));
    const blank = (r) => { const f = evalFrom(r.out); return !f || (declares && !f.length); };
    if (blank(res)) res = await shoot(w.r, DESK, false, path.join(TMP, slug(w.unit) + '.png'), checkJs(w.c.body || ''));
    const found = evalFrom(res.out);
    const coded = w.c.body || '';
    const builtOn = (w.c.built_on || '').split(';');
    const row = { unit: w.unit, coded, declared: '', kit: '', parts: '', missing: '', stray: '', contract: '',
                  read_at: (READ_AT[w.u.repo] || '').slice(0, 12) };
    if (!found) row.contract = `not read: the page did not answer (${res.code})`;
    const inst = (found || [])[0];
    if (found && found.length > 1) row.contract = `${found.length} declared patterns shown; the first is reported`;
    if (inst && !inst.pattern) row.contract = inst.contract;
    else if (inst) {
      const spec = CODES[inst.pattern];
      row.declared = inst.pattern;
      row.parts = listParts(inst.counts);
      // A declaration unchecked here showed no parts, so none can be missing.
      if (!spec) row.stray = `${inst.pattern} is not a code with parts`;
      else if (!/^unchecked/.test(inst.contract)) {
        row.missing = spec.required.filter(p => !inst.counts[p]).join(';');
        row.stray = Object.keys(inst.counts).filter(p => !spec.required.includes(p) && !spec.optional.includes(p)).join(';');
      }
      row.contract = [row.contract, inst.contract,
        inst.also?.length ? 'the unit also shows a declared ' + inst.also.join(', a declared ') : ''].filter(Boolean).join('; ');
    }
    const spec = CODES[row.declared || coded];
    row.kit = spec ? (spec.kits.find(k => builtOn.includes(k)) || (spec.kits.length ? 'none of ' + spec.kits.join(', ') : 'no kit draws this code')) : '';
    done.get(w.store.name).push(row);
    console.log(`[${++n}] ${w.unit}: coded ${coded || '-'}, declared ${row.declared || '-'}${row.contract ? ', ' + row.contract : ''}`);
  }
};
await Promise.all(Array.from({ length: JOBS }, worker));

for (const store of STORES) {
  const fresh = done.get(store.name);
  if (!fresh.length) continue;
  const file = path.join(store.tables, 'instances.csv');
  const keep = ONLY ? rowsOf(file).filter(r => !fresh.some(f => f.unit === r.unit)) : [];
  const rows = [...keep, ...fresh].sort((a, b) => a.unit.localeCompare(b.unit));
  writeFileSync(file, writeCsv(rows, COLS));
  console.log(`${store.name}: ${rows.length} rows in ${path.relative(ESTATE, file)}`);
}
