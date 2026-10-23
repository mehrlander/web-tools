[CmdletBinding()]
param([switch]$Laptop)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1')
$desktopExe = Join-Path $PSScriptRoot 'App\bin\Release\net8.0-windows\WebTools.Desktop.exe'
$desktopArguments = if ($Laptop) { @('--laptop') } else { @() }
if ($desktopArguments.Count) { Start-Process -FilePath $desktopExe -ArgumentList $desktopArguments }
else { Start-Process -FilePath $desktopExe }
