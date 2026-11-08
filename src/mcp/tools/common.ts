import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z, type ZodRawShape } from "zod";
import type { AppConfig } from "../../config/index.js";
import { jsxColor } from "../../design-engine/compiler.js";
import type { PlanStore } from "../../design-engine/plan-store.js";
import type { IllustratorBridge } from "../../illustrator/bridge/bridge.js";
import { HexColorSchema } from "../../utils/colors.js";
import { McpDesignError, toMcpError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { PathPolicy } from "../../utils/paths.js";
import { toPoints, UnitSchema, type Unit } from "../../utils/units.js";

export interface ToolContext {
  bridge: IllustratorBridge;
  config: AppConfig;
  paths: PathPolicy;
  plans: PlanStore;
  session: { units: Unit };
}

export interface ToolOutput {
  data: unknown;
  warnings?: string[];
  images?: { base64: string; mimeType: string }[];
  /** Who verified the data: Illustrator itself, the mock adapter, or server-side computation only. */
  source?: "illustrator" | "mock" | "server";
}

export const registeredTools = new Set<string>();

export function defineTool<S extends ZodRawShape>(
  server: McpServer,
  ctx: ToolContext,
  def: {
    name: string;
    title?: string;
    description: string;
    input: S;
    annotations?: ToolAnnotations;
    handler: (args: z.objectOutputType<S, z.ZodTypeAny>, ctx: ToolContext) => Promise<ToolOutput>;
  },
): void {
  registeredTools.add(def.name);
  server.registerTool(
    def.name,
    { title: def.title, description: def.description, inputSchema: def.input, annotations: def.annotations },
    (async (args: z.objectOutputType<S, z.ZodTypeAny>): Promise<CallToolResult> => {
      const started = Date.now();
      try {
        const out = await def.handler(args, ctx);
        const source = out.source ?? (ctx.bridge.adapterName === "mock" ? "mock" : "illustrator");
        const warnings = [...(out.warnings ?? [])];
        if (source === "mock") warnings.unshift("MOCK ADAPTER: no real Illustrator was used; results are simulated for testing.");
        const payload = { ok: true, tool: def.name, source, data: out.data, warnings };
        logger.debug("tool ok", { tool: def.name, ms: Date.now() - started });
        return {
          content: [
            { type: "text", text: JSON.stringify(payload, null, 2) },
            ...(out.images ?? []).map((i) => ({ type: "image" as const, data: i.base64, mimeType: i.mimeType })),
          ],
        };
      } catch (err) {
        const e = toMcpError(err);
        logger.warn("tool error", { tool: def.name, code: e.code, message: e.message });
        return { isError: true, content: [{ type: "text", text: JSON.stringify({ ok: false, tool: def.name, error: e.toJSON() }, null, 2) }] };
      }
    }) as never,
  );
}

/** Run a bridge op and wrap its result as tool output. */
export async function op(ctx: ToolContext, name: string, args: object, extraWarnings: string[] = []): Promise<ToolOutput> {
  const r = await ctx.bridge.run(name, args);
  return { data: r.data, warnings: [...extraWarnings, ...r.warnings] };
}

/* ---------------- shared schemas ---------------- */

export const unitsArg = UnitSchema.optional().describe("Units for coordinates/sizes in this call (default: session units, initially pt)");
export const artboardArg = z.number().int().min(0).optional().describe("Artboard index used as the coordinate origin (default: active)");
export const layerArg = z.string().min(1).max(120).optional().describe("Target layer name (created if missing)");
export const nameArg = z.string().min(1).max(120).optional().describe("Object name, used later to target it");

export const TargetSchema = z.union([
  z.literal("selection"),
  z.object({
    name: z.string().optional(),
    uuid: z.string().optional(),
    layer: z.string().optional(),
  }).refine((r) => r.name !== undefined || r.uuid !== undefined, "Provide name or uuid"),
]);
export const targetArg = TargetSchema.describe('Object reference: "selection" or {name, layer?} / {uuid}');
export const targetsArg = z.array(TargetSchema).min(1).max(500).optional().describe("Multiple object references; defaults to current selection");

export const colorArg = HexColorSchema.describe("Hex color, e.g. #1A2B3C");
export const strokeArg = z.union([
  z.literal("none"),
  z.object({
    color: HexColorSchema,
    width: z.number().min(0).max(1000).default(1),
    dashes: z.array(z.number().min(0)).max(8).optional(),
    cap: z.enum(["butt", "round", "square"]).optional(),
    join: z.enum(["miter", "round", "bevel"]).optional(),
  }),
]);
export const fillArg = z.union([colorArg, z.literal("none")]);

export function color(hex: string | undefined): ReturnType<typeof jsxColor> | undefined {
  return hex ? jsxColor(hex) : undefined;
}

export function fill(v: string | undefined): unknown {
  if (v === undefined) return undefined;
  return v === "none" ? "none" : jsxColor(v);
}

export function stroke(v: z.infer<typeof strokeArg> | undefined): unknown {
  if (v === undefined) return undefined;
  if (v === "none") return "none";
  return { ...v, color: jsxColor(v.color) };
}

/** Convert a value from the call's units to points. */
export function P(ctx: ToolContext, units: Unit | undefined): (v: number | undefined) => number | undefined {
  const u = units ?? ctx.session.units;
  return (v) => (v === undefined ? undefined : toPoints(v, u));
}

export function requireConfirm(confirm: boolean | undefined, what: string): void {
  if (confirm !== true) {
    throw new McpDesignError("CONFIRMATION_REQUIRED", `${what} is destructive. Ask the user, then call again with confirm: true.`);
  }
}

export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
export const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
export const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
