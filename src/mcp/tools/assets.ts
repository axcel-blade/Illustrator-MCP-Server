import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { artboardArg, defineTool, layerArg, nameArg, op, P, READ_ONLY, unitsArg, WRITE, type ToolContext } from "./common.js";

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".psd", ".gif", ".bmp", ".svg", ".pdf", ".eps", ".ai"];

export function registerAssetTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "place_image",
    description: "Place an image from an allowed directory as a linked file, or embed it. Width/height fit proportionally unless fit: 'stretch'. Missing files return FILE_NOT_FOUND.",
    input: {
      path: z.string().min(1), x: z.number().default(0), y: z.number().default(0), width: z.number().positive().optional(), height: z.number().positive().optional(),
      fit: z.enum(["contain", "stretch"]).default("contain"), embed: z.boolean().default(false), name: nameArg, layer: layerArg, artboard: artboardArg, units: unitsArg,
    },
    annotations: WRITE,
    handler: async (a) => {
      const path = ctx.paths.resolve(a.path, { extensions: IMAGE_EXTENSIONS, mustExist: true });
      const p = P(ctx, a.units);
      return op(ctx, "place_image", { ...a, units: undefined, path, x: p(a.x), y: p(a.y), width: p(a.width), height: p(a.height) });
    },
  });

  defineTool(server, ctx, {
    name: "inspect_assets",
    description: "List linked and embedded images in the active document and report linked files that are missing on disk.",
    input: {},
    annotations: READ_ONLY,
    handler: async () => {
      const r = await ctx.bridge.run<{ missingLinks: string[] }>("inspect_assets", {});
      const warnings = [...r.warnings];
      if (r.data.missingLinks?.length) warnings.push(`${r.data.missingLinks.length} linked image(s) are missing: ${r.data.missingLinks.join(", ")}`);
      return { data: r.data, warnings };
    },
  });

  defineTool(server, ctx, {
    name: "embed_images",
    description: "Embed linked images (all, or one by name) so the .ai no longer depends on external files.",
    input: { name: z.string().optional() },
    annotations: WRITE,
    handler: async (a) => op(ctx, "embed_images", a),
  });
}
