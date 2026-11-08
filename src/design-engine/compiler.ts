import type { DesignElement, DesignPlan, Fill, Stroke } from "../schemas/design-plan.js";
import { hexToRgb, normalizeHex, rgbToCmyk } from "../utils/colors.js";
import { McpDesignError } from "../utils/errors.js";
import { toPoints, type Unit } from "../utils/units.js";
import { approxBox, resolveColor } from "./validator/validate.js";

/** A color as sent to the JSX layer. */
export interface JsxColor { hex: string; cmyk: { c: number; m: number; y: number; k: number } }
export type JsxFill = JsxColor | "none" | { type: string; angle: number; stops: { color: JsxColor; position: number; opacity?: number }[] };

export function jsxColor(hex: string): JsxColor {
  const n = normalizeHex(hex);
  return { hex: n, cmyk: rgbToCmyk(hexToRgb(n)) };
}

export interface CompiledPlan {
  newDocument: boolean;
  width: number;
  height: number;
  colorMode: "RGB" | "CMYK";
  artboardName: string;
  layers: string[];
  elements: Record<string, unknown>[];
  swatches: { name: string; color: JsxColor }[];
  lockLayers: string[];
  stopOnError: boolean;
}

export class PlanCompiler {
  private readonly u: Unit;
  private readonly boxes = new Map<string, { x: number; y: number; width: number; height: number }>();

  constructor(private readonly plan: DesignPlan) {
    this.u = plan.document.units;
  }

  private pt(v: number): number {
    return toPoints(v, this.u);
  }

  color(ref: string): JsxColor {
    const hex = resolveColor(ref, this.plan);
    if (!hex) throw new McpDesignError("PLAN_INVALID", `Unresolved color ${ref}`);
    return jsxColor(hex);
  }

  fill(f: Fill | undefined): JsxFill | undefined {
    if (f === undefined) return undefined;
    if (f === "none") return "none";
    if (typeof f === "string") return this.color(f);
    return { type: f.type, angle: f.angle, stops: f.stops.map((s) => ({ color: this.color(s.color), position: s.position, opacity: s.opacity })) };
  }

  stroke(s: Stroke | undefined): unknown {
    if (s === undefined) return undefined;
    if (s === "none") return "none";
    return { color: this.color(s.color), width: s.width, dashes: s.dashes, cap: s.cap, join: s.join };
  }

  /** Resolve `align` into absolute coordinates (document units) using reference boxes. */
  private resolvePosition(el: DesignElement): { x: number; y: number; textAlign?: "left" | "center" | "right" } {
    if (!el.align) return { x: el.x, y: el.y };
    const { width: W, height: H } = this.plan.document;
    const ref = el.align.relativeTo === "artboard" ? { x: 0, y: 0, width: W, height: H } : this.boxes.get(el.align.relativeTo);
    if (!ref) throw new McpDesignError("PLAN_INVALID", `Alignment reference ${el.align.relativeTo} must appear before ${el.name}`);
    const box = this.estimateBox(el);
    let { x, y } = el;
    let textAlign: "left" | "center" | "right" | undefined;
    const pointText = el.type === "text" && el.width === undefined;
    const h = el.align.horizontal;
    if (h === "left") { x = ref.x + el.align.offsetX; textAlign = "left"; }
    if (h === "center") { x = pointText ? ref.x + ref.width / 2 : ref.x + (ref.width - box.width) / 2; textAlign = "center"; }
    if (h === "right") { x = pointText ? ref.x + ref.width - el.align.offsetX : ref.x + ref.width - box.width - el.align.offsetX; textAlign = "right"; }
    const v = el.align.vertical;
    if (v === "top") y = ref.y + el.align.offsetY;
    if (v === "middle") y = ref.y + (ref.height - box.height) / 2 + el.align.offsetY;
    if (v === "bottom") y = ref.y + ref.height - box.height - el.align.offsetY;
    if (el.type === "circle" || el.type === "polygon" || el.type === "star") {
      // These use a center point.
      x += box.width / 2;
      y += box.height / 2;
    }
    return { x, y, textAlign: pointText ? textAlign : undefined };
  }

  /** Text boxes are estimated (0.55em average glyph width) because real metrics exist only in Illustrator. */
  private estimateBox(el: DesignElement) {
    if (el.type === "text" && el.width === undefined) {
      const lines = el.content.split(/\r?\n/);
      const longest = Math.max(...lines.map((l) => l.length));
      const sizeU = el.fontSize / toPoints(1, this.u);
      return { x: el.x, y: el.y, width: longest * sizeU * 0.55, height: lines.length * sizeU * 1.2 };
    }
    return approxBox(el);
  }

  element(el: DesignElement): Record<string, unknown> {
    const pos = this.resolvePosition(el);
    const common = {
      name: el.name, layer: el.layer, opacity: el.opacity, blendMode: el.blendMode, rotation: el.rotation, locked: el.locked,
      effects: el.effects?.map((e) => ({ ...e })),
    };
    const box = this.estimateBox({ ...el, x: pos.x, y: pos.y } as DesignElement);
    this.boxes.set(el.name, el.type === "circle" || el.type === "polygon" || el.type === "star"
      ? { ...box, x: pos.x - box.width / 2, y: pos.y - box.height / 2 } : { ...box, x: pos.x, y: pos.y });
    const P = (v: number) => this.pt(v);
    switch (el.type) {
      case "rect":
        return { type: "rect", ...common, x: P(pos.x), y: P(pos.y), width: P(el.width), height: P(el.height), cornerRadius: el.cornerRadius ? P(el.cornerRadius) : undefined, fill: this.fill(el.fill), stroke: this.stroke(el.stroke) };
      case "ellipse":
        return { type: "ellipse", ...common, x: P(pos.x), y: P(pos.y), width: P(el.width), height: P(el.height), fill: this.fill(el.fill), stroke: this.stroke(el.stroke) };
      case "circle":
        return { type: "ellipse", ...common, x: P(pos.x - el.radius), y: P(pos.y - el.radius), width: P(el.radius * 2), height: P(el.radius * 2), fill: this.fill(el.fill), stroke: this.stroke(el.stroke) };
      case "polygon":
        return { type: "polygon", ...common, cx: P(pos.x), cy: P(pos.y), radius: P(el.radius), sides: el.sides, fill: this.fill(el.fill), stroke: this.stroke(el.stroke) };
      case "star":
        return { type: "star", ...common, cx: P(pos.x), cy: P(pos.y), radius: P(el.radius), innerRadius: P(el.innerRadius), points: el.points, fill: this.fill(el.fill), stroke: this.stroke(el.stroke) };
      case "line":
        return { type: "line", ...common, x1: P(pos.x), y1: P(pos.y), x2: P(el.x2 + (pos.x - el.x)), y2: P(el.y2 + (pos.y - el.y)), stroke: this.stroke(el.stroke ?? { color: "palette.text", width: 1 }) };
      case "path":
        return {
          type: "path", ...common, closed: el.closed, fill: this.fill(el.fill), stroke: this.stroke(el.stroke),
          points: el.points.map((p) => ({ x: P(p.x), y: P(p.y), in: p.in?.map(P), out: p.out?.map(P), corner: p.corner })),
        };
      case "text": {
        const role = this.plan.typography[el.fontRole] ?? this.plan.typography.body;
        const fonts = el.font ? (Array.isArray(el.font) ? el.font : [el.font]) : role.fonts;
        return {
          type: "text", ...common, content: el.content, x: P(pos.x), y: P(pos.y),
          width: el.width ? P(el.width) : undefined, height: el.height ? P(el.height) : undefined,
          font: fonts, fontSize: el.fontSize, weight: el.weight ?? role.weight, color: this.color(el.color),
          align: pos.textAlign ?? el.textAlign, tracking: el.tracking ?? role.tracking, leading: el.leading, caps: el.caps,
        };
      }
      case "image":
        return { type: "image", ...common, path: el.path, x: P(pos.x), y: P(pos.y), width: P(el.width), height: P(el.height), embed: el.embed, fit: el.fit };
    }
  }

  compile(opts: { newDocument?: boolean; only?: Set<string> } = {}): CompiledPlan {
    const plan = this.plan;
    const bottomLayer = plan.layers[plan.layers.length - 1]!.name;
    const elements: Record<string, unknown>[] = [];
    if (plan.background.type !== "none" && !opts.only) {
      const fill: Fill = plan.background.type === "solid" ? plan.background.color : plan.background.gradient;
      elements.push({
        type: "rect", name: "Background", layer: bottomLayer, x: 0, y: 0,
        width: this.pt(plan.document.width), height: this.pt(plan.document.height), fill: this.fill(fill), stroke: "none", locked: true,
      });
    }
    // Stable sort by z; elements without z keep list order.
    const ordered = plan.elements.map((el, i) => ({ el, i })).sort((a, b) => (a.el.z ?? 0) - (b.el.z ?? 0) || a.i - b.i);
    for (const { el } of ordered) {
      const compiled = this.element(el);
      if (!opts.only || opts.only.has(el.name)) elements.push(compiled);
    }
    return {
      newDocument: opts.newDocument ?? true,
      width: this.pt(plan.document.width),
      height: this.pt(plan.document.height),
      colorMode: plan.document.colorMode,
      artboardName: plan.document.name,
      layers: plan.layers.map((l) => l.name),
      elements,
      swatches: plan.swatches && !opts.only ? Object.entries(plan.palette.colors).map(([role, hex]) => ({ name: `${plan.palette.name} / ${role}`, color: jsxColor(hex) })) : [],
      lockLayers: plan.layers.filter((l) => l.locked).map((l) => l.name),
      stopOnError: false,
    };
  }
}

export function compilePlan(plan: DesignPlan, opts?: { newDocument?: boolean; only?: Set<string> }): CompiledPlan {
  return new PlanCompiler(plan).compile(opts);
}
