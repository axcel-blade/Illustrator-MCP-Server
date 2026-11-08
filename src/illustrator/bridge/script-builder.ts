import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../config/index.js";

export const SCRIPT_DIR = join(PROJECT_ROOT, "illustrator-scripts");
const MODULES = ["bootstrap.jsx", "document.jsx", "shapes.jsx", "typography.jsx", "objects.jsx", "layers.jsx", "export.jsx", "design.jsx"];

/**
 * Operations the JSX layer implements. The bridge refuses anything else before Illustrator
 * is contacted, and the JSX dispatcher refuses again on its side.
 */
export const ALLOWED_OPS = new Set([
  "status", "create_document", "open_document", "close_document", "save_document", "save_document_as",
  "inspect_document", "get_artboards", "create_artboard", "resize_artboard", "set_document_color_mode",
  "set_document_units", "place_image", "inspect_assets", "embed_images",
  "draw_rectangle", "draw_ellipse", "draw_polygon", "draw_star", "draw_line", "draw_pen_path",
  "create_compound_path", "create_clipping_mask", "create_symbol", "create_pattern",
  "add_text", "style_text", "edit_text", "create_text_on_path", "convert_text_to_outlines", "inspect_fonts", "check_fonts",
  "select_objects", "inspect_selection", "transform_objects", "duplicate_object", "delete_object", "group_objects",
  "ungroup_objects", "set_properties", "set_z_order", "set_appearance", "apply_effect", "create_swatches",
  "align_objects", "distribute_objects", "arrange_objects", "center_on_artboard", "calculate_object_bounds",
  "create_guides", "create_grid",
  "inspect_layers", "create_layer", "delete_layer", "update_layer", "move_object_to_layer", "reorder_layers",
  "export_png", "export_jpg", "export_svg", "export_pdf", "export_eps",
  "execute_plan", "update_elements",
]);

let cachedLibrary: string | undefined;

export function loadScriptLibrary(): string {
  if (!cachedLibrary) {
    cachedLibrary = MODULES.map((m) => `// ---- ${m} ----\n` + readFileSync(join(SCRIPT_DIR, m), "utf8")).join("\n");
  }
  return cachedLibrary;
}

/** JSON is valid ES3 when non-ASCII and the U+2028/9 separators are escaped. */
export function toJsxLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export function buildScript(op: string, args: unknown, resultPath: string): string {
  const command = toJsxLiteral({ op, args });
  const result = toJsxLiteral(resultPath);
  return `${loadScriptLibrary()}\n// ---- invocation ----\nMCP.main(${command}, ${result});\n`;
}
