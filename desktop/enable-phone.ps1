[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$tailscale = (Get-Command tailscale -ErrorAction Stop).Source
$tsText = & $tailscale status --json
if ($LASTEXITCODE -ne 0) { throw 'Tailscale status is unavailable.' }
$ts = $tsText | ConvertFrom-Json
if ($ts.BackendState -ne 'Running') { throw 'Connect Tailscale before enabling the phone view.' }
$owner = $ts.User.($ts.Self.UserID.ToString()).LoginName
$dns = $ts.Self.DNSName.TrimEnd('.')
if (-not $owner -or -not $dns.EndsWith('.ts.net')) { throw 'The Tailscale owner or private DNS name is unavailable.' }
$existingText = & $tailscale serve status --json
if ($LASTEXITCODE -ne 0) { throw 'The existing Serve configuration could not be read.' }
$existing = $existingText | ConvertFrom-Json
$endpoint = $existing.Web.("${dns}:443").Handlers.'/'
if ($endpoint -and $endpoint.Proxy -ne 'http://127.0.0.1:47831') {
    throw 'Another service already owns the root HTTPS address. Choose a separate Serve port before proceeding.'
}
$accessDirectory = Join-Path $env:LOCALAPPDATA 'WebToolsDesktop'
$accessPath = Join-Path $accessDirectory 'companion-access.json'
New-Item -ItemType Directory -Path $accessDirectory -Force | Out-Null
if (Test-Path -LiteralPath $accessPath) { $access = Get-Content -LiteralPath $accessPath -Raw | ConvertFrom-Json }
else { $access = [pscustomobject]@{ LocalToken=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)); TailscaleLogin=''; PhoneUrl='' } }
$access.TailscaleLogin = $owner
$access.PhoneUrl = "https://$dns/"
$temporary = "$accessPath.tmp"
$access | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding utf8NoBOM
Move-Item -LiteralPath $temporary -Destination $accessPath -Force
& $tailscale serve --bg --https=443 http://127.0.0.1:47831
if ($LASTEXITCODE -ne 0) { throw 'Serve needs attention. Follow the Tailscale setup link above, then run this script again.' }
Write-Output "Private phone view: $($access.PhoneUrl)"
Write-Output 'Access requires the owner Tailscale account. The API is read-only.'
