# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | Yes |
| 0.2.x | Yes |
| 0.1.x | Yes |

## Reporting a vulnerability

**Do not open a public issue.** Report privately through
[GitHub security advisories](https://github.com/axcel-blade/Illustrator-MCP-Server/security/advisories/new).

Please include:

- Affected version / commit
- Transport in use (stdio or HTTP) and authentication mode
- Steps to reproduce or a proof of concept
- Impact (e.g. file access outside `ALLOWED_PATHS`, code execution in Illustrator, auth bypass)

You can expect an acknowledgement within 7 days and a fix or mitigation plan within 30 days for confirmed issues.

## Especially in scope

- Escaping the `ALLOWED_PATHS` file sandbox
- Getting arbitrary JSX or shell commands executed
- Bypassing bearer-token / secret-path authentication or the loopback-only default
- Tools reporting success for operations that did not happen

The security design is documented in [docs/SECURITY.md](docs/SECURITY.md).
