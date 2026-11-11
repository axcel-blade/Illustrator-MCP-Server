import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { compilePlan } from "../../design-engine/compiler.js";
import { analyzeComposition, type CompositionReport, type InspectedItem } from "../../design-engine/composition/analyzer.js";
import { diffPlans } from "../../design-engine/plan-store.js";
import { planDesign, planVariations, STYLES, type PlanOptions } from "../../design-engine/planner/planner.js";
import { revisePlan, revisionOps } from "../../design-engine/revision.js";
import { TEMPLATES } from "../../design-engine/templates/library.js";
import { validatePlan } from "../../design-engine/validator/validate.js";
import { DesignPlanSchema, type DesignPlan } from "../../schemas/design-plan.js";
import { HexColorSchema } from "../../utils/colors.js";
import { McpDesignError } from "../../utils/errors.js";
import { UnitSchema } from "../../utils/units.js";
import { IMAGE_EXTENSIONS } from "./assets.js";
import { defineTool, READ_ONLY, WRITE, type ToolContext, type ToolOutput } from "./common.js";
import { exportPreview } from "./export.js";

const briefInput = {
  brief: z.string().min(3).max(4000).describe("Natural-language design brief. Quote exact copy, e.g. headline \"PURE BEAUTY\"."),
  style: z.enum(STYLES as [string, ...string[]]).optional(),
  template: z.string().optional().describe("Template id (see list_templates)"),
  copy: z.object({
    headline: z.string().max(300).optional(), subheadline: z.string().max(500).optional(), body: z.string().max(5000).optional(),
    cta: z.string().max(100).optional(), brand: z.string().max(100).optional(), tagline: z.string().max(200).optional(),
    contact: z.string().max(500).optional(), items: z.array(z.string().max(200)).max(20).optional(),
  }).optional(),
  baseColor: HexColorSchema.optional().describe("Derive the palette from this color"),
  harmony: z.enum(["monochrome", "analogous", "complementary", "triadic", "split-complementary"]).optional(),
  palette: z.record(HexColorSchema).optional().describe("Override palette roles, e.g. {background:'#E9DDCC'}"),
  size: z.object({ width: z.number().positive(), height: z.number().positive(), units: UnitSchema }).optional(),
  colorMode: z.enum(["RGB", "CMYK"]).optional(),
  imagePath: z.string().optional().describe("Image to place (must be inside an allowed directory)"),
  designSystem: z.boolean().optional().describe("UI briefs: apply the UI/UX Pro Max product palette + font pairing matched from the brief (default: on unless style or baseColor is given)"),
  execute: z.boolean().default(true).describe("false = return the plan only"),
  preview: z.boolean().default(true).describe("Export and attach a PNG preview after execution"),
  saveAs: z.string().optional().describe("Save the result as this .ai path"),
};

type BriefArgs = z.objectOutputType<typeof briefInput, z.ZodTypeAny>;

interface ExecuteOpts { preview: boolean; saveAs?: string; planId?: string; note?: string; overwrite?: boolean }

interface Inspection { name: string; artboards: { width: number; height: number; active: boolean }[]; items: InspectedItem[] }

/** Check image references and fonts before touching Illustrator; problems become warnings or placeholders. */
async function preflight(ctx: ToolContext, plan: DesignPlan): Promise<{ plan: DesignPlan; warnings: string[] }> {
  const warnings: string[] = [];
  const elements = plan.elements.map((el) => {
    if (el.type !== "image") return el;
    try {
      const path = ctx.paths.resolve(el.path, { extensions: IMAGE_EXTENSIONS, mustExist: true });
      return { ...el, path };
    } catch (e) {
      warnings.push(`Image "${el.name}" unavailable (${(e as Error).message}); a placeholder frame was used instead.`);
      return { type: "rect" as const, name: `${el.name} Placeholder`, layer: el.layer, x: el.x, y: el.y, width: el.width, height: el.height, fill: "palette.surface", stroke: { color: "palette.text", width: 0.5, dashes: [3, 3] }, role: "image-placeholder" };
    }
  });
  const fonts = new Set<string>();
  for (const role of [plan.typography.heading, plan.typography.body, plan.typography.accent]) role?.fonts.forEach((f) => fonts.add(f));
  for (const el of plan.elements) if (el.type === "text" && el.font) (Array.isArray(el.font) ? el.font : [el.font]).forEach((f) => fonts.add(f));
  if (ctx.bridge.adapterName !== "mock" && fonts.size) {
    try {
      const r = await ctx.bridge.run<{ fonts: { requested: string; available: boolean; resolved: string | null }[] }>("check_fonts", { fonts: [...fonts] });
      const roles = { heading: plan.typography.heading, body: plan.typography.body, accent: plan.typography.accent };
      for (const [role, def] of Object.entries(roles)) {
        if (!def) continue;
        const first = def.fonts.find((f) => r.data.fonts.find((x) => x.requested === f)?.available);
        if (!first) warnings.push(`No ${role} font is installed (${def.fonts.join(", ")}); Illustrator's default will be used.`);
        else if (first !== def.fonts[0]) warnings.push(`${role} font "${def.fonts[0]}" not installed; "${first}" will be used.`);
      }
    } catch (e) {
      warnings.push(`Font check failed: ${(e as Error).message}`);
    }
  }
  return { plan: DesignPlanSchema.parse({ ...plan, elements }), warnings };
}

export async function executePlan(ctx: ToolContext, input: DesignPlan, opts: ExecuteOpts): Promise<ToolOutput> {
  const { plan, warnings } = await preflight(ctx, input);
  const stored = ctx.plans.save(plan, { id: opts.planId, note: opts.note });
  const compiled = compilePlan(plan, { newDocument: true });
  const run = await ctx.bridge.run<{ document: { name: string }; built: unknown[]; failed: { name: string; message: string }[] }>("execute_plan", compiled, { timeoutMs: Math.max(ctx.config.illustrator.timeoutMs, 120000) });
  warnings.push(...run.warnings);
  ctx.plans.markExecuted(stored.id, stored.version, { documentName: run.data.document?.name, at: new Date().toISOString(), adapter: ctx.bridge.adapterName });
  for (const f of run.data.failed ?? []) warnings.push(`Element "${f.name}" failed: ${f.message}`);

  // Verify by reading the document back rather than trusting the build report.
  const inspection = (await ctx.bridge.run<Inspection>("inspect_document", { limit: 2000 })).data;
  const names = new Set((inspection.items ?? []).map((i) => i.name));
  const expected = compiled.elements.map((e) => String(e.name));
  const missing = expected.filter((n) => !names.has(n));
  if (missing.length) warnings.push(`Not found in document after execution: ${missing.join(", ")}`);

  const result: Record<string, unknown> = {
    planId: stored.id, version: stored.version, document: run.data.document,
    verification: { expectedObjects: expected.length, foundObjects: expected.length - missing.length, missing, failed: run.data.failed ?? [] },
    rationale: plan.meta.rationale,
  };
  const images: ToolOutput["images"] = [];
  if (opts.saveAs) {
    const path = ctx.paths.resolveOutput(opts.saveAs, { extensions: [".ai"], overwrite: opts.overwrite });
    const s = await ctx.bridge.run("save_document_as", { path, pdfCompatible: true });
    result.saved = s.data;
  }
  if (opts.preview) {
    try {
      const p = await exportPreview(ctx, {});
      result.preview = { path: p.path, imageAttached: Boolean(p.base64) };
      warnings.push(...p.warnings);
      if (p.base64) images.push({ base64: p.base64, mimeType: "image/png" });
    } catch (e) {
      warnings.push(`Preview export failed: ${(e as Error).message}`);
    }
  }
  return { data: result, warnings, images };
}

function toPlanOptions(a: BriefArgs, category?: string): PlanOptions {
  return {
    brief: a.brief, category, style: a.style, template: a.template, copy: a.copy, palette: a.palette, baseColor: a.baseColor,
    harmony: a.harmony, size: a.size, colorMode: a.colorMode, imagePath: a.imagePath, designSystem: a.designSystem,
  };
}

async function briefTool(ctx: ToolContext, a: BriefArgs, category?: string): Promise<ToolOutput> {
  const { plan, analysis, warnings } = planDesign(toPlanOptions(a, category));
  if (!a.execute) {
    const stored = ctx.plans.save(plan, { note: "planned (not executed)" });
    return { data: { planId: stored.id, version: stored.version, analysis, plan }, warnings, source: "server" };
  }
  const out = await executePlan(ctx, plan, { preview: a.preview, saveAs: a.saveAs });
  return { ...out, data: { analysis, ...(out.data as object) }, warnings: [...warnings, ...(out.warnings ?? [])] };
}

async function inspectAndAnalyze(ctx: ToolContext, artboard?: number): Promise<{ report: CompositionReport; inspection: Inspection }> {
  const inspection = (await ctx.bridge.run<Inspection>("inspect_document", { artboard, limit: 2000 })).data;
  const ab = inspection.artboards.find((x) => x.active) ?? inspection.artboards[0];
  if (!ab) throw new McpDesignError("NO_ACTIVE_DOCUMENT", "Document has no artboards");
  return { report: analyzeComposition(inspection.items ?? [], { width: ab.width, height: ab.height }), inspection };
}

export function registerDesignTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "list_templates",
    description: "List professional design templates and supported styles.",
    input: {},
    annotations: READ_ONLY,
    handler: async () => ({ data: { templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, description: t.description, defaultSize: t.defaultSize })), styles: STYLES }, source: "server" }),
  });

  defineTool(server, ctx, {
    name: "plan_design",
    description: "Turn a brief into a structured, validated design plan (JSON) WITHOUT touching Illustrator. Inspect or edit it, then call execute_design_plan.",
    input: { ...briefInput, execute: z.literal(false).default(false) },
    annotations: READ_ONLY,
    handler: async (a) => briefTool(ctx, { ...a, execute: false }),
  });

  defineTool(server, ctx, {
    name: "validate_design_plan",
    description: "Validate a design plan against the schema plus semantic rules (layer references, palette references, alignment dependencies, contrast).",
    input: { plan: z.record(z.unknown()) },
    annotations: READ_ONLY,
    handler: async (a) => {
      const r = validatePlan(a.plan);
      return { data: { valid: r.valid, errors: r.errors, warnings: r.warnings }, source: "server" };
    },
  });

  defineTool(server, ctx, {
    name: "execute_design_plan",
    description: "Execute a stored plan (planId) or an inline plan in Illustrator: creates a new document with layers and editable objects, verifies the result by inspection, and attaches a preview.",
    input: { planId: z.string().optional(), version: z.number().int().optional(), plan: z.record(z.unknown()).optional(), preview: z.boolean().default(true), saveAs: z.string().optional(), overwrite: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => {
      let plan: DesignPlan;
      if (a.plan) {
        const v = validatePlan(a.plan);
        if (!v.valid || !v.plan) throw new McpDesignError("PLAN_INVALID", "Plan failed validation", v.errors);
        plan = v.plan;
      } else if (a.planId) plan = ctx.plans.get(a.planId, a.version).plan;
      else throw new McpDesignError("VALIDATION_ERROR", "Provide planId or plan");
      return executePlan(ctx, plan, { preview: a.preview, saveAs: a.saveAs, planId: a.planId, overwrite: a.overwrite, note: "executed" });
    },
  });

  defineTool(server, ctx, {
    name: "get_design_plan",
    description: "Return a stored design plan (latest version unless version is given), or list all plans when planId is omitted.",
    input: { planId: z.string().optional(), version: z.number().int().optional() },
    annotations: READ_ONLY,
    handler: async (a) => ({ data: a.planId ? ctx.plans.get(a.planId, a.version) : ctx.plans.list(), source: "server" }),
  });

  defineTool(server, ctx, {
    name: "compare_design_versions",
    description: "Diff two versions of a stored plan: added/removed/changed elements, palette and document changes.",
    input: { planId: z.string(), from: z.number().int().min(1), to: z.number().int().min(1) },
    annotations: READ_ONLY,
    handler: async (a) => ({ data: diffPlans(ctx.plans.get(a.planId, a.from).plan, ctx.plans.get(a.planId, a.to).plan), source: "server" }),
  });

  defineTool(server, ctx, {
    name: "generate_design",
    description: "Full pipeline from a brief: analyze requirements (category, audience, style, size), plan hierarchy/palette/typography/layers, validate, build editable artwork in Illustrator, verify by inspection and return a preview.",
    input: { ...briefInput, category: z.string().optional() },
    annotations: WRITE,
    handler: async (a) => briefTool(ctx, a, a.category),
  });

  const categoryTools: [string, string, string][] = [
    ["create_logo", "logo", "Create a minimalist logo lockup (mark, wordmark, tagline) as editable vectors."],
    ["create_poster", "poster", "Create a poster with hero image area, headline hierarchy and footer CTA."],
    ["create_flyer", "flyer", "Create a flyer with color block, headline, offer list and CTA button."],
    ["create_social_media_graphic", "social-media", "Create a social media graphic (default 1080×1080 px)."],
    ["create_business_card", "business-card", "Create a business card front (85×55 mm, CMYK)."],
    ["create_brand_identity", "brand-identity", "Create a brand identity board: logo lockup, palette swatches with hex labels, type specimens."],
    ["create_packaging_design", "packaging", "Create a flat packaging layout with panels, dieline layer and front artwork."],
    ["create_infographic", "infographic", "Create an infographic with numbered stat rows and bars. Pass copy.items as the data labels."],
    ["create_icon_set", "icon-set", "Create a consistent geometric icon set on shared keylines. Pass copy.items as icon labels."],
    ["create_vector_illustration", "illustration", "Create a layered flat vector illustration (landscape scene)."],
    ["create_editorial_layout", "editorial", "Create an editorial magazine page with kicker, title, deck, columns and pull quote."],
    ["create_app_screen", "mobile-app", "Create a mobile app screen (393×852-class frame) in auto layout with UI components: home/dashboard by default; the brief picks login/sign-up or settings screens. Pass copy.items for list rows."],
    ["create_landing_page", "landing-page", "Create a desktop website landing page: navbar, hero with CTAs and visual, feature cards. Pass copy.items as feature titles."],
    ["create_web_dashboard", "web-dashboard", "Create a web app dashboard: sidebar nav, header with search, KPI tiles, chart and activity list. Pass copy.items as nav labels."],
    ["create_ui_kit", "ui-kit", "Create a design-system sheet: color tokens, type scale, buttons, inputs, controls, cards, list rows — all themed by style/palette."],
  ];
  for (const [name, category, description] of categoryTools) {
    defineTool(server, ctx, { name, description: `${description} Same options as generate_design.`, input: briefInput, annotations: WRITE, handler: async (a) => briefTool(ctx, a, category) });
  }

  defineTool(server, ctx, {
    name: "revise_design",
    description: "Apply targeted revisions to an executed plan without rebuilding: structured updates by element name, additions, removals, palette role changes, and simple instructions (\"make the headline bigger\", \"change background to navy\", \"move logo up\"). Unparsed instructions are reported, not guessed.",
    input: {
      planId: z.string(), instructions: z.string().max(2000).optional(),
      updates: z.array(z.object({ name: z.string() }).passthrough()).max(200).optional(),
      add: z.array(z.record(z.unknown())).max(200).optional(), remove: z.array(z.string()).max(200).optional(),
      palette: z.record(HexColorSchema).optional(), apply: z.boolean().default(true), preview: z.boolean().default(true),
    },
    annotations: WRITE,
    handler: async (a) => {
      const prev = ctx.plans.get(a.planId);
      const rev = revisePlan(prev.plan, { instructions: a.instructions, updates: a.updates, add: a.add, remove: a.remove, palette: a.palette });
      const stored = ctx.plans.save(rev.plan, { id: a.planId, note: a.instructions ?? "structured revision" });
      const warnings = rev.unapplied.map((u) => `Not understood (no change made): "${u}"`);
      const data: Record<string, unknown> = { planId: a.planId, fromVersion: prev.version, toVersion: stored.version, applied: rev.applied, unapplied: rev.unapplied, diff: rev.diff };
      if (!a.apply) return { data, warnings, source: "server" };
      if (rev.requiresRebuild) {
        const out = await executePlan(ctx, rev.plan, { preview: a.preview, planId: a.planId, note: "rebuild after document change" });
        return { ...out, data: { ...data, rebuilt: true, execution: out.data }, warnings: [...warnings, "Document size/units changed, so the design was rebuilt in a new document."] };
      }
      const ops = revisionOps(prev.plan, rev.plan, rev.diff);
      const results: Record<string, unknown> = {};
      const all = [...ops.updates, ...ops.removals.map((name) => ({ name, remove: true }))];
      if (all.length) {
        const r = await ctx.bridge.run<{ failed: { name: string; message: string }[] }>("update_elements", { updates: all });
        results.updates = r.data;
        warnings.push(...r.warnings, ...(r.data.failed ?? []).map((f) => `Update of "${f.name}" failed: ${f.message}`));
      }
      if (ops.additions?.elements.length) {
        const r = await ctx.bridge.run("execute_plan", ops.additions);
        results.additions = r.data;
        warnings.push(...r.warnings);
      }
      const images: ToolOutput["images"] = [];
      if (a.preview) {
        const p = await exportPreview(ctx, {});
        warnings.push(...p.warnings);
        if (p.base64) images.push({ base64: p.base64, mimeType: "image/png" });
        data.preview = { path: p.path, imageAttached: Boolean(p.base64) };
      }
      return { data: { ...data, operations: { updates: ops.updates.length, removals: ops.removals.length, additions: ops.additions?.elements.length ?? 0 }, results }, warnings, images };
    },
  });

  defineTool(server, ctx, {
    name: "analyze_composition",
    description: "Analyze the active document from verified Illustrator properties: margins, alignment near-misses, spacing rhythm, type scale, hierarchy, contrast, overlap and visual balance. Returns a score and findings with suggested fixes. This is geometric analysis, not visual perception.",
    input: { artboard: z.number().int().min(0).optional() },
    annotations: READ_ONLY,
    handler: async (a) => ({ data: (await inspectAndAnalyze(ctx, a.artboard)).report }),
  });

  defineTool(server, ctx, {
    name: "critique_design",
    description: "Critique the active design: verified property analysis plus an actual exported preview image attached for the AI client's own visual assessment. The server does not perform image recognition; any visual judgement must come from the client viewing the attached image.",
    input: { artboard: z.number().int().min(0).optional(), goals: z.string().max(1000).optional().describe("What the design should achieve") },
    annotations: READ_ONLY,
    handler: async (a) => {
      const { report } = await inspectAndAnalyze(ctx, a.artboard);
      const p = await exportPreview(ctx, { artboard: a.artboard });
      const checklist = ["Alignment", "Contrast", "Balance", "Hierarchy", "Proximity", "Repetition", "Negative space", "Typography", "Color harmony", "Consistency", "Visual rhythm", "Scale & proportion", "Grid adherence"];
      return {
        data: {
          verifiedAnalysis: report,
          visualAssessment: p.base64
            ? { status: "preview-attached", instructions: "Look at the attached PNG and assess it against the checklist and goals. Label conclusions as visual assessment, distinct from verifiedAnalysis.", checklist, goals: a.goals ?? null }
            : { status: "unavailable", reason: "No preview image could be produced, so no visual inspection has occurred." },
          preview: { path: p.path, bytes: p.bytes },
        },
        warnings: p.warnings,
        images: p.base64 ? [{ base64: p.base64, mimeType: "image/png" }] : [],
      };
    },
  });

  defineTool(server, ctx, {
    name: "improve_design",
    description: "Apply the automatic fixes suggested by analyze_composition (margins, alignment snaps, contrast, minimum size, hierarchy) as targeted edits, then re-analyze and report before/after scores. Use dryRun to preview the changes.",
    input: {
      categories: z.array(z.enum(["alignment", "margins", "typography", "color", "hierarchy"])).optional(),
      findingIds: z.array(z.string()).optional(), dryRun: z.boolean().default(false), preview: z.boolean().default(true), artboard: z.number().int().min(0).optional(),
    },
    annotations: WRITE,
    handler: async (a) => {
      const before = (await inspectAndAnalyze(ctx, a.artboard)).report;
      const chosen = before.findings.filter((f) => f.fix && (!a.categories || a.categories.includes(f.category as never)) && (!a.findingIds || a.findingIds.includes(f.id)));
      const merged = new Map<string, Record<string, unknown>>();
      for (const f of chosen) for (const fix of f.fix!) merged.set(fix.name, { ...(merged.get(fix.name) ?? {}), ...fix });
      const updates = [...merged.values()];
      if (a.dryRun || !updates.length) return { data: { before: before.score, plannedFixes: chosen.map((f) => ({ id: f.id, message: f.message, fix: f.fix })), applied: false } };
      const r = await ctx.bridge.run("update_elements", { updates, artboard: a.artboard });
      const after = (await inspectAndAnalyze(ctx, a.artboard)).report;
      const images: ToolOutput["images"] = [];
      const warnings = [...r.warnings];
      if (a.preview) {
        const p = await exportPreview(ctx, { artboard: a.artboard });
        warnings.push(...p.warnings);
        if (p.base64) images.push({ base64: p.base64, mimeType: "image/png" });
      }
      return { data: { scoreBefore: before.score, scoreAfter: after.score, appliedFixes: chosen.map((f) => f.message), result: r.data, remainingFindings: after.findings }, warnings, images };
    },
  });

  defineTool(server, ctx, {
    name: "generate_design_variations",
    description: "Generate N variations of a brief by changing one dimension each (style, palette harmony, or layout). Returns plans; with execute: true each is built as its own document with a preview.",
    input: { ...briefInput, count: z.number().int().min(1).max(6).default(3), dimension: z.enum(["style", "palette", "layout", "mixed"]).default("mixed"), execute: z.boolean().default(false) },
    annotations: WRITE,
    handler: async (a) => {
      const variants = planVariations(toPlanOptions(a, undefined), a.count, a.dimension);
      const out: Record<string, unknown>[] = [];
      const warnings: string[] = [];
      const images: ToolOutput["images"] = [];
      for (const v of variants) {
        if (!a.execute) {
          const s = ctx.plans.save(v.plan, { note: v.label });
          out.push({ label: v.label, planId: s.id, style: v.plan.meta.style, palette: v.plan.palette });
          continue;
        }
        const r = await executePlan(ctx, v.plan, { preview: a.preview, note: v.label });
        out.push({ label: v.label, ...(r.data as object) });
        warnings.push(...(r.warnings ?? []).map((w) => `[${v.label}] ${w}`));
        images.push(...(r.images ?? []));
      }
      return { data: { variations: out }, warnings, images, source: a.execute ? undefined : "server" };
    },
  });

}
