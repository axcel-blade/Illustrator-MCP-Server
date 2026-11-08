# Coordinate convention

One convention is used by every MCP tool and by the design-plan schema:

- **Origin**: the top-left corner of the target artboard (the active artboard unless a tool takes `artboard`).
- **Axes**: `x` grows to the right, `y` grows **down** (like CSS/SVG).
- **Units**: tools use the session units (initially `pt`; change with `set_document_units` or pass `units` per call).
  Design plans use `document.units` (default `mm`).
- **Font sizes, leading, stroke widths and effect offsets are always points**, regardless of units.
- **Shapes**: `x`/`y` is the top-left of the bounding box, except `circle`, `polygon` and `star`, where `x`/`y` (or `cx`/`cy`) is the center.
- **Text**: `y` is the top of the text bounds. For point text with `align: center|right`, `x` is the anchor line.
- **Bounds returned by inspect tools** are in points in the same space: `{ x, y, width, height }`.

Illustrator's scripting artboard coordinate system has y growing **up**; the bridge negates y
(`toIllustratorPoint` in `src/utils/units.ts`, `MCP.box`/`MCP.moveTo` in `illustrator-scripts/bootstrap.jsx`).

| Unit | Points |
|------|--------|
| pt, px | 1 |
| pc | 12 |
| in | 72 |
| cm | 28.3465 |
| mm | 2.83465 |
