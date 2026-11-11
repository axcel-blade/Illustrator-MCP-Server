import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { artboardArg, defineTool, DESTRUCTIVE, nameArg, op, P, READ_ONLY, requireConfirm, targetArg, targetsArg, unitsArg, WRITE, type ToolContext } from "./common.js";

const tgt = { target: targetArg.optional(), targets: targetsArg, artboard: artboardArg };
const ANCHOR = z.enum(["topLeft", "top", "topRight", "left", "center", "right", "bottomLeft", "bottom", "bottomRight"]);

export function registerObjectTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "select_objects",
    description: "Select objects by explicit references or by filters (layer, Illustrator type such as PathItem/TextFrame, name substring). Locked/hidden objects are skipped by filters.",
    input: { targets: targetsArg, layer: z.string().optional(), type: z.string().optional(), nameContains: z.string().optional() },
    annotations: WRITE,
    handler: async (a) => op(ctx, "select_objects", a),
  });

  defineTool(server, ctx, {
    name: "inspect_selection",
    description: "Describe the current selection (verified properties).",
    input: { deep: z.boolean().default(false), artboard: artboardArg },
    annotations: READ_ONLY,
    handler: async (a) => op(ctx, "inspect_selection", a),
  });

  defineTool(server, ctx, {
    name: "move_object",
    description: "Move objects to an absolute top-left position (x/y) or by a relative offset (dx/dy).",
    input: { ...tgt, x: z.number().optional(), y: z.number().optional(), dx: z.number().optional(), dy: z.number().optional(), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "transform_objects", { target: a.target, targets: a.targets, artboard: a.artboard, x: p(a.x), y: p(a.y), dx: p(a.dx), dy: p(a.dy) });
    },
  });

  defineTool(server, ctx, {
    name: "resize_object",
    description: "Resize to an absolute width/height or by scale percent. Proportions are kept when only one dimension is given.",
    input: { ...tgt, width: z.number().positive().optional(), height: z.number().positive().optional(), scale: z.number().positive().optional().describe("Percent"), keepProportions: z.boolean().default(true), scaleStrokes: z.boolean().default(true), anchor: ANCHOR.default("center"), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "transform_objects", { ...a, units: undefined, width: p(a.width), height: p(a.height) });
    },
  });

  defineTool(server, ctx, {
    name: "rotate_object",
    description: "Rotate objects by degrees (counter-clockwise positive, Illustrator convention) around an anchor.",
    input: { ...tgt, angle: z.number().min(-360).max(360), anchor: ANCHOR.default("center") },
    annotations: WRITE,
    handler: async (a) => op(ctx, "transform_objects", { target: a.target, targets: a.targets, rotation: a.angle, anchor: a.anchor }),
  });

  defineTool(server, ctx, {
    name: "duplicate_object",
    description: "Duplicate objects, optionally repeatedly with a step offset (dx/dy per copy).",
    input: { ...tgt, copies: z.number().int().min(1).max(500).default(1), dx: z.number().default(0), dy: z.number().default(0), name: nameArg, units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "duplicate_object", { ...a, units: undefined, dx: p(a.dx), dy: p(a.dy) });
    },
  });

  defineTool(server, ctx, {
    name: "delete_object",
    description: "Delete objects. Destructive: requires confirm: true after asking the user.",
    input: { ...tgt, confirm: z.boolean().optional() },
    annotations: DESTRUCTIVE,
    handler: async (a) => {
      requireConfirm(a.confirm, "Deleting objects");
      return op(ctx, "delete_object", { target: a.target, targets: a.targets });
    },
  });

  defineTool(server, ctx, {
    name: "group_objects",
    description: "Group objects (they must share a layer; the group is placed on the first object's layer).",
    input: { ...tgt, name: nameArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "group_objects", a),
  });

  defineTool(server, ctx, {
    name: "ungroup_objects",
    description: "Release groups into their children. Clipping groups require releaseClipping: true.",
    input: { ...tgt, releaseClipping: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "ungroup_objects", a),
  });

  defineTool(server, ctx, {
    name: "lock_objects",
    description: "Lock or unlock objects.",
    input: { ...tgt, locked: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_properties", { target: a.target, targets: a.targets, locked: a.locked }),
  });

  defineTool(server, ctx, {
    name: "hide_objects",
    description: "Hide or show objects.",
    input: { ...tgt, hidden: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_properties", { target: a.target, targets: a.targets, hidden: a.hidden }),
  });

  defineTool(server, ctx, {
    name: "rename_object",
    description: "Rename an object (multiple targets get numbered suffixes).",
    input: { ...tgt, name: z.string().min(1).max(120) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_properties", { target: a.target, targets: a.targets, rename: a.name }),
  });

  defineTool(server, ctx, {
    name: "set_object_z_order",
    description: "Change stacking order within the layer.",
    input: { ...tgt, order: z.enum(["front", "back", "forward", "backward"]) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_z_order", a),
  });

  defineTool(server, ctx, {
    name: "transform_objects",
    description: "Apply a combined transform: absolute position/size, scale %, rotation, relative offset and reflection, in that order.",
    input: {
      ...tgt, x: z.number().optional(), y: z.number().optional(), dx: z.number().optional(), dy: z.number().optional(),
      width: z.number().positive().optional(), height: z.number().positive().optional(), keepProportions: z.boolean().default(false),
      scale: z.number().positive().optional(), scaleX: z.number().optional(), scaleY: z.number().optional(), rotation: z.number().optional(),
      reflect: z.enum(["horizontal", "vertical"]).optional(), anchor: ANCHOR.default("center"), units: unitsArg,
    },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "transform_objects", { ...a, units: undefined, x: p(a.x), y: p(a.y), dx: p(a.dx), dy: p(a.dy), width: p(a.width), height: p(a.height) });
    },
  });
}
