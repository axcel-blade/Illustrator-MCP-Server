<# Full quality gate: typecheck, lint, build, unit tests. #>
param([switch]$SkipTests)
. "$PSScriptRoot\common.ps1"
if (-not (Test-Pnpm)) { exit 1 }
Write-Step 'Typecheck'; Invoke-Pnpm @('typecheck')
Write-Step 'Lint'; Invoke-Pnpm @('lint')
Write-Step 'Build'; Invoke-Pnpm @('build')
if (-not $SkipTests) { Write-Step 'Unit tests (mock adapter)'; Invoke-Pnpm @('test') }
Write-Ok 'Build complete: dist\index.js'
