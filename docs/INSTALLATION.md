# Installation

## 1. Requirements

| Component | Version | Notes |
|---|---|---|
| Windows | 10 or 11 (x64) | Bridge uses COM (`Illustrator.Application.DoJavaScriptFile`) |
| macOS | 12+ (Intel or Apple Silicon) | Bridge uses AppleScript (`do javascript file`) |
| Node.js | 20 LTS or newer | `node -v` |
| pnpm | 10.x (pinned via `packageManager` in package.json) | Installed with Corepack |
| Adobe Illustrator | 2020 (v24) or newer recommended | `uuid` lookups and `applyEffect` need 2020+/2018+ |
| Claude Desktop | current | stdio transport |
| ChatGPT | plan with Developer Mode | remote HTTPS transport; see §5 |

## 2. pnpm

This project uses **pnpm exclusively**. Do not run `npm install` or `yarn` — they would create
`package-lock.json`/`yarn.lock`, which the project rejects (`scripts/check-deps.ps1` warns about them).

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm -v
```

If `corepack` is not available, see https://pnpm.io/installation. Then:

```bash
pnpm install --frozen-lockfile
pnpm build
```

`pnpm-lock.yaml` is committed; `--frozen-lockfile` makes installs reproducible. `esbuild` (used by `tsx`/`vitest`)
is the only dependency allowed to run install scripts (`pnpm.onlyBuiltDependencies`). No `pnpm-workspace.yaml`
is used because this is a single package.

## 3. Illustrator setup

### Windows

1. Install Illustrator through Creative Cloud and **start it once** as the same Windows user who runs the MCP server.
   This registers the `Illustrator.Application` COM class.
2. Verify: `powershell -ExecutionPolicy Bypass -File scripts\diagnostics.ps1` should show the install and the COM ProgID.
3. Verify scripting end to end: `scripts\test-bridge.ps1` runs a read-only status script inside Illustrator.
4. Optional: `ILLUSTRATOR_AUTO_LAUNCH=false` makes tools fail with `ILLUSTRATOR_NOT_RUNNING` instead of launching Illustrator.

### macOS

1. Install Illustrator through Creative Cloud under `/Applications` (or `~/Applications`).
2. Start Illustrator once, then grant **Automation** permission when prompted so Terminal/Node/Claude can control it
   (System Settings → Privacy & Security → Automation).
3. Verify: `chmod +x scripts/*.sh && ./scripts/diagnostics.sh`
4. Verify scripting: `./scripts/test-bridge.sh` (Illustrator should be running, or leave auto-launch enabled).
5. Optional: `ILLUSTRATOR_AUTO_LAUNCH=false` as on Windows.

Close modal dialogs in Illustrator before using the tools; a modal dialog blocks script execution and causes `BRIDGE_TIMEOUT`.

## 4. Claude Desktop (stdio)

### Windows

Automatic: `scripts\install.ps1 -ConfigureClaude` (backs up the existing config first).

Manual: edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "illustrator": {
      "command": "node",
      "args": ["C:\\path\\to\\Illustrator-MCP-Server\\dist\\index.js"],
      "env": {
        "ILLUSTRATOR_ADAPTER": "auto",
        "ALLOWED_PATHS": "C:\\Users\\you\\Documents\\IllustratorMCP;C:\\path\\to\\Illustrator-MCP-Server\\output"
      }
    }
  }
}
```

### macOS

Automatic: `./scripts/install.sh --configure-claude`

Manual: edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "illustrator": {
      "command": "node",
      "args": ["/absolute/path/to/Illustrator-MCP-Server/dist/index.js"],
      "env": {
        "ILLUSTRATOR_ADAPTER": "auto",
        "ALLOWED_PATHS": "/Users/you/Documents/IllustratorMCP;/absolute/path/to/Illustrator-MCP-Server/output"
      }
    }
  }
}
```

Examples: [claude_desktop_config.json](../examples/claude_desktop_config.json) (Windows),
[claude_desktop_config.macos.json](../examples/claude_desktop_config.macos.json) (macOS).

Restart Claude Desktop fully (tray / menu bar → Quit). The hammer/tools menu should list the Illustrator tools.

## 5. ChatGPT (remote MCP over HTTPS)

ChatGPT connects to **remote** MCP servers only; it cannot launch a local stdio process. Current requirements
(checked November 2026 — re-check OpenAI's help center, they change):

- Developer Mode: *Settings → Apps & Connectors → Advanced → Developer mode*.
- Plans: Business, Enterprise and Edu get full MCP (including write actions). Plus and Pro can use Developer Mode
  for **read-only** connectors, which is not enough for tools that modify artwork.
- Transport: SSE or Streamable HTTP over a public **HTTPS** URL. This server implements Streamable HTTP at `/mcp`.
- Authentication options offered by ChatGPT: **OAuth** or **No authentication**. Static API keys/bearer tokens are not supported in the connector UI.

Because Illustrator runs on your machine, expose the local server through an HTTPS tunnel:

**Windows (PowerShell):**

```powershell
$env:MCP_SECRET_PATH = (powershell -File scripts\new-token.ps1)
$env:MCP_TRANSPORT = "http"; $env:MCP_HTTP_HOST = "127.0.0.1"; $env:MCP_HTTP_PORT = "3333"
pnpm start
# other terminal:
cloudflared tunnel --url http://127.0.0.1:3333
```

**macOS (bash):**

```bash
export MCP_SECRET_PATH="$(openssl rand -hex 24)"
export MCP_TRANSPORT=http MCP_HTTP_HOST=127.0.0.1 MCP_HTTP_PORT=3333
pnpm start
# other terminal:
cloudflared tunnel --url http://127.0.0.1:3333
```

In ChatGPT, add a connector with URL `https://<tunnel-host>/mcp/<MCP_SECRET_PATH>` and authentication **No authentication**.

Security trade-off: with "No authentication" the secret path is the only credential; anyone who learns the URL can
drive Illustrator inside the `ALLOWED_PATHS` sandbox. Keep the secret private, stop the tunnel when not in use, and
prefer putting an OAuth-capable gateway (e.g. Cloudflare Access with an OAuth app) in front for shared or long-lived use.
Generic MCP clients that support headers should use `MCP_AUTH_TOKEN` (`Authorization: Bearer <token>`) instead.

The server refuses to bind to a non-loopback address unless `MCP_AUTH_TOKEN` or `MCP_SECRET_PATH` is set. Tunnels
connect to `127.0.0.1`, so keep `MCP_HTTP_HOST=127.0.0.1`.

## 6. Configuration reference

All settings are environment variables (see [.env.example](../.env.example)). `pnpm start` does not read `.env`
automatically — set variables in the shell, the Claude config `env` block, or your service manager.

| Variable | Default | Meaning |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` (also `--transport http`) |
| `MCP_HTTP_HOST` / `MCP_HTTP_PORT` | `127.0.0.1` / `3333` | HTTP bind address |
| `MCP_AUTH_TOKEN` | — | Bearer token (≥24 chars) |
| `MCP_SECRET_PATH` | — | Secret URL segment (≥24 chars) → `/mcp/<secret>` |
| `ILLUSTRATOR_ADAPTER` | `auto` | `auto` picks COM on Windows / AppleScript on macOS; `com`, `applescript`, or `mock` (tests only) |
| `ILLUSTRATOR_TIMEOUT_MS` | `60000` | Per-operation timeout (design execution uses ≥120 s) |
| `ILLUSTRATOR_AUTO_LAUNCH` | `true` | Allow the bridge to start Illustrator |
| `ALLOWED_PATHS` | `output;~/Documents/IllustratorMCP` | `;`-separated sandbox roots for all file I/O (same separator on both OSes) |
| `LOG_LEVEL` / `LOG_DIR` | `info` / `logs` | JSON logs to stderr and `logs/mcp-YYYY-MM-DD.log` |

## 7. Running as a background service (optional)

For an always-on ChatGPT connection on Windows, run `scripts\launch.ps1 -Http` from Task Scheduler "At log on" for your
user (Illustrator needs an interactive desktop session; it cannot run as a Windows service account).

On macOS, use a LaunchAgent that starts `node dist/index.js --transport http` in your login session (same constraint:
Illustrator needs a GUI session).
