[CmdletBinding()]
param([switch]$CompanionStartup)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1') -Publish
$desktopSource = Join-Path $PSScriptRoot 'output\app'
$desktopDestination = Join-Path $env:LOCALAPPDATA 'Programs\WebToolsDesktop'
if (Get-Process -Name 'WebTools.Desktop' -ErrorAction SilentlyContinue) {
    throw 'Close Web Tools Desktop before installing the new build.'
}
if (Get-Process -Name 'WebTools.Companion' -ErrorAction SilentlyContinue) {
    throw 'Close the Web Tools companion before installing the new build.'
}
New-Item -ItemType Directory -Path $desktopDestination -Force | Out-Null
Get-ChildItem -LiteralPath $desktopSource | Copy-Item -Destination $desktopDestination -Recurse -Force
$desktopExe = Join-Path $desktopDestination 'WebTools.Desktop.exe'
$desktopShell = New-Object -ComObject WScript.Shell
foreach ($desktopShortcutFolder in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {
    $desktopShortcut = $desktopShell.CreateShortcut((Join-Path $desktopShortcutFolder 'Web Tools Desktop.lnk'))
    $desktopShortcut.TargetPath = $desktopExe
    $desktopShortcut.IconLocation = "$desktopExe,0"
    $desktopShortcut.WorkingDirectory = $desktopDestination
    $desktopShortcut.Description = 'Web Tools and activity on this laptop'
    $desktopShortcut.Save()
}
Write-Output "Installed Web Tools Desktop: $desktopExe"
if ($CompanionStartup) {
    $companionShortcut = $desktopShell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'Web Tools Companion.lnk'))
    $companionShortcut.TargetPath = Join-Path $desktopDestination 'companion\WebTools.Companion.exe'
    $companionShortcut.WorkingDirectory = Join-Path $desktopDestination 'companion'
    $companionShortcut.WindowStyle = 7
    $companionShortcut.Description = 'Activity collection for Web Tools Desktop and the private phone view'
    $companionShortcut.Save()
}
