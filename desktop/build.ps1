[CmdletBinding()]
param([switch]$Publish)
$ErrorActionPreference = 'Stop'
$desktopProject = Join-Path $PSScriptRoot 'App\WebTools.Desktop.csproj'
if ($Publish) {
    dotnet publish $desktopProject -c Release -r win-x64 --self-contained false -o (Join-Path $PSScriptRoot 'output\app')
} else {
    dotnet build $desktopProject -c Release
}
if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
