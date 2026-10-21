[CmdletBinding()]
param([switch]$Publish)
$ErrorActionPreference = 'Stop'
$desktopProject = Join-Path $PSScriptRoot 'App\WebTools.Desktop.csproj'
$companionProject = Join-Path $PSScriptRoot 'Companion\WebTools.Companion.csproj'
if ($Publish) {
    dotnet publish $desktopProject -c Release -r win-x64 --self-contained false -o (Join-Path $PSScriptRoot 'output\app')
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    dotnet publish $companionProject -c Release -r win-x64 --self-contained false -o (Join-Path $PSScriptRoot 'output\app\companion')
} else {
    dotnet build $desktopProject -c Release
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    dotnet build $companionProject -c Release
}
if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
