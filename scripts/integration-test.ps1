<#
  Manual integration test against the installed Illustrator. Creates the sample project
  (A4, background, headline, circle, secondary text, Graphics layer, .ai save, PNG export)
  and writes output\integration\report.json. Exit codes: 0 passed, 1 failed, 2 blocked.
#>
. "$PSScriptRoot\common.ps1"
if (-not (Test-Pnpm)) { exit 1 }
Write-Step 'Bridge pre-check'
& (Join-Path $PSScriptRoot 'test-bridge.ps1')
if ($LASTEXITCODE -ne 0) { Write-Fail 'Bridge unavailable; integration test would be blocked.'; exit 2 }
Write-Step 'Running integration suite'
Push-Location $ProjectRoot
try { & pnpm test:integration; $code = $LASTEXITCODE } finally { Pop-Location }
exit $code
