import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsxColor } from "../../design-engine/compiler.js";
import { HexColorSchema } from "../../utils/colors.js";
import { McpDesignError } from "../../utils/errors.js";
import { IMAGE_EXTENSIONS } from "./assets.js";
import {
  artboardArg, DESTRUCTIVE, defineTool, nameArg, op, P, READ_ONLY, requireConfirm, targetArg, targetsArg, unitsArg, WRITE, type ToolContext,
} from "./common.js";
import { DesignSystemSchema, DesignSystemStore, type TypeRole } from "../../design-engine/design-system-store.js";

const handle = z.tuple([z.number(), z.number()]);

interface TypeStyle { font: string | null; family: string | null; size: number; count: number; objects: string[] }

/** Flag type-system problems from analyze_typography output. Pure, so it is unit-tested. */
export function typographyIssues(r: { styles: TypeStyle[]; familyCount: number; sizeCount: number }): string[] {
  const issues: string[] = [];
  const missing = r.styles.filter((s) => !s.font);
  if (missing.length) issues.push(`${missing.reduce((n, s) => n + s.count, 0)} text object(s) use a font that is not installed (shown as missing).`);
  if (r.familyCount > 2) issues.push(`${r.familyCount} font families are in use; most designs read best with 1–2.`);
  if (r.sizeCount > 6) issues.push(`${r.sizeCount} different font sizes; consolidate to a type scale of about 4–6 steps.`);
  const sizes = [...new Set(r.styles.map((s) => Math.round(s.size * 10) / 10))].sort((a, b) => a - b);
  for (let i = 1; i < sizes.length; i++) {
    const a = sizes[i - 1]!, b = sizes[i]!;
    if (b / a < 1.12) issues.push(`Sizes ${a}pt and ${b}pt are too close to read as different levels; merge them or increase the contrast.`);
  }
  const tiny = r.styles.filter((s) => s.size < 6);
  if (tiny.length) issues.push(`${tiny.reduce((n, s) => n + s.count, 0)} text object(s) are under 6pt, which is hard to read in print.`);
  return issues;
}

const typeRule = z.object({
  role: z.string().min(1).max(60).describe('Label for reporting, e.g. "heading"'),
  font: z.string().min(1).max(200).optional().describe('PostScript name or "Family Style", e.g. "Montserrat Bold"'),
  size: z.number().positive().max(2000).optional().describe("New size in pt"),
  minSize: z.number().min(0).optional().describe("Match text whose current size is >= this (pt)"),
  maxSize: z.number().min(0).optional().describe("Match text whose current size is <= this (pt)"),
  layer: z.string().optional(),
  nameContains: z.string().optional(),
  tracking: z.number().min(-1000).max(10000).optional(),
  leading: z.number().positive().optional(),
  color: HexColorSchema.optional(),
});

function rolesToRules(roles: TypeRole[]) {
  return roles.map((r) => ({ ...r, color: r.color ? jsxColor(r.color) : undefined }));
}

export function registerAdvancedTools(server: McpServer, ctx: ToolContext): void {
  const store = new DesignSystemStore(ctx.config.outputDir);

  /* ---------------- shape operations ---------------- */
  defineTool(server, ctx, {
    name: "pathfinder",
    description: "Pathfinder boolean operation on 2+ objects: unite (union), minusFront (subtract front from back), intersect, exclude, divide, minusBack. Result is expanded, editable vector paths.",
    input: { operation: z.enum(["unite", "minusFront", "intersect", "exclude", "divide", "minusBack"]), targets: z.array(targetArg).min(2).max(500), name: nameArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "pathfinder", a),
  });

  defineTool(server, ctx, {
    name: "flip_objects",
    description: "Mirror objects horizontally or vertically about their own center.",
    input: { targets: targetsArg, axis: z.enum(["horizontal", "vertical"]) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "flip_objects", a),
  });

  /* ---------------- path editing ---------------- */
  defineTool(server, ctx, {
    name: "edit_path_points",
    description:
      "Inspect or edit a path's anchor points. action: list | move (index, x, y; handles move along unless in/out given) | set_handles (index, in?, out?, pointType?) | " +
      "convert (index → corner) | add (after index at x/y, or at the segment midpoint) | remove (index). Coordinates are absolute, artboard origin, y down.",
    input: {
      target: targetArg, action: z.enum(["list", "move", "set_handles", "convert", "add", "remove"]),
      index: z.number().int().min(0).optional(), x: z.number().optional(), y: z.number().optional(),
      in: handle.optional().describe("Incoming handle (absolute)"), out: handle.optional().describe("Outgoing handle (absolute)"),
      pointType: z.enum(["smooth", "corner"]).optional(), artboard: artboardArg, units: unitsArg,
    },
    annotations: WRITE,
    handler: async (a) => {
      if (["move", "set_handles", "convert", "remove"].includes(a.action) && a.index === undefined) throw new McpDesignError("VALIDATION_ERROR", `action "${a.action}" needs index`);
      if (a.action === "move" && (a.x === undefined || a.y === undefined)) throw new McpDesignError("VALIDATION_ERROR", 'action "move" needs x and y');
      const p = P(ctx, a.units);
      const h = (v?: [number, number]) => (v ? [p(v[0]), p(v[1])] : undefined);
      return op(ctx, "edit_path_points", { ...a, units: undefined, x: p(a.x), y: p(a.y), in: h(a.in), out: h(a.out) });
    },
  });

  defineTool(server, ctx, {
    name: "reverse_path",
    description: "Reverse a path's direction (point order and handles).",
    input: { target: targetArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "reverse_path", a),
  });

  defineTool(server, ctx, {
    name: "set_path_closed",
    description: "Close an open path (adds the segment from the last to the first anchor) or open a closed one.",
    input: { target: targetArg, closed: z.boolean() },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_path_closed", a),
  });

  defineTool(server, ctx, {
    name: "split_path",
    description: "Split a path at an anchor index. An open path becomes two paths; a closed path becomes one open path starting at that anchor.",
    input: { target: targetArg, index: z.number().int().min(0) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "split_path", a),
  });

  defineTool(server, ctx, {
    name: "join_paths",
    description: "Join open paths at their endpoints (Illustrator's Object > Path > Join).",
    input: { targets: z.array(targetArg).min(2).max(100), name: nameArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "join_paths", a),
  });

  defineTool(server, ctx, {
    name: "simplify_path",
    description:
      "Reduce anchor points: removes anchors whose removal moves the outline less than `tolerance` (Ramer–Douglas–Peucker over anchors). " +
      "Illustrator's own Simplify dialog cannot be driven by scripts, so this is an alternative; curve handles of removed anchors are dropped.",
    input: { target: targetArg, tolerance: z.number().positive().max(1000).default(1), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "simplify_path", { target: a.target, tolerance: P(ctx, a.units)(a.tolerance) }),
  });

  /* ---------------- images ---------------- */
  defineTool(server, ctx, {
    name: "get_image_info",
    description: "Report linked/embedded images: kind, file path, whether the link exists, placed bounds, effective PPI. Omit target for all images. Images are reported as raster (isVector: false).",
    input: { target: targetArg.optional() },
    annotations: READ_ONLY,
    handler: async (a) => {
      const r = await ctx.bridge.run<{ missingLinks: number }>("get_image_info", a);
      const warnings = [...r.warnings];
      if (r.data.missingLinks) warnings.push(`${r.data.missingLinks} linked image(s) are missing on disk.`);
      return { data: r.data, warnings };
    },
  });

  defineTool(server, ctx, {
    name: "replace_image",
    description: "Relink a linked image to another file from an allowed directory, keeping its position and size unless keepBounds: false.",
    input: { target: targetArg, path: z.string().min(1), keepBounds: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "replace_image", { ...a, path: ctx.paths.resolve(a.path, { extensions: IMAGE_EXTENSIONS, mustExist: true }) }),
  });

  defineTool(server, ctx, {
    name: "trace_image",
    description:
      "Convert a placed or raster image to vector paths with Illustrator's Image Trace. preset: an Illustrator tracing preset name (e.g. \"[Default]\", \"Black and White Logo\", \"6 Colors\", \"High Fidelity Photo\"). " +
      "expand (default true) produces editable paths; expand: false leaves a live trace object, which is NOT editable vector yet.",
    input: { target: targetArg, preset: z.string().max(120).optional(), expand: z.boolean().default(true), name: nameArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "trace_image", a),
  });

  /* ---------------- artboards & documents ---------------- */
  defineTool(server, ctx, {
    name: "rename_artboard",
    description: "Rename an artboard by index.",
    input: { index: z.number().int().min(0), name: z.string().min(1).max(120) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "rename_artboard", a),
  });

  defineTool(server, ctx, {
    name: "duplicate_artboard",
    description: "Duplicate an artboard, placed to its right (gap) or at dx/dy offset, copying the unlocked artwork that lies fully inside it.",
    input: { index: z.number().int().min(0), name: z.string().min(1).max(120).optional(), gap: z.number().min(0).default(40), dx: z.number().optional(), dy: z.number().optional(), withArtwork: z.boolean().default(true), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "duplicate_artboard", { ...a, units: undefined, gap: p(a.gap), dx: p(a.dx), dy: p(a.dy) });
    },
  });

  defineTool(server, ctx, {
    name: "delete_artboard",
    description: "Delete an artboard (artwork on it is kept). Destructive: requires confirm: true after asking the user.",
    input: { index: z.number().int().min(0), confirm: z.boolean().optional() },
    annotations: DESTRUCTIVE,
    handler: async (a) => {
      requireConfirm(a.confirm, "Deleting an artboard");
      return op(ctx, "delete_artboard", { index: a.index });
    },
  });

  defineTool(server, ctx, {
    name: "list_documents",
    description: "List all open Illustrator documents with path, saved state, color mode and which one is active.",
    input: {},
    annotations: READ_ONLY,
    handler: async () => op(ctx, "list_documents", {}),
  });

  defineTool(server, ctx, {
    name: "activate_document",
    description: "Make an open document active, by name or by index from list_documents.",
    input: { name: z.string().optional(), index: z.number().int().min(0).optional() },
    annotations: WRITE,
    handler: async (a) => {
      if (a.name === undefined && a.index === undefined) throw new McpDesignError("VALIDATION_ERROR", "Provide name or index");
      return op(ctx, "activate_document", a);
    },
  });

  defineTool(server, ctx, {
    name: "undo",
    description:
      "Undo Illustrator steps in the active document. One step is one internal Illustrator change, not one tool call (a tool that draws 3 shapes creates about 3 steps), " +
      "so inspect the document afterwards. Use redo to step forward again.",
    input: { steps: z.number().int().min(1).max(200).default(1) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "undo", a),
  });

  defineTool(server, ctx, {
    name: "redo",
    description: "Redo steps previously undone with undo.",
    input: { steps: z.number().int().min(1).max(200).default(1) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "redo", a),
  });

  /* ---------------- typography ---------------- */
  defineTool(server, ctx, {
    name: "analyze_typography",
    description: "Group all text in the active document by font and size, flag inconsistencies (too many families/sizes, near-duplicate sizes, missing fonts, tiny text). Read-only.",
    input: {},
    annotations: READ_ONLY,
    handler: async () => {
      const r = await ctx.bridge.run<{ styles: TypeStyle[]; familyCount: number; sizeCount: number }>("analyze_typography", {});
      return { data: { ...r.data, issues: typographyIssues(r.data) }, warnings: r.warnings };
    },
  });

  defineTool(server, ctx, {
    name: "apply_typography",
    description:
      "Apply fonts/sizes by role across all text, e.g. headings (minSize 24) → \"Montserrat Bold\", body (maxSize 14) → \"Inter Regular\". " +
      "First matching rule wins; locked text is skipped. Use dryRun: true to preview which objects would change.",
    input: { rules: z.array(typeRule).min(1).max(20), dryRun: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "apply_typography_roles", { rules: rolesToRules(a.rules), dryRun: a.dryRun }),
  });

  /* ---------------- design systems ---------------- */
  defineTool(server, ctx, {
    name: "save_design_system",
    description:
      "Store a reusable design system (palette roles, typography roles, spacing scale, grid, logo variants, guidelines) on disk so it can be applied to any document. " +
      "Saving under an existing name requires overwrite: true.",
    input: { system: DesignSystemSchema, overwrite: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => ({ data: store.save(a.system, a.overwrite), source: "server" }),
  });

  defineTool(server, ctx, {
    name: "list_design_systems",
    description: "List stored design systems.",
    input: {},
    annotations: READ_ONLY,
    handler: async () => ({ data: { systems: store.list() }, source: "server" }),
  });

  defineTool(server, ctx, {
    name: "get_design_system",
    description: "Read a stored design system by name.",
    input: { name: z.string().min(1).max(120) },
    annotations: READ_ONLY,
    handler: async (a) => ({ data: store.get(a.name), source: "server" }),
  });

  defineTool(server, ctx, {
    name: "apply_design_system",
    description:
      "Apply a stored design system to the active document: adds its palette as a swatch group and applies its typography roles to matching text. " +
      "Recolor specific objects afterwards with apply_color_palette using the returned palette.",
    input: { name: z.string().min(1).max(120), swatches: z.boolean().default(true), typography: z.boolean().default(true), dryRun: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => {
      const sys = store.get(a.name);
      const result: Record<string, unknown> = { system: sys.name, palette: sys.palette };
      const warnings: string[] = [];
      if (a.swatches && !a.dryRun) {
        const colors = Object.entries(sys.palette).map(([role, hex]) => ({ name: role, color: jsxColor(hex) }));
        const r = await ctx.bridge.run("create_swatches", { group: sys.name, colors });
        result.swatches = r.data; warnings.push(...r.warnings);
      }
      if (a.typography && sys.typography.length) {
        const r = await ctx.bridge.run("apply_typography_roles", { rules: rolesToRules(sys.typography), dryRun: a.dryRun });
        result.typography = r.data; warnings.push(...r.warnings);
      }
      return { data: result, warnings };
    },
  });
}
