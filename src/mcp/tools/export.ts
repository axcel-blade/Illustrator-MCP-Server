import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { McpDesignError } from "../../utils/errors.js";
import { defineTool, READ_ONLY, WRITE, type ToolContext, type ToolOutput } from "./common.js";

const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
const artboards = z.array(z.number().int().min(0)).max(100).optional().describe("Artboard indexes; default active artboard. Multiple artboards get -N suffixes.");
const out = { path: z.string().min(1), overwrite: z.boolean().default(false) };

export interface PreviewResult {
  path: string;
  bytes: number;
  base64?: string;
}

/**
 * Exports a real PNG preview of the active artboard and reads it back. Returns no image when the
 * file does not exist (e.g. mock adapter) — callers must not claim a visual inspection then.
 */
export async function exportPreview(ctx: ToolContext, opts: { artboard?: number; maxWidthPx?: number }): Promise<PreviewResult & { exported: boolean; warnings: string[] }> {
  const path = ctx.paths.resolveOutput(join(ctx.config.outputDir, "previews", `preview-${Date.now()}.png`), { extensions: [".png"] });
  const ab = (await ctx.bridge.run<{ artboards: { index: number; width: number; active: boolean }[] }>("get_artboards", {})).data.artboards;
  const target = ab.find((a) => a.index === opts.artboard) ?? ab.find((a) => a.active) ?? ab[0];
  const width = target ? Math.min(opts.maxWidthPx ?? 1200, target.width * 7.76) : undefined;
  const r = await ctx.bridge.run<{ files: { path: string }[] }>("export_png", { path, artboards: target ? [target.index] : undefined, width, transparent: false });
  const file = r.data.files[0]?.path ?? path;
  if (!existsSync(file)) return { path: file, bytes: 0, exported: false, warnings: [...r.warnings, "No preview file exists on disk; no visual inspection is possible."] };
  const bytes = statSync(file).size;
  if (bytes > MAX_PREVIEW_BYTES) return { path: file, bytes, exported: true, warnings: [...r.warnings, "Preview too large to inline; reduce maxWidthPx."] };
  return { path: file, bytes, exported: true, base64: readFileSync(file).toString("base64"), warnings: r.warnings };
}

export function registerExportTools(server: McpServer, ctx: ToolContext): void {
  const exportOp = async (opName: string, ext: string[], args: Record<string, unknown> & { path: string; overwrite: boolean }): Promise<ToolOutput> => {
    const path = ctx.paths.resolveOutput(args.path, { extensions: ext, overwrite: args.overwrite });
    const r = await ctx.bridge.run(opName, { ...args, path, overwrite: undefined });
    return { data: r.data, warnings: r.warnings };
  };

  defineTool(server, ctx, {
    name: "export_png",
    description: "Export artboards to PNG-24. Resolution via ppi (72 = 1:1) or a target pixel width. Clipped to the artboard.",
    input: { ...out, artboards, ppi: z.number().min(18).max(558).default(144), width: z.number().int().positive().optional(), transparent: z.boolean().default(true), antiAliasing: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => exportOp("export_png", [".png"], a),
  });

  defineTool(server, ctx, {
    name: "export_jpg",
    description: "Export artboards to JPEG.",
    input: { ...out, artboards, ppi: z.number().min(18).max(558).default(144), width: z.number().int().positive().optional(), quality: z.number().int().min(0).max(100).default(85), antiAliasing: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => exportOp("export_jpg", [".jpg", ".jpeg"], a),
  });

  defineTool(server, ctx, {
    name: "export_svg",
    description: "Export to SVG with configurable coordinate precision; optionally outline text.",
    input: { ...out, artboard: z.number().int().min(0).optional(), precision: z.number().int().min(1).max(7).default(3), outlineText: z.boolean().default(false), embedImages: z.boolean().default(true) },
    annotations: WRITE,
    handler: async (a) => exportOp("export_svg", [".svg"], a),
  });

  defineTool(server, ctx, {
    name: "export_pdf",
    description: "Export to PDF. The document must be saved as .ai first (it is reopened afterwards so the .ai stays the working file), unless allowRetarget: true.",
    input: { ...out, compatibility: z.enum(["1.3", "1.4", "1.5", "1.6", "1.7"]).default("1.6"), preset: z.string().optional().describe("Named PDF preset, e.g. [PDF/X-4:2008]"), artboards: z.string().regex(/^[\d,\- ]+$/).optional().describe("Range like '1-3,5' (1-based)"), preserveEditability: z.boolean().default(true), allowRetarget: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => exportOp("export_pdf", [".pdf"], a),
  });

  defineTool(server, ctx, {
    name: "export_eps",
    description: "Export to EPS (same save-first rule as export_pdf).",
    input: { ...out, artboards: z.string().regex(/^[\d,\- ]+$/).optional(), embedFonts: z.boolean().default(true), allowRetarget: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => exportOp("export_eps", [".eps"], a),
  });

  defineTool(server, ctx, {
    name: "export_multiple_formats",
    description: "Export the active document to several formats sharing a base path (extension added per format). Each format is reported individually; one failure does not hide others.",
    input: { basePath: z.string().min(1).describe("Path without extension"), formats: z.array(z.enum(["png", "jpg", "svg", "pdf", "eps"])).min(1).max(5), ppi: z.number().min(18).max(558).default(144), overwrite: z.boolean().default(false), allowRetarget: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => {
      const results: Record<string, unknown> = {};
      const warnings: string[] = [];
      // Raster/SVG first: PDF/EPS re-save the document.
      const order = [...a.formats].sort((x, y) => ["png", "jpg", "svg", "pdf", "eps"].indexOf(x) - ["png", "jpg", "svg", "pdf", "eps"].indexOf(y));
      for (const f of order) {
        try {
          const r = await exportOp(`export_${f}`, [`.${f}`], { path: `${a.basePath}.${f}`, overwrite: a.overwrite, ppi: a.ppi, allowRetarget: a.allowRetarget });
          results[f] = { ok: true, ...(r.data as object) };
          warnings.push(...(r.warnings ?? []));
        } catch (e) {
          const err = e instanceof McpDesignError ? e.toJSON() : { message: String(e) };
          results[f] = { ok: false, error: err };
        }
      }
      return { data: results, warnings };
    },
  });

  defineTool(server, ctx, {
    name: "generate_export_preview",
    description: "Export a real PNG preview of an artboard and return it as an image so the AI client can look at the artwork. If no file could be produced, no image is returned.",
    input: { artboard: z.number().int().min(0).optional(), maxWidthPx: z.number().int().min(100).max(4000).default(1200) },
    annotations: READ_ONLY,
    handler: async (a) => {
      const p = await exportPreview(ctx, a);
      return {
        data: { path: p.path, bytes: p.bytes, imageAttached: Boolean(p.base64) },
        warnings: p.warnings,
        images: p.base64 ? [{ base64: p.base64, mimeType: "image/png" }] : [],
      };
    },
  });
}
