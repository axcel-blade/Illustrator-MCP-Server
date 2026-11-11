import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsxColor } from "../../design-engine/compiler.js";
import { generatePalette, STYLE_PALETTES, type Harmony } from "../../design-engine/color/palettes.js";
import { HexColorSchema, contrastRatio } from "../../utils/colors.js";
import { McpDesignError } from "../../utils/errors.js";
import { BlendModeSchema } from "../../schemas/design-plan.js";
import { colorArg, defineTool, fill, fillArg, op, stroke, strokeArg, targetArg, targetsArg, WRITE, type ToolContext } from "./common.js";

const tgt = { target: targetArg.optional(), targets: targetsArg };
const pick = (a: { target?: unknown; targets?: unknown }) => ({ target: a.target, targets: a.targets });

export function registerAppearanceTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "set_fill_color",
    description: "Set a solid fill (or none) on objects. For text objects this sets the text color.",
    input: { ...tgt, color: fillArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_appearance", { ...pick(a), fill: fill(a.color) }),
  });

  defineTool(server, ctx, {
    name: "set_gradient",
    description: "Apply a linear or radial gradient fill. Creates a named gradient swatch in the document.",
    input: {
      ...tgt, type: z.enum(["linear", "radial"]).default("linear"), angle: z.number().min(-360).max(360).default(0), name: z.string().optional(),
      stops: z.array(z.object({ color: colorArg, position: z.number().min(0).max(100), opacity: z.number().min(0).max(100).optional() })).min(2).max(16),
    },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_appearance", { ...pick(a), fill: { type: a.type, angle: a.angle, name: a.name, stops: a.stops.map((s) => ({ ...s, color: jsxColor(s.color) })) } }),
  });

  defineTool(server, ctx, {
    name: "set_stroke",
    description: "Set stroke color, width (pt), dashes, cap and join, or remove it with \"none\".",
    input: { ...tgt, stroke: strokeArg },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_appearance", { ...pick(a), stroke: stroke(a.stroke) }),
  });

  defineTool(server, ctx, {
    name: "set_opacity",
    description: "Set object opacity (0–100).",
    input: { ...tgt, opacity: z.number().min(0).max(100) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_appearance", { ...pick(a), opacity: a.opacity }),
  });

  defineTool(server, ctx, {
    name: "set_blend_mode",
    description: "Set the transparency blend mode.",
    input: { ...tgt, mode: BlendModeSchema },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_appearance", { ...pick(a), blendMode: a.mode }),
  });

  defineTool(server, ctx, {
    name: "apply_shadow",
    description: "Apply a live Drop Shadow effect (Illustrator CC 2018+ applyEffect). Offsets/blur in points.",
    input: { ...tgt, offsetX: z.number().default(4), offsetY: z.number().default(4), blur: z.number().min(0).max(144).default(5), opacity: z.number().min(0).max(1).default(0.4) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "apply_effect", { ...pick(a), effect: { type: "shadow", offsetX: a.offsetX, offsetY: a.offsetY, blur: a.blur, opacity: a.opacity } },
      ["Live effect XML follows Illustrator's LiveEffect dictionary format; run the integration test to verify on your version."]),
  });

  defineTool(server, ctx, {
    name: "apply_blur",
    description: "Apply a live Gaussian Blur effect (radius in pixels).",
    input: { ...tgt, radius: z.number().min(0.1).max(250).default(5) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "apply_effect", { ...pick(a), effect: { type: "blur", radius: a.radius } }),
  });

  defineTool(server, ctx, {
    name: "apply_appearance",
    description: "Apply several appearance attributes in one call: fill, stroke, opacity, blend mode and effects.",
    input: {
      ...tgt, fill: fillArg.optional(), stroke: strokeArg.optional(), opacity: z.number().min(0).max(100).optional(), blendMode: BlendModeSchema.optional(),
      effects: z.array(z.discriminatedUnion("type", [
        z.object({ type: z.literal("shadow"), offsetX: z.number().default(4), offsetY: z.number().default(4), blur: z.number().default(5), opacity: z.number().min(0).max(1).default(0.4) }),
        z.object({ type: z.literal("blur"), radius: z.number().default(5) }),
        z.object({ type: z.literal("innerGlow"), radius: z.number().default(8), opacity: z.number().min(0).max(1).default(0.75) }),
        z.object({ type: z.literal("outerGlow"), radius: z.number().default(8), opacity: z.number().min(0).max(1).default(0.75) }),
      ])).max(8).optional(),
    },
    annotations: WRITE,
    handler: async (a) => op(ctx, "set_appearance", { ...pick(a), fill: fill(a.fill), stroke: stroke(a.stroke), opacity: a.opacity, blendMode: a.blendMode, effects: a.effects }),
  });

  defineTool(server, ctx, {
    name: "create_color_palette",
    description: "Generate a role-based palette (background, surface, primary, secondary, accent, text, muted) from a base color and harmony rule, or return a curated style palette. Computed by the server; nothing is changed in Illustrator.",
    input: {
      baseColor: HexColorSchema.optional(), harmony: z.enum(["monochrome", "analogous", "complementary", "triadic", "split-complementary"]).default("complementary"),
      style: z.enum(Object.keys(STYLE_PALETTES) as [string, ...string[]]).optional(), dark: z.boolean().default(false),
    },
    annotations: { readOnlyHint: true },
    handler: async (a) => {
      if (!a.baseColor && !a.style) throw new McpDesignError("VALIDATION_ERROR", "Provide baseColor or style.");
      const palette = a.baseColor ? generatePalette(a.baseColor, a.harmony as Harmony, { dark: a.dark }) : STYLE_PALETTES[a.style!]!;
      const c = palette.colors;
      return { data: { palette, contrast: { textOnBackground: +contrastRatio(c.text, c.background).toFixed(2), primaryOnBackground: +contrastRatio(c.primary, c.background).toFixed(2) } }, source: "server" };
    },
  });

  defineTool(server, ctx, {
    name: "create_color_swatches",
    description: "Add named color swatches to the active document, optionally inside a swatch group.",
    input: { group: z.string().max(120).optional(), colors: z.array(z.object({ name: z.string().min(1).max(120), color: colorArg })).min(1).max(200) },
    annotations: WRITE,
    handler: async (a) => op(ctx, "create_swatches", { group: a.group, colors: a.colors.map((c) => ({ name: c.name, color: jsxColor(c.color) })) }),
  });

  defineTool(server, ctx, {
    name: "apply_color_palette",
    description: "Recolor named objects by palette role, e.g. {palette:{primary:'#123456'}, assignments:[{name:'Headline', role:'primary'}]}.",
    input: {
      palette: z.record(HexColorSchema),
      assignments: z.array(z.object({ name: z.string(), layer: z.string().optional(), role: z.string(), property: z.enum(["fill", "stroke"]).default("fill") })).min(1).max(1000),
    },
    annotations: WRITE,
    handler: async (a) => {
      const updates = a.assignments.map((x) => {
        const hex = a.palette[x.role];
        if (!hex) throw new McpDesignError("VALIDATION_ERROR", `Palette has no role "${x.role}"`);
        return x.property === "fill" ? { name: x.name, layer: x.layer, fill: jsxColor(hex) } : { name: x.name, layer: x.layer, stroke: { color: jsxColor(hex) } };
      });
      return op(ctx, "update_elements", { updates });
    },
  });
}
