[CmdletBinding()]
param([string]$PublishedPackageRoot)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot '../package-info.ps1')
$script:checks = 0
function Check([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
    $script:checks++
}
function Throws([scriptblock]$Action, [string]$Pattern, [string]$Message) {
    try { & $Action | Out-Null }
    catch { Check ($_.Exception.Message -match $Pattern) $Message; return }
    throw $Message
}
$fixtureRoot = Join-Path $PSScriptRoot ('.package-fixtures-' + [guid]::NewGuid().ToString('N').Substring(0,12))
$null = New-Item -ItemType Directory -Path $fixtureRoot
$commit = '0123456789abcdef0123456789abcdef01234567'
function Put([string]$Path, [string]$Text) {
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force
    [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
}
function Package([string]$Name, [bool]$Usage) {
    $root = Join-Path $fixtureRoot $Name
    Put (Join-Path $root 'WebTools.Desktop.exe') 'fixture desktop apphost, never executed'
    Put (Join-Path $root 'companion/WebTools.Companion.exe') 'unchanged fixture companion apphost, never executed'
    Put (Join-Path $root 'companion/WebTools.Companion.dll') ('fixture companion implementation ' + $Name)
    Put (Join-Path $root 'companion/phone/views.js') "const interfaceVersion = '26';"
    $html = '<button data-view="now">Now</button>'
    if ($Usage) { $html += '<button data-view="usage">Usage</button><script src="/phone-usage.js"></script><link rel="stylesheet" href="/phone-usage.css"><script src="/usage-view.js"></script><script src="/recent-usage.js"></script>' }
    Put (Join-Path $root 'companion/phone/index.html') $html
    foreach ($asset in @('phone-usage.js', 'phone-usage.css', 'usage-view.js', 'recent-usage.js')) { Put (Join-Path $root ('companion/phone/' + $asset)) 'fixture Usage asset' }
    return $root
}
function Stamp([string]$Root, [bool]$Dirty = $false) { return Write-WebToolsBuildInfo -PackageRoot $Root -SourceCommit $commit -SourceDirty $Dirty }
try {
    $usage = Package 'usage' $true
    $state = Stamp $usage $true
    Check ($state.Valid -and $state.SourceCommit -ceq $commit -and $state.InterfaceVersion -ceq '26' -and $state.SourceDirty -eq $true -and $state.UsageInterface -eq $true) 'A complete Usage package records its source and interface identity.'
    $json = Get-Content -LiteralPath (Join-Path $usage 'build-info.json') -Raw | ConvertFrom-Json
    Check (($json.PSObject.Properties.Name | Sort-Object) -join ',' -ceq 'companionSha256,interfaceVersion,schemaVersion,sourceCommit,sourceDirty,usageInterface') 'The stamp contains only the six explicit metadata fields.'
    Check ($state.CompanionSha256 -ceq (Get-FileHash -LiteralPath (Join-Path $usage 'companion/WebTools.Companion.dll') -Algorithm SHA256).Hash.ToLowerInvariant()) 'The stamp binds the managed companion DLL rather than its reusable apphost.'
    $missingInstall = Join-Path $fixtureRoot 'not-installed'
    Check ((Assert-WebToolsInstall -CandidateRoot $usage -InstalledRoot $missingInstall).Valid) 'A valid package can install when no previous installation exists.'
    $plain = Package 'plain' $false
    Put (Join-Path $plain 'companion/phone/views.js') 'fixture legacy navigation without an interfaceVersion constant'
    $plainState = Stamp $plain
    Check ($plainState.Valid -and !$plainState.UsagePresent -and !$plainState.UsageInterface -and $plainState.InterfaceVersion -ceq 'unversioned') 'Stale leftover Usage files do not advertise Usage, and a valid legacy no-Usage package is explicitly unversioned.'
    $legacy = Package 'legacy' $true
    Check ((Get-WebToolsPackageState $legacy).UsagePresent -and !(Test-Path -LiteralPath (Join-Path $legacy 'build-info.json'))) 'Installed legacy Usage is recognized without a stamp.'
    Throws { Assert-WebToolsInstall -CandidateRoot $legacy -InstalledRoot $missingInstall -AllowUsageDowngrade } 'build-info.json' 'A candidate without a stamp is invalid even when the downgrade switch is present.'
    $falseClaim = Package 'false-claim' $true
    $null = Stamp $falseClaim
    $falseStamp = Get-Content -LiteralPath (Join-Path $falseClaim 'build-info.json') -Raw | ConvertFrom-Json
    $falseStamp.usageInterface = $false
    Put (Join-Path $falseClaim 'build-info.json') ($falseStamp | ConvertTo-Json)
    Throws { Assert-WebToolsInstall -CandidateRoot $falseClaim -InstalledRoot $legacy -AllowUsageDowngrade } 'Usage interface does not match' 'A capability flag that contradicts active markup is corrupt rather than a valid no-Usage downgrade.'
    $script:sideEffects = 0
    Throws { Assert-WebToolsInstall -CandidateRoot $plain -InstalledRoot $legacy; $script:sideEffects++ } 'AllowUsageDowngrade' 'A legacy Usage downgrade fails before any simulated stop or copy side effect.'
    Check ($script:sideEffects -eq 0) 'A rejected preflight leaves all installation side effects uncalled.'
    Check ((Assert-WebToolsInstall -CandidateRoot $plain -InstalledRoot $legacy -AllowUsageDowngrade).Valid) 'The explicit switch permits a valid intentional Usage downgrade.'
    Check ((Assert-WebToolsInstall -CandidateRoot $usage -InstalledRoot $legacy).Valid) 'Replacing legacy Usage with validated Usage needs no downgrade switch.'
    $partial = Package 'partial' $true
    $null = Stamp $partial
    Put (Join-Path $partial 'companion/phone/index.html') '<button data-view="now">Now</button>'
    $partialState = Get-WebToolsPackageState $partial
    Check (!$partialState.UsagePresent -and $partialState.StampValid -and $partialState.UsageInterface -and !$partialState.Valid) 'The partial-install fixture retains a valid Usage stamp after its index loses Usage.'
    $runtimeMarker = Join-Path $partial 'runtime-state.json'
    Put $runtimeMarker '{"fixtureRuntimeState":"must remain unchanged"}'
    $runtimeBefore = (Get-FileHash -LiteralPath $runtimeMarker -Algorithm SHA256).Hash
    Throws { Assert-WebToolsInstall -CandidateRoot $plain -InstalledRoot $partial } 'AllowUsageDowngrade' 'A structurally valid installed Usage stamp protects a mixed install even when active index markup was overwritten.'
    Check ((Get-FileHash -LiteralPath $runtimeMarker -Algorithm SHA256).Hash -ceq $runtimeBefore) 'Rejecting a downgrade leaves installed runtime state untouched.'
    $apphost = Get-Content -LiteralPath (Join-Path $usage 'companion/WebTools.Companion.exe') -Raw
    Put (Join-Path $usage 'companion/WebTools.Companion.dll') 'older companion implementation without the Usage API'
    Check ((Get-Content -LiteralPath (Join-Path $usage 'companion/WebTools.Companion.exe') -Raw) -ceq $apphost) 'The mixed-binary fixture retains the same executable apphost.'
    Throws { Assert-WebToolsInstall -CandidateRoot $usage -InstalledRoot $legacy -AllowUsageDowngrade } 'DLL does not match' 'An old DLL paired with new Usage metadata is rejected even with the downgrade switch.'
    Put (Join-Path $usage 'companion/WebTools.Companion.dll') 'fixture freshly published companion implementation'
    $null = Stamp $usage
    Put (Join-Path $usage 'companion/phone/views.js') "const interfaceVersion = '27';"
    Throws { Assert-WebToolsInstall -CandidateRoot $usage -InstalledRoot $legacy -AllowUsageDowngrade } 'interface version' 'A post-build interface-version mismatch cannot use the downgrade switch.'
    Put (Join-Path $usage 'companion/phone/views.js') "const interfaceVersion = '26';"
    Remove-Item -LiteralPath (Join-Path $usage 'companion/phone/phone-usage.js')
    Throws { Assert-WebToolsInstall -CandidateRoot $usage -InstalledRoot $legacy -AllowUsageDowngrade } 'phone-usage.js' 'An active Usage package must contain its canonical module.'
    Put (Join-Path $usage 'companion/phone/phone-usage.js') 'fixture Usage asset'
    Put (Join-Path $usage 'companion/phone/index.html') '<button data-view="usage">Usage</button>'
    Throws { Assert-WebToolsInstall -CandidateRoot $usage -InstalledRoot $legacy } 'index reference' 'Unused leftover module files cannot satisfy an active Usage package.'
    $bad = Package 'bad-stamp' $false
    Put (Join-Path $bad 'build-info.json') '{broken'
    Throws { Assert-WebToolsInstall -CandidateRoot $bad -InstalledRoot $legacy -AllowUsageDowngrade } 'build-info.json' 'Malformed stamp JSON is an integrity error rather than an intentional downgrade.'
    $null = Stamp $bad
    $badStamp = Get-Content -LiteralPath (Join-Path $bad 'build-info.json') -Raw | ConvertFrom-Json
    $badStamp.sourceDirty = 'false'
    Put (Join-Path $bad 'build-info.json') ($badStamp | ConvertTo-Json)
    Throws { Assert-WebToolsInstall -CandidateRoot $bad -InstalledRoot $legacy -AllowUsageDowngrade } 'invalid fields' 'Boolean provenance fields must be actual JSON booleans.'
    Throws { Write-WebToolsBuildInfo -PackageRoot $plain -SourceCommit 'not-a-commit' -SourceDirty $false } 'SourceCommit' 'An unknown source revision cannot be stamped as a commit.'
    $marker = '<!-- <button data-view="usage">comment</button> --><script>const example = ''<button data-view="usage">'';</script><template><button data-view="usage"></button></template><button title="data-view=usage" data-view="now">Now</button>'
    Check (!(Get-WebToolsPackageMarkup $marker).UsagePresent) 'Comments, script examples, template content and quoted attribute text are not active Usage markup.'
    Check ((Get-WebToolsPackageMarkup "<button data-view='usage'>Usage</button>").UsagePresent -and (Get-WebToolsPackageMarkup '<button data-view=usage>Usage</button>').UsagePresent) 'Legacy single-quoted and unquoted active Usage attributes remain protected.'
    Check ((Get-WebToolsPackageMarkup '<button data-view="usage" data-view="now">Usage</button>').UsagePresent) 'Duplicate attributes follow the browser first-attribute rule.'
    $fixtureDesktop = Join-Path $fixtureRoot 'desktop'
    $candidateRoot = Join-Path $fixtureDesktop 'output/app'
    $fixtureLocal = Join-Path $fixtureRoot 'local'
    $fixtureInstalled = Join-Path $fixtureLocal 'Programs/WebToolsDesktop'
    $null = New-Item -ItemType Directory -Path $candidateRoot, $fixtureInstalled -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../install.ps1') -Destination (Join-Path $fixtureDesktop 'install.ps1')
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../package-info.ps1') -Destination (Join-Path $fixtureDesktop 'package-info.ps1')
    Put (Join-Path $fixtureDesktop 'build.ps1') 'param([switch]$Publish)'
    Get-ChildItem -LiteralPath $plain | Copy-Item -Destination $candidateRoot -Recurse -Force
    Get-ChildItem -LiteralPath $legacy | Copy-Item -Destination $fixtureInstalled -Recurse -Force
    $installedMarker = Join-Path $fixtureInstalled 'runtime-state.json'
    $installedIndex = Join-Path $fixtureInstalled 'companion/phone/index.html'
    Put $installedMarker '{"fixtureRuntimeState":"installer must not change this"}'
    $markerBefore = (Get-FileHash -LiteralPath $installedMarker -Algorithm SHA256).Hash
    $indexBefore = (Get-FileHash -LiteralPath $installedIndex -Algorithm SHA256).Hash
    $priorLocal = $env:LOCALAPPDATA
    $priorProcess = Get-Item -LiteralPath 'Function:\Get-Process' -ErrorAction SilentlyContinue
    $processProbe = [pscustomobject]@{ Calls = 0 }
    try {
        $env:LOCALAPPDATA = $fixtureLocal
        function Get-Process { [CmdletBinding()]param([string[]]$Name) $processProbe.Calls++; throw 'Fixture installer reached process checks before rejecting the downgrade.' }
        Throws { & (Join-Path $fixtureDesktop 'install.ps1') } 'AllowUsageDowngrade' 'The actual installer invokes downgrade preflight before process inspection or copying.'
        Check ($processProbe.Calls -eq 0 -and (Get-FileHash -LiteralPath $installedMarker -Algorithm SHA256).Hash -ceq $markerBefore -and (Get-FileHash -LiteralPath $installedIndex -Algorithm SHA256).Hash -ceq $indexBefore) 'Rejected installer wiring leaves legacy Usage and runtime state byte-for-byte unchanged.'
    } finally {
        if ($null -ne $priorProcess) { Set-Item -LiteralPath 'Function:\Get-Process' -Value $priorProcess.ScriptBlock }
        else { Remove-Item -LiteralPath 'Function:\Get-Process' -ErrorAction SilentlyContinue }
        if ($null -eq $priorLocal) { Remove-Item -LiteralPath 'Env:\LOCALAPPDATA' -ErrorAction SilentlyContinue }
        else { $env:LOCALAPPDATA = $priorLocal }
    }
} finally {
    $resolvedFixture = [System.IO.Path]::GetFullPath($fixtureRoot)
    $allowedParent = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (!$resolvedFixture.StartsWith($allowedParent, [StringComparison]::OrdinalIgnoreCase) -or !(Split-Path -Leaf $resolvedFixture).StartsWith('.package-fixtures-')) { throw 'Fixture cleanup target is outside the test directory.' }
    if (Test-Path -LiteralPath $resolvedFixture -PathType Container) { Remove-Item -LiteralPath $resolvedFixture -Recurse -Force }
}
if ($PublishedPackageRoot) {
    $published = Get-WebToolsPackageState -PackageRoot $PublishedPackageRoot
    Check $published.Valid 'The published package passes structural, provenance and companion-DLL validation.'
    $repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    $sourceHead = (& git -C $repositoryRoot rev-parse --verify HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $sourceHead -cnotmatch '^[a-f0-9]{40}$') { throw 'Cannot resolve the source checkout commit for published-package validation.' }
    Check ($published.SourceCommit -ceq $sourceHead) 'The published package stamp identifies the current source checkout commit.'
    Check ($published.SourceDirty -eq $false) 'The published CI package was built from a clean source checkout.'
}
Write-Output "$script:checks package preflight checks passed."
