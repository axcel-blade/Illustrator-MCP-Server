<#
.SYNOPSIS
  Starts the MCP server. stdio is what Claude Desktop launches itself; use -Http for ChatGPT/remote clients.
.EXAMPLE
  scripts\launch.ps1 -Http -Port 3333
#>
param([switch]$Http, [int]$Port = 3333, [string]$BindHost = '127.0.0.1')
. "$PSScriptRoot\common.ps1"
if (-not (Test-Path (Join-Path $ProjectRoot 'dist\index.js'))) { Write-Step 'Building first'; Invoke-Pnpm @('build') }
if ($Http) {
  $env:MCP_TRANSPORT = 'http'; $env:MCP_HTTP_PORT = "$Port"; $env:MCP_HTTP_HOST = $BindHost
  Write-Step "Starting Streamable HTTP transport on http://${BindHost}:$Port/mcp"
  if (-not $env:MCP_AUTH_TOKEN -and -not $env:MCP_SECRET_PATH) { Write-Warn2 'No MCP_AUTH_TOKEN/MCP_SECRET_PATH set: only loopback clients can connect.' }
}
Invoke-Pnpm @('start')
