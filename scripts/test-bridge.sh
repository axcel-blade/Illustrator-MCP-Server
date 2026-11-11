#!/usr/bin/env bash
# Read-only status probe through the macOS AppleScript runner.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="${TMPDIR:-/tmp}/illustrator-ai-mcp-test"
mkdir -p "$WORKDIR"
JSX="$WORKDIR/status.jsx"
OUT="$WORKDIR/status.json"
rm -f "$OUT"

# Minimal status script compatible with Illustrator ExtendScript (ES3).
cat >"$JSX" <<EOF
var f = new File($(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$OUT"));
f.open("w");
try {
  f.write('{"ok":true,"data":{"name":"' + app.name + '","version":"' + app.version + '","documents":' + documents.length + '}}');
} catch (e) {
  f.write('{"ok":false,"error":{"code":"ILLUSTRATOR_SCRIPT_ERROR","message":"' + String(e.message || e).replace(/"/g, '\\"') + '"}}');
}
f.close();
EOF

osascript "$ROOT/illustrator-scripts/run-jsx.applescript" "$JSX" "$OUT" "false"
echo "Result file: $OUT"
cat "$OUT"
echo
