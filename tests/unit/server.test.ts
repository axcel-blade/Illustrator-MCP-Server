import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/index.js";
import { MockAdapter } from "../../src/illustrator/bridge/mock-adapter.js";
import { createContext, createServer } from "../../src/server.js";

const REQUIRED_TOOLS = `illustrator_status create_document open_document close_document save_document save_document_as inspect_document get_artboards create_artboard resize_artboard set_document_units set_document_color_mode
draw_rectangle draw_circle draw_ellipse draw_polygon draw_star draw_line draw_pen_path draw_freeform_path create_compound_path create_clipping_mask create_symbol create_pattern
add_text edit_text set_font set_font_size set_font_weight set_text_color set_paragraph_alignment set_character_spacing set_line_spacing create_text_on_path convert_text_to_outlines inspect_fonts
set_fill_color set_gradient set_stroke set_opacity set_blend_mode apply_shadow apply_blur apply_appearance create_color_palette create_color_swatches apply_color_palette
select_objects inspect_selection move_object resize_object rotate_object duplicate_object delete_object group_objects ungroup_objects lock_objects hide_objects rename_object set_object_z_order distribute_objects transform_objects
align_objects arrange_objects center_on_artboard create_grid create_guides apply_margins create_layout balance_composition calculate_object_bounds create_layout_guides
create_layer delete_layer rename_layer select_layer move_object_to_layer lock_layer hide_layer inspect_layers reorder_layers
export_png export_jpg export_svg export_pdf export_eps export_multiple_formats generate_export_preview
generate_design create_logo create_poster create_flyer create_social_media_graphic create_business_card create_brand_identity create_packaging_design create_infographic create_icon_set create_vector_illustration create_editorial_layout revise_design analyze_composition critique_design improve_design generate_design_variations
create_app_screen create_landing_page create_web_dashboard create_ui_kit list_ui_components get_design_tokens create_ui_design rename_layers_semantically search_design_knowledge recommend_design_system`.split(/\s+/);

let client: Client;
let mock: MockAdapter;
let outDir: string;

type ToolResult = { isError?: boolean; content: { type: string; text?: string }[] };
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as ToolResult;
  return { isError: Boolean(r.isError), body: JSON.parse(r.content[0]!.text!) as Record<string, any>, content: r.content };
};

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mcp-out-"));
  const config = loadConfig({ ILLUSTRATOR_ADAPTER: "mock", ALLOWED_PATHS: outDir, LOG_LEVEL: "error" }, []);
  mock = new MockAdapter();
  const ctx = createContext(config, mock);
  const server = createServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
});

afterAll(async () => client.close());

describe("MCP server", () => {
  it("registers every required tool with a description and object schema", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(REQUIRED_TOOLS.filter((t) => !names.includes(t))).toEqual([]);
    for (const t of tools) {
      expect(t.description?.length, t.name).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe("object");
    }
  });

  it("exposes resources and prompts", async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain("illustrator://schema/design-plan");
    const schema = await client.readResource({ uri: "illustrator://schema/design-plan" });
    expect(JSON.parse((schema.contents[0] as { text: string }).text).properties.elements.type).toBe("array");
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain("design_from_brief");
  });

  it("validates input and returns structured errors", async () => {
    const r = (await client.callTool({ name: "draw_rectangle", arguments: { x: 0, y: 0, width: -5, height: 10 } })) as ToolResult;
    expect(r.isError).toBe(true);
    expect((r.content[0] as { text: string }).text).toMatch(/width/);
    const bad = (await client.callTool({ name: "set_fill_color", arguments: { target: { name: "a" }, color: "red" } })) as ToolResult;
    expect(bad.isError).toBe(true);
  });

  it("labels mock results so they cannot be mistaken for real Illustrator output", async () => {
    const r = await call("create_document", { preset: "A4", name: "Test" });
    expect(r.isError).toBe(false);
    expect(r.body.source).toBe("mock");
    expect(r.body.warnings[0]).toMatch(/MOCK ADAPTER/);
    expect(mock.calls.at(-1)).toMatchObject({ op: "create_document", args: { width: expect.closeTo(595.28, 1), height: expect.closeTo(841.89, 1) } });
  });

  it("converts units at the tool boundary", async () => {
    await call("draw_circle", { cx: 1, cy: 1, radius: 0.5, units: "in", name: "Dot" });
    expect(mock.calls.at(-1)).toMatchObject({ op: "draw_ellipse", args: { x: 36, y: 36, width: 72, height: 72, name: "Dot" } });
  });

  it("requires confirmation for destructive operations", async () => {
    const r = await call("delete_object", { target: { name: "Dot" } });
    expect(r.isError).toBe(true);
    expect(r.body.error.code).toBe("CONFIRMATION_REQUIRED");
    const before = mock.calls.length;
    await call("delete_layer", { name: "Layer 1" });
    expect(mock.calls.length).toBe(before);
    expect((await call("delete_object", { target: { name: "Dot" }, confirm: true })).isError).toBe(false);
  });

  it("enforces path restrictions and overwrite protection", async () => {
    const outside = await call("save_document_as", { path: "C:\\Windows\\evil.ai" });
    expect(outside.body.error.code).toBe("PATH_NOT_ALLOWED");
    writeFileSync(join(outDir, "taken.ai"), "x");
    expect((await call("save_document_as", { path: "taken.ai" })).body.error.code).toBe("FILE_EXISTS");
    expect((await call("save_document_as", { path: "notes.txt" })).body.error.code).toBe("VALIDATION_ERROR");
    expect((await call("place_image", { path: "missing.png" })).body.error.code).toBe("FILE_NOT_FOUND");
  });

  it("propagates Illustrator errors truthfully", async () => {
    mock.on("draw_star", { ok: false, error: { code: "NO_ACTIVE_DOCUMENT", message: "No document is open in Illustrator." } });
    const r = await call("draw_star", { cx: 1, cy: 1, radius: 10, innerRadius: 5 });
    expect(r.isError).toBe(true);
    expect(r.body.error.code).toBe("NO_ACTIVE_DOCUMENT");
  });

  it("plans without touching Illustrator", async () => {
    const before = mock.calls.length;
    const r = await call("plan_design", { brief: "Create a modern luxury skincare poster with a minimalist layout, beige background, elegant typography and a product image." });
    expect(r.isError).toBe(false);
    expect(r.body.source).toBe("server");
    expect(r.body.data.plan.meta.category).toBe("poster");
    expect(r.body.data.plan.palette.colors.background).toBe("#E9DDCC");
    expect(mock.calls.length).toBe(before);
  });

  it("runs the full generate -> analyze -> revise loop", async () => {
    const gen = await call("generate_design", { brief: 'minimalist poster for "Studio Nine"', preview: true });
    expect(gen.isError).toBe(false);
    expect(gen.body.data.verification.missing).toEqual([]);
    expect(gen.body.data.preview.imageAttached).toBe(false); // mock writes no PNG
    expect(gen.body.warnings.join(" ")).toMatch(/no visual inspection/i);
    expect(gen.content.some((c) => c.type === "image")).toBe(false);

    const analysis = await call("analyze_composition");
    expect(analysis.body.data.source).toBe("verified-document-properties");

    const critique = await call("critique_design");
    expect(critique.body.data.visualAssessment.status).toBe("unavailable");

    const rev = await call("revise_design", { planId: gen.body.data.planId, instructions: "make the headline bigger", preview: false });
    expect(rev.isError).toBe(false);
    expect(rev.body.data.toVersion).toBe(2);
    const update = mock.calls.filter((c) => c.op === "update_elements").at(-1)!;
    expect((update.args as { updates: { name: string }[] }).updates.map((u) => u.name)).toContain("Headline");
    expect(mock.calls.filter((c) => c.op === "execute_plan")).toHaveLength(1); // targeted, no rebuild

    const cmp = await call("compare_design_versions", { planId: gen.body.data.planId, from: 1, to: 2 });
    expect(cmp.body.data.changed[0].name).toBe("Headline");
  });

  it("builds a UI screen from an auto-layout tree", async () => {
    const r = await call("create_ui_design", {
      name: "Checkout", frame: "iphone-15", style: "modern", preview: false,
      layout: [{ type: "stack", name: "Screen", width: "fill", height: "fill", padding: "lg", gap: "md", children: [
        { type: "text", name: "Title", content: "Checkout", fontSize: "heading", weight: "bold" },
        { type: "component", name: "Card Number", component: "input", props: { label: "Card number", placeholder: "1234 5678" } },
        { type: "spacer" },
        { type: "component", name: "Pay", component: "button", props: { label: "Pay now" }, width: "fill" },
      ] }],
    });
    expect(r.isError).toBe(false);
    expect(r.body.data.verification.missing).toEqual([]);
    const built = mock.calls.filter((c) => c.op === "execute_plan").at(-1)!.args as { elements: { name: string }[] };
    expect(built.elements.map((e) => e.name)).toEqual(expect.arrayContaining(["Title", "Card Number / Field", "Pay", "Pay / Label"]));

    const bad = await call("create_ui_design", { execute: false, layout: [{ type: "component", name: "X", component: "nope" }] });
    expect(bad.isError).toBe(true);
  });

  it("creates app screens from a brief and renames generic layers", async () => {
    const r = await call("create_app_screen", { brief: 'login screen for a banking app called "Vault"', preview: false });
    expect(r.isError).toBe(false);
    expect(r.body.data.analysis.category).toBe("mobile-app");
    const tokens = await call("get_design_tokens", { style: "playful" });
    expect(tokens.body.data.palette.colors.subtle).toMatch(/^#/);
    const comps = await call("list_ui_components");
    expect(comps.body.data.components.map((c: { id: string }) => c.id)).toContain("tab-bar");
    const dry = await call("rename_layers_semantically", { dryRun: true });
    expect(dry.isError).toBe(false);
    expect(Array.isArray(dry.body.data.suggestions)).toBe(true);
  });

  it("serves UI/UX Pro Max knowledge and applies it to UI designs", async () => {
    const s = await call("search_design_knowledge", { domain: "ux", query: "touch target size" });
    expect(s.body.data.results[0].row.Issue).toBe("Touch Target Size");
    const rec = await call("recommend_design_system", { brief: "telemedicine platform for clinics" });
    expect(rec.body.data.product["Product Type"]).toBe("Telemedicine Platform");
    expect(rec.body.data.palette.colors.onPrimary).toMatch(/^#/);
    const ui = await call("create_ui_design", { execute: false, product: "fintech payments", layout: [{ type: "component", name: "Go", component: "button" }] });
    expect(ui.body.data.plan.palette.name).toMatch(/Fintech/);
  });

  it("generates variations as plans", async () => {
    const r = await call("generate_design_variations", { brief: "a playful flyer for a kids art camp", count: 2 });
    expect(r.body.data.variations).toHaveLength(2);
  });

  it("reports status from detection without claiming a probe", async () => {
    const r = await call("illustrator_status");
    expect(r.body.source).toBe("server");
    expect(r.body.data.adapter).toBe("mock");
  });
});
