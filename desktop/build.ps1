[CmdletBinding()]
param([switch]$Publish)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'package-info.ps1')
$desktopProject = Join-Path $PSScriptRoot 'App\WebTools.Desktop.csproj'
$companionProject = Join-Path $PSScriptRoot 'Companion\WebTools.Companion.csproj'
$desktopPublishRoot = Join-Path $PSScriptRoot 'output\app'
if ($Publish) {
    $desktopBuildStamp = Join-Path $desktopPublishRoot 'build-info.json'
    if (Test-Path -LiteralPath $desktopBuildStamp -PathType Leaf) { Remove-Item -LiteralPath $desktopBuildStamp -Force }
    dotnet publish $desktopProject -c Release -r win-x64 --self-contained false -o $desktopPublishRoot
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    dotnet publish $companionProject -c Release -r win-x64 --self-contained false -o (Join-Path $PSScriptRoot 'output\app\companion')
} else {
    dotnet build $desktopProject -c Release
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    dotnet build $companionProject -c Release
}
if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
if ($Publish) {
    $desktopRepository = Split-Path -Parent $PSScriptRoot
    $desktopRevision = & git -C $desktopRepository rev-parse --verify HEAD
    if ($LASTEXITCODE -ne 0 -or $desktopRevision -notmatch '^[a-fA-F0-9]{40}$') { throw 'Cannot identify the published source commit.' }
    $desktopSourceChanges = @(& git -C $desktopRepository status --porcelain --untracked-files=normal)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot determine whether the published source has local changes.' }
    $desktopPackage = Write-WebToolsBuildInfo -PackageRoot $desktopPublishRoot -SourceCommit $desktopRevision -SourceDirty ($desktopSourceChanges.Count -gt 0)
    if (!$desktopPackage.Valid) { throw ('The published package failed validation. ' + ($desktopPackage.Errors -join ' ')) }
}
