import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../config/index.js";
import { contrastRatio, normalizeHex } from "../../utils/colors.js";
import type { RolePalette } from "../color/palettes.js";

/*
 * Design knowledge base from UI/UX Pro Max (MIT, vendored in data/). Rows are
 * loaded lazily and searched with a simple token-overlap score weighted toward each domain's
 * name/keyword columns, which is deterministic and needs no index.
 */

export const KNOWLEDGE_DIR = join(PROJECT_ROOT, "data");

export type Row = Record<string, string>;

export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.length)) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** Domain → file and the columns that matter most for matching (weighted 3×). */
export const DOMAINS = {
  product: { file: "products.csv", key: ["Product Type", "Keywords"], description: "Product types → recommended style, landing pattern, dashboard style, palette focus" },
  color: { file: "colors.csv", key: ["Product Type", "Notes"], description: "Product-type color palettes (primary, secondary, accent, background, foreground, card, muted, border, destructive)" },
  typography: { file: "typography.csv", key: ["Font Pairing Name", "Mood/Style Keywords", "Best For"], description: "Heading/body font pairings by mood" },
  style: { file: "styles.csv", key: ["Style Category", "Keywords", "Best For", "Aliases"], description: "UI styles (glassmorphism, neumorphism, brutalism…) with colors, effects, best-for and do-not-use-for" },
  reasoning: { file: "ui-reasoning.csv", key: ["UI_Category"], description: "Per-product design reasoning: pattern, style priority, color/typography mood, anti-patterns" },
  landing: { file: "landing.csv", key: ["Pattern Name", "Keywords", "Aliases"], description: "Landing page patterns: section order, CTA placement, color strategy" },
  ux: { file: "ux-guidelines.csv", key: ["Category", "Issue", "Description"], description: "UX guidelines with do / don't and severity" },
  "app-interface": { file: "app-interface.csv", key: ["Category", "Issue", "Keywords"], description: "Mobile app interface rules (accessibility, touch, navigation)" },
  chart: { file: "charts.csv", key: ["Data Type", "Keywords", "Best Chart Type"], description: "Chart type recommendations per data type" },
} as const;
export type Domain = keyof typeof DOMAINS;

/** Columns dropped from results: source code snippets and web-only build config are irrelevant to vector design. */
const NOISE = /^(Code Example|CSS Import|Tailwind Config|Google Fonts URL|Framework Compatibility|CSS\/Technical|Library Recommendation|rtl_level|Status|Replacement|Parent Style ID|Data Volume)/;

const cache = new Map<Domain, Row[]>();
export function rows(domain: Domain): Row[] {
  let r = cache.get(domain);
  if (!r) {
    r = parseCsv(readFileSync(join(KNOWLEDGE_DIR, DOMAINS[domain].file), "utf8"));
    cache.set(domain, r);
  }
  return r;
}

const STOP = new Set(["a", "an", "the", "for", "and", "or", "of", "to", "with", "in", "on", "my", "our", "app", "design", "page", "screen", "website", "create", "make", "build", "new"]);
/** Light stemming so "apps"/"app", "booking"/"book", "services"/"service" match, without loose prefixes. */
function stem(t: string): string {
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/** Generic UI words that say what is being made, not for whom; they must not pick the product type. */
const UI_WORDS = new Set(["screen", "page", "landing", "dashboard", "mobile", "web", "ui", "ux", "kit", "wireframe", "home", "login", "log", "sign", "signin", "signup", "admin", "panel", "settings", "onboard", "template", "mockup", "interface", "layout", "poster", "flyer", "logo"]);

export function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9#+&\s/-]/g, " ").split(/[\s/-]+/).filter((t) => t.length > 1 && !STOP.has(t)).map(stem);
}

/** Query tokens for product matching: drop words that describe the artifact rather than the business. */
function productTokens(s: string): string[] {
  return tokens(s).filter((t) => !UI_WORDS.has(t));
}

interface Indexed { row: Row; nameToks: Set<string>; keyToks: Set<string>; allToks: Set<string> }
const indexes = new Map<Domain, { docs: Indexed[]; idf: (t: string) => number }>();

/** Tokenized rows plus inverse document frequency over key columns, so rare words ("yoga") outweigh common ones ("studio"). */
function index(domain: Domain) {
  let ix = indexes.get(domain);
  if (!ix) {
    const docs = rows(domain).map((row) => ({
      row,
      nameToks: new Set(tokens(row[DOMAINS[domain].key[0]] ?? "")),
      keyToks: new Set(tokens(DOMAINS[domain].key.map((k) => row[k] ?? "").join(" "))),
      allToks: new Set(tokens(Object.values(row).join(" "))),
    }));
    const df = new Map<string, number>();
    for (const d of docs) for (const t of d.keyToks) df.set(t, (df.get(t) ?? 0) + 1);
    const n = docs.length;
    ix = { docs, idf: (t: string) => Math.log(1 + n / (1 + (df.get(t) ?? 0))) };
    indexes.set(domain, ix);
  }
  return ix;
}

function score(d: Indexed, domain: Domain, q: string[], idf: (t: string) => number): number {
  if (!q.length) return 0;
  const { row, nameToks, keyToks, allToks } = d;
  let s = 0;
  for (const t of q) {
    const w = idf(t);
    if (nameToks.has(t)) s += 4 * w;
    else if (keyToks.has(t)) s += 3 * w;
    else if (allToks.has(t)) s += 0.5;
  }
  // Exact name phrase match wins ties ("fintech", "e-commerce").
  const name = (row[DOMAINS[domain].key[0]] ?? "").toLowerCase();
  if (name && q.join(" ").includes(name)) s += 4;
  return s;
}

export interface SearchHit { score: number; row: Row }

export function search(domain: Domain, query: string, limit = 5): SearchHit[] {
  const q = domain === "product" ? productTokens(query) : tokens(query);
  const { docs, idf } = index(domain);
  return docs
    .map((d) => ({ score: score(d, domain, q, idf), row: d.row }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => ({ score: Math.round(h.score * 10) / 10, row: clean(h.row) }));
}

function clean(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([k, v]) => v && !NOISE.test(k) && k !== "No"));
}

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: string | undefined) => (v && HEX.test(v) ? normalizeHex(v) : undefined);

/** Map a colors.csv row onto the engine's palette roles. */
export function paletteFromRow(row: Row): RolePalette {
  const bg = hex(row.Background) ?? "#FFFFFF";
  const fg = hex(row.Foreground) ?? "#111111";
  const primary = hex(row.Primary) ?? fg;
  const colors: RolePalette["colors"] & Record<string, string> = {
    background: bg,
    surface: hex(row.Card) ?? bg,
    primary,
    secondary: hex(row.Secondary) ?? primary,
    accent: hex(row.Accent) ?? primary,
    text: fg,
    muted: hex(row.Border) ?? hex(row["Muted Foreground"]) ?? fg,
  };
  const subtle = hex(row["Muted Foreground"]);
  if (subtle && contrastRatio(subtle, bg) >= 4.5) colors.subtle = subtle;
  for (const [role, col, fill] of [["onPrimary", "On Primary", colors.primary], ["onAccent", "On Accent", colors.accent]] as const) {
    const c = hex(row[col]);
    if (c && contrastRatio(c, fill) >= 4.5) colors[role] = c;
  }
  const destructive = hex(row.Destructive);
  if (destructive) colors.destructive = destructive;
  return { name: `${row["Product Type"]} (UI/UX Pro Max)`, colors };
}

/** Body/heading font candidates with Windows-safe fallbacks. */
function fontList(name: string | undefined, serif: boolean): string[] {
  const fall = serif ? ["Georgia", "Times New Roman"] : ["Segoe UI", "Arial"];
  return [...(name ? [name] : []), ...fall];
}
const SERIF = /serif|display|playfair|lora|merriweather|garamond|baskerville|cormorant|libre|crimson|bodoni|dm serif|fraunces|spectral/i;

export interface DesignSystemRecommendation {
  query: string;
  product?: Row;
  reasoning?: Row;
  style?: Row;
  landing?: Row;
  typography?: Row;
  palette?: RolePalette;
  fonts?: { heading: { fonts: string[]; weight?: "bold" | "semibold" }; body: { fonts: string[] }; accent: { fonts: string[]; weight?: "medium" } };
  antiPatterns: string[];
  rationale: string[];
  confidence: "high" | "low" | "none";
}

/**
 * Recommend a design system for a brief: best product-type match drives palette, reasoning,
 * landing pattern and style; the font pairing is matched on the product's typography mood.
 */
export function recommendDesignSystem(query: string): DesignSystemRecommendation {
  const productHit = search("product", query, 1)[0];
  const rationale: string[] = [];
  if (!productHit || productHit.score < 13) {
    const typo = search("typography", query, 1)[0];
    return { query, typography: typo?.row, antiPatterns: [], rationale: ["No product type matched the brief strongly; only a font pairing is suggested."], confidence: typo ? "low" : "none" };
  }
  const product = productHit.row;
  const type = product["Product Type"]!;
  const exact = (d: Domain, col: string) => rows(d).find((r) => r[col]?.toLowerCase() === type.toLowerCase());
  const colorRow = exact("color", "Product Type");
  const reasoning = exact("reasoning", "UI_Category");
  const styleName = (product["Primary Style Recommendation"] ?? "").split("+")[0]!.trim();
  const style = search("style", styleName, 1)[0]?.row;
  const landing = search("landing", product["Landing Page Pattern"] ?? "", 1)[0]?.row;
  const typography = search("typography", `${reasoning?.Typography_Mood ?? ""} ${type} ${product.Keywords ?? ""}`, 1)[0]?.row;
  const palette = colorRow ? paletteFromRow(colorRow) : undefined;
  const fonts = typography ? {
    heading: { fonts: fontList(typography["Heading Font"], SERIF.test(typography["Heading Font"] ?? "")), weight: "bold" as const },
    body: { fonts: fontList(typography["Body Font"], SERIF.test(typography["Body Font"] ?? "")) },
    accent: { fonts: fontList(typography["Body Font"], false), weight: "medium" as const },
  } : undefined;
  rationale.push(`Product type "${type}" (UI/UX Pro Max): ${product["Key Considerations"] ?? ""}`.trim());
  if (palette) rationale.push(`Palette "${colorRow!.Notes || type}" from the product color table`);
  if (typography) rationale.push(`Font pairing "${typography["Font Pairing Name"]}": ${typography["Heading Font"]} / ${typography["Body Font"]}`);
  if (product["Primary Style Recommendation"]) rationale.push(`Recommended style: ${product["Primary Style Recommendation"]}`);
  const antiPatterns = (reasoning?.Anti_Patterns ?? "").split("+").map((s) => s.trim()).filter(Boolean);
  if (antiPatterns.length) rationale.push(`Avoid: ${antiPatterns.join(", ")}`);
  return { query, product, reasoning: reasoning && clean(reasoning), style: style && clean(style), landing, typography: typography && clean(typography), palette, fonts, antiPatterns, rationale, confidence: "high" };
}
