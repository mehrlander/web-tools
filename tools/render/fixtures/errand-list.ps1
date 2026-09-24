# @file tools/render/fixtures/errand-list.ps1
$Folder = "$env:USERPROFILE\Documents\Reports"

$body = Get-ChildItem $Folder -File | Select-Object Name, Length, LastWriteTime
$out = [ordered]@{
  envelope = 'errand-result/1'; errand = $ErrandId; script = 'tools/render/fixtures/errand-list.ps1'
  ranAt = (Get-Date).ToString('o'); venue = 'work-machine'; outputType = 'json'; body = $body
}
$out | ConvertTo-Json -Depth 5 | Set-Clipboard
