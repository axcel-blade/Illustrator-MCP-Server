import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generatePalette, paletteFromBrief } from "../../src/design-engine/color/palettes.js";
import { compilePlan } from "../../src/design-engine/compiler.js";
import { analyzeComposition } from "../../src/design-engine/composition/analyzer.js";
import { PlanStore, diffPlans } from "../../src/design-engine/plan-store.js";
import { analyzeBrief, planDesign, planVariations, STYLES } from "../../src/design-engine/planner/planner.js";
import { parseInstructions, revisePlan, revisionOps } from "../../src/design-engine/revision.js";
import { TEMPLATES } from "../../src/design-engine/templates/library.js";
import { typeScale } from "../../src/design-engine/typography/type-systems.js";
import { validatePlan } from "../../src/design-engine/validator/validate.js";
import { suggestLayerNames } from "../../src/design-engine/ui/naming.js";
import { parseCsv, recommendDesignSystem, rows, search } from "../../src/design-engine/knowledge/knowledge.js";
import { contrastRatio } from "../../src/utils/colors.js";

const SAMPLE = {
  document: { name: "Luxury Skincare Poster", width: 210, height: 297, units: "mm", colorMode: "CMYK" },
  background: { type: "solid", color: "#E9DDCC" },
  palette: { name: "t", colors: { text: "#29231E", accent: "#C6A98A", background: "#E9DDCC" } },
  layers: [{ name: "Typography" }, { name: "Graphics" }, { name: "Background" }],
  elements: [
    { type: "text", name: "Headline", layer: "Typography", content: "PURE BEAUTY", fontSize: 48, color: "#29231E", x: 20, y: 30 },
    { type: "circle", name: "Decorative Element", layer: "Graphics", x: 100, y: 140, radius: 40, fill: "palette.accent" },
  ],
};

describe("design plan schema + validation", () => {
  it("accepts the reference example and applies defaults", () => {
    const r = validatePlan(SAMPLE);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    const text = r.plan!.elements[0]!;
    expect(text.type === "text" && text.textAlign).toBe("left");
  });
  it("rejects bad colors, unknown layers, duplicates and missing palette roles", () => {
    const bad = structuredClone(SAMPLE) as typeof SAMPLE & { elements: Record<string, unknown>[] };
    bad.elements.push({ type: "rect", name: "Headline", layer: "Nope", x: 0, y: 0, width: 1, height: 1, fill: "palette.missing" });
    const r = validatePlan(bad);
    expect(r.valid).toBe(false);
    const msgs = r.errors.map((e) => e.message).join("\n");
    expect(msgs).toMatch(/Duplicate element name/);
    expect(msgs).toMatch(/Layer "Nope"/);
    expect(msgs).toMatch(/palette\.missing/);
    expect(validatePlan({ ...SAMPLE, background: { type: "solid", color: "red" } }).valid).toBe(false);
  });
  it("detects alignment dependency cycles and unknown references", () => {
    const p = structuredClone(SAMPLE) as typeof SAMPLE & { elements: Record<string, unknown>[] };
    p.elements[0]!.align = { relativeTo: "Decorative Element", horizontal: "center" };
    p.elements[1]!.align = { relativeTo: "Headline", vertical: "top" };
    expect(validatePlan(p).errors.some((e) => /cycle/.test(e.message))).toBe(true);
    p.elements[1]!.align = { relativeTo: "Ghost" };
    expect(validatePlan(p).errors.some((e) => /Unknown alignment reference/.test(e.message))).toBe(true);
  });
  it("warns about low text contrast", () => {
    const p = structuredClone(SAMPLE);
    p.elements[0]!.color = "#E0D5C5";
    expect(validatePlan(p).warnings.some((w) => /contrast/.test(w.message))).toBe(true);
  });
});

describe("compiler", () => {
  it("converts units to points, circles to ellipse boxes, resolves palette and adds a locked background", () => {
    const c = compilePlan(validatePlan(SAMPLE).plan!);
    expect(c.width).toBeCloseTo(595.28, 1);
    expect(c.layers).toEqual(["Typography", "Graphics", "Background"]);
    const bg = c.elements[0]!;
    expect(bg).toMatchObject({ name: "Background", layer: "Background", locked: true });
    const circle = c.elements.find((e) => e.name === "Decorative Element")!;
    expect(circle.type).toBe("ellipse");
    expect(circle.x).toBeCloseTo((100 - 40) * (72 / 25.4), 3);
    expect(circle.width).toBeCloseTo(80 * (72 / 25.4), 3);
    expect((circle.fill as { hex: string }).hex).toBe("#C6A98A");
    const text = c.elements.find((e) => e.name === "Headline")!;
    expect(text.fontSize).toBe(48); // font sizes are always points
    expect(text.font).toEqual(["Arial"]);
    expect(c.swatches.length).toBe(3);
  });
  it("resolves artboard-relative alignment", () => {
    const p = structuredClone(SAMPLE) as typeof SAMPLE & { elements: Record<string, unknown>[] };
    p.elements[1]!.align = { relativeTo: "artboard", horizontal: "center", vertical: "middle" };
    const c = compilePlan(validatePlan(p).plan!);
    const circle = c.elements.find((e) => e.name === "Decorative Element")!;
    const mm = 72 / 25.4;
    expect(Number(circle.x) + Number(circle.width) / 2).toBeCloseTo(105 * mm, 3);
    expect(Number(circle.y) + Number(circle.height) / 2).toBeCloseTo(148.5 * mm, 3);
  });
  it("orders elements by z", () => {
    const p = structuredClone(SAMPLE) as typeof SAMPLE & { elements: Record<string, unknown>[] };
    p.elements[0]!.z = 5;
    const names = compilePlan(validatePlan(p).plan!).elements.map((e) => e.name);
    expect(names).toEqual(["Background", "Decorative Element", "Headline"]);
  });
});

describe("planner", () => {
  it("analyzes the reference brief", () => {
    const a = analyzeBrief("Create a modern luxury skincare poster with a minimalist layout, beige background, elegant typography and a product image.");
    expect(a.category).toBe("poster");
    expect(a.style).toBe("luxury");
    expect(a.audience).toBe("luxury consumers");
    expect(a.wantsImage).toBe(true);
  });
  it("uses brief colors for the background and keeps text readable", () => {
    const p = paletteFromBrief("poster with a navy background and gold accents", "modern");
    expect(p.colors.background).toBe("#14213D");
    expect(contrastRatio(p.colors.text, p.colors.background)).toBeGreaterThanOrEqual(4.5);
  });
  it("detects sizes", () => {
    expect(analyzeBrief("an A3 landscape poster").size).toEqual({ width: 420, height: 297, units: "mm" });
    expect(analyzeBrief("banner 1200x628 px").size).toEqual({ width: 1200, height: 628, units: "px" });
  });
  it("produces a valid plan for every template in every style", () => {
    for (const t of TEMPLATES) for (const style of STYLES) {
      const { plan } = planDesign({ brief: `a ${style} ${t.category} for Acme Coffee`, template: t.id, style });
      expect(validatePlan(plan).valid, `${t.id}/${style}`).toBe(true);
      expect(plan.elements.length).toBeGreaterThan(2);
      expect(compilePlan(plan).elements.length).toBeGreaterThan(2);
    }
  });
  it("uses quoted copy and flags missing images", () => {
    const { plan } = planDesign({ brief: 'luxury skincare poster with a product image, headline "PURE BEAUTY" and "Radiance, refined"' });
    const head = plan.elements.find((e) => e.name === "Headline");
    expect(head && head.type === "text" && head.content).toBe("PURE BEAUTY");
    expect(plan.elements.some((e) => e.role === "image-placeholder")).toBe(true);
    expect(plan.meta.rationale?.join(" ")).toMatch(/placeholder/);
  });
  it("generates comparable variations", () => {
    const v = planVariations({ brief: "modern poster for a jazz festival" }, 3);
    expect(v).toHaveLength(3);
    expect(new Set(v.map((x) => x.label)).size).toBe(3);
  });
  it("builds palettes and type scales", () => {
    const p = generatePalette("#1F5FAD", "triadic");
    expect(Object.keys(p.colors)).toEqual(["background", "surface", "primary", "secondary", "accent", "text", "muted"]);
    expect(contrastRatio(p.colors.text, p.colors.background)).toBeGreaterThan(7);
    const s = typeScale(10, 1.5);
    expect(s.h1).toBeCloseTo(33.8, 1);
  });
});

describe("revision", () => {
  const base = planDesign({ brief: 'luxury skincare poster "PURE BEAUTY"' }).plan;

  it("parses common instructions and reports the rest", () => {
    const r = parseInstructions(base, "make the headline bigger. change background to navy. reticulate the splines");
    expect(r.applied).toHaveLength(2);
    expect(r.unapplied).toEqual(["reticulate the splines"]);
    expect(r.req.palette!.background).toBe("#14213D");
  });
  it("creates targeted ops instead of a rebuild", () => {
    const rev = revisePlan(base, { instructions: "make the headline bigger", updates: [{ name: "Footer Band", fill: "#000000" }], remove: ["Divider"] });
    expect(rev.requiresRebuild).toBe(false);
    expect(rev.diff.changed.map((c) => c.name).sort()).toEqual(["Footer Band", "Headline"]);
    const ops = revisionOps(base, rev.plan, rev.diff);
    const head = ops.updates.find((u) => u.name === "Headline")!;
    expect(head.fontSize).toBeCloseTo(60, 0);
    expect(ops.removals).toEqual(["Divider"]);
    expect(ops.additions).toBeUndefined();
  });
  it("propagates palette changes to every element using the role", () => {
    const rev = revisePlan(base, { palette: { primary: "#123456" } });
    const ops = revisionOps(base, rev.plan, rev.diff);
    expect(ops.updates.find((u) => u.name === "Footer Band")?.fill).toMatchObject({ hex: "#123456" });
  });
  it("rejects unknown element names", () => {
    expect(() => revisePlan(base, { updates: [{ name: "Nope", x: 1 }] })).toThrow(/No element/);
  });
  it("stores versions and diffs them", () => {
    const store = new PlanStore(mkdtempSync(join(tmpdir(), "plans-")));
    const v1 = store.save(base);
    const v2 = store.save(revisePlan(base, { remove: ["Divider"] }).plan, { id: v1.id });
    expect(v2.version).toBe(2);
    expect(diffPlans(store.get(v1.id, 1).plan, store.get(v1.id).plan).removed).toEqual(["Divider"]);
    expect(() => store.get("../etc")).toThrow(/Invalid plan id/);
  });
});

describe("composition analyzer", () => {
  const ab = { width: 600, height: 800 };
  it("finds misalignment, margin, contrast, hierarchy and overlap problems with fixes", () => {
    const report = analyzeComposition([
      { name: "Background", type: "PathItem", bounds: { x: 0, y: 0, width: 600, height: 800 }, fill: { hex: "#FFFFFF" } },
      { name: "Title", type: "TextFrame", bounds: { x: 60, y: 100, width: 300, height: 40 }, fontSize: 20, fill: { hex: "#111111" }, font: "Arial" },
      { name: "Sub", type: "TextFrame", bounds: { x: 63, y: 160, width: 200, height: 20 }, fontSize: 18, fill: { hex: "#DDDDDD" }, font: "Arial" },
      { name: "Edge", type: "TextFrame", bounds: { x: 5, y: 700, width: 100, height: 12 }, fontSize: 5, fill: { hex: "#111111" }, font: "Arial" },
      { name: "Overlap", type: "TextFrame", bounds: { x: 70, y: 110, width: 50, height: 10 }, fontSize: 9, fill: { hex: "#111111" }, font: "Arial" },
    ], ab);
    const cats = new Set(report.findings.map((f) => f.category));
    for (const c of ["alignment", "margins", "color", "hierarchy", "typography", "overlap"]) expect(cats.has(c as never), c).toBe(true);
    expect(report.source).toBe("verified-document-properties");
    expect(report.score).toBeLessThan(100);
    const align = report.findings.find((f) => f.category === "alignment" && f.targets[0] === "Sub")!;
    expect(align.fix![0]).toEqual({ name: "Sub", x: 60 });
  });
  it("gives a clean layout a perfect score", () => {
    const report = analyzeComposition([
      { name: "Title", type: "TextFrame", bounds: { x: 100, y: 100, width: 400, height: 60 }, fontSize: 48, fill: { hex: "#111111" } },
      { name: "Body", type: "TextFrame", bounds: { x: 100, y: 200, width: 400, height: 20 }, fontSize: 12, fill: { hex: "#111111" } },
      { name: "Shape", type: "PathItem", bounds: { x: 100, y: 300, width: 400, height: 400 }, fill: { hex: "#C6A98A" } },
    ], ab);
    expect(report.findings).toEqual([]);
    expect(report.score).toBe(100);
  });
});

describe("UI: auto layout, components, naming", () => {
  it("routes UI briefs to UI templates", () => {
    expect(planDesign({ brief: "a sign in screen for a mobile app" }).plan.meta.template).toBe("mobile-login");
    expect(planDesign({ brief: "settings screen for an iOS app" }).plan.meta.template).toBe("mobile-settings");
    expect(planDesign({ brief: "a SaaS landing page" }).plan.meta.template).toBe("landing-page");
    expect(planDesign({ brief: "an admin dashboard for orders" }).plan.meta.template).toBe("web-dashboard");
    expect(planDesign({ brief: "a design system ui kit" }).plan.meta.template).toBe("ui-kit");
    expect(planDesign({ brief: "low-fidelity wireframe of a mobile app home screen" }).plan.meta.style).toBe("wireframe");
    expect(analyzeBrief("a poster for a jazz studios night").category).toBe("poster");
  });

  it("every UI template validates without contrast warnings", () => {
    for (const t of TEMPLATES.filter((x) => ["mobile-app", "landing-page", "web-dashboard", "ui-kit"].includes(x.category))) {
      const r = planDesign({ brief: "test", template: t.id, style: "modern" });
      expect(r.plan.elements.length, t.id).toBeGreaterThan(10);
      expect(r.warnings.filter((w) => /contrast/.test(w)), t.id).toEqual([]);
    }
  });

  it("stacks children with gap and padding, fill and spacer", () => {
    const r = validatePlan({
      document: { width: 400, height: 800, units: "px" }, layers: [{ name: "UI" }],
      palette: { colors: { background: "#FFFFFF", text: "#111111", primary: "#1F4E79", surface: "#EEEEEE", muted: "#999999" } },
      elements: [],
      autoLayout: [{ type: "stack", name: "Root", width: "fill", height: "fill", padding: 20, gap: 10, children: [
        { type: "rect", name: "A", width: "fill", height: 50 },
        { type: "rect", name: "B", width: 100, height: 30 },
        { type: "spacer" },
        { type: "stack", name: "Row", direction: "horizontal", gap: 10, width: "fill", fill: "palette.surface", children: [
          { type: "rect", name: "C", width: "fill", height: 40 },
          { type: "rect", name: "D", width: "fill", height: 40 },
        ] },
      ] }],
    });
    expect(r.errors).toEqual([]);
    const p = r.plan!;
    const get = (n: string) => p.elements.find((e) => e.name === n) as unknown as { x: number; y: number; width: number; height: number };
    expect(get("A")).toMatchObject({ x: 20, y: 20, width: 360, height: 50 });
    expect(get("B")).toMatchObject({ x: 20, y: 80, width: 100 });
    expect(get("Row")).toMatchObject({ x: 20, y: 740, width: 360, height: 40 }); // spacer pushes the row to the bottom
    expect(get("C")).toMatchObject({ x: 20, width: 175 });
    expect(get("D")).toMatchObject({ x: 205, width: 175 });
    expect(p.palette.colors.subtle).toBeDefined();
  });

  it("expands components with prefixed part names and token sizes", () => {
    const { plan } = planDesign({ brief: "a login screen for a mobile app" });
    const get = (n: string) => plan.elements.find((e) => e.name === n) as unknown as { x: number; width: number };
    expect(get("Sign In").width).toBeCloseTo(390 - 48);
    expect(get("Sign In / Label").x).toBeCloseTo(get("Sign In").x + get("Sign In").width / 2); // centered point text
    const r = validatePlan({ document: { width: 100, height: 100, units: "px" }, layers: [{ name: "UI" }], elements: [], autoLayout: [{ type: "stack", name: "S", gap: "huge", children: [] }] });
    expect(r.valid).toBe(false);
    expect(r.errors[0]!.message).toMatch(/spacing token "huge"/);
  });

  it("warns when stack content overflows its frame", () => {
    const r = validatePlan({ document: { width: 100, height: 100, units: "px" }, layers: [{ name: "UI" }], elements: [],
      autoLayout: [{ type: "stack", name: "Tight", width: 100, height: 50, children: [{ type: "rect", name: "Big", width: 50, height: 80 }] }] });
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.message).join(" ")).toMatch(/overflows the height by 30/);
  });

  it("suggests semantic names for generic objects only", () => {
    const s = suggestLayerNames([
      { name: "", type: "PathItem", bounds: { x: 0, y: 0, width: 400, height: 800 } },
      { name: "<Path>", type: "PathItem", bounds: { x: 20, y: 700, width: 200, height: 48 } },
      { name: "", type: "TextFrame", bounds: { x: 60, y: 712, width: 80, height: 20 }, contents: "Get started", fontSize: 16 },
      { name: "", type: "TextFrame", bounds: { x: 20, y: 100, width: 300, height: 40 }, contents: "Welcome back", fontSize: 32 },
      { name: "Hero", type: "PathItem", bounds: { x: 0, y: 0, width: 50, height: 50 } },
    ], { width: 400, height: 800 });
    expect(s.map((x) => x.to)).toEqual(["Background", "Button / Get started", "Button Label / Get started", "Heading / Welcome back"]);
  });
});

describe("UI/UX Pro Max knowledge", () => {
  it("parses quoted CSV fields with commas, quotes and newlines", () => {
    expect(parseCsv('a,b\n1,"x, ""y""\nz"\n')).toEqual([{ a: "1", b: 'x, "y"\nz' }]);
  });

  it("loads every vendored table", () => {
    expect(rows("product").length).toBeGreaterThan(150);
    expect(rows("color").length).toBe(rows("product").length);
    expect(rows("typography").length).toBeGreaterThan(50);
    expect(search("style", "glassmorphism", 1)[0]!.row["Style Category"]).toBe("Glassmorphism");
  });

  it("matches products on business words, not on UI words", () => {
    expect(recommendDesignSystem("login screen for a fintech banking app").product?.["Product Type"]).toBe("Fintech/Crypto");
    expect(recommendDesignSystem("a recipe app").product?.["Product Type"]).toBe("Recipe & Cooking App");
    expect(recommendDesignSystem("sign in screen for a mobile app").confidence).not.toBe("high");
  });

  it("applies the product palette and fonts to UI briefs, contrast-clean for every product", () => {
    const { plan } = planDesign({ brief: "landing page for a fintech payments startup" });
    expect(plan.palette.name).toMatch(/UI\/UX Pro Max/);
    expect(plan.meta.rationale?.join(" ")).toMatch(/Avoid:/);
    expect(planDesign({ brief: "landing page for a fintech startup", style: "playful" }).plan.palette.name).not.toMatch(/Pro Max/);
    for (const r of rows("product")) {
      const out = planDesign({ brief: r["Product Type"]!, template: "mobile-home" });
      expect(out.warnings.filter((w) => /contrast/.test(w)), r["Product Type"]).toEqual([]);
    }
  });
});
