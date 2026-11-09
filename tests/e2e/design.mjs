/**
 * Phase 5: builds the "AI MCP Integration Test" design in the REAL Illustrator through MCP tools,
 * saves test-output/illustrator-mcp-test.ai and exports SVG/PNG/PDF, verifying each file on disk.
 */
import { existsSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { connect, OUT } from "./lib.mjs";

const { client, call } = await connect();
const log = [];
async function must(tool, args) {
  const r = await call(tool, args);
  log.push({ tool, ok: r.body.ok, source: r.body.source, error: r.body.error, warnings: r.body.warnings });
  if (!r.body.ok || r.body.source !== "illustrator") throw new Error(`${tool} failed: ${JSON.stringify(r.body.error ?? r.body)}`);
  return r.body.data;
}
const base = join(OUT, "illustrator-mcp-test");
for (const ext of [".ai", ".svg", ".png", ".pdf"]) rmSync(base + ext, { force: true });

const W = 1200, C = W / 2, U = { units: "px" };
const NAVY = "#0B1330", LINE = "#24325E", CYAN = "#3FE0FF", MAGENTA = "#FF3D9A", GOLD = "#FFC94D", WHITE = "#FFFFFF";

await must("create_document", { name: "AI MCP Integration Test", width: W, height: W, units: "px", colorMode: "RGB" });
await must("rename_layer", { name: "Layer 1", newName: "Background" });
await must("create_layer", { name: "Artwork" });
await must("create_layer", { name: "Typography" });

/* Background layer */
await must("draw_rectangle", { ...U, name: "Background Fill", x: 0, y: 0, width: W, height: W, fill: NAVY, stroke: "none", layer: "Background" });
await must("create_grid", { ...U, name: "Background Grid", x: 0, y: 0, width: W, height: W, cellWidth: 60, cellHeight: 60, color: "#16214A", strokeWidth: 1, layer: "Background" });

/* Artwork layer: concentric geometry around a gradient hero circle */
const CY = 450;
await must("draw_circle", { ...U, name: "Orbit Outer", cx: C, cy: CY, radius: 330, fill: "none", stroke: { color: LINE, width: 2, dashes: [4, 10] }, layer: "Artwork" });
await must("draw_circle", { ...U, name: "Orbit Inner", cx: C, cy: CY, radius: 270, fill: "none", stroke: { color: LINE, width: 2 }, layer: "Artwork" });
await must("draw_circle", { ...U, name: "Hero Gradient", cx: C, cy: CY, radius: 200, fill: MAGENTA, stroke: "none", layer: "Artwork" });
await must("set_gradient", { target: { name: "Hero Gradient" }, type: "linear", angle: 45, name: "MCP Spectrum",
  stops: [{ color: MAGENTA, position: 0 }, { color: "#8A5CFF", position: 50 }, { color: CYAN, position: 100 }] });
await must("draw_polygon", { ...U, name: "Hexagon Frame", cx: C, cy: CY, radius: 150, sides: 6, fill: "none", stroke: { color: WHITE, width: 3 }, layer: "Artwork" });
await must("draw_polygon", { ...U, name: "Triangle Core", cx: C, cy: CY + 10, radius: 80, sides: 3, fill: NAVY, stroke: "none", layer: "Artwork" });
await must("set_opacity", { target: { name: "Triangle Core" }, opacity: 85 });
await must("draw_star", { ...U, name: "Core Star", cx: C, cy: CY + 18, radius: 30, innerRadius: 12, points: 4, fill: GOLD, stroke: "none", layer: "Artwork" });

/* satellites on the outer orbit */
const sats = [
  { name: "Satellite Square", tool: "draw_rectangle", args: { x: C - 330 - 22, y: CY - 22, width: 44, height: 44, fill: CYAN } },
  { name: "Satellite Circle", tool: "draw_circle", args: { cx: C + 330, cy: CY, radius: 22, fill: MAGENTA } },
  { name: "Satellite Pentagon", tool: "draw_polygon", args: { cx: C, cy: CY - 330, radius: 26, sides: 5, fill: GOLD } },
  { name: "Satellite Star", tool: "draw_star", args: { cx: C, cy: CY + 330, radius: 26, innerRadius: 11, points: 5, fill: WHITE } },
];
for (const s of sats) await must(s.tool, { ...U, name: s.name, stroke: "none", layer: "Artwork", ...s.args });
await must("rotate_object", { target: { name: "Satellite Square" }, angle: 45 });
await must("group_objects", { targets: sats.map((s) => ({ name: s.name })), name: "Satellites" });

/* corner accents: duplicated diamonds */
await must("draw_rectangle", { ...U, name: "Accent", x: 80, y: 80, width: 18, height: 18, fill: CYAN, stroke: "none", layer: "Artwork" });
await must("rotate_object", { target: { name: "Accent" }, angle: 45 });
await must("duplicate_object", { target: { name: "Accent" }, copies: 2, dx: 30, dy: 0, name: "Accent Copy" });
await must("draw_rectangle", { ...U, name: "Accent R", x: W - 98, y: 80, width: 18, height: 18, fill: MAGENTA, stroke: "none", layer: "Artwork" });
await must("rotate_object", { target: { name: "Accent R" }, angle: 45 });
await must("duplicate_object", { target: { name: "Accent R" }, copies: 2, dx: -30, dy: 0, name: "Accent R Copy" });

/* Typography layer: centered stack under the artwork */
const font = ["Arial-BoldMT", "Arial"];
await must("add_text", { ...U, name: "Heading", content: "ADOBE ILLUSTRATOR MCP", x: C, y: 860, font, fontSize: 64, color: WHITE, align: "center", tracking: 40, layer: "Typography" });
await must("draw_line", { ...U, name: "Divider", x1: C - 160, y1: 965, x2: C + 160, y2: 965, stroke: { color: CYAN, width: 3, cap: "round" }, layer: "Typography" });
await must("add_text", { ...U, name: "Subtitle", content: "AI-POWERED VECTOR DESIGN", x: C, y: 995, font: ["ArialMT", "Arial"], fontSize: 30, color: CYAN, align: "center", tracking: 320, layer: "Typography" });
await must("add_text", { ...U, name: "Footer", content: "AI MCP INTEGRATION TEST  ·  ADOBE ILLUSTRATOR 2026", x: C, y: 1125, font: ["ArialMT", "Arial"], fontSize: 15, color: "#6F7FB0", align: "center", tracking: 200, layer: "Typography" });
for (const n of ["Heading", "Divider", "Subtitle", "Footer"]) await must("center_on_artboard", { target: { name: n }, axis: "horizontal" });

/* verification by inspection */
const info = await must("inspect_document", { deep: true, limit: 500 });
const names = info.items.map((i) => i.name);
const required = ["Background Fill", "Hero Gradient", "Hexagon Frame", "Satellites", "Heading", "Subtitle", "Divider"];
const missing = required.filter((n) => !names.includes(n));
const layerNames = info.layers.map((l) => l.name);
if (missing.length || !["Background", "Artwork", "Typography"].every((l) => layerNames.includes(l))) throw new Error(`verification failed: missing ${missing} layers ${layerNames}`);
const ab = info.artboards[0];
if (Math.abs(ab.width - W) > 0.5 || Math.abs(ab.height - W) > 0.5) throw new Error(`artboard ${ab.width}x${ab.height}`);

await must("save_document_as", { path: base + ".ai", overwrite: true });
await must("export_svg", { path: base + ".svg", overwrite: true });
await must("export_png", { path: base + ".png", overwrite: true, ppi: 72, transparent: false });
await must("export_pdf", { path: base + ".pdf", overwrite: true });
const after = await must("inspect_document", {});

const files = Object.fromEntries([".ai", ".svg", ".png", ".pdf"].map((e) => [e, existsSync(base + e) ? statSync(base + e).size : 0]));
const summary = { artboard: `${ab.width}x${ab.height}`, layers: layerNames, objects: names.length, files, workingFile: after.path, saved: after.saved };
writeFileSync(join(OUT, "design-results.json"), JSON.stringify({ summary, log }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (Object.values(files).some((b) => b === 0)) process.exitCode = 1;
await client.close();
