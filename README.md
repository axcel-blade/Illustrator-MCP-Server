# Illustrator AI Design MCP

[![CI](https://github.com/axcel-blade/Illustrator-MCP-Server/actions/workflows/ci.yml/badge.svg)](https://github.com/axcel-blade/Illustrator-MCP-Server/actions/workflows/ci.yml)

An MCP server that lets AI assistants (Claude Desktop, ChatGPT) design in **Adobe Illustrator**: it turns
natural-language briefs — posters, logos, brand work and, Figma-AI-style, app screens, landing pages, dashboards and UI kits — into structured design plans, builds them as **editable vector artwork**, inspects
the result, exports previews and applies targeted revisions.

```
AI client (Claude Desktop: stdio · ChatGPT: HTTPS)
        │  MCP
        ▼
MCP server ── 148 tools, resources, prompts, validation, auth
        │
        ▼
AI design engine ── brief analysis → plan JSON → validation → compile; critique, revision, variations
        │
        ▼
Illustrator bridge ── allowlisted ops · serial queue · timeouts · typed errors
        │  PowerShell → COM Illustrator.Application.DoJavaScriptFile
        ▼
Adobe Illustrator ── ExtendScript ops (illustrator-scripts/*.jsx)
```

## Status

| Area | State |
|---|---|
| MCP server (stdio + Streamable HTTP), 148 tools, resources, prompts | Implemented, covered by automated tests |
| Design engine (planner, 26 templates incl. UI screens, 15 styles, auto layout, UI components, design tokens, UI/UX Pro Max design knowledge, validator, compiler, analyzer, revisions, variations) | Implemented, covered by automated tests |
| Bridge (queue, timeouts, allowlist, error mapping, COM runner) | Implemented; COM failure path verified on a machine **without** Illustrator |
| ExtendScript operations inside a real Illustrator | **Not yet verified** — the development machine had no Illustrator. Run `scripts\integration-test.ps1` |
| ChatGPT remote connection | Transport implemented and tested locally; not verified against ChatGPT |

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for details.

## Quick start (Windows)

Requirements: Windows 10/11, Node.js 20+, pnpm (via Corepack), Adobe Illustrator 2020 or later.

```powershell
corepack enable
pnpm install
pnpm build
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -ConfigureClaude
powershell -ExecutionPolicy Bypass -File scripts\diagnostics.ps1
```

Restart Claude Desktop, then ask: *"Check Illustrator status, then create a modern luxury skincare poster with a
minimalist layout, beige background, elegant typography and a product image."*

## Commands

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies (pnpm only — no npm/yarn lockfiles) |
| `pnpm dev` | Run from source with reload |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Start (stdio). `pnpm start:http` for HTTP |
| `pnpm test` | Automated tests (mock adapter, no Illustrator needed) |
| `pnpm test:integration` | Manual tests against the real Illustrator |
| `pnpm lint` / `pnpm typecheck` | Static checks |

## Documentation

- [Installation & Windows setup](docs/INSTALLATION.md) — pnpm, Illustrator, Claude Desktop, ChatGPT
- [Architecture](docs/ARCHITECTURE.md)
- [Tool reference](docs/TOOLS.md) (generated) · [Example prompts](docs/EXAMPLES.md)
- [UI design: auto layout, components, tokens](docs/UI_DESIGN.md)
- [Design plan schema](docs/DESIGN_SCHEMA.md) · [Coordinate convention](docs/COORDINATES.md)
- [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Development & extension guide](docs/DEVELOPMENT.md) · [Known limitations](docs/LIMITATIONS.md)
- [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security policy](SECURITY.md) · [Support](SUPPORT.md)

## License

MIT — see [LICENSE](LICENSE).

Design knowledge in [`data/`](data) comes from
[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) © 2024 Next Level Builder, MIT License.
