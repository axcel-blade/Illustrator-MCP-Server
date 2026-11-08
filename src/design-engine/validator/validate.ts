import { ZodError } from "zod";
import { DesignPlanSchema, type DesignElement, type DesignPlan, type Fill } from "../../schemas/design-plan.js";
import { contrastRatio } from "../../utils/colors.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  plan?: DesignPlan;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function resolveColor(ref: string, plan: Pick<DesignPlan, "palette">): string | undefined {
  if (ref.startsWith("#")) return ref;
  const role = ref.slice("palette.".length);
  return plan.palette.colors[role];
}

export function colorRefsOf(fill: Fill | undefined): string[] {
  if (!fill || fill === "none") return [];
  if (typeof fill === "string") return [fill];
  return fill.stops.map((s) => s.color);
}

/** Approximate box in document units, used for validation and critique before execution. */
export function approxBox(el: DesignElement): { x: number; y: number; width: number; height: number } {
  switch (el.type) {
    case "circle":
      return { x: el.x - el.radius, y: el.y - el.radius, width: el.radius * 2, height: el.radius * 2 };
    case "polygon":
    case "star":
      return { x: el.x - el.radius, y: el.y - el.radius, width: el.radius * 2, height: el.radius * 2 };
    case "line":
      return { x: Math.min(el.x, el.x2), y: Math.min(el.y, el.y2), width: Math.abs(el.x2 - el.x), height: Math.abs(el.y2 - el.y) };
    case "path": {
      const xs = el.points.map((p) => p.x), ys = el.points.map((p) => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    case "text":
      return { x: el.x, y: el.y, width: el.width ?? 0, height: el.height ?? 0 };
    default:
      return { x: el.x, y: el.y, width: el.width, height: el.height };
  }
}

function zodIssues(err: ZodError): ValidationIssue[] {
  return err.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
}

/** Full validation: schema, then semantic checks (references, dependencies, geometry, contrast). */
export function validatePlan(input: unknown): ValidationResult {
  const parsed = DesignPlanSchema.safeParse(input);
  if (!parsed.success) return { valid: false, errors: zodIssues(parsed.error), warnings: [] };
  const plan = parsed.data;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const layerNames = new Set<string>();
  plan.layers.forEach((l, i) => {
    if (layerNames.has(l.name)) errors.push({ path: `layers.${i}.name`, message: `Duplicate layer name "${l.name}"` });
    layerNames.add(l.name);
  });

  const names = new Map<string, DesignElement>();
  plan.elements.forEach((el, i) => {
    const p = `elements.${i}`;
    if (names.has(el.name)) errors.push({ path: `${p}.name`, message: `Duplicate element name "${el.name}" (names are used to target revisions)` });
    names.set(el.name, el);
    if (!layerNames.has(el.layer)) errors.push({ path: `${p}.layer`, message: `Layer "${el.layer}" is not declared in layers` });

    const refs: string[] = [];
    if ("fill" in el) refs.push(...colorRefsOf(el.fill));
    if ("stroke" in el && el.stroke && el.stroke !== "none") refs.push(el.stroke.color);
    if (el.type === "text") refs.push(el.color);
    for (const r of refs) {
      if (!resolveColor(r, plan)) errors.push({ path: p, message: `Color reference ${r} is not defined in the palette` });
    }
    if (el.type === "star" && el.innerRadius >= el.radius) errors.push({ path: `${p}.innerRadius`, message: "innerRadius must be smaller than radius" });
    if (el.type === "text" && (el.width === undefined) !== (el.height === undefined)) {
      errors.push({ path: p, message: "Area text needs both width and height (or neither for point text)" });
    }
  });

  // Alignment dependencies: references must exist and must not form cycles.
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (name: string, trail: string[]): void => {
    if (done.has(name)) return;
    if (visiting.has(name)) {
      errors.push({ path: "elements", message: `Alignment cycle: ${[...trail, name].join(" -> ")}` });
      return;
    }
    visiting.add(name);
    const el = names.get(name);
    const ref = el?.align?.relativeTo;
    if (ref && ref !== "artboard") {
      if (!names.has(ref)) errors.push({ path: `elements[${name}].align.relativeTo`, message: `Unknown alignment reference "${ref}"` });
      else visit(ref, [...trail, name]);
    }
    visiting.delete(name);
    done.add(name);
  };
  for (const n of names.keys()) visit(n, []);

  if (plan.background.type === "solid" && !resolveColor(plan.background.color, plan)) {
    errors.push({ path: "background.color", message: `Unresolved background color ${plan.background.color}` });
  }

  // Geometry warnings (do not block execution).
  const { width: W, height: H } = plan.document;
  for (const el of plan.elements) {
    if (el.align) continue;
    const b = approxBox(el);
    if (b.x > W || b.y > H || b.x + b.width < 0 || b.y + b.height < 0) {
      warnings.push({ path: `elements[${el.name}]`, message: "Element lies entirely outside the artboard" });
    }
  }

  // Text contrast against the background color (WCAG: 4.5 normal, 3 for large text).
  const bg = plan.background.type === "solid" ? resolveColor(plan.background.color, plan) : undefined;
  if (bg) {
    for (const el of plan.elements) {
      if (el.type !== "text") continue;
      const fg = resolveColor(el.color, plan);
      if (!fg) continue;
      const ratio = contrastRatio(fg, bg);
      const min = el.fontSize >= 18 ? 3 : 4.5;
      if (ratio < min) {
        warnings.push({ path: `elements[${el.name}]`, message: `Text contrast ${ratio.toFixed(2)}:1 against background is below ${min}:1` });
      }
    }
  }

  return { valid: errors.length === 0, plan: errors.length === 0 ? plan : undefined, errors, warnings };
}
