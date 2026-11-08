import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { colorArg, color, defineTool, DESTRUCTIVE, op, READ_ONLY, requireConfirm, targetArg, WRITE, type ToolContext } from "./common.js";

const layerName = z.string().min(1).max(120);

export function registerLayerTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "inspect_layers",
    description: "List layers top-to-bottom with visibility, lock state and item counts.",
    input: {},
    annotations: READ_ONLY,
    handler: async () => op(ctx, "inspect_layers", {}),
  });

  defineTool(server, ctx, {
    name: "create_layer",
    description: "Create a new layer at the top (default) or bottom of the stack.",
    input: { name: layerName, position: z.enum(["top", "bottom"]).default("top"), color: colorArg.optional().describe("Layer highlight color") },
    annotations: WRITE,
    handler: async (a) => op(ctx, "create_layer", { ...a, color: color(a.color) }),
  });

  defineTool(server, ctx, {
    name: "delete_layer",
    description: "Delete a layer and everything on it. Destructive: requires confirm: true.",
    input: { name: layerName, confirm: z.boolean().optional() },
    annotations: DESTRUCTIVE,
    handler: async (a) => {
      requireConfirm(a.confirm, `Deleting layer "${a.name}" and its contents`);
      return op(ctx, "delete_layer", { name: a.name });
    },
  });

  defineTool(server, ctx, {
    name: "rename_layer",
    description: "Rename a layer.",
    input: { name: layerName, newName: layerName },
    annotations: WRITE,
    handler: async (a) => op(ctx, "update_layer", { name: a.name, rename: a.newName }),
  });

  defineTool(server, ctx, {
    name: "select_layer",
    description: "Make a layer the active layer (new objects without an explicit layer go here).",
    input: { name: layerName },
    annotations: WRITE,
    handler: async (a) => op(ctx, "update_layer", { name: a.name, activate: true }),
  });

  defineTool(server, ctx, {
    name: "lock_layer",
    description: "Lock or unlock a layer.",
    input: { name: layerName, locked: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "update_layer", { name: a.name, locked: a.locked }),
  });

  defineTool(server, ctx, {
    name: "hide_layer",
    description: "Hide or show a layer.",
    input: { name: layerName, hidden: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "update_layer", { name: a.name, visible: !a.hidden }),
  });

  defineTool(server, ctx, {
    name: "move_object_to_layer",
    description: "Move objects to another layer (create: true makes the layer if missing).",
    input: { target: targetArg, layer: layerName, create: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "move_object_to_layer", a),
  });

  defineTool(server, ctx, {
    name: "reorder_layers",
    description: "Reorder layers. `order` lists layer names top-to-bottom; unlisted layers stay below.",
    input: { order: z.array(layerName).min(1).max(200) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "reorder_layers", a),
  });
}
