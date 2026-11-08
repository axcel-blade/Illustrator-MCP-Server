# Shared helpers for the project's PowerShell scripts. Dot-source: . "$PSScriptRoot\common.ps1"
$ErrorActionPreference = 'Stop'
$Script:ProjectRoot = Split-Path -Parent $PSScriptRoot

function Write-Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg) { Write-Host "  [ok] $msg" -ForegroundColor Green }
function Write-Warn2([string]$msg) { Write-Host "  [warn] $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg) { Write-Host "  [fail] $msg" -ForegroundColor Red }

function Test-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Write-Fail 'Node.js not found. Install Node.js 20 LTS or newer from https://nodejs.org/'; return $false }
  $v = (& node -v).TrimStart('v')
  if ([int]($v.Split('.')[0]) -lt 20) { Write-Fail "Node.js $v found; version 20 or newer is required."; return $false }
  Write-Ok "Node.js $v"
  return $true
}

function Test-Pnpm {
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if (-not $pnpm) {
    Write-Fail 'pnpm not found.'
    Write-Host '    Install it with Corepack (bundled with Node.js):' -ForegroundColor Yellow
    Write-Host '      corepack enable' -ForegroundColor Yellow
    Write-Host '      corepack prepare pnpm@10.18.0 --activate' -ForegroundColor Yellow
    Write-Host '    or see https://pnpm.io/installation' -ForegroundColor Yellow
    return $false
  }
  Write-Ok "pnpm $(& pnpm -v)"
  return $true
}

function Invoke-Pnpm([string[]]$PnpmArgs) {
  Push-Location $Script:ProjectRoot
  try {
    & pnpm @PnpmArgs
    if ($LASTEXITCODE -ne 0) { throw "pnpm $($PnpmArgs -join ' ') failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
}
