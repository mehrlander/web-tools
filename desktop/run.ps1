[CmdletBinding()]
param(
    [Alias('Laptop')]
    [switch]$Lenovo
)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1')
$desktopExe = Join-Path $PSScriptRoot 'App\bin\Release\net8.0-windows\WebTools.Desktop.exe'
$desktopArguments = if ($Lenovo) { @('--lenovo') } else { @() }
if ($desktopArguments.Count) { Start-Process -FilePath $desktopExe -ArgumentList $desktopArguments }
else { Start-Process -FilePath $desktopExe }
