import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const envLevel = process.env.LOG_LEVEL ?? "info";
let minLevel: LogLevel = envLevel in ORDER ? (envLevel as LogLevel) : "info";
let logFile: string | undefined;

/** Configure logging. Logs never go to stdout because stdout carries the stdio MCP transport. */
export function configureLogger(opts: { level?: string; dir?: string }): void {
  if (opts.level && opts.level in ORDER) minLevel = opts.level as LogLevel;
  if (opts.dir) {
    try {
      mkdirSync(opts.dir, { recursive: true });
      logFile = join(opts.dir, `mcp-${new Date().toISOString().slice(0, 10)}.log`);
    } catch {
      logFile = undefined;
    }
  }
}

function write(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[minLevel]) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...data });
  process.stderr.write(line + "\n");
  if (logFile) {
    try {
      appendFileSync(logFile, line + "\n");
    } catch {
      /* file logging is best-effort */
    }
  }
}

export const logger = {
  debug: (m: string, d?: Record<string, unknown>) => write("debug", m, d),
  info: (m: string, d?: Record<string, unknown>) => write("info", m, d),
  warn: (m: string, d?: Record<string, unknown>) => write("warn", m, d),
  error: (m: string, d?: Record<string, unknown>) => write("error", m, d),
};
