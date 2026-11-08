<# Checks Node.js, pnpm, lockfile and installed dependencies. Exit code 0 when everything is present. #>
. "$PSScriptRoot\common.ps1"
$ok = $true
Write-Step 'Runtime'
if (-not (Test-Node)) { $ok = $false }
if (-not (Test-Pnpm)) { $ok = $false }

Write-Step 'Project files'
foreach ($f in @('package.json', 'pnpm-lock.yaml', 'tsconfig.json')) {
  if (Test-Path (Join-Path $ProjectRoot $f)) { Write-Ok $f } else { Write-Fail "$f missing"; $ok = $false }
}
foreach ($f in @('package-lock.json', 'yarn.lock')) {
  if (Test-Path (Join-Path $ProjectRoot $f)) { Write-Warn2 "$f found - this project uses pnpm only; delete it." }
}
if (Test-Path (Join-Path $ProjectRoot 'node_modules\@modelcontextprotocol\sdk')) { Write-Ok 'node_modules installed' }
else { Write-Fail 'Dependencies not installed - run: pnpm install'; $ok = $false }
if (Test-Path (Join-Path $ProjectRoot 'dist\index.js')) { Write-Ok 'dist\index.js built' } else { Write-Warn2 'Not built yet - run: pnpm build' }

if ($ok) { exit 0 } else { exit 1 }
