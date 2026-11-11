import { mkdtempSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/index.js";
import { MockAdapter } from "../../src/illustrator/bridge/mock-adapter.js";
import { createContext } from "../../src/server.js";
import { authorize, startHttp } from "../../src/transport/http.js";

const TOKEN = "t".repeat(32);
const SECRET = "s".repeat(32);

describe("config security rules", () => {
  it("refuses a public bind without credentials", () => {
    expect(() => loadConfig({ MCP_TRANSPORT: "http", MCP_HTTP_HOST: "0.0.0.0" }, [])).toThrow(/Refusing/);
    expect(() => loadConfig({ MCP_TRANSPORT: "http", MCP_HTTP_HOST: "0.0.0.0", MCP_AUTH_TOKEN: "short" }, [])).toThrow(/24/);
    expect(loadConfig({ MCP_TRANSPORT: "http", MCP_HTTP_HOST: "0.0.0.0", MCP_AUTH_TOKEN: TOKEN }, []).http.authToken).toBe(TOKEN);
  });
  it("supports --transport flag", () => {
    expect(loadConfig({}, ["node", "x", "--transport", "http"]).transport).toBe("http");
  });
});

describe("authorize()", () => {
  const http = { host: "127.0.0.1", port: 1, authToken: TOKEN, secretPath: SECRET };
  it("accepts bearer tokens and secret paths only", () => {
    expect(authorize({ url: "/mcp", headers: { authorization: `Bearer ${TOKEN}` } }, http).ok).toBe(true);
    expect(authorize({ url: "/mcp", headers: { authorization: "Bearer wrong" } }, http).ok).toBe(false);
    expect(authorize({ url: "/mcp", headers: {} }, http).ok).toBe(false);
    expect(authorize({ url: `/mcp/${SECRET}`, headers: {} }, http).ok).toBe(true);
    expect(authorize({ url: `/mcp/${SECRET}x`, headers: {} }, http).ok).toBe(false);
  });
  it("allows unauthenticated access only on loopback", () => {
    expect(authorize({ url: "/mcp", headers: {} }, { host: "127.0.0.1", port: 1 }).ok).toBe(true);
    expect(authorize({ url: "/mcp", headers: {} }, { host: "0.0.0.0", port: 1 }).ok).toBe(false);
  });
});

describe("HTTP transport", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const config = loadConfig({ MCP_TRANSPORT: "http", MCP_HTTP_PORT: "3999", MCP_AUTH_TOKEN: TOKEN, ILLUSTRATOR_ADAPTER: "mock", ALLOWED_PATHS: mkdtempSync(join(tmpdir(), "h-")), LOG_LEVEL: "error" }, []);
    config.http.port = 0;
    server = await startHttp(config, createContext(config, new MockAdapter()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } };
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };

  it("rejects requests without a token", async () => {
    const r = await fetch(`${base}/mcp`, { method: "POST", headers, body: JSON.stringify(init) });
    expect(r.status).toBe(401);
  });
  it("initializes a session with a valid token", async () => {
    const r = await fetch(`${base}/mcp`, { method: "POST", headers: { ...headers, authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(init) });
    expect(r.status).toBe(200);
    expect(r.headers.get("mcp-session-id")).toBeTruthy();
  });
  it("serves a health check and 404s other paths", async () => {
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect((await fetch(`${base}/other`)).status).toBe(404);
  });
});
