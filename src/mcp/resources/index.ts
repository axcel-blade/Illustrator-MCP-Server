import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { zodToJsonSchema } from "../../utils/zod-json.js";
import { DesignPlanSchema } from "../../schemas/design-plan.js";
import { STYLE_PALETTES } from "../../design-engine/color/palettes.js";
import { TYPE_SYSTEMS } from "../../design-engine/typography/type-systems.js";
import { TEMPLATES } from "../../design-engine/templates/library.js";
import type { ToolContext } from "../tools/common.js";

const json = (uri: string, value: unknown) => ({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }] });

export function registerResources(server: McpServer, ctx: ToolContext): void {
  server.registerResource("design-plan-schema", "illustrator://schema/design-plan", {
    title: "Design plan JSON schema", description: "JSON Schema of the structured design representation", mimeType: "application/json",
  }, async (uri) => json(uri.href, zodToJsonSchema(DesignPlanSchema)));

  server.registerResource("templates", "illustrator://templates", {
    title: "Design templates", description: "Template ids, categories and default sizes", mimeType: "application/json",
  }, async (uri) => json(uri.href, TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, description: t.description, defaultSize: t.defaultSize }))));

  server.registerResource("styles", "illustrator://styles", {
    title: "Style systems", description: "Palettes and typography systems per design style", mimeType: "application/json",
  }, async (uri) => json(uri.href, Object.fromEntries(Object.keys(TYPE_SYSTEMS).map((s) => [s, { palette: STYLE_PALETTES[s], typography: TYPE_SYSTEMS[s] }]))));

  server.registerResource("coordinate-convention", "illustrator://docs/coordinates", {
    title: "Coordinate convention", mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: readFileSync(join(ctx.config.projectRoot, "docs", "COORDINATES.md"), "utf8") }] }));

  server.registerResource("design-plan", new ResourceTemplate("illustrator://plans/{planId}", {
    list: async () => ({ resources: ctx.plans.list().map((p) => ({ uri: `illustrator://plans/${p.id}`, name: p.title ?? p.id, mimeType: "application/json" })) }),
  }), { title: "Stored design plan", mimeType: "application/json" }, async (uri, vars) => json(uri.href, ctx.plans.get(String(vars.planId))));
}
