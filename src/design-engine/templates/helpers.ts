import type { DesignElement, DesignPlanInput } from "../../schemas/design-plan.js";
import type { RolePalette } from "../color/palettes.js";
import type { TypeSystem } from "../typography/type-systems.js";
import type { Unit } from "../../utils/units.js";

export interface Copy {
  headline: string;
  subheadline: string;
  body: string;
  cta: string;
  brand: string;
  tagline: string;
  contact: string;
  items: string[];
}

export interface TemplateContext {
  style: string;
  palette: RolePalette;
  type: TypeSystem;
  copy: Copy;
  imagePath?: string;
  /** Optional size override in the template's units. */
  size?: { width: number; height: number; units: Unit };
}

/** Template output is validated by the planner (validatePlan), so elements are loosely typed here. */
export type TemplateOutput = Pick<DesignPlanInput, "document" | "background" | "layers" | "grid" | "tokens"> & {
  elements: ElementInput[];
  /** Auto-layout tree (see ui/layout.ts), flattened into elements during validation. */
  autoLayout?: Record<string, unknown>[];
};

export interface TemplateDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultSize: { width: number; height: number; units: Unit };
  build(ctx: TemplateContext, size: { width: number; height: number; units: Unit }): TemplateOutput;
}

export type ElementInput = { type: DesignElement["type"]; name: string; layer: string } & Record<string, unknown>;

/** Element builders keep templates terse; the schema fills defaults. */
export const el = {
  rect: (name: string, layer: string, x: number, y: number, width: number, height: number, fill: string, extra: Record<string, unknown> = {}) =>
    ({ type: "rect", name, layer, x, y, width, height, fill, stroke: "none", ...extra }) as ElementInput,
  circle: (name: string, layer: string, cx: number, cy: number, radius: number, fill: string, extra: Record<string, unknown> = {}) =>
    ({ type: "circle", name, layer, x: cx, y: cy, radius, fill, stroke: "none", ...extra }) as ElementInput,
  line: (name: string, layer: string, x: number, y: number, x2: number, y2: number, color: string, width = 0.75) =>
    ({ type: "line", name, layer, x, y, x2, y2, stroke: { color, width } }) as ElementInput,
  text: (name: string, layer: string, content: string, x: number, y: number, fontSize: number, extra: Record<string, unknown> = {}) =>
    ({ type: "text", name, layer, content, x, y, fontSize, ...extra }) as ElementInput,
  poly: (name: string, layer: string, cx: number, cy: number, radius: number, sides: number, fill: string, extra: Record<string, unknown> = {}) =>
    ({ type: "polygon", name, layer, x: cx, y: cy, radius, sides, fill, stroke: "none", ...extra }) as ElementInput,
  star: (name: string, layer: string, cx: number, cy: number, radius: number, innerRadius: number, points: number, fill: string) =>
    ({ type: "star", name, layer, x: cx, y: cy, radius, innerRadius, points, fill, stroke: "none" }) as ElementInput,
};

export const STANDARD_LAYERS = [{ name: "Typography" }, { name: "Graphics" }, { name: "Images" }, { name: "Background", locked: true }];

export function heading(ctx: TemplateContext, content: string): string {
  return ctx.type.headingCaps ? content.toUpperCase() : content;
}

/** Image element when the brief supplied a file, otherwise a labelled placeholder frame. */
export function imageOrPlaceholder(ctx: TemplateContext, name: string, x: number, y: number, w: number, h: number): ElementInput[] {
  if (ctx.imagePath) return [{ type: "image", name, layer: "Images", x, y, width: w, height: h, path: ctx.imagePath } as ElementInput];
  return [
    el.rect(`${name} Placeholder`, "Images", x, y, w, h, "palette.surface", { role: "image-placeholder", stroke: { color: "palette.muted", width: 0.5, dashes: [3, 3] } }),
    el.text(`${name} Placeholder Label`, "Images", "IMAGE", x + w / 2, y + h / 2, 9, { color: "palette.muted", textAlign: "center", fontRole: "accent", role: "placeholder-label" }),
  ];
}
