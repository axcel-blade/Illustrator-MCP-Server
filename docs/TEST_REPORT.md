# Integration & Functionality Test Report

- **Date:** 2026-11-09 · **Branch:** `test/full-integration-test`
- **Environment:** Windows 11 Pro, Node 26.3.1, pnpm 10.18.0, Adobe Illustrator 2026 (30.8.2, build 7R), COM ProgID `Illustrator.Application.30`
- **Method:** The built server (`dist/index.js`) ran as a child process and was driven by the official MCP SDK client over stdio and Streamable HTTP. All operations ran in the real Illustrator. No mock adapter was used. A step passed only after the result was read back from Illustrator (`inspect_document`, `calculate_object_bounds`, `inspect_layers`) or the file was confirmed on disk.

## 1. Project health: PASS

| Check | Status |
|---|---|
| `pnpm install` | PASS |
| `pnpm typecheck` (tsc strict) | PASS |
| `pnpm lint` | PASS (after adding Node globals for the new `tests/e2e` scripts) |
| `pnpm test` (vitest, 61 tests) | PASS |
| `pnpm build` | PASS |
| `pnpm test:integration` (existing real-Illustrator test, 15 steps) | PASS |

## 2. MCP server startup: PASS
stdio startup works, and HTTP startup works (`--transport http`, `/healthz`).

## 3. MCP protocol: PASS (8/8)
initialize/serverInfo, capabilities (tools, resources, prompts, logging), tools/list (114 tools, all schemas `type: object`), resources/list (4), prompts/list (3), invalid arguments return `isError` with a Zod message, unknown tool returns an error, server stays alive after errors.

## 4. Illustrator connection: PASS (5/5)
Installation detected, process detected, COM registered, scripting access (version 30.8.2), active-document detection, and document creation verified by reading it back.

## 5. Operations (`pnpm test:e2e`): 46 PASS, 0 FAIL, 1 NOT TESTED

| Area | Results |
|---|---|
| Document | create, info, save as `.ai`, save, close, open: PASS |
| Shapes | rectangle, circle, ellipse, polygon, star, position, dimensions, fill, stroke: PASS |
| Typography | inspect fonts, create text, size, family, color, alignment: PASS |
| Vector | pen path, freeform path, rotate, scale+reflect, group, ungroup, duplicate, delete, z-order, align: PASS |
| Vector | modify anchor points of an existing path: **NOT TESTED**. The server has no tool for editing individual anchors. |
| Advanced | create/rename/lock/unlock layer, gradient, opacity, clipping mask, export SVG/PNG/PDF: PASS |

## 6. Bugs found and fixed

| # | Bug | Fix |
|---|---|---|
| 1 | `align_objects` with `relativeTo: "artboard"` crashed (`undefined is not an object`). ExtendScript evaluated the `"key"` branch of a multi-line nested ternary. | `illustrator-scripts/objects.jsx`: replaced with if/else. A missing `key` now returns a `VALIDATION_ERROR`. |
| 2 | `create_document`, `inspect_document` and `illustrator_status` reported a new unsaved document as `saved: true`, with a path inside Illustrator's install folder. | `illustrator-scripts/document.jsx`: a path is reported only if the file exists, and `saved` requires a real file. |
| 3 | `export_svg` silently re-targeted the open document to the `.svg` file (Illustrator 2026). The next save would overwrite the SVG, and PDF/EPS export refused to run. | `export.jsx`: when the document is saved, the `.ai` is reopened after export. With unsaved changes, a warning is returned instead. |
| 4 | `export_png`/`export_jpg` marked the document dirty, which blocked a later `export_pdf` ("save first"). | `export.jsx`: the document's previous `saved` state is restored after raster export. |
| 5 | `export_svg` timed out (over 60 s) on documents with text. It embedded full SVG-font glyph tables (1.6 MB, ignored by browsers). | `export.jsx`: `fontSubsetting = None` when text is not outlined. The export now takes about 4 s and about 8 KB, and keeps live `<text>`. |

## 7. Complete design (`pnpm test:e2e:design`): PASS
"AI MCP Integration Test": 1200 × 1200 px, dark navy background, three layers (Background, Artwork, Typography), 19 named objects, a linear gradient hero, and geometric artwork (hexagon, triangle, 4/5-point stars, orbit rings, satellites, accent diamonds). The heading and subtitle are centred on the artboard. The PNG was visually inspected and an overlapping divider was corrected.

| File | Size |
|---|---|
| `test-output/illustrator-mcp-test.ai` | ~302 KB |
| `test-output/illustrator-mcp-test.svg` | ~8 KB |
| `test-output/illustrator-mcp-test.png` | ~72 KB |
| `test-output/illustrator-mcp-test.pdf` | ~304 KB |

After all exports, the working file is still the `.ai` and its state is `saved`.

## 8. Error handling & stability: PASS (19/19)
No active document, negative or oversized dimensions, invalid hex color, missing font, unknown target, unsupported operation (`edit_text` on a non-text object), path outside the allowed directories, nonexistent drive, wrong export extension, refusal to overwrite without `overwrite: true`, destructive delete without `confirm`, 15 sequential calls, and 5 concurrent calls (queued). Each failure returns a structured `{code, message}`.

`pnpm test:e2e:reconnect` (run with Illustrator quit through COM):
- Auto-launch off: status reports not running, tool calls return `ILLUSTRATOR_NOT_RUNNING`, and the server keeps serving requests.
- Auto-launch on: the same server relaunched Illustrator (about 5 s) and real operations resumed.

## 9. Client compatibility

| Client | Transport | Status | Notes |
|---|---|---|---|
| Claude Desktop | stdio | **PARTIAL** | stdio was tested with the official SDK client. `examples/claude_desktop_config.json` is valid. Your Claude Desktop config was not modified, so the app itself was not connected. |
| Claude Code | stdio | **PARTIAL** | Same stdio path. `claude mcp add` was not run because it writes persistent config. |
| ChatGPT (developer-mode connector) | Streamable HTTP | **PARTIAL** | `pnpm test:e2e:http`: initialize, tools/list and a real Illustrator call pass with both a bearer token and a secret-path URL. Unauthenticated requests get 401. ChatGPT needs a public HTTPS URL (for example a tunnel), which was not set up, so a ChatGPT connection was not tested. |

## 9b. Advanced tools (`pnpm test:e2e:advanced`): PASS (44/44), 2026-11-09, Illustrator 30.8
Run with four other documents open. Pathfinder (5 operations, operands consumed), flip, anchor list/move/handles/convert/add/remove, reverse, close, split (open and closed), join, simplify (40 to 2 anchors),
undo/redo, artboard rename/duplicate/delete (delete is refused without confirm), list documents, typography analysis and role rules (dry run changes nothing; unknown font is an error),
design system save/list/apply (overwrite is refused), image info, relink keeping bounds, and Image Trace ("6 Colors") to a vector group. `pnpm test:e2e:design` was re-run and passes.

Bugs found in the existing code:
| # | Bug | Fix |
|---|---|---|
| 6 | With more than one document open, an object drawn in one call was not found by name in the next (`doc.pageItems` was stale), and right after `create_document`, `activeDocument` could still be the previous document. | `bootstrap.jsx`: `app.redraw()` at the start of each call, and the bridge pins and re-activates the target document. |

## 10. Remaining issues / recommended improvements
1. ~~Add an `edit_path_points` tool~~ (done).
2. MCP clients default to a 60 s request timeout, the same as `ILLUSTRATOR_TIMEOUT_MS`. A slow operation then fails on the client before the server can return `BRIDGE_TIMEOUT`. Consider defaulting the server timeout to about 50 s, or sending progress notifications.
3. Each call starts a new PowerShell process (about 2.5–3 s overhead). A persistent PowerShell or COM host would make multi-step designs much faster.
4. The JSX fixes above cannot be covered by the mock-based vitest suite. Run `pnpm test:e2e` on a Windows machine with Illustrator before each release.
