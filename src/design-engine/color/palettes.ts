import { contrastRatio, normalizeHex, rotateHue, shiftLightness, hexToRgb, rgbToHsl, rgbToHex, hslToRgb } from "../../utils/colors.js";

export type Harmony = "monochrome" | "analogous" | "complementary" | "triadic" | "split-complementary";

/** Role-based palette: every template references these roles, never raw hex values. */
export interface RolePalette {
  name: string;
  colors: { background: string; surface: string; primary: string; secondary: string; accent: string; text: string; muted: string };
}

export const NAMED_COLORS: Record<string, string> = {
  beige: "#E9DDCC", cream: "#F4EDE1", ivory: "#FBF7EE", sand: "#D8C3A5", gold: "#C6A15B", champagne: "#E8D9B5",
  black: "#111111", charcoal: "#2B2B2B", white: "#FFFFFF", gray: "#8A8A8A", grey: "#8A8A8A", silver: "#C0C0C0",
  navy: "#14213D", blue: "#1F5FAD", sky: "#7EC8E3", teal: "#167D7F", turquoise: "#30C5C0", green: "#2E7D32",
  sage: "#A3B18A", olive: "#6B705C", mint: "#BDE4CF", forest: "#1B4332", red: "#C62828", crimson: "#9B1B30",
  burgundy: "#6D1A36", pink: "#F4A6C1", blush: "#F2D0C9", coral: "#FF6F59", orange: "#F28C28", peach: "#FFC9A9",
  yellow: "#F6C445", mustard: "#D4A017", purple: "#6A3FA0", lavender: "#C8B6E2", violet: "#7F3FBF", brown: "#6F4E37",
  terracotta: "#C8643B", neon: "#39FF14", magenta: "#D81B60", cyan: "#00B8D9",
};

/** Curated palettes per style; chosen by the planner when the brief names no colors. */
export const STYLE_PALETTES: Record<string, RolePalette> = {
  minimalist: { name: "Minimal Mono", colors: { background: "#FAFAF7", surface: "#EFEFEA", primary: "#1A1A1A", secondary: "#6B6B6B", accent: "#D04A2F", text: "#1A1A1A", muted: "#9A9A94" } },
  luxury: { name: "Luxe Sand", colors: { background: "#E9DDCC", surface: "#F4EDE1", primary: "#29231E", secondary: "#8C7356", accent: "#C6A15B", text: "#29231E", muted: "#A08C74" } },
  corporate: { name: "Corporate Trust", colors: { background: "#FFFFFF", surface: "#EEF2F7", primary: "#14366B", secondary: "#2F6FB5", accent: "#F2A33A", text: "#1B2533", muted: "#6B7A8F" } },
  editorial: { name: "Editorial Ink", colors: { background: "#F6F3EE", surface: "#E8E2D8", primary: "#111111", secondary: "#5A5550", accent: "#B23A2B", text: "#111111", muted: "#8C857C" } },
  modern: { name: "Modern Contrast", colors: { background: "#F5F5F5", surface: "#FFFFFF", primary: "#0F172A", secondary: "#3B82F6", accent: "#F43F5E", text: "#0F172A", muted: "#64748B" } },
  retro: { name: "Retro Sunset", colors: { background: "#F3E3C3", surface: "#EBCB98", primary: "#2D3047", secondary: "#E0732F", accent: "#C9372C", text: "#2D3047", muted: "#93836B" } },
  swiss: { name: "Swiss Red", colors: { background: "#FFFFFF", surface: "#F0F0F0", primary: "#E30613", secondary: "#000000", accent: "#E30613", text: "#000000", muted: "#7A7A7A" } },
  brutalist: { name: "Raw Concrete", colors: { background: "#E6E6E1", surface: "#FFFFFF", primary: "#000000", secondary: "#3A3A3A", accent: "#FF3B00", text: "#000000", muted: "#6E6E6E" } },
  geometric: { name: "Geo Primary", colors: { background: "#FDFBF6", surface: "#F1ECE0", primary: "#264653", secondary: "#2A9D8F", accent: "#E9C46A", text: "#1D2D35", muted: "#8AA1A8" } },
  organic: { name: "Organic Sage", colors: { background: "#F1EDE4", surface: "#E3E8D8", primary: "#3A5A40", secondary: "#A3B18A", accent: "#C8643B", text: "#2F3A2F", muted: "#8B9480" } },
  playful: { name: "Playful Pop", colors: { background: "#FFF8E7", surface: "#FFE3EC", primary: "#5B2EFF", secondary: "#00C2A8", accent: "#FF5C8A", text: "#231942", muted: "#8E7DBE" } },
  futuristic: { name: "Neon Night", colors: { background: "#0B0F1A", surface: "#151B2E", primary: "#00E5FF", secondary: "#7C4DFF", accent: "#FF2E88", text: "#EAF2FF", muted: "#7A86A8" } },
  vintage: { name: "Vintage Print", colors: { background: "#EFE6D2", surface: "#E2D3B5", primary: "#3E2C23", secondary: "#7A4E2D", accent: "#A8442C", text: "#3E2C23", muted: "#9C8A70" } },
  contemporary: { name: "Contemporary Clay", colors: { background: "#F7F3F0", surface: "#EADFD8", primary: "#2F2A3A", secondary: "#8D6E63", accent: "#D97757", text: "#2F2A3A", muted: "#9C8F8A" } },
};

export function harmonize(baseHex: string, harmony: Harmony): string[] {
  const base = normalizeHex(baseHex);
  switch (harmony) {
    case "monochrome": return [shiftLightness(base, -25), base, shiftLightness(base, 20), shiftLightness(base, 40)];
    case "analogous": return [rotateHue(base, -30), base, rotateHue(base, 30)];
    case "complementary": return [base, rotateHue(base, 180)];
    case "triadic": return [base, rotateHue(base, 120), rotateHue(base, 240)];
    case "split-complementary": return [base, rotateHue(base, 150), rotateHue(base, 210)];
  }
}

function withSaturation(hex: string, s: number, l: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(hsl.h, s, l));
}

/** Choose whichever of near-black / near-white text reads best on the background. */
export function readableText(bg: string, dark = "#141414", light = "#FAFAFA"): string {
  return contrastRatio(dark, bg) >= contrastRatio(light, bg) ? dark : light;
}

/** Build a complete role palette from a base color and harmony rule. */
export function generatePalette(baseHex: string, harmony: Harmony = "complementary", opts: { dark?: boolean; name?: string } = {}): RolePalette {
  const [first, second, third] = harmonize(baseHex, harmony);
  const primary = normalizeHex(baseHex);
  const background = opts.dark ? withSaturation(primary, 25, 8) : withSaturation(primary, 20, 97);
  const surface = opts.dark ? withSaturation(primary, 20, 14) : withSaturation(primary, 18, 91);
  const text = readableText(background);
  return {
    name: opts.name ?? `${harmony} ${primary}`,
    colors: {
      background, surface, primary,
      secondary: second ?? shiftLightness(first ?? primary, 15),
      accent: third ?? second ?? rotateHue(primary, 180),
      text,
      muted: opts.dark ? shiftLightness(text, -35) : shiftLightness(text, 45),
    },
  };
}

/** Collect named colors mentioned in free text, in order of appearance. */
export function colorsInText(text: string): { word: string; hex: string }[] {
  const out: { word: string; hex: string; at: number }[] = [];
  const lower = text.toLowerCase();
  for (const [word, hex] of Object.entries(NAMED_COLORS)) {
    const m = new RegExp(`\\b${word}\\b`).exec(lower);
    if (m) out.push({ word, hex, at: m.index });
  }
  for (const m of text.matchAll(/#[0-9a-fA-F]{6}\b/g)) out.push({ word: m[0], hex: normalizeHex(m[0]), at: m.index ?? 0 });
  return out.sort((a, b) => a.at - b.at).map(({ word, hex }) => ({ word, hex }));
}

/**
 * Merge brief colors into a style palette. A color word right before "background" becomes the
 * background; remaining colors fill primary/accent. Text color is recomputed for contrast.
 */
export function paletteFromBrief(brief: string, style: string): RolePalette {
  const base = STYLE_PALETTES[style] ?? STYLE_PALETTES.modern!;
  const colors = { ...base.colors };
  const found = colorsInText(brief);
  const lower = brief.toLowerCase();
  let used = new Set<string>();
  for (const f of found) {
    if (new RegExp(`${f.word.toLowerCase()}\\s+(background|backdrop|base)`).test(lower)) {
      colors.background = f.hex;
      colors.surface = shiftLightness(f.hex, contrastRatio(f.hex, "#000000") > 10 ? 5 : 8);
      used.add(f.word);
    }
  }
  const rest = found.filter((f) => !used.has(f.word));
  if (rest[0]) colors.primary = rest[0].hex;
  if (rest[1]) colors.accent = rest[1].hex;
  if (rest[2]) colors.secondary = rest[2].hex;
  used = new Set();
  colors.text = contrastRatio(base.colors.text, colors.background) >= 4.5 ? base.colors.text : readableText(colors.background);
  if (contrastRatio(colors.primary, colors.background) < 3) colors.primary = colors.text;
  return { name: found.length ? `${base.name} (brief colors)` : base.name, colors };
}
