import type { BridgeAdapter, DetectionResult, ExecuteRequest, ScriptEnvelope } from "./types.js";

interface MockItem {
  name: string;
  type: string;
  layer: string;
  bounds: { x: number; y: number; width: number; height: number };
  fill?: { hex: string } | null;
  contents?: string;
  fontSize?: number;
  font?: string;
}

type Handler = (args: Record<string, unknown>, state: MockState) => unknown;

interface MockState {
  document: { name: string; width: number; height: number; colorMode: string } | null;
  layers: string[];
  items: MockItem[];
}

/**
 * In-memory stand-in for Illustrator used by automated tests (ILLUSTRATOR_ADAPTER=mock).
 * It models only enough document state to exercise the server; every result produced through
 * it is tagged adapter: "mock" by the bridge so it can never be mistaken for real artwork.
 */
export class MockAdapter implements BridgeAdapter {
  readonly name = "mock" as const;
  readonly calls: { op: string; args: unknown }[] = [];
  state: MockState = { document: null, layers: [], items: [] };
  private overrides = new Map<string, Handler | ScriptEnvelope>();
  delayMs = 0;

  /** Force a specific op to return an envelope or run a custom handler. */
  on(op: string, response: Handler | ScriptEnvelope): void {
    this.overrides.set(op, response);
  }

  async detect(): Promise<DetectionResult> {
    return {
      platform: process.platform,
      installs: [],
      comRegistered: false,
      automationAvailable: false,
      running: false,
      notes: ["Mock adapter: no real Illustrator is used."],
    };
  }

  async execute(req: ExecuteRequest): Promise<string> {
    this.calls.push({ op: req.op, args: req.args });
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const override = this.overrides.get(req.op);
    if (override && typeof override !== "function") return JSON.stringify(override);
    try {
      const handler = (override as Handler | undefined) ?? this.handlers[req.op] ?? (() => ({ echo: req.args }));
      return JSON.stringify({ ok: true, data: handler((req.args ?? {}) as Record<string, unknown>, this.state), warnings: [] });
    } catch (e) {
      const err = e as { code?: string; message: string };
      return JSON.stringify({ ok: false, error: { code: err.code ?? "ILLUSTRATOR_SCRIPT_ERROR", message: err.message } });
    }
  }

  private requireDoc(): NonNullable<MockState["document"]> {
    if (!this.state.document) throw Object.assign(new Error("No document is open in Illustrator."), { code: "NO_ACTIVE_DOCUMENT" });
    return this.state.document;
  }

  private add(item: MockItem): MockItem {
    this.requireDoc();
    if (!this.state.layers.includes(item.layer)) this.state.layers.push(item.layer);
    this.state.items.push(item);
    return item;
  }

  private shape(type: string) {
    return (a: Record<string, unknown>) =>
      this.add({
        name: String(a.name ?? type), type, layer: String(a.layer ?? this.state.layers[0] ?? "Layer 1"),
        bounds: { x: Number(a.x ?? a.cx ?? 0), y: Number(a.y ?? a.cy ?? 0), width: Number(a.width ?? a.radius ?? 0), height: Number(a.height ?? a.radius ?? 0) },
        fill: (a.fill as { hex: string }) ?? null,
      });
  }

  private handlers: Record<string, Handler> = {
    status: (_a, s) => ({ application: "Mock Illustrator", version: "0.0-mock", documentCount: s.document ? 1 : 0, activeDocument: s.document?.name ?? null }),
    create_document: (a, s) => {
      s.document = { name: String(a.name ?? "Untitled"), width: Number(a.width), height: Number(a.height), colorMode: String(a.colorMode ?? "RGB") };
      s.layers = ["Layer 1"];
      s.items = [];
      return this.docInfo();
    },
    inspect_document: () => ({ ...this.docInfo(), items: this.state.items, layers: this.state.layers.map((name, index) => ({ index, name })) }),
    get_artboards: () => ({ artboards: this.docInfo().artboards }),
    draw_rectangle: this.shape("PathItem"),
    draw_ellipse: this.shape("PathItem"),
    draw_polygon: this.shape("PathItem"),
    draw_star: this.shape("PathItem"),
    add_text: (a) =>
      this.add({
        name: String(a.name ?? "Text"), type: "TextFrame", layer: String(a.layer ?? "Layer 1"),
        bounds: { x: Number(a.x), y: Number(a.y), width: String(a.content).length * Number(a.fontSize ?? 12) * 0.55, height: Number(a.fontSize ?? 12) * 1.2 },
        fill: (a.color as { hex: string }) ?? { hex: "#000000" }, contents: String(a.content), fontSize: Number(a.fontSize ?? 12),
        font: Array.isArray(a.font) ? String(a.font[0]) : (a.font as string | undefined),
      }),
    inspect_layers: (_a, s) => ({ layers: s.layers.map((name, index) => ({ index, name })) }),
    create_layer: (a, s) => {
      this.requireDoc();
      if (s.layers.includes(String(a.name))) throw Object.assign(new Error("Layer already exists"), { code: "VALIDATION_ERROR" });
      s.layers.push(String(a.name));
      return { layers: s.layers.map((name, index) => ({ index, name })) };
    },
    execute_plan: (a, s) => {
      s.document = { name: "Plan", width: Number(a.width), height: Number(a.height), colorMode: String(a.colorMode) };
      s.layers = [...(a.layers as string[])];
      s.items = [];
      const built = (a.elements as Record<string, unknown>[]).map((el) =>
        el.type === "text" ? this.handlers.add_text!(el, s) : this.shape(String(el.type))(el),
      );
      return { document: this.docInfo(), layers: s.layers, built, failed: [] };
    },
    update_elements: (a, s) => {
      const updated: unknown[] = [];
      const failed: unknown[] = [];
      for (const u of a.updates as Record<string, unknown>[]) {
        const item = s.items.find((i) => i.name === u.name);
        if (!item) { failed.push({ name: u.name, code: "OBJECT_NOT_FOUND" }); continue; }
        if (u.x !== undefined) item.bounds.x = Number(u.x);
        if (u.y !== undefined) item.bounds.y = Number(u.y);
        if (u.fill) item.fill = u.fill as { hex: string };
        if (u.fontSize) item.fontSize = Number(u.fontSize);
        updated.push(item);
      }
      return { updated, failed };
    },
    export_png: (a) => ({ files: [{ path: String(a.path), bytes: 0 }], mock: true }),
  };

  private docInfo() {
    const d = this.requireDoc();
    return { name: d.name, colorMode: d.colorMode, artboards: [{ index: 0, name: "Artboard 1", width: d.width, height: d.height, active: true }] };
  }
}
