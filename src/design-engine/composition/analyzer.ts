import { contrastRatio } from "../../utils/colors.js";

/**
 * Composition analysis over VERIFIED document properties (bounds, fills, fonts read back from
 * Illustrator by inspect_document). This is geometry and color math, not visual perception;
 * results are labelled source: "verified-document-properties".
 */

export interface InspectedItem {
  name?: string;
  type: string;
  layer?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  fill?: { hex?: string } | null;
  contents?: string;
  fontSize?: number;
  font?: string | null;
  hidden?: boolean;
  locked?: boolean;
}

export interface Finding {
  id: string;
  category: "alignment" | "spacing" | "margins" | "typography" | "color" | "hierarchy" | "balance" | "overlap";
  severity: "info" | "warning" | "error";
  message: string;
  targets: string[];
  /** Targeted fix expressed as an update_elements payload (points, artboard coordinates). */
  fix?: { name: string; x?: number; y?: number; fill?: { hex: string }; fontSize?: number }[];
}

export interface CompositionReport {
  source: "verified-document-properties";
  score: number;
  artboard: { width: number; height: number };
  metrics: Record<string, number | string>;
  findings: Finding[];
}

const isBackground = (it: InspectedItem, W: number, H: number) =>
  !!it.bounds && it.bounds.width >= W * 0.95 && it.bounds.height >= H * 0.95;

function center(b: NonNullable<InspectedItem["bounds"]>) {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function contains(outer: NonNullable<InspectedItem["bounds"]>, inner: NonNullable<InspectedItem["bounds"]>) {
  return inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5 && inner.y + inner.height <= outer.y + outer.height + 0.5;
}

function intersects(a: NonNullable<InspectedItem["bounds"]>, b: NonNullable<InspectedItem["bounds"]>) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function analyzeComposition(items: InspectedItem[], artboard: { width: number; height: number }, opts: { marginRatio?: number } = {}): CompositionReport {
  const W = artboard.width, H = artboard.height;
  const findings: Finding[] = [];
  const visible = items.filter((i) => i.bounds && !i.hidden && i.bounds.width + i.bounds.height > 0);
  const bg = visible.filter((i) => isBackground(i, W, H));
  const content = visible.filter((i) => !isBackground(i, W, H) && !/guide|grid|keyline|dieline|fold/i.test(`${i.layer} ${i.name}`));
  const texts = content.filter((i) => i.type === "TextFrame");
  const margin = Math.min(W, H) * (opts.marginRatio ?? 0.05);
  let n = 0;
  const id = () => `F${++n}`;

  // Margins: content crossing the safe area (full-bleed blocks touching two opposite edges are allowed).
  for (const it of content) {
    const b = it.bounds!;
    const bleedsH = b.x <= 0.5 && b.x + b.width >= W - 0.5;
    const bleedsV = b.y <= 0.5 && b.y + b.height >= H - 0.5;
    if (bleedsH || bleedsV) continue;
    const outside = b.x + b.width < 0 || b.y + b.height < 0 || b.x > W || b.y > H;
    if (outside) {
      findings.push({ id: id(), category: "margins", severity: "error", message: `"${it.name}" is entirely off the artboard`, targets: [it.name ?? ""] });
      continue;
    }
    const touchesEdge = b.x <= 0.5 || b.y <= 0.5 || b.x + b.width >= W - 0.5 || b.y + b.height >= H - 0.5;
    if (it.type === "TextFrame" && (b.x < margin || b.y < margin || b.x + b.width > W - margin || b.y + b.height > H - margin) && !touchesEdge) {
      const nx = Math.min(Math.max(b.x, margin), W - margin - b.width);
      const ny = Math.min(Math.max(b.y, margin), H - margin - b.height);
      findings.push({ id: id(), category: "margins", severity: "warning", message: `Text "${it.name}" sits inside the ${margin.toFixed(1)} pt safe margin`, targets: [it.name ?? ""], fix: [{ name: it.name ?? "", x: nx, y: ny }] });
    }
  }

  // Alignment: near-miss left edges and centers (1–6 pt apart) suggest unintended misalignment.
  const tol = { min: 0.75, max: Math.max(6, W * 0.008) };
  const pairs = (key: (b: NonNullable<InspectedItem["bounds"]>) => number, label: string, move: (b: NonNullable<InspectedItem["bounds"]>, target: number) => number) => {
    const seen = new Set<string>();
    for (let i = 0; i < content.length; i++) {
      for (let j = i + 1; j < content.length; j++) {
        const a = content[i]!, b = content[j]!;
        const d = Math.abs(key(a.bounds!) - key(b.bounds!));
        if (d > tol.min && d < tol.max && !seen.has(b.name ?? "")) {
          const anchor = a.bounds!.width * a.bounds!.height >= b.bounds!.width * b.bounds!.height ? a : b;
          const mover = anchor === a ? b : a;
          seen.add(mover.name ?? "");
          findings.push({
            id: id(), category: "alignment", severity: "warning",
            message: `"${mover.name}" ${label} is ${d.toFixed(1)} pt off "${anchor.name}" — align them or offset deliberately`,
            targets: [mover.name ?? "", anchor.name ?? ""],
            fix: [{ name: mover.name ?? "", x: move(mover.bounds!, key(anchor.bounds!)) }],
          });
        }
      }
    }
  };
  pairs((b) => b.x, "left edge", (_b, t) => t);
  pairs((b) => b.x + b.width / 2, "center", (b, t) => t - b.width / 2);

  // Spacing: vertical gaps between stacked text blocks that share a column.
  const stack = [...texts].sort((a, b) => a.bounds!.y - b.bounds!.y);
  const gaps: number[] = [];
  for (let i = 1; i < stack.length; i++) {
    const prev = stack[i - 1]!.bounds!, cur = stack[i]!.bounds!;
    const sameColumn = Math.abs(center(prev).x - center(cur).x) < W * 0.15 || Math.abs(prev.x - cur.x) < 2;
    const gap = cur.y - (prev.y + prev.height);
    if (sameColumn && gap > 0 && gap < H * 0.25) gaps.push(gap);
  }
  if (gaps.length >= 3) {
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length);
    if (sd / mean > 0.6) {
      findings.push({ id: id(), category: "spacing", severity: "info", message: `Vertical gaps between stacked text vary widely (mean ${mean.toFixed(1)} pt, sd ${sd.toFixed(1)} pt); consider a consistent spacing scale`, targets: stack.map((t) => t.name ?? "") });
    }
  }

  // Typography: number of sizes/fonts, hierarchy ratio, tiny text.
  const sizes = [...new Set(texts.map((t) => Math.round((t.fontSize ?? 0) * 2) / 2))].sort((a, b) => b - a);
  const fonts = [...new Set(texts.map((t) => t.font).filter(Boolean))];
  if (sizes.length > 6) findings.push({ id: id(), category: "typography", severity: "warning", message: `${sizes.length} different font sizes; a tighter type scale (4–5 sizes) reads more consistently`, targets: [] });
  if (fonts.length > 3) findings.push({ id: id(), category: "typography", severity: "warning", message: `${fonts.length} typefaces in use (${fonts.join(", ")}); limit to 2–3`, targets: [] });
  for (const t of texts) {
    if ((t.fontSize ?? 12) < 6) findings.push({ id: id(), category: "typography", severity: "warning", message: `"${t.name}" is ${t.fontSize} pt — below the 6 pt legibility floor for print`, targets: [t.name ?? ""], fix: [{ name: t.name ?? "", fontSize: 6 }] });
  }
  if (sizes.length >= 2 && sizes[0]! / sizes[1]! < 1.25) {
    const top = texts.filter((t) => Math.round((t.fontSize ?? 0) * 2) / 2 === sizes[0]);
    findings.push({
      id: id(), category: "hierarchy", severity: "warning",
      message: `Largest text (${sizes[0]} pt) is only ${(sizes[0]! / sizes[1]!).toFixed(2)}× the next size; a clear focal point usually needs ≥1.5×`,
      targets: top.map((t) => t.name ?? ""), fix: top.map((t) => ({ name: t.name ?? "", fontSize: Math.round(sizes[1]! * 1.6) })),
    });
  }

  // Color: text contrast against the item visually behind it (topmost containing shape or background).
  const shapes = visible.filter((i) => i.type !== "TextFrame" && i.fill?.hex);
  for (const t of texts) {
    if (!t.fill?.hex) continue;
    const behind = [...shapes].reverse().find((s) => contains(s.bounds!, t.bounds!));
    const bgHex = behind?.fill?.hex ?? "#FFFFFF";
    const ratio = contrastRatio(t.fill.hex, bgHex);
    const large = (t.fontSize ?? 12) >= 18;
    if (ratio < (large ? 3 : 4.5)) {
      const fixHex = contrastRatio("#111111", bgHex) > contrastRatio("#FAFAFA", bgHex) ? "#111111" : "#FAFAFA";
      findings.push({ id: id(), category: "color", severity: ratio < 2 ? "error" : "warning", message: `"${t.name}" contrast is ${ratio.toFixed(2)}:1 on ${bgHex} (needs ${large ? 3 : 4.5}:1)`, targets: [t.name ?? ""], fix: [{ name: t.name ?? "", fill: { hex: fixHex } }] });
    }
  }
  const palette = new Set(visible.map((i) => i.fill?.hex).filter(Boolean));
  if (palette.size > 8) findings.push({ id: id(), category: "color", severity: "info", message: `${palette.size} distinct fill colors; consolidating to a 5–6 color palette improves cohesion`, targets: [] });

  // Overlap: text over text is almost always a defect.
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    if (intersects(texts[i]!.bounds!, texts[j]!.bounds!)) findings.push({ id: id(), category: "overlap", severity: "warning", message: `Text "${texts[i]!.name}" overlaps "${texts[j]!.name}"`, targets: [texts[i]!.name ?? "", texts[j]!.name ?? ""] });
  }

  // Balance: area-weighted visual center vs. artboard center.
  let wx = 0, wy = 0, wsum = 0;
  for (const it of content) {
    const b = it.bounds!;
    const wgt = Math.max(1, b.width * b.height) * (it.type === "TextFrame" ? 1.5 : 1);
    const c = center(b);
    wx += c.x * wgt; wy += c.y * wgt; wsum += wgt;
  }
  const cx = wsum ? wx / wsum : W / 2, cy = wsum ? wy / wsum : H / 2;
  const offX = (cx - W / 2) / W, offY = (cy - H / 2) / H;
  if (Math.abs(offX) > 0.15) findings.push({ id: id(), category: "balance", severity: "info", message: `Visual weight sits ${Math.round(Math.abs(offX) * 100)}% ${offX > 0 ? "right" : "left"} of center; intentional asymmetry should be countered by a secondary element`, targets: [] });
  if (offY > 0.2) findings.push({ id: id(), category: "balance", severity: "info", message: `Visual weight is bottom-heavy (${Math.round(offY * 100)}% below center)`, targets: [] });

  const penalty = findings.reduce((s, f) => s + (f.severity === "error" ? 15 : f.severity === "warning" ? 6 : 2), 0);
  return {
    source: "verified-document-properties",
    score: Math.max(0, 100 - penalty),
    artboard,
    metrics: {
      itemCount: visible.length, contentCount: content.length, textCount: texts.length, backgroundCount: bg.length,
      fontSizes: sizes.join(", "), typefaces: fonts.length, distinctFills: palette.size,
      visualCenterX: Math.round(cx * 10) / 10, visualCenterY: Math.round(cy * 10) / 10, safeMarginPt: Math.round(margin * 10) / 10,
    },
    findings,
  };
}
