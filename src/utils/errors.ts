export type ErrorCode =
  | "VALIDATION_ERROR"
  | "ILLUSTRATOR_NOT_INSTALLED"
  | "ILLUSTRATOR_NOT_RUNNING"
  | "ILLUSTRATOR_SCRIPT_ERROR"
  | "BRIDGE_TIMEOUT"
  | "BRIDGE_UNAVAILABLE"
  | "NO_ACTIVE_DOCUMENT"
  | "OBJECT_NOT_FOUND"
  | "PATH_NOT_ALLOWED"
  | "FILE_EXISTS"
  | "FILE_NOT_FOUND"
  | "CONFIRMATION_REQUIRED"
  | "UNSUPPORTED_OPERATION"
  | "PLAN_INVALID"
  | "INTERNAL_ERROR";

export class McpDesignError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "McpDesignError";
  }

  toJSON(): Record<string, unknown> {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export function toMcpError(err: unknown): McpDesignError {
  if (err instanceof McpDesignError) return err;
  if (err instanceof Error) return new McpDesignError("INTERNAL_ERROR", err.message);
  return new McpDesignError("INTERNAL_ERROR", String(err));
}
