import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpDesignError, type ErrorCode } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { OperationQueue } from "./queue.js";
import { ALLOWED_OPS, buildScript } from "./script-builder.js";
import type { BridgeAdapter, BridgeResult, DetectionResult, ScriptEnvelope } from "./types.js";

const KNOWN_CODES = new Set<string>([
  "VALIDATION_ERROR", "ILLUSTRATOR_NOT_INSTALLED", "ILLUSTRATOR_NOT_RUNNING", "ILLUSTRATOR_SCRIPT_ERROR", "BRIDGE_TIMEOUT",
  "BRIDGE_UNAVAILABLE", "NO_ACTIVE_DOCUMENT", "OBJECT_NOT_FOUND", "FILE_NOT_FOUND", "CONFIRMATION_REQUIRED", "UNSUPPORTED_OPERATION",
]);

export interface RunOptions {
  timeoutMs?: number;
}

/**
 * The single gateway to Illustrator. Validates the op against the allowlist, serialises calls,
 * enforces timeouts, parses the JSX envelope and turns failures into typed errors.
 * Success is only reported when the JSX layer itself returned ok: true.
 */
export class IllustratorBridge {
  private readonly queue = new OperationQueue();
  private readonly workDir: string;

  constructor(
    readonly adapter: BridgeAdapter,
    private readonly defaultTimeoutMs: number,
  ) {
    this.workDir = join(tmpdir(), "illustrator-ai-mcp");
    mkdirSync(this.workDir, { recursive: true });
  }

  get adapterName(): "com" | "mock" {
    return this.adapter.name;
  }

  get pending(): number {
    return this.queue.size;
  }

  detect(): Promise<DetectionResult> {
    return this.adapter.detect();
  }

  async run<T = unknown>(op: string, args: object = {}, opts: RunOptions = {}): Promise<BridgeResult<T>> {
    if (!ALLOWED_OPS.has(op)) throw new McpDesignError("UNSUPPORTED_OPERATION", `Operation is not allowlisted: ${op}`);
    return this.queue.run(async () => {
      const id = randomUUID();
      const resultPath = join(this.workDir, `${id}.json`);
      const started = Date.now();
      const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
      try {
        const raw = await withTimeout(
          this.adapter.execute({ op, args, script: buildScript(op, args, resultPath), resultPath, timeoutMs }),
          timeoutMs + 2000,
        );
        const envelope = parseEnvelope(raw);
        const durationMs = Date.now() - started;
        logger.info("bridge op", { op, ok: envelope.ok, durationMs, adapter: this.adapter.name });
        if (!envelope.ok) {
          const e = envelope.error ?? { code: "ILLUSTRATOR_SCRIPT_ERROR", message: "Unknown script failure" };
          const code = (KNOWN_CODES.has(e.code) ? e.code : "ILLUSTRATOR_SCRIPT_ERROR") as ErrorCode;
          throw new McpDesignError(code, e.message, { op, line: e.line, details: e.details, warnings: envelope.warnings });
        }
        return { data: envelope.data as T, warnings: envelope.warnings ?? [], adapter: this.adapter.name, durationMs };
      } catch (err) {
        if (!(err instanceof McpDesignError)) logger.error("bridge failure", { op, error: String(err) });
        throw err;
      } finally {
        for (const ext of [".json", ".jsx"]) rmSync(resultPath.replace(/\.json$/, ext), { force: true });
      }
    });
  }
}

/** Bridge-level watchdog so a misbehaving adapter can never block the queue forever. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new McpDesignError("BRIDGE_TIMEOUT", `Illustrator operation exceeded ${ms} ms. Inspect the document before retrying.`)),
      ms,
    );
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

export function parseEnvelope(raw: string): ScriptEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new McpDesignError("ILLUSTRATOR_SCRIPT_ERROR", "Illustrator returned malformed output.", { raw: raw.slice(0, 500) });
  }
  if (typeof parsed !== "object" || parsed === null || typeof (parsed as ScriptEnvelope).ok !== "boolean") {
    throw new McpDesignError("ILLUSTRATOR_SCRIPT_ERROR", "Illustrator output is missing the result envelope.", { raw: raw.slice(0, 500) });
  }
  return parsed as ScriptEnvelope;
}
