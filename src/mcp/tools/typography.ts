import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { McpDesignError } from "../../utils/errors.js";
import { artboardArg, color, colorArg, defineTool, layerArg, nameArg, op, P, READ_ONLY, targetArg, unitsArg, WRITE, type ToolContext } from "./common.js";

const WEIGHTS = ["thin", "light", "regular", "medium", "semibold", "bold", "extrabold", "black"] as const;
const ALIGN = ["left", "center", "right", "justify", "justifyAll"] as const;
const range = z.object({ start: z.number().int().min(0), length: z.number().int().min(1) }).optional().describe("Character range; default whole text");

export function registerTypographyTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "add_text",
    description: "Add live, editable text. Point text by default; pass width+height for area text. Fonts are tried in order; unavailable fonts produce a warning and are never reported as applied.",
    input: {
      content: z.string().min(1).max(20000), x: z.number(), y: z.number().describe("Top of the text"),
      width: z.number().positive().optional(), height: z.number().positive().optional(),
      font: z.union([z.string(), z.array(z.string()).min(1)]).optional().describe("PostScript name, 'Family Style', or a fallback list"),
      fontSize: z.number().min(0.1).max(1296).default(12).describe("Points"),
      weight: z.enum(WEIGHTS).optional(), color: colorArg.optional(), align: z.enum(ALIGN).optional(),
      tracking: z.number().optional().describe("1/1000 em"), leading: z.number().positive().optional().describe("Points"),
      name: nameArg, layer: layerArg, artboard: artboardArg, units: unitsArg,
    },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "add_text", { ...a, units: undefined, x: p(a.x), y: p(a.y), width: p(a.width), height: p(a.height), color: color(a.color) });
    },
  });

  defineTool(server, ctx, {
    name: "edit_text",
    description: "Replace the text content of a text object, or replace occurrences of `find` with `content`.",
    input: { target: targetArg, content: z.string().max(20000), find: z.string().optional() },
    annotations: WRITE,
    handler: async (a) => op(ctx, "edit_text", a),
  });

  const styleTool = (name: string, description: string, shape: z.ZodRawShape, map: (a: Record<string, unknown>) => Record<string, unknown>) =>
    defineTool(server, ctx, {
      name, description, input: { target: targetArg, range, ...shape }, annotations: WRITE,
      handler: async (a) => op(ctx, "style_text", { target: a.target, range: a.range, ...map(a as Record<string, unknown>) }),
    });

  defineTool(server, ctx, {
    name: "set_font",
    description: "Set the typeface (PostScript name, 'Family Style', or fallback list). Returns an error if none of the fonts are installed.",
    input: { target: targetArg, range, font: z.union([z.string(), z.array(z.string()).min(1)]) },
    annotations: WRITE,
    handler: async (a) => {
      const fonts = Array.isArray(a.font) ? a.font : [a.font];
      const check = await ctx.bridge.run<{ fonts: { requested: string; available: boolean }[] }>("check_fonts", { fonts });
      if (!check.data.fonts.some((f) => f.available)) {
        throw new McpDesignError("FILE_NOT_FOUND", `None of these fonts are installed: ${fonts.join(", ")}. Use inspect_fonts to find available fonts.`);
      }
      return op(ctx, "style_text", { target: a.target, range: a.range, font: fonts });
    },
  });
  styleTool("set_font_size", "Set font size in points.", { fontSize: z.number().min(0.1).max(1296) }, (a) => ({ fontSize: a.fontSize }));
  styleTool("set_font_weight", "Switch to another installed style of the same family (e.g. Bold). Warns if the family lacks that weight.", { weight: z.enum(WEIGHTS) }, (a) => ({ weight: a.weight }));
  styleTool("set_text_color", "Set text fill color.", { color: colorArg }, (a) => ({ color: color(a.color as string) }));
  styleTool("set_paragraph_alignment", "Set paragraph justification.", { align: z.enum(ALIGN) }, (a) => ({ align: a.align }));
  styleTool("set_character_spacing", "Set tracking in 1/1000 em.", { tracking: z.number().min(-1000).max(10000) }, (a) => ({ tracking: a.tracking }));
  styleTool("set_line_spacing", "Set leading in points (disables auto leading).", { leading: z.number().positive().max(5000) }, (a) => ({ leading: a.leading }));

  defineTool(server, ctx, {
    name: "create_text_on_path",
    description: "Flow text along an existing open or closed path.",
    input: {
      path: targetArg, content: z.string().min(1).max(5000), font: z.union([z.string(), z.array(z.string())]).optional(),
      fontSize: z.number().min(0.1).max(1296).default(12), color: colorArg.optional(), tracking: z.number().optional(), name: nameArg,
    },
    annotations: WRITE,
    handler: async (a) => op(ctx, "create_text_on_path", { ...a, color: color(a.color) }),
  });

  defineTool(server, ctx, {
    name: "convert_text_to_outlines",
    description: "Convert text to vector outlines (no longer editable as text). Useful before sending to print when fonts may be missing.",
    input: { target: targetArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "convert_text_to_outlines", a),
  });

  defineTool(server, ctx, {
    name: "inspect_fonts",
    description: "List installed fonts (optionally filtered) and fonts used in the active document. Use check to verify availability of specific fonts.",
    input: { query: z.string().optional(), limit: z.number().int().min(1).max(5000).default(200), documentFonts: z.boolean().default(true), check: z.array(z.string()).max(100).optional() },
    annotations: READ_ONLY,
    handler: async (a) => {
      const listing = await ctx.bridge.run("inspect_fonts", { query: a.query, limit: a.limit, documentFonts: a.documentFonts });
      const checks = a.check?.length ? (await ctx.bridge.run("check_fonts", { fonts: a.check })).data : undefined;
      return { data: { ...(listing.data as object), availability: checks }, warnings: listing.warnings };
    },
  });
}
