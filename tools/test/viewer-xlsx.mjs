#!/usr/bin/env node
// The viewer's workbook module, the second one that fetches or decodes its own
// bytes.
//
//   node tools/test/viewer-xlsx.mjs
//
// An .xlsx is a ZIP, so it shares the image module's problem and then adds one:
// the bytes have to survive the trip AND the thing inside them is a small
// filesystem that has to be walked before anything can be shown. Four claims,
// and the last two are the ones that would rot silently:
//
//   1. a workbook renders as a table rather than as replacement characters
//   2. it OPENS in the sheets mode over the host's blanket defaultMode, which
//      is what `exclusive` buys
//   3. the sheet tabs carry the workbook's DISPLAY names, in WORKBOOK order,
//      neither of which is the part-file order the ZIP is stored in
//   4. a date cell reads as a date, not as a five-digit serial
//
// And four more for the structure mode beside it, which draws what the file is
// MADE OF rather than what it says:
//
//   5. it is in the strip beside the grid, and opening it draws its own tabs
//   6. an empty tab stays in the strip, disabled, showing a zero, because a
//      tab that hides itself cannot answer "are there queries here"
//   7. a hidden sheet reports its visibility, which no value grid can show
//   8. the columns tab profiles the sheet the picker names
//   9. a pivot names the range its cache was built from, and the records tab
//      draws the rows behind it with their shared-item indices resolved
//
// And four for the Extract tab, which selects the readings to share:
//
//  10. a sheet selects its available readings, and each can be unticked
//  11. related pivots and caches are independent choices, not side effects
//  12. the figure line stays compact and the actions reflect a usable export
//  13. the preview, saved file, and link carry the same v2 envelope
//
// The fixture is built here with jszip rather than committed, so no binary
// enters the tree and the workbook's internals are exactly what the assertions
// talk about. It is delivered as a data: URI inside a data-view envelope, which
// exercises the same `carried` branch a dropped or pasted file takes; the
// repo-fetch branch is the identical shape already covered by viewer-image.mjs.
//
// Exits nonzero on any failure. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import JSZip from 'jszip';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// JSZip is seeded as a global rather than imported. The kit checks for a global
// before it fetches, exactly so a page that already has JSZip does not pull a
// second copy, so this is a real code path and not only a convenience here.
//
// It used to be the only path: jsDelivr SYNTHESIZES an ESM wrapper for a CJS
// package at `/+esm` and the shim could not, so resolveCdn served an empty
// module and the kit's `await import()` landed on undefined. Since 2026-09-13
// the shim serves jszip's published UMD with the global re-exported (cdn.mjs,
// UMD_ESM), which is what let the demo page's drop path be shot headlessly.
// What still goes untested here is jsDelivr's own bundling, which is its
// behaviour rather than one of ours.
const JSZIP_UMD = await readFile(path.join(root, 'node_modules/jszip/dist/jszip.min.js'), 'utf8');

// Where the two Extract shots land: tools/.preview/, which is the repo's one
// screenshot scratch (gitignored, and where `npm run shot` writes), so a
// scenario run leaves no untracked PNG behind.
const shotPath = (name) => path.join(root, 'tools', '.preview', `viewer-xlsx-${name}.png`);

// The separator every figure line is joined with. A NO-BREAK SPACE before the
// middle dot keeps the dot with the word on its left, so a line that wraps
// never starts with one.
const SEP = '\u00a0\u00b7 ';

const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
};

// --- the fixture ----------------------------------------------------------
//
// Budget is the FIRST sheet in the workbook and lives in sheet2.xml; Notes is
// second and lives in sheet1.xml. That inversion is the whole point of claim 3:
// if the module read part order, or read the number out of the filename, it
// would put these in the wrong order under the wrong names and every other
// assertion here would still pass.
const WORKBOOK = `<?xml version="1.0"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Budget" sheetId="4" r:id="rId1"/>
    <sheet name="Notes" sheetId="9" r:id="rId2" state="hidden"/>
  </sheets>
  <pivotCaches><pivotCache cacheId="7" r:id="rId3"/></pivotCaches>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId2" Type=".../worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId3" Type=".../pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/>
</Relationships>`;

// A pivot drawn on Budget over a cache built from Notes, so neither join can
// be made by guessing that a pivot sits on the sheet its data came from.
const PIVOT_TABLE = `<?xml version="1.0"?>
<pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                      name="ByFund" cacheId="7">
  <location ref="D1:E4"/>
  <rowFields count="1"><field x="0"/></rowFields>
  <dataFields count="1"><dataField name="Sum of Spend" fld="1"/></dataFields>
</pivotTableDefinition>`;

const PIVOT_CACHE = `<?xml version="1.0"?>
<pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                      recordCount="2">
  <cacheSource type="worksheet"><worksheetSource ref="A1:B3" sheet="Notes"/></cacheSource>
  <cacheFields count="2">
    <cacheField name="Fund"><sharedItems count="2"><s v="600"/><s v="722"/></sharedItems></cacheField>
    <cacheField name="Spend"/>
  </cacheFields>
</pivotCacheDefinition>`;

const PIVOT_CACHE_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type=".../pivotCacheRecords" Target="pivotCacheRecords1.xml"/>
</Relationships>`;

const PIVOT_RECORDS = `<?xml version="1.0"?>
<pivotCacheRecords xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2">
  <r><x v="1"/><n v="41"/></r>
  <r><x v="0"/><n v="17"/></r>
</pivotCacheRecords>`;

const SHEET2_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type=".../pivotTable" Target="../pivotTables/pivotTable1.xml"/>
  <Relationship Id="rId2" Type=".../comments" Target="../comments1.xml"/>
</Relationships>`;

// cellXfs index 1 is numFmtId 164, the custom yyyy-mm-dd.
const STYLES = `<?xml version="1.0"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>
  <cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs>
</styleSheet>`;

const SHARED = `<?xml version="1.0"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>Fund</t></si><si><t>Opened</t></si><si><t>600</t></si>
</sst>`;

// Budget: a header row of shared strings, then a row whose B cell is serial
// 45000 under the date format. 45000 is 2023-03-15.
const SHEET2 = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>
<sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
  <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>45000</v></c></row>
</sheetData></worksheet>`;

// A comment on Budget, so the Extract matrix has a second lit kind beside
// Values and the screenshot shows a real pick rather than one cell.
const COMMENTS = `<?xml version="1.0"?>
<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <authors><author>Marcus</author></authors>
  <commentList><comment ref="B2" authorId="0"><text><t>opened on the allotment date</t></text></comment></commentList>
</comments>`;

// One external source, so the structure mode has a Sources tab with something
// in it and a Pivots tab with nothing, which are the two cases claim 6 is about.
const CONNECTIONS = `<?xml version="1.0"?>
<connections xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <connection id="1" name="OFM page" type="4"><webPr url="https://ofm.wa.gov/budget"/></connection>
</connections>`;

// Notes: one inline string, the cell kind the kit used to drop entirely.
const SHEET1 = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
  <row r="1"><c r="A1" t="inlineStr"><is><t>carried inline</t></is></c></row>
</sheetData></worksheet>`;

async function buildWorkbook() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="ct"/>');
  zip.file('xl/workbook.xml', WORKBOOK);
  zip.file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS);
  zip.file('xl/styles.xml', STYLES);
  zip.file('xl/sharedStrings.xml', SHARED);
  zip.file('xl/connections.xml', CONNECTIONS);
  zip.file('xl/comments1.xml', COMMENTS);
  zip.file('xl/worksheets/_rels/sheet2.xml.rels', SHEET2_RELS);
  zip.file('xl/pivotTables/pivotTable1.xml', PIVOT_TABLE);
  zip.file('xl/pivotCache/pivotCacheDefinition1.xml', PIVOT_CACHE);
  zip.file('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels', PIVOT_CACHE_RELS);
  zip.file('xl/pivotCache/pivotCacheRecords1.xml', PIVOT_RECORDS);
  zip.file('xl/worksheets/sheet1.xml', SHEET1);
  zip.file('xl/worksheets/sheet2.xml', SHEET2);
  return zip.generateAsync({ type: 'base64' });
}

// --- harness --------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try {
    const body = await readFile(path.join(root, rel));
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

await mkdir(path.join(root, 'tools', '.preview'), { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
// The Extract tab hands its payload over as a link on the clipboard, and
// reading it back is how the last claim below checks what actually leaves.
// Without the grant the read throws and that claim degrades to a skip, which
// is the quiet kind of coverage gap this file exists to avoid.
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
await page.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  const r = resolveCdn(url, root, null);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
});
await page.addInitScript({ content: JSZIP_UMD });
page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));

const state = () => page.evaluate(() => {
  const host = document.getElementById('dv-viewer');
  const v = host && Alpine.$data(host);
  const root = document.querySelector('[data-xlsx="root"]');
  const tabs = root?.querySelector('[data-xlsx="tabs"]');
  const msg = root?.querySelector('[data-xlsx="msg"]');
  // Read the drawn grid rather than the data behind it: Tabulator having the
  // rows and Tabulator having painted them are different claims.
  const cells = [...(root?.querySelectorAll('.tabulator-cell') || [])].map(c => c.textContent.trim());
  return {
    mode: v?.mode || null,
    modes: (v?.availableModes || []).map(m => m.id),
    stats: v?.stats || '',
    tabs: [...(tabs?.children || [])].map(b => b.textContent.trim()),
    active: [...(tabs?.children || [])].findIndex(b => b.classList.contains('btn-active')),
    msg: msg ? msg.textContent.trim() : '(gone)',
    cells,
  };
});

// The structure pane, read the same way: what is drawn, not what is behind it.
const structure = () => page.evaluate(() => {
  const root = document.querySelector('[data-xs="root"]');
  const tabs = root?.querySelector('[data-xs="tabs"]');
  const buttons = [...(tabs?.querySelectorAll('button') || [])];
  const table = root?.querySelector('table');
  const head = [...(table?.querySelectorAll('thead th') || [])].map(th => th.textContent.trim());
  const rows = [...(table?.querySelectorAll('tbody tr') || [])]
    .map(tr => [...tr.children].map(td => td.textContent.trim()));
  return {
    tabs: buttons.map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    disabled: buttons.filter(b => b.disabled).map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    active: buttons.findIndex(b => b.classList.contains('btn-active')),
    picker: [...(root?.querySelectorAll('[data-xs="pick"] option') || [])].map(o => o.textContent.trim()),
    head, rows,
  };
});

// The Extract tab, read the same way: what is drawn, not what is behind it.
const extract = () => page.evaluate(() => {
  const box = document.querySelector('[data-xs="ex"]');
  const on = (el) => el.classList.contains('text-primary');
  const cells = [...(box?.querySelectorAll('[data-ex-cell]') || [])].map(b => ({
    kind: b.dataset.exCell,
    sheet: b.dataset.exSheet || null,
    label: b.textContent.replace(/\s+/g, ' ').trim(),
    lit: on(b),
    disabled: b.disabled,
  }));
  return {
    figure: box?.querySelector('[data-xs="ex-fig"]')?.textContent.trim() || '',
    sheets: [...(box?.querySelectorAll('[data-ex-sheetrow]') || [])]
      .map(b => ({ name: b.dataset.exSheetrow, lit: on(b) })),
    objects: [...(box?.querySelectorAll('[data-ex-object]') || [])]
      .map(b => ({ id: b.dataset.exObject, label: b.textContent.replace(/\s+/g, ' ').trim(), lit: on(b) })),
    cells,
    preview: box?.querySelector('[data-xs="ex-preview-json"]')?.textContent || '',
    previewOptions: [...(box?.querySelectorAll('[data-xs="ex-preview-pick"] option') || [])]
      .map(o => ({ value: o.value, text: o.textContent })),
    actions: ['ex-save', 'ex-copy', 'ex-open']
      .map(k => ({ k, disabled: !!box?.querySelector(`[data-xs="${k}"]`)?.disabled })),
    // Any cell whose kind name does not fit its cell. A clipped label is what
    // the real sample workbook exposed and the toy fixture could not: the
    // counts here are one digit, so a one-line cell looked right at every
    // width while "2000 of 2409" clipped `Styles` to `Sty…` on a real file.
    clipped: [...(box?.querySelectorAll('[data-ex-cell] span:first-child') || [])]
      .filter(el => el.scrollWidth > el.clientWidth + 1)
      .map(el => el.textContent.trim()),
  };
});

const tapSheet = async (name) => {
  await page.evaluate((n) => [...document.querySelectorAll('[data-ex-sheetrow]')]
    .find(b => b.dataset.exSheetrow === n)?.click(), name);
  await page.waitForTimeout(600);
};

const openTab = async (label) => {
  await page.evaluate((want) => {
    const b = [...document.querySelectorAll('[data-xs="tabs"] button')]
      .find(x => x.textContent.trim().startsWith(want));
    b?.click();
  }, label);
  await page.waitForTimeout(400);
};

try {
  const b64 = await buildWorkbook();
  const env = {
    kind: 'data-view/1',
    items: [{ name: 'ledger.xlsx', content: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64 }],
  };

  console.log('a workbook carried as a data URI:');
  await page.goto(`${origin}/pages/data-view.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(async (payload) => {
    const bytes = new TextEncoder().encode(payload);
    const gz = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(gz).arrayBuffer());
    let str = ''; for (const b of buf) str += String.fromCharCode(b);
    location.hash = 'gz=' + btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    location.reload();
  }, JSON.stringify(env));
  await page.waitForTimeout(4500);

  const opened = await state();
  ok('the grid is available', (opened.modes || []).includes('xlsx'), JSON.stringify(opened.modes));
  // WHICH exclusive mode wins moved and this check did not follow, because it
  // needs a browser and so is not in `npm test`. The claim was that the grid
  // opens over the host's blanket defaultMode; since the sheet RENDER shipped,
  // also exclusive and earlier in the strip, that one opens and the grid is a
  // tap away. The claim underneath is unchanged and is the one that matters:
  // raw for a ZIP never wins.
  ok('an exclusive workbook mode opened over the host\'s blanket defaultMode',
     opened.mode === 'sheet', JSON.stringify({ mode: opened.mode, modes: opened.modes }));

  console.log('the grid beside it:');
  await page.evaluate(() => Alpine.$data(document.getElementById('dv-viewer')).switchMode('xlsx'));
  await page.waitForTimeout(2500);
  const s = await state();
  ok('the loading line got out of the way', s.msg === '(gone)', s.msg);

  // Claim 3, both halves at once.
  ok('the tabs carry display names, in workbook order',
     JSON.stringify(s.tabs) === JSON.stringify(['Budget', 'Notes']), JSON.stringify(s.tabs));
  ok('the first sheet is the one selected', s.active === 0, String(s.active));

  // Claim 1 and claim 4.
  ok('shared strings resolved into the grid', s.cells.includes('Fund') && s.cells.includes('600'),
     JSON.stringify(s.cells));
  ok('the date cell reads as a date, not a serial',
     s.cells.includes('2023-03-15') && !s.cells.includes('45000'), JSON.stringify(s.cells));
  ok('nothing rendered as replacement characters', !s.cells.some(c => c.includes('�')),
     JSON.stringify(s.cells.filter(c => c.includes('�'))));
  // SEP is the separator these figure lines are joined with: a no-break space
  // then a middle dot then a space, so a wrapped line never opens with a bare
  // dot. Written once here rather than pasted into each regex, because the two
  // that did paste it both broke silently when the space became no-break.
  ok('the header states sheets and bytes', new RegExp(`^2 sheets${SEP}\\d+\\.\\d KB$`).test(s.stats), s.stats);

  console.log('switching to the second sheet:');
  await page.evaluate(() => document.querySelectorAll('[data-xlsx="tabs"] button')[1]?.click());
  await page.waitForTimeout(900);
  const t = await state();
  ok('the inline string survived', t.cells.includes('carried inline'), JSON.stringify(t.cells));
  ok('and the tab strip followed', t.active === 1, String(t.active));

  console.log('the structure mode beside it:');
  ok('it is in the strip', (t.modes || []).includes('xlsx-structure'), JSON.stringify(t.modes));
  await page.evaluate(() => Alpine.$data(document.getElementById('dv-viewer')).switchMode('xlsx-structure'));
  await page.waitForTimeout(2500);

  const x = await structure();
  ok('opening it draws its own tabs',
     x.tabs.some(l => l.startsWith('Sheets')) && x.tabs.some(l => l.startsWith('Parts')),
     JSON.stringify(x.tabs));
  // Claim 6, both halves: the empty one is present AND it is disabled.
  ok('a tab with nothing in it still says so', x.tabs.some(l => l === 'Queries 0'), JSON.stringify(x.tabs));
  ok('and it cannot be opened', x.disabled.includes('Queries 0'), JSON.stringify(x.disabled));
  ok('a tab with something in it carries the count', x.tabs.includes('Sources 1'), JSON.stringify(x.tabs));

  // Claim 7. The grid drew Notes like any other sheet; only this says it is hidden.
  const vis = x.head.indexOf('Visibility');
  ok('the sheets table reports visibility', vis > -1, JSON.stringify(x.head));
  ok('and the hidden sheet is the one marked',
     x.rows.some(r => r[x.head.indexOf('Name')] === 'Notes' && r[vis] === 'hidden')
     && x.rows.some(r => r[x.head.indexOf('Name')] === 'Budget' && r[vis] === 'visible'),
     JSON.stringify(x.rows));
  ok('the shared-string id list is not one of the columns', !x.head.includes('String Ids'),
     JSON.stringify(x.head));

  await openTab('Sources');
  const src = await structure();
  ok('the connection reads as a web query with its url',
     src.rows.some(r => r.includes('Web') && r.some(c => c.includes('ofm.wa.gov'))),
     JSON.stringify(src.rows));

  // Claim 8. The picker names sheets as a reader would, and Budget is first.
  await openTab('Columns');
  const cols = await structure();
  ok('the columns tab offers the workbook\'s sheets by name',
     JSON.stringify(cols.picker) === JSON.stringify(['Budget', 'Notes']), JSON.stringify(cols.picker));
  ok('and profiles the one it names',
     cols.head.includes('Role') && cols.rows.some(r => r.includes('Fund')),
     JSON.stringify({ head: cols.head, rows: cols.rows }));

  // Claim 9. The pivot is on Budget, its cache was built from Notes, and the
  // records resolve their <x> indices against that cache's shared items.
  await openTab('Pivots');
  const piv = await structure();
  ok('the pivot names its sheet and the range its cache came from',
     piv.rows.some(r => r.includes('ByFund') && r.includes('Budget') && r.includes('Notes!A1:B3')),
     JSON.stringify(piv.rows));

  await openTab('Records');
  const rec = await structure();
  ok('the records tab is keyed by the cache\'s field names',
     JSON.stringify(rec.head) === JSON.stringify(['Fund', 'Spend']), JSON.stringify(rec.head));
  ok('and the shared-item indices came back as values, in record order',
     JSON.stringify(rec.rows) === JSON.stringify([['722', '41'], ['600', '17']]),
     JSON.stringify(rec.rows));

  console.log('the sheet-centered Extract tab:');
  await openTab('Extract');
  const e0 = await extract();
  // Claim 10, first half: nothing is picked, so nothing is lit and no figure
  // claims otherwise.
  ok('it opens with nothing picked', !e0.cells.some(c => c.lit) && !e0.objects.some(o => o.lit),
     JSON.stringify({ cells: e0.cells.filter(c => c.lit), objects: e0.objects.filter(o => o.lit) }));
  ok('the figure line is empty until there is something to figure', e0.figure === '', e0.figure);
  // Claim 12, second half: the two link actions and the save are dark.
  ok('every action is dark until there is something to hand over',
     e0.actions.every(a => a.disabled), JSON.stringify(e0.actions));
  ok('a kind this workbook has none of is present and disabled',
     e0.cells.find(c => c.sheet === 'Budget' && c.kind === 'validations')?.disabled === true,
     JSON.stringify(e0.cells.filter(c => c.disabled)));
  ok('the checklist draws every sheet with its own nine readings',
     e0.cells.filter(c => c.sheet === 'Budget').length === 9 &&
     e0.cells.filter(c => c.sheet === 'Notes').length === 9,
     JSON.stringify(e0.cells.map(c => [c.sheet, c.kind])));
  ok('the three modeled objects are individual choices',
     e0.objects.length === 3 &&
     e0.objects.some(o => o.id.startsWith('pivot:')) &&
     e0.objects.some(o => o.id.startsWith('records:')) &&
     e0.objects.some(o => o.id.startsWith('source:')),
     JSON.stringify(e0.objects));

  await tapSheet('Budget');
  const e1 = await extract();
  ok('choosing Budget selects its available readings, not Notes',
     e1.cells.filter(c => c.lit).length === e0.cells.filter(c => c.sheet === 'Budget' && !c.disabled).length &&
     e1.cells.filter(c => c.lit).every(c => c.sheet === 'Budget'),
     JSON.stringify(e1.cells.filter(c => c.lit).map(c => [c.sheet, c.kind])));
  ok('and the readings carry their counts',
     e1.cells.find(c => c.sheet === 'Budget' && c.kind === 'values')?.label === 'Values 2',
     JSON.stringify(e1.cells.filter(c => c.lit).map(c => c.label)));
  ok('the figures are one compact line',
     new RegExp(`^\\d+ items${SEP}\\d+ rows${SEP}[\\d.]+ (B|KB)(${SEP}link [\\d.]+ (B|KB))?$`).test(e1.figure),
     e1.figure);
  ok('and the actions come alive with it', e1.actions.every(a => !a.disabled), JSON.stringify(e1.actions));
  ok('related pivot and cached rows stay off', !e1.objects.some(o => o.lit),
     JSON.stringify(e1.objects));

  await page.evaluate(() => document.querySelector('[data-ex-sheet="Budget"][data-ex-cell="comments"]')?.click());
  await page.waitForTimeout(600);
  const e2 = await extract();
  ok('unticking Budget comments leaves the other Budget readings on',
     !e2.cells.find(c => c.sheet === 'Budget' && c.kind === 'comments')?.lit &&
     e2.cells.find(c => c.sheet === 'Budget' && c.kind === 'values')?.lit,
     JSON.stringify(e2.cells.filter(c => c.lit).map(c => [c.sheet, c.kind])));
  ok('no kind name is clipped at pane width', !e2.clipped.length, JSON.stringify(e2.clipped));

  await page.evaluate(() => document.querySelector('[data-ex-sheet="Notes"][data-ex-cell="values"]')?.click());
  await page.waitForTimeout(600);
  const e3 = await extract();
  ok('Notes values can be included without its other readings',
     e3.cells.filter(c => c.sheet === 'Notes' && c.lit).map(c => c.kind).join() === 'values',
     JSON.stringify(e3.cells.filter(c => c.sheet === 'Notes' && c.lit)));
  await page.evaluate(() => document.querySelector('[data-ex-object^="pivot:"]')?.click());
  await page.waitForTimeout(600);
  const e4 = await extract();
  ok('an individual pivot can be selected without its cached rows',
     e4.objects.find(o => o.id.startsWith('pivot:'))?.lit === true &&
     e4.objects.find(o => o.id.startsWith('records:'))?.lit === false,
     JSON.stringify(e4.objects));

  const preview = JSON.parse(e4.preview);
  ok('the full preview spells out per-sheet choices and selected objects',
     preview.kind === 'workbook-extract/2' &&
     preview.picked.sheets.find(s => s.name === 'Notes')?.kinds.join() === 'values' &&
     preview.picked.sheets.find(s => s.name === 'Budget')?.kinds.includes('comments') === false &&
     preview.picked.objects.length === 1 &&
     preview.items.every(i => i.kind !== 'records' && i.kind !== 'comments'),
     JSON.stringify(preview.picked));
  ok('each exported item has its own preview choice',
     e4.previewOptions.length === preview.items.length + 1,
     JSON.stringify(e4.previewOptions));
  await page.selectOption('[data-xs="ex-preview-pick"]', preview.items[0].name);
  const itemPreview = await page.locator('[data-xs="ex-preview-json"]').textContent();
  ok('an item preview is its exact serialized content', itemPreview === preview.items[0].content,
     itemPreview?.slice(0, 100));
  await page.selectOption('[data-xs="ex-preview-pick"]', '');

  const downloadReady = page.waitForEvent('download');
  await page.locator('[data-xs="ex-save"]').click();
  const download = await downloadReady;
  const saved = await readFile(await download.path(), 'utf8');
  ok('Save writes the exact JSON shown in the full preview', saved === e4.preview,
     JSON.stringify({ filename: download.suggestedFilename(), bytes: saved.length }));

  // Claim 13: what leaves is an envelope the page beside it opens.
  const url = await page.evaluate(async () => {
    // Read the built payload back off the surface the only way a reader can:
    // through the link it would hand over.
    const b = document.querySelector('[data-xs="ex-copy"]');
    if (!b || b.disabled) return null;
    b.click();
    await new Promise(r => setTimeout(r, 400));
    try { return await navigator.clipboard.readText(); } catch { return null; }
  });
  if (url) {
    const decoded = await page.evaluate(async (u) => {
      const b64 = u.split('#gz=')[1];
      const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    }, url);
    ok('the link carries the exact previewed envelope',
       JSON.stringify(decoded) === JSON.stringify(preview), decoded.kind);
    ok('and the workbook it came from, by name and size',
       decoded.source?.name === 'ledger.xlsx' && decoded.source.bytes > 0,
       JSON.stringify(decoded.source));
    ok('its items are data-view items, which is why no new page renders them',
       decoded.items.every(i => i.name && i.content && i.view), JSON.stringify(decoded.items.map(i => i.name)));
  } else {
    console.log('  skip  clipboard unreadable in this context; link payload unchecked');
  }

  await page.screenshot({ path: shotPath('extract-wide') });
  // The same surface at phone width, which is the claim the matrix's shape is
  // really making: every cell names its own kind, so nothing is lost when
  // position stops identifying the column.
  await page.setViewportSize({ width: 400, height: 900 });
  await page.waitForTimeout(400);
  const narrow = await page.evaluate(() => ({
    overflow: document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth,
    width: document.scrollingElement.scrollWidth,
  }));
  ok('the matrix reflows at phone width without scrolling the page sideways',
     !narrow.overflow, JSON.stringify(narrow));
  const en = await extract();
  ok('and no kind name is clipped at phone width', !en.clipped.length, JSON.stringify(en.clipped));
  await page.screenshot({ path: shotPath('extract-phone'), fullPage: true });

  await page.setViewportSize({ width: 1100, height: 800 });

  // THE ADDRESS THE SAMPLE IS HANDED OVER AT, which broke twice before it was
  // checked. data-view reads `#gz=` or `?src=` and nothing else; `#data=` is
  // toss-render's key, and on this page it matches no source and falls through
  // to the built-in demo envelope. That is the failure this asserts against:
  // a working page showing the wrong file, with no error to notice.
  console.log('the committed sample, at the address --link prints:');
  await page.goto(
    `${origin}/pages/data-view.html?src=${encodeURIComponent('mehrlander/web-tools@main:docs/examples/allotment-ledger.xlsx')}`,
    { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const s2 = await state();
  ok('?src= opens the committed workbook rather than the built-in demo',
     /allotment-ledger\.xlsx$/.test(s2.mode ? (await page.evaluate(() =>
       Alpine.$data(document.getElementById('dv-viewer')).file)) : ''),
     await page.evaluate(() => Alpine.$data(document.getElementById('dv-viewer'))?.file));
  ok('and it opens as a workbook, so the Structure mode is there to reach',
     (s2.modes || []).includes('xlsx-structure'), JSON.stringify(s2.modes));

  await page.evaluate(() => Alpine.$data(document.getElementById('dv-viewer')).switchMode('xlsx-structure'));
  await page.waitForTimeout(3000);
  await openTab('Extract');
  const real = await extract();
  ok('the Extract matrix draws over the real workbook, with its three sheets',
     real.sheets.map(x => x.name).join() === 'Summary,Ledger,Archive',
     JSON.stringify(real.sheets.map(x => x.name)));
  // The cut, on a file large enough to have one. The toy fixture cannot show
  // this at all: every count in it is one digit, and the default cap of 2000
  // is above every count on this workbook too, so the cap has to come DOWN for
  // the assertion to mean anything. Written the lazy way first, against the
  // default cap, it passed while testing nothing.
  await tapSheet('Ledger');
  const ledgerValues = (r) => r.cells.find(c => c.sheet === 'Ledger' && c.kind === 'values')?.label;
  const uncut = await extract();
  ok('under the cap a cell states the whole size', ledgerValues(uncut) === 'Values 802', ledgerValues(uncut));

  await page.selectOption('[data-xs="ex-cap"]', '500');
  await page.waitForTimeout(1200);
  const cut = await extract();
  ok('past the cap it reports the cut rather than applying it silently',
     ledgerValues(cut) === 'Values 500 of 802', ledgerValues(cut));
  ok('and no kind name is clipped even carrying a cut figure', !cut.clipped.length,
     JSON.stringify(cut.clipped));

  // THE TWO THINGS A 400px DESKTOP WINDOW DID NOT SHOW, and they belong HERE
  // rather than beside the fixture's phone shots above: both need a header
  // line and a table that the fixture is too small to produce. Placed beside
  // the fixture first, they passed while testing nothing, which is the second
  // time this file has had that fault in one session.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(900);

  // The figure line does not wrap, inside a block that used to size to its
  // content, so four figures ran underneath the icon buttons rather than
  // giving way. Measured before the fix: stats at x 8-382, buttons at x 258-382.
  const chrome = await page.evaluate(() => {
    const row = document.querySelector('[data-sd-chrome]');
    const stats = row?.firstElementChild?.lastElementChild;
    const btns = row?.lastElementChild;
    if (!stats || !btns) return null;
    const a = stats.getBoundingClientRect(), b = btns.getBoundingClientRect();
    return { stats: stats.textContent.trim(),
             overlaps: a.right > b.left && a.bottom > b.top && a.top < b.bottom };
  });
  ok('the header carries all four of this workbook\'s figures, so the next claim has teeth',
     /sheets.+hidden.+pivot.+KB/.test(chrome?.stats || ''), JSON.stringify(chrome?.stats));
  ok('and none of them runs under the icon buttons', chrome && !chrome.overlaps,
     JSON.stringify(chrome));

  // A structure table is WIDE rather than long: Sheets is 3 rows across 15
  // columns and 1219px in a 372px pane. Its scroll has to be its own, or the
  // pane takes the tab strip and the filter sideways with it.
  const panes = [];
  for (const label of ['Sheets', 'Parts', 'Pivots']) {
    await openTab(label);
    panes.push(await page.evaluate((w) => {
      const stage = document.querySelector('[data-xs="stage"]');
      const t = stage.querySelector('table');
      return { tab: w, slides: stage.scrollWidth > stage.clientWidth + 1,
               wider: t ? Math.round(t.getBoundingClientRect().width) > stage.clientWidth : false };
    }, label));
  }
  ok('these tables really are wider than the pane, so the claim below has teeth',
     panes.every(p => p.wider), JSON.stringify(panes));
  ok('and none of them drags the pane sideways', panes.every(p => !p.slides),
     JSON.stringify(panes));
  await page.setViewportSize({ width: 1100, height: 800 });

  console.log('a text file is untouched by any of this:');
  await page.goto(`${origin}/pages/data-view.html?src=${encodeURIComponent('mehrlander/web-tools@main:docs/tools.csv')}`,
                  { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const u = await state();
  ok('no sheets mode is offered', !(u.modes || []).includes('xlsx'), JSON.stringify(u.modes));
  ok('and the default still decides', u.mode === 'table', JSON.stringify(u));
  // 'table', not 'tree': docs/tools.json became docs/tools.csv in PR #441,
  // which updated this address and left the expectation behind. A CSV
  // opening as a table IS the default deciding, so the claim is unchanged
  // and only the shape of the fixture moved.
} finally {
  await browser.close();
  server.close();
}

console.log(failures.length ? `\n${failures.length} failure(s): ${failures.join(', ')}` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
