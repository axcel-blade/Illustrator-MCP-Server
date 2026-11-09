import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generatePalette, STYLE_PALETTES, type Harmony, type RolePalette } from "../../design-engine/color/palettes.js";
import type { InspectedItem } from "../../design-engine/composition/analyzer.js";
import { STYLES } from "../../design-engine/planner/planner.js";
import { TYPE_SYSTEMS } from "../../design-engine/typography/type-systems.js";
import { componentCatalog } from "../../design-engine/ui/components.js";
import { withUiRoles } from "../../design-engine/ui/layout.js";
import { suggestLayerNames } from "../../design-engine/ui/naming.js";
import { tokensFor } from "../../design-engine/ui/tokens.js";
import { validatePlan } from "../../design-engine/validator/validate.js";
import { HexColorSchema } from "../../utils/colors.js";
import { McpDesignError } from "../../utils/errors.js";
import { defineTool, READ_ONLY, WRITE, type ToolContext } from "./common.js";
import { executePlan } from "./design.js";

/** Common device frames (px), like Figma's frame presets. */
export const FRAME_PRESETS: Record<string, { width: number; height: number; platform: "mobile" | "web" }> = {
  "iphone-15": { width: 393, height: 852, platform: "mobile" },
  "iphone-se": { width: 375, height: 667, platform: "mobile" },
  "android": { width: 412, height: 915, platform: "mobile" },
  "ipad": { width: 820, height: 1180, platform: "web" },
  "desktop": { width: 1440, height: 1024, platform: "web" },
  "laptop": { width: 1280, height: 832, platform: "web" },
};

const LAYOUT_GUIDE = {
  coordinates: "px, origin top-left. Root stacks may set x/y; everything inside is positioned by auto layout.",
  nodeTypes: {
    stack: "{type:'stack', name, direction:'vertical'|'horizontal', gap, padding (number|token|{x,y,top,right,bottom,left}), align:'start'|'center'|'end'|'stretch', justify:'start'|'center'|'end'|'space-between', width, height, fill?, stroke?, radius?, effects?, children:[...]}",
    text: "{type:'text', name, content, fontSize (number|token), fontRole:'heading'|'body'|'accent', weight?, color?, textAlign?, width:'hug'|'fill'|number (fill/number = wrapped area text)}",
    rect: "{type:'rect', name, width, height, fill?, stroke?, radius?}", ellipse: "{type:'ellipse', name, width, height, fill?}",
    circle: "{type:'circle', name, radius, fill?, stroke?}", image: "{type:'image', name, width, height, path}",
    spacer: "{type:'spacer', size?} — without size it absorbs the remaining space (pushes siblings apart)",
    component: "{type:'component', name, component:'button'|..., props:{...}, width?, height?} — see components",
  },
  sizing: "number = fixed, 'hug' = fit content (default), 'fill' = take the parent's remaining space, '40%' = share of parent's inner size",
  colors: "Hex or palette roles: palette.background, surface, primary, secondary, accent, text, muted, subtle (auto-derived AA-safe secondary text)",
  naming: "Names must be unique. Component parts are named '<instance> / <part>' so each can be revised by name.",
};

function paletteFor(style: string, baseColor?: string, harmony?: Harmony, overrides?: Record<string, string>): RolePalette {
  let p = baseColor ? generatePalette(baseColor, harmony ?? "complementary", { dark: style === "futuristic" }) : STYLE_PALETTES[style] ?? STYLE_PALETTES.modern!;
  if (overrides) p = { name: `${p.name} (custom)`, colors: { ...p.colors, ...overrides } };
  return p;
}

export function registerUiTools(server: McpServer, ctx: ToolContext): void {
  defineTool(server, ctx, {
    name: "list_ui_components",
    description: "List the UI component library (button, input, card, navbar, tab-bar, list-item, toggle, stat, chart…) with props, the auto-layout node reference, device frame presets and default design tokens. Read this before create_ui_design.",
    input: {},
    annotations: READ_ONLY,
    handler: async () => ({ data: { components: componentCatalog(), autoLayout: LAYOUT_GUIDE, framePresets: FRAME_PRESETS, defaultTokens: tokensFor("modern") }, source: "server" }),
  });

  defineTool(server, ctx, {
    name: "get_design_tokens",
    description: "Design system for a style: color roles (incl. AA-safe 'subtle' text color), typography roles, spacing/radius/type-size tokens and control height. Use the token keys in auto-layout nodes.",
    input: {
      style: z.enum(STYLES as [string, ...string[]]).default("modern"), platform: z.enum(["mobile", "web"]).default("mobile"),
      baseColor: HexColorSchema.optional(), harmony: z.enum(["monochrome", "analogous", "complementary", "triadic", "split-complementary"]).optional(),
      palette: z.record(HexColorSchema).optional(),
    },
    annotations: READ_ONLY,
    handler: async (a) => {
      const palette = withUiRoles(paletteFor(a.style, a.baseColor, a.harmony, a.palette));
      const type = TYPE_SYSTEMS[a.style]!;
      return { data: { style: a.style, palette, typography: { heading: type.heading, body: type.body, accent: type.accent }, tokens: tokensFor(a.style, a.platform) }, source: "server" };
    },
  });

  defineTool(server, ctx, {
    name: "create_ui_design",
    description: "Build a UI screen from an auto-layout tree (Figma-style frames: stacks with gap/padding/alignment, fill/hug sizing, components and design tokens). The server measures and positions everything, validates contrast, then builds editable artwork in Illustrator with a preview. Call list_ui_components first for the node and component reference. execute: false returns the computed plan only.",
    input: {
      name: z.string().min(1).max(200).default("UI Screen"),
      frame: z.enum(Object.keys(FRAME_PRESETS) as [string, ...string[]]).optional().describe("Device preset; or give width/height"),
      width: z.number().positive().optional(), height: z.number().positive().optional(),
      style: z.enum(STYLES as [string, ...string[]]).default("modern"),
      baseColor: HexColorSchema.optional(), harmony: z.enum(["monochrome", "analogous", "complementary", "triadic", "split-complementary"]).optional(),
      palette: z.record(HexColorSchema).optional().describe("Override palette roles"),
      tokens: z.record(z.unknown()).optional().describe("Override design tokens (spacing, radius, fontSize, controlHeight)"),
      layout: z.array(z.record(z.unknown())).min(1).max(50).describe("Auto-layout root nodes; usually one vertical stack with width/height 'fill'"),
      elements: z.array(z.record(z.unknown())).max(500).optional().describe("Extra absolutely-positioned plan elements drawn beneath the layout"),
      execute: z.boolean().default(true), preview: z.boolean().default(true), saveAs: z.string().optional(),
    },
    annotations: WRITE,
    handler: async (a) => {
      const preset = a.frame ? FRAME_PRESETS[a.frame] : undefined;
      const width = a.width ?? preset?.width ?? 393, height = a.height ?? preset?.height ?? 852;
      const platform = preset?.platform ?? (width >= 768 ? "web" : "mobile");
      const palette = paletteFor(a.style, a.baseColor, a.harmony, a.palette);
      const type = TYPE_SYSTEMS[a.style]!;
      const base = tokensFor(a.style, platform);
      const t = (a.tokens ?? {}) as Partial<typeof base>;
      const tokens = { ...base, ...t, spacing: { ...base.spacing, ...(t.spacing ?? {}) }, radius: { ...base.radius, ...(t.radius ?? {}) }, fontSize: { ...base.fontSize, ...(t.fontSize ?? {}) } };
      const draft = {
        meta: { title: a.name, category: "ui", style: a.style, template: "custom-auto-layout", rationale: [`Auto layout on a ${width}×${height} px ${platform} frame`, `Style "${a.style}" with palette "${palette.name}" and ${platform} tokens`] },
        document: { name: a.name, width, height, units: "px", colorMode: "RGB" },
        background: { type: "solid", color: "palette.background" },
        palette: { name: palette.name, colors: palette.colors },
        typography: { heading: type.heading, body: type.body, accent: type.accent },
        tokens,
        layers: [{ name: "UI" }, { name: "Background", locked: true }],
        elements: (a.elements ?? []).map((e) => ({ layer: "UI", ...e })),
        autoLayout: a.layout,
      };
      const v = validatePlan(draft);
      if (!v.valid || !v.plan) throw new McpDesignError("PLAN_INVALID", "UI layout failed validation", v.errors);
      const warnings = v.warnings.map((w) => `${w.path}: ${w.message}`);
      if (!a.execute) {
        const stored = ctx.plans.save(v.plan, { note: "ui layout (not executed)" });
        return { data: { planId: stored.id, version: stored.version, elementCount: v.plan.elements.length, plan: v.plan }, warnings, source: "server" };
      }
      const out = await executePlan(ctx, v.plan, { preview: a.preview, saveAs: a.saveAs, note: "ui layout" });
      return { ...out, warnings: [...warnings, ...(out.warnings ?? [])] };
    },
  });

  defineTool(server, ctx, {
    name: "rename_layers_semantically",
    description: "Rename generic objects (\"<Path>\", \"Rectangle 3\", unnamed text) in the active document to meaningful names inferred from verified geometry and content, e.g. \"Background\", \"Header Bar\", \"Button / Sign in\", \"Heading / Pure Beauty\". dryRun returns suggestions only. Inspects top-level objects of each layer.",
    input: {
      artboard: z.number().int().min(0).optional(),
      all: z.boolean().default(false).describe("Also rename objects that already have custom names"),
      dryRun: z.boolean().default(false),
    },
    annotations: WRITE,
    handler: async (a) => {
      const inspection = (await ctx.bridge.run<{ artboards: { width: number; height: number; active: boolean }[]; items: InspectedItem[] }>("inspect_document", { artboard: a.artboard, limit: 2000 })).data;
      const ab = inspection.artboards.find((x) => x.active) ?? inspection.artboards[0];
      if (!ab) throw new McpDesignError("NO_ACTIVE_DOCUMENT", "Document has no artboards");
      const suggestions = suggestLayerNames(inspection.items ?? [], ab, { all: a.all });
      if (a.dryRun || !suggestions.length) return { data: { applied: false, suggestions } };
      const warnings: string[] = [];
      const renamed: typeof suggestions = [];
      for (const s of suggestions) {
        if (!s.uuid) { warnings.push(`Skipped "${s.from || "(unnamed)"}" → "${s.to}": object has no uuid (Illustrator 2020+ required)`); continue; }
        try {
          await ctx.bridge.run("set_properties", { target: { uuid: s.uuid }, rename: s.to });
          renamed.push(s);
        } catch (e) {
          warnings.push(`Rename to "${s.to}" failed: ${(e as Error).message}`);
        }
      }
      return { data: { applied: true, renamed: renamed.length, suggestions: renamed }, warnings };
    },
  });
}
