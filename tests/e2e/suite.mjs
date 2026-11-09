/**
 * End-to-end suite against the REAL Illustrator via the built server over stdio.
 *   pnpm build && node tests/e2e/suite.mjs
 * Writes test-output/e2e-results.json. A step passes only if Illustrator state / disk confirms it.
 */
import { existsSync, statSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { connect, OUT } from "./lib.mjs";

const results = [];
const rec = (phase, name, status, detail) => {
  results.push({ phase, name, status, detail });
  console.log(`${status.padEnd(10)} [${phase}] ${name}${status !== "PASS" && detail ? "  -> " + JSON.stringify(detail).slice(0, 400) : ""}`);
};
const { client, call } = await connect();
const items = async () => (await call("inspect_document", { deep: true, limit: 500 })).body.data?.items ?? [];
const item = async (n) => (await items()).find((i) => i.name === n);
const layers = async () => (await call("inspect_layers")).body.data?.layers ?? [];
const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
const file = (p) => (existsSync(p) && statSync(p).size > 0 ? true : `missing/empty ${p}`);
async function step(phase, name, tool, args, verify) {
  try {
    const r = await call(tool, args);
    if (r.isError || !r.body.ok || r.body.source !== "illustrator") { rec(phase, name, "FAIL", r.body.error ?? r.body); return r; }
    const v = verify ? await verify(r.body.data, r) : true;
    rec(phase, name, v === true ? "PASS" : "FAIL", v === true ? undefined : v);
    return r;
  } catch (e) { rec(phase, name, "FAIL", String(e)); }
}
async function closeAll() {
  const a = (await call("illustrator_status", { probe: true })).body.data?.application;
  for (let i = 0; i < (a?.documentCount ?? 0); i++) await call("close_document", { save: false, confirm: true });
}

/* ---------------- Phase 2: protocol ---------------- */
const P2 = "protocol";
const sv = client.getServerVersion(), caps = client.getServerCapabilities();
rec(P2, "initialize + serverInfo", sv?.name ? "PASS" : "FAIL", sv);
rec(P2, "capabilities advertise tools/resources/prompts", caps?.tools && caps?.resources && caps?.prompts ? "PASS" : "FAIL", caps);
const { tools } = await client.listTools();
const badSchema = tools.filter((t) => t.inputSchema?.type !== "object");
rec(P2, `tools/list (${tools.length} tools), all schemas type=object`, tools.length > 0 && !badSchema.length ? "PASS" : "FAIL", badSchema.map((t) => t.name));
try { const rs = await client.listResources(); rec(P2, `resources/list (${rs.resources.length})`, "PASS"); } catch (e) { rec(P2, "resources/list", "FAIL", String(e)); }
try { const ps = await client.listPrompts(); rec(P2, `prompts/list (${ps.prompts.length})`, "PASS"); } catch (e) { rec(P2, "prompts/list", "FAIL", String(e)); }
{ const r = await call("draw_rectangle", { x: "a", y: 0 }); rec(P2, "invalid args -> isError with validation message", r.isError && /width|expected|invalid/i.test(JSON.stringify(r.body)) ? "PASS" : "FAIL", r.body); }
{ const r = await call("no_such_tool", {}); rec(P2, "unknown tool -> error", r.isError ? "PASS" : "FAIL", r.body); }
{ const r = await call("illustrator_status", {}); rec(P2, "server alive after errors", r.body.ok ? "PASS" : "FAIL"); }

/* ---------------- Phase 3: connection ---------------- */
const P3 = "connection";
const d = (await call("illustrator_status", { probe: true })).body.data;
rec(P3, "Illustrator installed", d?.detection?.installs?.length ? "PASS" : "FAIL", d?.detection?.installs);
rec(P3, "Illustrator running", d?.detection?.running ? "PASS" : "FAIL");
rec(P3, "COM registered", d?.detection?.comRegistered ? "PASS" : "FAIL", d?.detection?.comProgId);
rec(P3, `scripting access / version ${d?.application?.version}`, d?.application?.version ? "PASS" : "FAIL");
rec(P3, "active document detection", d?.application && "activeDocument" in d.application ? "PASS" : "FAIL", d?.application?.activeDocument);
await closeAll();

/* ---------------- Phase 4: operations ---------------- */
const D = "document", S = "shapes", T = "typography", V = "vector", A = "advanced";
const opsAi = join(OUT, "ops-test.ai");
for (const f of ["ops-test.ai", "ops.svg", "ops.png", "ops.pdf"]) rmSync(join(OUT, f), { force: true });
await step(D, "create document 800x600 px (unsaved, no bogus path)", "create_document", { name: "OpsTest", width: 800, height: 600, units: "px", colorMode: "RGB" },
  (x) => (near(x.artboards[0].width, 800) && near(x.artboards[0].height, 600) && x.saved === false && !x.path ? true : { artboards: x.artboards, saved: x.saved, path: x.path }));
await step(D, "document info", "inspect_document", {}, (x) => (x.name?.startsWith("OpsTest") ? true : x.name));
await step(S, "rectangle", "draw_rectangle", { name: "Rect", x: 20, y: 20, width: 120, height: 80, fill: "#3366FF", stroke: "none" },
  (x) => (near(x.bounds.width, 120) && x.fill.hex === "#3366FF" ? true : x));
await step(S, "circle", "draw_circle", { name: "Circle", cx: 250, cy: 60, radius: 40, fill: "#FF6633" }, (x) => (near(x.bounds.width, 80) && near(x.bounds.height, 80) ? true : x.bounds));
await step(S, "ellipse", "draw_ellipse", { name: "Ellipse", x: 320, y: 20, width: 140, height: 70, fill: "#33CC99" }, (x) => (near(x.bounds.width, 140) && near(x.bounds.height, 70) ? true : x.bounds));
await step(S, "polygon (6 sides)", "draw_polygon", { name: "Hex", cx: 540, cy: 60, radius: 40, sides: 6, fill: "#AA44FF" }, (x) => (x.pointCount === 6 ? true : x));
await step(S, "star (5 pts)", "draw_star", { name: "Star", cx: 660, cy: 60, radius: 45, innerRadius: 20, points: 5, fill: "#FFD700" }, (x) => (x.pointCount === 10 ? true : x));
await step(S, "change position", "move_object", { target: { name: "Rect" }, x: 30, y: 150 }, async () => { const i = await item("Rect"); return near(i.bounds.x, 30) && near(i.bounds.y, 150) ? true : i.bounds; });
await step(S, "change dimensions", "resize_object", { target: { name: "Rect" }, width: 200, height: 100, keepProportions: false }, async () => { const i = await item("Rect"); return near(i.bounds.width, 200) && near(i.bounds.height, 100) ? true : i.bounds; });
await step(S, "change fill", "set_fill_color", { target: { name: "Circle" }, color: "#112233" }, async () => { const f = (await item("Circle")).fill; return f.hex === "#112233" ? true : f; });
await step(S, "change stroke", "set_stroke", { target: { name: "Circle" }, stroke: { color: "#FF0000", width: 4 } }, async () => { const s = (await item("Circle")).stroke; return s?.color?.hex === "#FF0000" && near(s.width, 4) ? true : s; });

await step(T, "inspect_fonts", "inspect_fonts", { query: "Arial", limit: 10 }, (x) => (JSON.stringify(x).includes("Arial") ? true : x));
await step(T, "create text", "add_text", { name: "Title", content: "Hello Illustrator", x: 30, y: 300, fontSize: 24, color: "#000000" },
  async () => { const i = await item("Title"); return i?.type === "TextFrame" && JSON.stringify(i).includes("Hello Illustrator") ? true : i; });
await step(T, "font size", "set_font_size", { target: { name: "Title" }, fontSize: 40 }, async () => { const i = await item("Title"); return /"(fontSize|size)":40/.test(JSON.stringify(i)) ? true : i; });
await step(T, "font family", "set_font", { target: { name: "Title" }, font: "Arial-BoldMT" }, async () => { const i = await item("Title"); return /Arial-?Bold/i.test(JSON.stringify(i)) ? true : i; });
await step(T, "text color", "set_text_color", { target: { name: "Title" }, color: "#CC0044" }, async () => { const i = await item("Title"); return /#CC0044/i.test(JSON.stringify(i)) ? true : i; });
await step(T, "alignment", "set_paragraph_alignment", { target: { name: "Title" }, align: "center" }, async () => { const i = await item("Title"); return /center/i.test(JSON.stringify(i)) ? true : i; });

await step(V, "create pen path", "draw_pen_path", { name: "Path", points: [{ x: 30, y: 400 }, { x: 130, y: 360, in: [100, 340], out: [160, 380] }, { x: 230, y: 420 }], closed: false, stroke: { color: "#000000", width: 2 }, fill: "none" },
  (x) => (x.pointCount === 3 ? true : x));
await step(V, "freeform path", "draw_freeform_path", { name: "Free", points: [{ x: 260, y: 400 }, { x: 300, y: 360 }, { x: 340, y: 420 }, { x: 380, y: 380 }], fill: "none", stroke: { color: "#0000FF", width: 2 } }, (x) => (x.pointCount === 4 ? true : x));
rec(V, "modify anchor points of existing path", "NOT TESTED", "No MCP tool exposes per-anchor editing; paths can only be redrawn (draw_pen_path) or transformed.");
await step(V, "rotate (transform)", "rotate_object", { target: { name: "Ellipse" }, angle: 90 }, async () => { const b = (await item("Ellipse")).bounds; return near(b.width, 70, 1) && near(b.height, 140, 1) ? true : b; });
await step(V, "scale + reflect (transform_objects)", "transform_objects", { target: { name: "Hex" }, scale: 150, reflect: "horizontal" }, async () => { const b = (await item("Hex")).bounds; return b.width > 100 ? true : b; });
await step(V, "group", "group_objects", { targets: [{ name: "Path" }, { name: "Free" }], name: "Paths" }, async () => ((await item("Paths"))?.type === "GroupItem" ? true : "group not found"));
await step(V, "ungroup", "ungroup_objects", { target: { name: "Paths" } }, async () => (!(await item("Paths")) && (await item("Path")) ? true : "group still present"));
await step(V, "duplicate", "duplicate_object", { target: { name: "Star" }, dx: 0, dy: 100, name: "Star Copy" }, async () => ((await item("Star Copy")) ? true : "copy not found"));
await step(V, "delete", "delete_object", { target: { name: "Star Copy" }, confirm: true }, async () => (!(await item("Star Copy")) ? true : "still exists"));
{
  const all = await items();
  const before = all.find((i) => i.name === "Rect").zOrder;
  await step(V, "arrange (bring to front)", "set_object_z_order", { target: { name: "Rect" }, order: "front" }, async () => {
    const z = (await item("Rect")).zOrder; return z !== before || z === 1 ? true : { before, z };
  });
}
await step(V, "align (left edge to artboard)", "align_objects", { targets: [{ name: "Circle" }], alignment: "left", relativeTo: "artboard" }, async () => { const b = (await item("Circle")).bounds; return near(b.x, 0, 2.5) ? true : b; });

await step(A, "create layer", "create_layer", { name: "TestLayer" }, async () => ((await layers()).some((l) => l.name === "TestLayer") ? true : "layer missing"));
await step(A, "rename layer", "rename_layer", { name: "TestLayer", newName: "Renamed" }, async () => ((await layers()).some((l) => l.name === "Renamed") ? true : "not renamed"));
await step(A, "lock layer", "lock_layer", { name: "Renamed", locked: true }, async () => ((await layers()).find((l) => l.name === "Renamed")?.locked === true ? true : "not locked"));
await step(A, "unlock layer", "lock_layer", { name: "Renamed", locked: false }, async () => ((await layers()).find((l) => l.name === "Renamed")?.locked === false ? true : "still locked"));
await step(A, "gradient", "set_gradient", { target: { name: "Rect" }, type: "linear", angle: 0, stops: [{ color: "#FF0080", position: 0 }, { color: "#00C8FF", position: 100 }] },
  async () => { const f = (await item("Rect")).fill; return /gradient/i.test(JSON.stringify(f)) ? true : f; });
await step(A, "opacity", "set_opacity", { target: { name: "Circle" }, opacity: 50 }, async () => { const o = (await item("Circle")).opacity; return near(o, 50) ? true : o; });
await call("draw_circle", { name: "MaskShape", cx: 600, cy: 300, radius: 60, fill: "#000000" });
await call("draw_rectangle", { name: "MaskContent", x: 520, y: 220, width: 160, height: 160, fill: "#00AA00" });
await step(A, "clipping mask", "create_clipping_mask", { mask: { name: "MaskShape" }, targets: [{ name: "MaskContent" }], name: "Clipped" },
  async () => { const i = await item("Clipped"); return i?.type === "GroupItem" && /clipped"?:\s*true/i.test(JSON.stringify(i)) ? true : i ?? "clip group missing"; });

await step(D, "save document as .ai", "save_document_as", { path: opsAi, overwrite: true }, () => file(opsAi));
await step(D, "save document (in place)", "save_document", {}, () => file(opsAi));
await step(A, "export SVG", "export_svg", { path: join(OUT, "ops.svg"), overwrite: true }, () => file(join(OUT, "ops.svg")));
await step(A, "export PNG", "export_png", { path: join(OUT, "ops.png"), overwrite: true, ppi: 72 }, () => file(join(OUT, "ops.png")));
await step(A, "export PDF", "export_pdf", { path: join(OUT, "ops.pdf"), overwrite: true }, () => file(join(OUT, "ops.pdf")));
await step(D, "close document", "close_document", { save: false, confirm: true }, async () => {
  const a = (await call("illustrator_status", { probe: true })).body.data.application;
  return a.documentCount === 0 ? true : a.documents;
});
await step(D, "open document", "open_document", { path: opsAi }, async () => ((await item("Rect")) && (await item("Title")) ? true : "objects not found after reopen"));
await closeAll();

/* ---------------- Phase 6: errors ---------------- */
const E = "errors";
const expectErr = async (name, tool, args, re) => {
  const r = await call(tool, args);
  const msg = JSON.stringify(r.body.error ?? r.body);
  rec(E, name, r.isError && (!re || re.test(msg)) ? "PASS" : "FAIL", msg.slice(0, 400));
};
await expectErr("no active document", "draw_rectangle", { x: 0, y: 0, width: 10, height: 10 }, /document/i);
await expectErr("invalid dimensions (negative)", "create_document", { width: -5, height: 100 });
await expectErr("invalid dimensions (too large)", "create_document", { width: 999999, height: 100, units: "px" });
await call("create_document", { name: "ErrTest", width: 300, height: 300, units: "px" });
await expectErr("invalid color", "draw_rectangle", { x: 0, y: 0, width: 10, height: 10, fill: "#GGGGGG" }, /color|hex/i);
await call("add_text", { name: "T", content: "x", x: 10, y: 10 });
{
  const r = await call("set_font", { target: { name: "T" }, font: "NoSuchFont-XYZ123" });
  rec(E, "missing font -> error or explicit fallback warning", r.isError || (r.body.warnings ?? []).some((w) => /font/i.test(w)) ? "PASS" : "FAIL", r.body);
}
await expectErr("unknown target object", "move_object", { target: { name: "DoesNotExist" }, dx: 5 }, /not found|no object|DoesNotExist/i);
await expectErr("unsupported op: edit_text on a rectangle", "edit_text", { target: { name: "R" }, content: "x" });
await expectErr("invalid path (outside allowed dirs)", "save_document_as", { path: "C:\\Windows\\System32\\evil.ai" }, /allow|path/i);
await expectErr("invalid path (nonexistent drive)", "export_png", { path: "Q:\\nope\\x.png" });
await expectErr("export wrong extension", "export_svg", { path: join(OUT, "bad.png") });
await expectErr("export refuses overwrite by default", "export_png", { path: join(OUT, "ops.png") }, /exist|overwrite/i);
await expectErr("delete layer without confirm", "delete_layer", { name: "Layer 1" }, /confirm/i);
{
  let ok = 0;
  for (let i = 0; i < 15; i++) { const r = await call("draw_circle", { cx: 20 + i * 15, cy: 150, radius: 5, fill: "#123456" }); if (r.body.ok) ok++; }
  const n = (await call("inspect_document", {})).body.data.pageItemCount;
  rec(E, "15 consecutive tool calls", ok === 15 && n >= 16 ? "PASS" : "FAIL", { ok, n });
}
{
  const rs = await Promise.all(Array.from({ length: 5 }, (_, i) => call("draw_rectangle", { x: i * 20, y: 200, width: 10, height: 10, fill: "#654321" })));
  rec(E, "5 concurrent tool calls (queued)", rs.every((r) => r.body.ok) ? "PASS" : "FAIL", rs.filter((r) => !r.body.ok).map((r) => r.body.error));
}
await closeAll();

writeFileSync(join(OUT, "e2e-results.json"), JSON.stringify(results, null, 2));
const c = (s) => results.filter((r) => r.status === s).length;
console.log(`\nPASS ${c("PASS")}  FAIL ${c("FAIL")}  NOT TESTED ${c("NOT TESTED")}`);
await client.close();
