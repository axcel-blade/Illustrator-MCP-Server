export interface IllustratorInstall {
  version: string;
  path: string;
  executable: string;
}

export interface DetectionResult {
  platform: NodeJS.Platform;
  installs: IllustratorInstall[];
  comRegistered: boolean;
  comProgId?: string;
  running: boolean;
  notes: string[];
}

/** Raw JSON envelope produced by bootstrap.jsx (MCP.main). */
export interface ScriptEnvelope {
  ok: boolean;
  data?: unknown;
  warnings?: string[];
  error?: { code: string; message: string; line?: number; details?: unknown };
  /** Name of the active document after the op ran (absent when none is open). */
  document?: string;
}

export interface ExecuteRequest {
  op: string;
  args: unknown;
  /** Complete self-contained JSX source. */
  script: string;
  /** File the script writes its JSON result to. */
  resultPath: string;
  timeoutMs: number;
}

/**
 * Isolates the automation mechanism. The COM adapter is the production implementation; the
 * mock adapter exists for automated tests and never claims to be a real Illustrator.
 */
export interface BridgeAdapter {
  readonly name: "com" | "mock";
  detect(): Promise<DetectionResult>;
  execute(req: ExecuteRequest): Promise<string>;
}

export interface BridgeResult<T = unknown> {
  data: T;
  warnings: string[];
  adapter: "com" | "mock";
  durationMs: number;
}
