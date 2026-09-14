#!/usr/bin/env node
// A WORKBOOK TO OPEN THE VIEWER ON, and the link that opens it.
//
//   npm run sample-workbook              # rewrite the committed .xlsx
//   npm run sample-workbook -- --check   # is the committed one current?
//   npm run sample-workbook -- --link    # print the address that opens it
//
// The gap this closes is not a missing feature, it is a missing DOOR.
// pages/data-view.html and lib/kits/demos/xlsx.html both open on an empty
// intake: the reader has to supply an .xlsx of their own before either shows
// anything, so a link handed over for review shows a form. `npm run showing`
// says exactly this about a form-first page ("a link with no address opens
// whatever they default to"), and a link was handed over anyway on 2026-09-14,
// which is what this file is for.
//
// COMMITTED, BUT DERIVED. A .xlsx is a ZIP, so committing one puts a binary in
// the tree whose contents no diff can show, which is why tools/test/viewer-xlsx.mjs
// builds its fixture instead. The answer here is the repo's usual one for that
// tension: the SOURCE is this file and the artifact is regenerated from it, held
// in step by tools/test/derived-artifacts.test.mjs the same way dist/ is. What
// it takes to make a ZIP repeatable is stated at the PINNED constant below;
// a generator that is not byte-deterministic cannot be checked at all.
//
// Carrying the workbook inline in a #gz= fragment was the first attempt and it
// works, but the link ran to 25 KB, which is a link nothing wants to paste and
// some clients truncate. A committed file addresses in about 130 characters.
//
// It is DELIBERATELY NOT the scenario's fixture. That one is minimal and tuned
// to its assertions; enriching it would make those assertions read against a
// workbook whose size was chosen for a screenshot. This one is sized to SHOW
// the thing: 800 ledger rows, so the picker's smallest cap (500) visibly bites
// and the cells read "500 of 802"; every one of the twelve kinds present on at
// least one sheet; a form-shaped sheet whose values are almost nothing while
// its merges and styles are not; and a hidden sheet, so the matrix carries
// real zeros rather than only numbers.
import path from 'node:path';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i < 0 ? fallback : (argv[i + 1] ?? true);
};

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PNS = 'http://schemas.openxmlformats.org/package/2006/relationships';

// ---- the data ------------------------------------------------------------
//
// Plausible rather than random: a fund ledger is the shape this estate's
// workbooks actually take, so the column profiles report roles a reader can
// check by eye (Fund is Categorical, Doc is a Key, Amount is a Measure).
const FUNDS = ['600', '722', '874', '888', '001'];
const OBJECTS = ['A - Salaries', 'B - Benefits', 'E - Goods and Services', 'G - Travel', 'J - Equipment'];
const PROGRAMS = ['Administration', 'Member Services', 'Employer Services', 'Information Services'];

// Seeded, so two runs of this file produce the same workbook and the same
// link. An unseeded sample would make every screenshot a different document.
let seed = 20260914;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (list) => list[Math.floor(rand() * list.length)];

// 800, so the picker's smallest cap (500 rows) VISIBLY bites: the Values cell
// reads "500 of 801" and the Records cell "500 of 800", which is the reporting
// habit this whole format is built on, shown rather than described.
const LEDGER_ROWS = Number(flag('--rows', 800));
const ledger = Array.from({ length: LEDGER_ROWS }, (_, i) => ({
  doc: `D-${String(10001 + i)}`,
  fund: pick(FUNDS),
  object: pick(OBJECTS),
  program: pick(PROGRAMS),
  // Serial days from 2025-01-01 (45,658), so the Opened column reads as dates
  // once the number format is applied rather than as five-digit serials.
  opened: 45658 + Math.floor(rand() * 250),
  amount: Math.round((rand() * 48000 + 500) * 100) / 100,
}));

// ---- shared strings ------------------------------------------------------
const strings = [];
const sid = (v) => {
  const i = strings.indexOf(v);
  return i >= 0 ? i : (strings.push(v) - 1);
};
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A cell, by the three shapes that matter here: shared string, number, formula.
const cS = (ref, v, st) => `<c r="${ref}" t="s"${st == null ? '' : ` s="${st}"`}><v>${sid(v)}</v></c>`;
const cN = (ref, v, st) => `<c r="${ref}" ${st == null ? '' : `s="${st}" `}><v>${v}</v></c>`;
const cF = (ref, f, v, st) => `<c r="${ref}"${st == null ? '' : ` s="${st}"`}><f>${esc(f)}</f><v>${v}</v></c>`;

// ---- Ledger --------------------------------------------------------------
//
// Style 1 is the banded header, 2 the date column, 3 currency, 4 the bold
// total. Every one of them is a real appearance a reader can check against the
// Styles extract.
const HEAD = ['Doc', 'Fund', 'Object', 'Program', 'Opened', 'Amount', 'Share'];
const ledgerRows = [
  `<row r="1" ht="22" customHeight="1">${HEAD.map((h, i) =>
    cS(String.fromCharCode(65 + i) + '1', h, 1)).join('')}</row>`,
  ...ledger.map((r, i) => {
    const n = i + 2;
    return `<row r="${n}">${[
      cS(`A${n}`, r.doc),
      cS(`B${n}`, r.fund),
      cS(`C${n}`, r.object),
      cS(`D${n}`, r.program),
      cN(`E${n}`, r.opened, 2),
      cN(`F${n}`, r.amount, 3),
      // A formula on every data row, so the Formulas extract has something to
      // show and profileColumns marks the column Computed.
      cF(`G${n}`, `F${n}/SUM($F$2:$F$${LEDGER_ROWS + 1})`, (r.amount / 1e6).toFixed(6), 3),
    ].join('')}</row>`;
  }),
  // The total row, which is also the case profileColumns' majority rule exists
  // for: a text label sitting at the bottom of a number column.
  `<row r="${LEDGER_ROWS + 2}">${[
    cS(`A${LEDGER_ROWS + 2}`, 'Total', 4),
    cF(`F${LEDGER_ROWS + 2}`, `SUM(F2:F${LEDGER_ROWS + 1})`,
       ledger.reduce((a, r) => a + r.amount, 0).toFixed(2), 4),
  ].join('')}</row>`,
];

const LEDGER = `<?xml version="1.0"?>
<worksheet xmlns="${NS}" xmlns:r="${RNS}">
  <sheetPr/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews>
  <cols>
    <col min="1" max="1" width="11" customWidth="1"/>
    <col min="3" max="4" width="24" customWidth="1"/>
    <col min="6" max="7" width="14" customWidth="1"/>
  </cols>
  <sheetData>${ledgerRows.join('')}</sheetData>
  <conditionalFormatting sqref="F2:F${LEDGER_ROWS + 1}">
    <cfRule type="cellIs" operator="greaterThan" dxfId="0" priority="1"><formula>40000</formula></cfRule>
    <cfRule type="cellIs" operator="lessThan" dxfId="1" priority="2"><formula>2000</formula></cfRule>
  </conditionalFormatting>
  <dataValidations count="2">
    <dataValidation type="list" sqref="B2:B${LEDGER_ROWS + 1}" showInputMessage="1"
      promptTitle="Fund" prompt="The fund this document charges. Use the five-digit code from the chart of accounts.">
      <formula1>"${FUNDS.join(',')}"</formula1>
    </dataValidation>
    <dataValidation sqref="F2:F${LEDGER_ROWS + 1}" showInputMessage="1"
      promptTitle="Amount" prompt="Enter the encumbered amount, not the expended amount. Reconcile against AFRS before the allotment closes."/>
  </dataValidations>
</worksheet>`;

const LEDGER_RELS = `<?xml version="1.0"?>
<Relationships xmlns="${PNS}">
  <Relationship Id="rId1" Type=".../comments" Target="../comments1.xml"/>
</Relationships>`;

const COMMENTS = `<?xml version="1.0"?>
<comments xmlns="${NS}">
  <authors><author>Marcus</author><author>OFM</author></authors>
  <commentList>
    <comment ref="F14" authorId="0"><text><t>this one was re-coded in March, check against the journal</t></text></comment>
    <comment ref="C31" authorId="1"><text><t>object E covers the maintenance contract; do not split it</t></text></comment>
    <comment ref="G1" authorId="0"><text><t>share of the total, recomputed on every open</t></text></comment>
  </commentList>
</comments>`;

// ---- Summary: a form rather than a grid ----------------------------------
//
// Merges, a title band, and almost no rows: the sheet whose Values extract is
// nearly empty while its Styles and Merges extracts are not, which is the
// whole argument for the kind axis.
const SUMMARY = `<?xml version="1.0"?>
<worksheet xmlns="${NS}">
  <mergeCells count="3">
    <mergeCell ref="A1:E1"/><mergeCell ref="A3:B3"/><mergeCell ref="A5:E5"/>
  </mergeCells>
  <sheetData>
    <row r="1" ht="30" customHeight="1">${cS('A1', 'Quarterly allotment summary', 1)}</row>
    <row r="3">${cS('A3', 'Prepared by', 4)}${cS('C3', 'Budget office')}</row>
    <row r="5">${cS('A5', 'Figures below are drawn from the Ledger tab and refresh on open.', 0)}</row>
    <row r="7">${cS('A7', 'Total encumbered', 4)}${
      cF('C7', "SUM(Ledger!F:F)", ledger.reduce((a, r) => a + r.amount, 0).toFixed(2), 3)}</row>
    <row r="8">${cS('A8', 'Documents', 4)}${cF('C8', 'COUNTA(Ledger!A:A)-2', String(LEDGER_ROWS))}</row>
  </sheetData>
</worksheet>`;

// ---- Archive: hidden, and that is the point ------------------------------
const ARCHIVE = `<?xml version="1.0"?>
<worksheet xmlns="${NS}"><sheetData>
  <row r="1">${cS('A1', 'Superseded 2025 codes')}</row>
  <row r="2">${cS('A2', '0891')}</row>
  <row r="3">${cS('A3', '0892')}</row>
</sheetData></worksheet>`;

// ---- the pivot, over the ledger -----------------------------------------
const PIVOT_TABLE = `<?xml version="1.0"?>
<pivotTableDefinition xmlns="${NS}" name="ByFund" cacheId="7">
  <location ref="A1:C7"/>
  <rowFields count="1"><field x="0"/></rowFields>
  <dataFields count="1"><dataField name="Sum of Amount" fld="1"/></dataFields>
</pivotTableDefinition>`;

const PIVOT_CACHE = `<?xml version="1.0"?>
<pivotCacheDefinition xmlns="${NS}" recordCount="${LEDGER_ROWS}">
  <cacheSource type="worksheet"><worksheetSource ref="A1:G${LEDGER_ROWS + 1}" sheet="Ledger"/></cacheSource>
  <cacheFields count="3">
    <cacheField name="Fund"><sharedItems count="${FUNDS.length}">${
      FUNDS.map(f => `<s v="${f}"/>`).join('')}</sharedItems></cacheField>
    <cacheField name="Amount"/>
    <cacheField name="Program"><sharedItems count="${PROGRAMS.length}">${
      PROGRAMS.map(p => `<s v="${esc(p)}"/>`).join('')}</sharedItems></cacheField>
  </cacheFields>
</pivotCacheDefinition>`;

const PIVOT_RECORDS = `<?xml version="1.0"?>
<pivotCacheRecords xmlns="${NS}" count="${LEDGER_ROWS}">${
  ledger.map(r => `<r><x v="${FUNDS.indexOf(r.fund)}"/><n v="${r.amount}"/><x v="${PROGRAMS.indexOf(r.program)}"/></r>`).join('')
}</pivotCacheRecords>`;

const PIVOT_CACHE_RELS = `<?xml version="1.0"?>
<Relationships xmlns="${PNS}">
  <Relationship Id="rId1" Type=".../pivotCacheRecords" Target="pivotCacheRecords1.xml"/>
</Relationships>`;

const SUMMARY_RELS = `<?xml version="1.0"?>
<Relationships xmlns="${PNS}">
  <Relationship Id="rId1" Type=".../pivotTable" Target="../pivotTables/pivotTable1.xml"/>
</Relationships>`;

const CONNECTIONS = `<?xml version="1.0"?>
<connections xmlns="${NS}">
  <connection id="1" name="Chart of accounts" type="4" description="the fund and object codes, refreshed each biennium">
    <webPr url="https://ofm.wa.gov/accounting/saam"/>
  </connection>
  <connection id="2" name="AFRS extract" type="5" description="nightly encumbrance download">
    <dbPr connection="Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$;Location=AFRS" command="AFRS"/>
  </connection>
</connections>`;

const STYLES = `<?xml version="1.0"?>
<styleSheet xmlns="${NS}">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/>
    <numFmt numFmtId="165" formatCode="#,##0.00"/>
  </numFmts>
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1F4E79"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FF1F4E79"/></bottom></border>
  </borders>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="165" fontId="2" fillId="0" borderId="1" applyBorder="1"/>
  </cellXfs>
  <dxfs count="2">
    <dxf><font><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf>
    <dxf><fill><patternFill><bgColor rgb="FFC6EFCE"/></patternFill></fill></dxf>
  </dxfs>
</styleSheet>`;

// The M source, inside the two containers Power Query stores it in: a
// base64 <DataMashup> whose bytes are a ZIP behind an 8-byte header.
const M_SOURCE = `section Section1;

shared AFRS = let
    Source = Csv.Document(File.Contents("\\\\ofm\\afrs\\nightly.csv"),[Delimiter=","]),
    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    Typed = Table.TransformColumnTypes(Promoted,{{"Doc", type text}, {"Amount", Currency.Type}}),
    Encumbered = Table.SelectRows(Typed, each [Status] = "E")
in
    Encumbered;
`;

async function mashup() {
  const inner = new JSZip();
  inner.file('Formulas/Section1.m', M_SOURCE, ENTRY);
  inner.file('Config/Package.xml', '<?xml version="1.0"?><Package/>', ENTRY);
  const zipBytes = await inner.generateAsync({ type: 'nodebuffer' });
  const head = Buffer.alloc(8);
  head.writeUInt32LE(0, 0);
  head.writeUInt32LE(zipBytes.length, 4);
  return Buffer.concat([head, zipBytes]).toString('base64');
}

// WHAT MAKES THE BYTES REPEATABLE, which the --check below depends on
// entirely. Two things, and the second cost an hour because it looks like
// nothing:
//
//   date            JSZip stamps `new Date()` on every entry it is not given
//                   one for.
//   createFolders   and it invents a parent-folder ENTRY for every path with a
//                   slash in it (`xl/`, `xl/worksheets/`, `Formulas/`), which
//                   takes the clock even when the file beside it does not.
//                   Those entries are optional in a ZIP and no reader here
//                   needs them, so the honest fix is not to create them.
//
// The folder stamps hid inside the Power Query part rather than showing up as
// a changed date: the mashup is an inner ZIP, base64'd into an XML string that
// the outer ZIP then DEFLATEs, so a two-second tick in a folder entry moved
// the whole file's length by a byte. Six builds in one loop matched and builds
// a minute apart did not, which is the shape of a check that would have gone
// red in CI at random.
const PINNED = new Date(Date.UTC(2026, 0, 1));
const ENTRY = { date: PINNED, createFolders: false };

async function build() {
  const zip = new JSZip();
  const put = (path, body) => zip.file(path, body, ENTRY);
  // Sheet parts are written in a different order from the workbook's own
  // <sheets>, which is what a workbook looks like once its tabs have been
  // dragged: the viewer reads workbook order, not part order.
  put('xl/worksheets/sheet1.xml', LEDGER);
  put('xl/worksheets/_rels/sheet1.xml.rels', LEDGER_RELS);
  put('xl/worksheets/sheet2.xml', SUMMARY);
  put('xl/worksheets/_rels/sheet2.xml.rels', SUMMARY_RELS);
  put('xl/worksheets/sheet3.xml', ARCHIVE);
  put('xl/comments1.xml', COMMENTS);
  put('xl/styles.xml', STYLES);
  put('xl/connections.xml', CONNECTIONS);
  put('xl/pivotTables/pivotTable1.xml', PIVOT_TABLE);
  put('xl/pivotCache/pivotCacheDefinition1.xml', PIVOT_CACHE);
  put('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels', PIVOT_CACHE_RELS);
  put('xl/pivotCache/pivotCacheRecords1.xml', PIVOT_RECORDS);
  put('customXml/item1.xml',
    `<?xml version="1.0"?><DataMashup xmlns="http://schemas.microsoft.com/DataMashup">${await mashup()}</DataMashup>`);

  // sharedStrings LAST, because sid() has been filling it the whole way down.
  put('xl/sharedStrings.xml',
    `<?xml version="1.0"?><sst xmlns="${NS}" count="${strings.length}" uniqueCount="${strings.length}">${
      strings.map(s => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`);

  put('xl/workbook.xml', `<?xml version="1.0"?>
<workbook xmlns="${NS}" xmlns:r="${RNS}">
  <sheets>
    <sheet name="Summary" sheetId="3" r:id="rId2"/>
    <sheet name="Ledger" sheetId="1" r:id="rId1"/>
    <sheet name="Archive" sheetId="9" r:id="rId3" state="hidden"/>
  </sheets>
  <definedNames><definedName name="Encumbered">Ledger!$F$2:$F$${LEDGER_ROWS + 1}</definedName></definedNames>
  <pivotCaches><pivotCache cacheId="7" r:id="rId4"/></pivotCaches>
</workbook>`);
  put('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="${PNS}">
  <Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type=".../worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type=".../worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type=".../pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/>
</Relationships>`);
  put('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const bytes = await build();
const AT = 'docs/examples/allotment-ledger.xlsx';
const at = path.join(root, AT);

// --check: compare, never write. What derived-artifacts.test.mjs runs, and the
// reason every zip entry above carries a pinned date.
if (flag('--check') !== null) {
  let have = null;
  try { have = await readFile(at); } catch { /* not there yet */ }
  if (have && have.equals(bytes)) {
    console.log(`sample-workbook: ${AT} is current`);
    process.exit(0);
  }
  console.error(have
    ? `sample-workbook: ${AT} is behind its generator (${have.length} B on disk, ${bytes.length} B built). Run: npm run sample-workbook`
    : `sample-workbook: ${AT} is missing. Run: npm run sample-workbook`);
  process.exit(1);
}

// --link: the address that opens the committed workbook in the data-view page,
// which is the whole point of the file. `?use=` picks which copy of lib/ the
// page loads and must sit BEFORE the fragment; `#data=` is the toss shorthand
// data-view resolves onto its own ?src=.
//
// SHORT SHAs, BOTH TIMES, and the reason is a hard limit rather than taste.
// The GitHub MCP write path defangs a markdown link past 149 characters into
// an inert code span (scripts/mcp-link-safe.py holds the rule), and this page
// plus a branch name plus a full SHA runs to 207. A 7-character SHA is enough
// for the two routes that resolve it, both confirmed 2026-09-14: the contents
// API behind `#data=` takes an abbreviated ref, and so does jsDelivr behind
// `?use=`. It is also the better ref, since a SHA pins these bytes where a
// branch name follows the tip.
if (flag('--link') !== null) {
  const short = (r) => (/^[0-9a-f]{7,40}$/i.test(String(r)) ? String(r).slice(0, 7) : r);
  const at = short(flag('--at', flag('--ref', 'main')));
  const use = flag('--use') ? short(flag('--use')) : null;
  const base = 'https://mehrlander.github.io/web-tools/pages/data-view.html';
  const url = `${base}${use ? `?use=${use}` : ''}#data=mehrlander/web-tools@${at}:${AT}`;
  console.log(url);
  // Say so rather than emit a link that will be quietly defanged wherever it
  // is pasted. 149 is mcp-link-safe.py's limit; keep the two in step.
  if (url.length > 149) {
    console.error(`sample-workbook: that link is ${url.length} characters, ${url.length - 149} over `
      + `the 149 the GitHub MCP write path accepts before it defangs a markdown link. `
      + `Pass --at <sha> (and --use <sha>) rather than a branch name.`);
    process.exit(1);
  }
  // --link never writes: dropping this is how the first version printed the
  // link and then rewrote the workbook underneath it.
  process.exit(0);
}

const out = flag('--out', AT);
const dest = path.resolve(root, String(out));
await mkdir(path.dirname(dest), { recursive: true });
await writeFile(dest, bytes);
console.log(`sample-workbook: ${path.relative(root, dest)}  ${(bytes.length / 1024).toFixed(1)} KB`
  + `  (${LEDGER_ROWS} ledger rows, 3 sheets, 1 hidden)`);
