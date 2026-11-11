#!/usr/bin/env bash
# macOS install helper: build the MCP server and optionally configure Claude Desktop.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIGURE_CLAUDE=false
for arg in "$@"; do
  case "$arg" in
    --configure-claude|-ConfigureClaude) CONFIGURE_CLAUDE=true ;;
  esac
done

cd "$ROOT"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm build

echo "Built $ROOT/dist/index.js"

if [[ "$CONFIGURE_CLAUDE" == true ]]; then
  CLAUDE_DIR="${HOME}/Library/Application Support/Claude"
  CLAUDE_CFG="${CLAUDE_DIR}/claude_desktop_config.json"
  mkdir -p "$CLAUDE_DIR"
  ALLOWED="${HOME}/Documents/IllustratorMCP;${ROOT}/output"
  mkdir -p "${HOME}/Documents/IllustratorMCP" "${ROOT}/output"
  if [[ -f "$CLAUDE_CFG" ]]; then
    cp "$CLAUDE_CFG" "${CLAUDE_CFG}.bak.$(date +%Y%m%d%H%M%S)"
    echo "Backed up existing Claude config"
  fi
  # Merge or create a minimal config with Node + absolute dist path.
  node --input-type=module <<EOF
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const path = ${JSON.stringify(CLAUDE_CFG)};
const entry = {
  command: "node",
  args: [${JSON.stringify(`${ROOT}/dist/index.js`)}],
  env: {
    ILLUSTRATOR_ADAPTER: "auto",
    ILLUSTRATOR_AUTO_LAUNCH: "true",
    ALLOWED_PATHS: ${JSON.stringify(ALLOWED)},
    LOG_LEVEL: "info",
  },
};
let cfg = { mcpServers: {} };
if (existsSync(path)) {
  try { cfg = JSON.parse(readFileSync(path, "utf8")); } catch { /* replace */ }
  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") cfg.mcpServers = {};
}
cfg.mcpServers.illustrator = entry;
writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
console.log("Wrote", path);
EOF
  echo "Restart Claude Desktop fully (Quit from the menu bar) to load the server."
fi

echo "Done. Run scripts/diagnostics.sh to verify Illustrator + AppleScript."
