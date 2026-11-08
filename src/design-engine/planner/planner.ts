import { DesignPlanSchema, type DesignPlan } from "../../schemas/design-plan.js";
import { McpDesignError } from "../../utils/errors.js";
import type { Unit } from "../../utils/units.js";
import { generatePalette, paletteFromBrief, STYLE_PALETTES, type Harmony, type RolePalette } from "../color/palettes.js";
import type { Copy } from "../templates/helpers.js";
import { getTemplate, TEMPLATES } from "../templates/library.js";
import { TYPE_SYSTEMS } from "../typography/type-systems.js";
import { validatePlan } from "../validator/validate.js";

export const STYLES = Object.keys(TYPE_SYSTEMS);

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["brand-guidelines", /brand (guide|guidelines|book)|style ?guide/],
  ["brand-identity", /brand identity|visual identity|identity board|brand board/],
  ["corporate-identity", /stationery|corporate identity|letterhead/],
  ["business-card", /business card|name card/],
  ["logo", /\blogo|logotype|wordmark|monogram|emblem/],
  ["packaging", /packag|box design|dieline|carton/],
  ["product-label", /\blabel\b|sticker|bottle/],
  ["restaurant-menu", /\bmenu\b|restaurant|cafe|café|bistro/],
  ["product-catalogue", /catalog|catalogue|lookbook/],
  ["infographic", /infographic|data viz|statistics|timeline|process steps/],
  ["icon-set", /icon set|icons|iconography|pictogram/],
  ["editorial", /editorial|magazine|article|newsletter|spread/],
  ["brochure", /brochure|tri-?fold|pamphlet/],
  ["presentation", /presentation|slide|deck|keynote/],
  ["social-media", /instagram|social media|social post|facebook|linkedin|twitter|tiktok|story/],
  ["event-graphic", /event|conference|festival|concert|meetup|webinar|banner/],
  ["print-ad", /print ad|advert|magazine ad|advertisement/],
  ["flyer", /flyer|leaflet|handout/],
  ["illustration", /illustration|landscape|scene|drawing/],
  ["poster", /poster|placard/],
];

const STYLE_KEYWORDS: [string, RegExp][] = [
  ["luxury", /luxur|premium|elegant|high-end|opulent|sophisticat/],
  ["minimalist", /minimal|clean|simple|understated/],
  ["corporate", /corporate|business|professional|enterprise|finance|consult/],
  ["editorial", /editorial|magazine|journal/],
  ["retro", /retro|70s|80s|groovy/],
  ["swiss", /swiss|international style|grid-based|bauhaus/],
  ["brutalist", /brutal|raw|anti-design/],
  ["geometric", /geometric|shapes|angular/],
  ["organic", /organic|natural|botanical|eco|earthy|sustainab/],
  ["playful", /playful|fun|kids|children|whimsical|cheerful/],
  ["futuristic", /futur|sci-fi|cyber|tech|neon|ai\b/],
  ["vintage", /vintage|antique|classic|heritage|old-?school/],
  ["contemporary", /contemporary|trendy/],
  ["modern", /modern|sleek|bold/],
];

const AUDIENCE_KEYWORDS: [string, RegExp][] = [
  ["luxury consumers", /luxur|premium|high-end/], ["children and parents", /kids|children|toddler/],
  ["business professionals", /corporate|b2b|enterprise|professional/], ["young adults", /gen z|youth|student|teen/],
  ["food lovers", /restaurant|food|cafe|menu/], ["tech enthusiasts", /tech|startup|software|app\b/],
  ["wellness-minded consumers", /skincare|beauty|wellness|spa|yoga/],
];

export interface BriefAnalysis {
  brief: string;
  category: string;
  style: string;
  audience: string;
  quoted: string[];
  subject: string;
  wantsImage: boolean;
  size?: { width: number; height: number; units: Unit };
  harmony?: Harmony;
}

function firstMatch(table: [string, RegExp][], text: string, fallback: string): string {
  return table.find(([, re]) => re.test(text))?.[0] ?? fallback;
}

function parseSize(text: string): BriefAnalysis["size"] {
  const named: Record<string, [number, number, Unit]> = {
    a3: [297, 420, "mm"], a4: [210, 297, "mm"], a5: [148, 210, "mm"], letter: [215.9, 279.4, "mm"], tabloid: [279.4, 431.8, "mm"],
    "instagram story": [1080, 1920, "px"], story: [1080, 1920, "px"], instagram: [1080, 1080, "px"], "16:9": [1920, 1080, "px"],
  };
  const m = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|in|px|pt)\b/i.exec(text);
  if (m) return { width: Number(m[1]), height: Number(m[2]), units: m[3]!.toLowerCase() as Unit };
  const lower = text.toLowerCase();
  for (const [k, [w, h, u]] of Object.entries(named)) if (new RegExp(`\\b${k}\\b`).test(lower)) {
    const landscape = /landscape/.test(lower) && w < h;
    return { width: landscape ? h : w, height: landscape ? w : h, units: u };
  }
  return undefined;
}

/** Step 1-4: understand the brief (category, style, audience, size, explicit copy). */
export function analyzeBrief(brief: string): BriefAnalysis {
  const lower = brief.toLowerCase();
  const quoted = [...brief.matchAll(/["“'‘]([^"”'’]{2,120})["”'’]/g)].map((m) => m[1]!.trim());
  const category = firstMatch(CATEGORY_KEYWORDS, lower, "poster");
  const subjectMatch = /(?:for|about|promoting|advertising)\s+(?:an?\s+|the\s+)?([a-z0-9 &'-]{3,40}?)(?:\s+(?:with|in|using|that|featuring)\b|[,.]|$)/i.exec(brief);
  const catWord = /(poster|flyer|logo|card|label|menu|brochure|post|graphic|layout|design|illustration|infographic)\b/i;
  const before = new RegExp(`(?:a|an)\\s+(?:[a-z-]+\\s+){0,4}?([a-z-]+(?:\\s+[a-z-]+)?)\\s+${catWord.source}`, "i").exec(brief);
  const subject = (subjectMatch?.[1] ?? before?.[1] ?? "").trim();
  const harmony = (["monochrome", "analogous", "complementary", "triadic", "split-complementary"] as Harmony[]).find((h) => lower.includes(h));
  return {
    brief, category,
    style: firstMatch(STYLE_KEYWORDS, lower, category === "logo" ? "minimalist" : "modern"),
    audience: firstMatch(AUDIENCE_KEYWORDS, lower, "general audience"),
    quoted, subject, wantsImage: /image|photo|picture|product shot/.test(lower), size: parseSize(brief), harmony,
  };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const STYLE_FILTERS = /\b(modern|luxury|luxurious|minimalist|minimal|elegant|corporate|retro|vintage|playful|bold|clean|premium|futuristic|organic|geometric|swiss|brutalist|editorial|contemporary)\b/gi;

export function defaultCopy(a: BriefAnalysis, overrides: Partial<Copy> = {}): Copy {
  const subject = titleCase(a.subject.replace(STYLE_FILTERS, "").replace(/\s+/g, " ").trim() || "Your Brand");
  const brand = overrides.brand ?? (a.category === "logo" || a.category.includes("identity") ? subject : subject.split(" ")[0] ?? "Studio");
  const byCategory: Record<string, Partial<Copy>> = {
    poster: { headline: a.style === "luxury" ? "Pure Beauty" : subject, subheadline: "Crafted with intention", cta: "Discover more" },
    "business-card": { headline: "Alex Morgan", subheadline: "Creative Director", contact: "+1 555 0100\nhello@example.com\nexample.com" },
    "restaurant-menu": { tagline: "Seasonal kitchen" },
    "event-graphic": { tagline: "OCT 24", subheadline: "Main Hall · 9:00 AM", cta: "Register now" },
    "product-label": { headline: subject, subheadline: "Small batch · Natural ingredients", cta: "NET WT 250 g" },
  };
  return {
    headline: a.quoted[0] ?? byCategory[a.category]?.headline ?? subject,
    subheadline: a.quoted[1] ?? byCategory[a.category]?.subheadline ?? "Designed for what matters",
    body: a.quoted[2] ?? "Thoughtfully designed to deliver clarity, character and lasting impact for every audience it reaches.",
    cta: byCategory[a.category]?.cta ?? "Learn more",
    brand, tagline: byCategory[a.category]?.tagline ?? "Est. 2026",
    contact: byCategory[a.category]?.contact ?? "example.com",
    items: a.quoted.slice(3),
    ...overrides,
  };
}

export interface PlanOptions {
  brief: string;
  category?: string;
  style?: string;
  template?: string;
  copy?: Partial<Copy>;
  palette?: Partial<RolePalette["colors"]>;
  baseColor?: string;
  harmony?: Harmony;
  size?: { width: number; height: number; units: Unit };
  colorMode?: "RGB" | "CMYK";
  imagePath?: string;
  title?: string;
}

/** Steps 5-11: hierarchy, palette, type, positions, layers -> structured plan -> validation. */
export function planDesign(opts: PlanOptions): { plan: DesignPlan; analysis: BriefAnalysis; warnings: string[] } {
  const analysis = analyzeBrief(opts.brief);
  const category = opts.category ?? analysis.category;
  const style = opts.style ?? analysis.style;
  if (!TYPE_SYSTEMS[style]) throw new McpDesignError("VALIDATION_ERROR", `Unknown style "${style}". Available: ${STYLES.join(", ")}`);
  const template = getTemplate(opts.template ?? category) ?? TEMPLATES.find((t) => t.category === category);
  if (!template) throw new McpDesignError("VALIDATION_ERROR", `No template for category "${category}". Available: ${TEMPLATES.map((t) => t.id).join(", ")}`);

  let palette: RolePalette = opts.baseColor
    ? generatePalette(opts.baseColor, opts.harmony ?? analysis.harmony ?? "complementary", { dark: style === "futuristic" })
    : paletteFromBrief(opts.brief, style);
  if (opts.palette) palette = { name: `${palette.name} (custom)`, colors: { ...palette.colors, ...Object.fromEntries(Object.entries(opts.palette).filter(([, v]) => v)) } };

  const type = TYPE_SYSTEMS[style]!;
  const copy = defaultCopy(analysis, opts.copy);
  const size = opts.size ?? analysis.size ?? template.defaultSize;
  const out = template.build({ style, palette, type, copy, imagePath: opts.imagePath }, size);

  const rationale = [
    `Category "${template.category}" via template "${template.id}" (${template.description})`,
    `Style "${style}" for ${analysis.audience}: palette "${palette.name}", headings in ${type.heading.fonts[0]}, body in ${type.body.fonts[0]}`,
    `Hierarchy uses a ${type.scale} modular type scale; headline is the dominant element, supporting copy steps down in size and contrast`,
    `Layers separate typography, graphics, images and a locked background so revisions can target one concern`,
  ];
  if (analysis.wantsImage && !opts.imagePath) rationale.push("Brief mentions an image but no file was supplied, so a labelled placeholder frame was planned");

  const draft = {
    meta: { title: opts.title ?? copy.headline, brief: opts.brief, category: template.category, style, audience: analysis.audience, template: template.id, rationale },
    ...out,
    document: { ...out.document, colorMode: opts.colorMode ?? out.document.colorMode ?? (["mm", "cm", "in"].includes(size.units) ? "CMYK" : "RGB") },
    palette: { name: palette.name, colors: palette.colors },
    typography: { heading: type.heading, body: type.body, accent: type.accent },
  };
  const result = validatePlan(draft);
  if (!result.valid || !result.plan) {
    throw new McpDesignError("PLAN_INVALID", "Planner produced an invalid plan (this is a bug).", result.errors);
  }
  return { plan: result.plan, analysis, warnings: result.warnings.map((w) => `${w.path}: ${w.message}`) };
}

/** Variations change one design dimension at a time so they stay comparable. */
export function planVariations(opts: PlanOptions, count: number, dimension: "style" | "palette" | "layout" | "mixed" = "mixed"): { label: string; plan: DesignPlan }[] {
  const base = planDesign(opts);
  const out: { label: string; plan: DesignPlan }[] = [];
  const styles = STYLES.filter((s) => s !== base.plan.meta.style);
  const harmonies: Harmony[] = ["analogous", "triadic", "split-complementary", "monochrome", "complementary"];
  const sameCategory = TEMPLATES.filter((t) => t.category === base.plan.meta.category && t.id !== base.plan.meta.template);
  for (let i = 0; i < count; i++) {
    const dim = dimension === "mixed" ? (["style", "palette", "layout"] as const)[i % 3]! : dimension;
    if (dim === "style") {
      const style = styles[i % styles.length]!;
      out.push({ label: `Style: ${style}`, plan: planDesign({ ...opts, style }).plan });
    } else if (dim === "palette") {
      const h = harmonies[i % harmonies.length]!;
      const baseColor = base.plan.palette.colors.primary ?? STYLE_PALETTES.modern!.colors.primary;
      out.push({ label: `Palette: ${h} from ${baseColor}`, plan: planDesign({ ...opts, baseColor, harmony: h }).plan });
    } else {
      const t = sameCategory[i % Math.max(sameCategory.length, 1)];
      if (t) out.push({ label: `Layout: ${t.id}`, plan: planDesign({ ...opts, template: t.id }).plan });
      else {
        // No alternate template in this category: mirror the composition horizontally.
        const W = base.plan.document.width;
        const mirrored = DesignPlanSchema.parse({
          ...base.plan,
          elements: base.plan.elements.map((e) => ("width" in e && e.width && e.type !== "text" ? { ...e, x: W - e.x - e.width } : e.type === "circle" || e.type === "polygon" || e.type === "star" ? { ...e, x: W - e.x } : e)),
        });
        out.push({ label: "Layout: mirrored composition", plan: mirrored });
      }
    }
  }
  return out;
}
