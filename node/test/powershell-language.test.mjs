// Heuristic inspection must preserve source line locations, distinguish executable
// tokens from examples, and never imply that browser observations validate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const window = {};
new Function('window', readFileSync(new URL('../../lib/kits/powershell-language.js', import.meta.url), 'utf8'))(window);
const { inspect, compareCompanions, compareTheme, compareStructure } = window.PowerShellLanguage;

test('PowerShell outline masks comments, here-strings, multiline strings, and escaped quotes', () => {
  const source = [
    '<# function Fake-Comment {}',
    '<# nested block #>',
    'function Still-Comment {} #>',
    '$sample = @\'',
    'function Fake-Here {}',
    '$bad && Other-Bad',
    "'@",
    '$double = @"',
    'function Another-Fake {}',
    '"@',
    '$single = \'first line',
    "function Fake-Multiline {} and ''escaped'' quote'",
    '$quoted = "escaped `"# not a comment; function Fake-Quoted {}"',
    'function Get-Real {',
    '  param([string]$Name)',
    '}',
  ].join('\r\n');
  const result = inspect(source, 'Module.psm1');
  assert.equal(result.language, 'powershell');
  assert.equal(result.heuristic, true);
  assert.deepEqual(result.symbols.map(s => [s.name, s.kind, s.line]), [['Get-Real', 'function', 14], ['$Name', 'parameter', 15]]);
  assert.deepEqual(result.diagnostics, []);
});

test('nested parameter attributes and defaults do not create spurious parameters', () => {
  const source = [
    'function global:Get-Report',
    '{',
    '  <# .SYNOPSIS A report. #>',
    '  [CmdletBinding(SupportsShouldProcess = $true)]',
    '  param(',
    '    [Parameter(Mandatory = $true)]',
    '    [ValidateScript({ $_ -and (Test-Path $_) })]',
    '    [string[]] $Path = @(\'one,two\', \'three\'),',
    '    [System.Collections.Generic.List[string]] $Names,',
    '    [hashtable] $Options = @{ Enabled = $true; Values = @(1, 2) },',
    '    $Count = (Get-Count -Limit 10)',
    '  )',
    '  function Get-Nested($Value = \'a,b\') { $Value }',
    '}',
    'function No-Params {',
    '  $answer = 3',
    '  function Inner { param($Inner) }',
    '}',
  ].join('\n');
  const result = inspect(source);
  const outer = result.symbols.find(s => s.name === 'global:Get-Report');
  assert.equal(outer.detail, '$Path, $Names, $Options, $Count');
  assert.match(result.symbols.find(s => s.name === '$Path').detail, /\[string\[\]\].*= @\('one,two', 'three'\)/);
  assert.equal(result.symbols.find(s => s.name === 'No-Params').detail, '');
  assert.equal(result.symbols.find(s => s.name === 'Inner').detail, '$Inner');
  assert.equal(result.symbols.find(s => s.name === 'Get-Nested').detail, '$Value');
  assert.equal(result.symbols.filter(s => s.kind === 'parameter').length, 6);
});

test('script parameters, filters, classes, and enums have stable line addresses', () => {
  const result = inspect('<# help #>\n[CmdletBinding()]\nparam([int]$Limit = 5)\nfilter Select-Item { $_ }\nclass Report {}\nenum State { Ready }');
  assert.deepEqual(result.symbols.map(s => [s.name, s.kind, s.line]), [['$Limit', 'parameter', 3], ['Select-Item', 'filter', 4], ['Report', 'class', 5], ['State', 'enum', 6]]);
  assert.deepEqual(inspect('').symbols, []);
});

test('module, assembly, and dot-source references retain expressions without resolving them', () => {
  const source = [
    ". '$PSScriptRoot/One.ps1'",
    '. "$PSScriptRoot/Two.ps1"',
    '. $PSScriptRoot\\Three.ps1',
    "Import-Module -Name 'Forms' -Force",
    'Import-Module Bookmarks -Force',
    "using module './Utilities.psm1'",
    "Add-Type -AssemblyName 'PresentationFramework'",
    "Add-Type -TypeDefinition 'class Fake {}'",
    '# Import-Module Not-Real',
    '$example = "Import-Module Also-Not-Real"',
  ].join('\n');
  const result = inspect(source);
  assert.deepEqual(result.references.map(r => [r.kind, r.name, r.line]), [
    ['dot-source', '$PSScriptRoot/One.ps1', 1], ['dot-source', '$PSScriptRoot/Two.ps1', 2], ['dot-source', '$PSScriptRoot\\Three.ps1', 3],
    ['module', 'Forms', 4], ['module', 'Bookmarks', 5], ['module', './Utilities.psm1', 6], ['assembly', 'PresentationFramework', 7],
  ]);
});

test('selected compatibility warnings ignore comments, literals, and here-string examples', () => {
  const source = [
    '#requires -Version 7.2',
    '# Other-Cmd && Fake-Cmd',
    '$literal = \'$x ?? 1 && Not-Real\'',
    '$sample = @"',
    '#requires -Version 9',
    'ForEach-Object -Parallel { do-example }',
    '"@',
    'Get-Thing && Save-Thing',
    '$value ??= 3',
    'Get-Thing | ForEach-Object -Parallel { $_ }',
  ].join('\n');
  const result = inspect(source);
  assert.deepEqual(result.diagnostics.map(d => [d.rule, d.line]).sort((a, b) => a[1] - b[1]), [
    ['ps51-requires', 1], ['ps51-pipeline-chain', 8], ['ps51-null-coalescing-assignment', 9], ['ps51-parallel', 10],
  ]);
  assert.deepEqual(inspect('#requires -Version 5.1\n$value = \'??\'').diagnostics, []);
});

test('ternary and null-coalescing observations skip the Where-Object alias, scope and drive colons, wildcards, and masked text', () => {
  const source = [
    "$label = $ready ? 'Ready' : 'Waiting'",
    '$count = ($items | ? { $_.Enabled }).Count',
    '? Name -like "a*"',
    '$rows = $items | ? Name -eq $script:name',
    "$name = $item.Name ?? 'none'",
    '$first = $items[0] ?? $default',
    'Get-ChildItem ??.txt',
    '# $x ? 1 : 2 ?? 3',
    "$example = '$x ? 1 : 2'",
    '$value = if ($ready) { 1 } else { 2 }',
    '$path = C:\\Temp\\out.txt; $script:total ??= 0',
    '$size = ($file.Length -gt 0) ? "$($file.Length) bytes" : \'empty\'',
  ].join('\r\n');
  assert.deepEqual(inspect(source).diagnostics.map(d => [d.rule, d.line]), [
    ['ps51-ternary', 1], ['ps51-null-coalescing', 5], ['ps51-null-coalescing', 6], ['ps51-null-coalescing-assignment', 11], ['ps51-ternary', 12],
  ]);
  assert.match(inspect('$a ? 1 : 2').diagnostics[0].message, /if and else/);
});

test('unclosed lexical regions are observations with a location, not runtime validation', () => {
  assert.deepEqual(inspect('Write-Output 1\n<# unfinished').diagnostics.map(d => [d.rule, d.line]), [['unclosed-comment', 2]]);
  assert.deepEqual(inspect('$value = @\'\ntext\n  \'@').diagnostics.map(d => [d.rule, d.line]), [['unclosed-string', 1]]);
  assert.equal(inspect('$value = \'can\'\'t\'').diagnostics.length, 0);
});

test('XAML inspection supports multiline tags, multiple tags per line, quotes, comments, and resources', () => {
  const source = [
    '<?xml version="1.0"?>',
    '<!-- <Button x:Name="FakeComment"/> -->',
    '<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
    '        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
    '        x:Name="MainWindow">',
    '  <Button',
    '    x:Name="SaveButton" ToolTip="Use > to continue"',
    '    Background="{DynamicResource ResourceKey=AccentBrush}" Click="OnSave"/>',
    '  <TextBox Name="Search"/><TextBlock x:Name="Status" Foreground="{StaticResource TextBrush}"/>',
    '  <SolidColorBrush x:Key="AccentBrush" Color="Blue"/>',
    '  <![CDATA[<Button x:Name="FakeCdata"/>]]>',
    '</Window>',
  ].join('\r\n');
  const result = inspect(source, 'Form.xaml');
  assert.equal(result.language, 'xaml');
  assert.deepEqual(result.controls.map(c => [c.name, c.type, c.line]), [['MainWindow', 'Window', 5], ['SaveButton', 'Button', 7], ['Search', 'TextBox', 9], ['Status', 'TextBlock', 9]]);
  assert.deepEqual(result.resources.map(r => [r.name, r.kind]), [['AccentBrush', 'dynamic'], ['TextBrush', 'static'], ['AccentBrush', 'definition']]);
  assert.deepEqual(result.references, [{ name: 'OnSave', kind: 'handler', line: 8, detail: 'Click' }]);
  assert.deepEqual(result.symbols.map(s => [s.name, s.kind, s.line]), [
    ['MainWindow', 'control', 5], ['SaveButton', 'control', 7], ['AccentBrush', 'DynamicResource', 8], ['Search', 'control', 9], ['Status', 'control', 9], ['TextBrush', 'StaticResource', 9], ['AccentBrush', 'x:Key', 10],
  ]);
});

test('the XAML outline lists each resource key once, at its first use, while every occurrence stays in resources', () => {
  const source = [
    '<ResourceDictionary>',
    '  <SolidColorBrush x:Key="PanelBrush" Color="Gray"/>',
    '  <Style x:Key="Heading"><Setter Property="Foreground" Value="{DynamicResource PanelBrush}"/></Style>',
    '  <Border Background="{DynamicResource PanelBrush}" BorderBrush="{DynamicResource PanelBrush}"/>',
    '</ResourceDictionary>',
  ].join('\n');
  const result = inspect(source, 'Theme.xaml');
  assert.equal(result.resources.filter(r => r.kind === 'dynamic').length, 3);
  assert.deepEqual(result.symbols, [
    { name: 'PanelBrush', kind: 'x:Key', line: 2, detail: '' }, { name: 'Heading', kind: 'x:Key', line: 3, detail: '' },
    { name: 'PanelBrush', kind: 'DynamicResource', line: 3, detail: '3 uses' },
  ]);
  assert.deepEqual(inspect('<Grid/>', 'Form.xaml').symbols, []);
});

test('companion matching requires explicit literal FindName lookups and respects WPF name casing', () => {
  const script = [
    "$button = $window.FindName('SaveButton')",
    '$button.Add_Click({ Save-Report })',
    "$wrongCase = $window.FindName('search')",
    '$Search = 1',
    '$Search.Add_TextChanged({})',
    '$dynamic = $window.FindName("$prefix" + "Status")',
    '$comment = \'$window.FindName("Fake")\'',
    "# $window.FindName('AnotherFake')",
  ].join('\n');
  const xaml = '<Grid><Button Name="SaveButton"/><TextBox Name="Search"/><TextBlock Name="Status"/></Grid>';
  const ps = inspect(script), result = compareCompanions(script, xaml);
  assert.deepEqual(ps.references.filter(r => r.kind === 'control').map(r => r.name), ['SaveButton', 'search']);
  assert.deepEqual(ps.references.find(r => r.kind === 'event' && r.name === '$button'), { name: '$button', kind: 'event', line: 2, detail: 'Click' });
  assert.deepEqual(result.matched.map(c => c.name), ['SaveButton']);
  assert.deepEqual(result.unreferenced.map(c => c.name), ['Search', 'Status']);
  assert.deepEqual(result.missing.map(r => r.name), ['search']);
  assert.match(result.diagnostics[0].message, /namescopes/);
  assert.deepEqual(compareCompanions(ps, inspect(xaml, 'Form.xaml')), result);
});

test('inspection does not mutate input records or supply source-derived HTML', () => {
  const xaml = '<Button Name="&lt;script&gt;"/>';
  const a = inspect(xaml, 'Form.xaml'), before = JSON.stringify(a);
  compareCompanions(inspect(''), a);
  assert.equal(JSON.stringify(a), before);
  assert.equal(a.controls[0].name, '&lt;script&gt;');
  assert.equal(Object.hasOwn(a, 'html'), false);
});

test('event receivers are never inferred from unrelated same-name variable assignments', () => {
  const source = "function First { $button.Add_Click({}) }\nfunction Second { $button = $window.FindName('Save') }";
  assert.deepEqual(inspect(source).references.find(r => r.kind === 'event'), { name: '$button', kind: 'event', line: 1, detail: 'Click' });
  assert.deepEqual(inspect('<TextBlock Text="{}{StaticResource Example}"/>', 'Form.xaml').resources, []);
});

test('a DynamicResource key defined neither in the form nor in Theme.xaml is reported at its line', () => {
  const theme = '<ResourceDictionary>\n  <SolidColorBrush x:Key="BorderColor" Color="Gray"/>\n  <Style x:Key="MonoText"/>\n</ResourceDictionary>';
  const form = [
    '<Window>',
    '  <Window.Resources><SolidColorBrush x:Key="LinkBlue" Color="Blue"/></Window.Resources>',
    '  <!-- <Border BorderBrush="{DynamicResource Commented}"/> -->',
    '  <Border BorderBrush="{DynamicResource BorderColor}" Background="{DynamicResource LinkBlue}"/>',
    '  <TextBox Style="{DynamicResource MonoTextBox}"/>',
    '  <Grid Background="{StaticResource NotChecked}"/>',
    '  <TextBox Style="{DynamicResource MonoTextBox}"/>',
    '</Window>',
  ].join('\r\n');
  const result = compareTheme(form, theme);
  assert.deepEqual(result.unresolved.map(r => [r.name, r.line]), [['MonoTextBox', 5], ['MonoTextBox', 7]]);
  assert.deepEqual(result.diagnostics.map(d => [d.rule, d.line]), [['theme-unresolved', 5], ['theme-unresolved', 7]]);
  assert.match(result.diagnostics[0].message, /MonoTextBox.*WPF keeps the property default/);
  assert.deepEqual(compareTheme(inspect(form, 'Form.xaml'), inspect(theme, 'Theme.xaml')).unresolved.length, 2);
  assert.deepEqual(compareTheme('<Grid Background="Red"/>', theme).diagnostics, []);
});

test('a second version is summarized by function: added, removed, changed, parameters, script body and new problems', () => {
  const before = [
    '#requires -Version 5.1',
    'function Get-Report {',
    '  param([string]$Name)',
    '  "Report $Name"',
    '}',
    'function Remove-Old { }',
    'function Keep-Same($A) {',
    '  $A   ',
    '}',
    '$x = "# function Fake-Comment { }"',
    'Get-Report -Name one',
  ].join('\r\n');
  const after = [
    '#requires -Version 5.1',
    'function get-report {',
    '  param([string]$Name, [int]$Count = 1)',
    '  "Report $Name" * $Count',
    '}',
    'function Keep-Same($A) {',
    '  $A',
    '}',
    'function New-Thing {',
    '  function Inner-Helper { 1 }',
    '  $ok ? 1 : 2',
    '}',
    '$x = "# function Fake-Comment { }"',
    'Get-Report -Name two',
  ].join('\n');
  const r = compareStructure(before, after, 'Module.psm1');
  assert.equal(r.kind, 'powershell');
  assert.equal(r.same, false);
  assert.deepEqual(r.added.map(f => f.name), ['New-Thing', 'Inner-Helper']);
  assert.deepEqual(r.removed.map(f => f.name), ['Remove-Old']);
  assert.deepEqual(r.changed.map(f => [f.name, f.params.added.join(), f.params.removed.join()]), [['get-report', '$Count', '']]);
  assert.equal(r.unchanged, 1, 'line endings and trailing spaces do not count as a change');
  assert.equal(r.outsideChanged, true, 'the script body changed');
  assert.deepEqual(r.newProblems.map(d => [d.rule, d.line]), [['ps51-ternary', 11]]);
  const same = compareStructure(before, before.replace(/\r\n/g, '\n'), 'Module.psm1');
  assert.equal(same.same, true);
  assert.deepEqual([same.added.length, same.removed.length, same.changed.length, same.outsideChanged], [0, 0, 0, false]);
});

test('a second XAML version is summarized by named controls and resource keys', () => {
  const r = compareStructure('<Grid><Button x:Name="Save"/><SolidColorBrush x:Key="Accent"/></Grid>',
    '<Grid><Button x:Name="Save"/><TextBox x:Name="Search"/></Grid>', 'Form.xaml');
  assert.equal(r.kind, 'xaml');
  assert.deepEqual([r.controls.added, r.controls.removed, r.resources.added, r.resources.removed].map(x => x.join()), ['Search', '', '', 'Accent']);
});
