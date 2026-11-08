import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  artboardArg, defineTool, fill, fillArg, layerArg, nameArg, op, P, stroke, strokeArg, targetArg, targetsArg, unitsArg, WRITE, type ToolContext,
} from "./common.js";

const style = {
  name: nameArg,
  layer: layerArg,
  artboard: artboardArg,
  units: unitsArg,
  fill: fillArg.optional().describe('Hex fill or "none" (default gray for closed shapes)'),
  stroke: strokeArg.optional(),
  opacity: z.number().min(0).max(100).optional(),
  rotation: z.number().min(-360).max(360).optional(),
};

type StyleArgs = { name?: string; layer?: string; artboard?: number; fill?: string; stroke?: z.infer<typeof strokeArg>; opacity?: number; rotation?: number };
const common = (a: StyleArgs) => ({ name: a.name, layer: a.layer, artboard: a.artboard, fill: fill(a.fill), stroke: stroke(a.stroke), opacity: a.opacity, rotation: a.rotation });

/** Catmull-Rom to cubic Bezier: smooth handles for freeform point lists. */
export function smoothPoints(pts: { x: number; y: number }[], closed: boolean, tension = 0.5): { x: number; y: number; in: [number, number]; out: [number, number] }[] {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  return pts.map((p, i) => {
    const prev = at(i - 1), next = at(i + 1);
    const tx = ((next.x - prev.x) * tension) / 3, ty = ((next.y - prev.y) * tension) / 3;
    return { x: p.x, y: p.y, in: [p.x - tx, p.y - ty], out: [p.x + tx, p.y + ty] };
  });
}

export function registerVectorTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "draw_rectangle",
    description: "Draw a rectangle (optionally rounded). x/y = top-left from the artboard's top-left, y down.",
    input: { x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(), cornerRadius: z.number().min(0).optional(), ...style },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "draw_rectangle", { ...common(a), x: p(a.x), y: p(a.y), width: p(a.width), height: p(a.height), cornerRadius: p(a.cornerRadius) });
    },
  });

  defineTool(server, ctx, {
    name: "draw_circle",
    description: "Draw a circle from its center point and radius.",
    input: { cx: z.number(), cy: z.number(), radius: z.number().positive(), ...style },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      const r = p(a.radius)!;
      return op(ctx, "draw_ellipse", { ...common(a), x: p(a.cx)! - r, y: p(a.cy)! - r, width: 2 * r, height: 2 * r });
    },
  });

  defineTool(server, ctx, {
    name: "draw_ellipse",
    description: "Draw an ellipse by its bounding box (top-left x/y, width, height).",
    input: { x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(), ...style },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "draw_ellipse", { ...common(a), x: p(a.x), y: p(a.y), width: p(a.width), height: p(a.height) });
    },
  });

  defineTool(server, ctx, {
    name: "draw_polygon",
    description: "Draw a regular polygon centered at cx/cy.",
    input: { cx: z.number(), cy: z.number(), radius: z.number().positive(), sides: z.number().int().min(3).max(100), ...style },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "draw_polygon", { ...common(a), cx: p(a.cx), cy: p(a.cy), radius: p(a.radius), sides: a.sides });
    },
  });

  defineTool(server, ctx, {
    name: "draw_star",
    description: "Draw a star centered at cx/cy with outer and inner radius.",
    input: { cx: z.number(), cy: z.number(), radius: z.number().positive(), innerRadius: z.number().positive(), points: z.number().int().min(3).max(100).default(5), ...style },
    annotations: WRITE,
    handler: async (a) => {
      if (a.innerRadius >= a.radius) throw new Error("innerRadius must be smaller than radius");
      const p = P(ctx, a.units);
      return op(ctx, "draw_star", { ...common(a), cx: p(a.cx), cy: p(a.cy), radius: p(a.radius), innerRadius: p(a.innerRadius), points: a.points });
    },
  });

  defineTool(server, ctx, {
    name: "draw_line",
    description: "Draw a straight line segment.",
    input: { x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), ...style },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "draw_line", { ...common(a), fill: undefined, x1: p(a.x1), y1: p(a.y1), x2: p(a.x2), y2: p(a.y2) });
    },
  });

  const point = z.object({
    x: z.number(), y: z.number(),
    in: z.tuple([z.number(), z.number()]).optional().describe("Incoming Bezier handle (absolute)"),
    out: z.tuple([z.number(), z.number()]).optional().describe("Outgoing Bezier handle (absolute)"),
    corner: z.boolean().optional(),
  });

  defineTool(server, ctx, {
    name: "draw_pen_path",
    description: "Draw a Bezier path from anchor points with optional absolute in/out handles (like the Pen tool).",
    input: { points: z.array(point).min(2).max(5000), closed: z.boolean().default(false), ...style },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      const pts = a.points.map((q) => ({ x: p(q.x), y: p(q.y), in: q.in?.map((v) => p(v)), out: q.out?.map((v) => p(v)), corner: q.corner }));
      return op(ctx, "draw_pen_path", { ...common(a), points: pts, closed: a.closed });
    },
  });

  defineTool(server, ctx, {
    name: "draw_freeform_path",
    description: "Draw a smooth freeform path through the given points (Catmull-Rom smoothing converted to Bezier handles).",
    input: { points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).max(5000), closed: z.boolean().default(false), smoothness: z.number().min(0).max(1).default(0.5), ...style },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      const pts = smoothPoints(a.points.map((q) => ({ x: p(q.x)!, y: p(q.y)! })), a.closed, a.smoothness);
      return op(ctx, "draw_pen_path", { ...common(a), points: pts, closed: a.closed });
    },
  });

  defineTool(server, ctx, {
    name: "create_compound_path",
    description: "Combine paths into a compound path (overlaps become holes per even-odd/non-zero rules).",
    input: { targets: z.array(targetArg).min(2), name: nameArg, fill: fillArg.optional() },
    annotations: WRITE,
    handler: async (a) => op(ctx, "create_compound_path", { targets: a.targets, name: a.name, fill: fill(a.fill) }),
  });

  defineTool(server, ctx, {
    name: "create_clipping_mask",
    description: "Clip target objects with a mask shape (path, compound path or text). The mask's shape defines the visible region.",
    input: { mask: targetArg, targets: z.array(targetArg).min(1), name: nameArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "create_clipping_mask", a),
  });

  defineTool(server, ctx, {
    name: "create_symbol",
    description: "Register an object as a reusable symbol in the document's Symbols panel; optionally replace it with an instance.",
    input: { target: targetArg, name: z.string().min(1).max(120), replaceWithInstance: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "create_symbol", a),
  });

  defineTool(server, ctx, {
    name: "create_pattern",
    description: "Tile an object across an area as an editable clipped group. Note: Illustrator's scripting API cannot create pattern swatches, so the result is a tiled group, not a swatch.",
    input: {
      tile: targetArg, x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(),
      gapX: z.number().min(0).default(0), gapY: z.number().min(0).default(0), offsetRows: z.boolean().default(false),
      removeTile: z.boolean().default(false), name: nameArg, layer: layerArg, artboard: artboardArg, units: unitsArg,
    },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "create_pattern", { ...a, x: p(a.x), y: p(a.y), width: p(a.width), height: p(a.height), gapX: p(a.gapX), gapY: p(a.gapY), units: undefined },
        ["Created as a tiled clipping group (scripting cannot define pattern swatches)."]);
    },
  });

  void targetsArg;
}
