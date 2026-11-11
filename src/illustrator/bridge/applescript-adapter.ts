import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { McpDesignError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { detectIllustrator } from "./detect.js";
import { SCRIPT_DIR } from "./script-builder.js";
import type { BridgeAdapter, DetectionResult, ExecuteRequest } from "./types.js";

/**
 * macOS AppleScript adapter: Node → osascript → Illustrator `do javascript file`.
 * Mirrors the Windows COM adapter: each call is a short-lived osascript process so a hung
 * Illustrator call can be killed on timeout without taking the MCP server down.
 */
export class AppleScriptAdapter implements BridgeAdapter {
  readonly name = "applescript" as const;

  constructor(private readonly opts: { autoLaunch: boolean }) {}

  detect(): Promise<DetectionResult> {
    return detectIllustrator();
  }

  async execute(req: ExecuteRequest): Promise<string> {
    if (process.platform !== "darwin") {
      throw new McpDesignError("BRIDGE_UNAVAILABLE", "The AppleScript Illustrator bridge only runs on macOS.");
    }
    const scriptPath = req.resultPath.replace(/\.json$/, ".jsx");
    await writeFile(scriptPath, req.script, "utf8");
    const runner = join(SCRIPT_DIR, "run-jsx.applescript");
    const args = [runner, scriptPath, req.resultPath, this.opts.autoLaunch ? "false" : "true"];

    await new Promise<void>((resolve, reject) => {
      const child = spawn("osascript", args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      const timer = setTimeout(() => {
        child.kill();
        reject(
          new McpDesignError(
            "BRIDGE_TIMEOUT",
            `Illustrator did not respond within ${req.timeoutMs} ms. The operation may still complete inside Illustrator; inspect the document before retrying.`,
          ),
        );
      }, req.timeoutMs);
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new McpDesignError("BRIDGE_UNAVAILABLE", `Could not start osascript: ${err.message}`));
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        if (stderr.trim()) logger.warn("osascript stderr", { stderr: stderr.trim().slice(0, 2000) });
        if (code !== 0) reject(new McpDesignError("BRIDGE_UNAVAILABLE", `osascript exited with code ${code}: ${stderr.trim()}`));
        else resolve();
      });
    });

    if (!existsSync(req.resultPath)) {
      throw new McpDesignError("ILLUSTRATOR_SCRIPT_ERROR", "Illustrator produced no result file.");
    }
    return readFileSync(req.resultPath, "utf8").replace(/^\uFEFF/, "");
  }
}
