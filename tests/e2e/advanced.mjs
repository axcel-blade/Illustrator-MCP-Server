/**
 * End-to-end test of the advanced tools (pathfinder, anchor editing, path utilities, image trace/relink,
 * artboards, documents, undo/redo, typography roles, design systems) against the REAL Illustrator.
 *   pnpm build && node tests/e2e/advanced.mjs
 * Works only inside a new document it creates and closes; other open documents are not touched.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { connect, OUT } from "./lib.mjs";

const results = [];
const rec = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail).slice(0, 500)}`);
};
const { client, call } = await connect();
async function step(name, tool, args, verify) {
  const r = await call(tool, args);
  if (r.isError || !r.body.ok || r.body.source !== "illustrator") { rec(name, false, r.body.error ?? r.body); return r.body; }
  let v;
  try { v = verify ? await verify(r.body.data, r.body) : true; } catch (e) { v = String(e); }
  rec(name, v === true, v);
  return r.body;
}
const must = async (tool, args) => { const r = await call(tool, args); if (r.isError || !r.body.ok) rec(`setup ${tool} ${args.name ?? ""}`, false, r.body); if (process.env.DBG) console.log("   ", tool, JSON.stringify(r.body).slice(0, 160)); return r; };
const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
const items = async () => (await call("inspect_document", { deep: true, limit: 500 })).body.data?.items ?? [];
const find = async (n) => (await items()).find((i) => i.name === n);

mkdirSync(OUT, { recursive: true });
const DOC = `mcp-advanced-${Date.now()}`;
await step("create test document", "create_document", { name: DOC, width: 600, height: 400 }, (d) => d.name?.startsWith(DOC) || d.document?.name?.startsWith(DOC) || true);

/* ---- pathfinder ---- */
for (const [operation, check] of [
  ["unite", (d) => d.type === "PathItem" && d.pointCount > 4 || `got ${d.type}`],
  ["minusFront", (d) => d.type === "PathItem" || `got ${d.type}`],
  ["intersect", (d) => d.type === "PathItem" || `got ${d.type}`],
  ["exclude", (d) => d.type === "GroupItem" || d.type === "CompoundPathItem" || `got ${d.type}`],
  ["divide", (d) => d.type === "GroupItem" && d.childCount >= 3 || `got ${d.type} ${d.childCount}`],
]) {
  await must("draw_rectangle", { x: 20, y: 20, width: 100, height: 100, name: `A-${operation}`, fill: "#2F80ED" });
  await must("draw_circle", { cx: 120, cy: 120, radius: 50, name: `B-${operation}`, fill: "#0B1F3A" });
  await step(`pathfinder ${operation}`, "pathfinder", { operation, targets: [{ name: `A-${operation}` }, { name: `B-${operation}` }], name: `PF-${operation}` }, check);
  const left = (await items()).filter((i) => i.name === `A-${operation}` || i.name === `B-${operation}`);
  rec(`pathfinder ${operation} consumed operands`, left.length === 0, left.map((i) => i.name));
  await call("delete_object", { targets: [{ name: `PF-${operation}` }], confirm: true });
}

/* ---- flip ---- */
await must("draw_pen_path", { points: [{ x: 300, y: 50 }, { x: 400, y: 50 }, { x: 300, y: 150 }], closed: true, name: "Tri", fill: "#FF8800" });
await step("flip horizontal keeps bounds", "flip_objects", { targets: [{ name: "Tri" }], axis: "horizontal" },
  (d) => near(d.items[0].bounds.x, 300) && near(d.items[0].bounds.width, 100) || d.items[0].bounds);
await step("flip moved the right-angle corner to the right", "edit_path_points", { target: { name: "Tri" }, action: "list" },
  (d) => d.points.some((p) => near(p.x, 400) && near(p.y, 150)) || d.points);

/* ---- anchor editing ---- */
await must("draw_line", { x1: 20, y1: 300, x2: 220, y2: 300, name: "Line", stroke: { color: "#000000", width: 2 } });
await step("add point at segment midpoint", "edit_path_points", { target: { name: "Line" }, action: "add", index: 0 },
  (d) => d.points.length === 3 && near(d.points[1].x, 120) && near(d.points[1].y, 300) || d.points);
await step("move point (handles follow)", "edit_path_points", { target: { name: "Line" }, action: "move", index: 1, x: 120, y: 250 },
  (d) => near(d.points[1].y, 250) && near(d.points[1].in[1], 250) || d.points[1]);
await step("set smooth handles", "edit_path_points", { target: { name: "Line" }, action: "set_handles", index: 1, in: [80, 250], out: [160, 250], pointType: "smooth" },
  (d) => d.points[1].type === "smooth" && near(d.points[1].out[0], 160) || d.points[1]);
await step("convert to corner", "edit_path_points", { target: { name: "Line" }, action: "convert", index: 1, pointType: "corner" },
  (d) => d.points[1].type === "corner" && near(d.points[1].out[0], 120) || d.points[1]);
await step("reverse path", "reverse_path", { target: { name: "Line" } }, (d) => near(d.points[0].x, 220) && near(d.points[2].x, 20) || d.points);
await step("remove point", "edit_path_points", { target: { name: "Line" }, action: "remove", index: 1 }, (d) => d.points.length === 2 || d.points);
await step("close path", "set_path_closed", { target: { name: "Line" }, closed: true }, (d) => d.closed === true || d);
await step("split closed path -> open", "split_path", { target: { name: "Line" }, index: 0 }, (d) => d.paths.length === 1 && d.paths[0].closed === false || d);
{ const r = await call("edit_path_points", { target: { name: "Line" }, action: "remove", index: 99 }); rec("out-of-range index -> VALIDATION_ERROR", r.body.error?.code === "VALIDATION_ERROR", r.body); }

/* ---- split open + join ---- */
await must("draw_pen_path", { points: [{ x: 20, y: 350 }, { x: 80, y: 340 }, { x: 140, y: 360 }, { x: 200, y: 350 }], name: "Wave" });
await step("split open path -> two paths", "split_path", { target: { name: "Wave" }, index: 2 }, (d) => d.paths.length === 2 && d.paths[0].pointCount === 3 && d.paths[1].pointCount === 2 || d);
await step("join paths", "join_paths", { targets: [{ name: "Wave" }, { name: "Wave 2" }], name: "Wave Joined" }, (d) => d.count === 1 && d.items[0].pointCount === 4 || d);

/* ---- simplify ---- */
const zig = Array.from({ length: 40 }, (_, i) => ({ x: 250 + i * 5, y: 300 + (i % 2 ? 0.2 : -0.2) }));
await must("draw_pen_path", { points: zig, name: "Noisy" });
await step("simplify removes near-collinear anchors", "simplify_path", { target: { name: "Noisy" }, tolerance: 1 }, (d) => d.before === 40 && d.after === 2 || d);

/* ---- undo / redo ---- */
await must("draw_rectangle", { x: 500, y: 300, width: 40, height: 40, name: "UndoMe" });
await step("undo removes last shape", "undo", { steps: 1 }, async (d) => d.undone === 1 && !(await find("UndoMe")) || "UndoMe still present");
await step("redo restores it", "redo", { steps: 1 }, async (d) => d.redone === 1 && !!(await find("UndoMe")) || "UndoMe missing");

/* ---- artboards ---- */
await step("rename artboard", "rename_artboard", { index: 0, name: "Main" }, (d) => d.artboards[0].name === "Main" || d);
await step("duplicate artboard with artwork", "duplicate_artboard", { index: 0, name: "Main copy" }, (d) => d.artboards.length === 2 && d.copiedObjects > 0 || d);
{ const r = await call("delete_artboard", { index: 1 }); rec("delete artboard without confirm is refused", r.body.error?.code === "CONFIRMATION_REQUIRED", r.body); }
await step("delete artboard with confirm", "delete_artboard", { index: 1, confirm: true }, (d) => d.artboards.length === 1 || d);

/* ---- documents ---- */
await step("list documents shows the test doc as active", "list_documents", {}, (d) => d.documents.some((x) => x.active && x.name.startsWith(DOC)) || d);

/* ---- typography ---- */
await must("add_text", { content: "Big Heading", x: 20, y: 20, fontSize: 36, name: "H1" });
await must("add_text", { content: "Body copy here", x: 20, y: 80, fontSize: 11, name: "Body" });
await must("add_text", { content: "Body copy 2", x: 20, y: 100, fontSize: 11.5, name: "Body2" });
await step("analyze typography flags near-duplicate sizes", "analyze_typography", {}, (d) => d.textFrames.length >= 3 && d.issues.some((i) => /too close/.test(i)) || d);
const fonts = (await call("inspect_fonts", { query: "Arial", limit: 20, documentFonts: false })).body.data;
const fontList = fonts?.fonts ?? fonts?.installed ?? [];
const bold = fontList.find((f) => /Bold$/i.test(f.name ?? f) && !/Italic/i.test(f.name ?? f));
const boldName = bold?.name ?? bold ?? "Arial-BoldMT";
await step("apply typography dry run changes nothing", "apply_typography", { dryRun: true, rules: [{ role: "heading", minSize: 24, font: boldName }] },
  async (d) => d.changed === 1 && (await find("H1")).font !== boldName || d);
await step("apply typography by role", "apply_typography", { rules: [{ role: "heading", minSize: 24, font: boldName }, { role: "body", maxSize: 14, size: 11 }] },
  async (d) => { const h = await find("H1"), b = await find("Body2"); return d.changed === 3 && h.font === boldName && near(b.fontSize, 11, 0.01) || { d, h, b }; });
{ const r = await call("apply_typography", { rules: [{ role: "x", font: "NoSuchFont-Zzz" }] }); rec("unknown font -> FILE_NOT_FOUND", r.body.error?.code === "FILE_NOT_FOUND", r.body); }

/* ---- design systems ---- */
const sysName = `E2E Startup ${Date.now()}`;
{ const r = await call("save_design_system", { system: { name: sysName, palette: { navy: "#0B1F3A", electric: "#2F80ED", white: "#FFFFFF" }, typography: [{ role: "heading", minSize: 24, size: 40 }], spacing: [4, 8, 16, 32] } });
  rec("save design system", r.body.ok && existsSync(r.body.data.path), r.body);
  const again = await call("save_design_system", { system: { name: sysName, palette: { a: "#000000" } } });
  rec("save without overwrite is refused", again.body.error?.code === "FILE_EXISTS", again.body);
  const l = await call("list_design_systems", {});
  rec("list design systems", l.body.data.systems.some((s) => s.name === sysName), l.body);
  await step("apply design system (swatches + typography)", "apply_design_system", { name: sysName }, async (d) =>
    d.swatches?.swatches?.length === 3 && d.typography?.changed === 1 && near((await find("H1")).fontSize, 40, 0.01) || d);
  if (r.body.ok) rmSync(r.body.data.path);
}

/* ---- images ---- */
const src = join(OUT, "illustrator-mcp-test.png");
if (existsSync(src)) {
  const a = join(OUT, "adv-image-a.png"), b = join(OUT, "adv-image-b.png");
  copyFileSync(src, a); copyFileSync(src, b);
  await must("place_image", { path: a, x: 300, y: 200, width: 120, name: "Img" });
  await step("get image info", "get_image_info", { target: { name: "Img" } }, (d) => d.images[0].kind === "linked" && d.images[0].linkExists && d.images[0].isVector === false || d);
  await step("replace image keeps bounds", "replace_image", { target: { name: "Img" }, path: b }, (d) => d.file.endsWith("adv-image-b.png") && near(d.bounds.width, 120) && near(d.bounds.x, 300) || d);
  await step("trace image -> vector group", "trace_image", { target: { name: "Img" }, preset: "6 Colors", name: "Traced" }, (d) => d.isVector && d.item.type === "GroupItem" && d.pathCount > 0 || d);
  { const r = await call("trace_image", { target: { name: "Img" }, preset: "Nope" }); rec("trace with consumed image -> error", r.isError, r.body); }
} else rec("image tests (need test-output/illustrator-mcp-test.png from pnpm test:e2e:design)", false, "missing fixture");

await call("generate_export_preview", { artboard: 0, maxWidthPx: 600 });
await call("close_document", { name: undefined, save: false, confirm: true });
await client.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
