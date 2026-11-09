# Design plan schema

The structured intermediate representation lives in `src/schemas/design-plan.ts` (Zod) and is published as JSON
Schema via the MCP resource `illustrator://schema/design-plan`. Examples: [`examples/*.plan.json`](../examples).

## Top level

| Field | Type | Notes |
|---|---|---|
| `version` | `1` | |
| `meta` | object | `title`, `brief`, `category`, `style`, `audience`, `template`, `rationale[]` |
| `document` | object | `name`, `width`, `height`, `units` (`pt px mm cm in pc`, default `mm`), `colorMode` (`RGB`/`CMYK`) |
| `background` | union | `{type:"solid", color}` · `{type:"gradient", gradient}` · `{type:"none"}`. Built as a locked rect named `Background` on the bottom layer |
| `palette` | object | `name`, `colors: { role: "#RRGGBB" }` |
| `typography` | object | `heading`, `body`, `accent?` → `{ fonts: [candidates...], weight?, tracking? }` |
| `grid` | object? | `columns`, `margin`, `gutter` |
| `tokens` | object? | Design tokens: `spacing`, `radius`, `fontSize` (records of named values), `controlHeight`. See [UI_DESIGN.md](UI_DESIGN.md) |
| `autoLayout` | array? | Input only: auto-layout tree, flattened into `elements` (appended on top) before validation. See [UI_DESIGN.md](UI_DESIGN.md) |
| `layers` | array | Top-to-bottom. `{ name, locked? }` |
| `elements` | array | Bottom-to-top unless `z` is set |
| `swatches` | boolean | Add palette swatches to the document (default true) |
| `export` | object? | `formats[]`, `ppi` |

## Colors

A color is `#RRGGBB`/`#RGB` or a palette reference `palette.<role>`. Gradients: `{ type: "linear"|"radial", angle, stops: [{ color, position 0–100, opacity? }] }`.

## Elements

Common fields: `name` (unique — used for revisions), `layer` (must be declared), `x`, `y`, `rotation`, `opacity` (0–100),
`blendMode`, `effects[]` (`shadow`, `blur`, `innerGlow`, `outerGlow`), `z`, `locked`, `role`, `align`.

| `type` | Specific fields |
|---|---|
| `rect` | `width`, `height`, `cornerRadius?`, `fill`, `stroke` |
| `ellipse` | `width`, `height`, `fill`, `stroke` (x/y = top-left) |
| `circle` | `radius` (x/y = **center**) |
| `polygon` | `radius`, `sides` (center) |
| `star` | `radius`, `innerRadius`, `points` (center) |
| `line` | `x2`, `y2`, `stroke` |
| `path` | `points[{x,y,in?,out?,corner?}]`, `closed` |
| `text` | `content`, `fontRole`, `font?` (string or candidate list), `fontSize` (pt), `weight`, `color`, `textAlign`, `tracking`, `leading` (pt), `width`+`height` for area text, `caps` |
| `image` | `path`, `width`, `height`, `embed`, `fit` |

### Alignment and dependencies

`align: { relativeTo: "artboard" | "<element name>", horizontal?: left|center|right, vertical?: top|middle|bottom, offsetX, offsetY }`
resolves to absolute coordinates at compile time. References must exist and appear earlier in z-order; cycles are rejected.

## Validation

`validate_design_plan` / `validatePlan()` returns `{ valid, errors[], warnings[] }`:

- **Errors**: schema violations, duplicate layer/element names, undeclared layers, unresolved palette references,
  alignment cycles/unknown references, star inner ≥ outer radius, half-specified area text.
- **Warnings**: elements fully off the artboard, text contrast below WCAG (4.5:1, or 3:1 at ≥18 pt).
- Fonts and image files can only be checked against the real machine, so `execute_design_plan` preflights them:
  missing images become labelled placeholder frames, missing fonts produce warnings naming the fallback actually used.

## Example

```json
{
  "document": { "name": "Luxury Skincare Poster", "width": 210, "height": 297, "units": "mm", "colorMode": "CMYK" },
  "background": { "type": "solid", "color": "#E9DDCC" },
  "palette": { "name": "Luxe", "colors": { "text": "#29231E", "accent": "#C6A98A", "background": "#E9DDCC" } },
  "layers": [{ "name": "Typography" }, { "name": "Graphics" }, { "name": "Background", "locked": true }],
  "elements": [
    { "type": "circle", "name": "Decorative Element", "layer": "Graphics", "x": 105, "y": 140, "radius": 40, "fill": "palette.accent" },
    { "type": "text", "name": "Headline", "layer": "Typography", "content": "PURE BEAUTY", "fontSize": 48,
      "color": "palette.text", "align": { "relativeTo": "artboard", "horizontal": "center" }, "y": 30 }
  ]
}
```
