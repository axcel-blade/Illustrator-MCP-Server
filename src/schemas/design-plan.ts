import { z } from "zod";
import { HexColorSchema } from "../utils/colors.js";
import { UnitSchema } from "../utils/units.js";

/**
 * Structured intermediate design representation.
 *
 * Coordinates: origin at the artboard's top-left corner, x right, y DOWN, in `document.units`.
 * Elements are listed bottom-to-top unless `z` is given (higher z = closer to the viewer).
 * Colors are hex strings or palette references of the form "palette.<role>".
 */

export const ColorRefSchema = z.union([
  HexColorSchema,
  z.string().regex(/^palette\.[a-zA-Z][\w-]*$/, "Palette references look like palette.primary"),
]);

export const GradientSchema = z.object({
  type: z.enum(["linear", "radial"]).default("linear"),
  angle: z.number().min(-360).max(360).default(0),
  stops: z
    .array(z.object({ color: ColorRefSchema, position: z.number().min(0).max(100), opacity: z.number().min(0).max(100).optional() }))
    .min(2)
    .max(16),
});

export const FillSchema = z.union([ColorRefSchema, GradientSchema, z.literal("none")]);

export const StrokeSchema = z.union([
  z.literal("none"),
  z.object({
    color: ColorRefSchema,
    width: z.number().min(0).max(1000).default(1),
    dashes: z.array(z.number().min(0)).max(8).optional(),
    cap: z.enum(["butt", "round", "square"]).optional(),
    join: z.enum(["miter", "round", "bevel"]).optional(),
  }),
]);

export const EffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("shadow"), offsetX: z.number().default(4), offsetY: z.number().default(4), blur: z.number().min(0).default(5), opacity: z.number().min(0).max(1).default(0.4) }),
  z.object({ type: z.literal("blur"), radius: z.number().min(0).max(250).default(5) }),
  z.object({ type: z.literal("innerGlow"), radius: z.number().min(0).default(8), opacity: z.number().min(0).max(1).default(0.75) }),
  z.object({ type: z.literal("outerGlow"), radius: z.number().min(0).default(8), opacity: z.number().min(0).max(1).default(0.75) }),
]);

export const BlendModeSchema = z.enum([
  "normal", "multiply", "screen", "overlay", "darken", "lighten", "colorDodge", "colorBurn", "hardLight",
  "softLight", "difference", "exclusion", "hue", "saturation", "color", "luminosity",
]);

export const AlignSchema = z.object({
  relativeTo: z.string().default("artboard"),
  horizontal: z.enum(["left", "center", "right"]).optional(),
  vertical: z.enum(["top", "middle", "bottom"]).optional(),
  /** Inset from the reference edge (in document units). */
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
});

const Base = {
  name: z.string().min(1).max(120),
  layer: z.string().min(1),
  x: z.number().default(0),
  y: z.number().default(0),
  rotation: z.number().min(-360).max(360).optional(),
  opacity: z.number().min(0).max(100).optional(),
  blendMode: BlendModeSchema.optional(),
  effects: z.array(EffectSchema).max(8).optional(),
  z: z.number().int().optional(),
  locked: z.boolean().optional(),
  align: AlignSchema.optional(),
  /** Free-form role used by the critique engine (e.g. "headline", "cta", "decoration"). */
  role: z.string().optional(),
};

const Paint = { fill: FillSchema.optional(), stroke: StrokeSchema.optional() };
const Size = { width: z.number().positive(), height: z.number().positive() };

export const RectElement = z.object({ type: z.literal("rect"), ...Base, ...Paint, ...Size, cornerRadius: z.number().min(0).optional() });
export const EllipseElement = z.object({ type: z.literal("ellipse"), ...Base, ...Paint, ...Size });
/** Circle: x/y is the CENTER, unlike other shapes. */
export const CircleElement = z.object({ type: z.literal("circle"), ...Base, ...Paint, radius: z.number().positive() });
export const PolygonElement = z.object({ type: z.literal("polygon"), ...Base, ...Paint, radius: z.number().positive(), sides: z.number().int().min(3).max(100) });
export const StarElement = z.object({
  type: z.literal("star"), ...Base, ...Paint, radius: z.number().positive(), innerRadius: z.number().positive(), points: z.number().int().min(3).max(100),
});
export const LineElement = z.object({ type: z.literal("line"), ...Base, stroke: StrokeSchema.optional(), x2: z.number(), y2: z.number() });
export const PathPointSchema = z.object({
  x: z.number(), y: z.number(),
  in: z.tuple([z.number(), z.number()]).optional(),
  out: z.tuple([z.number(), z.number()]).optional(),
  corner: z.boolean().optional(),
});
export const PathElement = z.object({ type: z.literal("path"), ...Base, ...Paint, points: z.array(PathPointSchema).min(2).max(5000), closed: z.boolean().default(false) });
export const TextElement = z.object({
  type: z.literal("text"), ...Base,
  content: z.string().min(1).max(20000),
  fontRole: z.enum(["heading", "body", "accent"]).default("body"),
  font: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
  fontSize: z.number().min(1).max(1296).default(12),
  weight: z.enum(["thin", "light", "regular", "medium", "semibold", "bold", "extrabold", "black"]).optional(),
  color: ColorRefSchema.default("palette.text"),
  textAlign: z.enum(["left", "center", "right", "justify"]).default("left"),
  tracking: z.number().min(-1000).max(10000).optional(),
  leading: z.number().positive().optional(),
  /** When both are set the text is area text wrapped inside this box. */
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  caps: z.enum(["none", "all"]).optional(),
});
export const ImageElement = z.object({
  type: z.literal("image"), ...Base, ...Size,
  path: z.string().min(1),
  embed: z.boolean().default(false),
  fit: z.enum(["contain", "stretch"]).default("contain"),
});

export const ElementSchema = z.discriminatedUnion("type", [
  RectElement, EllipseElement, CircleElement, PolygonElement, StarElement, LineElement, PathElement, TextElement, ImageElement,
]);

export const PaletteSchema = z.object({
  name: z.string().default("Custom"),
  colors: z.record(z.string().regex(/^[a-zA-Z][\w-]*$/), HexColorSchema),
});

export const FontRoleSchema = z.object({
  fonts: z.array(z.string()).min(1),
  weight: z.enum(["thin", "light", "regular", "medium", "semibold", "bold", "extrabold", "black"]).optional(),
  tracking: z.number().optional(),
});

/**
 * Design tokens (Figma-variable style): named spacing, radius and type sizes. Auto-layout nodes
 * and UI components reference them by key (e.g. gap: "md", radius: "full", fontSize: "title").
 * Spacing and radius are in document units; font sizes are in points.
 */
export const DesignTokensSchema = z.object({
  spacing: z.record(z.number().min(0)).default({ none: 0, xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 }),
  radius: z.record(z.number().min(0)).default({ none: 0, sm: 4, md: 8, lg: 16, xl: 24, full: 9999 }),
  fontSize: z.record(z.number().min(1).max(1296)).default({ caption: 12, label: 14, body: 16, title: 20, heading: 28, display: 44, hero: 64 }),
  /** Default height of interactive controls (buttons, inputs). */
  controlHeight: z.number().positive().default(48),
});
export type DesignTokens = z.infer<typeof DesignTokensSchema>;

export const DesignPlanSchema = z.object({
  version: z.literal(1).default(1),
  meta: z
    .object({
      title: z.string().optional(),
      brief: z.string().optional(),
      category: z.string().optional(),
      style: z.string().optional(),
      audience: z.string().optional(),
      template: z.string().optional(),
      rationale: z.array(z.string()).optional(),
    })
    .default({}),
  document: z.object({
    name: z.string().min(1).max(200).default("Untitled Design"),
    width: z.number().positive(),
    height: z.number().positive(),
    units: UnitSchema.default("mm"),
    colorMode: z.enum(["RGB", "CMYK"]).default("RGB"),
  }),
  background: z
    .union([
      z.object({ type: z.literal("solid"), color: ColorRefSchema }),
      z.object({ type: z.literal("gradient"), gradient: GradientSchema }),
      z.object({ type: z.literal("none") }),
    ])
    .default({ type: "none" }),
  palette: PaletteSchema.default({ name: "Default", colors: { background: "#FFFFFF", text: "#111111", primary: "#1F4E79", accent: "#E07A1F" } }),
  typography: z
    .object({ heading: FontRoleSchema, body: FontRoleSchema, accent: FontRoleSchema.optional() })
    .default({ heading: { fonts: ["Arial"] }, body: { fonts: ["Arial"] } }),
  grid: z
    .object({ columns: z.number().int().min(1).max(24).default(12), margin: z.number().min(0).default(15), gutter: z.number().min(0).default(5) })
    .optional(),
  tokens: DesignTokensSchema.optional(),
  layers: z.array(z.object({ name: z.string().min(1).max(120), locked: z.boolean().optional() })).min(1).max(50),
  elements: z.array(ElementSchema).max(2000),
  swatches: z.boolean().default(true),
  export: z
    .object({ formats: z.array(z.enum(["png", "jpg", "svg", "pdf", "eps"])).default(["png"]), ppi: z.number().min(18).max(2400).default(150) })
    .optional(),
});

export type DesignPlan = z.infer<typeof DesignPlanSchema>;
export type DesignPlanInput = z.input<typeof DesignPlanSchema>;
export type DesignElement = z.infer<typeof ElementSchema>;
export type Fill = z.infer<typeof FillSchema>;
export type Stroke = z.infer<typeof StrokeSchema>;
export type Gradient = z.infer<typeof GradientSchema>;
