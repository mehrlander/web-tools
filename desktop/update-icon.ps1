[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
# The SVG owns the artwork. Inkscape is needed only when regenerating the ICO.
$desktopIconRenderer = Get-Command inkscape -ErrorAction Stop
$desktopIconSvg = Join-Path $PSScriptRoot '..\lib\favicon.svg'
$desktopIconOutput = Join-Path $PSScriptRoot 'output\icons'
$desktopIconAssets = Join-Path $PSScriptRoot 'App\Assets'
New-Item -ItemType Directory -Path $desktopIconOutput, $desktopIconAssets -Force | Out-Null
$desktopIconSizes = @(256, 128, 64, 48, 32, 24, 16)
$desktopIconFrames = foreach ($desktopIconSize in $desktopIconSizes) {
    $desktopIconPng = Join-Path $desktopIconOutput "$desktopIconSize.png"
    & $desktopIconRenderer.Source $desktopIconSvg --export-type=png --export-area-page "--export-filename=$desktopIconPng" "--export-width=$desktopIconSize" "--export-height=$desktopIconSize"
    if ($LASTEXITCODE -ne 0) { throw 'SVG icon rendering failed.' }
    ,([IO.File]::ReadAllBytes($desktopIconPng))
}
$desktopIconPath = Join-Path $desktopIconAssets 'WebTools.ico'
$desktopIconWriter = [IO.BinaryWriter]::new([IO.File]::Create($desktopIconPath))
try {
    $desktopIconWriter.Write([uint16]0)
    $desktopIconWriter.Write([uint16]1)
    $desktopIconWriter.Write([uint16]$desktopIconSizes.Count)
    $desktopIconOffset = 6 + 16 * $desktopIconSizes.Count
    for ($desktopIconIndex = 0; $desktopIconIndex -lt $desktopIconSizes.Count; $desktopIconIndex++) {
        $desktopIconDimension = [byte]($desktopIconSizes[$desktopIconIndex] % 256)
        $desktopIconWriter.Write($desktopIconDimension)
        $desktopIconWriter.Write($desktopIconDimension)
        $desktopIconWriter.Write([uint16]0)
        $desktopIconWriter.Write([uint16]1)
        $desktopIconWriter.Write([uint16]32)
        $desktopIconWriter.Write([uint32]$desktopIconFrames[$desktopIconIndex].Length)
        $desktopIconWriter.Write([uint32]$desktopIconOffset)
        $desktopIconOffset += $desktopIconFrames[$desktopIconIndex].Length
    }
    foreach ($desktopIconFrame in $desktopIconFrames) { $desktopIconWriter.Write([byte[]]$desktopIconFrame) }
} finally { $desktopIconWriter.Dispose() }
Write-Output "Updated Windows icon from lib/favicon.svg: $desktopIconPath"
