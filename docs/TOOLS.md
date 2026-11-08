# MCP tool reference

Generated from the server (114 tools) by `node scripts/gen-docs.mjs`. Coordinates follow [COORDINATES.md](COORDINATES.md).

## `illustrator_status`

Detect installed Illustrator versions, COM registration and whether Illustrator is running. With probe: true also queries the running application (version, open documents) via a real script call.

| Parameter | Type | Notes |
|---|---|---|
| `probe` | boolean | Execute a status script inside Illustrator (may launch it if auto-launch is enabled) |

## `create_document`

Create a new Illustrator document. Size can be a paper preset (A4, Letter, ...) or width/height in the given units.

| Parameter | Type | Notes |
|---|---|---|
| `name` | string |  |
| `preset` | string |  |
| `width` | number |  |
| `height` | number |  |
| `units` | string |  |
| `orientation` | string |  |
| `colorMode` | string |  |
| `artboards` | integer |  |

## `open_document`

Open an existing .ai/.pdf/.eps/.svg file from an allowed directory.

| Parameter | Type | Notes |
|---|---|---|
| `path` * | string |  |

## `close_document`

Close a document. If it has unsaved changes you must pass save: true, or save: false together with confirm: true to discard them.

> Destructive — requires `confirm: true`.

| Parameter | Type | Notes |
|---|---|---|
| `name` | string | Document name; default active |
| `save` | boolean |  |
| `confirm` | boolean |  |

## `save_document`

Save the active document to its existing file.

## `save_document_as`

Save the active document as a native editable .ai file inside an allowed directory. Existing files are not overwritten unless overwrite: true.

| Parameter | Type | Notes |
|---|---|---|
| `path` * | string | Target .ai path (relative paths resolve inside the output directory) |
| `overwrite` | boolean |  |
| `pdfCompatible` | boolean |  |
| `embedLinkedFiles` | boolean |  |
| `embedICCProfile` | boolean |  |

## `inspect_document`

Read the active document: artboards, layers, and every top-level object with bounds (points, artboard top-left origin, y down), fills, strokes and text properties. These are verified Illustrator properties.

| Parameter | Type | Notes |
|---|---|---|
| `artboard` | integer |  |
| `deep` | boolean | Include group children |
| `limit` | integer |  |

## `get_artboards`

List artboards with sizes in points.

## `create_artboard`

Add an artboard. x/y are relative to artboard 0's top-left corner.

| Parameter | Type | Notes |
|---|---|---|
| `name` | string |  |
| `x` * | number |  |
| `y` * | number |  |
| `width` * | number |  |
| `height` * | number |  |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `resize_artboard`

Resize an artboard, anchored at its top-left or center.

| Parameter | Type | Notes |
|---|---|---|
| `index` | integer |  |
| `width` * | number |  |
| `height` * | number |  |
| `anchor` | string |  |
| `name` | string |  |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `set_document_units`

Set the default units this MCP session uses for tool coordinates, and write Illustrator's ruler-unit preference (the preference mapping is not documented by Adobe and is reported as unverified).

| Parameter | Type | Notes |
|---|---|---|
| `units` * | string |  |
| `applyToIllustrator` | boolean |  |

## `set_document_color_mode`

Convert the active document's color mode to RGB or CMYK (verified by reading documentColorSpace back).

| Parameter | Type | Notes |
|---|---|---|
| `mode` * | string |  |

## `draw_rectangle`

Draw a rectangle (optionally rounded). x/y = top-left from the artboard's top-left, y down.

| Parameter | Type | Notes |
|---|---|---|
| `x` * | number |  |
| `y` * | number |  |
| `width` * | number |  |
| `height` * | number |  |
| `cornerRadius` | number |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |
| `fill` | union | Hex fill or "none" (default gray for closed shapes) |
| `stroke` | union |  |
| `opacity` | number |  |
| `rotation` | number |  |

## `draw_circle`

Draw a circle from its center point and radius.

| Parameter | Type | Notes |
|---|---|---|
| `cx` * | number |  |
| `cy` * | number |  |
| `radius` * | number |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |
| `fill` | union | Hex fill or "none" (default gray for closed shapes) |
| `stroke` | union |  |
| `opacity` | number |  |
| `rotation` | number |  |

## `draw_ellipse`

Draw an ellipse by its bounding box (top-left x/y, width, height).

| Parameter | Type | Notes |
|---|---|---|
| `x` * | number |  |
| `y` * | number |  |
| `width` * | number |  |
| `height` * | number |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |
| `fill` | union | Hex fill or "none" (default gray for closed shapes) |
| `stroke` | union |  |
| `opacity` | number |  |
| `rotation` | number |  |

## `draw_polygon`

Draw a regular polygon centered at cx/cy.

| Parameter | Type | Notes |
|---|---|---|
| `cx` * | number |  |
| `cy` * | number |  |
| `radius` * | number |  |
| `sides` * | integer |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |
| `fill` | union | Hex fill or "none" (default gray for closed shapes) |
| `stroke` | union |  |
| `opacity` | number |  |
| `rotation` | number |  |

## `draw_star`

Draw a star centered at cx/cy with outer and inner radius.

| Parameter | Type | Notes |
|---|---|---|
| `cx` * | number |  |
| `cy` * | number |  |
| `radius` * | number |  |
| `innerRadius` * | number |  |
| `points` | integer |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |
| `fill` | union | Hex fill or "none" (default gray for closed shapes) |
| `stroke` | union |  |
| `opacity` | number |  |
| `rotation` | number |  |

## `draw_line`

Draw a straight line segment.

| Parameter | Type | Notes |
|---|---|---|
| `x1` * | number |  |
| `y1` * | number |  |
| `x2` * | number |  |
| `y2` * | number |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |
| `fill` | union | Hex fill or "none" (default gray for closed shapes) |
| `stroke` | union |  |
| `opacity` | number |  |
| `rotation` | number |  |

## `draw_pen_path`

Draw a Bezier path from anchor points with optional absolute in/out handles (like the Pen tool).

| Parameter | Type | Notes |
|---|---|---|
| `points` * | array |  |
| `closed` | boolean |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |
| `fill` | union | Hex fill or "none" (default gray for closed shapes) |
| `stroke` | union |  |
| `opacity` | number |  |
| `rotation` | number |  |

## `draw_freeform_path`

Draw a smooth freeform path through the given points (Catmull-Rom smoothing converted to Bezier handles).

| Parameter | Type | Notes |
|---|---|---|
| `points` * | array |  |
| `closed` | boolean |  |
| `smoothness` | number |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |
| `fill` | union | Hex fill or "none" (default gray for closed shapes) |
| `stroke` | union |  |
| `opacity` | number |  |
| `rotation` | number |  |

## `create_compound_path`

Combine paths into a compound path (overlaps become holes per even-odd/non-zero rules).

| Parameter | Type | Notes |
|---|---|---|
| `targets` * | array |  |
| `name` | string | Object name, used later to target it |
| `fill` | union |  |

## `create_clipping_mask`

Clip target objects with a mask shape (path, compound path or text). The mask's shape defines the visible region.

| Parameter | Type | Notes |
|---|---|---|
| `mask` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` * | array |  |
| `name` | string | Object name, used later to target it |

## `create_symbol`

Register an object as a reusable symbol in the document's Symbols panel; optionally replace it with an instance.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `name` * | string |  |
| `replaceWithInstance` | boolean |  |

## `create_pattern`

Tile an object across an area as an editable clipped group. Note: Illustrator's scripting API cannot create pattern swatches, so the result is a tiled group, not a swatch.

| Parameter | Type | Notes |
|---|---|---|
| `tile` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `x` * | number |  |
| `y` * | number |  |
| `width` * | number |  |
| `height` * | number |  |
| `gapX` | number |  |
| `gapY` | number |  |
| `offsetRows` | boolean |  |
| `removeTile` | boolean |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `add_text`

Add live, editable text. Point text by default; pass width+height for area text. Fonts are tried in order; unavailable fonts produce a warning and are never reported as applied.

| Parameter | Type | Notes |
|---|---|---|
| `content` * | string |  |
| `x` * | number |  |
| `y` * | number | Top of the text |
| `width` | number |  |
| `height` | number |  |
| `font` | union | PostScript name, 'Family Style', or a fallback list |
| `fontSize` | number | Points |
| `weight` | string |  |
| `color` | string | Hex color, e.g. #1A2B3C |
| `align` | string |  |
| `tracking` | number | 1/1000 em |
| `leading` | number | Points |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `edit_text`

Replace the text content of a text object, or replace occurrences of `find` with `content`.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `content` * | string |  |
| `find` | string |  |

## `set_font`

Set the typeface (PostScript name, 'Family Style', or fallback list). Returns an error if none of the fonts are installed.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `range` | object | Character range; default whole text |
| `font` * | union |  |

## `set_font_size`

Set font size in points.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `range` | object | Character range; default whole text |
| `fontSize` * | number |  |

## `set_font_weight`

Switch to another installed style of the same family (e.g. Bold). Warns if the family lacks that weight.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `range` | object | Character range; default whole text |
| `weight` * | string |  |

## `set_text_color`

Set text fill color.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `range` | object | Character range; default whole text |
| `color` * | string | Hex color, e.g. #1A2B3C |

## `set_paragraph_alignment`

Set paragraph justification.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `range` | object | Character range; default whole text |
| `align` * | string |  |

## `set_character_spacing`

Set tracking in 1/1000 em.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `range` | object | Character range; default whole text |
| `tracking` * | number |  |

## `set_line_spacing`

Set leading in points (disables auto leading).

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `range` | object | Character range; default whole text |
| `leading` * | number |  |

## `create_text_on_path`

Flow text along an existing open or closed path.

| Parameter | Type | Notes |
|---|---|---|
| `path` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `content` * | string |  |
| `font` | union |  |
| `fontSize` | number |  |
| `color` | string | Hex color, e.g. #1A2B3C |
| `tracking` | number |  |
| `name` | string | Object name, used later to target it |

## `convert_text_to_outlines`

Convert text to vector outlines (no longer editable as text). Useful before sending to print when fonts may be missing.

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |

## `inspect_fonts`

List installed fonts (optionally filtered) and fonts used in the active document. Use check to verify availability of specific fonts.

| Parameter | Type | Notes |
|---|---|---|
| `query` | string |  |
| `limit` | integer |  |
| `documentFonts` | boolean |  |
| `check` | array |  |

## `set_fill_color`

Set a solid fill (or none) on objects. For text objects this sets the text color.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `color` * | union |  |

## `set_gradient`

Apply a linear or radial gradient fill. Creates a named gradient swatch in the document.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `type` | string |  |
| `angle` | number |  |
| `name` | string |  |
| `stops` * | array |  |

## `set_stroke`

Set stroke color, width (pt), dashes, cap and join, or remove it with "none".

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `stroke` * | union |  |

## `set_opacity`

Set object opacity (0–100).

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `opacity` * | number |  |

## `set_blend_mode`

Set the transparency blend mode.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `mode` * | string |  |

## `apply_shadow`

Apply a live Drop Shadow effect (Illustrator CC 2018+ applyEffect). Offsets/blur in points.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `offsetX` | number |  |
| `offsetY` | number |  |
| `blur` | number |  |
| `opacity` | number |  |

## `apply_blur`

Apply a live Gaussian Blur effect (radius in pixels).

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `radius` | number |  |

## `apply_appearance`

Apply several appearance attributes in one call: fill, stroke, opacity, blend mode and effects.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `fill` | union |  |
| `stroke` | union |  |
| `opacity` | number |  |
| `blendMode` | string |  |
| `effects` | array |  |

## `create_color_palette`

Generate a role-based palette (background, surface, primary, secondary, accent, text, muted) from a base color and harmony rule, or return a curated style palette. Computed by the server; nothing is changed in Illustrator.

| Parameter | Type | Notes |
|---|---|---|
| `baseColor` | string |  |
| `harmony` | string |  |
| `style` | string |  |
| `dark` | boolean |  |

## `create_color_swatches`

Add named color swatches to the active document, optionally inside a swatch group.

| Parameter | Type | Notes |
|---|---|---|
| `group` | string |  |
| `colors` * | array |  |

## `apply_color_palette`

Recolor named objects by palette role, e.g. {palette:{primary:'#123456'}, assignments:[{name:'Headline', role:'primary'}]}.

| Parameter | Type | Notes |
|---|---|---|
| `palette` * | object |  |
| `assignments` * | array |  |

## `select_objects`

Select objects by explicit references or by filters (layer, Illustrator type such as PathItem/TextFrame, name substring). Locked/hidden objects are skipped by filters.

| Parameter | Type | Notes |
|---|---|---|
| `targets` | array | Multiple object references; defaults to current selection |
| `layer` | string |  |
| `type` | string |  |
| `nameContains` | string |  |

## `inspect_selection`

Describe the current selection (verified properties).

| Parameter | Type | Notes |
|---|---|---|
| `deep` | boolean |  |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |

## `move_object`

Move objects to an absolute top-left position (x/y) or by a relative offset (dx/dy).

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `x` | number |  |
| `y` | number |  |
| `dx` | number |  |
| `dy` | number |  |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `resize_object`

Resize to an absolute width/height or by scale percent. Proportions are kept when only one dimension is given.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `width` | number |  |
| `height` | number |  |
| `scale` | number | Percent |
| `keepProportions` | boolean |  |
| `scaleStrokes` | boolean |  |
| `anchor` | string |  |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `rotate_object`

Rotate objects by degrees (counter-clockwise positive, Illustrator convention) around an anchor.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `angle` * | number |  |
| `anchor` | string |  |

## `duplicate_object`

Duplicate objects, optionally repeatedly with a step offset (dx/dy per copy).

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `copies` | integer |  |
| `dx` | number |  |
| `dy` | number |  |
| `name` | string | Object name, used later to target it |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `delete_object`

Delete objects. Destructive: requires confirm: true after asking the user.

> Destructive — requires `confirm: true`.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `confirm` | boolean |  |

## `group_objects`

Group objects (they must share a layer; the group is placed on the first object's layer).

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `name` | string | Object name, used later to target it |

## `ungroup_objects`

Release groups into their children. Clipping groups require releaseClipping: true.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `releaseClipping` | boolean |  |

## `lock_objects`

Lock or unlock objects.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `locked` | boolean |  |

## `hide_objects`

Hide or show objects.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `hidden` | boolean |  |

## `rename_object`

Rename an object (multiple targets get numbered suffixes).

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `name` * | string |  |

## `set_object_z_order`

Change stacking order within the layer.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `order` * | string |  |

## `transform_objects`

Apply a combined transform: absolute position/size, scale %, rotation, relative offset and reflection, in that order.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `x` | number |  |
| `y` | number |  |
| `dx` | number |  |
| `dy` | number |  |
| `width` | number |  |
| `height` | number |  |
| `keepProportions` | boolean |  |
| `scale` | number |  |
| `scaleX` | number |  |
| `scaleY` | number |  |
| `rotation` | number |  |
| `reflect` | string |  |
| `anchor` | string |  |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `align_objects`

Align objects' edges or centers relative to their combined bounds, the artboard, or a key object.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `alignment` * | string |  |
| `relativeTo` | string |  |
| `key` | object | Object reference: "selection" or {name, layer?} / {uuid} |

## `distribute_objects`

Distribute 3+ objects with equal gaps along an axis, or apply an explicit spacing.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `axis` | string |  |
| `spacing` | number |  |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `arrange_objects`

Arrange objects into a row, column or grid with a uniform gap, starting at x/y (default: current top-left).

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `mode` | string |  |
| `columns` | integer |  |
| `gap` | number |  |
| `x` | number |  |
| `y` | number |  |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `center_on_artboard`

Center objects (as a unit) on the artboard horizontally, vertically or both.

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `axis` | string |  |

## `calculate_object_bounds`

Return geometric and visible bounds of objects and their union (points, artboard top-left origin).

| Parameter | Type | Notes |
|---|---|---|
| `target` | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |

## `create_guides`

Create ruler-style guides at positions on a dedicated, locked Guides layer.

| Parameter | Type | Notes |
|---|---|---|
| `lines` * | array |  |
| `layer` | string |  |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `create_grid`

Draw a visible grid of thin lines as artwork (use create_layout_guides for non-printing guides).

| Parameter | Type | Notes |
|---|---|---|
| `x` | number |  |
| `y` | number |  |
| `width` * | number |  |
| `height` * | number |  |
| `cellWidth` * | number |  |
| `cellHeight` * | number |  |
| `color` | string | Hex color, e.g. #1A2B3C |
| `strokeWidth` | number |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `apply_margins`

Add margin guides inset from every artboard edge.

| Parameter | Type | Notes |
|---|---|---|
| `margin` * | number |  |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `create_layout_guides`

Create a column/row grid as guides: margins, columns and gutters (e.g. 12-column grid).

| Parameter | Type | Notes |
|---|---|---|
| `columns` | integer |  |
| `rows` | integer |  |
| `margin` | number |  |
| `gutter` | number |  |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `create_layout`

Set up a document layout in one step: standard layer stack (Typography, Graphics, Images, Background) plus margin/column guides.

| Parameter | Type | Notes |
|---|---|---|
| `columns` | integer |  |
| `rows` | integer |  |
| `margin` | number |  |
| `gutter` | number |  |
| `layers` | array |  |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `balance_composition`

Measure visual balance (area-weighted center vs. artboard center). With apply: true, shifts the given targets (or all unlocked non-background content) so the visual center moves toward the artboard center by `strength`.

| Parameter | Type | Notes |
|---|---|---|
| `apply` | boolean |  |
| `strength` | number |  |
| `axis` | string |  |
| `targets` | array | Multiple object references; defaults to current selection |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |

## `inspect_layers`

List layers top-to-bottom with visibility, lock state and item counts.

## `create_layer`

Create a new layer at the top (default) or bottom of the stack.

| Parameter | Type | Notes |
|---|---|---|
| `name` * | string |  |
| `position` | string |  |
| `color` | string | Layer highlight color |

## `delete_layer`

Delete a layer and everything on it. Destructive: requires confirm: true.

> Destructive — requires `confirm: true`.

| Parameter | Type | Notes |
|---|---|---|
| `name` * | string |  |
| `confirm` | boolean |  |

## `rename_layer`

Rename a layer.

| Parameter | Type | Notes |
|---|---|---|
| `name` * | string |  |
| `newName` * | object |  |

## `select_layer`

Make a layer the active layer (new objects without an explicit layer go here).

| Parameter | Type | Notes |
|---|---|---|
| `name` * | string |  |

## `lock_layer`

Lock or unlock a layer.

| Parameter | Type | Notes |
|---|---|---|
| `name` * | string |  |
| `locked` | boolean |  |

## `hide_layer`

Hide or show a layer.

| Parameter | Type | Notes |
|---|---|---|
| `name` * | string |  |
| `hidden` | boolean |  |

## `move_object_to_layer`

Move objects to another layer (create: true makes the layer if missing).

| Parameter | Type | Notes |
|---|---|---|
| `target` * | union | Object reference: "selection" or {name, layer?} / {uuid} |
| `layer` * | string |  |
| `create` | boolean |  |

## `reorder_layers`

Reorder layers. `order` lists layer names top-to-bottom; unlisted layers stay below.

| Parameter | Type | Notes |
|---|---|---|
| `order` * | array |  |

## `export_png`

Export artboards to PNG-24. Resolution via ppi (72 = 1:1) or a target pixel width. Clipped to the artboard.

| Parameter | Type | Notes |
|---|---|---|
| `path` * | string |  |
| `overwrite` | boolean |  |
| `artboards` | array | Artboard indexes; default active artboard. Multiple artboards get -N suffixes. |
| `ppi` | number |  |
| `width` | integer |  |
| `transparent` | boolean |  |
| `antiAliasing` | boolean |  |

## `export_jpg`

Export artboards to JPEG.

| Parameter | Type | Notes |
|---|---|---|
| `path` * | string |  |
| `overwrite` | boolean |  |
| `artboards` | array | Artboard indexes; default active artboard. Multiple artboards get -N suffixes. |
| `ppi` | number |  |
| `width` | integer |  |
| `quality` | integer |  |
| `antiAliasing` | boolean |  |

## `export_svg`

Export to SVG with configurable coordinate precision; optionally outline text.

| Parameter | Type | Notes |
|---|---|---|
| `path` * | string |  |
| `overwrite` | boolean |  |
| `artboard` | integer |  |
| `precision` | integer |  |
| `outlineText` | boolean |  |
| `embedImages` | boolean |  |

## `export_pdf`

Export to PDF. The document must be saved as .ai first (it is reopened afterwards so the .ai stays the working file), unless allowRetarget: true.

| Parameter | Type | Notes |
|---|---|---|
| `path` * | string |  |
| `overwrite` | boolean |  |
| `compatibility` | string |  |
| `preset` | string | Named PDF preset, e.g. [PDF/X-4:2008] |
| `artboards` | string | Range like '1-3,5' (1-based) |
| `preserveEditability` | boolean |  |
| `allowRetarget` | boolean |  |

## `export_eps`

Export to EPS (same save-first rule as export_pdf).

| Parameter | Type | Notes |
|---|---|---|
| `path` * | string |  |
| `overwrite` | boolean |  |
| `artboards` | string |  |
| `embedFonts` | boolean |  |
| `allowRetarget` | boolean |  |

## `export_multiple_formats`

Export the active document to several formats sharing a base path (extension added per format). Each format is reported individually; one failure does not hide others.

| Parameter | Type | Notes |
|---|---|---|
| `basePath` * | string | Path without extension |
| `formats` * | array |  |
| `ppi` | number |  |
| `overwrite` | boolean |  |
| `allowRetarget` | boolean |  |

## `generate_export_preview`

Export a real PNG preview of an artboard and return it as an image so the AI client can look at the artwork. If no file could be produced, no image is returned.

| Parameter | Type | Notes |
|---|---|---|
| `artboard` | integer |  |
| `maxWidthPx` | integer |  |

## `place_image`

Place an image from an allowed directory as a linked file, or embed it. Width/height fit proportionally unless fit: 'stretch'. Missing files return FILE_NOT_FOUND.

| Parameter | Type | Notes |
|---|---|---|
| `path` * | string |  |
| `x` | number |  |
| `y` | number |  |
| `width` | number |  |
| `height` | number |  |
| `fit` | string |  |
| `embed` | boolean |  |
| `name` | string | Object name, used later to target it |
| `layer` | string | Target layer name (created if missing) |
| `artboard` | integer | Artboard index used as the coordinate origin (default: active) |
| `units` | string | Units for coordinates/sizes in this call (default: session units, initially pt) |

## `inspect_assets`

List linked and embedded images in the active document and report linked files that are missing on disk.

## `embed_images`

Embed linked images (all, or one by name) so the .ai no longer depends on external files.

| Parameter | Type | Notes |
|---|---|---|
| `name` | string |  |

## `list_templates`

List professional design templates and supported styles.

## `plan_design`

Turn a brief into a structured, validated design plan (JSON) WITHOUT touching Illustrator. Inspect or edit it, then call execute_design_plan.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean |  |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `validate_design_plan`

Validate a design plan against the schema plus semantic rules (layer references, palette references, alignment dependencies, contrast).

| Parameter | Type | Notes |
|---|---|---|
| `plan` * | object |  |

## `execute_design_plan`

Execute a stored plan (planId) or an inline plan in Illustrator: creates a new document with layers and editable objects, verifies the result by inspection, and attaches a preview.

| Parameter | Type | Notes |
|---|---|---|
| `planId` | string |  |
| `version` | integer |  |
| `plan` | object |  |
| `preview` | boolean |  |
| `saveAs` | string |  |
| `overwrite` | boolean |  |

## `get_design_plan`

Return a stored design plan (latest version unless version is given), or list all plans when planId is omitted.

| Parameter | Type | Notes |
|---|---|---|
| `planId` | string |  |
| `version` | integer |  |

## `compare_design_versions`

Diff two versions of a stored plan: added/removed/changed elements, palette and document changes.

| Parameter | Type | Notes |
|---|---|---|
| `planId` * | string |  |
| `from` * | integer |  |
| `to` * | integer |  |

## `generate_design`

Full pipeline from a brief: analyze requirements (category, audience, style, size), plan hierarchy/palette/typography/layers, validate, build editable artwork in Illustrator, verify by inspection and return a preview.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |
| `category` | string |  |

## `create_logo`

Create a minimalist logo lockup (mark, wordmark, tagline) as editable vectors. Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_poster`

Create a poster with hero image area, headline hierarchy and footer CTA. Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_flyer`

Create a flyer with color block, headline, offer list and CTA button. Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_social_media_graphic`

Create a social media graphic (default 1080×1080 px). Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_business_card`

Create a business card front (85×55 mm, CMYK). Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_brand_identity`

Create a brand identity board: logo lockup, palette swatches with hex labels, type specimens. Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_packaging_design`

Create a flat packaging layout with panels, dieline layer and front artwork. Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_infographic`

Create an infographic with numbered stat rows and bars. Pass copy.items as the data labels. Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_icon_set`

Create a consistent geometric icon set on shared keylines. Pass copy.items as icon labels. Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_vector_illustration`

Create a layered flat vector illustration (landscape scene). Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `create_editorial_layout`

Create an editorial magazine page with kicker, title, deck, columns and pull quote. Same options as generate_design.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean | false = return the plan only |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |

## `revise_design`

Apply targeted revisions to an executed plan without rebuilding: structured updates by element name, additions, removals, palette role changes, and simple instructions ("make the headline bigger", "change background to navy", "move logo up"). Unparsed instructions are reported, not guessed.

| Parameter | Type | Notes |
|---|---|---|
| `planId` * | string |  |
| `instructions` | string |  |
| `updates` | array |  |
| `add` | array |  |
| `remove` | array |  |
| `palette` | object |  |
| `apply` | boolean |  |
| `preview` | boolean |  |

## `analyze_composition`

Analyze the active document from verified Illustrator properties: margins, alignment near-misses, spacing rhythm, type scale, hierarchy, contrast, overlap and visual balance. Returns a score and findings with suggested fixes. This is geometric analysis, not visual perception.

| Parameter | Type | Notes |
|---|---|---|
| `artboard` | integer |  |

## `critique_design`

Critique the active design: verified property analysis plus an actual exported preview image attached for the AI client's own visual assessment. The server does not perform image recognition; any visual judgement must come from the client viewing the attached image.

| Parameter | Type | Notes |
|---|---|---|
| `artboard` | integer |  |
| `goals` | string | What the design should achieve |

## `improve_design`

Apply the automatic fixes suggested by analyze_composition (margins, alignment snaps, contrast, minimum size, hierarchy) as targeted edits, then re-analyze and report before/after scores. Use dryRun to preview the changes.

| Parameter | Type | Notes |
|---|---|---|
| `categories` | array |  |
| `findingIds` | array |  |
| `dryRun` | boolean |  |
| `preview` | boolean |  |
| `artboard` | integer |  |

## `generate_design_variations`

Generate N variations of a brief by changing one dimension each (style, palette harmony, or layout). Returns plans; with execute: true each is built as its own document with a preview.

| Parameter | Type | Notes |
|---|---|---|
| `brief` * | string | Natural-language design brief. Quote exact copy, e.g. headline "PURE BEAUTY". |
| `style` | string |  |
| `template` | string | Template id (see list_templates) |
| `copy` | object |  |
| `baseColor` | string | Derive the palette from this color |
| `harmony` | string |  |
| `palette` | object | Override palette roles, e.g. {background:'#E9DDCC'} |
| `size` | object |  |
| `colorMode` | string |  |
| `imagePath` | string | Image to place (must be inside an allowed directory) |
| `execute` | boolean |  |
| `preview` | boolean | Export and attach a PNG preview after execution |
| `saveAs` | string | Save the result as this .ai path |
| `count` | integer |  |
| `dimension` | string |  |
