import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IllustratorBridge, parseEnvelope } from "../../src/illustrator/bridge/bridge.js";
import { MockAdapter } from "../../src/illustrator/bridge/mock-adapter.js";
import { OperationQueue } from "../../src/illustrator/bridge/queue.js";
import { ALLOWED_OPS, buildScript, SCRIPT_DIR, toJsxLiteral } from "../../src/illustrator/bridge/script-builder.js";
import type { BridgeAdapter, ExecuteRequest } from "../../src/illustrator/bridge/types.js";
import { McpDesignError } from "../../src/utils/errors.js";

describe("operation queue", () => {
  it("never runs two tasks concurrently and survives failures", async () => {
    const q = new OperationQueue();
    let active = 0, maxActive = 0;
    const order: number[] = [];
    const task = (i: number, fail = false) => q.run(async () => {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      order.push(i); active--;
      if (fail) throw new Error("boom");
      return i;
    });
    const results = await Promise.allSettled([task(1), task(2, true), task(3)]);
    expect(maxActive).toBe(1);
    expect(order).toEqual([1, 2, 3]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });
  it("rejects when full", async () => {
    const q = new OperationQueue(1);
    const p = q.run(() => new Promise((r) => setTimeout(r, 20)));
    await expect(q.run(async () => 1)).rejects.toThrow(/queue is full/);
    await p;
  });
});

describe("script builder", () => {
  it("embeds the command as an ES3-safe literal", () => {
    expect(toJsxLiteral({ s: "é\u2028" })).toBe('{"s":"\\u00e9\\u2028"}');
    const s = buildScript("draw_rectangle", { x: 1 }, "C:\\tmp\\r.json");
    expect(s).toContain('MCP.main({"op":"draw_rectangle","args":{"x":1}}, "C:\\\\tmp\\\\r.json");');
    expect(s).toContain("MCP.ops.execute_plan");
  });
  it("every allowlisted op is implemented in the JSX layer and vice versa", () => {
    const jsx = readdirSync(SCRIPT_DIR).filter((f) => f.endsWith(".jsx")).map((f) => readFileSync(join(SCRIPT_DIR, f), "utf8")).join("\n");
    const implemented = new Set([...jsx.matchAll(/MCP\.ops\.(\w+)\s*=/g)].map((m) => m[1]!));
    expect([...ALLOWED_OPS].filter((o) => !implemented.has(o))).toEqual([]);
    expect([...implemented].filter((o) => !ALLOWED_OPS.has(o))).toEqual([]);
  });
  it("JSX files are syntactically valid ES3-style JavaScript", () => {
    for (const f of readdirSync(SCRIPT_DIR).filter((x) => x.endsWith(".jsx"))) {
      const src = readFileSync(join(SCRIPT_DIR, f), "utf8");
      expect(() => new Function(src), f).not.toThrow();
      expect(/\b(let|const)\s|=>|`|\.forEach\(|\.map\(|JSON\.parse/.test(src), `${f} uses non-ES3 syntax`).toBe(false);
    }
  });
});

class StubAdapter implements BridgeAdapter {
  readonly name = "mock" as const;
  constructor(private readonly impl: (req: ExecuteRequest) => Promise<string>) {}
  detect = async () => ({ platform: process.platform, installs: [], comRegistered: false, running: false, notes: [] });
  execute(req: ExecuteRequest) { return this.impl(req); }
}

describe("bridge", () => {
  it("refuses operations outside the allowlist before contacting Illustrator", async () => {
    const mock = new MockAdapter();
    const bridge = new IllustratorBridge(mock, 1000);
    await expect(bridge.run("app.quit", {})).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
    expect(mock.calls).toHaveLength(0);
  });
  it("maps script failures to typed errors and never reports success", async () => {
    const bridge = new IllustratorBridge(new StubAdapter(async () => JSON.stringify({ ok: false, error: { code: "OBJECT_NOT_FOUND", message: "nope" } })), 1000);
    await expect(bridge.run("draw_rectangle", {})).rejects.toMatchObject({ code: "OBJECT_NOT_FOUND", message: "nope" });
    const weird = new IllustratorBridge(new StubAdapter(async () => JSON.stringify({ ok: false, error: { code: "EVIL", message: "x" } })), 1000);
    await expect(weird.run("status", {})).rejects.toMatchObject({ code: "ILLUSTRATOR_SCRIPT_ERROR" });
  });
  it("rejects malformed output", async () => {
    expect(() => parseEnvelope("not json")).toThrow(McpDesignError);
    expect(() => parseEnvelope('{"data":1}')).toThrow(/envelope/);
    const bridge = new IllustratorBridge(new StubAdapter(async () => "garbage"), 1000);
    await expect(bridge.run("status", {})).rejects.toMatchObject({ code: "ILLUSTRATOR_SCRIPT_ERROR" });
  });
  it("times out a hung adapter and keeps serving later calls", async () => {
    let calls = 0;
    const bridge = new IllustratorBridge(new StubAdapter(async () => {
      calls++;
      if (calls === 1) return new Promise<string>(() => undefined);
      return JSON.stringify({ ok: true, data: { fine: true } });
    }), 1000);
    const started = Date.now();
    await expect(bridge.run("status", {}, { timeoutMs: 50 })).rejects.toMatchObject({ code: "BRIDGE_TIMEOUT" });
    expect(Date.now() - started).toBeLessThan(5000);
    await expect(bridge.run("status", {})).resolves.toMatchObject({ data: { fine: true } });
  });
  it("passes warnings and adapter identity through", async () => {
    const bridge = new IllustratorBridge(new StubAdapter(async () => JSON.stringify({ ok: true, data: 1, warnings: ["font fallback"] })), 1000);
    await expect(bridge.run("status", {})).resolves.toMatchObject({ data: 1, warnings: ["font fallback"], adapter: "mock" });
  });
});
