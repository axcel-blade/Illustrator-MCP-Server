import { z } from "zod";

export const UnitSchema = z.enum(["pt", "px", "mm", "cm", "in", "pc"]);
export type Unit = z.infer<typeof UnitSchema>;

/** Points per unit. Illustrator's internal unit is the PostScript point (1/72 inch); 1 px = 1 pt in Illustrator. */
const PT_PER_UNIT: Record<Unit, number> = {
  pt: 1,
  px: 1,
  mm: 72 / 25.4,
  cm: 72 / 2.54,
  in: 72,
  pc: 12,
};

export function toPoints(value: number, unit: Unit): number {
  return value * PT_PER_UNIT[unit];
}

export function fromPoints(value: number, unit: Unit): number {
  return value / PT_PER_UNIT[unit];
}

export function convert(value: number, from: Unit, to: Unit): number {
  return fromPoints(toPoints(value, from), to);
}

export function round(value: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Coordinate convention (used by every tool and the design schema):
 *   origin = top-left corner of the target artboard, x grows right, y grows DOWN.
 * Illustrator's scripting artboard coordinate system has y growing UP, so the bridge
 * negates y. This helper produces the Illustrator-space [left, top] in points.
 */
export function toIllustratorPoint(x: number, y: number, unit: Unit = "pt"): [number, number] {
  return [toPoints(x, unit), -toPoints(y, unit)];
}

export function fromIllustratorPoint(left: number, top: number, unit: Unit = "pt"): [number, number] {
  return [fromPoints(left, unit), fromPoints(-top, unit)];
}

export const PAPER_SIZES_MM: Record<string, [number, number]> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
  Tabloid: [279.4, 431.8],
  BusinessCardUS: [88.9, 50.8],
  BusinessCardEU: [85, 55],
};
