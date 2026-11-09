import { z } from "zod";
import { BlendModeSchema, ColorRefSchema, DesignTokensSchema, EffectSchema, FillSchema, StrokeSchema, type DesignTokens } from "../../schemas/design-plan.js";
import { McpDesignError } from "../../utils/errors.js";
import { contrastRatio, mixHex } from "../../utils/colors.js";
import { toPoints, type Unit } from "../../utils/units.js";
import { expandComponent } from "./components.js";

/*
 * Auto layout (Figma-style). A plan may carry `autoLayout`: a tree of stacks, components and leaf
 * nodes. Before validation the tree is measured and flattened into ordinary absolutely-positioned
 * plan elements, so the compiler, revisions and critique keep working on plain elements.
 *
 * Sizing per axis: a number (fixed), "hug" (fit content), "fill" (take the space the parent
 * offers) or a percentage string ("40%") of the parent's inner size. Spacing, radius and font
 * sizes accept token keys (see DesignTokensSchema).
 */

const TokenNumber = z.union([z.number().min(0), z.string().min(1)]);
const Dim = z.union([z.number().positive(), z.enum(["hug", "fill"]), z.string().regex(/^\d+(\.\d+)?%$/)]);
const PaddingSchema = z.union([
  TokenNumber,
  z.object({ x: TokenNumber, y: TokenNumber, top: TokenNumber, right: TokenNumber, bottom: TokenNumber, left: TokenNumber }).partial(),
]);

const Common = {
  name: z.string().min(1).max(120),
  layer: z.string().min(1).optional(),
  role: z.string().optional(),
  opacity: z.number().min(0).max(100).optional(),
  effects: z.array(EffectSchema).max(8).optional(),
  blendMode: BlendModeSchema.optional(),
};

export type DimValue = z.infer<typeof Dim>;
type TokenValue = z.infer<typeof TokenNumber>;

export interface StackNode {
  type: "stack";
  name: string; layer?: string; role?: string; opacity?: number; effects?: z.infer<typeof EffectSchema>[]; blendMode?: z.infer<typeof BlendModeSchema>;
  direction: "vertical" | "horizontal";
  gap: TokenValue;
  padding: z.infer<typeof PaddingSchema>;
  align: "start" | "center" | "end" | "stretch";
  justify: "start" | "center" | "end" | "space-between";
  width: DimValue; height: DimValue;
  x?: number; y?: number;
  fill?: z.infer<typeof FillSchema>; stroke?: z.infer<typeof StrokeSchema>; radius?: TokenValue;
  children: LayoutNode[];
}
export type LeafNode =
  | { type: "text"; name: string; layer?: string; role?: string; opacity?: number; effects?: z.infer<typeof EffectSchema>[]; content: string; fontSize: TokenValue; fontRole: "heading" | "body" | "accent"; weight?: string; color: string; textAlign?: "left" | "center" | "right"; width: DimValue; tracking?: number; leading?: number; caps?: "none" | "all"; font?: string | string[] }
  | { type: "rect" | "ellipse"; name: string; layer?: string; role?: string; opacity?: number; effects?: z.infer<typeof EffectSchema>[]; width: DimValue; height: DimValue; fill?: z.infer<typeof FillSchema>; stroke?: z.infer<typeof StrokeSchema>; radius?: TokenValue }
  | { type: "circle"; name: string; layer?: string; role?: string; opacity?: number; effects?: z.infer<typeof EffectSchema>[]; radius: number; fill?: z.infer<typeof FillSchema>; stroke?: z.infer<typeof StrokeSchema> }
  | { type: "image"; name: string; layer?: string; role?: string; opacity?: number; effects?: z.infer<typeof EffectSchema>[]; width: DimValue; height: DimValue; path: string }
  | { type: "spacer"; name?: string; size?: TokenValue };
export interface ComponentNode {
  type: "component"; name: string; layer?: string; component: string; props: Record<string, unknown>; width?: DimValue; height?: DimValue;
}
export type LayoutNode = StackNode | LeafNode | ComponentNode;

export const LayoutNodeSchema: z.ZodType<LayoutNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("stack"), ...Common,
      direction: z.enum(["vertical", "horizontal"]).default("vertical"),
      gap: TokenNumber.default(0), padding: PaddingSchema.default(0),
      align: z.enum(["start", "center", "end", "stretch"]).default("start"),
      justify: z.enum(["start", "center", "end", "space-between"]).default("start"),
      width: Dim.default("hug"), height: Dim.default("hug"),
      x: z.number().optional(), y: z.number().optional(),
      fill: FillSchema.optional(), stroke: StrokeSchema.optional(), radius: TokenNumber.optional(),
      children: z.array(LayoutNodeSchema).max(500).default([]),
    }),
    z.object({
      type: z.literal("text"), ...Common, content: z.string().min(1).max(20000),
      fontSize: TokenNumber.default("body"), fontRole: z.enum(["heading", "body", "accent"]).default("body"),
      weight: z.enum(["thin", "light", "regular", "medium", "semibold", "bold", "extrabold", "black"]).optional(),
      color: ColorRefSchema.default("palette.text"), textAlign: z.enum(["left", "center", "right"]).optional(),
      width: Dim.default("hug"), tracking: z.number().optional(), leading: z.number().positive().optional(),
      caps: z.enum(["none", "all"]).optional(), font: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
    }),
    z.object({ type: z.literal("rect"), ...Common, width: Dim, height: Dim, fill: FillSchema.optional(), stroke: StrokeSchema.optional(), radius: TokenNumber.optional() }),
    z.object({ type: z.literal("ellipse"), ...Common, width: Dim, height: Dim, fill: FillSchema.optional(), stroke: StrokeSchema.optional() }),
    z.object({ type: z.literal("circle"), ...Common, radius: z.number().positive(), fill: FillSchema.optional(), stroke: StrokeSchema.optional() }),
    z.object({ type: z.literal("image"), ...Common, width: Dim, height: Dim, path: z.string().min(1) }),
    z.object({ type: z.literal("spacer"), name: z.string().optional(), size: TokenNumber.optional() }),
    z.object({
      type: z.literal("component"), name: z.string().min(1).max(120), layer: z.string().min(1).optional(),
      component: z.string().min(1), props: z.record(z.unknown()).default({}), width: Dim.optional(), height: Dim.optional(),
    }),
  ]) as unknown as z.ZodType<LayoutNode, z.ZodTypeDef, unknown>,
);

export const AutoLayoutSchema = z.array(LayoutNodeSchema).min(1).max(50);

export interface LayoutEnv {
  tokens: DesignTokens;
  units: Unit;
  defaultLayer: string;
  artboard: { width: number; height: number };
}

type Box = { w: number; h: number };
type Emitted = Record<string, unknown> & { name: string; layer: string };

const EPS = 0.001;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export class AutoLayoutEngine {
  readonly elements: Emitted[] = [];
  readonly layers = new Set<string>();
  readonly warnings: { path: string; message: string }[] = [];

  constructor(private readonly env: LayoutEnv) {}

  space(v: TokenValue | undefined): number {
    if (v === undefined) return 0;
    if (typeof v === "number") return v;
    const t = this.env.tokens.spacing[v];
    if (t === undefined) throw new McpDesignError("PLAN_INVALID", `Unknown spacing token "${v}". Available: ${Object.keys(this.env.tokens.spacing).join(", ")}`);
    return t;
  }

  radius(v: TokenValue | undefined): number | undefined {
    if (v === undefined) return undefined;
    if (typeof v === "number") return v;
    const t = this.env.tokens.radius[v];
    if (t === undefined) throw new McpDesignError("PLAN_INVALID", `Unknown radius token "${v}". Available: ${Object.keys(this.env.tokens.radius).join(", ")}`);
    return t;
  }

  fontSize(v: TokenValue): number {
    if (typeof v === "number") return v;
    const t = this.env.tokens.fontSize[v];
    if (t === undefined) throw new McpDesignError("PLAN_INVALID", `Unknown fontSize token "${v}". Available: ${Object.keys(this.env.tokens.fontSize).join(", ")}`);
    return t;
  }

  private pad(n: StackNode) {
    const p = n.padding;
    if (typeof p === "number" || typeof p === "string") { const v = this.space(p); return { t: v, r: v, b: v, l: v }; }
    const x = this.space(p.x), y = this.space(p.y);
    return {
      t: p.top !== undefined ? this.space(p.top) : y, b: p.bottom !== undefined ? this.space(p.bottom) : y,
      l: p.left !== undefined ? this.space(p.left) : x, r: p.right !== undefined ? this.space(p.right) : x,
    };
  }

  /** Resolve a component to its stack tree once; results are cached per node object. */
  private readonly expanded = new WeakMap<ComponentNode, LayoutNode>();
  private resolve(node: LayoutNode): Exclude<LayoutNode, ComponentNode> {
    if (node.type !== "component") return node;
    let out = this.expanded.get(node);
    if (!out) {
      out = expandComponent(node, this.env.tokens);
      this.expanded.set(node, out);
    }
    return this.resolve(out);
  }

  private dim(d: DimValue | undefined, avail: number | undefined, intrinsic: number): number {
    if (typeof d === "number") return d;
    if (d === "fill") return avail ?? intrinsic;
    if (typeof d === "string" && d.endsWith("%")) return avail !== undefined ? (avail * Number(d.slice(0, -1))) / 100 : intrinsic;
    return intrinsic;
  }

  private textMetrics(n: Extract<LeafNode, { type: "text" }>) {
    const sizeU = this.fontSize(n.fontSize) / toPoints(1, this.env.units);
    const bold = ["semibold", "bold", "extrabold", "black"].includes(n.weight ?? "");
    const charW = sizeU * (bold ? 0.6 : 0.55) * (n.caps === "all" ? 1.15 : 1);
    const lineH = n.leading ? n.leading / toPoints(1, this.env.units) : sizeU * 1.25;
    return { sizeU, charW, lineH };
  }

  /** True when the node grows along the parent's main axis. */
  private flexes(node: LayoutNode, dir: StackNode["direction"]): boolean {
    const n = this.resolve(node);
    if (n.type === "spacer") return n.size === undefined;
    const d = dir === "vertical" ? ("height" in n ? n.height : undefined) : ("width" in n ? n.width : undefined);
    return d === "fill";
  }

  measure(node: LayoutNode, availW?: number, availH?: number): Box {
    const n = this.resolve(node);
    switch (n.type) {
      case "spacer": { const s = n.size === undefined ? 0 : this.space(n.size); return { w: s, h: s }; }
      case "circle": return { w: n.radius * 2, h: n.radius * 2 };
      case "rect": case "ellipse": case "image":
        return { w: Math.max(this.dim(n.width, availW, 0), 1), h: Math.max(this.dim(n.height, availH, 0), 1) };
      case "text": {
        const { charW, lineH } = this.textMetrics(n);
        const lines = n.content.split(/\r?\n/);
        const intrinsic = Math.max(...lines.map((l) => l.length)) * charW;
        if (n.width === "hug" || (n.width === "fill" && availW === undefined)) return { w: intrinsic, h: lines.length * lineH };
        const w = this.dim(n.width, availW, intrinsic);
        const perLine = Math.max(1, Math.floor(w / charW));
        const count = lines.reduce((s, l) => s + Math.max(1, Math.ceil(l.length / perLine)), 0);
        return { w, h: count * lineH };
      }
      case "stack": return this.measureStack(n, availW, availH);
    }
  }

  private measureStack(n: StackNode, availW?: number, availH?: number): Box {
    const p = this.pad(n);
    const fixedW = n.width === "hug" ? undefined : this.dim(n.width, availW, NaN);
    const fixedH = n.height === "hug" ? undefined : this.dim(n.height, availH, NaN);
    const W = fixedW !== undefined && !Number.isNaN(fixedW) ? fixedW : undefined;
    const H = fixedH !== undefined && !Number.isNaN(fixedH) ? fixedH : undefined;
    const sizes = this.childSizes(n, W !== undefined ? W - p.l - p.r : undefined, H !== undefined ? H - p.t - p.b : undefined);
    const gap = this.space(n.gap) * Math.max(0, n.children.filter((c) => !this.isZeroSpacer(c)).length - 1);
    const vertical = n.direction === "vertical";
    const main = sizes.reduce((s, b) => s + (vertical ? b.h : b.w), 0) + gap;
    const cross = Math.max(0, ...sizes.map((b) => (vertical ? b.w : b.h)));
    return {
      w: W ?? (vertical ? cross : main) + p.l + p.r,
      h: H ?? (vertical ? main : cross) + p.t + p.b,
    };
  }

  private isZeroSpacer(c: LayoutNode): boolean {
    return c.type === "spacer" && c.size === undefined;
  }

  /** Child boxes for a stack whose inner size may be known. Flex children share leftover main space. */
  private childSizes(n: StackNode, innerW?: number, innerH?: number): Box[] {
    const vertical = n.direction === "vertical";
    const innerMain = vertical ? innerH : innerW;
    const visible = n.children.filter((c) => !this.isZeroSpacer(c)).length;
    const gap = this.space(n.gap) * Math.max(0, visible - 1);
    const crossAvail = vertical ? innerW : innerH;
    const boxes: (Box | undefined)[] = n.children.map((c) => {
      if (this.flexes(c, n.direction)) return undefined;
      const stretch = n.align === "stretch" && crossAvail !== undefined;
      const b = vertical ? this.measure(c, crossAvail, undefined) : this.measure(c, undefined, crossAvail);
      if (stretch && this.stretchable(c)) return vertical ? { w: crossAvail!, h: this.measure(c, crossAvail, undefined).h } : { w: b.w, h: crossAvail! };
      return b;
    });
    const flexCount = boxes.filter((b) => !b).length;
    const used = boxes.reduce((s, b) => s + (b ? (vertical ? b.h : b.w) : 0), 0) + gap;
    const share = innerMain !== undefined && flexCount ? Math.max(0, innerMain - used) / flexCount : undefined;
    return n.children.map((c, i) => {
      const b = boxes[i];
      if (b) return b;
      const r = this.resolve(c);
      if (r.type === "spacer") return vertical ? { w: 0, h: share ?? 0 } : { w: share ?? 0, h: 0 };
      const m = vertical ? this.measure(c, crossAvail, share) : this.measure(c, share, crossAvail);
      return vertical ? { w: m.w, h: share ?? m.h } : { w: share ?? m.w, h: m.h };
    });
  }

  private stretchable(c: LayoutNode): boolean {
    const r = this.resolve(c);
    return r.type === "stack" || r.type === "rect" || r.type === "text" || r.type === "image";
  }

  private layerOf(n: { layer?: string }, inherited: string): string {
    const l = n.layer ?? inherited;
    this.layers.add(l);
    return l;
  }

  private emit(e: Emitted) {
    this.elements.push(e);
  }

  private common(n: { name?: string; role?: string; opacity?: number; effects?: unknown[]; blendMode?: string }) {
    const out: Record<string, unknown> = {};
    if (n.role) out.role = n.role;
    if (n.opacity !== undefined) out.opacity = n.opacity;
    if (n.effects) out.effects = n.effects;
    if (n.blendMode) out.blendMode = n.blendMode;
    return out;
  }

  place(node: LayoutNode, x: number, y: number, w: number, h: number, layer: string, hint: "left" | "center" | "right" = "left", namePrefix = ""): void {
    const n = this.resolve(node);
    const lyr = this.layerOf(n as { layer?: string }, (node as { layer?: string }).layer ?? layer);
    const name = (s: string) => namePrefix + s;
    switch (n.type) {
      case "spacer": return;
      case "rect": {
        const rad = this.radius(n.radius);
        this.emit({ type: "rect", name: name(n.name), layer: lyr, x: r3(x), y: r3(y), width: r3(Math.max(w, EPS)), height: r3(Math.max(h, EPS)), fill: n.fill ?? "palette.surface", stroke: n.stroke ?? "none", ...(rad ? { cornerRadius: r3(Math.min(rad, w / 2, h / 2)) } : {}), ...this.common(n) });
        return;
      }
      case "ellipse":
        this.emit({ type: "ellipse", name: name(n.name), layer: lyr, x: r3(x), y: r3(y), width: r3(w), height: r3(h), fill: n.fill ?? "palette.surface", stroke: n.stroke ?? "none", ...this.common(n) });
        return;
      case "circle":
        this.emit({ type: "circle", name: name(n.name), layer: lyr, x: r3(x + n.radius), y: r3(y + n.radius), radius: n.radius, fill: n.fill ?? "palette.primary", stroke: n.stroke ?? "none", ...this.common(n) });
        return;
      case "image":
        this.emit({ type: "image", name: name(n.name), layer: lyr, x: r3(x), y: r3(y), width: r3(w), height: r3(h), path: n.path, ...this.common(n) });
        return;
      case "text": {
        const { sizeU } = this.textMetrics(n);
        const base = {
          type: "text", name: name(n.name), layer: lyr, content: n.content, fontSize: this.fontSize(n.fontSize), fontRole: n.fontRole, color: n.color,
          ...(n.weight ? { weight: n.weight } : {}), ...(n.tracking !== undefined ? { tracking: n.tracking } : {}), ...(n.leading ? { leading: n.leading } : {}),
          ...(n.caps ? { caps: n.caps } : {}), ...(n.font ? { font: n.font } : {}), ...this.common(n),
        };
        const align = n.textAlign ?? hint;
        if (n.width === "hug") {
          // Point text anchored on the slot so real glyph widths still line up (left/center/right).
          const ax = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
          this.emit({ ...base, x: r3(ax), y: r3(y), textAlign: align });
        } else {
          // Area text wraps inside the slot; a little extra height prevents overset text.
          this.emit({ ...base, x: r3(x), y: r3(y), width: r3(Math.max(w, 1)), height: r3(h + sizeU * 0.5), textAlign: align });
        }
        return;
      }
      case "stack": return this.placeStack(n, x, y, w, h, lyr, namePrefix);
    }
  }

  private placeStack(n: StackNode, x: number, y: number, w: number, h: number, layer: string, namePrefix: string): void {
    const hasPaint = (n.fill !== undefined && n.fill !== "none") || (n.stroke !== undefined && n.stroke !== "none") || n.effects?.length;
    if (hasPaint) {
      const rad = this.radius(n.radius);
      this.emit({
        type: "rect", name: namePrefix + n.name, layer, x: r3(x), y: r3(y), width: r3(Math.max(w, EPS)), height: r3(Math.max(h, EPS)),
        fill: n.fill ?? "none", stroke: n.stroke ?? "none", ...(rad ? { cornerRadius: r3(Math.min(rad, w / 2, h / 2)) } : {}),
        role: n.role ?? "frame", ...this.common({ ...n, role: undefined }),
      });
    }
    const p = this.pad(n);
    const innerW = w - p.l - p.r, innerH = h - p.t - p.b;
    const vertical = n.direction === "vertical";
    const sizes = this.childSizes(n, innerW, innerH);
    const gapV = this.space(n.gap);
    const visible = n.children.map((c) => !this.isZeroSpacer(c));
    const visibleCount = visible.filter(Boolean).length;
    const used = sizes.reduce((s, b) => s + (vertical ? b.h : b.w), 0) + gapV * Math.max(0, visibleCount - 1);
    const innerMain = vertical ? innerH : innerW;
    const free = Math.max(0, innerMain - used);
    if (used > innerMain + 0.5) {
      this.warnings.push({ path: `autoLayout[${namePrefix}${n.name}]`, message: `Content overflows the ${vertical ? "height" : "width"} by ${r3(used - innerMain)} units; remove children, reduce gaps or enlarge the frame` });
    }
    const hasFlex = n.children.some((c) => this.flexes(c, n.direction));
    let cursor = 0;
    let between = gapV;
    if (!hasFlex) {
      if (n.justify === "center") cursor = free / 2;
      if (n.justify === "end") cursor = free;
      if (n.justify === "space-between" && visibleCount > 1) between = gapV + free / (visibleCount - 1);
    }
    const crossSize = vertical ? innerW : innerH;
    const hint: "left" | "center" | "right" = vertical
      ? n.align === "center" ? "center" : n.align === "end" ? "right" : "left"
      : n.justify === "center" && n.children.length === 1 ? "center" : "left";
    let placed = 0;
    n.children.forEach((c, i) => {
      const b = sizes[i]!;
      const mainSize = vertical ? b.h : b.w;
      let crossLen = vertical ? b.w : b.h;
      if (n.align === "stretch" && this.stretchable(c)) crossLen = crossSize;
      const crossOff = n.align === "center" ? (crossSize - crossLen) / 2 : n.align === "end" ? crossSize - crossLen : 0;
      const cx = vertical ? x + p.l + crossOff : x + p.l + cursor;
      const cy = vertical ? y + p.t + cursor : y + p.t + crossOff;
      this.place(c, cx, cy, vertical ? crossLen : mainSize, vertical ? mainSize : crossLen, layer, hint, namePrefix);
      cursor += mainSize;
      if (visible[i]) {
        placed++;
        if (placed < visibleCount) cursor += between;
      }
    });
  }

  /** Lay out root nodes on the artboard. Roots default to their own x/y (0,0) and hug size. */
  run(roots: LayoutNode[]): Emitted[] {
    const { width: AW, height: AH } = this.env.artboard;
    for (const root of roots) {
      const r = this.resolve(root);
      const x = r.type === "stack" ? r.x ?? 0 : 0;
      const y = r.type === "stack" ? r.y ?? 0 : 0;
      const b = this.measure(root, AW - x, AH - y);
      this.place(root, x, y, b.w, b.h, this.env.defaultLayer);
    }
    return this.elements;
  }
}

/**
 * Expand `autoLayout` on a raw plan input into elements (appended after explicit elements, so
 * explicit elements sit underneath) and declare any layers the tree uses. Returns the input
 * unchanged when it has no autoLayout.
 */
export function expandAutoLayout(input: unknown): unknown {
  return expandAutoLayoutWithWarnings(input).input;
}

export function expandAutoLayoutWithWarnings(input: unknown): { input: unknown; warnings: { path: string; message: string }[] } {
  if (!input || typeof input !== "object" || !("autoLayout" in input)) return { input, warnings: [] };
  const { autoLayout, ...rest } = input as Record<string, unknown> & { autoLayout: unknown };
  if (autoLayout === undefined) return { input: rest, warnings: [] };
  const parsed = AutoLayoutSchema.safeParse(autoLayout);
  if (!parsed.success) {
    throw new McpDesignError("PLAN_INVALID", "autoLayout is invalid", parsed.error.issues.map((i) => ({ path: `autoLayout.${i.path.join(".")}`, message: i.message })));
  }
  const doc = (rest.document ?? {}) as { width?: number; height?: number; units?: Unit };
  if (!doc.width || !doc.height) throw new McpDesignError("PLAN_INVALID", "autoLayout requires document.width and document.height");
  const tokens = DesignTokensSchema.parse(rest.tokens ?? {});
  const layers = Array.isArray(rest.layers) ? (rest.layers as { name: string }[]) : [];
  const defaultLayer = layers[0]?.name ?? "UI";
  const engine = new AutoLayoutEngine({ tokens, units: doc.units ?? "mm", defaultLayer, artboard: { width: doc.width, height: doc.height } });
  const elements = engine.run(parsed.data);
  const declared = new Set(layers.map((l) => l.name));
  const extra = [...engine.layers].filter((l) => !declared.has(l)).map((name) => ({ name }));
  const out = {
    ...rest,
    palette: withUiRoles(rest.palette),
    tokens: rest.tokens ?? tokens,
    layers: [...extra, ...layers],
    elements: [...((rest.elements as unknown[]) ?? []), ...elements],
  };
  return { input: out, warnings: engine.warnings };
}

/**
 * Components reference the full role set. Missing roles are derived from the ones present:
 * surface/muted/secondary by mixing, and "subtle" (secondary text) by mixing text into the
 * background as far as 4.6:1 contrast allows, so it always passes WCAG AA.
 */
export function withUiRoles(palette: unknown): unknown {
  const p = (palette ?? { name: "Default", colors: { background: "#FFFFFF", text: "#111111", primary: "#1F4E79", accent: "#E07A1F" } }) as { name?: string; colors?: Record<string, string> };
  const colors = { ...(p.colors ?? {}) };
  const text = colors.text ?? "#111111", bg = colors.background ?? "#FFFFFF";
  colors.background ??= bg;
  colors.text ??= text;
  colors.primary ??= text;
  colors.accent ??= colors.primary;
  colors.surface ??= mixHex(bg, text, 0.06);
  colors.muted ??= mixHex(text, bg, 0.55);
  colors.secondary ??= mixHex(colors.primary, bg, 0.25);
  if (!colors.subtle) {
    let subtle = text;
    for (let t = 0.6; t >= 0; t -= 0.05) {
      const c = mixHex(text, bg, t);
      if (contrastRatio(c, bg) >= 4.6) { subtle = c; break; }
    }
    colors.subtle = subtle;
  }
  return { ...p, colors };
}
