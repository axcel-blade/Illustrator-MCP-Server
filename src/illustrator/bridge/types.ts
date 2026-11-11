export type AdapterName = "com" | "applescript" | "mock";

export interface IllustratorInstall {
  version: string;
  path: string;
  executable: string;
}

export interface DetectionResult {
  platform: NodeJS.Platform;
  installs: IllustratorInstall[];
  /** Windows only: COM class Illustrator.Application is registered. Always false on macOS. */
  comRegistered: boolean;
  comProgId?: string;
  /** True when the platform bridge can reach Illustrator (COM registered on Windows; .app found on macOS). */
  automationAvailable: boolean;
  /** Which production bridge this host would use (absent on unsupported platforms / mock). */
  bridge?: "com" | "applescript";
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
 * Isolates the automation mechanism. Production: COM (Windows) or AppleScript (macOS).
 * The mock adapter exists for automated tests and never claims to be a real Illustrator.
 */
export interface BridgeAdapter {
  readonly name: AdapterName;
  detect(): Promise<DetectionResult>;
  execute(req: ExecuteRequest): Promise<string>;
}

export interface BridgeResult<T = unknown> {
  data: T;
  warnings: string[];
  adapter: AdapterName;
  durationMs: number;
}
