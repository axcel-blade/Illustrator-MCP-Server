# Development & extension guide

```powershell
pnpm install
pnpm dev            # tsx watch, stdio transport
pnpm typecheck; pnpm lint; pnpm build; pnpm test
scripts\build.ps1   # all of the above
node scripts/gen-docs.mjs   # regenerate docs/TOOLS.md and templates/catalog.json after changing tools/templates
```

Use the MCP Inspector against the built server: `pnpm dlx @modelcontextprotocol/inspector node dist/index.js`.

## Layout

```
src/
  index.ts, server.ts         entry + server assembly
  config/                     env parsing and security rules
  transport/http.ts           Streamable HTTP + auth
  mcp/tools|resources|prompts MCP surface
  design-engine/              planner, templates, color, typography, validator, compiler, composition, revision, plan store
  illustrator/bridge/         bridge, queue, adapters, script builder, detection
  schemas/                    design plan schema
  utils/                      units, colors, paths, errors, logger
illustrator-scripts/          ExtendScript ops + run-jsx.ps1
tests/unit, tests/integration
```

## Adding an Illustrator operation

1. Implement `MCP.ops.my_op = function (a) { ... return data; }` in the right `illustrator-scripts/*.jsx`.
   ES3 only (no `let`, arrow functions, `forEach`, `JSON`). Use `MCP.fail(code, msg)` for errors, `MCP.warn()` for warnings,
   `MCP.doc()`, `MCP.find()`, `MCP.box()`, `MCP.moveTo()` for documents, lookup and coordinates.
2. Add `"my_op"` to `ALLOWED_OPS` in `src/illustrator/bridge/script-builder.ts` (a test enforces parity).
3. Register a tool in `src/mcp/tools/<area>.ts` with `defineTool` and a strict Zod schema; convert units with `P(ctx, units)`.
4. Optionally add a mock handler in `mock-adapter.ts`, write tests, regenerate docs.

## Adding a template

Add a `TemplateDefinition` to `src/design-engine/templates/library.ts` and include it in `TEMPLATES`. Use the `el.*`
builders, palette roles (`palette.primary`) and font roles (`fontRole: "heading"`); keep geometry proportional to
`width`/`height`. The test "every template in every style" validates it automatically.

## Adding a style

Add a palette to `STYLE_PALETTES` and a type system to `TYPE_SYSTEMS` (same key) and a keyword rule in
`STYLE_KEYWORDS` (`planner.ts`). End font candidate lists with fonts that ship on Windows and macOS
(e.g. Arial / Helvetica Neue / Georgia).

## Adding an automation mechanism

Implement `BridgeAdapter` (`detect`, `execute`) — e.g. a UXP plugin talking over a local socket — and select it in
`createAdapter()` (`src/server.ts`). Production already picks COM on Windows and AppleScript on macOS when
`ILLUSTRATOR_ADAPTER=auto`. Everything above the bridge is unchanged.
