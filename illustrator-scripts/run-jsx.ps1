<#
  Executes a generated JSX file inside Adobe Illustrator through COM automation.
  Called only by the Node bridge (src/illustrator/bridge/com-adapter.ts) with a script the
  bridge generated from allowlisted operations. Writes a JSON envelope to -ResultPath.
#>
param(
  [Parameter(Mandatory = $true)][string]$ScriptPath,
  [Parameter(Mandatory = $true)][string]$ResultPath,
  [switch]$NoLaunch
)
$ErrorActionPreference = 'Stop'

function Write-Envelope([string]$code, [string]$message) {
  $msg = $message.Replace('\', '\\').Replace('"', '\"') -replace "`r?`n", ' '
  [IO.File]::WriteAllText($ResultPath, "{`"ok`":false,`"error`":{`"code`":`"$code`",`"message`":`"$msg`"}}")
}

try {
  if ($NoLaunch -and -not (Get-Process -Name Illustrator -ErrorAction SilentlyContinue)) {
    Write-Envelope 'ILLUSTRATOR_NOT_RUNNING' 'Illustrator is not running and auto-launch is disabled (ILLUSTRATOR_AUTO_LAUNCH=false).'
    exit 0
  }
  try {
    $app = New-Object -ComObject Illustrator.Application
  } catch {
    Write-Envelope 'ILLUSTRATOR_NOT_INSTALLED' ("Could not create COM object Illustrator.Application: " + $_.Exception.Message)
    exit 0
  }
  # ExecutionMode 1 = aiNeverStartDebugger (AiJavaScriptExecutionMode).
  try {
    $ret = $app.DoJavaScriptFile($ScriptPath, [Type]::Missing, 1)
  } catch [System.Management.Automation.MethodException] {
    $ret = $app.DoJavaScriptFile($ScriptPath)
  }
  if (-not (Test-Path -LiteralPath $ResultPath)) {
    if ($ret) { [IO.File]::WriteAllText($ResultPath, [string]$ret) }
    else { Write-Envelope 'ILLUSTRATOR_SCRIPT_ERROR' 'Illustrator returned no result. The script may have failed to parse.' }
  }
  exit 0
} catch {
  Write-Envelope 'BRIDGE_UNAVAILABLE' $_.Exception.Message
  exit 0
}
