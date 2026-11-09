import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DesignSystemStore } from "../../src/design-engine/design-system-store.js";
import { typographyIssues } from "../../src/mcp/tools/advanced.js";

const style = (font: string | null, size: number, count = 1) => ({ font, family: font?.split("-")[0] ?? null, size, count, objects: [] });

describe("typographyIssues", () => {
  it("flags missing fonts, near-duplicate and tiny sizes", () => {
    const issues = typographyIssues({ styles: [style("Inter-Regular", 11), style("Inter-Regular", 11.5), style(null, 24, 2), style("Inter-Bold", 5)], familyCount: 1, sizeCount: 4 });
    expect(issues.some((i) => /not installed/.test(i) && i.startsWith("2"))).toBe(true);
    expect(issues.some((i) => /11pt and 11.5pt/.test(i))).toBe(true);
    expect(issues.some((i) => /under 6pt/.test(i))).toBe(true);
  });
  it("accepts a clean two-family type scale", () => {
    expect(typographyIssues({ styles: [style("Inter-Regular", 12), style("Montserrat-Bold", 24), style("Montserrat-Bold", 48)], familyCount: 2, sizeCount: 3 })).toEqual([]);
  });
});

describe("DesignSystemStore", () => {
  const store = new DesignSystemStore(mkdtempSync(join(tmpdir(), "ds-")));
  const sys = { name: "Tech Startup", palette: { navy: "#0B1F3A", electric: "#2F80ED", white: "#FFFFFF" }, typography: [{ role: "heading", minSize: 24, font: "Montserrat Bold" }] };
  it("saves, lists and reads systems independently of documents", () => {
    expect(store.save(sys).created).toBe(true);
    expect(store.list()).toEqual([{ name: "Tech Startup", description: undefined, roles: ["navy", "electric", "white"] }]);
    expect(store.get("tech startup").typography[0]!.font).toBe("Montserrat Bold");
  });
  it("refuses to overwrite without permission", () => {
    expect(() => store.save(sys)).toThrow(/overwrite/);
    expect(store.save({ ...sys, description: "v2" }, true).created).toBe(false);
  });
  it("rejects invalid colors and unknown systems", () => {
    expect(() => store.save({ name: "Bad", palette: { a: "blue" }, typography: [] })).toThrow();
    expect(() => store.get("nope")).toThrow(/No design system/);
  });
});
