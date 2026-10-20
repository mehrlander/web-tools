[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1') -Publish
$desktopSource = Join-Path $PSScriptRoot 'output\app'
$desktopDestination = Join-Path $env:LOCALAPPDATA 'Programs\WebToolsDesktop'
if (Get-Process -Name 'WebTools.Desktop' -ErrorAction SilentlyContinue) {
    throw 'Close Web Tools Desktop before installing the new build.'
}
New-Item -ItemType Directory -Path $desktopDestination -Force | Out-Null
Get-ChildItem -LiteralPath $desktopSource | Copy-Item -Destination $desktopDestination -Recurse -Force
$desktopExe = Join-Path $desktopDestination 'WebTools.Desktop.exe'
$desktopShell = New-Object -ComObject WScript.Shell
foreach ($desktopShortcutFolder in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {
    $desktopShortcut = $desktopShell.CreateShortcut((Join-Path $desktopShortcutFolder 'Web Tools Desktop.lnk'))
    $desktopShortcut.TargetPath = $desktopExe
    $desktopShortcut.WorkingDirectory = $desktopDestination
    $desktopShortcut.Description = 'Web Tools and activity on this laptop'
    $desktopShortcut.Save()
}
Write-Output "Installed Web Tools Desktop: $desktopExe"
