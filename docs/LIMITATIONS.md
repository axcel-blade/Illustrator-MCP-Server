# Known limitations

## Unverified

- ExtendScript operations are verified against **Illustrator 2026 (30.8) only** (see [TEST_REPORT.md](TEST_REPORT.md)).
  Older versions (2020+) are expected to work but are untested; `uuid` lookups need 2020+. Least-covered items: live-effect XML
  (`apply_shadow`, `apply_blur`, glows) and the `rulerType` preference codes (`set_document_units`).
- **ChatGPT** connectivity is unverified; the HTTP transport was tested locally only.

## By design / platform

- `undo` / `redo` step through Illustrator's own undo history, where one step is one internal change, not one tool call. Inspect the document after undoing.
- `simplify_path` removes anchors within a distance tolerance; Illustrator's Simplify command opens a dialog that scripts cannot drive. Handles of removed anchors are dropped.
- Opacity masks and pattern swatches cannot be created from scripting. Pathfinder runs through Live Pathfinder menu commands and is expanded immediately.
- `replace_image` relinks linked images only; an embedded image cannot be relinked.
- The server pins the document it last worked on. If you switch documents in Illustrator's UI, call `activate_document` (or `list_documents` and then `activate_document`) so the server follows.

- Windows only (COM). macOS would need an AppleScript or UXP adapter.
- Illustrator's scripting DOM cannot create **pattern swatches**; `create_pattern` builds a tiled clipping group instead and says so.
- `set_document_units` changes the session default and a ruler preference; `Document.rulerUnits` is read-only in scripting.
- PDF/EPS export uses `saveAs`, so the open document is re-targeted; the tool reopens the saved .ai afterwards and refuses to run on unsaved changes.
- Text sizes used for alignment *before* execution are estimates (0.55 em average glyph width). After execution, bounds come from Illustrator.
- The server does no image recognition. Visual critique depends on the AI client viewing the attached PNG preview.
- The brief planner is rule-based (keywords → category/style/colors). It is deterministic and explainable but not creative on its own;
  the AI client is expected to refine plans (`plan_design` → edit → `execute_design_plan`) for bespoke work.
- Each bridge call starts PowerShell (~0.2–0.4 s). Complex designs are batched into a single call.
- Only one Illustrator instance/user session is supported per server process.
- Auto layout is computed once by the server and flattened to positioned objects; Illustrator has no live auto layout,
  so moving or resizing an object later does not re-flow its siblings. Re-run `create_ui_design` (or revise the plan) to re-flow.
- Auto-layout text sizes are estimates, so a long label can be slightly wider or narrower than its slot in the real font.
- `rename_layers_semantically` looks at top-level objects of each layer (not inside groups) and needs Illustrator 2020+ (object `uuid`).
