import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UnitSchema, toPoints, PAPER_SIZES_MM } from "../../utils/units.js";
import { defineTool, DESTRUCTIVE, op, P, READ_ONLY, requireConfirm, unitsArg, WRITE, type ToolContext } from "./common.js";

export function registerDocumentTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "illustrator_status",
    description: "Detect installed Illustrator versions, COM registration and whether Illustrator is running. With probe: true also queries the running application (version, open documents) via a real script call.",
    input: { probe: z.boolean().default(false).describe("Execute a status script inside Illustrator (may launch it if auto-launch is enabled)") },
    annotations: READ_ONLY,
    handler: async ({ probe }) => {
      const detection = await ctx.bridge.detect();
      const result: Record<string, unknown> = { adapter: ctx.bridge.adapterName, detection, autoLaunch: ctx.config.illustrator.autoLaunch, sessionUnits: ctx.session.units, queuePending: ctx.bridge.pending };
      const warnings: string[] = [];
      let probed = false;
      if (probe) {
        try {
          const r = await ctx.bridge.run("status", {});
          result.application = r.data;
          warnings.push(...r.warnings);
          probed = true;
        } catch (e) {
          result.application = null;
          result.probeError = (e as Error).message;
        }
      }
      return { data: result, warnings, source: probed ? undefined : "server" };
    },
  });

  defineTool(server, ctx, {
    name: "create_document",
    description: "Create a new Illustrator document. Size can be a paper preset (A4, Letter, ...) or width/height in the given units.",
    input: {
      name: z.string().max(200).default("Untitled"),
      preset: z.enum(Object.keys(PAPER_SIZES_MM) as [string, ...string[]]).optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      units: UnitSchema.default("mm"),
      orientation: z.enum(["portrait", "landscape"]).default("portrait"),
      colorMode: z.enum(["RGB", "CMYK"]).default("CMYK"),
      artboards: z.number().int().min(1).max(100).default(1),
    },
    annotations: WRITE,
    handler: async (a) => {
      let w: number, h: number;
      if (a.preset) {
        [w, h] = PAPER_SIZES_MM[a.preset]!.map((v) => toPoints(v, "mm")) as [number, number];
      } else if (a.width && a.height) {
        w = toPoints(a.width, a.units); h = toPoints(a.height, a.units);
      } else {
        throw new Error("Provide a preset or both width and height.");
      }
      if (a.orientation === "landscape" && w < h) [w, h] = [h, w];
      if (w > 16383 || h > 16383) throw new Error("Illustrator artboards are limited to 16383 pt (227 in).");
      return op(ctx, "create_document", { name: a.name, width: w, height: h, colorMode: a.colorMode, units: a.units, artboards: a.artboards });
    },
  });

  defineTool(server, ctx, {
    name: "open_document",
    description: "Open an existing .ai/.pdf/.eps/.svg file from an allowed directory.",
    input: { path: z.string().min(1) },
    annotations: WRITE,
    handler: async ({ path }) => op(ctx, "open_document", { path: ctx.paths.resolve(path, { extensions: [".ai", ".pdf", ".eps", ".svg", ".ait"], mustExist: true }) }),
  });

  defineTool(server, ctx, {
    name: "close_document",
    description: "Close a document. If it has unsaved changes you must pass save: true, or save: false together with confirm: true to discard them.",
    input: { name: z.string().optional().describe("Document name; default active"), save: z.boolean().optional(), confirm: z.boolean().optional() },
    annotations: DESTRUCTIVE,
    handler: async (a) => {
      if (a.save === false) requireConfirm(a.confirm, "Closing without saving");
      return op(ctx, "close_document", { name: a.name, save: a.save });
    },
  });

  defineTool(server, ctx, {
    name: "save_document",
    description: "Save the active document to its existing file.",
    input: {},
    annotations: WRITE,
    handler: async () => op(ctx, "save_document", {}),
  });

  defineTool(server, ctx, {
    name: "save_document_as",
    description: "Save the active document as a native editable .ai file inside an allowed directory. Existing files are not overwritten unless overwrite: true.",
    input: {
      path: z.string().min(1).describe("Target .ai path (relative paths resolve inside the output directory)"),
      overwrite: z.boolean().default(false),
      pdfCompatible: z.boolean().default(true),
      embedLinkedFiles: z.boolean().default(false),
      embedICCProfile: z.boolean().default(false),
    },
    annotations: WRITE,
    handler: async (a) => {
      const path = ctx.paths.resolveOutput(a.path, { extensions: [".ai"], overwrite: a.overwrite });
      return op(ctx, "save_document_as", { path, pdfCompatible: a.pdfCompatible, embedLinkedFiles: a.embedLinkedFiles, embedICCProfile: a.embedICCProfile });
    },
  });

  defineTool(server, ctx, {
    name: "inspect_document",
    description: "Read the active document: artboards, layers, and every top-level object with bounds (points, artboard top-left origin, y down), fills, strokes and text properties. These are verified Illustrator properties.",
    input: { artboard: z.number().int().min(0).optional(), deep: z.boolean().default(false).describe("Include group children"), limit: z.number().int().min(1).max(5000).default(500) },
    annotations: READ_ONLY,
    handler: async (a) => op(ctx, "inspect_document", a),
  });

  defineTool(server, ctx, {
    name: "get_artboards",
    description: "List artboards with sizes in points.",
    input: {},
    annotations: READ_ONLY,
    handler: async () => op(ctx, "get_artboards", {}),
  });

  defineTool(server, ctx, {
    name: "create_artboard",
    description: "Add an artboard. x/y are relative to artboard 0's top-left corner.",
    input: { name: z.string().optional(), x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "create_artboard", { name: a.name, x: p(a.x), y: p(a.y), width: p(a.width), height: p(a.height) });
    },
  });

  defineTool(server, ctx, {
    name: "resize_artboard",
    description: "Resize an artboard, anchored at its top-left or center.",
    input: { index: z.number().int().min(0).default(0), width: z.number().positive(), height: z.number().positive(), anchor: z.enum(["topLeft", "center"]).default("topLeft"), name: z.string().optional(), units: unitsArg },
    annotations: WRITE,
    handler: async (a) => {
      const p = P(ctx, a.units);
      return op(ctx, "resize_artboard", { index: a.index, width: p(a.width), height: p(a.height), anchor: a.anchor, name: a.name });
    },
  });

  defineTool(server, ctx, {
    name: "set_document_units",
    description: "Set the default units this MCP session uses for tool coordinates, and write Illustrator's ruler-unit preference (the preference mapping is not documented by Adobe and is reported as unverified).",
    input: { units: UnitSchema, applyToIllustrator: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => {
      ctx.session.units = a.units;
      if (!a.applyToIllustrator) return { data: { sessionUnits: a.units }, source: "server" };
      const r = await op(ctx, "set_document_units", { units: a.units }, ["Ruler preference key 'rulerType' is community-documented, not Adobe-documented (unverified)."]);
      return { ...r, data: { sessionUnits: a.units, illustrator: r.data } };
    },
  });

  defineTool(server, ctx, {
    name: "set_document_color_mode",
    description: "Convert the active document's color mode to RGB or CMYK (verified by reading documentColorSpace back).",
    input: { mode: z.enum(["RGB", "CMYK"]) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_document_color_mode", a),
  });
}
