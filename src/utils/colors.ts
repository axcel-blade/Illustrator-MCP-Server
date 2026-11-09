import { z } from "zod";

export const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "Color must be a hex string like #1A2B3C");

export interface Rgb { r: number; g: number; b: number }
export interface Cmyk { c: number; m: number; y: number; k: number }

export function normalizeHex(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return "#" + full.toUpperCase();
}

export function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex).slice(1);
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return ("#" + c(r) + c(g) + c(b)).toUpperCase();
}

/** Naive device conversion; Illustrator applies its own color management in CMYK documents. */
export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const f = (v: number) => Math.round(((1 - v - k) / (1 - k)) * 100);
  return { c: f(rr), m: f(gg), y: f(bb), k: Math.round(k * 100) };
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const ss = s / 100, ll = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio between two colors. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Linear RGB mix: t = 0 gives a, t = 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  const m = (p: number, q: number) => Math.round(p + (q - p) * t);
  return rgbToHex({ r: m(x.r, y.r), g: m(x.g, y.g), b: m(x.b, y.b) });
}

export function shiftLightness(hex: string, delta: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(hsl.h, hsl.s, Math.max(0, Math.min(100, hsl.l + delta))));
}

export function rotateHue(hex: string, degrees: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb((hsl.h + degrees + 360) % 360, hsl.s, hsl.l));
}
