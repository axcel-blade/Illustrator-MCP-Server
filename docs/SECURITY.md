# Security

## Threat model

The server can create, modify and save files and drive a desktop application. Inputs come from an AI model, which
may be influenced by untrusted content (prompt injection). Controls therefore assume tool arguments are hostile.

## Controls

| Control | Implementation |
|---|---|
| No arbitrary code | There is no tool that accepts JSX, shell commands or file contents to execute. Clients pick from **allowlisted operations** (`ALLOWED_OPS` in `script-builder.ts`, re-checked by the JSX dispatcher). Arguments are embedded as a JSON literal, so they cannot become code. |
| Input validation | Every tool has a strict Zod schema (types, ranges, enums, hex colors, lengths). Design plans get schema + semantic validation. |
| File sandbox | `PathPolicy` resolves every path and requires it to be inside `ALLOWED_PATHS`. Rejects `..` escapes, other drives, UNC/network paths, NUL bytes, and wrong extensions. |
| Overwrite protection | Saves/exports fail with `FILE_EXISTS` unless `overwrite: true`. PDF/EPS export refuses to proceed if unsaved .ai changes could be lost. |
| Destructive confirmation | `delete_object`, `delete_layer`, `close_document(save:false)` return `CONFIRMATION_REQUIRED` unless `confirm: true`; tools carry `destructiveHint` annotations so clients can prompt the user. |
| Network exposure | HTTP binds to `127.0.0.1` by default. Binding elsewhere is refused without `MCP_AUTH_TOKEN` or `MCP_SECRET_PATH` (≥24 chars). Tokens are compared in constant time. DNS-rebinding protection (Host allowlist) is on for loopback binds. Request bodies are capped at 4 MB. |
| Concurrency | One serial queue per process; Illustrator never runs two scripts at once. Queue length is capped (100). |
| Timeouts | Per-op timeout kills the PowerShell runner; a bridge-level watchdog guarantees the queue continues. |
| Truthful results | Success is only returned when the JSX envelope says `ok: true`. Mock results are labelled. Visual inspection is only claimed when a PNG was produced. |
| Logging | JSON logs to stderr and `logs/`. Tool arguments are not logged at info level; tokens are never logged. |
| Safe shutdown | SIGINT/SIGTERM wait (≤15 s) for the in-flight Illustrator operation before exiting. |

## Recommendations

- Keep `ALLOWED_PATHS` narrow; never include your whole user profile or a drive root.
- For ChatGPT, read the "No authentication" trade-off in [INSTALLATION.md §5](INSTALLATION.md). Stop the tunnel when idle.
- Rotate `MCP_AUTH_TOKEN`/`MCP_SECRET_PATH` with `scripts\new-token.ps1` if a URL or token leaks.
- Illustrator itself can run scripts from opened files' linked content; only open documents you trust.

## Reporting

Open a private security advisory on the repository rather than a public issue.
