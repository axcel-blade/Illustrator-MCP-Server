import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const t = new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"], stderr: "ignore" });
const c = new Client({ name: "dump", version: "1" });
await c.connect(t);
console.log("SERVER", JSON.stringify(c.getServerVersion()), JSON.stringify(c.getServerCapabilities()));
const { tools } = await c.listTools();
for (const tl of tools) {
  const p = tl.inputSchema.properties ?? {};
  console.log(tl.name, "(" + (tl.inputSchema.required ?? []).join(",") + ")", Object.entries(p).map(([k, v]) => k + ":" + (v.type ?? (v.anyOf ? "union" : v.enum ? "enum" : "?")) + (v.enum ? "[" + v.enum.join("|") + "]" : "")).join(" "));
}
await c.close();
