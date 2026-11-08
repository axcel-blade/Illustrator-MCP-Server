import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, normalizeHex, rgbToCmyk, rgbToHex, rotateHue } from "../../src/utils/colors.js";
import { McpDesignError } from "../../src/utils/errors.js";
import { PathPolicy } from "../../src/utils/paths.js";
import { convert, fromIllustratorPoint, fromPoints, toIllustratorPoint, toPoints } from "../../src/utils/units.js";

describe("unit conversion", () => {
  it("converts to points", () => {
    expect(toPoints(1, "in")).toBe(72);
    expect(toPoints(25.4, "mm")).toBeCloseTo(72, 10);
    expect(toPoints(1, "cm")).toBeCloseTo(28.3465, 3);
    expect(toPoints(1, "pc")).toBe(12);
    expect(toPoints(100, "px")).toBe(100);
  });
  it("round-trips", () => {
    for (const u of ["mm", "cm", "in", "pc", "pt", "px"] as const) expect(fromPoints(toPoints(123.456, u), u)).toBeCloseTo(123.456, 9);
    expect(convert(210, "mm", "in")).toBeCloseTo(8.2677, 3);
  });
  it("A4 is 595.28 x 841.89 pt", () => {
    expect(toPoints(210, "mm")).toBeCloseTo(595.28, 2);
    expect(toPoints(297, "mm")).toBeCloseTo(841.89, 2);
  });
});

describe("coordinate convention", () => {
  it("negates y for Illustrator's y-up artboard space", () => {
    expect(toIllustratorPoint(10, 20)).toEqual([10, -20]);
    expect(toIllustratorPoint(1, 1, "in")).toEqual([72, -72]);
    expect(fromIllustratorPoint(72, -144, "in")).toEqual([1, 2]);
  });
});

describe("colors", () => {
  it("parses and formats hex", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(hexToRgb("#FF8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe("#FF8000");
  });
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
  it("converts to CMYK and rotates hue", () => {
    expect(rgbToCmyk({ r: 0, g: 0, b: 0 })).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(rgbToCmyk({ r: 255, g: 0, b: 0 })).toEqual({ c: 0, m: 100, y: 100, k: 0 });
    expect(rotateHue("#FF0000", 120)).toBe("#00FF00");
  });
});

describe("path policy (security boundary)", () => {
  const root = mkdtempSync(join(tmpdir(), "mcp-paths-"));
  const policy = new PathPolicy([root]);

  it("resolves relative paths inside the root", () => {
    expect(policy.resolve("a/b.ai")).toBe(join(root, "a", "b.ai"));
  });
  it("rejects traversal, other roots and UNC paths", () => {
    expect(() => policy.resolve("../escape.ai")).toThrow(McpDesignError);
    expect(() => policy.resolve("C:\\Windows\\system32\\x.ai")).toThrow(/outside/);
    expect(() => policy.resolve("\\\\server\\share\\x.ai")).toThrow(/UNC/);
    expect(() => policy.resolve("a\0b")).toThrow();
  });
  it("enforces extensions and existence", () => {
    expect(() => policy.resolve("x.exe", { extensions: [".ai"] })).toThrow(/extension/);
    expect(() => policy.resolve("missing.png", { mustExist: true })).toThrow(/not found/);
  });
  it("refuses to overwrite unless asked", () => {
    writeFileSync(join(root, "exists.ai"), "x");
    expect(() => policy.resolveOutput("exists.ai", { extensions: [".ai"] })).toThrow(/already exists/);
    expect(policy.resolveOutput("exists.ai", { extensions: [".ai"], overwrite: true })).toBe(join(root, "exists.ai"));
  });
});
