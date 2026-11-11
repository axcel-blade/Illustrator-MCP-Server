import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { isLoopback, type AppConfig } from "../config/index.js";
import type { ToolContext } from "../mcp/tools/common.js";
import { createServer } from "../server.js";
import { logger } from "../utils/logger.js";

const MAX_BODY = 4 * 1024 * 1024;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Authorization decision for a request. Accepted credentials:
 *  - Authorization: Bearer <MCP_AUTH_TOKEN>
 *  - a request path of /mcp/<MCP_SECRET_PATH> (for clients that only support "no auth" connectors)
 * Loopback deployments with neither configured are open to local processes only.
 */
export function authorize(req: { headers: IncomingMessage["headers"]; url?: string }, http: AppConfig["http"]): { ok: boolean; mcpPath: boolean } {
  const path = (req.url ?? "/").split("?")[0]!;
  const secretOk = http.secretPath ? safeEqual(path, `/mcp/${http.secretPath}`) : false;
  const isMcp = path === "/mcp" || secretOk;
  if (!http.authToken && !http.secretPath) return { ok: isLoopback(http.host), mcpPath: path === "/mcp" };
  if (secretOk) return { ok: true, mcpPath: true };
  const header = req.headers.authorization ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  return { ok: Boolean(http.authToken && token && safeEqual(token, http.authToken) && path === "/mcp"), mcpPath: isMcp };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw Object.assign(new Error("Request body too large"), { status: 413 });
    chunks.push(c as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

export function startHttp(config: AppConfig, ctx: ToolContext): Promise<Server> {
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const loopback = isLoopback(config.http.host);
  let port = config.http.port;

  const server = createHttpServer(async (req, res) => {
    try {
      const path = (req.url ?? "/").split("?")[0];
      if (path === "/healthz") return send(res, 200, { ok: true, name: "illustrator-ai-mcp" });
      const auth = authorize(req, config.http);
      if (!auth.mcpPath) return send(res, 404, { error: "Not found" });
      if (!auth.ok) {
        res.setHeader("WWW-Authenticate", 'Bearer realm="illustrator-ai-mcp"');
        return send(res, 401, { error: "Unauthorized" });
      }
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const body = req.method === "POST" ? await readJson(req) : undefined;
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        if (req.method !== "POST" || !isInitializeRequest(body)) {
          return send(res, 400, { jsonrpc: "2.0", error: { code: -32000, message: "No valid session; send initialize first." }, id: null });
        }
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport!);
            logger.info("http session started", { sessionId: id });
          },
          enableDnsRebindingProtection: loopback,
          allowedHosts: loopback ? [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`] : undefined,
        });
        transport.onclose = () => {
          if (transport!.sessionId) transports.delete(transport!.sessionId);
        };
        await createServer(ctx).connect(transport);
      }
      await transport.handleRequest(req, res, body);
    } catch (err) {
      const status = (err as { status?: number }).status ?? (err instanceof SyntaxError ? 400 : 500);
      logger.error("http error", { error: String(err) });
      if (!res.headersSent) send(res, status, { error: status === 500 ? "Internal error" : (err as Error).message });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.http.port, config.http.host, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") port = addr.port;
      logger.info("HTTP MCP transport listening", {
        url: `http://${config.http.host}:${port}/mcp`, auth: config.http.authToken ? "bearer" : config.http.secretPath ? "secret-path" : "none (loopback only)",
      });
      resolve(server);
    });
  });
}
