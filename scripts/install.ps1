<#
.SYNOPSIS
  Installs dependencies (pnpm only), builds the server and prints the Claude Desktop configuration.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\install.ps1
#>
param([switch]$ConfigureClaude)
. "$PSScriptRoot\common.ps1"

Write-Step 'Checking prerequisites'
if (-not (Test-Node)) { exit 1 }
if (-not (Test-Pnpm)) { exit 1 }

Write-Step 'Installing dependencies (pnpm install --frozen-lockfile)'
Invoke-Pnpm @('install', '--frozen-lockfile')

Write-Step 'Building'
Invoke-Pnpm @('build')

$envFile = Join-Path $ProjectRoot '.env'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $ProjectRoot '.env.example') $envFile
  Write-Ok 'Created .env from .env.example'
}
New-Item -ItemType Directory -Force (Join-Path $ProjectRoot 'output') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $env:USERPROFILE 'Documents\IllustratorMCP') | Out-Null

$entry = (Join-Path $ProjectRoot 'dist\index.js')
$snippet = @{ mcpServers = @{ illustrator = @{ command = 'node'; args = @($entry); env = @{ ILLUSTRATOR_ADAPTER = 'com' } } } } | ConvertTo-Json -Depth 6

if ($ConfigureClaude) {
  $cfgPath = Join-Path $env:APPDATA 'Claude\claude_desktop_config.json'
  if (Test-Path $cfgPath) {
    Copy-Item $cfgPath "$cfgPath.bak" -Force
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    if (-not $cfg.mcpServers) { $cfg | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{}) }
    $cfg.mcpServers | Add-Member -NotePropertyName illustrator -NotePropertyValue ([pscustomobject]@{ command = 'node'; args = @($entry); env = [pscustomobject]@{ ILLUSTRATOR_ADAPTER = 'com' } }) -Force
    $cfg | ConvertTo-Json -Depth 8 | Set-Content -Path $cfgPath -Encoding utf8
    Write-Ok "Updated $cfgPath (backup: claude_desktop_config.json.bak). Restart Claude Desktop."
  } else {
    New-Item -ItemType Directory -Force (Split-Path $cfgPath) | Out-Null
    $snippet | Set-Content -Path $cfgPath -Encoding utf8
    Write-Ok "Created $cfgPath. Restart Claude Desktop."
  }
} else {
  Write-Step 'Add this to %APPDATA%\Claude\claude_desktop_config.json (or rerun with -ConfigureClaude):'
  Write-Host $snippet
}

Write-Step 'Next: run scripts\diagnostics.ps1 to verify the Illustrator bridge.'
