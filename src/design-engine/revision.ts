import { DesignPlanSchema, ElementSchema, type DesignElement, type DesignPlan } from "../schemas/design-plan.js";
import { McpDesignError } from "../utils/errors.js";
import { NAMED_COLORS } from "./color/palettes.js";
import { compilePlan, PlanCompiler, type CompiledPlan } from "./compiler.js";
import { diffPlans, type PlanDiff } from "./plan-store.js";
import { colorRefsOf } from "./validator/validate.js";

export interface RevisionRequest {
  updates?: ({ name: string } & Record<string, unknown>)[];
  add?: unknown[];
  remove?: string[];
  palette?: Record<string, string>;
  instructions?: string;
}

export interface RevisionResult {
  plan: DesignPlan;
  diff: PlanDiff;
  applied: string[];
  unapplied: string[];
  requiresRebuild: boolean;
}

function findElement(plan: DesignPlan, phrase: string): DesignElement | undefined {
  const p = phrase.toLowerCase().replace(/^the\s+/, "").trim();
  return plan.elements.find((e) => e.name.toLowerCase() === p)
    ?? plan.elements.find((e) => e.role?.toLowerCase() === p)
    ?? plan.elements.find((e) => e.name.toLowerCase().includes(p));
}

function colorWord(word: string): string | undefined {
  if (/^#[0-9a-f]{6}$/i.test(word)) return word.toUpperCase();
  return NAMED_COLORS[word.toLowerCase()];
}

/**
 * Small deterministic instruction parser for common revision phrases. Anything it cannot map
 * is returned in `unapplied` so the AI client can fall back to structured updates.
 */
export function parseInstructions(plan: DesignPlan, text: string): { req: RevisionRequest; applied: string[]; unapplied: string[] } {
  const req: RevisionRequest = { updates: [], palette: {} };
  const applied: string[] = [], unapplied: string[] = [];
  const W = plan.document.width, H = plan.document.height;
  for (const raw of text.split(/[.;\n]|\band then\b|,\s*(?=make|change|move|set|increase|decrease)/i).map((s) => s.trim()).filter(Boolean)) {
    let m: RegExpExecArray | null;
    if ((m = /(?:change|make|set)\s+(?:the\s+)?background(?:\s+colou?r)?\s+(?:to\s+)?([#\w]+)/i.exec(raw)) && colorWord(m[1]!)) {
      req.palette!.background = colorWord(m[1]!)!;
      applied.push(raw);
    } else if ((m = /(?:make|change|set|color|colour)\s+(?:the\s+)?(.+?)\s+(?:colou?r\s+)?(?:to\s+)?([#\w]+)$/i.exec(raw)) && colorWord(m[2]!) && findElement(plan, m[1]!)) {
      const el = findElement(plan, m[1]!)!;
      req.updates!.push(el.type === "text" ? { name: el.name, color: colorWord(m[2]!) } : { name: el.name, fill: colorWord(m[2]!) });
      applied.push(raw);
    } else if ((m = /(?:make\s+)?(?:the\s+)?(.+?)\s+(bigger|larger|smaller|much bigger|much smaller)$/i.exec(raw)) && findElement(plan, m[1]!.replace(/^make\s+/i, ""))) {
      const el = findElement(plan, m[1]!.replace(/^make\s+/i, ""))!;
      const f = /much bigger/.test(m[2]!) ? 1.5 : /bigger|larger/.test(m[2]!) ? 1.25 : /much smaller/.test(m[2]!) ? 0.6 : 0.8;
      if (el.type === "text") req.updates!.push({ name: el.name, fontSize: Math.round(el.fontSize * f * 10) / 10 });
      else if ("radius" in el) req.updates!.push({ name: el.name, radius: el.radius * f });
      else if ("width" in el && el.width) req.updates!.push({ name: el.name, width: el.width * f, height: (el as { height: number }).height * f });
      applied.push(raw);
    } else if ((m = /move\s+(?:the\s+)?(.+?)\s+(up|down|left|right)(?:\s+by\s+(\d+(?:\.\d+)?))?$/i.exec(raw)) && findElement(plan, m[1]!)) {
      const el = findElement(plan, m[1]!)!;
      const d = m[3] ? Number(m[3]) : (m[2] === "up" || m[2] === "down" ? H : W) * 0.05;
      const dx = m[2] === "left" ? -d : m[2] === "right" ? d : 0, dy = m[2] === "up" ? -d : m[2] === "down" ? d : 0;
      req.updates!.push({ name: el.name, x: el.x + dx, y: el.y + dy, align: undefined });
      applied.push(raw);
    } else if ((m = /(?:change|set|replace)\s+(?:the\s+)?(.+?)\s+(?:text|copy|wording)\s+to\s+["“](.+)["”]/i.exec(raw)) && findElement(plan, m[1]!)) {
      req.updates!.push({ name: findElement(plan, m[1]!)!.name, content: m[2] });
      applied.push(raw);
    } else if ((m = /(?:remove|delete|hide)\s+(?:the\s+)?(.+)$/i.exec(raw)) && findElement(plan, m[1]!)) {
      (req.remove ??= []).push(findElement(plan, m[1]!)!.name);
      applied.push(raw);
    } else {
      unapplied.push(raw);
    }
  }
  return { req, applied, unapplied };
}

/** Produce the next plan version. Elements are matched by name; nothing else is touched. */
export function revisePlan(plan: DesignPlan, request: RevisionRequest): RevisionResult {
  let req = request;
  const applied: string[] = [];
  const unapplied: string[] = [];
  if (request.instructions) {
    const parsed = parseInstructions(plan, request.instructions);
    req = {
      updates: [...(request.updates ?? []), ...(parsed.req.updates ?? [])],
      add: request.add,
      remove: [...(request.remove ?? []), ...(parsed.req.remove ?? [])],
      palette: { ...(parsed.req.palette ?? {}), ...(request.palette ?? {}) },
    };
    applied.push(...parsed.applied);
    unapplied.push(...parsed.unapplied);
  }

  const elements = plan.elements.map((e) => ({ ...e }) as Record<string, unknown>);
  for (const u of req.updates ?? []) {
    const idx = elements.findIndex((e) => e.name === u.name);
    if (idx < 0) throw new McpDesignError("OBJECT_NOT_FOUND", `No element named "${u.name}" in the plan`);
    const next = { ...elements[idx], ...u };
    for (const k of Object.keys(u)) if (u[k] === undefined) delete next[k];
    elements[idx] = ElementSchema.parse(next) as Record<string, unknown>;
    if (!request.instructions) applied.push(`update ${u.name}`);
  }
  const remove = new Set(req.remove ?? []);
  for (const n of remove) if (!elements.some((e) => e.name === n)) throw new McpDesignError("OBJECT_NOT_FOUND", `No element named "${n}" to remove`);
  const kept = elements.filter((e) => !remove.has(String(e.name)));
  for (const a of req.add ?? []) kept.push(ElementSchema.parse(a) as Record<string, unknown>);

  const palette = { ...plan.palette, colors: { ...plan.palette.colors, ...(req.palette ?? {}) } };
  const next = DesignPlanSchema.parse({ ...plan, palette, elements: kept });
  const diff = diffPlans(plan, next);
  return { plan: next, diff, applied, unapplied, requiresRebuild: diff.documentChanged.length > 0 };
}

const GEOMETRY = ["x", "y", "width", "height", "radius", "innerRadius", "x2", "y2", "align", "points", "cornerRadius", "sides"];

export interface RevisionOps {
  updates: Record<string, unknown>[];
  additions?: CompiledPlan;
  removals: string[];
}

/** Translate a plan diff into targeted Illustrator operations (no document rebuild). */
export function revisionOps(prev: DesignPlan, next: DesignPlan, diff: PlanDiff): RevisionOps {
  const compiled = new Map(compilePlan(next, { newDocument: false }).elements.map((e) => [String(e.name), e]));
  const compiler = new PlanCompiler(next);
  const touched = new Map<string, Set<string>>();
  for (const c of diff.changed) touched.set(c.name, new Set(c.fields));
  if (diff.paletteChanged.length) {
    for (const el of next.elements) {
      const refs = [...("fill" in el ? colorRefsOf(el.fill) : []), ...(el.type === "text" ? [el.color] : []), ...("stroke" in el && el.stroke && el.stroke !== "none" ? [el.stroke.color] : [])];
      if (refs.some((r) => diff.paletteChanged.some((role) => r === `palette.${role}`))) {
        const set = touched.get(el.name) ?? new Set<string>();
        set.add("fill"); set.add("color"); set.add("stroke");
        touched.set(el.name, set);
      }
    }
  }
  const updates: Record<string, unknown>[] = [];
  for (const [name, fields] of touched) {
    const c = compiled.get(name);
    if (!c) continue;
    const u: Record<string, unknown> = { name };
    if ([...fields].some((f) => GEOMETRY.includes(f))) {
      if (c.cx !== undefined) { u.x = Number(c.cx) - Number(c.radius); u.y = Number(c.cy) - Number(c.radius); u.width = Number(c.radius) * 2; u.height = Number(c.radius) * 2; }
      else if (c.x1 !== undefined) { u.x = Math.min(Number(c.x1), Number(c.x2)); u.y = Math.min(Number(c.y1), Number(c.y2)); }
      else { u.x = c.x; u.y = c.y; if (c.type !== "text") { u.width = c.width; u.height = c.height; } }
    }
    if (fields.has("fill") && c.fill !== undefined) u.fill = c.fill;
    if (fields.has("color") && c.color !== undefined) u.fill = c.color;
    if (fields.has("stroke") && c.stroke !== undefined) u.stroke = c.stroke;
    for (const k of ["content", "fontSize", "weight", "tracking", "leading", "opacity", "blendMode", "rotation", "effects"]) if (fields.has(k)) u[k] = c[k];
    if (fields.has("font") || fields.has("fontRole")) u.font = c.font;
    if (fields.has("textAlign")) u.align = c.align;
    if (fields.has("layer")) u.layerTo = c.layer;
    updates.push(u);
  }
  if (diff.paletteChanged.includes("background") && next.background.type === "solid") {
    updates.push({ name: "Background", fill: compiler.color(next.background.color) });
  }
  const additions = diff.added.length ? compilePlan(next, { newDocument: false, only: new Set(diff.added) }) : undefined;
  void prev;
  return { updates, additions, removals: diff.removed };
}
