import type { InspectedItem } from "../composition/analyzer.js";

/*
 * Semantic layer naming (like Figma's "Rename layers"). Names come from verified document
 * geometry and content: role is inferred from size, position, shape and what the object contains
 * or sits on. Only generic names (empty, "<Path>", Illustrator type names, "Rectangle 12") are
 * replaced unless `all` is requested.
 */

export interface RenameSuggestion {
  uuid?: string;
  layer?: string;
  from: string;
  to: string;
  reason: string;
}

type Box = { x: number; y: number; width: number; height: number };

const GENERIC = /^(|<.*>|path|pathitem|textframe|groupitem|compoundpathitem|placeditem|rasteritem|symbolitem|rectangle|ellipse|polygon|star|line|group|text|image|clip group|layer)(\s*(copy)?\s*\d*)$/i;

export function isGenericName(name: string | undefined, type: string): boolean {
  const n = (name ?? "").trim();
  return GENERIC.test(n) || n.toLowerCase() === type.toLowerCase();
}

function inside(inner: Box, outer: Box, tol = 1): boolean {
  return inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.x + inner.width <= outer.x + outer.width + tol && inner.y + inner.height <= outer.y + outer.height + tol;
}

function snippet(s: string, words = 4): string {
  const clean = s.replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  const out = parts.slice(0, words).join(" ");
  return (parts.length > words ? `${out}…` : out).slice(0, 60);
}

export function suggestLayerNames(items: InspectedItem[], artboard: { width: number; height: number }, opts: { all?: boolean } = {}): RenameSuggestion[] {
  const W = artboard.width, H = artboard.height;
  const texts = items.filter((i) => i.type === "TextFrame" && i.bounds && i.contents);
  const maxFont = Math.max(0, ...texts.map((t) => t.fontSize ?? 0));
  const out: RenameSuggestion[] = [];
  const used = new Map<string, number>();
  for (const i of items) {
    if (!opts.all && !isGenericName(i.name, i.type)) {
      used.set(i.name!, (used.get(i.name!) ?? 0) + 1);
    }
  }
  const unique = (base: string): string => {
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n === 0 ? base : `${base} ${n + 1}`;
  };

  for (const item of items) {
    if (!opts.all && !isGenericName(item.name, item.type)) continue;
    const b = item.bounds;
    let name = "";
    let reason = "";
    if (item.type === "TextFrame") {
      const t = item.contents ?? "";
      const size = item.fontSize ?? 0;
      const container = b && items.find((o) => o !== item && o.type === "PathItem" && o.bounds && inside(b, o.bounds) && o.bounds.width < W * 0.6 && o.bounds.height < Math.max(size * 4, 1));
      if (container && t.length <= 30) { name = `Button Label / ${snippet(t, 3)}`; reason = "short text inside a small filled shape"; }
      else if (maxFont && size >= maxFont * 0.8 && size >= 18) { name = `Heading / ${snippet(t)}`; reason = "largest type on the artboard"; }
      else if (size >= 16 && t.length < 80) { name = `Subheading / ${snippet(t)}`; reason = "mid-size short text"; }
      else if (t.length <= 24 && /^[A-Z0-9 ·&|/-]+$/.test(t.trim()) ) { name = `Eyebrow / ${snippet(t, 3)}`; reason = "short all-caps text"; }
      else if (size && size <= 10) { name = `Caption / ${snippet(t, 3)}`; reason = "small text"; }
      else if (t.length > 80) { name = `Paragraph / ${snippet(t, 3)}`; reason = "long text"; }
      else { name = `Text / ${snippet(t)}`; reason = "text content"; }
    } else if (item.type === "PlacedItem" || item.type === "RasterItem") {
      name = "Image"; reason = "placed or raster image";
    } else if (item.type === "GroupItem") {
      const label = b && texts.find((t) => t.bounds && inside(t.bounds, b));
      name = label ? `Group / ${snippet(label.contents ?? "", 3)}` : "Group"; reason = "group (named after its first text)";
    } else if (item.type === "CompoundPathItem") {
      name = b && b.width < W * 0.15 && b.height < H * 0.15 ? "Icon" : "Vector Shape"; reason = "compound path";
    } else if (b) {
      const area = (b.width * b.height) / (W * H);
      const square = Math.abs(b.width - b.height) <= Math.max(b.width, b.height) * 0.1;
      const label = texts.find((t) => t.bounds && inside(t.bounds, b));
      if (area >= 0.9) { name = "Background"; reason = "covers the artboard"; }
      else if (b.height <= 2 || b.width <= 2) { name = "Divider"; reason = "hairline shape"; }
      else if (b.width >= W * 0.9 && b.y <= H * 0.02 && b.height <= H * 0.15) { name = "Header Bar"; reason = "full-width band at the top"; }
      else if (b.width >= W * 0.9 && b.y + b.height >= H * 0.98 && b.height <= H * 0.15) { name = label ? "Footer" : "Footer Bar"; reason = "full-width band at the bottom"; }
      else if (label && b.height <= Math.max((label.fontSize ?? 12) * 4, 24) && b.width <= W * 0.6) { name = `Button / ${snippet(label.contents ?? "", 3)}`; reason = "small shape containing short text"; }
      else if (square && b.width <= Math.min(W, H) * 0.08) { name = label ? "Avatar" : "Icon"; reason = "small square-ish shape"; }
      else if (label) { name = `Card / ${snippet(label.contents ?? "", 3)}`; reason = "panel containing text"; }
      else if (square && b.width <= Math.min(W, H) * 0.4) { name = "Shape / Decoration"; reason = "free-standing shape"; }
      else { name = area > 0.25 ? "Panel" : "Shape"; reason = "unlabelled shape"; }
    } else {
      name = item.type.replace(/Item$/, ""); reason = "no bounds available";
    }
    const to = unique(name);
    if (to !== item.name) out.push({ uuid: (item as { uuid?: string }).uuid, layer: item.layer, from: item.name ?? "", to, reason });
  }
  return out;
}
