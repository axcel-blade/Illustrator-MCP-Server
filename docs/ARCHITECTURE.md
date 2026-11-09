# Architecture

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Transports | `src/index.ts`, `src/transport/http.ts` | stdio for Claude Desktop; Streamable HTTP (sessions, bearer/secret-path auth, DNS-rebinding protection) for remote clients. Both build the **same** `McpServer` from `src/server.ts`. |
| MCP layer | `src/mcp/tools/*`, `resources/`, `prompts/` | Tool registration with Zod schemas, unit conversion at the boundary, path sandboxing, confirmation gates, structured results (`ok`, `source`, `data`, `warnings`, optional images). |
| Design engine | `src/design-engine/*`, `src/schemas/design-plan.ts` | Brief analysis → template + style system → `DesignPlan` JSON → validation → compilation to bridge args. Composition analysis, revision diffing, plan versioning, variations. Pure TypeScript, no Illustrator dependency. |
| Bridge | `src/illustrator/bridge/*` | Allowlist, serial `OperationQueue`, script generation, timeout watchdog, envelope parsing, error mapping. `BridgeAdapter` interface isolates the mechanism. |
| Adapters | `com-adapter.ts`, `mock-adapter.ts` | COM: `powershell.exe` → `New-Object -ComObject Illustrator.Application` → `DoJavaScriptFile`. Mock: in-memory model for tests. |
| ExtendScript | `illustrator-scripts/*.jsx`, `run-jsx.ps1` | ES3 operation library registered in `MCP.ops`; `MCP.main` dispatches and writes a JSON envelope. |

## Request flow

1. Client calls e.g. `draw_circle {cx: 105, cy: 150, radius: 40, units: "mm"}`.
2. Zod validates; the handler converts to points and calls `bridge.run("draw_ellipse", args)`.
3. The bridge checks `ALLOWED_OPS`, queues the call, and builds a self-contained script:
   all JSX modules + `MCP.main(<command literal>, <result path>)`. Client data is embedded only as a JSON literal — never as code.
4. The COM adapter writes the script to `%TEMP%\illustrator-ai-mcp\<uuid>.jsx` and runs `run-jsx.ps1`, which calls
   `DoJavaScriptFile`. The JSX writes `{ok, data | error, warnings}` to `<uuid>.json`.
   The command also carries the name of the document the server last worked on (`doc`). `MCP.main` calls `app.redraw()`
   (which refreshes Illustrator's item collections between calls) and re-activates that document, because with several documents
   open `app.activeDocument` is not reliable across COM calls. The envelope reports the document used, and the bridge pins it.
5. The bridge parses the envelope. `ok: false` becomes a typed `McpDesignError`; `ok: true` is the only path to success.
6. The tool returns JSON with `source: "illustrator"` (or `"mock"` / `"server"`).

## Why COM + per-call PowerShell

- `Illustrator.Application.DoJavaScriptFile(path, args, mode)` is the documented Windows automation entry point
  (Adobe *Illustrator Scripting Reference: VBScript*).
- A short-lived PowerShell process per call means a hung COM call can be killed on timeout without affecting the server.
- Cost: ~200–400 ms process start per call. Design execution is batched into **one** `execute_plan` call to amortise it.
- UXP for Illustrator was evaluated as a future mechanism; the `BridgeAdapter` interface is where a UXP/CEP adapter would plug in.

## Design engine pipeline

```
brief ──analyzeBrief──► category, style, audience, size, quoted copy, colors
      ──template.build(ctx)──► layers + elements (palette roles, font roles)
      ──validatePlan──► schema + semantic checks (layers, palette refs, alignment DAG, contrast)
      ──compilePlan──► points, resolved colors (hex+CMYK), font candidate lists, z-ordered elements
      ──bridge execute_plan──► editable artwork
      ──inspect_document──► verification (every planned object found by name)
      ──export_png──► preview image returned to the client
```

Revisions (`revise_design`) diff plan versions by element name and send only `update_elements` / additions /
removals; documents are rebuilt only when document size or units change.

## Verified vs. assessed

- *Verified*: anything read back from Illustrator (`inspect_document`, export file existence, `analyze_composition`
  which is computed from inspected bounds/colors).
- *Visual assessment*: only the AI client can provide it, by looking at the PNG returned by
  `generate_export_preview`/`critique_design`. If no PNG exists, the tools say so explicitly.
