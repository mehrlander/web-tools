// tools/test/powershell-ide.test.mjs — tests for lib/kits/powershell-ide.js.
// Exercises AST symbol extraction, parameter resolution, dot-source detection,
// XAML control extraction and cross-referencing, no-direct-sync transfer commands,
// and syntax highlighting.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const bundleSource = readFileSync(path.join(repoRoot, 'lib/vanilla-bundle.js'), 'utf8');
const kitSource = readFileSync(path.join(repoRoot, 'lib/kits/powershell-ide.js'), 'utf8');
const scope = { window: {} };
new Function('window', bundleSource)(scope.window);
new Function('window', kitSource)(scope.window);
const IDE = scope.window.PowerShellIde;

test('parseScript extracts functions, parameters, synopsis and dot-sources', () => {
  const psCode = `
# @file app/Modules/Data/Data.psm1
<#
.SYNOPSIS
    Data transformation utilities for PowerShell.
#>

function Get-CustomReport {
    <#
    .SYNOPSIS
        Generates custom reports from input data.
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [int]$Limit = 50
    )
    Write-Output $Path
}

filter Out-Filtered {
    param([switch]$Verbose)
    $_
}

. $PSScriptRoot\\Companions\\Helper.ps1
Import-Module Forms -Force
Add-Type -AssemblyName PresentationFramework

$btnSearch.Add_Click({
    Get-CustomReport -Path "C:\\Temp"
})
`;

  const ast = IDE.parseScript(psCode);

  assert.equal(ast.declaredFile, 'app/Modules/Data/Data.psm1');
  assert.equal(ast.fileSynopsis, 'Data transformation utilities for PowerShell.');
  assert.equal(ast.functions.length, 2);

  const fn1 = ast.functions[0];
  assert.equal(fn1.name, 'Get-CustomReport');
  assert.equal(fn1.kind, 'function');
  assert.equal(fn1.isExported, true);
  assert.equal(fn1.synopsis, 'Generates custom reports from input data.');
  assert.equal(fn1.params.length, 2);
  assert.equal(fn1.params[0].name, 'Path');
  assert.equal(fn1.params[0].type, 'string');
  assert.equal(fn1.params[1].name, 'Limit');
  assert.equal(fn1.params[1].type, 'int');
  assert.equal(fn1.params[1].defaultValue, '50');

  const fn2 = ast.functions[1];
  assert.equal(fn2.name, 'Out-Filtered');
  assert.equal(fn2.kind, 'filter');
  assert.equal(fn2.params[0].name, 'Verbose');
  assert.equal(fn2.params[0].type, 'switch');

  assert.equal(ast.dotSources.length, 1);
  assert.equal(ast.dotSources[0].resolved, 'Companions/Helper.ps1');

  assert.equal(ast.imports.length, 1);
  assert.equal(ast.imports[0].module, 'Forms');

  assert.equal(ast.assemblies.length, 1);
  assert.equal(ast.assemblies[0].name, 'PresentationFramework');

  assert.equal(ast.eventHandlers.length, 1);
  assert.equal(ast.eventHandlers[0].control, 'btnSearch');
  assert.equal(ast.eventHandlers[0].event, 'Click');
});

test('parseXaml extracts named controls, types, dynamic resources and event bindings', () => {
  const xaml = `
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Search Form" Height="400" Width="600"
        Background="{DynamicResource BackgroundBrush}">
    <Grid>
        <TextBox x:Name="SearchBox" ToolTip="Enter query" Margin="10"/>
        <Button Name="btnSubmit" Content="Search" Click="btnSubmit_Click"/>
        <DataGrid x:Name="ResultGrid" Foreground="{DynamicResource ForegroundBrush}"/>
        <Border BorderBrush="{StaticResource BorderColor}"/>
    </Grid>
</Window>
`;

  const info = IDE.parseXaml(xaml);

  assert.equal(info.rootTag, 'Window');
  assert.equal(info.controls.length, 3);
  assert.deepEqual(info.controls.map(c => c.name), ['SearchBox', 'btnSubmit', 'ResultGrid']);
  assert.deepEqual(info.controls.map(c => c.tag), ['TextBox', 'Button', 'DataGrid']);
  assert.equal(info.controls[0].label, 'Enter query');
  assert.equal(info.controls[1].label, 'Search');

  assert.deepEqual(info.dynamicResources, ['BackgroundBrush', 'ForegroundBrush']);
  assert.deepEqual(info.staticResources, ['BorderColor']);
  assert.equal(info.eventAttributes.length, 1);
  assert.equal(info.eventAttributes[0].event, 'Click');
  assert.equal(info.eventAttributes[0].handler, 'btnSubmit_Click');
});

test('crossReference correlates XAML controls with controller code', () => {
  const xamlInfo = {
    controls: [
      { name: 'SearchBox', tag: 'TextBox', line: 5 },
      { name: 'btnSubmit', tag: 'Button', line: 6 },
      { name: 'StatusLabel', tag: 'TextBlock', line: 7 }
    ],
    dynamicResources: ['BackgroundBrush', 'ForegroundBrush'],
    staticResources: []
  };

  const psInfo = {
    referencedControls: ['SearchBox', 'btnSubmit', 'extraControl'],
    variables: ['SearchBox', 'btnSubmit', 'window'],
    eventHandlers: [
      { control: 'btnSubmit', event: 'Click', line: 12 },
      { control: 'SearchBox', event: 'TextChanged', line: 18 }
    ]
  };

  const cross = IDE.crossReference(xamlInfo, psInfo);

  assert.equal(cross.wired.length, 2);
  assert.deepEqual(cross.wired.map(w => w.name), ['SearchBox', 'btnSubmit']);
  assert.deepEqual(cross.wired[0].events, ['TextChanged']);
  assert.deepEqual(cross.wired[1].events, ['Click']);

  assert.equal(cross.unwired.length, 1);
  assert.equal(cross.unwired[0].name, 'StatusLabel');

  assert.equal(cross.unmapped.length, 1);
  assert.equal(cross.unmapped[0], 'extraControl');

  assert.equal(cross.themeResourceCount, 2);
  assert.equal(cross.isFullyThemed, true);
});

test('generateTransferHelper generates valid PowerShell commands and snippets', () => {
  const item = {
    path: 'app/Modules/Bookmarks/Bookmarks.psm1',
    name: 'Bookmarks.psm1',
    installs: 'Modules/Bookmarks/Bookmarks.psm1'
  };
  const text = 'function Get-Bookmark { param($id) }';

  const helper = IDE.generateTransferHelper(item, text);

  assert.match(helper.winPath, /Documents\\WindowsPowerShell\\Modules\\Bookmarks\\Bookmarks\.psm1/);
  assert.match(helper.verifyCmd, /Get-FileHash -Path "\$HOME\\Documents\\WindowsPowerShell\\Modules\\Bookmarks\\Bookmarks\.psm1" -Algorithm SHA256/);
  assert.match(helper.installCmd, /Set-Content -LiteralPath \$dest/);
  assert.match(helper.installCmd, /Get-Bookmark/);
  assert.match(helper.headerSnippet, /^# @file app\/Modules\/Bookmarks\/Bookmarks\.psm1\nfunction Get-Bookmark/);
});

test('highlightPowerShell and highlightXaml render formatted lines with line numbers', () => {
  const ps = 'function Test-Fn { $val = "hello"; # comment\nreturn $val }';
  const htmlPs = IDE.highlightPowerShell(ps);

  assert.match(htmlPs, /id="ps-L1"/);
  assert.match(htmlPs, /id="ps-L2"/);
  assert.match(htmlPs, /text-error font-bold/); // function keyword
  assert.match(htmlPs, /text-info font-medium/); // Test-Fn cmdlet
  assert.match(htmlPs, /text-primary font-semibold/); // $val
  assert.match(htmlPs, /text-success font-medium/); // "hello"
  assert.match(htmlPs, /text-base-content\/40 italic/); // # comment

  const xaml = '<Window x:Name="MainWin" Background="{DynamicResource BgBrush}">\n</Window>';
  const htmlXaml = IDE.highlightXaml(xaml);

  assert.match(htmlXaml, /id="xaml-L1"/);
  assert.match(htmlXaml, /&lt;<span class="text-primary font-bold">Window<\/span>/);
  assert.match(htmlXaml, /badge-info font-mono/); // DynamicResource badge
});

test('SNIPPETS provides curated patterns from the PowerShell GUI Cookbook', () => {
  assert.ok(Array.isArray(IDE.SNIPPETS));
  assert.ok(IDE.SNIPPETS.length >= 7);

  const ids = IDE.SNIPPETS.map(s => s.id);
  assert.ok(ids.includes('wpf-theme'));
  assert.ok(ids.includes('browser-silent'));
  assert.ok(ids.includes('runspace-threading'));
  assert.ok(ids.includes('group-serialized'));
  assert.ok(ids.includes('comment-help'));
  assert.ok(ids.includes('ise-ast-profile'));
  assert.ok(ids.includes('form-f1-navigation'));

  const f1 = IDE.SNIPPETS.find(s => s.id === 'form-f1-navigation');
  assert.match(f1.code, /Register-FormHelpNavigation/);
  assert.match(f1.code, /\[System\.Windows\.Input\.Key\]::F1/);
});

test('validatePs51Compatibility flags PowerShell 7+ syntax incompatible with Windows PowerShell 5.1', () => {
  const codeWithTernary = '$status = $count -gt 0 ? "active" : "inactive"';
  const issues1 = IDE.validatePs51Compatibility(codeWithTernary);
  assert.equal(issues1.length, 1);
  assert.equal(issues1[0].rule, 'ternary-operator');
  assert.match(issues1[0].message, /PowerShell 7\+/);

  const codeWithNullCoalesce = '$name = $inputName ?? "default"';
  const issues2 = IDE.validatePs51Compatibility(codeWithNullCoalesce);
  assert.equal(issues2.length, 1);
  assert.equal(issues2[0].rule, 'null-coalescing');

  const codeWithNullCoalesceAssign = '$config ??= Get-DefaultConfig';
  const issues3 = IDE.validatePs51Compatibility(codeWithNullCoalesceAssign);
  assert.equal(issues3.length, 1);
  assert.equal(issues3[0].rule, 'null-coalescing-assignment');

  const codeWithChains = 'git pull && npm test || exit 1';
  const issues4 = IDE.validatePs51Compatibility(codeWithChains);
  assert.equal(issues4.length, 2);
  assert.equal(issues4[0].rule, 'pipeline-chain');
  assert.equal(issues4[1].rule, 'pipeline-chain');
});

test('validatePs51Compatibility passes valid Windows PowerShell 5.1 syntax without false positives', () => {
  const cleanCode = `
    # Comment mentioning $a ? $b : $c and ?? and &&
    <#
      Block comment with ? : and ||
    #>
    Get-Process | ? { $_.CPU -gt 10 }
    Get-Service | ? Status -eq 'Running'
    $envPath = $env:PATH
    $result = [System.Math]::Round(3.1415, 2)
    $msg = "Is it done? : Yes it is"
    $hereString = @"
      $a ? $b : $c
"@
    if ($x -gt 0 -and $y -lt 10) {
      Write-Host "All good"
    }
  `;

  const issues = IDE.validatePs51Compatibility(cleanCode);
  assert.deepEqual(issues, []);
});

test('extractSha256 extracts 64-character hex strings from raw hashes and Get-FileHash output', () => {
  const rawHash = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';
  assert.equal(IDE.extractSha256(rawHash), rawHash);

  const getFileHashOutput = `
Algorithm       Hash                                                                   Path
---------       ----                                                                   ----
SHA256          5C4927902BA66AC1BE49B609E7B35AE71CEB0DF9A314B929B96985FF3342DE54     C:\\Profile.ps1
`;
  assert.equal(
    IDE.extractSha256(getFileHashOutput),
    '5c4927902ba66ac1be49b609e7b35ae71ceb0df9a314b929b96985ff3342de54'
  );

  assert.equal(IDE.extractSha256('no hash here'), null);
  assert.equal(IDE.extractSha256(''), null);
});

test('stripComments removes single-line and block comments while preserving strings and semantics', () => {
  const script = `
<#
.SYNOPSIS
    Help block
#>
function Test-Succinct {
    # Line comment here
    param($Param1 = "hello # not a comment")
    $here = @'
line 1 # not comment
'@
    Write-Host "Done" # inline comment
}
`;

  const succinct = IDE.stripComments(script);
  assert.ok(!succinct.includes('.SYNOPSIS'));
  assert.ok(!succinct.includes('# Line comment here'));
  assert.ok(!succinct.includes('# inline comment'));
  assert.ok(succinct.includes('param($Param1 = "hello # not a comment")'));
  assert.ok(succinct.includes("line 1 # not comment"));
  assert.ok(succinct.includes('Write-Host "Done"'));
});
