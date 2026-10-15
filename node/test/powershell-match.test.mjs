import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { Parser, Language } from 'web-tree-sitter';
import { repoRoot } from '../repo-root.mjs';
await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(new URL('../../node_modules/tree-sitter-powershell/tree-sitter-powershell.wasm', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')));
const context = { window: {} };
vm.runInNewContext(readFileSync(repoRoot + '/lib/kits/powershell-units.js', 'utf8'), context);
vm.runInNewContext(readFileSync(repoRoot + '/lib/kits/powershell-match.js', 'utf8'), context);
const units = context.window.PowerShellUnits, M = context.window.PowerShellMatch;
// The kit asks for a tolerant inventory; the parser is supplied the way node does.
const U = { inventory: (text, opts) => units.inventory(text, { ...opts, parser }) };
test.after(() => parser.delete());

const FILES = {
  'app/Modules/Excel/Excel.psm1': `function Open-Book {\n  param([string]$Path)\n  $excel = New-Object -ComObject Excel.Application\n  $book = $excel.Workbooks.Open($Path, 0, $true)\n  return $book\n}\nfunction Get-Sheets {\n  param($Book)\n  foreach ($s in $Book.Worksheets) { [pscustomobject]@{ Name = $s.Name; Visible = $s.Visible } }\n}\n`,
  'app/Modules/Clip/Clip.psm1': `function Set-ClipText {\n  param([string]$Text, [switch]$Html)\n  Add-Type -AssemblyName System.Windows.Forms\n  if ($Html) { [Windows.Forms.Clipboard]::SetText($Text, 'Html') } else { [Windows.Forms.Clipboard]::SetText($Text) }\n}\n`,
  'app/Profile.ps1': `Import-Module Excel\nImport-Module Clip\nSet-Location $env:USERPROFILE\\Documents\n$Host.UI.RawUI.WindowTitle = 'Work console for the budget shop'\n`,
};
const build = async (u = U) => { const idx = M.index(); for (const [p, t] of Object.entries(FILES)) await M.add(idx, p, t, u); return idx; };

test('each piece of a mixed buffer goes to its own file, and new code is called new', async () => {
  const idx = await build();
  const changed = FILES['app/Modules/Excel/Excel.psm1'].split('function Get-Sheets')[0].replace('0, $true', '0, $false');
  const paste = changed + '\n' + FILES['app/Modules/Clip/Clip.psm1']
    + '\n$rows = Import-Csv $env:TEMP\\export.csv | Where-Object { $_.Amount -gt 1000 } | Sort-Object Amount -Descending\n';
  const r = await M.rank(paste, idx, U);
  const by = Object.fromEntries(r.units.map(u => [u.name, [u.verdict, u.match?.path || '']]));
  assert.deepEqual(by['Open-Book'], ['version', 'app/Modules/Excel/Excel.psm1']);
  assert.deepEqual(by['Set-ClipText'], ['identical', 'app/Modules/Clip/Clip.psm1']);
  assert.equal(r.units.find(u => u.name === '$rows').verdict, 'new', 'an assignment holding a scriptblock is its own named unit');
  assert.deepEqual([...r.files.map(f => f.path)].sort(), ['app/Modules/Clip/Clip.psm1', 'app/Modules/Excel/Excel.psm1']);
  const clip = r.files.find(f => f.path.endsWith('Clip.psm1'));
  assert.equal(clip.identical, 1);
  assert.match(clip.text, /^function Set-ClipText/, 'the pieces that went to a file are what to compare with it');
  assert.ok(r.files.every(f => f.share > 0 && f.share < 1));
});

test('a whole file pasted back ranks that file first, with nearly all of the paste', async () => {
  const idx = await build();
  const r = await M.rank(FILES['app/Modules/Excel/Excel.psm1'], idx, U);
  assert.equal(r.files[0].path, 'app/Modules/Excel/Excel.psm1');
  assert.ok(r.files[0].share > 0.95);
  assert.ok(r.units.every(u => u.verdict === 'identical'));
});

test('without the parser a file splits at blank lines and still attributes', async () => {
  const none = { inventory: async () => { throw new Error('no parser'); } };
  const idx = await build(none);
  const r = await M.rank('\n' + FILES['app/Modules/Clip/Clip.psm1'] + '\n\nWrite-Host "something else entirely with enough tokens here"\n', idx, none);
  assert.equal(r.files[0].path, 'app/Modules/Clip/Clip.psm1');
  assert.match(r.units[0].name, /^Lines? \d+(–\d+)?$/);
  assert.equal(r.units.at(-1).verdict, 'new');
});

test('short fragments are ignored rather than matched by chance', async () => {
  const idx = await build();
  const r = await M.rank('$a = 1\n', idx, U);
  assert.deepEqual([r.units.length, r.files.length], [0, 0]);
});
