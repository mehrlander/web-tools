# Read-only discovery. Does not instantiate COM, start Excel, install packages,
# read workbook contents, or alter application settings.
[CmdletBinding()]
param([string]$PythonExe)

$ErrorActionPreference = 'Stop'
$probeErrors = [System.Collections.Generic.List[string]]::new()
$excelPaths = [System.Collections.Generic.List[object]]::new()
foreach ($key in @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\excel.exe',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\excel.exe',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\excel.exe'
)) {
    try {
        if (Test-Path -LiteralPath $key) {
            $registered = (Get-ItemProperty -LiteralPath $key).'(default)'
            if ($registered) {
                $exePath = $registered.Trim('"')
                $exists = Test-Path -LiteralPath $exePath -PathType Leaf
                $version = if ($exists) { (Get-Item -LiteralPath $exePath).VersionInfo.FileVersion } else { $null }
                $excelPaths.Add([ordered]@{ registryKey = $key; path = $exePath; exists = $exists; fileVersion = $version })
            }
        }
    } catch { $probeErrors.Add("Excel registration: $($_.Exception.Message)") }
}

$comRegistered = $null
try { $comRegistered = $null -ne [Type]::GetTypeFromProgID('Excel.Application') }
catch { $probeErrors.Add("COM registration lookup: $($_.Exception.Message)") }

$importExcelModules = @()
try {
    $importExcelModules = @(Get-Module -ListAvailable -Name ImportExcel | ForEach-Object {
        [ordered]@{ name = $_.Name; version = $_.Version.ToString(); path = $_.Path }
    })
} catch { $probeErrors.Add("ImportExcel discovery: $($_.Exception.Message)") }

$commands = @()
foreach ($commandName in @('powershell.exe', 'pwsh.exe', 'python.exe', 'py.exe')) {
    $command = Get-Command -Name $commandName -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { $commands += [ordered]@{ name = $commandName; path = $command.Source } }
}

$pythonProbe = [ordered]@{ inspected = $false; executable = $null; packages = $null }
if ($PythonExe) {
    try {
        $pythonItem = Get-Item -LiteralPath $PythonExe
        if ($pythonItem.PSIsContainer) { throw 'PythonExe must be an executable file.' }
        $probeCode = @'
import importlib.util, importlib.metadata, json, sys
packages = {}
for module, distribution in [('openpyxl', 'openpyxl'), ('xlsxwriter', 'XlsxWriter'), ('win32com', 'pywin32'), ('xlwings', 'xlwings')]:
    found = importlib.util.find_spec(module) is not None
    version = None
    if found:
        try:
            version = importlib.metadata.version(distribution)
        except importlib.metadata.PackageNotFoundError:
            pass
    packages[module] = {'discoverable': found, 'version': version}
print(json.dumps({'inspected': True, 'executable': sys.executable, 'packages': packages}))
'@
        $pythonText = & $pythonItem.FullName -c $probeCode
        if ($LASTEXITCODE -ne 0) { throw "Python probe exited with code $LASTEXITCODE" }
        $pythonProbe = ($pythonText -join "`n") | ConvertFrom-Json
    } catch { $probeErrors.Add("Python discovery: $($_.Exception.Message)") }
}

[ordered]@{
    capturedUtc = [DateTime]::UtcNow.ToString('o')
    powershell = [ordered]@{ version = $PSVersionTable.PSVersion.ToString(); edition = $PSVersionTable.PSEdition; apartment = [Threading.Thread]::CurrentThread.ApartmentState.ToString() }
    excel = [ordered]@{ registrations = @($excelPaths.ToArray()); comRegistered = $comRegistered; nativeSessionTested = $false }
    importExcel = $importExcelModules
    commands = $commands
    python = $pythonProbe
    discoveryErrors = @($probeErrors.ToArray())
} | ConvertTo-Json -Depth 7
