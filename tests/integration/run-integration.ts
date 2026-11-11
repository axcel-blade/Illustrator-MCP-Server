/**
 * MANUAL integration test against a real Adobe Illustrator installation (Windows COM or macOS AppleScript).
 *
 *   pnpm build && pnpm test:integration
 *
 * Builds the sample project required by the spec through the real MCP tools and writes
 * output/integration/report.json. A step is "passed" only when Illustrator executed it and the
 * result was verified (file on disk, object found by inspection). If Illustrator is not available
 * the run is reported as "blocked" — never as passed.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "../../src/config/index.js";
import { createContext, createServer } from "../../src/server.js";

type Step = { name: string; status: "passed" | "failed" | "skipped"; detail?: unknown };

async function main(): Promise<void> {
  const config = loadConfig({ ...process.env, ILLUSTRATOR_ADAPTER: process.env.ILLUSTRATOR_ADAPTER ?? "auto" }, []);
  const outDir = join(config.outputDir, "integration");
  mkdirSync(outDir, { recursive: true });
  const ctx = createContext(config);
  const server = createServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "integration", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);

  const steps: Step[] = [];
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text?: string }[] };
    const text = r.content[0]?.text ?? "";
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { body = { ok: false, error: { message: text } }; }
    return { ok: !r.isError && body.ok === true && body.source === "illustrator", body };
  };
  const step = async (name: string, tool: string, args: Record<string, unknown>, verify?: (body: Record<string, any>) => string | true) => {
    const r = await call(tool, args);
    let status: Step["status"] = r.ok ? "passed" : "failed";
    let detail: unknown = r.ok ? (r.body as { data: unknown }).data : (r.body as { error: unknown }).error;
    if (r.ok && verify) {
      const v = verify(r.body as Record<string, any>);
      if (v !== true) { status = "failed"; detail = v; }
    }
    steps.push({ name, status, detail });
    console.log(`${status === "passed" ? "PASS" : "FAIL"}  ${name}`);
    return r;
  };

  const status = await call("illustrator_status", { probe: true });
  const app = (status.body as { data?: { application?: unknown } }).data?.application;
  if (!app) {
    const report = { status: "blocked", reason: "Illustrator could not be reached via the platform bridge (COM/AppleScript); no integration step was executed.", detection: (status.body as { data?: unknown }).data, steps: [] };
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
    console.log("BLOCKED: Illustrator is not available. Report written to output/integration/report.json");
    await client.close();
    process.exitCode = 2;
    return;
  }
  steps.push({ name: "Illustrator reachable", status: "passed", detail: app });

  const stamp = Date.now();
  const aiPath = join(outDir, `sample-${stamp}.ai`);
  const pngPath = join(outDir, `sample-${stamp}.png`);

  await step("1. A4 artboard", "create_document", { name: "MCP Integration Sample", preset: "A4", colorMode: "CMYK" },
    (b) => Math.abs(b.data.artboards[0].width - 595.28) < 0.5 ? true : `artboard width ${b.data.artboards[0].width}`);
  await step("6a. Graphics layer", "create_layer", { name: "Graphics" });
  await step("6b. Typography layer", "create_layer", { name: "Typography" });
  await step("2. Background rectangle", "draw_rectangle", { name: "Background", x: 0, y: 0, width: 210, height: 297, units: "mm", fill: "#E9DDCC", stroke: "none", layer: "Layer 1" });
  await step("3. Headline", "add_text", { name: "Headline", content: "PURE BEAUTY", x: 105, y: 40, units: "mm", font: ["Georgia", "Arial"], fontSize: 48, color: "#29231E", align: "center", layer: "Typography" });
  await step("4. Decorative circle", "draw_circle", { name: "Decorative Circle", cx: 105, cy: 150, radius: 40, units: "mm", fill: "#C6A98A", stroke: "none", layer: "Graphics" });
  await step("5. Secondary text", "add_text", { name: "Secondary", content: "Radiance, refined.", x: 105, y: 215, units: "mm", fontSize: 16, color: "#29231E", align: "center", layer: "Typography" });

  await step("Verify by inspection", "inspect_document", {}, (b) => {
    const names = (b.data.items as { name: string }[]).map((i) => i.name);
    const missing = ["Background", "Headline", "Decorative Circle", "Secondary"].filter((n) => !names.includes(n));
    const layers = (b.data.layers as { name: string }[]).map((l) => l.name);
    if (!layers.includes("Graphics")) return "Graphics layer missing";
    return missing.length ? `missing objects: ${missing.join(", ")}` : true;
  });
  await step("Composition analysis", "analyze_composition", {});
  await step("7. Save editable AI", "save_document_as", { path: aiPath }, () => (existsSync(aiPath) && statSync(aiPath).size > 0 ? true : "AI file not on disk"));
  await step("8. Export PNG preview", "export_png", { path: pngPath, ppi: 72 }, () => (existsSync(pngPath) && statSync(pngPath).size > 0 ? true : "PNG not on disk"));
  await step("Inline preview image", "generate_export_preview", { maxWidthPx: 600 }, (b) => (b.data.imageAttached ? true : "no preview image"));
  await step("Live effect: drop shadow", "apply_shadow", { target: { name: "Decorative Circle" } });
  await step("Design engine: generate_design", "generate_design", { brief: 'Create a modern luxury skincare poster with a minimalist layout, beige background, elegant typography and a product image. Headline "PURE BEAUTY"', preview: true },
    (b) => (b.data.verification.missing.length === 0 ? true : `missing: ${b.data.verification.missing.join(", ")}`));

  const failed = steps.filter((s) => s.status === "failed");
  const report = { status: failed.length ? "failed" : "passed", executedAgainst: app, at: new Date().toISOString(), files: { ai: aiPath, png: pngPath }, steps };
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n${report.status.toUpperCase()}: ${steps.length - failed.length}/${steps.length} steps passed. Report: ${join(outDir, "report.json")}`);
  await client.close();
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
