import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeComposition, type InspectedItem } from "../../design-engine/composition/analyzer.js";
import { artboardArg, colorArg, color, defineTool, layerArg, nameArg, op, P, READ_ONLY, targetArg, targetsArg, unitsArg, WRITE, type ToolContext } from "./common.js";

const tgt = { target: targetArg.optional(), targets: targetsArg, artboard: artboardArg };

interface Inspection { artboards: { index: number; width: number; height: number; active: boolean }[]; items: InspectedItem[] }

/** Column/row guide positions for a layout grid (points). */
export function gridGuides(W: number, H: number, opts: { columns: number; rows: number; margin: number; gutter: number; rowGutter?: number }) {
  const lines: { orientation: "vertical" | "horizontal"; position: number; name: string }[] = [];
  const m = opts.margin;
  lines.push({ orientation: "vertical", position: m, name: "Margin Left" }, { orientation: "vertical", position: W - m, name: "Margin Right" });
  lines.push({ orientation: "horizontal", position: m, name: "Margin Top" }, { orientation: "horizontal", position: H - m, name: "Margin Bottom" });
  const colW = (W - 2 * m - opts.gutter * (opts.columns - 1)) / opts.columns;
  for (let i = 1; i < opts.columns; i++) {
    const x = m + i * colW + (i - 1) * opts.gutter;
    lines.push({ orientation: "vertical", position: x, name: `Col ${i} End` });
    if (opts.gutter > 0) lines.push({ orientation: "vertical", position: x + opts.gutter, name: `Col ${i + 1} Start` });
  }
  const rg = opts.rowGutter ?? opts.gutter;
  const rowH = (H - 2 * m - rg * (opts.rows - 1)) / opts.rows;
  for (let i = 1; i < opts.rows; i++) {
    const y = m + i * rowH + (i - 1) * rg;
    lines.push({ orientation: "horizontal", position: y, name: `Row ${i} End` });
    if (rg > 0) lines.push({ orientation: "horizontal", position: y + rg, name: `Row ${i + 1} Start` });
  }
  return { lines, columnWidth: colW, rowHeight: rowH };
}

export function registerLayoutTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "align_objects",
    description: "Align objects' edges or centers relative to their combined bounds, the artboard, or a key object.",
    input: { ...tgt, alignment: z.enum(["left", "center", "right", "top", "middle", "bottom"]), relativeTo: z.enum(["selection", "artboard", "key"]).default("selection"), key: targetArg.optional() },
    annotations: WRITE,
    handler: async (a) => op(ctx, "align_objects", a),
  });

  defineTool(server, ctx, {
    name: "distribute_objects",
    description: "Distribute 3+ objects with equal gaps along an axis, or apply an explicit spacing.",
    input: { ...tgt, axis: z.enum(["horizontal", "vertical"]).default("horizontal"), spacing: z.number().min(0).optional(), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "distribute_objects", { ...a, units: undefined, spacing: P(ctx, a.units)(a.spacing) }),
  });

  defineTool(server, ctx, {
    name: "arrange_objects",
    description: "Arrange objects into a row, column or grid with a uniform gap, starting at x/y (default: current top-left).",
    input: { ...tgt, mode: z.enum(["row", "column", "grid"]).default("grid"), columns: z.number().int().min(1).max(100).optional(), gap: z.number().min(0).default(10), x: z.number().optional(), y: z.number().optional(), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "arrange_objects", { ...a, units: undefined, gap: p(a.gap), x: p(a.x), y: p(a.y) });
    },
  });

  defineTool(server, ctx, {
    name: "center_on_artboard",
    description: "Center objects (as a unit) on the artboard horizontally, vertically or both.",
    input: { ...tgt, axis: z.enum(["both", "horizontal", "vertical"]).default("both") },
    annotations: WRITE,
    handler: async (a) => op(ctx, "center_on_artboard", a),
  });

  defineTool(server, ctx, {
    name: "calculate_object_bounds",
    description: "Return geometric and visible bounds of objects and their union (points, artboard top-left origin).",
    input: tgt,
    annotations: READ_ONLY,
    handler: async (a) => op(ctx, "calculate_object_bounds", a),
  });

  defineTool(server, ctx, {
    name: "create_guides",
    description: "Create ruler-style guides at positions on a dedicated, locked Guides layer.",
    input: { lines: z.array(z.object({ orientation: z.enum(["vertical", "horizontal"]), position: z.number(), name: z.string().optional() })).min(1).max(500), layer: z.string().default("Guides"), artboard: artboardArg, units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "create_guides", { lines: a.lines.map((l) => ({ ...l, position: p(l.position) })), layer: a.layer, artboard: a.artboard });
    },
  });

  defineTool(server, ctx, {
    name: "create_grid",
    description: "Draw a visible grid of thin lines as artwork (use create_layout_guides for non-printing guides).",
    input: { x: z.number().default(0), y: z.number().default(0), width: z.number().positive(), height: z.number().positive(), cellWidth: z.number().positive(), cellHeight: z.number().positive(), color: colorArg.optional(), strokeWidth: z.number().positive().default(0.5), name: nameArg, layer: layerArg, artboard: artboardArg, units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      if ((a.width / a.cellWidth) * (a.height / a.cellHeight) > 40000) throw new Error("Grid too dense");
      return op(ctx, "create_grid", { ...a, units: undefined, x: p(a.x), y: p(a.y), width: p(a.width), height: p(a.height), cellWidth: p(a.cellWidth), cellHeight: p(a.cellHeight), color: color(a.color) });
    },
  });

  const layoutGuides = async (a: { columns: number; rows: number; margin: number; gutter: number; artboard?: number; units?: z.infer<typeof unitsArg> }) => {
    const p = P(ctx, a.units);
    const info = (await ctx.bridge.run<Inspection>("get_artboards", {})).data;
    const ab = info.artboards[a.artboard ?? info.artboards.findIndex((x) => x.active)] ?? info.artboards[0]!;
    const g = gridGuides(ab.width, ab.height, { columns: a.columns, rows: a.rows, margin: p(a.margin)!, gutter: p(a.gutter)! });
    const r = await ctx.bridge.run("create_guides", { lines: g.lines, layer: "Layout Guides", artboard: a.artboard });
    return { data: { ...(r.data as object), columnWidthPt: g.columnWidth, rowHeightPt: g.rowHeight, guides: g.lines.length }, warnings: r.warnings };
  };

  defineTool(server, ctx, {
    name: "apply_margins",
    description: "Add margin guides inset from every artboard edge.",
    input: { margin: z.number().min(0), artboard: artboardArg, units: unitsArg },
    annotations: WRITE,
    handler: async (a) => layoutGuides({ columns: 1, rows: 1, margin: a.margin, gutter: 0, artboard: a.artboard, units: a.units }),
  });

  defineTool(server, ctx, {
    name: "create_layout_guides",
    description: "Create a column/row grid as guides: margins, columns and gutters (e.g. 12-column grid).",
    input: { columns: z.number().int().min(1).max(48).default(12), rows: z.number().int().min(1).max(48).default(1), margin: z.number().min(0).default(36), gutter: z.number().min(0).default(12), artboard: artboardArg, units: unitsArg },
    annotations: WRITE,
    handler: async (a) => layoutGuides(a),
  });

  defineTool(server, ctx, {
    name: "create_layout",
    description: "Set up a document layout in one step: standard layer stack (Typography, Graphics, Images, Background) plus margin/column guides.",
    input: { columns: z.number().int().min(1).max(48).default(12), rows: z.number().int().min(1).max(48).default(1), margin: z.number().min(0).default(36), gutter: z.number().min(0).default(12), layers: z.array(z.string()).default(["Typography", "Graphics", "Images", "Background"]), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const existing = (await ctx.bridge.run<{ layers: { name: string }[] }>("inspect_layers", {})).data.layers.map((l) => l.name);
      for (const name of [...a.layers].reverse()) if (!existing.includes(name)) await ctx.bridge.run("create_layer", { name });
      await ctx.bridge.run("reorder_layers", { order: a.layers });
      const guides = await layoutGuides(a);
      return { data: { layers: a.layers, guides: guides.data }, warnings: guides.warnings };
    },
  });

  defineTool(server, ctx, {
    name: "balance_composition",
    description: "Measure visual balance (area-weighted center vs. artboard center). With apply: true, shifts the given targets (or all unlocked non-background content) so the visual center moves toward the artboard center by `strength`.",
    input: { apply: z.boolean().default(false), strength: z.number().min(0).max(1).default(1), axis: z.enum(["both", "horizontal", "vertical"]).default("horizontal"), targets: targetsArg, artboard: artboardArg },
    annotations: WRITE,
    handler: async (a) => {
      const doc = (await ctx.bridge.run<Inspection>("inspect_document", { artboard: a.artboard })).data;
      const ab = doc.artboards.find((x) => x.active) ?? doc.artboards[0]!;
      const report = analyzeComposition(doc.items, ab);
      const cx = Number(report.metrics.visualCenterX), cy = Number(report.metrics.visualCenterY);
      const dx = a.axis === "vertical" ? 0 : (ab.width / 2 - cx) * a.strength;
      const dy = a.axis === "horizontal" ? 0 : (ab.height / 2 - cy) * a.strength;
      const result: Record<string, unknown> = { visualCenter: { x: cx, y: cy }, artboardCenter: { x: ab.width / 2, y: ab.height / 2 }, suggestedShift: { dx, dy } };
      if (a.apply && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
        const targets = a.targets ?? doc.items
          .filter((i) => i.bounds && !i.locked && !(i.bounds.width >= ab.width * 0.95 && i.bounds.height >= ab.height * 0.95) && i.name)
          .map((i) => ({ name: i.name!, layer: i.layer }));
        if (targets.length) result.moved = (await ctx.bridge.run("transform_objects", { targets, dx, dy })).data;
      }
      return { data: result };
    },
  });
}
