# Package metadata and preflight only. These helpers never start or stop a process.
function Get-WebToolsPackageProperty {
    param($Value, [string]$Name)
    if ($null -ne $Value) {
        $property = $Value.PSObject.Properties[$Name]
        if ($null -ne $property) { return $property.Value }
    }
    return $null
}

function Get-WebToolsPackageMarkup {
    param([string]$Html)
    $clean = [regex]::Replace($Html, '(?is)<!--.*?-->|<template\b[^>]*>.*?</template\s*>', '')
    $clean = [regex]::Replace($clean, '(?is)(<(?:script|style)\b[^>]*>).*?(</(?:script|style)\s*>)', '$1$2')
    $tagPattern = @'
(?is)<(?<tag>[a-z][a-z0-9:-]*)\b(?<attributes>(?:[^"'<>]|"[^"]*"|'[^']*')*)>
'@
    $attributePattern = @'
(?is)(?:^|\s)(?<name>[^\s"'<>/=]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'=<>`]+)))?
'@
    $usage = $false
    $scripts = @()
    $styles = @()
    foreach ($tag in [regex]::Matches($clean, $tagPattern)) {
        $attributes = @{}
        foreach ($attribute in [regex]::Matches($tag.Groups['attributes'].Value, $attributePattern)) {
            $name = $attribute.Groups['name'].Value.ToLowerInvariant()
            if ($attributes.ContainsKey($name)) { continue }
            $value = ''
            foreach ($kind in @('double', 'single', 'bare')) {
                if ($attribute.Groups[$kind].Success) { $value = $attribute.Groups[$kind].Value; break }
            }
            $attributes[$name] = $value
        }
        if ($attributes['data-view'] -ceq 'usage') { $usage = $true }
        if ($tag.Groups['tag'].Value -ieq 'script' -and $attributes['src']) { $scripts += $attributes['src'] }
        if ($tag.Groups['tag'].Value -ieq 'link' -and $attributes['rel'] -ieq 'stylesheet' -and $attributes['href']) { $styles += $attributes['href'] }
    }
    return [pscustomobject]@{ UsagePresent = $usage; Scripts = $scripts; Styles = $styles }
}

function Get-WebToolsPackageState {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$PackageRoot)
    $coreErrors = [System.Collections.Generic.List[string]]::new()
    $errors = [System.Collections.Generic.List[string]]::new()
    foreach ($file in @('WebTools.Desktop.exe', 'companion/WebTools.Companion.exe', 'companion/WebTools.Companion.dll', 'companion/phone/index.html', 'companion/phone/views.js')) {
        $path = Join-Path $PackageRoot $file
        if (!(Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -eq 0) { $coreErrors.Add("Missing package file: $file") }
    }
    $markup = [pscustomobject]@{ UsagePresent = $false; Scripts = @(); Styles = @() }
    try { $markup = Get-WebToolsPackageMarkup (Get-Content -LiteralPath (Join-Path $PackageRoot 'companion/phone/index.html') -Raw -ErrorAction Stop) }
    catch { $coreErrors.Add('Cannot read the packaged phone index.') }
    $actualVersion = $null
    try {
        $views = Get-Content -LiteralPath (Join-Path $PackageRoot 'companion/phone/views.js') -Raw -ErrorAction Stop
        $versionMatches = [regex]::Matches($views, '\bconst\s+interfaceVersion\s*=\s*([''"])(?<version>[A-Za-z0-9_.-]{1,64})\1')
        if ($versionMatches.Count -eq 1) { $actualVersion = $versionMatches[0].Groups['version'].Value }
    } catch { }
    if (!$actualVersion -and !$markup.UsagePresent) { $actualVersion = 'unversioned' }
    if (!$actualVersion) { $coreErrors.Add('The packaged interface version is unavailable.') }
    $usageAssetsValid = $true
    if ($markup.UsagePresent) {
        foreach ($asset in @('phone-usage.js', 'phone-usage.css', 'usage-view.js', 'recent-usage.js')) {
            $path = Join-Path $PackageRoot ('companion/phone/' + $asset)
            $references = if ($asset.EndsWith('.css')) { $markup.Styles } else { $markup.Scripts }
            if (!(Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -eq 0 -or !($references -ccontains ('/' + $asset) -or $references -ccontains $asset)) {
                $usageAssetsValid = $false
                $coreErrors.Add("The active Usage interface is missing its packaged asset or index reference: $asset")
            }
        }
    }
    $hash = $null
    try { $hash = (Get-FileHash -LiteralPath (Join-Path $PackageRoot 'companion/WebTools.Companion.dll') -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() }
    catch { $coreErrors.Add('Cannot hash the packaged companion DLL.') }
    $stamp = $null
    try { $stamp = Get-Content -LiteralPath (Join-Path $PackageRoot 'build-info.json') -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop }
    catch { $errors.Add('The package build-info.json is missing or malformed.') }
    $schema = Get-WebToolsPackageProperty $stamp 'schemaVersion'
    $commit = Get-WebToolsPackageProperty $stamp 'sourceCommit'
    $version = Get-WebToolsPackageProperty $stamp 'interfaceVersion'
    $dirty = Get-WebToolsPackageProperty $stamp 'sourceDirty'
    $usage = Get-WebToolsPackageProperty $stamp 'usageInterface'
    $expectedHash = Get-WebToolsPackageProperty $stamp 'companionSha256'
    $stampValid = $stamp -is [pscustomobject] -and ($schema -is [int] -or $schema -is [long]) -and $schema -eq 1 `
        -and $commit -is [string] -and $commit -cmatch '^[a-f0-9]{40}$' `
        -and $version -is [string] -and $version -cmatch '^[A-Za-z0-9_.-]{1,64}$' `
        -and $dirty -is [bool] -and $usage -is [bool] `
        -and $expectedHash -is [string] -and $expectedHash -cmatch '^[a-f0-9]{64}$'
    if (!$stampValid -and $null -ne $stamp) { $errors.Add('The package build stamp has invalid fields.') }
    $hashMatches = $stampValid -and $null -ne $hash -and $hash -ceq $expectedHash
    if ($stampValid) {
        if (!$hashMatches) { $errors.Add('The companion DLL does not match the package build stamp.') }
        if ($version -cne $actualVersion) { $errors.Add('The packaged interface version does not match the build stamp.') }
        if ($usage -ne $markup.UsagePresent) { $errors.Add('The active Usage interface does not match the build stamp.') }
    }
    foreach ($errorText in $coreErrors) { $errors.Add($errorText) }
    return [pscustomobject]@{
        Valid = $stampValid -and $errors.Count -eq 0
        CoreValid = $coreErrors.Count -eq 0
        UsagePresent = [bool]$markup.UsagePresent
        UsageAssetsValid = $usageAssetsValid
        StampValid = [bool]$stampValid
        CompanionHashMatches = [bool]$hashMatches
        SourceCommit = $(if ($stampValid) { $commit } else { $null })
        InterfaceVersion = $actualVersion
        SourceDirty = $(if ($stampValid) { $dirty } else { $null })
        UsageInterface = $(if ($stampValid) { $usage } else { $null })
        CompanionSha256 = $hash
        Errors = [string[]]$errors.ToArray()
        CoreErrors = [string[]]$coreErrors.ToArray()
    }
}

function Write-WebToolsBuildInfo {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PackageRoot,
        [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$SourceCommit,
        [Parameter(Mandatory)][bool]$SourceDirty
    )
    # The build caller invokes this only after BOTH publish commands succeeded.
    $state = Get-WebToolsPackageState -PackageRoot $PackageRoot
    if (!$state.CoreValid) { throw ('Cannot stamp an incomplete published package. ' + ($state.CoreErrors -join ' ')) }
    $stamp = [ordered]@{
        schemaVersion = 1
        sourceCommit = $SourceCommit.ToLowerInvariant()
        interfaceVersion = $state.InterfaceVersion
        sourceDirty = $SourceDirty
        usageInterface = $state.UsagePresent
        companionSha256 = $state.CompanionSha256
    }
    $target = Join-Path $PackageRoot 'build-info.json'
    $temporary = Join-Path $PackageRoot ('build-info.json.tmp-' + [guid]::NewGuid().ToString('N'))
    try {
        [System.IO.File]::WriteAllText($temporary, ($stamp | ConvertTo-Json) + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporary -Destination $target -Force -ErrorAction Stop
    } finally {
        if (Test-Path -LiteralPath $temporary -PathType Leaf) { Remove-Item -LiteralPath $temporary -Force }
    }
    return Get-WebToolsPackageState -PackageRoot $PackageRoot
}

function Assert-WebToolsInstall {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$CandidateRoot,
        [Parameter(Mandatory)][string]$InstalledRoot,
        [switch]$AllowUsageDowngrade
    )
    $candidate = Get-WebToolsPackageState -PackageRoot $CandidateRoot
    if (!$candidate.Valid) { throw ('The candidate package failed preflight. ' + ($candidate.Errors -join ' ')) }
    $installed = Get-WebToolsPackageState -PackageRoot $InstalledRoot
    $installedUsage = $installed.UsagePresent -or ($installed.StampValid -and $installed.UsageInterface)
    if ($installedUsage -and !$candidate.UsagePresent -and !$AllowUsageDowngrade) {
        throw 'The installed package has a Usage interface that this package removes. Use -AllowUsageDowngrade only for an intentional downgrade.'
    }
    return $candidate
}
