import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const EnvSchema = z.object({
  MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  MCP_HTTP_HOST: z.string().default("127.0.0.1"),
  MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  MCP_AUTH_TOKEN: z.string().optional(),
  MCP_SECRET_PATH: z.string().optional(),
  ILLUSTRATOR_ADAPTER: z.enum(["com", "mock"]).default("com"),
  ILLUSTRATOR_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(60000),
  ILLUSTRATOR_AUTO_LAUNCH: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() !== "false"),
  ALLOWED_PATHS: z.string().optional(),
  LOG_LEVEL: z.string().default("info"),
  LOG_DIR: z.string().default("logs"),
});

export interface AppConfig {
  transport: "stdio" | "http";
  http: { host: string; port: number; authToken?: string; secretPath?: string };
  illustrator: { adapter: "com" | "mock"; timeoutMs: number; autoLaunch: boolean };
  allowedPaths: string[];
  outputDir: string;
  logLevel: string;
  logDir: string;
  projectRoot: string;
}

export const PROJECT_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, argv: string[] = process.argv): AppConfig {
  const parsed = EnvSchema.parse(env);
  const transportArg = argv.indexOf("--transport");
  const transport = transportArg >= 0 ? z.enum(["stdio", "http"]).parse(argv[transportArg + 1]) : parsed.MCP_TRANSPORT;

  const outputDir = resolve(PROJECT_ROOT, "output");
  const allowedPaths = parsed.ALLOWED_PATHS
    ? parsed.ALLOWED_PATHS.split(";").map((p) => p.trim()).filter(Boolean).map((p) => resolve(p))
    : [outputDir, join(homedir(), "Documents", "IllustratorMCP")];

  const authToken = parsed.MCP_AUTH_TOKEN?.trim() || undefined;
  const secretPath = parsed.MCP_SECRET_PATH?.trim() || undefined;
  if (transport === "http" && !isLoopback(parsed.MCP_HTTP_HOST) && !authToken && !secretPath) {
    throw new Error(
      `Refusing to bind HTTP transport to non-loopback host ${parsed.MCP_HTTP_HOST} without MCP_AUTH_TOKEN or MCP_SECRET_PATH.`,
    );
  }
  if (secretPath && secretPath.length < 24) throw new Error("MCP_SECRET_PATH must be at least 24 characters.");
  if (authToken && authToken.length < 24) throw new Error("MCP_AUTH_TOKEN must be at least 24 characters.");

  return {
    transport,
    http: { host: parsed.MCP_HTTP_HOST, port: parsed.MCP_HTTP_PORT, authToken, secretPath },
    illustrator: {
      adapter: parsed.ILLUSTRATOR_ADAPTER,
      timeoutMs: parsed.ILLUSTRATOR_TIMEOUT_MS,
      autoLaunch: parsed.ILLUSTRATOR_AUTO_LAUNCH,
    },
    allowedPaths,
    outputDir: allowedPaths.includes(outputDir) ? outputDir : allowedPaths[0]!,
    logLevel: parsed.LOG_LEVEL,
    logDir: resolve(PROJECT_ROOT, parsed.LOG_DIR),
    projectRoot: PROJECT_ROOT,
  };
}
