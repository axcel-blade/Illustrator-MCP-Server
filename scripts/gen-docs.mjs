// Regenerates docs/TOOLS.md and templates/catalog.json from the running server definitions.
import { writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "../dist/config/index.js";
import { createContext, createServer } from "../dist/server.js";
import { MockAdapter } from "../dist/illustrator/bridge/mock-adapter.js";
import { TEMPLATES } from "../dist/design-engine/templates/library.js";

const ctx = createContext(loadConfig({ ILLUSTRATOR_ADAPTER: "mock" }, []), new MockAdapter());
const [a, b] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: "docs", version: "1" });
await Promise.all([createServer(ctx).connect(a), client.connect(b)]);
const { tools } = await client.listTools();
const lines = ["# MCP tool reference", "", `Generated from the server (${tools.length} tools) by \`node scripts/gen-docs.mjs\`. Coordinates follow [COORDINATES.md](COORDINATES.md).`, ""];
for (const t of tools) {
  const props = t.inputSchema.properties ?? {};
  const req = new Set(t.inputSchema.required ?? []);
  lines.push(`## \`${t.name}\``, "", t.description ?? "", "");
  if (t.annotations?.destructiveHint) lines.push("> Destructive — requires `confirm: true`.", "");
  const rows = Object.entries(props).map(([k, v]) => `| \`${k}\`${req.has(k) ? " *" : ""} | ${(v.type ?? (v.anyOf ? "union" : v.enum ? "enum" : "object"))} | ${(v.description ?? "").replace(/\|/g, "\\|")} |`);
  if (rows.length) lines.push("| Parameter | Type | Notes |", "|---|---|---|", ...rows, "");
}
writeFileSync("docs/TOOLS.md", lines.join("\n"));
writeFileSync("templates/catalog.json", JSON.stringify(TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, description: t.description, defaultSize: t.defaultSize })), null, 2));
console.log(`wrote ${tools.length} tools, ${TEMPLATES.length} templates`);
await client.close();
