import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
export const ROOT = resolve(import.meta.dirname, "../..");
export const OUT = resolve(ROOT, "test-output");
export async function connect(env = {}) {
  const t = new StdioClientTransport({
    command: process.execPath, args: [resolve(ROOT, "dist/index.js")], cwd: ROOT, stderr: "pipe",
    env: { ...process.env, ILLUSTRATOR_ADAPTER: "auto", ALLOWED_PATHS: `${OUT};${resolve(ROOT, "output")}`, LOG_LEVEL: "warn", ...env },
  });
  const c = new Client({ name: "e2e", version: "1" });
  await c.connect(t);
  const call = async (name, args = {}) => {
    const t0 = Date.now();
    const r = await c.callTool({ name, arguments: args }, undefined, { timeout: 300000 });
    if (process.env.E2E_TIMING) console.error(`  ${name} ${Date.now() - t0}ms`);
    const text = r.content?.[0]?.text ?? "";
    let body; try { body = JSON.parse(text); } catch { body = { ok: false, raw: text }; }
    return { isError: !!r.isError, body, images: (r.content ?? []).filter((x) => x.type === "image").length };
  };
  return { client: c, transport: t, call };
}
