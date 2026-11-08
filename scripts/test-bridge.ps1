<#
  Bridge smoke test: runs the real run-jsx.ps1 runner with a status-only script generated from the
  bootstrap library. Verifies COM + DoJavaScriptFile without creating documents.
#>
. "$PSScriptRoot\common.ps1"
$scripts = Join-Path $ProjectRoot 'illustrator-scripts'
$tmp = Join-Path $env:TEMP "illustrator-ai-mcp-bridge-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force $tmp | Out-Null
$jsx = Join-Path $tmp 'status.jsx'
$result = Join-Path $tmp 'status.json'
$lib = @('bootstrap.jsx', 'document.jsx') | ForEach-Object { Get-Content (Join-Path $scripts $_) -Raw }
$resultLiteral = $result.Replace('\', '\\')
($lib -join "`n") + "`nMCP.main({`"op`":`"status`",`"args`":{}}, `"$resultLiteral`");" | Set-Content -Path $jsx -Encoding ascii

Write-Step 'Executing status script in Illustrator via COM'
$sw = [Diagnostics.Stopwatch]::StartNew()
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $scripts 'run-jsx.ps1') -ScriptPath $jsx -ResultPath $result
$sw.Stop()
if (-not (Test-Path $result)) { Write-Fail 'No result file produced'; exit 1 }
$out = Get-Content $result -Raw
Remove-Item $tmp -Recurse -Force
$parsed = $out | ConvertFrom-Json
if ($parsed.ok) {
  Write-Ok "Bridge OK in $($sw.ElapsedMilliseconds) ms: $($parsed.data.application) $($parsed.data.version), $($parsed.data.documentCount) document(s) open"
  exit 0
}
Write-Fail "$($parsed.error.code): $($parsed.error.message)"
exit 1
