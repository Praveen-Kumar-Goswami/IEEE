# Decodes the newest Page.captureScreenshot CDP response into a JPEG for visual QA.
param([string]$Out = "$env:TEMP\tend-shot.jpg")
$file = Get-ChildItem "$env:USERPROFILE\.cursor\browser-logs\cdp-response-Page.captureScreenshot-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$json = Get-Content $file.FullName -Raw | ConvertFrom-Json
$data = if ($json.data) { $json.data } elseif ($json.result.data) { $json.result.data } else { $json.response.data }
[IO.File]::WriteAllBytes($Out, [Convert]::FromBase64String($data))
Write-Output $Out
