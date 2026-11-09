/**
 * Phase 7: Streamable HTTP transport (the transport ChatGPT connectors use) against the real
 * server + real Illustrator. Starts dist/index.js --transport http with a bearer token.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ROOT } from "./lib.mjs";

const PORT = 3399, TOKEN = randomBytes(24).toString("hex"), SECRET = randomBytes(16).toString("hex");
const srv = spawn(process.execPath, [resolve(ROOT, "dist/index.js"), "--transport", "http"], {
  cwd: ROOT, stdio: ["ignore", "ignore", "pipe"],
  env: { ...process.env, MCP_HTTP_PORT: String(PORT), MCP_AUTH_TOKEN: TOKEN, MCP_SECRET_PATH: SECRET, ILLUSTRATOR_ADAPTER: "com", LOG_LEVEL: "warn" },
});
const res = [];
const rec = (n, ok, d) => { res.push({ name: n, status: ok ? "PASS" : "FAIL" }); console.log(ok ? "PASS " : "FAIL ", n, ok ? "" : JSON.stringify(d).slice(0, 300)); };
const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(base + "/healthz")).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 200)); }

try {
  rec("GET /healthz", (await fetch(base + "/healthz")).ok);
  const noAuth = await fetch(base + "/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } } }) });
  rec(`request without token rejected (${noAuth.status})`, noAuth.status === 401 || noAuth.status === 403);

  for (const [label, url, headers] of [
    ["bearer token", `${base}/mcp`, { Authorization: `Bearer ${TOKEN}` }],
    ["secret path (no-auth connector mode)", `${base}/mcp/${SECRET}`, {}],
  ]) {
    const c = new Client({ name: "http-e2e", version: "1" });
    await c.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } }));
    const { tools } = await c.listTools();
    rec(`${label}: initialize + tools/list (${tools.length})`, tools.length > 100);
    const r = await c.callTool({ name: "illustrator_status", arguments: { probe: true } }, undefined, { timeout: 180000 });
    const body = JSON.parse(r.content[0].text);
    rec(`${label}: real Illustrator call (v${body.data?.application?.version})`, body.ok && body.source === "illustrator" && !!body.data.application?.version, body);
    await c.close();
  }
} catch (e) { rec("http suite", false, String(e)); }
srv.kill();
console.log(JSON.stringify(res));
