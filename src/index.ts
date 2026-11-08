#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config/index.js";
import { createContext, createServer } from "./server.js";
import { startHttp } from "./transport/http.js";
import { configureLogger, logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  configureLogger({ level: config.logLevel, dir: config.logDir });
  const ctx = createContext(config);
  logger.info("starting illustrator-ai-mcp", { transport: config.transport, adapter: config.illustrator.adapter, allowedPaths: config.allowedPaths });

  let close: () => Promise<void>;
  if (config.transport === "http") {
    const http = await startHttp(config, ctx);
    close = () => new Promise((r) => http.close(() => r()));
  } else {
    const server = createServer(ctx);
    await server.connect(new StdioServerTransport());
    close = () => server.close();
  }

  // Safe shutdown: stop accepting work, let the in-flight Illustrator op finish (bounded wait).
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info("shutting down", { signal, pending: ctx.bridge.pending });
    const deadline = Date.now() + 15000;
    while (ctx.bridge.pending > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    await close().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.stdin.on("close", () => {
    if (config.transport === "stdio") void shutdown("stdin closed");
  });
}

main().catch((err) => {
  console.error(`illustrator-ai-mcp failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
