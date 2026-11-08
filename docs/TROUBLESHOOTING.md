# Troubleshooting

Start with `powershell -ExecutionPolicy Bypass -File scripts\diagnostics.ps1`, then `scripts\test-bridge.ps1`.

| Symptom | Cause | Fix |
|---|---|---|
| `ILLUSTRATOR_NOT_INSTALLED` / `REGDB_E_CLASSNOTREG` | COM class not registered for this user | Install Illustrator, launch it once as the same user; repair via Creative Cloud if needed |
| `ILLUSTRATOR_NOT_RUNNING` | `ILLUSTRATOR_AUTO_LAUNCH=false` | Start Illustrator or enable auto-launch |
| `BRIDGE_TIMEOUT` | Modal dialog open in Illustrator, first launch still loading, or a very large operation | Dismiss dialogs; retry after Illustrator finishes loading; raise `ILLUSTRATOR_TIMEOUT_MS`. Inspect the document before retrying — the op may have completed |
| `NO_ACTIVE_DOCUMENT` | No document open | `create_document` or `open_document` first |
| `OBJECT_NOT_FOUND` | Target name not found | `inspect_document` to see names; names are case-sensitive |
| `PATH_NOT_ALLOWED` | Path outside sandbox | Use a relative path (resolves into `output/`) or add the folder to `ALLOWED_PATHS` |
| `FILE_EXISTS` | Overwrite protection | Pass `overwrite: true` or pick a new name |
| `CONFIRMATION_REQUIRED` | Destructive op or PDF/EPS from an unsaved doc | Ask the user, then retry with `confirm: true`; save the .ai before PDF/EPS export |
| Font warnings | Requested font not installed | `inspect_fonts {query:"..."}` and pass an installed name or fallback list |
| Claude Desktop shows no tools | Bad path in config, or Claude not restarted | Use an absolute path to `dist\index.js`, run `pnpm build`, fully quit and reopen Claude; see `%APPDATA%\Claude\logs\mcp*.log` |
| Garbage on stdout / "Unexpected token" in Claude logs | Something wrote to stdout | The server only logs to stderr; check for wrapper scripts printing output |
| ChatGPT "connector failed" | Tunnel down, wrong secret path, plan lacks write MCP | Check `https://<host>/healthz`, the full `/mcp/<secret>` URL, and plan requirements in INSTALLATION.md |
| `401` from HTTP | Missing/incorrect bearer token or secret path | Verify `MCP_AUTH_TOKEN` / URL |
| `403` from HTTP on loopback | Host header not in allowlist (DNS-rebinding protection) | Connect via `127.0.0.1:<port>` or `localhost:<port>` |
| PowerShell blocked by execution policy | Machine policy | Scripts are launched with `-ExecutionPolicy Bypass`; if a GPO forbids it, sign the scripts or ask IT |
| Live effects fail (`applyEffect`) | Older Illustrator or changed effect XML | Effects are reported as errors, never silently skipped; use opacity/duplicate shapes as a fallback |

Logs: `logs/mcp-YYYY-MM-DD.log` (JSON lines). Set `LOG_LEVEL=debug` for per-tool timing.
