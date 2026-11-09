# Testing

Two separate suites. Mocked tests never count as Illustrator verification.

## Automated (mock adapter) — `pnpm test`

Runs in CI or on any machine; no Illustrator needed. Files in `tests/unit/`:

| File | Covers |
|---|---|
| `utils.test.ts` | Unit conversion, coordinate convention, colors/contrast/CMYK, path sandbox (traversal, UNC, extensions, overwrite) |
| `design-engine.test.ts` | Schema validation (reference example, errors, dependency cycles, contrast), compiler (units, circles, alignment, z-order), planner (brief analysis, colors, sizes, **every template × every style** produces a valid plan), variations, revisions (instruction parsing, targeted ops, palette propagation, versioning), composition analyzer |
| `bridge.test.ts` | Serial queue, queue limit, script literal escaping, **allowlist ↔ JSX implementation parity**, JSX syntax/ES3 checks (incl. reserved words as keys), error mapping, malformed output, timeout + recovery, document pinning |
| `advanced.test.ts` | Typography issue detection, design-system store (save/list/get, overwrite refusal, validation) |
| `server.test.ts` | Server startup over an in-memory MCP transport, registration of all required tools, resources/prompts, input validation, mock labelling, unit conversion, confirmation gates, path restrictions, error propagation, full generate → analyze → critique → revise → compare loop |
| `transport.test.ts` | Config refusal of unauthenticated public binds, `authorize()`, real HTTP server: 401 without token, session init with token, health check |

## End-to-end (real Illustrator) — `pnpm build`, then:

| Command | Covers | Documents |
|---|---|---|
| `pnpm test:e2e` | Protocol, connection, every tool group, errors, concurrency | **Closes all open documents without saving** |
| `pnpm test:e2e:design` | Builds a complete design, saves `.ai`, exports SVG/PNG/PDF | Its own document only |
| `pnpm test:e2e:advanced` | Pathfinder, anchor editing, split/join/simplify, undo/redo, artboards, documents, typography roles, design systems, image info/relink/trace (needs `test-output/illustrator-mcp-test.png` from `test:e2e:design`) | Its own document only |
| `pnpm test:e2e:http` / `test:e2e:reconnect` | Streamable HTTP with auth / Illustrator quit and relaunch | — |

Each step passes only after the result is read back from Illustrator or found on disk.

## Manual integration (real Illustrator) — `scripts\integration-test.ps1`

1. `scripts\test-bridge.ps1` — runs a read-only status script through COM.
2. `pnpm test:integration` — builds the sample project through the real MCP tools:
   A4 artboard · background rectangle · headline · decorative circle · secondary text · separate Graphics layer ·
   verification by inspection · composition analysis · saved `.ai` · exported PNG · inline preview · drop shadow · full `generate_design`.
3. Results: `output/integration/report.json` with per-step status. A step passes only if Illustrator executed it
   **and** the result was verified (object found by name / file on disk). If Illustrator is unreachable the report
   status is `blocked` and the process exits with code 2.

Also check visually: open the saved `.ai`, confirm objects are editable (live text, vector paths, named layers).

## Results recorded for this release

| Suite | Environment | Result |
|---|---|---|
| `pnpm test` | Windows 11, Node 26.3.1, pnpm 10.18.0 | 80/80 passed |
| `pnpm test:e2e:advanced` | same + Illustrator 2026 (30.8.2) | 44/44 passed |
| `pnpm test:e2e:design` | same | passed |
| `scripts\test-bridge.ps1` | earlier machine, **no Illustrator installed** | Correctly failed with `ILLUSTRATOR_NOT_INSTALLED` (REGDB_E_CLASSNOTREG) |

Full details, including the earlier `pnpm test:e2e` results, are in [TEST_REPORT.md](TEST_REPORT.md).
