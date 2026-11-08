<# Environment diagnostics: runtime, Illustrator installs, COM registration, process, config, Claude config. #>
. "$PSScriptRoot\common.ps1"
$ErrorActionPreference = 'Continue'

Write-Step 'Runtime'
Test-Node | Out-Null; Test-Pnpm | Out-Null
Write-Ok "Windows: $([Environment]::OSVersion.VersionString), PowerShell $($PSVersionTable.PSVersion)"

Write-Step 'Adobe Illustrator installations'
$found = Get-ChildItem "$env:ProgramFiles\Adobe" -Directory -Filter 'Adobe Illustrator*' -ErrorAction SilentlyContinue
if ($found) {
  foreach ($d in $found) {
    $exe = Join-Path $d.FullName 'Support Files\Contents\Windows\Illustrator.exe'
    if (Test-Path $exe) { Write-Ok "$($d.Name)  ($((Get-Item $exe).VersionInfo.ProductVersion))" } else { Write-Warn2 "$($d.Name) (Illustrator.exe not found)" }
  }
} else { Write-Fail 'No Illustrator installation found under Program Files\Adobe' }

Write-Step 'COM registration'
$curVer = (Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\Illustrator.Application\CurVer' -ErrorAction SilentlyContinue).'(default)'
if ($curVer) { Write-Ok "Illustrator.Application -> $curVer" } else { Write-Fail 'Illustrator.Application ProgID is not registered (run Illustrator once as the current user, or repair the install).' }

Write-Step 'Process'
$p = Get-Process Illustrator -ErrorAction SilentlyContinue
if ($p) { Write-Ok "Illustrator running (PID $($p.Id -join ', '))" } else { Write-Warn2 'Illustrator not running (it will be launched on first tool call if ILLUSTRATOR_AUTO_LAUNCH=true)' }

Write-Step 'Claude Desktop config'
$cfg = Join-Path $env:APPDATA 'Claude\claude_desktop_config.json'
if (Test-Path $cfg) {
  $json = Get-Content $cfg -Raw | ConvertFrom-Json
  if ($json.mcpServers.illustrator) { Write-Ok "illustrator server configured: $($json.mcpServers.illustrator.args -join ' ')" } else { Write-Warn2 'claude_desktop_config.json has no "illustrator" server entry' }
} else { Write-Warn2 "$cfg not found" }

Write-Step 'Logs'
$logs = Join-Path $ProjectRoot 'logs'
$latest = Get-ChildItem $logs -Filter '*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest) { Write-Ok "Latest log: $($latest.FullName)"; Get-Content $latest.FullName -Tail 5 } else { Write-Warn2 'No logs yet' }
