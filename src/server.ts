import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config/index.js";
import { PlanStore } from "./design-engine/plan-store.js";
import { IllustratorBridge } from "./illustrator/bridge/bridge.js";
import { ComAdapter } from "./illustrator/bridge/com-adapter.js";
import { MockAdapter } from "./illustrator/bridge/mock-adapter.js";
import type { BridgeAdapter } from "./illustrator/bridge/types.js";
import { registerPrompts } from "./mcp/prompts/index.js";
import { registerResources } from "./mcp/resources/index.js";
import { registerAppearanceTools } from "./mcp/tools/appearance.js";
import { registerAssetTools } from "./mcp/tools/assets.js";
import type { ToolContext } from "./mcp/tools/common.js";
import { registerDesignTools } from "./mcp/tools/design.js";
import { registerDocumentTools } from "./mcp/tools/document.js";
import { registerExportTools } from "./mcp/tools/export.js";
import { registerLayerTools } from "./mcp/tools/layers.js";
import { registerLayoutTools } from "./mcp/tools/layout.js";
import { registerObjectTools } from "./mcp/tools/objects.js";
import { registerTypographyTools } from "./mcp/tools/typography.js";
import { registerUiTools } from "./mcp/tools/ui.js";
import { registerVectorTools } from "./mcp/tools/vector.js";
import { PathPolicy } from "./utils/paths.js";

export const SERVER_INFO = { name: "illustrator-ai-mcp", version: "0.1.0" };

export function createAdapter(config: AppConfig): BridgeAdapter {
  return config.illustrator.adapter === "mock" ? new MockAdapter() : new ComAdapter({ autoLaunch: config.illustrator.autoLaunch });
}

/** Shared state for one process: one bridge/queue regardless of how many MCP sessions connect. */
export function createContext(config: AppConfig, adapter: BridgeAdapter = createAdapter(config)): ToolContext {
  return {
    bridge: new IllustratorBridge(adapter, config.illustrator.timeoutMs),
    config,
    paths: new PathPolicy(config.allowedPaths),
    plans: new PlanStore(join(config.outputDir, "plans")),
    session: { units: "pt" },
  };
}

export function createServer(ctx: ToolContext): McpServer {
  const server = new McpServer(SERVER_INFO, {
    capabilities: { tools: {}, resources: {}, prompts: {}, logging: {} },
    instructions:
      "Controls Adobe Illustrator. Coordinates: origin at the artboard's top-left, x right, y DOWN; points unless `units` is given. " +
      "Every result states its source (illustrator | mock | server). Never claim visual inspection unless a tool returned a preview image. " +
      "Destructive tools need confirm: true after asking the user. Start with illustrator_status.",
  });
  registerDocumentTools(server, ctx);
  registerVectorTools(server, ctx);
  registerTypographyTools(server, ctx);
  registerAppearanceTools(server, ctx);
  registerObjectTools(server, ctx);
  registerLayoutTools(server, ctx);
  registerLayerTools(server, ctx);
  registerExportTools(server, ctx);
  registerAssetTools(server, ctx);
  registerDesignTools(server, ctx);
  registerUiTools(server, ctx);
  registerResources(server, ctx);
  registerPrompts(server);
  return server;
}
